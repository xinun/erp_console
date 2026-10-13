import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(path, overrides = {}) {
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require, console, process: { env: { MATTERMOST_BASE_URL: 'https://mattermost.example' } },
    Response, Headers, FormData, URL, ...overrides,
  }, { filename: path });
  return exports;
}
const search = load('src/lib/mattermost-search.ts');

test('version candidates retain operators and exact boundaries', () => {
  const plan = search.getMattermostSearchPlan('in:release "설치 가이드" 2.16.0');
  assert.deepEqual(Array.from(plan.fallbackTerms), [
    'in:release "설치 가이드" 2*', 'in:release "설치 가이드" v2*',
  ]);
  assert.equal(plan.matchesVersion('accordion-v2.16.0-linux.tar.gz'), true);
  assert.equal(plan.matchesVersion('2.16.0-rc1'), true);
  for (const text of ['12.16.0', '2.16.01', '2.16.0.1', '2.16.1', '2.160']) {
    assert.equal(plan.matchesVersion(text), false, text);
  }
});

test('normal Korean search and non-version operators retain their meaning', () => {
  const plan = search.getMattermostSearchPlan('배포 오류 in:release after:2026-01-01');
  assert.deepEqual(Array.from(plan.terms), ['배포* 오류* in:release after:2026-01-01']);
  assert.equal(plan.fallbackTerms.length, 0);
  assert.equal(plan.matchesVersion('any message'), true);
});

async function runSearch(version, searchResponse) {
  const requests = [];
  const getPosts = (terms, kind) => searchResponse(terms, kind);
  const route = load('src/app/api/search/route.ts', {
    require: (name) => name === '@/lib/mattermost-search' ? search
      : name === '@/lib/mattermost-user' ? { formatMattermostUserName: () => 'Tester' } : require(name),
    fetch: async (url, options = {}) => {
      const endpoint = new URL(url).pathname;
      let data;
      if (endpoint === '/api/v4/users/me/teams') data = [{ id: 'team', name: 'test', display_name: 'Test' }];
      else if (endpoint === '/api/v4/users/me') data = { id: 'user', username: 'tester' };
      else if (endpoint.endsWith('/posts/search') || endpoint.endsWith('/files/search')) {
        const kind = endpoint.endsWith('/posts/search') ? 'posts' : 'files';
        assert.equal(options.headers['Content-Type'], 'application/json');
        const payload = JSON.parse(options.body);
        assert.equal(typeof payload.is_or_search, 'boolean');
        if (kind === 'files') {
          assert.equal(payload.include_deleted_channels, true);
          assert.equal(payload.per_page, 100);
        }
        const terms = payload.terms;
        requests.push({ kind, terms });
        const response = getPosts(terms, kind);
        if (typeof response === 'number') return Response.json({}, { status: response });
        data = kind === 'posts' ? { order: response.map((post) => post.id), posts: Object.fromEntries(response.map((post) => [post.id, post])) }
          : { order: response.map((file) => file.id), file_infos: Object.fromEntries(response.map((file) => [file.id, file])) };
      } else if (endpoint.endsWith('/channels/ids')) data = [{ id: 'channel', name: 'release', type: 'O' }];
      else if (endpoint === '/api/v4/users/ids') data = [{ id: 'user', username: 'tester' }];
      else throw new Error(`Unexpected endpoint: ${endpoint}`);
      return Response.json(data);
    },
  });
  const response = await route.GET({
    nextUrl: new URL(`https://erp.example/api/search?sources=mattermost&q=${encodeURIComponent(version)}`),
    headers: new Headers({ 'x-mattermost-token': 'test-token' }),
  });
  return { data: await response.json(), requests };
}
const post = (id, message, extra = {}) => ({
  id, message, user_id: 'user', channel_id: 'channel', create_at: Date.now(), ...extra,
});

test('3.1.0 recovers v-prefixed messages, deduplicates and groups replies', async () => {
  const { data, requests } = await runSearch('3.1.0', (terms, kind) => {
    if (kind === 'files') return [];
    return terms === '3.1.0' ? [] : [post('root', 'v3.1.0 배포', { reply_count: 1 }), post('reply', '3.1.0 확인', { root_id: 'root' }), post('other', '3.1.01')];
  });
  assert.equal(data.counts.mattermost, 1);
  assert.equal(data.results[0].threadMessages.length, 2);
  assert.equal(data.results[0].id, 'thread-root');
  assert(requests.some((request) => request.terms === 'v3.1.0*'));
});

test('2.16.0 uses broad candidates when full version terms miss and filters filenames', async () => {
  const { data } = await runSearch('2.16.0', (terms, kind) => {
    if (kind === 'posts') return terms === '2*' ? [post('match', '설치 2.16.0'), post('wrong', '12.16.0')] : [];
    return terms === 'v2*' ? [{ id: 'zip', name: 'accordion-v2.16.0.zip' }, { id: 'wrong', name: 'v2.16.01.zip' }] : [];
  });
  assert.equal(data.counts.mattermost, 2);
  assert.deepEqual(data.results.map((result) => result.id).sort(), ['file-zip', 'match']);
});

test('API failures are visible while successful version results survive', async () => {
  const { data } = await runSearch('3.1.0', (terms, kind) => {
    if (kind === 'files') return 403;
    return terms === '3.1.0' ? 500 : [post('match', '3.1.0')];
  });
  assert.equal(data.counts.mattermost, 1);
  assert.match(data.errors.mattermost, /500/);
  assert.match(data.errors.mattermost, /403/);
});

test('original attachment-content matches survive filename-only fallback filtering', async () => {
  const { data } = await runSearch('3.1.0', (terms, kind) => kind === 'files' && terms === '3.1.0'
    ? [{ id: 'guide', name: 'guide.pdf' }] : []);
  assert.equal(data.results[0].id, 'file-guide');
});

test('failed searches return a visible error rather than a silent zero count', async () => {
  const { data } = await runSearch('release', () => 401);
  assert.equal(data.counts.mattermost, 0);
  assert.match(data.errors.mattermost, /401/);
});

test('truncated broad candidates produce a warning instead of implying a complete search', async () => {
  const { data } = await runSearch('3.1.0', (terms, kind) => kind === 'posts' && terms === '3*'
    ? Array.from({ length: 100 }, (_, index) => post(String(index), '3.2.0')) : []);
  assert.equal(data.counts.mattermost, 0);
  assert.match(data.errors.mattermost, /누락/);
});
