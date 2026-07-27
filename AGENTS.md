<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ERP Console 작업 지침

## 작업 시작

1. `README.md`에서 서비스 범위와 로컬 설정을 확인한다.
2. `docs/ARCHITECTURE.md`와 `docs/DECISIONS.md`에서 현재 구조와 기술 결정을 확인한다.
3. `docs/CURRENT.md`에서 진행 상태와 다음 검증 항목을 확인한다.
4. 기존 작업물을 보존하고 `git status`와 최근 커밋을 확인한 뒤 수정한다.

## 구현 원칙

- 확인되지 않은 기능이나 설정을 문서에 사실처럼 기록하지 않는다.
- OAuth scope를 변경할 때는 Developer Console의 실제 Permissions와 요청 scope를 일치시킨다.
- Client Secret, access token, refresh token, 사용자 이메일 등 비밀값과 개인정보를 커밋하지 않는다.
- 환경별 URL이나 Client ID는 코드에 새로 하드코딩하지 않고 환경변수 또는 문서화된 설정을 사용한다.
- JSM 고객 문의 검색은 현재 JSM 전용 API가 아니라 Jira 이슈 검색 API와 프로젝트/JQL 필터를 사용한다.
- 작업 후 코드와 `docs/CURRENT.md`의 상태가 일치하도록 함께 갱신한다.

## 검증

변경 범위에 맞게 아래 명령을 실행한다.

```bash
npm run lint
npm run build
```

의존성이 없다면 먼저 `npm ci`를 사용한다. 검증하지 못한 항목은 완료로 표시하지 말고 이유를 `docs/CURRENT.md`와 최종 보고에 남긴다.
