# ERP Console 아키텍처

## 목적

ERP Console은 여러 사내 서비스의 검색 결과를 하나의 화면에 모아 보여주는 Next.js 기반 통합검색 애플리케이션이다.

현재 검색 대상은 다음과 같다.

- Jira 이슈
- Confluence 페이지
- Google Drive, Docs, Sheets, Slides
- Mattermost 메시지

## 기술 구성

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Vercel 배포

주요 화면은 `src/app/search/page.tsx`, 통합 검색 API는 `src/app/api/search/route.ts`에 있다.

우측 상단의 MP3 추출 도구는 `src/components/Mp3Extractor.tsx`에 있다. 영상 파일은 서버에 업로드하지 않고 브라우저의 ffmpeg.wasm에서 음성 트랙을 MP3로 변환하며, 변환 코어는 사용자가 도구를 실행할 때만 지연 로딩한다.

## 검색 흐름

1. 사용자가 `/search`에서 검색어, 검색 대상, 기간을 선택한다.
2. 브라우저가 연결별 인증 정보와 함께 `/api/search`를 호출한다.
3. Route Handler가 선택된 외부 서비스에 검색 요청을 병렬로 보낸다.
4. 결과를 공통 `SearchResult` 형태로 변환한다.
5. 서비스별 결과 수와 오류를 함께 브라우저에 반환한다.

공통 검색 타입은 `src/lib/types.ts`에 정의되어 있다.

## 인증 구조

### Atlassian

- 클라이언트 훅: `src/hooks/useAtlassianAuth.ts`
- OAuth 콜백: `src/app/api/auth/atlassian/callback/route.ts`
- 토큰 갱신: `src/app/api/auth/atlassian/refresh/route.ts`
- 연결과 토큰은 현재 브라우저 `localStorage`에 저장한다.
- OAuth 요청 상태와 연결 중인 설정은 `sessionStorage`에 임시 저장한다.
- 서버에서 authorization code를 access token과 교환하고 접근 가능한 Atlassian 리소스를 조회한다.

요청 scope:

```text
read:jira-work
read:confluence-content.all
search:confluence
read:me
offline_access
```

Jira Service Management에서 생성된 고객 문의는 별도 연결을 만들지 않고 회사 Jira의 `/rest/api/3/search/jql` 결과로 함께 검색한다.

### Google Workspace

- 클라이언트 훅: `src/hooks/useGoogleAuth.ts`
- Google Identity Services에서 access token을 발급받는다.
- 토큰, 만료 시각, 사용자 이메일은 현재 브라우저 `localStorage`에 저장한다.
- 검색 API가 Google Drive API를 호출한다.

### Mattermost

- 클라이언트 훅: `src/hooks/useMattermostAuth.ts`
- OAuth 콜백: `src/app/api/auth/mattermost/callback/route.ts`
- 토큰 교환: `src/app/api/auth/mattermost/token/route.ts`
- PKCE verifier와 state로 OAuth 요청을 검증한다.
- 연결 정보와 토큰은 현재 브라우저 `localStorage`에 저장한다.
- Client Secret은 서버 환경변수에서만 읽으며 브라우저에 전달하지 않는다.
- 토큰 교환과 메시지 검색은 ERP Console 서버가 Mattermost를 호출한다. 브라우저는 Mattermost CORS 설정에 의존하지 않는다.

## 환경변수

필수 또는 기능별 환경변수:

```env
NEXT_PUBLIC_ATLASSIAN_CLIENT_ID=
ATLASSIAN_CLIENT_SECRET=
NEXT_PUBLIC_ATLASSIAN_JIRA_SITE_URL=
NEXT_PUBLIC_ATLASSIAN_CONFLUENCE_SITE_URL=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
MATTERMOST_BASE_URL=
MATTERMOST_CLIENT_ID=
MATTERMOST_CLIENT_SECRET=
NEXT_PUBLIC_MATTERMOST_URL=
NEXT_PUBLIC_MATTERMOST_CLIENT_ID=
```

Atlassian workspace 연결은 `products` 값으로 Jira 또는 Confluence 역할을 구분한다. 서로 다른 계정으로 연결할 수 있으며 검색 시 해당 제품의 API만 호출한다. OAuth 완료 시 User identity API의 계정 이름과 이메일을 연결 정보에 함께 저장한다.

실제 값은 `.env.local` 또는 배포 환경의 비밀 설정에 저장한다. 저장소에는 커밋하지 않는다.

## 배포

고정 운영 주소:

```text
https://erp-console.vercel.app
```

Atlassian 운영 콜백:

```text
https://erp-console.vercel.app/api/auth/atlassian/callback
```

Vercel Function은 `vercel.json`의 `regions` 설정에 따라 서울 리전(`icn1`)에서 실행한다. 한국에 있는 Mattermost 서버와의 지연 및 해외 리전 접근 제한 가능성을 줄이기 위한 설정이다.

Vercel 미리보기 배포는 주소가 달라질 수 있으므로 OAuth 테스트 시 해당 미리보기 콜백을 Developer Console에 별도로 등록해야 한다.

## 현재 제약

- 인증 정보가 브라우저 저장소에 있으므로 다른 PC나 브라우저로 자동 동기화되지 않는다.
- 외부 서비스 권한과 사용자 권한에 따라 동일한 검색도 결과가 달라질 수 있다.
- 문서와 코드의 OAuth scope가 어긋나면 Atlassian 인증 단계에서 일반 오류 화면이 나타날 수 있다.
