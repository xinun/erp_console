import { useState, useEffect, useCallback } from 'react';

const MATTERMOST_TOKEN_KEY = 'mantech_mattermost_oauth_token';
const MATTERMOST_EXPIRY_KEY = 'mantech_mattermost_oauth_expiry';

export function useMattermostAuth() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL;
  const clientId = process.env.NEXT_PUBLIC_MATTERMOST_CLIENT_ID;
  const hasClientId = !!clientId && !!baseUrl;

  useEffect(() => {
    const token = localStorage.getItem(MATTERMOST_TOKEN_KEY);
    const expiry = localStorage.getItem(MATTERMOST_EXPIRY_KEY);

    if (token && expiry && Number(expiry) > Date.now()) {
      setConnected(true);
    } else {
      setConnected(false);
      localStorage.removeItem(MATTERMOST_TOKEN_KEY);
      localStorage.removeItem(MATTERMOST_EXPIRY_KEY);
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;

    const data = event.data;
    if (data?.type === 'MATTERMOST_AUTH_SUCCESS') {
      const { access_token, expires_at } = data.payload;
      
      localStorage.setItem(MATTERMOST_TOKEN_KEY, access_token);
      localStorage.setItem(MATTERMOST_EXPIRY_KEY, expires_at.toString());
      
      setConnected(true);
      setLoading(false);
      window.removeEventListener('message', handleMessage);
    } else if (data?.type === 'MATTERMOST_AUTH_ERROR') {
      alert(`Mattermost 연결 오류: ${data.error}`);
      setLoading(false);
      window.removeEventListener('message', handleMessage);
    }
  }, []);

  // OAuth 2.0 팝업 로그인
  const connect = useCallback(() => {
    if (!hasClientId) return;
    setLoading(true);
    window.addEventListener('message', handleMessage);

    const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/mattermost/callback`);
    const cleanUrl = (baseUrl as string).replace(/\/$/, '');
    const authUrl = `${cleanUrl}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${Date.now()}`;

    const width = 500;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(authUrl, 'MattermostAuth', `width=${width},height=${height},top=${top},left=${left}`);

    // 60초 후 로딩 상태 초기화 (팝업 닫힘 감지 불가 시 대비)
    setTimeout(() => setLoading(false), 60000);
  }, [clientId, baseUrl, hasClientId, handleMessage]);

  // 이메일/비밀번호 직접 로그인
  const loginWithCredentials = useCallback(async (
    serverUrl: string,
    loginId: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanUrl = serverUrl.replace(/\/$/, '');
      const res = await fetch(`${cleanUrl}/api/v4/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_id: loginId, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.message || `로그인 실패 (${res.status})` };
      }

      const token = res.headers.get('Token');
      if (!token) {
        return { success: false, error: '토큰을 받지 못했습니다.' };
      }

      // 수동 로그인 토큰은 만료 기간을 30일로 설정 (Mattermost 기본값과 동일)
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      localStorage.setItem(MATTERMOST_TOKEN_KEY, token);
      localStorage.setItem(MATTERMOST_EXPIRY_KEY, expiresAt.toString());
      setConnected(true);
      return { success: true };
    } catch {
      return { success: false, error: '서버에 연결할 수 없습니다.' };
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(MATTERMOST_TOKEN_KEY);
    localStorage.removeItem(MATTERMOST_EXPIRY_KEY);
    setConnected(false);
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
    hasClientId,
    connect,
    loginWithCredentials,
    disconnect,
    getToken,
    baseUrl,
  };
}
