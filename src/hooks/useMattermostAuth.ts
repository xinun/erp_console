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

  const connect = useCallback(() => {
    if (!hasClientId) {
      alert(
        'Mattermost OAuth Client ID 또는 URL이 설정되지 않았습니다.\\n관리자에게 문의하여 환경변수를 설정해주세요.'
      );
      return;
    }
    setLoading(true);
    window.addEventListener('message', handleMessage);

    const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/mattermost/callback`);
    const cleanUrl = baseUrl.replace(/\\/$/, '');
    const authUrl = `${cleanUrl}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${Date.now()}`;

    const width = 500;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(authUrl, 'MattermostAuth', `width=${width},height=${height},top=${top},left=${left}`);

    // Clean up if window gets closed without messaging back
    setTimeout(() => {
      // Not a perfect check, but helps reset loading state
      setLoading(false);
    }, 60000);

  }, [clientId, baseUrl, hasClientId, handleMessage]);

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
    disconnect,
    getToken,
    baseUrl,
  };
}
