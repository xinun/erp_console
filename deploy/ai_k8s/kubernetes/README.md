# 일반 Kubernetes 배포

Accordion CRD 없이 `kubectl`로 배포하는 버전이다. 카탈로그와 같은 Ollama + Bearer
게이트웨이를 한 Pod로 실행한다. namespace는 `ai`, Deployment/Service 이름은
`ai-ollama`이다. 기존 Accordion 배포와 별도로 자원을 사용하므로 중복 실행 여부를 확인한다.
이 매니페스트는 내부 PoC용이며 실제 클러스터에서는 미검증이다.

## 1. 파일과 클러스터 확인

이 폴더의 namespace.yaml, pvc.yaml, ollama.yaml을 kubectl 사용 가능한 서버로 복사하고
해당 폴더에서 아래 명령을 실행한다. CRD나 Python은 배포 서버에 필요하지 않다.

```bash
kubectl config current-context
kubectl get nodes
kubectl get storageclass
kubectl apply -f namespace.yaml
```

`pvc.yaml`은 20Gi RWO를 요청한다. 기본 StorageClass가 없다면 `spec.storageClassName`에
실제 StorageClass 이름을 추가하거나 관리자가 준비한 PV에 맞게 수정한다.
예상 메모리 요청은 Pod 합계 7Gi+64Mi, CPU 2100m이다. 기존 requests와 taint를 확인한다.

## 2. 모델 저장소와 API 키 생성

```bash
kubectl apply -f pvc.yaml
umask 077
openssl rand -hex 32 > ai-token.txt
kubectl -n ai create secret generic ai-api-token --from-file=token=ai-token.txt
```

기존 Secret이 있으면 덮어쓰지 않고 기존 키를 사용할지 먼저 결정한다. `ai-token.txt`는
비밀 파일이므로 Git/채팅에 올리지 않는다. 암호 관리 도구에 보관한 뒤 임시 파일을 삭제한다.
Kubernetes ServiceAccount 토큰이 아닌 별도의 앱 API 키다.
PVC가 WaitForFirstConsumer이면 Pod 배치 전 Pending은 정상일 수 있다.

## 3. 검증과 배포

```bash
kubectl apply --dry-run=server -f ollama.yaml
kubectl apply -f ollama.yaml
kubectl -n ai get pods,pvc,svc
kubectl -n ai logs deployment/ai-ollama -c prepare-model -f
kubectl -n ai rollout status deployment/ai-ollama --timeout=20m
```

최초에 약 5.2GB 모델을 다운로드한다. 인터넷/레지스트리 속도에 따라 시간이 달라진다.
다운로드 오류는 initContainer 로그, Pending은 `kubectl describe pod`에서 확인한다.
StorageClass/PV/PVC 접근 모드와 노드 자원에 따라 배치 가능한 노드가 달라진다.
이미지 기본값은 `ollama/ollama:0.34.2`, `python:3.12-slim`이다. 이미지 pull과 CPU 추론은
현장에서 확인해야 한다. 운영 전 검증한 image digest로 고정한다.

## 4. API 호출 확인

```bash
kubectl -n ai port-forward svc/ai-ollama 18080:8080
```

다른 터미널에서:

```bash
curl http://127.0.0.1:18080/readyz
AI_TOKEN="$(cat ai-token.txt)"
curl http://127.0.0.1:18080/api/chat \
  -H "Authorization: Bearer ${AI_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"한국어로 짧게 인사해줘."}]}'
unset AI_TOKEN
```

토큰 없이 POST하면 401, 관리 API는 404, 이미 생성 중이면 429가 정상이다.
클러스터 내 백엔드 주소는 `http://ai-ollama.ai.svc:8080`이다.
Service는 ClusterIP이며 외부 노출, TLS, CORS를 설정하지 않는다. 외부 연결은 별도
HTTPS 프록시와 제한 정책이 필요하다. 공용 키를 웹 브라우저에 넣지 않는다.

## 모델 변경과 재생성

저장소에서 아래처럼 JSON 설정 파일을 만들고 생성한다. 배포 서버에서 생성할 필요는 없다.

```json
{"model":"qwen3:4b","memoryRequest":"5Gi","memoryLimit":"7Gi"}
```

```bash
python -B deploy/ai_k8s/build_kubernetes.py --values my-values.json --storage-class 실제스토리지클래스
```

`--namespace`, `--name`, `--storage-size`, `--output`도 지정할 수 있다.
생성 시 출력 폴더의 YAML 3개를 덮어쓴다. 직접 수정했다면 재생성 전에 변경을 보존한다.
변경한 ollama.yaml을 다시 apply하면 모델 환경변수 변경으로 Pod가 교체되고 새 모델을 준비한다.
한 replica/Recreate이므로 교체 중 중단된다. 예전 모델 파일은 PVC에 남는다.
게이트웨이 코드(ConfigMap)만 변경한 경우에는 추가로 rollout restart가 필요하다.
PVC의 StorageClass는 생성 후 단순 변경할 수 없고 용량 확장도 스토리지 지원 여부를 확인한다.

## 중지·제거

```bash
kubectl -n ai scale deployment/ai-ollama --replicas=0
```

앱만 제거하려면 `kubectl delete -f ollama.yaml`을 사용한다. PVC와 Secret은 남는다.
namespace/PVC 삭제는 모델 데이터 삭제를 유발할 수 있으므로 일괄 삭제하지 않는다.

단일 API 키/텍스트 채팅만 지원하며 사용자별 키 관리 UI, Mattermost 검색, 모델 분산은
포함하지 않는다. 기타 게이트웨이 제한은 [상위 안내](../README.md)를 참고한다.
