# 현재 작업 상태

마지막 갱신: 2026-08-04

## 현재 기준

- 브랜치: `main`
- 최근 확인 커밋: `0331523` (`컨플루언서 권한 변경`)
- 운영 주소: `https://erp-console.vercel.app/search`

## 최근 완료

- 검색 범위의 Jira, Confluence, Google Drive, Mattermost를 초기값으로 모두 선택하도록 변경했다.
- Google Drive 검색에서 Docs, Sheets, Slides, 일반 파일 유형을 각각 선택할 수 있도록 추가했다.
- Google OAuth 권한을 파일 본문 읽기가 가능한 `drive.readonly`에서 메타데이터 검색 전용 `drive.metadata.readonly`로 축소하고, 새 access token에 이전 권한을 합치지 않도록 설정했다. 기존 연결 사용자는 연결 해제 후 다시 동의해야 한다.
- Google 연결 해제 시 브라우저 저장값뿐 아니라 Google에 발급된 OAuth 권한도 함께 취소하도록 보완했다.
- Google 검색 위치를 `내 파일·공유받은 파일`, `공유 드라이브`, `회사 전체 공개 문서`로 나누고 모두 기본 선택하도록 추가했다. 각 Drive 검색 컬렉션의 결과는 파일 ID로 중복 제거한다.
- Google 연동은 `drive.metadata.readonly`와 GET 검색만 사용하며 파일 수정·업로드·삭제 권한을 요청하지 않는다.
- Mattermost 검색 결과는 같은 스레드의 일치 메시지를 한 카드로 묶고, 미리보기에서 전체 스레드를 필요할 때만 조회하도록 개선했다.
- 검색 결과 카드의 제목뿐 아니라 본문과 메타데이터 영역을 클릭해도 미리보기가 열리도록 변경했다.

- 회사 Jira와 Confluence가 서로 다른 계정을 사용하는 구조에 맞춰 Atlassian 연결을 제품별로 분리했다.
- OAuth 완료 시 연결된 Atlassian 계정 이름과 이메일을 표시하도록 추가했다.
- Jira 전용 연결에는 Jira 검색만, Confluence 전용 연결에는 Confluence 검색만 요청하도록 변경했다.
- `NEXT_PUBLIC_ATLASSIAN_JIRA_SITE_URL`, `NEXT_PUBLIC_ATLASSIAN_CONFLUENCE_SITE_URL` 환경변수를 추가했다.
- 서로 다른 Atlassian 계정 전환 시 OAuth 동의 화면 안에서 로그아웃하지 않도록, 대상 사이트에서 계정을 먼저 확인·전환한 뒤 OAuth를 시작하는 2단계 UI로 변경했다.
- Jira 연결은 Jira scope만, Confluence 연결은 Confluence scope만 요청하도록 최소 권한으로 분리했다.
- OAuth 팝업을 닫거나 사용자가 취소하면 연결 대기 상태가 자동으로 해제되도록 보완했다.
- 사이트별 로그인과 `auth.atlassian.com` 중앙 OAuth 세션이 다를 수 있어, 1단계 계정 전환 링크를 대상 사이트가 아닌 Atlassian 계정 설정으로 변경했다.
- Jira 미리보기에 설명, 상태·담당자·보고자·우선순위·레이블과 댓글 활동을 표시하도록 확장했다. 제목과 설명을 누르면 Jira 원문을 연다.
- 중복된 고객 문의(JSM) 연결·검색 범위·결과 집계를 제거하고 회사 Jira 검색으로 통합했다.

- 검색 결과 요약을 검색어 주변 문맥으로 생성하고 검색어를 강조 표시하도록 개선했다.
- 결과 클릭 시 ERP Console 내부 미리보기를 먼저 열고 사용자가 선택할 때만 원문을 새 탭으로 열도록 변경했다.
- 검색 결과 수를 서비스별 전환 칩으로 바꿔 재검색 없이 전체/Jira/Confluence/JSM/Drive/Mattermost 결과를 즉시 전환할 수 있게 했다.
- Mattermost 결과의 사용자·채널 ID를 실제 표시 이름으로 변환하고 제목을 작성자 중심으로 개선했다.
- 왼쪽 패널은 연결된 서비스 관리만 표시하도록 단순화했다.
- 검색 범위와 기간 필터를 검색창 영역으로 이동했다.
- 쉼표로 구분한 제외 키워드가 제목·본문·작성자·서비스 메타데이터에 포함된 결과를 공통 제외하도록 추가했다.
- Vercel Function 실행 지역을 `vercel.json`에서 서울(`icn1`)로 고정했다.
- 필요한 환경변수 전체를 주석과 함께 `.env.example`에 정리했다.
- README에 로컬 및 Vercel 환경변수 관리 원칙과 Mattermost 설정 방법을 추가했다.
- Mattermost OAuth 토큰 교환과 메시지 검색을 서버 중계 방식으로 변경했다.
- `MATTERMOST_CLIENT_SECRET`은 서버 Route Handler에서만 사용하도록 구성했다.
- Mattermost 브라우저 직접 호출을 제거해 CORS 의존성을 없앴다.
- 왼쪽 패널을 서비스 카드, 상태 아이콘, 선택형 검색 필터 구조로 개편했다.
- 연결 추가 메뉴에 열림·닫힘 애니메이션과 키보드 포커스 상태를 추가했다.
- Atlassian OAuth 요청에서 미등록 `read:servicedesk-request` scope를 제거했다.
- Jira, Confluence, JSM 검색에 필요한 현재 OAuth scope와 README 설명을 일치시켰다.
- 운영 Atlassian 콜백 URL을 README에 기록했다.
- 프로젝트 구조, 기술 결정, 작업 인수인계 문서를 추가했다.

## 확인된 설계

- Jira 및 JSM 검색은 Jira REST API v3의 JQL 검색을 사용한다.
- JSM은 프로젝트 키 또는 사용자 지정 JQL로 검색 범위를 제한한다.
- Confluence는 Atlassian API를 통해 별도로 검색한다.
- Atlassian 연결 정보와 토큰은 브라우저 `localStorage`에 저장된다.

## 검증 상태

- `git diff --check`: 통과
- `npm run build`: 통과
- `npm run lint`: 통과

`npm ci`는 완료됐다. 현재 Node.js `v20.14.0`에서 일부 패키지가 더 높은 Node.js 20 패치 버전을 요구한다는 경고와 의존성 보안 경고 4건이 확인됐다.

## 다음 할 일

1. Node.js를 패키지가 지원하는 최신 LTS 패치 버전으로 준비한다.
2. 의존성 보안 경고 4건의 영향 범위를 검토한다.
3. Vercel에 최신 커밋을 배포한다.
4. 운영 주소에서 Atlassian OAuth 연결을 다시 테스트한다.
5. Jira, Confluence, JSM 검색을 각각 확인한다.

## OAuth 점검표

Atlassian Developer Console의 scope:

```text
read:jira-work
read:confluence-content.all
search:confluence
read:me
```

인증 요청에서 추가로 사용하는 값:

```text
offline_access
```

등록 콜백:

```text
http://localhost:3000/api/auth/atlassian/callback
https://erp-console.vercel.app/api/auth/atlassian/callback
```

## 다음 작업 시작 프롬프트

새 PC 또는 새 Codex 작업에서 다음과 같이 요청한다.

```text
AGENTS.md, README.md, docs/ARCHITECTURE.md,
docs/DECISIONS.md, docs/CURRENT.md를 읽고 현재 상태부터 확인해줘.
기존 변경을 보존하고 docs/CURRENT.md의 다음 할 일을 이어서 진행해줘.
```
