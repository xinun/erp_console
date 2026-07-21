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
import { useAtlassianAuth } from '@/hooks/useAtlassianAuth';
import { useMattermostAuth } from '@/hooks/useMattermostAuth';
import { searchMattermostFromBrowser } from '@/lib/mattermost';

// ─── Types ────────────────────────────────────────────────────────────────────

type DrawerType = 'atlassian' | 'google' | 'jsm' | 'mattermost' | null;

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

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full leading-none">
        연결됨
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-gray-400 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full leading-none">
      미연결
    </span>
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

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: SearchResult }) {
  const meta: string[] = [];
  if (result.source === 'jira' || result.source === 'jsm') {
    if (result.key) meta.push(result.key);
    if (result.issueType) meta.push(result.issueType);
    if (result.status) meta.push(result.status);
    if (result.project) meta.push(result.project);
  } else if (result.source === 'confluence') {
    if (result.space) meta.push(result.space);
  } else if (result.source === 'mattermost') {
    if (result.team) meta.push(result.team);
  }
  if (result.author) meta.push(result.author);
  if (result.date) meta.push(formatDate(result.date));

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="mb-1.5">
            <SourceBadge source={result.source} fileType={result.fileType} />
          </div>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm font-semibold text-gray-900 hover:text-blue-600 leading-snug mb-1.5"
          >
            {result.title}
          </a>
          {result.snippet && (
            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{result.snippet}</p>
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
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
        >
          열기 <IconExternalLink />
        </a>
      </div>
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
  const [label, setLabel] = useState(isJsm ? '고객사 문의' : 'Mantech 문서·개발');
  const [siteUrl, setSiteUrl] = useState(
    isJsm ? 'https://mantech-accordion.atlassian.net' : 'https://mantech.jira.com'
  );
  const [projectKey, setProjectKey] = useState(isJsm ? 'LYUX' : '');
  const [error, setError] = useState('');
  const connections = atlassianAuth.getConnections(kind);

  const handleConnect = () => {
    setError(atlassianAuth.connect({ label, kind, siteUrl, projectKey }) ?? '');
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
          </div>
          <button onClick={() => atlassianAuth.disconnect(connection.id)} className="text-xs text-gray-500 hover:text-red-600">삭제</button>
        </div>
      ))}
      <div className="space-y-3 border-t border-gray-100 pt-4">
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
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          onClick={handleConnect}
          disabled={atlassianAuth.loading}
          className="h-10 w-full rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {atlassianAuth.loading ? '연결 중...' : isJsm ? '고객 문의 계정 연결' : '문서·개발 계정 연결'}
        </button>
      </div>
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
  const [serverUrl, setServerUrl] = useState(connection?.baseUrl ?? '');
  const [clientId, setClientId] = useState(connection?.clientId ?? '');
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
  jsm: '고객사 JSM 연결',
  mattermost: 'Mattermost 연결',
};

