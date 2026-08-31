# 현재 작업 상태

마지막 갱신: 2026-08-21

## 현재 기준

- 브랜치: `main`
- 최근 확인 커밋: `0331523` (`컨플루언서 권한 변경`)
- 운영 주소: `https://erp-console.vercel.app/search`

## 최근 완료

<<<<<<< HEAD
- 한글 검색어에 공백이 있으면 원문과 공백 제거형을 함께 조회하고 결과 ID로 중복 제거한다. 모든 서비스의 정확 검색 결과가 0건이면 2글자 검색 조각으로 한 차례 연관 검색한 뒤 원문과의 문자열 유사도가 낮은 후보를 제외하고 유사도순으로 표시한다.
=======
- 우측 상단에 Windows용 Meet 음성 녹음기 v0.1.0을 GitHub Release에서 바로 내려받는 다운로드 버튼을 추가했다.
- 우측 상단에 MP3 추출 도구를 추가했다. 사용자가 선택하거나 끌어놓은 영상은 서버로 전송하지 않고 브라우저에서 ffmpeg.wasm으로 128kbps MP3로 변환해 다운로드한다.
- Mattermost 검색 결과 탭에서 검색된 채널, 개인 메시지, 그룹 메시지를 구분해 여러 대화를 선택하고 해당 결과만 볼 수 있는 결과 내 필터를 추가했다. 필터는 표시 이름이 아닌 채널 ID를 기준으로 동작하며 새 검색 시 초기화된다.
>>>>>>> b2ea394bd3fb9e6416fcb171d7a24b9a812b0cb3
- Mattermost 사용자 이름은 한글 이름일 때 `성 이름`, 그 외에는 `이름 성` 순서로 표시하도록 공통 포맷을 적용해 검색 결과와 스레드 미리보기의 표기를 통일했다.
- 검색 필터의 알약형 선택 UI를 실제 체크박스 중심의 중립적인 레이아웃으로 정리하고, Google 검색 위치와 파일 유형을 각각 독립된 카드로 구분했다. 헤더 돋보기와 검색 버튼을 검정 계열로 바꾸고 선택·포커스·진행 상태의 파란색을 중립색으로 줄였으며, 공통 테마 변수를 사용해 라이트·다크 테마의 대비가 일관되도록 조정했다.
- Mattermost 검색 결과의 루트 메시지에 검색어가 일치하고 답글에는 일치하지 않는 경우에도 `reply_count`를 기준으로 스레드 카드와 전체 스레드 미리보기를 표시하도록 보완했다.
- 검색 범위의 Jira, Confluence, Google Drive, Mattermost를 초기값으로 모두 선택하도록 변경했다.
- Google Drive 검색에서 Docs, Sheets, Slides, 일반 파일 유형을 각각 선택할 수 있도록 추가했다.
- Google OAuth 권한을 파일 본문 읽기가 가능한 `drive.readonly`에서 메타데이터 검색 전용 `drive.metadata.readonly`로 축소하고, 새 access token에 이전 권한을 합치지 않도록 설정했다. 기존 연결 사용자는 연결 해제 후 다시 동의해야 한다.
- Google 연결 해제 시 브라우저 저장값뿐 아니라 Google에 발급된 OAuth 권한도 함께 취소하도록 보완했다.
- Google 검색 위치를 `내 파일·공유받은 파일`, `공유 드라이브`, `회사 전체 공개 문서`로 나누고 모두 기본 선택하도록 추가했다. 각 Drive 검색 컬렉션의 결과는 파일 ID로 중복 제거한다.
- Google 연동은 `drive.metadata.readonly`와 GET 검색만 사용하며 파일 수정·업로드·삭제 권한을 요청하지 않는다.
- Mattermost 검색 결과는 같은 스레드의 일치 메시지를 한 카드로 묶고, 미리보기에서 전체 스레드를 필요할 때만 조회하도록 개선했다.
- Mattermost 채널 정보는 팀별 채널 API로 조회하고, 누락된 채널은 개별 채널 API로 보완해 채널명이 표시되도록 했다.
- Mattermost에서 한글 1~2글자 검색어는 자동으로 접두어 와일드카드(`*`)를 붙여 검색 누락을 줄이도록 했다.
- Jira, Confluence, Google Drive, Mattermost 요청을 독립적으로 처리해 완료된 서비스 결과부터 즉시 표시하고 진행 중인 서비스를 화면에 안내한다.
- 통합 결과에 관련도 점수를 계산하고 관련도순·최신순·오래된순 정렬을 제공한다.
- Mattermost 메시지 검색과 함께 첨부파일 검색 API를 호출해 파일명과 색인된 문서 내용 결과를 별도 카드로 표시한다.
- Google Drive는 `drive.metadata.readonly`를 유지하면서 파일명 검색과 전체 텍스트 검색을 분리해 `제목 일치`와 `본문·메타데이터 일치`를 구분한다.
- Confluence 결과는 콘텐츠의 실제 스페이스 이름과 전역 컨테이너를 우선 사용해 카드와 미리보기에 스페이스명을 표시한다.
- 검색 결과 카드의 제목뿐 아니라 본문과 메타데이터 영역을 클릭해도 미리보기가 열리도록 변경했다.
- 검색 결과 서비스 필터를 고정형 탭으로 강화하고, 카드를 2줄 요약으로 축약했으며 데스크톱에서 1열·2열 보기를 전환할 수 있게 했다.
- Mattermost 검색 카드는 일치 메시지를 기본 한 건만 보여주고 필요할 때 카드 안에서 펼치거나 접을 수 있게 했다.
- Mattermost 개인 메시지는 내부 채널 ID 대신 상대 사용자 이름을, 그룹 메시지는 참여자 이름 요약을 표시한다.
- 긴 검색 결과의 현재 위치를 보여주는 단색 미니 인덱스를 우측에 추가했다. 평소에는 얇은 회색 레일과 검은 손잡이만 표시하고, 마우스를 올리면 서비스별 이동 버튼과 건수가 펼쳐지며 클릭·드래그·키보드 이동을 지원한다.
- 미니 인덱스 레일과 펼침 메뉴 사이에 투명한 hover 연결 영역을 두어 마우스를 메뉴로 옮길 때 닫히지 않도록 했다.
- 결과를 일정 거리 이상 내리면 우측 하단에 부드럽게 맨 위로 이동하는 버튼을 표시한다.
- 우측 상단 프로필 옆에서 라이트·다크·시스템 테마를 선택할 수 있고 선택값을 브라우저에 저장한다.

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
- `npm run build`: 이전 작업에서 통과. 2026-08-21 변경은 로컬 의존성 트리가 불완전해 재검증하지 못했다.
- `npm run lint`: 이전 작업에서 통과. 2026-08-21 변경은 로컬 의존성 트리가 불완전해 재검증하지 못했다.

2026-08-21에 ffmpeg.wasm 의존성은 `package.json`과 `package-lock.json`에 기록했다. 기존 `node_modules`를 보존하고 깨끗한 폴더에서 `npm ci`를 두 차례 실행했지만 모두 출력 없이 장시간 대기해 완료하지 못해 작업 전 폴더를 복원했다. 남아 있는 실행 파일을 직접 호출한 검사도 ESLint 패키지 메타데이터, Next.js 서버 모듈, TypeScript 표준 라이브러리가 각각 누락되어 실행되지 않았다. 패키지 잠금 파일 검사에서는 High 등급 보안 경고 6건이 확인됐다.

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
