# 현재 작업 상태

마지막 갱신: 2026-10-01

## 현재 기준

- 브랜치: `main`
- 최근 확인 커밋: `0d14f20` (`녹음기 v0.1.1 업데이트`)
- 운영 주소: `https://erp-console.vercel.app/search`

## 최근 완료

- 2026-10-01 일반 Kubernetes YAML 동기화: build_kubernetes.py가 최신 catalog_resources/catalog_defaults를 공유해 준비 Job, PVC/Secret 생성 권한, 시작 전 PVC 검사 등 11개 리소스를 동일하게 생성한다. RoleBinding subject namespace는 명시한다. 카탈로그/일반 Service 모두 NodePort 30450, externalTrafficPolicy Cluster로 반영하고 일반 생성기에 --node-port 변경 옵션 추가했다. 별도 pvc.yaml은 자동 생성 흐름과 중복되어 제거하고 namespace.yaml/ollama.yaml 두 파일로 정리했다. 배포/재배포/포트 충돌/토큰 회수 안내 갱신. 서버 리소스는 조작하지 않았다. namespace 차이 정규화 후 두 버전 11개 리소스 완전 일치, 내장 소스 일치, 잘못된 NodePort 거부, diff 검사 통과. npm run lint, npm run build 통과. 실제 일반 Kubernetes 배포와 NodePort 접근은 미검증.


- 2026-09-30 사용자 ClusterCatalogTemplate 예시에 맞춰 카탈로그 종류를 ClusterCatalogTemplate으로 변경하고 metadata.name=ai-ollama-810d1, labels.packageName=ai-ollama, labels.version="3.1.0", category=ai 반영. 생성기도 동기화하고 클러스터 범위 리소스라 catalog-namespace 옵션 제거. 예시의 spec 구조에 맞춰 Catalog용 pipelineTemplate/terminateStrategy 제외. 서버 관리 필드 uid/selfLink/resourceVersion/generation/creationTimestamp는 복사하지 않았다. 메타데이터와 내부 11개 리소스 YAML 검사 및 diff 검사 통과. 메타데이터 변경으로 lint/build 재실행 생략, 실제 웹훅 등록 미검증.

- 2026-09-30 카탈로그 category annotation을 ai로 변경하고 생성기에도 반영했다. YAML annotation 검사와 diff 검사 통과. 메타데이터 변경으로 lint/build 재실행 생략.

- 2026-09-30 카탈로그 주석 제거: YAML 헤더와 내장 Python 코드의 주석을 제거하고 원본/생성기에 반영했다. 주석 부재 및 내부 리소스 11개 YAML 파싱, diff 검사 통과. 주석만 변경하여 lint/build 재실행 생략. 클러스터 변경 없음.

- 2026-09-30 명칭 정리: 사용자 첨부와 로컬 YAML은 Catalog metadata.name만 달랐다. deploy/ai_k8s의 카탈로그명과 resourceValues/template 연결 이름을 ai-ollama로 통일하고 표시명은 AI / Ollama로 변경했다. 생성기·일반 Kubernetes 예제·가이드에서도 internal 접두어를 제거(일반 예제 namespace ai, 앱 ai-ollama). YAML 파싱/리소스 연결 이름/selector 및 diff 검사 통과. 명칭만 수정해 lint/build 재실행 생략. 실행 중인 클러스터 리소스/Secret/토큰은 변경하지 않았다.

- 2026-09-30 UI namespace 불일치: metadata.namespace 외에 deployStrategy.clusters.namespaces에 proc이 남아 실제 대상이 고정된 것을 확인. 생성기의 --deploy-namespace를 필수로 변경하고 제공 YAML은 사용자가 선택한 ai로 생성했다. UI namespace 자동 상속은 미확인으로 주장하지 않는다. CPU 요청 기본값도 실제 성공한 1로 조정했다. YAML 대상 ai, 리소스 namespace 생략, CPU 기본값, diff 검사 통과. 템플릿 설정 변경이라 lint/build 재실행 생략. 기존 proc 리소스는 조작하지 않았다. 사용자 로그에서 proc Pod가 worker2에 Scheduled, check-pvc 이후 prepare-model 시작을 확인했지만 모델 다운로드 완료/추론은 미확인.