const DRAWER_DESCS: Record<NonNullable<DrawerType>, string> = {
  atlassian: 'Jira 이슈, Confluence 페이지를 검색합니다.',
  google: 'Drive, Docs, Sheets, Slides 파일을 검색합니다.',
  jsm: '고객사 JSM의 문의 내역을 검색합니다.',
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
              {(type === 'atlassian' || type === 'jsm') && (
                <AtlassianDrawerContent
                  kind={type === 'jsm' ? 'jsm' : 'workspace'}
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
  jsmConnected: boolean;
  googleConnected: boolean;
  mattermostConnected: boolean;
  filters: SearchFilters;
  onFiltersChange: (f: SearchFilters) => void;
  onServiceClick: (drawer: DrawerType) => void;
}

function Sidebar({
  atlassianConnected,
  jsmConnected,
  googleConnected,
  mattermostConnected,
  filters,
  onFiltersChange,
  onServiceClick,
}: SidebarProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const groups: ServiceGroup[] = [
    {
      groupLabel: 'Atlassian',
      drawerType: 'atlassian',
      services: [
        { name: 'Jira', desc: '이슈 추적' },
        { name: 'Confluence', desc: '문서 관리' },
      ],
      connected: atlassianConnected,
    },
    {
      groupLabel: 'Customer Service',
      drawerType: 'jsm',
      services: [
        { name: '고객사 JSM', desc: '고객 문의 접수' },
      ],
      connected: jsmConnected,
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

  const toggleSource = (source: SearchSource) => {
    const next = filters.sources.includes(source)
      ? filters.sources.filter((s) => s !== source)
      : [...filters.sources, source];
    if (next.length === 0) return;
    onFiltersChange({ ...filters, sources: next });
  };

  const setDateRange = (dateRange: DateRange) => {
    onFiltersChange({ ...filters, dateRange });
  };

  const filterOptions: { value: SearchSource; label: string; available: boolean }[] = [
    { value: 'jira', label: 'Jira', available: atlassianConnected },
    { value: 'confluence', label: 'Confluence', available: atlassianConnected },
    { value: 'jsm', label: '고객 문의', available: jsmConnected },
    { value: 'drive', label: 'Google Drive', available: googleConnected },
    { value: 'mattermost', label: 'Mattermost', available: mattermostConnected },
  ];

  const dateOptions: { value: DateRange; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: '1w', label: '최근 1주일' },
    { value: '1m', label: '최근 1개월' },
    { value: '3m', label: '최근 3개월' },
  ];

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
      <div className="p-3 flex-1">
        {/* Service groups */}
        <div className="space-y-4 mb-5">
          {connectedGroups.map((group) => (
            <div key={group.groupLabel}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">
                {group.groupLabel}
              </p>
              <div className="space-y-px">
                {group.services.map((service) => (
                  <button
                    key={service.name}
                    onClick={() => onServiceClick(group.drawerType)}
                    className="w-full flex items-center justify-between px-2 py-2 rounded-md hover:bg-gray-50 transition-colors text-left group"
                  >
                    <div className="min-w-0">
                      <span className="text-sm text-gray-700 block">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <StatusBadge connected={group.connected} />
                      <span className="text-gray-300 group-hover:text-gray-400 transition-colors">
                        <IconChevronRight />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {connectedGroups.length === 0 && (
            <div className="px-2 py-6 text-center">
              <p className="text-xs text-gray-400">연결된 서비스가 없습니다.</p>
            </div>
          )}
        </div>

        <div className="relative mb-5">
          <button
            type="button"
            onClick={() => setShowAddMenu((current) => !current)}
            className="w-full flex items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            연결 추가
          </button>
          {showAddMenu && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
              {availableGroups.length > 0 ? availableGroups.map((group) => (
                <button
                  key={group.groupLabel}
                  type="button"
                  onClick={() => {
                    setShowAddMenu(false);
                    onServiceClick(group.drawerType);
                  }}
                  className="w-full px-3 py-2.5 text-left hover:bg-gray-50"
                >
                  <span className="block text-sm font-medium text-gray-700">{group.groupLabel}</span>
                  <span className="block text-xs text-gray-400">{group.services.map((service) => service.name).join(', ')}</span>
                </button>
              )) : (
                <p className="px-3 py-3 text-xs text-gray-400">모든 서비스를 연결했습니다.</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4 mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
            검색 범위
          </p>
          <div className="space-y-px">
            {filterOptions.map(({ value, label, available }) => (
              <label
                key={value}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors ${available ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-40 cursor-not-allowed'
                  }`}
              >
                <input
                  type="checkbox"
                  checked={filters.sources.includes(value)}
                  onChange={() => available && toggleSource(value)}
                  disabled={!available}
                  className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
            기간
          </p>
          <div className="space-y-px">
            {dateOptions.map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="radio"
                  name="dateRange"
                  checked={filters.dateRange === value}
                  onChange={() => setDateRange(value)}
                  className="w-3.5 h-3.5 border-gray-300 accent-blue-600"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
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
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [counts, setCounts] = useState({ jira: 0, confluence: 0, jsm: 0, drive: 0, mattermost: 0 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    sources: ['jira', 'confluence'],
    dateRange: 'all',
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    const atlassianConnected = atlassianAuth.getConnections('workspace').length > 0;
    const jsmConnected = atlassianAuth.getConnections('jsm').length > 0;
    const mattermostConnected = mattermost.connected;
    const hasAnyConnection = atlassianConnected || jsmConnected || google.connected || mattermostConnected;
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
    setCounts({ jira: 0, confluence: 0, jsm: 0, drive: 0, mattermost: 0 });

    try {
      const jiraSources = filters.sources.filter((s) => s === 'jira' || s === 'confluence');
      const jsmSources = filters.sources.filter((s) => s === 'jsm');
      const driveSources = filters.sources.filter((s) => s === 'drive');
      const mmSources = filters.sources.filter((s) => s === 'mattermost');
      const activeSources = [
        ...(atlassianConnected ? jiraSources : []),
        ...(jsmConnected ? jsmSources : []),
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
        })}`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? '검색 중 오류가 발생했습니다.');
        return data as SearchResponse;
      };

      const serverRequests: Promise<SearchResponse>[] = [];
      if (jiraSources.length > 0) {
        for (const connection of atlassianAuth.getConnections('workspace')) {
          serverRequests.push(requestSearch(jiraSources, {
            'x-atlassian-oauth-token': connection.accessToken,
            'x-atlassian-cloud-id': connection.resource.id,
            'x-atlassian-site-url': connection.resource.url,
          }));
        }
      }
      if (jsmSources.length > 0) {
        for (const connection of atlassianAuth.getConnections('jsm')) {
          serverRequests.push(requestSearch(['jsm'], {
            'x-atlassian-oauth-token': connection.accessToken,
            'x-atlassian-cloud-id': connection.resource.id,
            'x-atlassian-site-url': connection.resource.url,
            'x-jira-project-key': connection.projectKey ?? '',
          }));
        }
      }
      const googleToken = google.getToken();
      if (driveSources.length > 0 && googleToken) {
        serverRequests.push(requestSearch(['drive'], { 'x-google-token': googleToken }));
      }

      const mattermostToken = mattermost.getToken();
      const mattermostRequest = activeSources.includes('mattermost') && mattermostToken && mattermost.baseUrl
        ? searchMattermostFromBrowser(q, mattermost.baseUrl, mattermostToken)
        : Promise.resolve([]);

      const [serverResults, mattermostResults] = await Promise.all([
        Promise.all(serverRequests),
        mattermostRequest,
      ]);
      const combinedResults = serverResults.flatMap((data) => data.results);
      const combinedErrors = Object.assign({}, ...serverResults.map((data) => data.errors));
      setResults([...combinedResults, ...mattermostResults]);
      setCounts({
        jira: serverResults.reduce((sum, data) => sum + data.counts.jira, 0),
        confluence: serverResults.reduce((sum, data) => sum + data.counts.confluence, 0),
        jsm: serverResults.reduce((sum, data) => sum + data.counts.jsm, 0),
        drive: serverResults.reduce((sum, data) => sum + data.counts.drive, 0),
        mattermost: mattermostResults.length,
      });
      setErrors(combinedErrors);
    } catch (error) {
      setErrors({ global: error instanceof Error ? error.message : '서비스 연결에 실패했습니다.' });
    } finally {
      setIsLoading(false);
    }
  }, [query, filters, google, atlassianAuth, mattermost]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const totalCount = counts.jira + counts.confluence + counts.jsm + counts.drive + counts.mattermost;
  const countSummary = [
    counts.jira > 0 ? `Jira ${counts.jira}` : null,
    counts.confluence > 0 ? `Confluence ${counts.confluence}` : null,
    counts.jsm > 0 ? `고객 문의 ${counts.jsm}` : null,
    counts.drive > 0 ? `Drive ${counts.drive}` : null,
    (counts.mattermost || 0) > 0 ? `Mattermost ${counts.mattermost}` : null,
  ].filter(Boolean);

  const atlassianConnected = atlassianAuth.getConnections('workspace').length > 0;
  const jsmConnected = atlassianAuth.getConnections('jsm').length > 0;
  const mattermostConnected = mattermost.connected;
  const hasAnyConnection = atlassianConnected || jsmConnected || google.connected || mattermostConnected;

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
                <p>고객 문의 JSM {atlassianAuth.getConnections('jsm').length}개</p>
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
          jsmConnected={jsmConnected}
          googleConnected={google.connected}
          mattermostConnected={mattermostConnected}
          filters={filters}
          onFiltersChange={setFilters}
          onServiceClick={setActiveDrawer}
        />

        {/* Main */}
        <main className="flex-1 overflow-y-auto bg-[#F4F5F7]">
          <div className="max-w-3xl mx-auto px-6 py-6">
            {/* Search bar */}
            <div className="flex gap-2 mb-6">
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
                  className="w-full h-10 pl-9 pr-4 text-sm border border-gray-300 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={isLoading || !query.trim()}
                className="h-10 px-5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading && <IconSpinner />}
                검색
              </button>
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
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">&apos;{submittedQuery}&apos;</span>{' '}
                    검색 결과{' '}
                    <span className="font-semibold text-blue-600">{totalCount}건</span>
                  </p>
                  {countSummary.length > 0 && (
                    <p className="text-xs text-gray-400">{countSummary.join(' · ')}</p>
                  )}
                </div>

                {Object.keys(errors).length > 0 && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                    {errors.global && <p className="text-xs text-amber-700">{errors.global}</p>}
                    {errors.jira && <p className="text-xs text-amber-700">Jira: {errors.jira}</p>}
                    {errors.confluence && <p className="text-xs text-amber-700">Confluence: {errors.confluence}</p>}
                    {errors.jsm && <p className="text-xs text-amber-700">고객 문의: {errors.jsm}</p>}
                    {errors.drive && <p className="text-xs text-amber-700">Google Drive: {errors.drive}</p>}
                  </div>
                )}

                {results.length > 0 ? (
                  <div className="space-y-2">
                    {results.map((result) => (
                      <ResultCard key={`${result.source}-${result.id}`} result={result} />
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
    </div>
  );
}
