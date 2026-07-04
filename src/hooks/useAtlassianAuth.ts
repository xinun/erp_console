'use client';

import { useState, useEffect, useCallback } from 'react';

const ATLASSIAN_TOKEN_KEY = 'atlassian_access_token';
const ATLASSIAN_EXPIRY_KEY = 'atlassian_token_expiry';
const ATLASSIAN_RESOURCES_KEY = 'atlassian_resources';

export interface AtlassianResource {
  id: string;
  url: string;
  name: string;
  avatarUrl: string;
}

export interface AtlassianAuthState {
  connected: boolean;
  loading: boolean;
  resources: AtlassianResource[];
  hasClientId: boolean;
  connect: () => void;
  disconnect: () => void;
  getToken: () => string | null;
  getPrimaryResource: () => AtlassianResource | null;
}

export function useAtlassianAuth(): AtlassianAuthState {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState<AtlassianResource[]>([]);
  const clientId = process.env.NEXT_PUBLIC_ATLASSIAN_CLIENT_ID ?? '';

  useEffect(() => {
    const token = localStorage.getItem(ATLASSIAN_TOKEN_KEY);
    const expiry = localStorage.getItem(ATLASSIAN_EXPIRY_KEY);
    const storedRes = localStorage.getItem(ATLASSIAN_RESOURCES_KEY);
    if (token && expiry && Number(expiry) > Date.now()) {
      setConnected(true);
      if (storedRes) {
        try {
          setResources(JSON.parse(storedRes));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data;

    if (data?.type === 'ATLASSIAN_AUTH_SUCCESS') {
      const { access_token, expires_at, resources: resList } = data.payload;
      localStorage.setItem(ATLASSIAN_TOKEN_KEY, access_token);
      localStorage.setItem(ATLASSIAN_EXPIRY_KEY, String(expires_at));
      localStorage.setItem(ATLASSIAN_RESOURCES_KEY, JSON.stringify(resList));
      setResources(resList);
      setConnected(true);
      setLoading(false);
      window.removeEventListener('message', handleMessage);
    } else if (data?.type === 'ATLASSIAN_AUTH_ERROR') {
      alert(`Atlassian 연결 오류: ${data.error}`);
      setLoading(false);
      window.removeEventListener('message', handleMessage);
    }
  }, []);

  const connect = useCallback(() => {
    if (!clientId) {
      alert(
        'Atlassian OAuth Client ID가 설정되지 않았습니다.\n관리자에게 문의하여 환경변수를 설정해주세요.'
      );
      return;
    }
    setLoading(true);
    window.addEventListener('message', handleMessage);

    const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/atlassian/callback`);
    const scopes = encodeURIComponent('read:jira-work read:confluence-content.all search:confluence read:me offline_access');
    const authUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${Date.now()}&response_type=code&prompt=consent`;

    const width = 500;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(authUrl, 'AtlassianAuth', `width=${width},height=${height},top=${top},left=${left}`);

    // If popup is closed by user without finishing
    const checkClosed = setInterval(() => {
      // It's hard to reliably detect popup close cross-origin, so we rely on the message.
      // Alternatively, could track the window reference.
    }, 1000);

  }, [clientId, handleMessage]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(ATLASSIAN_TOKEN_KEY);
    localStorage.removeItem(ATLASSIAN_EXPIRY_KEY);
    localStorage.removeItem(ATLASSIAN_RESOURCES_KEY);
    setConnected(false);
    setResources([]);
  }, []);

  const getToken = useCallback((): string | null => {
    const token = localStorage.getItem(ATLASSIAN_TOKEN_KEY);
    const expiry = localStorage.getItem(ATLASSIAN_EXPIRY_KEY);
    if (!token || !expiry || Number(expiry) <= Date.now()) {
      if (connected) disconnect();
      return null;
    }
    return token;
  }, [connected, disconnect]);

  const getPrimaryResource = useCallback((): AtlassianResource | null => {
    if (!connected || resources.length === 0) return null;
    // For simplicity, return the first available resource. 
    // In a multi-tenant setup, you'd let the user pick.
    return resources[0];
  }, [connected, resources]);

  return { connected, loading, resources, hasClientId: !!clientId, connect, disconnect, getToken, getPrimaryResource };
}
