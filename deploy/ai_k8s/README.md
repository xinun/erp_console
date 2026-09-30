현재 등록 파일은 ClusterCatalogTemplate 형식이다. 이름은 ai-ollama-810d1,
packageName은 ai-ollama, version은 3.1.0, category는 ai다.
클러스터 범위 템플릿이므로 metadata.namespace와 --catalog-namespace 옵션을 사용하지 않는다.
실제 워크로드 배포 대상은 --deploy-namespace로 설정한다. 서버 관리 필드는 복사하지 않는다.

# Accordion 내부 AI 카탈로그 초안

일반 Kubernetes에서는 [표준 YAML 배포 안내](kubernetes/README.md)를 사용한다.
`kubernetes/ollama.yaml`은 Accordion CRD 없이 배포할 수 있으며 모델·게이트웨이 구성은 같다.

`ollama-catalog.yaml`을 Accordion Catalog 편집기에 등록한다. 사용자 제공 Catalog의
`template.resources.spec`, `resourceValues`, `valueschema` 구조를 사용했다.
사용자가 Accordion 카탈로그 생성 성공을 확인했다. 실제 모델 배포·추론은 아직 검증하지 않았다.
기존 PVC 버전의 등록은 사용자 확인 완료다. 이번 Job/RBAC 통합 버전은 로컬 검증만 완료했으며
Accordion 등록·렌더링과 실제 배포는 별도 검증이 필요하다.

## 배포와 재배포 (PVC + Secret 자동 준비)

등록 파일은 `ollama-catalog.yaml` 하나다. Python 파일은 생성/유지보수용이며 배포 대상 서버로
복사할 필요가 없다. ConfigMap에 실행 코드가 포함되어 있다.

| 입력 | 현재 기본값 | 다른 환경에 배포할 때 |
| --- | --- | --- |
| pvcName | ai-models | 다른 AI 인스턴스라면 겹치지 않는 이름 |
| tokenSecret | ai-api-token | 다른 AI 인스턴스라면 별도 이름 |
| storageClass | accordion-storage | `kubectl get sc`로 실제 클래스 확인 후 변경 |
| storageSize | 20Gi | 신규 용량 / 기존 PVC 최소 요청 용량 |
| storageRevision | 2 | 재실행 또는 준비 설정 변경 시 이전보다 증가 |

카탈로그 등록 namespace는 요청을 따른다. 현재 제공 YAML의 실제 배포 대상은 ai/localcluster다. UI에서 선택한 namespace와 이 대상은 반드시 일치시킨다. UI 선택을 자동으로 따르는 동작은 아직 확인하지 못했다.
다른 환경은 `python -B deploy/ai_k8s/build_catalog.py --deploy-namespace YOUR_NAMESPACE`로 생성하거나
YAML의 deployStrategy.clusters에서 실제 클러스터 이름과 namespace를 설정한다.
이미지 registryName(user-registry)도 해당 Accordion 환경에 등록된 값인지 확인한다.
등록 namespace를 명시하려면 --catalog-namespace를 추가하고 등록 요청 namespace와 일치시킨다.
Pod는 실제 namespace를 Downward API로 읽는다. 다른 namespace의 PVC/Secret을 재사용하지 않는다.

### 처음 배포

1. 실제 StorageClass와 배포마다 사용할 PVC/Secret 이름을 정한다.
2. 위 자동 준비 절차를 따른다. 수동 Secret 생성은 필요 없다.

3. 카탈로그 입력: PVC 이름, StorageClass, 용량, storageRevision, Secret 이름, 모델명, 이미지, 리소스 확인.
   Ollama 이미지 기본값은 사용자 설치 버전에 맞춘 0.34.2이며 레지스트리에서 pull 검증 필요.
   Python 이미지와 Ollama 이미지는 운영 전 검증한 digest로 고정하는 것을 권장한다.
4. 등록 후 생성될 리소스를 미리보기에서 확인한다. 모델 다운로드가 완료될 때까지
   initContainer 로그를 확인한다. 인터넷 연결은 이미지 레지스트리와 모델 다운로드 경로 모두 필요하다.
5. 배포가 정상화되면 localhost 포트포워딩으로 시험한다(이름 ai-ollama으로 배포한 예).

```bash
kubectl -n proc port-forward svc/ai-ollama 18080:8080
```

