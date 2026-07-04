'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { SearchConfig } from '@/lib/types';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';

const CONFIG_KEY = 'mantech_search_config';

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusBadge({ type }: { type: 'connected' | 'disconnected' | 'unconfigured' }) {
  if (type === 'connected') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
        <CheckIcon />
        연결됨
      </span>
    );
  }
  if (type === 'disconnected') {
    return (
      <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
        미연결
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      설정 필요
    </span>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const google = useGoogleAuth();

  const [form, setForm] = useState<SearchConfig>({
    jiraBaseUrl: '',
    jiraEmail: '',
    jiraToken: '',
  });
  const [jiraConnected, setJiraConnected] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifySuccess, setVerifySuccess] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as SearchConfig;
      setForm(parsed);
      setJiraConnected(!!parsed.jiraToken);
    }
  }, []);

  const handleChange = (field: keyof SearchConfig, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setVerifyError('');
    setVerifySuccess('');
  };

  const handleVerify = async () => {
    if (!form.jiraBaseUrl || !form.jiraEmail || !form.jiraToken) {
      setVerifyError('모든 항목을 입력해주세요.');
      return;
    }
    setIsVerifying(true);
    setVerifyError('');
    setVerifySuccess('');
    try {
      const response = await fetch('/api/search?q=test&sources=jira', {
        headers: {
          'x-jira-base-url': form.jiraBaseUrl,
          'x-jira-email': form.jiraEmail,
          'x-jira-token': form.jiraToken,
        },
      });
      if (response.ok) {
        setVerifySuccess('연결 성공! 저장 버튼을 눌러주세요.');
      } else {
        const data = await response.json();
        setVerifyError(data.errors?.jira ?? data.error ?? '연결에 실패했습니다. 정보를 다시 확인해주세요.');
      }
    } catch {
      setVerifyError('서버에 연결할 수 없습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = () => {
    if (!form.jiraBaseUrl || !form.jiraEmail || !form.jiraToken) {
      setVerifyError('모든 항목을 입력해주세요.');
      return;
    }
    const baseUrl = form.jiraBaseUrl.replace(/\/$/, '');
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...form, jiraBaseUrl: baseUrl }));
    setJiraConnected(true);
    setVerifySuccess('저장되었습니다.');
  };

  const canStart = jiraConnected || google.connected;

  return (
    <div className="min-h-full bg-[#F4F5F7] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="white" strokeWidth="1.5" />
                <path d="M10 10L14 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-xl font-semibold text-gray-900">사내 통합검색</span>
          </div>
          <p className="text-sm text-gray-500">검색할 서비스를 연결해주세요.</p>
        </div>

        <div className="space-y-3">
          {/* ── Section 1: Jira / Confluence ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Jira / Confluence</h2>
                <p className="text-xs text-gray-500 mt-0.5">이슈, 페이지 검색 · 동일한 API 토큰 사용</p>
              </div>
              <StatusBadge type={jiraConnected ? 'connected' : 'disconnected'} />
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">서버 주소</label>
                <input
                  type="url"
                  value={form.jiraBaseUrl}
                  onChange={(e) => handleChange('jiraBaseUrl', e.target.value)}
                  placeholder="https://yourcompany.jira.com"
                  className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">이메일 (회사 계정)</label>
                <input
                  type="email"
                  value={form.jiraEmail}
                  onChange={(e) => handleChange('jiraEmail', e.target.value)}
                  placeholder="name@company.co.kr"
                  className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">API Token</label>
                <input
                  type="password"
                  value={form.jiraToken}
                  onChange={(e) => handleChange('jiraToken', e.target.value)}
                  placeholder="발급받은 API Token 입력"
                  className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:text-blue-700"
                >
                  API Token 발급 페이지
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>

              {verifyError && (
                <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-xs text-red-600">{verifyError}</p>
                </div>
              )}
              {verifySuccess && (
                <div className="px-3 py-2.5 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-xs text-green-600">{verifySuccess}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={handleVerify}
                disabled={isVerifying}
                className="h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying ? '확인 중...' : '연결 테스트'}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 h-9 px-4 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                저장
              </button>
            </div>
          </div>

          {/* ── Section 2: Google Workspace ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Google Workspace</h2>
                <p className="text-xs text-gray-500 mt-0.5">Drive, Docs, Sheets 파일 검색</p>
              </div>
              <StatusBadge
                type={
                  !google.hasClientId
                    ? 'unconfigured'
                    : google.connected
                    ? 'connected'
                    : 'disconnected'
                }
              />
            </div>

            <div className="px-6 py-5">
              {!google.hasClientId ? (
                <div className="text-center py-3">
                  <p className="text-sm font-medium text-gray-600 mb-1">관리자 설정이 필요합니다</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Google Cloud Console에서 OAuth 앱을 등록하고<br />
                    <code className="bg-gray-100 px-1 rounded text-gray-600">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> 환경변수를 설정해주세요.
                  </p>
                </div>
              ) : google.connected ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{google.email}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Google 계정 연결됨</p>
                  </div>
                  <button
                    onClick={google.disconnect}
                    className="h-8 px-3 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    연결 해제
                  </button>
                </div>
              ) : (
                <div className="text-center py-1">
                  <p className="text-xs text-gray-500 mb-3">
                    회사 Google 계정으로 로그인하여 Drive 파일을 검색할 수 있습니다.
                  </p>
                  <button
                    onClick={google.connect}
                    disabled={google.loading}
                    className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    {google.loading ? '연결 중...' : 'Google 계정으로 연결'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Start button */}
        <div className="mt-4">
          <button
            onClick={() => router.push('/search')}
            disabled={!canStart}
            className="w-full h-10 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            검색 시작하기
          </button>
          {!canStart && (
            <p className="text-center text-xs text-gray-400 mt-2">
              최소 하나의 서비스를 연결해주세요.
            </p>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          입력한 정보는 이 브라우저에만 저장되며 외부로 전송되지 않습니다.
        </p>
      </div>
    </div>
  );
}
