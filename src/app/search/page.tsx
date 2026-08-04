'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  SearchResult,
  SearchResponse,
  SearchFilters,
  SearchSource,
  DateRange,
} from '@/lib/types';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useAtlassianAuth, type AtlassianConnection, type AtlassianProduct } from '@/hooks/useAtlassianAuth';
import { useMattermostAuth } from '@/hooks/useMattermostAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

type DrawerType = 'atlassian' | 'google' | 'mattermost' | null;

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconSearch({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 10L10 2M10 2H5.5M10 2V6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="animate-spin">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="#E5E7EB" strokeWidth="2" />
      <path d="M7.5 2a5.5 5.5 0 0 1 5.5 5.5" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.25v9.5M3.25 8h9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronDown({ open = false }: { open?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M3.5 5.25 7 8.75l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="m2.5 6 2.2 2.2 4.8-4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMinusCircle() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5.75" stroke="currentColor" strokeWidth="1.25" />
      <path d="M4.75 7.5h5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function IconService({ type }: { type: NonNullable<DrawerType> }) {
  const iconClass = 'h-4 w-4';
  if (type === 'google') {
    return (
      <svg className={iconClass} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2.7 11.2 6.3 4.9h3.45l3.55 6.3-1.7 2.8H4.35L2.7 11.2Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
        <path d="m6.3 4.9 3.65 6.3M2.7 11.2h7.25" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'mattermost') {
    return (
      <svg className={iconClass} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 4.25h10v6.5H7.2L4.25 13v-2.25H3v-6.5Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
        <path d="M5.25 7.5h5.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className={iconClass} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.75 4.25A1.25 1.25 0 0 1 4 3h3l1 1.25h4A1.25 1.25 0 0 1 13.25 5.5v6.25A1.25 1.25 0 0 1 12 13H4a1.25 1.25 0 0 1-1.25-1.25v-7.5Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Source Badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source, fileType }: { source: SearchSource; fileType?: string }) {
  const styles: Record<SearchSource, { bg: string; text: string; border: string; label: string }> = {
    jira: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', label: 'Jira' },
    jsm: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', label: '고객 문의' },
    confluence: { bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE', label: 'Confluence' },
    drive: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', label: fileType ?? 'Drive' },
    mattermost: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3', label: 'Mattermost' },
  };
  const s = styles[source];
  return (
    <span
      className="inline-block text-xs font-semibold px-2 py-0.5 rounded"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const terms = query.trim().split(/\s+/).filter((term) => term.length > 1);
  if (terms.length === 0) return text;
  const pattern = terms
    .sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const parts = text.split(new RegExp(`(${pattern})`, 'gi'));
  const normalizedTerms = new Set(terms.map((term) => term.toLocaleLowerCase()));

  return parts.map((part, index) =>
    normalizedTerms.has(part.toLocaleLowerCase()) ? (
      <mark key={`${part}-${index}`} className="rounded-sm bg-amber-100 px-0.5 text-inherit">
        {part}
      </mark>
    ) : part
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({
  result,
  query,
  onPreview,
}: {
  result: SearchResult;
  query: string;
  onPreview: (result: SearchResult) => void;
}) {
  const meta: string[] = [];
  if (result.source === 'jira' || result.source === 'jsm') {
    if (result.key) meta.push(result.key);
    if (result.issueType) meta.push(result.issueType);
    if (result.status) meta.push(result.status);
    if (result.project) meta.push(result.project);
  } else if (result.source === 'confluence') {
    if (result.space) meta.push(result.space);
  } else if (result.source === 'mattermost') {
    if (result.channelName) meta.push(result.channelName);
    if (result.team) meta.push(result.team);
  }
  if (result.author && result.source !== 'mattermost') meta.push(result.author);
  if (result.date) meta.push(formatDate(result.date));

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="mb-1.5">
            <SourceBadge source={result.source} fileType={result.fileType} />
          </div>
          <button
            type="button"
            onClick={() => onPreview(result)}
            className="mb-1.5 block w-full text-left text-sm font-semibold leading-snug text-gray-900 hover:text-blue-600 focus-visible:outline-none focus-visible:underline"
          >
            <HighlightedText text={result.title} query={query} />
          </button>
          {result.snippet && (
            <p className="line-clamp-3 text-xs leading-relaxed text-gray-500">
              <HighlightedText text={result.snippet} query={query} />
            </p>
          )}
          {meta.length > 0 && (
            <div className="flex flex-wrap items-center mt-2">
              {meta.map((m, i) => (
                <span key={i} className="text-xs text-gray-400">
                  {i > 0 && <span className="mx-1.5">·</span>}
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onPreview(result)}
          className="mt-0.5 flex flex-shrink-0 items-center gap-1 text-xs text-gray-400 opacity-0 transition-opacity hover:text-blue-600 group-hover:opacity-100 focus-visible:opacity-100"
        >
          미리보기 <IconChevronRight />
        </button>
      </div>
    </div>
  );
}

function ResultPreview({
  result,
  query,
  onClose,
}: {
  result: SearchResult;
  query: string;
  onClose: () => void;
}) {
  const isJira = result.source === 'jira' || result.source === 'jsm';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-5">
      <button
        type="button"
        aria-label="미리보기 닫기"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-preview-title"
        className={`relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${isJira ? 'max-w-5xl' : 'max-w-2xl'}`}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <SourceBadge source={result.source} fileType={result.fileType} />
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="group/title mt-2 flex w-fit items-center gap-2">
              <h2 id="result-preview-title" className="text-base font-semibold leading-snug text-slate-900 group-hover/title:text-blue-600">
                <HighlightedText text={result.title} query={query} />
              </h2>
              <span className="text-slate-300 opacity-0 transition-opacity group-hover/title:opacity-100"><IconExternalLink /></span>
            </a>
            <p className="mt-1 text-xs text-slate-400">
              {[result.key, result.channelName, result.project, result.space, result.team, result.author, result.date ? formatDate(result.date) : '']
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            <IconClose />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">
          {isJira ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0 space-y-7">
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">설명</h3>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-transparent bg-slate-50 px-4 py-4 transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    {(result.content || result.snippet) ? (
                      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        <HighlightedText text={result.content || result.snippet} query={query} />
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400">등록된 설명이 없습니다.</p>
                    )}
                    <span className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600">Jira에서 전체 내용 보기 <IconExternalLink /></span>
                  </a>
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">활동 · 댓글</h3>
                    <span className="text-xs text-slate-400">{result.commentsTotal ?? 0}개</span>
                  </div>
                  {result.comments && result.comments.length > 0 ? (
                    <div className="space-y-4">
                      {result.comments.map((comment) => (
                        <article key={comment.id} className="flex gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">{comment.author.slice(0, 1)}</span>
                          <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-xs font-semibold text-slate-800">{comment.author}</span>
                              <span className="text-[11px] text-slate-400">{formatDate(comment.created)}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                              <HighlightedText text={comment.body} query={query} />
                            </p>
                          </div>
                        </article>
                      ))}
                      {(result.commentsTotal ?? 0) > result.comments.length && (
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="block text-center text-xs font-medium text-blue-600 hover:underline">
                          나머지 댓글은 Jira에서 보기
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">표시할 댓글이 없습니다.</p>
                  )}
                </section>
              </div>

              <aside className="h-fit rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">세부 정보</h3>
                <dl className="space-y-3 text-xs">
                  {[
                    ['상태', result.status],
                    ['유형', result.issueType],
                    ['프로젝트', result.project],
                    ['담당자', result.author],
                    ['보고자', result.reporter],
                    ['우선순위', result.priority],
                    ['업데이트', result.date ? formatDate(result.date) : ''],
                  ].filter(([, value]) => value).map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[64px_minmax(0,1fr)] gap-2">
                      <dt className="text-slate-400">{label}</dt>
                      <dd className="break-words font-medium text-slate-700">{value}</dd>
                    </div>
                  ))}
                </dl>
                {result.labels && result.labels.length > 0 && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="mb-2 text-xs text-slate-400">레이블</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.labels.map((label) => <span key={label} className="rounded bg-slate-200 px-2 py-1 text-[11px] text-slate-600">{label}</span>)}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          ) : (result.content || result.snippet) ? (
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
              <HighlightedText text={result.content || result.snippet} query={query} />
            </p>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">미리 볼 수 있는 본문이 없습니다.</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            닫기
          </button>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            원문 열기 <IconExternalLink />
          </a>
        </div>
      </section>
    </div>
  );
}

// ─── Atlassian Drawer Content ─────────────────────────────────────────────────

interface AtlassianDrawerProps {
  kind: 'workspace' | 'jsm';
  atlassianAuth: ReturnType<typeof useAtlassianAuth>;
}

function AtlassianDrawerContent({ kind, atlassianAuth }: AtlassianDrawerProps) {
  const isJsm = kind === 'jsm';
  const [label, setLabel] = useState(isJsm ? '고객사 문의' : 'Atlassian 연결');
  const [siteUrl, setSiteUrl] = useState(
    isJsm ? process.env.NEXT_PUBLIC_ATLASSIAN_JIRA_SITE_URL ?? '' : ''
  );
  const [projectKey, setProjectKey] = useState(isJsm ? 'LYUX' : '');
  const [jqlFilter, setJqlFilter] = useState(isJsm ? 'project = LYUX' : '');
  const [error, setError] = useState('');
  const connections = atlassianAuth.connections.filter((connection) => connection.kind === kind);

  const handleConnect = () => {
    setError(atlassianAuth.connect({ label, kind, siteUrl, projectKey, jqlFilter, products: ['jira'] }) ?? '');
  };

  const presets: Array<{
    product: AtlassianProduct;
    label: string;
    siteUrl: string;
    accountHint: string;
  }> = [
    {
      product: 'jira',
      label: '회사 Jira',
      siteUrl: process.env.NEXT_PUBLIC_ATLASSIAN_JIRA_SITE_URL ?? '',
      accountHint: '회사 Atlassian 계정으로 로그인하세요.',
    },
    {
      product: 'confluence',
      label: 'Confluence',
      siteUrl: process.env.NEXT_PUBLIC_ATLASSIAN_CONFLUENCE_SITE_URL ?? '',
      accountHint: 'Confluence를 사용하는 Atlassian 계정으로 로그인하세요.',
    },
  ];

  const connectPreset = (preset: typeof presets[number]) => {
    setError(atlassianAuth.connect({
      label: preset.label,
      kind: 'workspace',
      siteUrl: preset.siteUrl,
      products: [preset.product],
    }) ?? '');
  };

  return (
    <div className="space-y-5">
      {connections.map((connection) => (
        <div key={connection.id} className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-100 text-xs font-semibold text-blue-700">
            {connection.resource.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-800">{connection.label}</p>
            <p className="truncate text-xs text-gray-500">{connection.resource.url}{connection.projectKey ? ` · ${connection.projectKey}` : ''}</p>
            {connection.user && (
              <p className="truncate text-xs text-blue-700">{connection.user.name}{connection.user.email ? ` · ${connection.user.email}` : ''}</p>
            )}
          </div>
          <button onClick={() => atlassianAuth.disconnect(connection.id)} className="text-xs text-gray-500 hover:text-red-600">삭제</button>
        </div>
      ))}
      {!isJsm && <div className="space-y-3 border-t border-gray-100 pt-4">
        <div className="rounded-lg bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-800">
          OAuth는 각 Jira 사이트가 아니라 Atlassian 중앙 계정 세션을 사용합니다. 1단계 화면에서 프로필 메뉴를 열어 로그아웃한 뒤 사용할 계정으로 로그인하고, ERP Console로 돌아와 2단계를 진행하세요.
        </div>
        {presets.map((preset) => {
          const connected = connections.some((connection) => connection.products?.includes(preset.product));
          return (
            <div key={preset.product} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{preset.label}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{preset.siteUrl || '사이트 URL 환경변수 설정 필요'}</p>
                  <p className="mt-2 text-xs text-slate-600">{preset.accountHint}</p>
                  <p className="mt-1 text-[11px] leading-4 text-amber-700">2단계에서 잘못된 계정이 보이면 창을 닫으세요. OAuth 창 안에서 로그아웃하면 연결 요청이 중단됩니다.</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                  {connected ? '연결됨' : '미연결'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href="https://id.atlassian.com/manage-profile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  1. 중앙 계정 전환
                </a>
                <button
                  type="button"
                  onClick={() => connectPreset(preset)}
                  disabled={atlassianAuth.loading || !preset.siteUrl}
                  className="h-9 rounded-lg bg-blue-600 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  2. {connected ? '다시 연결' : '권한 연결'}
                </button>
              </div>
            </div>
          );
        })}
        {atlassianAuth.loading && (
          <button type="button" onClick={atlassianAuth.cancelConnect} className="w-full text-xs font-medium text-slate-500 hover:text-red-600">
            중단된 연결 취소
          </button>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>}
      {isJsm && <div className="space-y-3 border-t border-gray-100 pt-4">
        <div>
          <label className="mb-1 block text-xs text-gray-500">연결 이름</label>
          <input value={label} onChange={(event) => setLabel(event.target.value)} className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Atlassian 사이트 주소</label>
          <input type="url" value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm" />
        </div>
        {isJsm && <div>
          <label className="mb-1 block text-xs text-gray-500">JSM 프로젝트 키</label>
          <input value={projectKey} onChange={(event) => setProjectKey(event.target.value)} className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm uppercase" />
        </div>}
        {isJsm && <div>
          <label className="mb-1 block text-xs text-gray-500">문의 검색 범위(JQL)</label>
          <textarea
            value={jqlFilter}
            onChange={(event) => setJqlFilter(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
            placeholder="project = LYUX"
          />
          <p className="mt-1 text-[11px] text-gray-400">큐 34의 실제 JQL을 알고 있다면 여기에 입력하세요.</p>
        </div>}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          onClick={handleConnect}
          disabled={atlassianAuth.loading}
          className="h-10 w-full rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {atlassianAuth.loading ? '연결 중...' : isJsm ? '고객 문의 계정 연결' : '문서·개발 계정 연결'}
        </button>
      </div>}
    </div>
  );
}

// ─── Google Drawer Content ────────────────────────────────────────────────────

interface GoogleDrawerProps {
  connected: boolean;
  email: string;
  loading: boolean;
  hasClientId: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

function GoogleDrawerContent({ connected, email, loading, hasClientId, onConnect, onDisconnect }: GoogleDrawerProps) {
  if (!hasClientId) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm font-medium text-amber-800 mb-2">관리자 설정이 필요합니다</p>
        <p className="text-xs text-amber-700 leading-relaxed">
          Google Cloud Console에서 OAuth 앱을 등록하고,{' '}
          <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> 환경변수를 설정해주세요.
        </p>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l4 4 6-6" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">{email}</p>
            <p className="text-xs text-gray-500">Google 계정 연결됨</p>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Drive, Docs, Sheets, Slides 파일을 검색할 수 있습니다.
        </p>
        <button
          onClick={onDisconnect}
          className="w-full h-9 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          연결 해제
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 leading-relaxed">
        회사 Google 계정으로 로그인하면 Drive, Docs, Sheets, Slides 파일을 통합 검색할 수 있습니다.
      </p>
      <button
        onClick={onConnect}
        disabled={loading}
        className="w-full h-10 flex items-center justify-center gap-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        {loading ? '연결 중...' : 'Google 계정으로 연결'}
      </button>
    </div>
  );
}

// ─── Mattermost Drawer Content ────────────────────────────────────────────────

interface MattermostDrawerProps {
  connected: boolean;
  loading: boolean;
  connection: { baseUrl: string; clientId: string } | null;
  onConnect: (serverUrl: string, clientId: string) => Promise<string | null>;
  onDisconnect: () => void;
}

function MattermostDrawerContent({
  connected,
  loading,
  connection,
  onConnect,
  onDisconnect,
}: MattermostDrawerProps) {
  const [serverUrl, setServerUrl] = useState(connection?.baseUrl ?? process.env.NEXT_PUBLIC_MATTERMOST_URL ?? '');
  const [clientId, setClientId] = useState(connection?.clientId ?? process.env.NEXT_PUBLIC_MATTERMOST_CLIENT_ID ?? '');
  const [connectError, setConnectError] = useState('');

  const handleConnect = async () => {
    setConnectError((await onConnect(serverUrl, clientId)) ?? '');
  };

  if (connected) {
    return (
      <div className="space-y-3">
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm font-medium text-gray-800">Mattermost 연결됨</p>
          <p className="text-xs text-gray-500 mt-0.5">{connection?.baseUrl}</p>
        </div>
        <button
          onClick={onDisconnect}
          className="w-full h-9 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          연결 해제
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-700">
        회사의 Mattermost 관리자가 발급한 OAuth Client ID와 서버 주소를 입력하세요.
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">서버 주소</label>
          <input
            type="url"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://mattermost.company.com"
            className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">OAuth Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            placeholder="Mattermost에서 발급받은 Client ID"
            className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {connectError && (
          <p className="text-xs text-red-600">{connectError}</p>
        )}
        <button
          onClick={handleConnect}
          disabled={loading}
          className="w-full h-9 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? '연결 중...' : 'Mattermost 계정으로 연결'}
        </button>
        <p className="text-xs text-gray-400 leading-relaxed">
          비밀번호는 ERP Console에 입력하거나 전송하지 않습니다.
        </p>
      </div>
    </div>
  );
}

// ─── Drawer (slide-over panel) ────────────────────────────────────────────────

interface DrawerProps {
  open: boolean;
  type: DrawerType;
  atlassianAuth: ReturnType<typeof useAtlassianAuth>;
  google: ReturnType<typeof useGoogleAuth>;
  mattermost: ReturnType<typeof useMattermostAuth>;
  onClose: () => void;
}

const DRAWER_TITLES: Record<NonNullable<DrawerType>, string> = {
  atlassian: 'Jira / Confluence 연결',
  google: 'Google Workspace 연결',
  mattermost: 'Mattermost 연결',
};

const DRAWER_DESCS: Record<NonNullable<DrawerType>, string> = {
  atlassian: 'Jira 이슈, Confluence 페이지를 검색합니다.',
  google: 'Drive, Docs, Sheets, Slides 파일을 검색합니다.',
  mattermost: '사내 메신저 채팅 대화를 검색합니다.',
};

function Drawer({ open, type, atlassianAuth, google, mattermost, onClose }: DrawerProps) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.25)' }}
          onClick={onClose}
        />
      )}
      {/* Panel — inline style로 transform 처리 (Tailwind v4의 translate vs transform 충돌 방지) */}
      <div
        className="fixed top-0 right-0 h-full bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col"
        style={{
          width: '400px',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s ease-in-out',
        }}
      >
        {type && (
          <>
            <div className="flex items-start justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{DRAWER_TITLES[type]}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{DRAWER_DESCS[type]}</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
              >
                <IconClose />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {type === 'atlassian' && (
                <AtlassianDrawerContent
                  kind="workspace"
                  atlassianAuth={atlassianAuth}
                />
              )}
              {type === 'google' && (
                <GoogleDrawerContent
                  connected={google.connected}
                  email={google.email}
                  loading={google.loading}
                  hasClientId={google.hasClientId}
                  onConnect={google.connect}
                  onDisconnect={google.disconnect}
                />
              )}
              {type === 'mattermost' && (
                <MattermostDrawerContent
                  connected={mattermost.connected}
                  loading={mattermost.loading}
                  connection={mattermost.connection}
                  onConnect={mattermost.connect}
                  onDisconnect={mattermost.disconnect}
                />
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface ServiceGroup {
  groupLabel: string;
  drawerType: DrawerType;
  services: { name: string; desc: string }[];
  connected: boolean;
}

interface SidebarProps {
  atlassianConnected: boolean;
  workspaceConnections: AtlassianConnection[];
  googleConnected: boolean;
  mattermostConnected: boolean;
  onServiceClick: (drawer: DrawerType) => void;
}

function Sidebar({
  atlassianConnected,
  workspaceConnections,
  googleConnected,
  mattermostConnected,
  onServiceClick,
}: SidebarProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const groups: ServiceGroup[] = [
    {
      groupLabel: '문서·개발',
      drawerType: 'atlassian',
      services: workspaceConnections.map((connection) => ({
        name: connection.label,
        desc: connection.resource.url,
      })),
      connected: atlassianConnected,
    },
    {
      groupLabel: 'Google Workspace',
      drawerType: 'google',
      services: [
        { name: 'Drive', desc: '파일 저장소' },
        { name: 'Docs', desc: '문서' },
        { name: 'Sheets', desc: '스프레드시트' },
        { name: 'Slides', desc: '프레젠테이션' },
      ],
      connected: googleConnected,
    },
    {
      groupLabel: 'Messenger',
      drawerType: 'mattermost',
      services: [
        { name: 'Mattermost', desc: '사내 메신저' },
      ],
      connected: mattermostConnected,
    },
  ];
  const connectedGroups = groups.filter((group) => group.connected);
  const availableGroups = groups.filter((group) => !group.connected);

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-200/80 bg-slate-50/70 flex flex-col overflow-y-auto">
      <div className="flex-1 px-3 py-4">
        {/* Service groups */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between px-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">연결</p>
              <p className="mt-0.5 text-xs text-slate-500">{connectedGroups.length}개 서비스 그룹 사용 중</p>
            </div>
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 shadow-sm">
              {connectedGroups.length}
            </span>
          </div>
          <div className="space-y-2">
          {connectedGroups.map((group) => (
            <div key={group.groupLabel} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
              <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2.5">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  group.drawerType === 'google'
                      ? 'bg-emerald-50 text-emerald-600'
                      : group.drawerType === 'mattermost'
                        ? 'bg-rose-50 text-rose-600'
                        : 'bg-blue-50 text-blue-600'
                }`}>
                  <IconService type={group.drawerType as NonNullable<DrawerType>} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-700">{group.groupLabel}</p>
                  <p className="text-[11px] text-emerald-600">연결됨</p>
                </div>
              </div>
              <div className="p-1.5">
                {group.services.map((service) => (
                  <button
                    key={service.name}
                    type="button"
                    onClick={() => onServiceClick(group.drawerType)}
                    className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400 ring-2 ring-emerald-50" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-700">{service.name}</span>
                      <span className="block truncate text-[10px] text-slate-400">{service.desc}</span>
                    </div>
                    <span className="flex-shrink-0 translate-x-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500">
                      <IconChevronRight />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {connectedGroups.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-center">
              <p className="text-xs font-medium text-slate-500">아직 연결된 서비스가 없습니다.</p>
              <p className="mt-1 text-[11px] text-slate-400">아래에서 검색 서비스를 추가하세요.</p>
            </div>
          )}
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAddMenu((current) => !current)}
            aria-expanded={showAddMenu}
            aria-controls="sidebar-add-service-menu"
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              showAddMenu
                ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 shadow-sm hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700 hover:shadow-md'
            }`}
          >
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${showAddMenu ? 'bg-blue-100' : 'bg-slate-100'}`}>
              <IconPlus />
            </span>
            <span className="flex-1 text-left">연결 추가</span>
            <IconChevronDown open={showAddMenu} />
          </button>
          <div
            id="sidebar-add-service-menu"
            aria-hidden={!showAddMenu}
            className={`grid transition-all duration-300 ease-out ${
              showAddMenu
                ? 'grid-rows-[1fr] opacity-100 translate-y-0'
                : 'pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-200/60">
              {availableGroups.length > 0 ? availableGroups.map((group) => (
                <button
                  key={group.groupLabel}
                  type="button"
                  onClick={() => {
                    setShowAddMenu(false);
                    onServiceClick(group.drawerType);
                  }}
                  tabIndex={showAddMenu ? 0 : -1}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                    <IconService type={group.drawerType as NonNullable<DrawerType>} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-700">{group.groupLabel}</span>
                    <span className="block truncate text-[10px] text-slate-400">
                      {group.services.length > 0
                        ? group.services.map((service) => service.name).join(', ')
                        : group.drawerType === 'atlassian' ? 'Jira, Confluence' : 'Jira Service Management'}
                    </span>
                  </span>
                  <span className="text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-blue-500">
                    <IconChevronRight />
                  </span>
                </button>
              )) : (
                <p className="px-3 py-3 text-center text-xs text-slate-400">모든 서비스를 연결했습니다.</p>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const google = useGoogleAuth();
  const atlassianAuth = useAtlassianAuth();
  const mattermost = useMattermostAuth();

  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [query, setQuery] = useState('');
  const [excludedKeywords, setExcludedKeywords] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [counts, setCounts] = useState({ jira: 0, confluence: 0, jsm: 0, drive: 0, mattermost: 0 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultSource, setResultSource] = useState<'all' | SearchSource>('all');
  const [previewResult, setPreviewResult] = useState<SearchResult | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    sources: ['jira', 'confluence'],
    dateRange: 'all',
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const toggleSource = (source: SearchSource) => {
    const next = filters.sources.includes(source)
      ? filters.sources.filter((item) => item !== source)
      : [...filters.sources, source];
    if (next.length === 0) return;
    setFilters({ ...filters, sources: next });
  };

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    const atlassianConnected = atlassianAuth.getConnections('workspace').length > 0;
    const mattermostConnected = mattermost.connected;
    const hasAnyConnection = atlassianConnected || google.connected || mattermostConnected;
    if (!hasAnyConnection) {
      setErrors({ global: '검색할 서비스가 없습니다. 왼쪽에서 서비스를 연결해주세요.' });
      setHasSearched(true);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setSubmittedQuery(q);
    setErrors({});
    setResults([]);
    setResultSource('all');
    setPreviewResult(null);
    setCounts({ jira: 0, confluence: 0, jsm: 0, drive: 0, mattermost: 0 });

    try {
      const jiraSources = filters.sources.filter((s) => s === 'jira' || s === 'confluence');
      const driveSources = filters.sources.filter((s) => s === 'drive');
      const mmSources = filters.sources.filter((s) => s === 'mattermost');
      const activeSources = [
        ...(atlassianConnected ? jiraSources : []),
        ...(google.connected ? driveSources : []),
        ...(mattermostConnected ? mmSources : []),
      ];

      if (activeSources.length === 0) {
        setErrors({ global: '검색할 서비스를 선택해주세요.' });
        setIsLoading(false);
        return;
      }

      const requestSearch = async (sources: SearchSource[], headers: Record<string, string>): Promise<SearchResponse> => {
        const response = await fetch(`/api/search?${new URLSearchParams({
          q,
          sources: sources.join(','),
          dateRange: filters.dateRange,
          exclude: excludedKeywords,
        })}`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? '검색 중 오류가 발생했습니다.');
        return data as SearchResponse;
      };

      const serverRequests: Array<{ label: string; request: Promise<SearchResponse> }> = [];
      if (jiraSources.length > 0) {
        for (const connection of atlassianAuth.getConnections('workspace')) {
          const legacyConnection = !connection.products?.length;
          const connectionSources = jiraSources.filter((source) =>
            legacyConnection || connection.products?.includes(source === 'confluence' ? 'confluence' : 'jira')
          );
          if (connectionSources.length === 0) continue;
          serverRequests.push({ label: connection.label, request: requestSearch(connectionSources, {
            'x-atlassian-oauth-token': connection.accessToken,
            'x-atlassian-cloud-id': connection.resource.id,
            'x-atlassian-site-url': connection.resource.url,
          }) });
        }
      }
      const googleToken = google.getToken();
      if (driveSources.length > 0 && googleToken) {
        serverRequests.push({ label: 'Google Drive', request: requestSearch(['drive'], { 'x-google-token': googleToken }) });
      }

      const mattermostToken = mattermost.getToken();
      if (activeSources.includes('mattermost') && mattermostToken) {
        serverRequests.push({
          label: 'Mattermost',
          request: requestSearch(['mattermost'], { 'x-mattermost-token': mattermostToken }),
        });
      }

      const serverSettled = await Promise.allSettled(serverRequests.map((entry) => entry.request));
      const serverResults = serverSettled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      const combinedResults = serverResults.flatMap((data) => data.results);
      const combinedErrors: Record<string, string> = Object.assign({}, ...serverResults.map((data) => data.errors));
      serverSettled.forEach((result, index) => {
        if (result.status === 'rejected') {
          combinedErrors[`connection-${index}`] = `${serverRequests[index].label}: ${result.reason instanceof Error ? result.reason.message : '검색 실패'}`;
        }
      });
      setResults(combinedResults);
      setCounts({
        jira: serverResults.reduce((sum, data) => sum + data.counts.jira, 0),
        confluence: serverResults.reduce((sum, data) => sum + data.counts.confluence, 0),
        jsm: serverResults.reduce((sum, data) => sum + data.counts.jsm, 0),
        drive: serverResults.reduce((sum, data) => sum + data.counts.drive, 0),
        mattermost: serverResults.reduce((sum, data) => sum + data.counts.mattermost, 0),
      });
      setErrors(combinedErrors);
    } catch (error) {
      setErrors({ global: error instanceof Error ? error.message : '서비스 연결에 실패했습니다.' });
    } finally {
      setIsLoading(false);
    }
  }, [query, excludedKeywords, filters, google, atlassianAuth, mattermost]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const totalCount = counts.jira + counts.confluence + counts.drive + counts.mattermost;
  const allResultSourceOptions: { value: 'all' | SearchSource; label: string; count: number }[] = [
    { value: 'all', label: '전체', count: totalCount },
    { value: 'jira', label: 'Jira', count: counts.jira },
    { value: 'confluence', label: 'Confluence', count: counts.confluence },
    { value: 'drive', label: 'Drive', count: counts.drive },
    { value: 'mattermost', label: 'Mattermost', count: counts.mattermost },
  ];
  const resultSourceOptions = allResultSourceOptions.filter(
    (option) => option.value === 'all' || option.count > 0
  );
  const visibleResults = resultSource === 'all'
    ? results
    : results.filter((result) => result.source === resultSource);

  const atlassianConnected = atlassianAuth.getConnections('workspace').length > 0;
  const mattermostConnected = mattermost.connected;
  const hasAnyConnection = atlassianConnected || google.connected || mattermostConnected;
  const filterOptions: { value: SearchSource; label: string; available: boolean }[] = [
    { value: 'jira', label: 'Jira', available: atlassianConnected },
    { value: 'confluence', label: 'Confluence', available: atlassianConnected },
    { value: 'drive', label: 'Google Drive', available: google.connected },
    { value: 'mattermost', label: 'Mattermost', available: mattermostConnected },
  ];
  const dateOptions: { value: DateRange; label: string }[] = [
    { value: 'all', label: '전체 기간' },
    { value: '1w', label: '최근 1주일' },
    { value: '1m', label: '최근 1개월' },
    { value: '3m', label: '최근 3개월' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="h-14 flex-shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
            <IconSearch size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-800">사내 통합검색</span>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProfile((current) => !current)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-xs font-semibold text-white hover:bg-gray-700"
            aria-label="사용자 프로필"
          >
            {(google.email || 'U').slice(0, 1).toUpperCase()}
          </button>
          {showProfile && (
            <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
              <p className="text-sm font-semibold text-gray-800">내 프로필</p>
              <p className="mt-0.5 truncate text-xs text-gray-500">{google.email || '이 브라우저의 사용자'}</p>
              <div className="my-3 border-t border-gray-100" />
              <p className="mb-2 text-xs font-medium text-gray-500">연결된 서비스</p>
              <div className="space-y-1 text-xs text-gray-600">
                <p>문서·개발 Atlassian {atlassianAuth.getConnections('workspace').length}개</p>
                <p>Google Drive {google.connected ? '연결됨' : '미연결'}</p>
                <p>Mattermost {mattermost.connected ? '연결됨' : '미연결'}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  atlassianAuth.disconnect();
                  google.disconnect();
                  mattermost.disconnect();
                  setShowProfile(false);
                }}
                className="mt-3 w-full rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                이 브라우저의 연결 정보 전체 삭제
              </button>
              <p className="mt-2 text-[11px] leading-relaxed text-gray-400">연결 정보는 현재 브라우저에만 저장됩니다.</p>
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          atlassianConnected={atlassianConnected}
          workspaceConnections={atlassianAuth.getConnections('workspace')}
          googleConnected={google.connected}
          mattermostConnected={mattermostConnected}
          onServiceClick={setActiveDrawer}
        />

        {/* Main */}
        <main className="flex-1 overflow-y-auto bg-[#F4F5F7]">
          <div className="max-w-3xl mx-auto px-6 py-6">
            {/* Search and filters */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <IconSearch size={15} />
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="검색어를 입력하세요"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-4 text-sm placeholder-slate-400 transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isLoading || !query.trim()}
                  className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading && <IconSpinner />}
                  검색
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <span className="mr-1 text-[11px] font-semibold text-slate-400">검색 범위</span>
                {filterOptions.map(({ value, label, available }) => (
                  <label
                    key={value}
                    className={`cursor-pointer ${available ? '' : 'pointer-events-none opacity-35'}`}
                  >
                    <input
                      type="checkbox"
                      checked={filters.sources.includes(value)}
                      onChange={() => available && toggleSource(value)}
                      disabled={!available}
                      className="peer sr-only"
                    />
                    <span className="flex h-7 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-medium text-slate-500 transition-all hover:border-slate-300 peer-checked:border-blue-200 peer-checked:bg-blue-50 peer-checked:text-blue-700 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500">
                      {filters.sources.includes(value) && <IconCheck />}
                      {label}
                    </span>
                  </label>
                ))}
                <span className="mx-1 h-4 w-px bg-slate-200" />
                <select
                  value={filters.dateRange}
                  onChange={(event) => setFilters({ ...filters, dateRange: event.target.value as DateRange })}
                  aria-label="검색 기간"
                  className="h-7 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-600 outline-none transition-colors hover:border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {dateOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="mt-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3">
                <span className="text-slate-400"><IconMinusCircle /></span>
                <input
                  type="text"
                  value={excludedKeywords}
                  onChange={(event) => setExcludedKeywords(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="제외 키워드 입력 (쉼표로 구분)"
                  aria-label="제외 키워드"
                  className="h-9 flex-1 bg-transparent text-xs text-slate-600 outline-none placeholder:text-slate-400"
                />
                {excludedKeywords && (
                  <button
                    type="button"
                    onClick={() => setExcludedKeywords('')}
                    className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
                  >
                    지우기
                  </button>
                )}
              </div>
            </div>

            {/* Loading skeleton */}
            {isLoading && (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
                    <div className="h-5 w-14 bg-gray-100 rounded mb-2.5" />
                    <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-full mb-1" />
                    <div className="h-3 bg-gray-100 rounded w-4/5" />
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            {!isLoading && hasSearched && (
              <>
                <div className="mb-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">&apos;{submittedQuery}&apos;</span>{' '}
                    검색 결과{' '}
                    <span className="font-semibold text-blue-600">{totalCount}건</span>
                  </p>
                  {totalCount > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="결과 서비스 필터">
                      {resultSourceOptions.map((option) => {
                        const active = resultSource === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setResultSource(option.value)}
                            aria-pressed={active}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                              active
                                ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700'
                            }`}
                          >
                            {option.label} <span className={active ? 'text-slate-300' : 'text-slate-400'}>{option.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {Object.keys(errors).length > 0 && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                    {errors.global && <p className="text-xs text-amber-700">{errors.global}</p>}
                    {errors.jira && <p className="text-xs text-amber-700">Jira: {errors.jira}</p>}
                    {errors.confluence && <p className="text-xs text-amber-700">Confluence: {errors.confluence}</p>}
                    {errors.drive && <p className="text-xs text-amber-700">Google Drive: {errors.drive}</p>}
                    {errors.mattermost && <p className="text-xs text-amber-700">Mattermost: {errors.mattermost}</p>}
                    {Object.entries(errors)
                      .filter(([key]) => key.startsWith('connection-'))
                      .map(([key, message]) => <p key={key} className="text-xs text-amber-700">{message}</p>)}
                  </div>
                )}

                {visibleResults.length > 0 ? (
                  <div className="space-y-2">
                    {visibleResults.map((result) => (
                      <ResultCard
                        key={`${result.source}-${result.id}`}
                        result={result}
                        query={submittedQuery}
                        onPreview={setPreviewResult}
                      />
                    ))}
                  </div>
                ) : (
                  Object.keys(errors).length === 0 && (
                    <div className="text-center py-16">
                      <p className="text-sm font-medium text-gray-500">검색 결과가 없습니다.</p>
                      <p className="text-xs text-gray-400 mt-1">다른 검색어로 다시 시도해보세요.</p>
                    </div>
                  )
                )}
              </>
            )}

            {/* Initial state */}
            {!hasSearched && !isLoading && (
              <div className="text-center py-20">
                {hasAnyConnection ? (
                  <p className="text-sm text-gray-400">
                    검색어를 입력하고 Enter를 누르세요.
                  </p>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      연결된 서비스가 없습니다.
                    </p>
                    <p className="text-xs text-gray-400">
                      왼쪽 패널에서 Jira 또는 Google 계정을 연결해주세요.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Connection Drawer */}
      <Drawer
        open={activeDrawer !== null}
        type={activeDrawer}
        atlassianAuth={atlassianAuth}
        google={google}
        mattermost={mattermost}
        onClose={() => setActiveDrawer(null)}
      />
      {previewResult && (
        <ResultPreview
          result={previewResult}
          query={submittedQuery}
          onClose={() => setPreviewResult(null)}
        />
      )}
    </div>
  );
}