- 2026-09-30 Secret 자동 준비: 통합 카탈로그 Job이 지정 Secret을 조회하고 없으면 256비트 랜덤 토큰을 생성한다. 기존 토큰은 검증만 하고 덮어쓰지 않으며 생성 경쟁은 409 재조회로 처리한다. 토큰은 로그에 출력하지 않는다. 준비 Role에 지정 Secret get / namespace Secret create만 추가하고 AI 검사 계정에는 Secret API 권한을 부여하지 않았다. 기본 StorageClass는 사용자 확인값 accordion-storage, storageRevision은 2로 변경했다. 기존 asd 업데이트 시 실제 배포 입력 revision도 2로 올려야 한다. 공유 배포는 namespace 또는 PVC/Secret 이름을 분리하고 클러스터/namespace/registry/StorageClass를 환경에 맞춰 설정한다. 일반 Kubernetes YAML의 수동 준비 방식은 유지한다. README 재배포·보존·토큰 회수 절차 갱신. Secret 신규/재사용/409/403/잘못된 토큰/삭제 중 6가지 임시 검사, YAML/RBAC/내장 소스 일치, lint/build/diff 검사 통과. test_ 파일은 재생성하지 않았다. 실제 Secret 생성 및 재배포는 아직 클러스터에서 검증하지 않았다.

- 2026-09-30: 카탈로그를 `deploy/ai_k8s/ollama-catalog.yaml` 하나로 통합했다. PVC 준비 Job은 조회 후 없으면 생성하고 기존 PVC는 변경하지 않는다. AI Pod 첫 initContainer가 조건을 다시 검사해 실패 시 모델 시작을 차단한다. Job 생성 권한과 Pod 조회 권한을 분리하고 토큰은 검사 컨테이너만 마운트한다. storageRevision 증가로 Job 재실행/불변 필드 문제를 처리한다. 이전 로컬 new-pvc 파일은 제거했으나 서버 카탈로그/리소스는 변경하지 않았다. 일반 Kubernetes YAML은 별도 PVC 준비 방식 유지. PVC는 ownerReferences 없이 생성하며 아코디언 자체 삭제 정책 및 기존 배포 전환 시 관리 대상 해제는 실환경 확인 필요.


- 일반 Kubernetes용 `deploy/ai_k8s/kubernetes/` YAML(namespace, PVC, ConfigMap/Deployment/Service)과 생성기·배포 가이드를 추가했다. 현재 파일 위치인 `deploy/ai_k8s`를 유지했다. API 키 Secret은 별도 생성하며 앱 삭제 시 PVC를 보존하도록 매니페스트를 분리했다. 사용자가 Accordion 카탈로그 생성 성공을 확인했으며 실제 모델 배포는 미검증이다.

- 카탈로그 등록에서 `empty resource spec` webhook 거부가 보고되어 내부 리소스 표현을 JSON에서 예시와 같은 블록 YAML로 수정했다. 일반 YAML 파싱 성공만으로 Accordion 호환성을 보장할 수 없음을 확인했다. 실제 webhook 재등록은 사용자 환경에서 확인이 필요하다.

- 2026-09-29: `deploy/accordion/ollama-catalog.yaml`에 Ollama·Bearer 게이트웨이 단일 Pod 카탈로그 초안을 추가했다. 모델명 입력, 기존 PVC·Secret 참조, 모델 준비 initContainer, 내부 Service를 포함한다. 생성기·인증/입력 제한 테스트·설치 안내를 함께 추가했다. 실제 Accordion 등록/렌더링, 이미지 pull, PVC 및 서버 추론은 미검증이며 운영 배포하지 않았다. 개인별 토큰 발급 UI·Mattermost 검색은 포함하지 않는다.

- 2026-09-28: [사내 AI 검색 API 설계 계획](INTERNAL_AI_SEARCH_PLAN.md)을 작성했다. Vercel 일반 검색을 유지하면서 AI 검색만 브라우저에서 사내 API로 직접 호출하는 구조, Qwen3 활용, 사용자별 조회 권한, API 계약, 독립 빌드·배포를 정리했다. 설계 초안이며 구현·서버 설정·배포는 수행하지 않았다.

