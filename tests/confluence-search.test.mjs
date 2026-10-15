import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const compiled = ts.transpileModule(readFileSync('src/app/api/search/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function search(query, dateRange = 'all') {
  const requests = [];
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => name === '@/lib/mattermost-user' ? {} : name === '@/lib/mattermost-search' ? {} : require(name),
    Response, URL, URLSearchParams, Buffer, console, process: { env: {} },
    fetch: async (url) => {
      const request = new URL(url);
      requests.push(request);
      return Response.json({ results: [{
        title: '한화시스템 구축 보고서',
        excerpt: '프로젝트 진행 사항과 담당자별 작업 일정입니다. 별첨 WBS를 참고하세요.',
        url: '/spaces/project/pages/report',
        lastModified: '2026-10-15T00:00:00Z',
        content: { id: 'report', type: 'page' },
      }] });
    },
  });
  const params = new URLSearchParams({ q: query, sources: 'confluence', dateRange });
  const result = await exports.GET({
    nextUrl: new URL(`https://erp.example/api/search?${params}`),
    headers: new Headers({
      'x-atlassian-oauth-token': 'test-token',
      'x-atlassian-cloud-id': 'cloud',
      'x-atlassian-site-url': 'https://example.atlassian.net',
    }),
  });
  return { data: await result.json(), requests };
}

test('multiword Confluence request requires both words without a phrase or proximity constraint', async () => {
  const { data, requests } = await search('한화시스템 wbs');
  const cql = requests[0].searchParams.get('cql');
  assert.equal(cql, 'text~"한화시스템*" AND text~"wbs*" ORDER BY lastModified DESC');
  assert.equal(requests[0].pathname, '/ex/confluence/cloud/rest/api/search');
  assert.equal(data.counts.confluence, 1);
  assert.equal(data.results[0].title, '한화시스템 구축 보고서');
  assert.match(data.results[0].snippet, /WBS/);
});

test('individual word conditions retain the selected date filter', async () => {
  const { requests } = await search('한화시스템 wbs', '1m');
  assert.match(requests[0].searchParams.get('cql'), /^text~"한화시스템\*" AND text~"wbs\*" AND lastModified >= "\d{4}-\d{2}-\d{2}" ORDER BY lastModified DESC$/);
});

test('single-term Confluence search retains prefix matching', async () => {
  const { requests } = await search('wbs');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].searchParams.get('cql'), 'text~"wbs*" ORDER BY lastModified DESC');
});
