# 현재 작업 상태

마지막 갱신: 2026-07-27

## 현재 기준

- 브랜치: `main`
- 최근 확인 커밋: `0331523` (`컨플루언서 권한 변경`)
- 운영 주소: `https://erp-console.vercel.app/search`

## 최근 완료

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
- `npm run lint`: 기존 `src/hooks/useGoogleAuth.ts:54`의 `react-hooks/set-state-in-effect` 오류로 실패

`npm ci`는 완료됐다. 현재 Node.js `v20.14.0`에서 일부 패키지가 더 높은 Node.js 20 패치 버전을 요구한다는 경고와 의존성 보안 경고 4건이 확인됐다.

## 다음 할 일

1. `src/hooks/useGoogleAuth.ts`의 기존 린트 오류를 별도 수정한다.
2. Node.js를 패키지가 지원하는 최신 LTS 패치 버전으로 준비한다.
3. 의존성 보안 경고 4건의 영향 범위를 검토한다.
4. Vercel에 최신 커밋을 배포한다.
5. 운영 주소에서 Atlassian OAuth 연결을 다시 테스트한다.
6. Jira, Confluence, JSM 검색을 각각 확인한다.

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
