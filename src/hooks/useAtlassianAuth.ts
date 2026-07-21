'use client';

import { useCallback, useEffect, useState } from 'react';

const CONNECTIONS_KEY = 'mantech_atlassian_connections';
const PENDING_KEY = 'mantech_atlassian_pending_connection';
const STATE_KEY = 'mantech_atlassian_oauth_state';

export type AtlassianConnectionKind = 'workspace' | 'jsm';

export interface AtlassianResource {
  id: string;
  url: string;
  name: string;
  avatarUrl: string;
}

export interface AtlassianConnection {
  id: string;
  label: string;
  kind: AtlassianConnectionKind;
  projectKey?: string;
  resource: AtlassianResource;
  accessToken: string;
  expiresAt: number;
}

export interface NewAtlassianConnection {
  label: string;
  kind: AtlassianConnectionKind;
  siteUrl: string;
  projectKey?: string;
}

function readConnections(): AtlassianConnection[] {
  try {
    const stored = localStorage.getItem(CONNECTIONS_KEY);
    if (!stored) return [];
    return (JSON.parse(stored) as AtlassianConnection[]).filter(
      (connection) => connection.expiresAt > Date.now()
    );
  } catch {
    return [];
  }
}

export function useAtlassianAuth() {
  const [connections, setConnections] = useState<AtlassianConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_ATLASSIAN_CLIENT_ID ?? '';

  const saveConnections = useCallback((next: AtlassianConnection[]) => {
    localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(next));
    setConnections(next);
  }, []);

  useEffect(() => {
    const stored = readConnections();
    localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(stored));
    const timeoutId = window.setTimeout(() => setConnections(stored), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data;

    if (data?.type === 'ATLASSIAN_AUTH_SUCCESS') {
      const expectedState = sessionStorage.getItem(STATE_KEY);
      const pendingRaw = sessionStorage.getItem(PENDING_KEY);
      const { access_token, expires_at, resources, state } = data.payload;
      if (!expectedState || state !== expectedState || !pendingRaw) {
        setLoading(false);
        alert('Atlassian 연결 오류: 인증 상태를 확인할 수 없습니다.');
        return;
      }

      const pending = JSON.parse(pendingRaw) as NewAtlassianConnection;
      const expectedHost = new URL(pending.siteUrl).hostname;
      const resource = (resources as AtlassianResource[]).find(
        (item) => new URL(item.url).hostname === expectedHost
      );

      sessionStorage.removeItem(STATE_KEY);
      sessionStorage.removeItem(PENDING_KEY);
      if (!resource) {
        setLoading(false);
        alert(`로그인한 계정에서 ${expectedHost} 사이트를 찾지 못했습니다. 올바른 Atlassian 계정으로 다시 로그인해주세요.`);
        return;
      }

      const nextConnection: AtlassianConnection = {
        id: crypto.randomUUID(),
        label: pending.label,
        kind: pending.kind,
        projectKey: pending.projectKey?.trim().toUpperCase(),
        resource,
        accessToken: access_token,
        expiresAt: expires_at,
      };
      const next = [...readConnections(), nextConnection];
      localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(next));
      setConnections(next);
      setLoading(false);
    } else if (data?.type === 'ATLASSIAN_AUTH_ERROR') {
      setLoading(false);
      alert(`Atlassian 연결 오류: ${data.error}`);
    }
  }, []);

  useEffect(() => {
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const connect = useCallback((options: NewAtlassianConnection): string | null => {
    if (!clientId) return 'Atlassian OAuth Client ID가 설정되지 않았습니다.';
    if (!options.label.trim()) return '연결 이름을 입력해주세요.';
    try {
      const siteUrl = new URL(options.siteUrl.trim());
      if (siteUrl.protocol !== 'https:') return 'Atlassian 사이트는 HTTPS 주소여야 합니다.';
    } catch {
      return '올바른 Atlassian 사이트 주소를 입력해주세요.';
    }
    if (options.kind === 'jsm' && !options.projectKey?.trim()) return 'JSM 프로젝트 키를 입력해주세요.';

    setLoading(true);
    window.addEventListener('message', handleMessage);
    const state = crypto.randomUUID();
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(options));
    const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/atlassian/callback`);
    const scopes = encodeURIComponent('read:jira-work read:confluence-content.all search:confluence read:servicedesk-request read:me offline_access');
    const authUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${encodeURIComponent(state)}&response_type=code&prompt=consent`;
    const popup = window.open(authUrl, 'AtlassianAuth', 'width=500,height=700');
    if (!popup) {
      setLoading(false);
      return '팝업이 차단되었습니다.';
    }
    return null;
  }, [clientId, handleMessage]);

  const disconnect = useCallback((id?: string) => {
    const next = id ? readConnections().filter((connection) => connection.id !== id) : [];
    saveConnections(next);
  }, [saveConnections]);

  const getConnections = useCallback((kind?: AtlassianConnectionKind) => {
    const valid = connections.filter((connection) => connection.expiresAt > Date.now());
    return kind ? valid.filter((connection) => connection.kind === kind) : valid;
  }, [connections]);

  return {
    connected: connections.length > 0,
    loading,
    connections,
    hasClientId: !!clientId,
    connect,
    disconnect,
    getConnections,
  };
}
