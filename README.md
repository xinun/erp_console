# 사내 통합검색 (ERP Console)

Jira, Confluence, Google Workspace(Drive, Docs 등)의 데이터를 한 곳에서 통합하여 검색할 수 있는 사내 통합검색 시스템입니다.

## 기능
- **Atlassian 연동**: Jira 이슈 및 Confluence 페이지 통합 검색 (OAuth 2.0 또는 API Token 방식 지원)
- **Google Workspace 연동**: Google Drive, Docs, Sheets, Slides 파일 검색 (OAuth 2.0 지원)

## 개발 서버 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하세요.

---

## ⚙️ Atlassian (Jira/Confluence) 설정 가이드

시스템에서 '간편 로그인(OAuth)'을 사용하기 위해서는 Atlassian Developer Console에서 앱을 등록해야 합니다.

### 1. 환경 변수 설정
프로젝트 최상단의 `.env.local.example` 파일을 복사하여 `.env.local` 파일을 만들고, 아래의 `Client ID`와 `Secret`을 입력합니다. (값을 채우려면 아래 2번 과정을 진행해야 합니다.)

```env
NEXT_PUBLIC_ATLASSIAN_CLIENT_ID=여기에_발급받은_Client_ID_입력
ATLASSIAN_CLIENT_SECRET=여기에_발급받은_Client_Secret_입력
```

**중요**: `.env.local` 파일이 수정된 경우 반드시 터미널에서 `npm run dev` 서버를 종료(Ctrl+C)하고 다시 실행해야 변경된 환경 변수가 적용됩니다.

### 2. Atlassian 앱 생성 및 설정
[developer.atlassian.com/console/myapps/](https://developer.atlassian.com/console/myapps/) 에 접속하여 새 앱(OAuth 2.0 3LO)을 생성합니다.

#### A. 권한(Permissions) 추가
앱 화면 좌측의 **Permissions** 메뉴로 들어가 다음 API를 추가(Add)하고 **Configure**를 눌러 필수 권한들을 체크(Edit Scopes)합니다.

*   **Jira API** (Classic scopes)
    *   `read:jira-work`
*   **Confluence API** (Classic scopes)
    *   `read:confluence-content.all`
    *   `search:confluence` (검색 기능을 위해 필수!)
*   **User identity API**
    *   `read:me`
    *   `offline_access` (자동 로그인을 위한 리프레시 토큰 발급)

#### B. 콜백 주소(Authorization) 등록
좌측 메뉴의 **Authorization** 메뉴에서 `OAuth 2.0 (3LO)` 항목을 추가(Add)합니다.
`Callback URL` 항목에 정확히 아래 주소를 입력하고 저장합니다.
*   `http://localhost:3000/api/auth/atlassian/callback`
*(주의: 브라우저 주소창이 `127.0.0.1:3000`인 상태로 로그인을 시도하면 콜백 주소 불일치 에러가 발생합니다.)*

#### C. Client ID 및 Secret 확인
좌측 메뉴의 **Settings** 메뉴로 이동하여 `Client ID`와 `Secret` 값을 복사한 뒤, 1번의 `.env.local` 파일에 붙여넣습니다.

---

## ⚙️ Google Workspace 설정 가이드

Google Drive 검색을 위해서는 Google Cloud Console에서 OAuth 클라이언트 ID를 발급받아야 합니다.

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 후 **API 및 서비스 > 사용자 인증 정보**로 이동
3. `OAuth 클라이언트 ID` 생성 (웹 애플리케이션)
4. 승인된 자바스크립트 원본에 `http://localhost:3000` 추가
5. 발급된 클라이언트 ID를 `.env.local`의 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`에 입력
