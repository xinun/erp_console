# 기술 결정 기록

중요한 결정을 날짜순으로 기록한다. 새 결정을 추가할 때 기존 기록을 지우지 않는다.

## 2026-07-27: 프로젝트 지식을 저장소에 유지

### 결정

여러 PC와 새로운 Codex 작업에서도 문맥을 복구할 수 있도록 역할을 분리한 문서를 Git에 보관한다.

- `AGENTS.md`: 에이전트가 항상 지킬 실행 규칙
- `README.md`: 프로젝트 소개와 설치·연동 방법
- `docs/ARCHITECTURE.md`: 현재 시스템 구조
- `docs/DECISIONS.md`: 중요한 선택과 이유
- `docs/CURRENT.md`: 작업 상태와 다음 할 일

### 이유

대화 기록과 로컬 설정은 PC나 작업 환경이 바뀌면 사용할 수 없을 수 있다. 저장소에 커밋된 짧은 문서는 코드 버전과 함께 이동하고 변경 이력도 남는다.

## 2026-07-27: JSM 검색에 Jira 이슈 검색 API 사용

### 결정

JSM 고객 문의는 Jira Service Management 전용 REST API 대신 Jira `/rest/api/3/search/jql`을 사용한다. 프로젝트 키 또는 사용자 입력 JQL로 고객 문의 범위를 제한한다.

### 이유

- 현재 구현은 Jira 이슈와 JSM 문의를 같은 검색 함수로 처리한다.
- 필요한 읽기 권한을 `read:jira-work`로 통일할 수 있다.
- 현재 Atlassian Developer Console에 설정된 권한과 일치한다.

### 결과

- OAuth 요청에 `read:servicedesk-request`를 포함하지 않는다.
- JSM 전용 API 기능이 필요해지면 Developer Console 지원 여부, 필요한 scope, API 경로를 다시 검토한다.

## 2026-07-27: OAuth 콜백은 실제 접속 origin을 사용

### 결정

Atlassian OAuth의 `redirect_uri`는 브라우저의 현재 origin과 `/api/auth/atlassian/callback`을 조합한다.

### 결과

- 로컬 개발과 운영 환경을 같은 코드로 지원한다.
- 사용하는 모든 origin의 정확한 콜백 URL을 Atlassian Developer Console에 등록해야 한다.
- 운영 작업은 주소가 고정된 `https://erp-console.vercel.app`을 우선한다.

## 새 결정 작성 형식

## 2026-08-04: Jira와 Confluence 계정 연결 분리

### 결정

회사 Jira와 Confluence가 서로 다른 Atlassian 계정을 사용하므로 OAuth 연결을 제품별로 분리한다. 각 연결에 `jira` 또는 `confluence` 역할과 로그인한 사용자 정보를 저장하고 해당 제품 API만 호출한다.

### 이유

서로 다른 사용자에게 발급된 OAuth 토큰은 합칠 수 없다. 제품별 연결을 명확히 표시하면 잘못된 계정 선택을 확인할 수 있고, 권한이 없는 제품 API를 호출해 발생하는 불필요한 오류를 막을 수 있다.

### 결과

- 최초에는 Jira와 Confluence 로그인이 각각 한 번 필요하다.
- 이후에는 각 refresh token으로 자동 갱신한다.
- 사이트 URL은 공개 환경변수로 관리한다.

```md
## YYYY-MM-DD: 결정 제목

### 상황

결정이 필요했던 배경

### 결정

선택한 방식

### 이유

선택 근거와 고려한 대안

### 결과

후속 영향과 제약
```