다른 Linux 터미널에서, 토큰이 저장된 파일을 사용해 호출한다.

```bash
AI_TOKEN="$(cat ai-token.txt)"
curl http://127.0.0.1:18080/api/chat \
  -H "Authorization: Bearer ${AI_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"한국어로 짧게 인사해줘."}]}'
unset AI_TOKEN
```

토큰 없는 동일 호출은 401, /api/pull 등 관리 경로는 404여야 한다.
게이트웨이 재시작과 PVC 재사용, 잘못된 모델명 다운로드 실패, 모델 중단도 시험한다.
Secret 교체는 새 토큰 파일로 같은 Secret을 갱신하고 전파 후 구 토큰 401을 확인한다.

```bash
kubectl -n proc create secret generic ai-api-token --from-file=token=ai-token.txt --dry-run=client -o yaml | kubectl apply -f -
```

## Kubernetes create token과의 차이

`kubectl create token`은 ServiceAccount JWT를 발급한다. AI API가 자동으로 이를 신뢰하지 않는다.
사용하려면 게이트웨이에 TokenReview 또는 서명/issuer/audience/만료 검증과
허용 ServiceAccount 정책을 구현해야 한다. 전용 audience와 갱신도 필요하다.
이 초안은 이를 구현하지 않으며 랜덤한 별도 AI API 키 하나를 Kubernetes Secret에 저장한다.
AI 호출용 키와 PVC 준비용 Kubernetes 토큰은 별개다. 자동 마운트는 끄고 PVC 준비 Job과
검사 initContainer에만 명시적으로 API 토큰을 마운트한다. 위에 설명한 PVC 전용 RBAC가 필요하다.

## 게이트웨이의 범위와 다음 단계

현재는 한 서비스용 단일 API 키 검증만 한다. 사용자별 발급 UI, 키 해시 DB, 만료,
일일 사용량, 분당 제한, 공유 대기열, Mattermost 인증/검색, MCP, OpenAI API 호환은 없다.
다른 백엔드에서도 native Ollama /api/chat 계약으로 호출할 수 있다.
초안은 인증·요청 제한을 시험하는 내부 PoC이며 직접 인터넷 노출용 서버가 아니다.
인증된 HTTPS Ingress/프록시에서 TLS, 연결/요청 속도 제한과 요청 시간 제한을 추가해야 한다.
CPU 모델 호출은 최대 180초 대기한다. 프록시 타임아웃과 조정한다.
클라이언트 단절/게이트웨이 타임아웃 후 모델 계산이 즉시 중지된다는 보장은 없다.
본문과 토큰 로그는 남기지 않는다. 운영용 메트릭/감사 로그는 후속 구현이다.

재사용용 키는 백엔드 전용이다. Vercel에서 쓰려면 인증된 외부 HTTPS 경로가 필요하며
서버의 인터넷 접속만으로 외부에서 접근 가능해지는 것은 아니다.
브라우저 직접 호출에는 공용 키를 배포하지 않는다. 별도 Mattermost 검색 API가
사용자 토큰을 검증한 뒤 이 게이트웨이를 호출하도록 한다(유효한 Mattermost 사용자 허용).
현재 카탈로그는 CORS/브라우저 접근과 외부 Ingress를 생성하지 않는다.

## 생성 및 로컬 검증

```bash
python deploy/ai_k8s/build_catalog.py --deploy-namespace ai
git diff --check
```

gateway.py 변경 후 카탈로그를 반드시 다시 생성하고 재배포/재시작한다.
ConfigMap 변경만으로 이미 실행 중인 Python 프로세스가 새 코드를 읽지는 않는다.
아코디언 등록/렌더링, 이미지 pull, PVC, Secret, CPU 추론 및 실제 네트워크 검증은 별도 필요하다.

참고: https://docs.ollama.com/docker
https://kubernetes.io/docs/reference/kubectl/generated/kubectl_create/kubectl_create_token/

생성기는 --deploy-namespace를 필수로 받는다. proc에 암묵적으로 배포하는 기본값을 제거했다.
기존 proc 리소스는 자동 이동/삭제되지 않는다. ai로 새 배포하면 PVC와 Secret도 별도로 준비되므로
토큰과 모델 저장소가 proc과 달라진다. 중복 AI가 자원을 예약할 수 있으므로 전환 시 기존 배포를 확인한다.
