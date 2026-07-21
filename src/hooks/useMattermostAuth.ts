'use client';

import { useCallback, useEffect, useState } from 'react';

const MATTERMOST_TOKEN_KEY = 'mantech_mattermost_oauth_token';
const MATTERMOST_EXPIRY_KEY = 'mantech_mattermost_oauth_expiry';
const MATTERMOST_OAUTH_STATE_KEY = 'mantech_mattermost_oauth_state';
const MATTERMOST_PKCE_VERIFIER_KEY = 'mantech_mattermost_pkce_verifier';
const MATTERMOST_CONNECTION_KEY = 'mantech_mattermost_connection';

export interface MattermostConnection {
  baseUrl: string;
  clientId: string;
}

function normalizeMattermostUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function useMattermostAuth() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<MattermostConnection | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(MATTERMOST_TOKEN_KEY);
    const expiry = localStorage.getItem(MATTERMOST_EXPIRY_KEY);
    const storedConnection = localStorage.getItem(MATTERMOST_CONNECTION_KEY);
    const isValid = !!token && !!expiry && Number(expiry) > Date.now();

    let parsedConnection: MattermostConnection | null = null;
    if (storedConnection) {
      try {
        parsedConnection = JSON.parse(storedConnection) as MattermostConnection;
      } catch {
        localStorage.removeItem(MATTERMOST_CONNECTION_KEY);
      }
    }

    if (!isValid) {
      localStorage.removeItem(MATTERMOST_TOKEN_KEY);
      localStorage.removeItem(MATTERMOST_EXPIRY_KEY);
    }

    const timeoutId = window.setTimeout(() => {
      setConnection(parsedConnection);
      setConnected(isValid && !!parsedConnection);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;

    const data = event.data;
    if (data?.type === 'MATTERMOST_AUTH_CODE') {
      const { code, state } = data.payload;
      const expectedState = sessionStorage.getItem(MATTERMOST_OAUTH_STATE_KEY);
      const verifier = sessionStorage.getItem(MATTERMOST_PKCE_VERIFIER_KEY);
      const storedConnection = localStorage.getItem(MATTERMOST_CONNECTION_KEY);

      if (!expectedState || state !== expectedState || !verifier || !storedConnection) {
        sessionStorage.removeItem(MATTERMOST_OAUTH_STATE_KEY);
        sessionStorage.removeItem(MATTERMOST_PKCE_VERIFIER_KEY);
        setLoading(false);
        alert('Mattermost 연결 오류: 인증 정보를 확인할 수 없습니다. 다시 시도해주세요.');
        return;
      }

      sessionStorage.removeItem(MATTERMOST_OAUTH_STATE_KEY);
      sessionStorage.removeItem(MATTERMOST_PKCE_VERIFIER_KEY);

      const currentConnection = JSON.parse(storedConnection) as MattermostConnection;
      const redirectUri = `${window.location.origin}/api/auth/mattermost/callback`;
      void fetch(`${currentConnection.baseUrl}/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: currentConnection.clientId,
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
        }),
      }).then(async (response) => {
        const tokenData = await response.json();
        if (!response.ok || !tokenData.access_token) {
          throw new Error(tokenData.error_description ?? tokenData.error ?? '토큰을 발급받지 못했습니다.');
        }
        const expiresIn = Number(tokenData.expires_in);
        const expiresAt = Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0
          ? expiresIn * 1000
          : 30 * 24 * 60 * 60 * 1000);
        localStorage.setItem(MATTERMOST_TOKEN_KEY, tokenData.access_token);
        localStorage.setItem(MATTERMOST_EXPIRY_KEY, String(expiresAt));
        setConnected(true);
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Mattermost 토큰 요청에 실패했습니다.';
        alert(`Mattermost 연결 오류: ${message}\n회사 관리자에게 CORS 설정을 확인해주세요.`);
      }).finally(() => setLoading(false));
    } else if (data?.type === 'MATTERMOST_AUTH_ERROR') {
      setLoading(false);
      alert(`Mattermost 연결 오류: ${data.error}`);
    }
  }, []);

  useEffect(() => {
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const connect = useCallback(async (serverUrl: string, clientId: string): Promise<string | null> => {
    const baseUrl = normalizeMattermostUrl(serverUrl);
    const normalizedClientId = clientId.trim();
    if (!baseUrl) return 'HTTPS 형식의 올바른 Mattermost 서버 주소를 입력해주세요.';
    if (!normalizedClientId) return 'Mattermost OAuth Client ID를 입력해주세요.';

    const nextConnection = { baseUrl, clientId: normalizedClientId };
    localStorage.setItem(MATTERMOST_CONNECTION_KEY, JSON.stringify(nextConnection));
    setConnection(nextConnection);
    setLoading(true);
    window.addEventListener('message', handleMessage);

    const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/mattermost/callback`);
    const state = crypto.randomUUID();
    const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
    const verifier = btoa(String.fromCharCode(...verifierBytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const challengeBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(challengeBytes)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    sessionStorage.setItem(MATTERMOST_OAUTH_STATE_KEY, state);
    sessionStorage.setItem(MATTERMOST_PKCE_VERIFIER_KEY, verifier);
    const authUrl = `${baseUrl}/oauth/authorize?response_type=code&client_id=${encodeURIComponent(normalizedClientId)}&redirect_uri=${redirectUri}&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`;
    const popup = window.open(
      authUrl,
      'MattermostAuth',
      `width=500,height=700,top=${window.screen.height / 2 - 350},left=${window.screen.width / 2 - 250}`
    );

    if (!popup) {
      setLoading(false);
      return '팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도해주세요.';
    }

    window.setTimeout(() => setLoading(false), 60000);
    return null;
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(MATTERMOST_TOKEN_KEY);
    localStorage.removeItem(MATTERMOST_EXPIRY_KEY);
    localStorage.removeItem(MATTERMOST_CONNECTION_KEY);
    sessionStorage.removeItem(MATTERMOST_OAUTH_STATE_KEY);
    sessionStorage.removeItem(MATTERMOST_PKCE_VERIFIER_KEY);
    setConnected(false);
    setConnection(null);
  }, []);

  const getToken = useCallback(() => {
    const token = localStorage.getItem(MATTERMOST_TOKEN_KEY);
    const expiry = localStorage.getItem(MATTERMOST_EXPIRY_KEY);
    if (!token || !expiry || Number(expiry) <= Date.now()) {
      if (connected) disconnect();
      return null;
    }
    return token;
  }, [connected, disconnect]);

  return {
    connected,
    loading,
    connection,
    connect,
    disconnect,
    getToken,
    baseUrl: connection?.baseUrl,
  };
}
