'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const GOOGLE_TOKEN_KEY = 'google_access_token';
const GOOGLE_EXPIRY_KEY = 'google_token_expiry';
const GOOGLE_EMAIL_KEY = 'google_email';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: object) => TokenClient;
        };
      };
    };
  }
}

export interface GoogleAuthState {
  connected: boolean;
  email: string;
  loading: boolean;
  hasClientId: boolean;
  connect: () => void;
  disconnect: () => void;
  getToken: () => string | null;
}

export function useGoogleAuth(): GoogleAuthState {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const tokenClientRef = useRef<TokenClient | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

  // 기존 토큰 확인
  useEffect(() => {
    const token = localStorage.getItem(GOOGLE_TOKEN_KEY);
    const expiry = localStorage.getItem(GOOGLE_EXPIRY_KEY);
    const savedEmail = localStorage.getItem(GOOGLE_EMAIL_KEY);
    if (token && expiry && Number(expiry) > Date.now()) {
      setConnected(true);
      setEmail(savedEmail ?? '');
    }
  }, []);

  const initTokenClient = useCallback(() => {
    if (!clientId || !window.google?.accounts?.oauth2) return;
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ].join(' '),
      callback: async (response: TokenResponse) => {
        if (response.access_token) {
          const expiry = Date.now() + (response.expires_in ?? 3600) * 1000;
          localStorage.setItem(GOOGLE_TOKEN_KEY, response.access_token);
          localStorage.setItem(GOOGLE_EXPIRY_KEY, String(expiry));
          try {
            const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` },
            }).then((r) => r.json());
            const userEmail = userInfo.email ?? '';
            localStorage.setItem(GOOGLE_EMAIL_KEY, userEmail);
            setEmail(userEmail);
          } catch {
            // 무시
          }
          setConnected(true);
        }
        setLoading(false);
      },
    });
  }, [clientId]);

  // GIS 스크립트 동적 로드
  useEffect(() => {
    if (!clientId || typeof window === 'undefined') return;

    if (window.google?.accounts?.oauth2) {
      initTokenClient();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existingScript) {
      existingScript.addEventListener('load', initTokenClient);
      return () => existingScript.removeEventListener('load', initTokenClient);
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = initTokenClient;
    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [clientId, initTokenClient]);

  const connect = useCallback(() => {
    if (!clientId) {
      alert(
        'Google OAuth Client ID가 설정되지 않았습니다.\n관리자에게 문의하여 환경변수 NEXT_PUBLIC_GOOGLE_CLIENT_ID를 설정해주세요.'
      );
      return;
    }
    if (!tokenClientRef.current) {
      alert('Google 라이브러리를 로딩 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    setLoading(true);
    tokenClientRef.current.requestAccessToken({ prompt: '' });
  }, [clientId]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(GOOGLE_TOKEN_KEY);
    localStorage.removeItem(GOOGLE_EXPIRY_KEY);
    localStorage.removeItem(GOOGLE_EMAIL_KEY);
    setConnected(false);
    setEmail('');
  }, []);

  const getToken = useCallback((): string | null => {
    const token = localStorage.getItem(GOOGLE_TOKEN_KEY);
    const expiry = localStorage.getItem(GOOGLE_EXPIRY_KEY);
    if (!token || !expiry || Number(expiry) <= Date.now()) {
      if (connected) disconnect();
      return null;
    }
    return token;
  }, [connected, disconnect]);

  return { connected, email, loading, hasClientId: !!clientId, connect, disconnect, getToken };
}