- 2026-09-11: MP3 추출 버튼과 컴포넌트, 전용 ffmpeg 의존성을 제거했다. 도구 메뉴의 녹음기 다운로드는 유지한다.
- 2026-09-08 UI 개편: 상시 사이드바를 상단 연결 관리 패널로 옮기고, 미연결 화면에 서비스별 연결 진입점을 제공한다. Google 세부 옵션과 제외어는 상세 필터로 접고 검색 조건 변경 시 재검색 안내를 표시한다.
- 검색 결과를 구분선 중심 목록과 16px 제목·14px 본문으로 정리하고, 서비스 표시는 작은 색상 점과 텍스트로 축약했다. 결과 카드의 부상 효과와 보조 배지 배경을 제거했다.
- 녹음기와 MP3 도구는 도구 메뉴로 묶었다. 넓은 화면의 미리보기는 오른쪽 패널로 배치하고 Escape 닫기, 포커스 순환·복귀를 추가했다. 연결 패널 너비를 작은 화면에 맞췄다.
- 새 검색 화면의 바탕·텍스트·액션 색상을 테마 변수로 관리하고 한글 시스템 글꼴 우선순위 및 미연결 패널의 다크 모드 대비를 개선했다.
- 한글 검색어에 공백이 있으면 원문과 공백 제거형을 함께 조회하고 결과 ID로 중복 제거한다. 모든 서비스의 정확 검색 결과가 0건이면 사용자가 `유사 검색어로 검색하기`를 선택할 수 있으며, 실행 시 2글자 검색 조각으로 조회한 뒤 원문과의 문자열 유사도가 낮은 후보를 제외하고 유사도순으로 표시한다.
- 우측 상단에 Windows용 Meet 음성 녹음기 v0.1.0을 GitHub Release에서 바로 내려받는 다운로드 버튼을 추가했다.
- 우측 상단에 MP3 추출 도구를 추가했다. 사용자가 선택하거나 끌어놓은 영상은 서버로 전송하지 않고 브라우저에서 ffmpeg.wasm으로 128kbps MP3로 변환해 다운로드한다.
- Mattermost 검색 결과 탭에서 검색된 채널, 개인 메시지, 그룹 메시지를 구분해 여러 대화를 선택하고 해당 결과만 볼 수 있는 결과 내 필터를 추가했다. 필터는 표시 이름이 아닌 채널 ID를 기준으로 동작하며 새 검색 시 초기화된다.
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

- 2026-09-30 정규식 재발 대응: 일반 그룹으로 변경한 뒤에도 BuildRequest가 invalid regex pattern으로 거부되어 앞선 그룹 문법 원인 추정은 확정할 수 없다. 생성기 valueschema의 pattern을 모두 제거하고 required/type/minLength는 유지했다. PVC 준비 코드의 이름/용량/기존 PVC 조건 검증은 유지한다. 플랫폼 입력 단계의 정규식 검증은 더 이상 제공하지 않는다. YAML 파싱 및 스키마 pattern 부재, PVC 정상/클래스 불일치/용량 부족 3가지 직접 검사, git diff --check 통과. 기존 test_prepare_pvc.py는 사용자 정리로 현재 없어 테스트 파일 실행은 불가했으며 재생성하지 않았다. 웹 런타임 변경이 없어 lint/build 재실행 생략. 실제 웹훅 재등록/배포는 미검증.

- 2026-09-30 BuildRequest 정규식 오류 대응: valueschema의 storageClass/pvcName 패턴에서 비캡처 그룹 `(?:...)`를 일반 그룹 `(...)`으로 바꾸고 카탈로그를 재생성했다. 웹훅 정규식 엔진과의 호환성 문제로 추정하며 실제 엔진은 확인하지 못했다. 모든 스키마 패턴 컴파일 및 이름 허용/거부 사례, YAML 파싱, git diff --check 통과. 스키마만 수정하여 lint/build는 재실행하지 않았다. 실제 BuildRequest 재시도는 미검증이며 storageClass 기본 CHANGE-ME는 실제 클래스 이름으로 교체해야 한다.

- 2026-09-30 namespace 오류 대응: Catalog metadata.namespace의 proc 고정을 제거하여 등록 요청 namespace를 따르도록 했다. 생성기에 --catalog-namespace(선택), --deploy-namespace(기본 proc) 추가. 실제 사용자 namespace 답변 전이므로 배포 대상 기본값 proc은 유지하며 README에 변경 방법을 명시했다. Catalog와 내부 11개 리소스 namespace 생략 및 YAML 파싱, git diff --check 통과. 생성기/문서의 제한적 변경으로 lint/build는 재실행하지 않았고 위 통합 구현 검증 결과를 유지한다. 실환경 재등록은 미검증. test_ 파일 2개는 개발 검증용이며 배포 참조가 없어 삭제 가능함을 안내하고 파일 자체는 보존했다.

- 2026-09-30 통합 카탈로그: 11개 리소스 YAML 렌더링, Pod 볼륨/ConfigMap/ServiceAccount 참조 및 내장 Python 소스 일치 검사 통과. PVC 테스트 6개(재사용 무변경, 신규 생성/409 경쟁, 403 처리, 조회 전용, 불일치 거부, 용량 비교), 게이트웨이 테스트 4개 통과. `npm run lint`, `npm run build`, `git diff --check` 통과. Accordion webhook/RoleBinding 허용, 실제 PVC 생성/보존 및 모델 추론은 클러스터 접근이 없어 미검증. 아래 9월 29일 두 카탈로그 기록은 통합 이전 이력이다.

- PVC 변경 후 `npm run lint`, `npm run build`, `git diff --check`도 통과했다. 웹 런타임 코드는 변경하지 않았다.

- 2026-09-29 PVC 검토: `deploy/ai_k8s/ollama-catalog.yaml`은 기존 PVC 참조만 하며 없으면 Pending 상태가 된다. `ollama-catalog-new-pvc.yaml`을 생성기에 추가해 신규 설치 시 배포 이름 기반 PVC를 함께 생성하도록 했다. 실제 StorageClass 입력 필수, 기본 20Gi, Secret 별도 준비. 신규 버전은 Cascade 삭제에 PVC가 포함될 수 있어 보존이 필요하면 별도 PVC + 기존 버전을 사용한다. 두 카탈로그 로컬 렌더링/리소스 참조/selector/내장 gateway 소스 일치, 일반 Kubernetes YAML 파싱, 게이트웨이 테스트 4개 통과. 신규 카탈로그 Accordion 등록과 서버 측 dry-run, 스토리지 할당 및 추론은 클러스터 접근이 없어 미검증이다.

- 일반 Kubernetes 버전: 표준 YAML 5개 리소스 파싱, 미치환 템플릿 없음, PVC 참조·Service selector·namespace·게이트웨이 코드 일치 검사, 게이트웨이 테스트 4개, `npm run lint`, `npm run build`, `git diff --check` 통과. 대상 클러스터에 연결하여 server-side dry-run/배포/이미지 pull/추론을 수행하지 않았으며 운영 적용 전 가이드의 검증 명령 실행이 필요하다.

- 2026-09-29: 카탈로그 생성, 게이트웨이 테스트 4개(HTTP 401/404/429, 토큰 교체, 모델·예산 강제, 입력 제한), Catalog YAML 및 내부 리소스 3개 파싱, `npm run lint`, `npm run build`, `git diff --check` 통과. Kubernetes/Accordion 서버 측 검증과 실제 모델 추론은 환경 접근이 없어 미실시다.

- 2026-09-28: 문서만 변경했다. 계획서 로컬 상대 링크와 `git diff --check` 검증을 수행했다. 런타임 코드·의존성 변경이 없어 `npm run lint`, `npm run build`는 실행하지 않았다. 실제 사내 연결·브라우저 정책·사용자 권한·Qwen3 성능은 미검증이다.

- 2026-09-11: MP3 추출 제거 후 `npm run lint`, `npm run build`, `git diff --check` 통과. 소스와 패키지 파일에 MP3 컴포넌트 및 ffmpeg 참조가 남아 있지 않음을 확인했다. 운영 배포는 수행하지 않았다.
- 2026-09-08: `npm ci` 완료. 기본 캐시 접근 오류와 대기를 겪은 뒤 프로젝트 내부 캐시로 설치했다. 설치 결과 High 등급 경고 7건이 보고됐으며 이번 UI 변경에서 의존성 버전은 변경하지 않았다.
- 2026-09-08: `npm run lint`, `npm run build` 통과. 변경 TSX 문법 검사도 통과했다.
- 2026-09-08: 로컬 `/search`에서 미연결 화면, 서비스 연결 패널 진입, 연결 관리 열기·Escape 닫기, 라이트·다크 표시를 브라우저로 확인했다. 콘솔 오류 없음. 390px 화면에서 문서 가로 너비와 스크롤 너비가 모두 390px로 가로 넘침 없음.
- 2026-09-08 미검증: 테스트 브라우저에 연결 계정이 없고 로컬 OAuth 환경 설정이 없어 실제 서비스 검색, 연결 후 상세 필터 및 실데이터 미리보기는 확인하지 못했다. 운영 배포도 수행하지 않았다.

### 이전 검증 기록

- `git diff --check`: 통과
- `npm run build`: 이전 작업에서 통과. 2026-08-21 변경은 로컬 의존성 트리가 불완전해 재검증하지 못했다.
- `npm run lint`: 이전 작업에서 통과. 2026-08-21 변경은 로컬 의존성 트리가 불완전해 재검증하지 못했다.

2026-08-21에 ffmpeg.wasm 의존성은 `package.json`과 `package-lock.json`에 기록했다. 기존 `node_modules`를 보존하고 깨끗한 폴더에서 `npm ci`를 두 차례 실행했지만 모두 출력 없이 장시간 대기해 완료하지 못해 작업 전 폴더를 복원했다. 남아 있는 실행 파일을 직접 호출한 검사도 ESLint 패키지 메타데이터, Next.js 서버 모듈, TypeScript 표준 라이브러리가 각각 누락되어 실행되지 않았다. 패키지 잠금 파일 검사에서는 High 등급 보안 경고 6건이 확인됐다.

## 다음 할 일

사내 AI 검색은 [설계 계획](INTERNAL_AI_SEARCH_PLAN.md)의 단계 0부터 진행한다. 사내 API 설치 위치·HTTPS 주소·Ollama 환경을 확인하고 실제 Vercel 화면에서 VPN을 통한 접근 가능성을 먼저 검증한다. 아래 기존 운영 검증 항목은 유지한다.

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
