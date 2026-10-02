# 일반 Kubernetes 배포

최신 카탈로그와 동일한 공통 리소스에서 생성한다. Accordion CRD 없이 배포 가능하다.
namespace는 ai, 앱 이름은 ai-ollama, NodePort는 Kubernetes가 자동 할당한다.
파일은 namespace.yaml과 ollama.yaml 두 개다. PVC·Secret은 준비 Job이 자동 생성한다.
이전 pvc.yaml은 자동 생성 방식으로 통합하여 제거했다.

## 배포

실제 StorageClass가 accordion-storage인지 확인한다. 다르면 아래 생성 명령으로 바꾼다.
이미지 레지스트리 및 Ollama 모델 다운로드 경로에 배치 후보 노드가 접근할 수 있어야 한다.
Pod 요청은 CPU 1100m, 메모리 7Gi+64Mi이다. 노드 예약량/taint를 확인한다.
Role/RoleBinding 생성 권한이 필요하다.

```bash
kubectl config current-context
kubectl get nodes
kubectl get storageclass
kubectl get services -A
kubectl apply -f namespace.yaml
kubectl apply --dry-run=server -f ollama.yaml
kubectl apply -f ollama.yaml
kubectl -n ai get jobs,pvc,pods,svc
kubectl -n ai logs job/ai-ollama-pvc-2
kubectl -n ai logs deployment/ai-ollama -c prepare-model -f
kubectl -n ai rollout status deployment/ai-ollama --timeout=20m
```

기본 YAML은 nodePort 번호를 생략하여 자동 할당한다. --node-port로 고정할 경우 다른 Service와 포트가 겹치지 않아야 한다.
최초 PVC not found/Secret not found 이벤트는 준비 Job 완료 전 나타날 수 있다.
WaitForFirstConsumer에서는 Pod 스케줄링과 함께 볼륨을 할당하므로 먼저 PVC Bound를 기다리지 않는다.

## 사용

같은 클러스터에서는 http://ai-ollama.ai.svc:8080/api/chat을 사용한다.
VPN에서는 연결 가능한 노드 IP의 실제 할당된 NodePort로 접근한다. externalTrafficPolicy는 Cluster다.
NodePort는 HTTP이며 방화벽/VPN 경로가 허용되어야 한다. 인터넷 공개는 별도 HTTPS 구성이 필요하다.

```bash
AI_TOKEN="$(kubectl -n ai get secret ai-api-token -o jsonpath='{.data.token}' | base64 --decode)"
NODE_PORT="$(kubectl -n ai get svc ai-ollama -o jsonpath='{.spec.ports[0].nodePort}')"
curl --max-time 200 "http://<노드IP>:${NODE_PORT}/api/chat" \
  -H "Authorization: Bearer ${AI_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"한국어로 짧게 인사해줘."}]}'
unset AI_TOKEN NODE_PORT
```

관리자 터미널 대화:

```bash
kubectl -n ai exec -it deployment/ai-ollama -c ollama -- ollama run qwen3:8b
```

## 변경과 재배포

생성은 저장소에서 실행한다. 배포 서버에는 Python이 필요 없다.

```bash
python -B deploy/ai_k8s/build_kubernetes.py --namespace ai --name ai-ollama --storage-class 실제클래스
```

--values JSON으로 카탈로그와 같은 입력을 덮어쓸 수 있다. --storage-size, --output도 지원한다.
예: {"model":"qwen3:4b","memoryRequest":"5Gi","memoryLimit":"7Gi","storageRevision":"3"}
기존 PVC/Secret은 재배포 시 변경하지 않는다. 잘못된 기존 값은 오류로 처리한다.
준비 Job 설정/코드/이미지 변경, 실패 재시도, 삭제된 PVC/Secret 복구에는 storageRevision을 증가시킨다.
완료한 동일 Job은 apply만으로 재실행되지 않는다. 새 YAML 적용 후 초기화 상태를 확인한다.
게이트웨이 코드만 변경하면 rollout restart가 필요하다. Recreate 교체 중 서비스가 중단된다.
직접 YAML을 수정했다면 생성 전 보존한다. 생성은 두 YAML을 덮어쓴다.
별도 인스턴스는 namespace 또는 pvcName/tokenSecret을 분리하고 NodePort는 자동 할당된다. 고정이 필요하면 --node-port를 지정한다.

## 중지와 삭제

```bash
kubectl -n ai scale deployment/ai-ollama --replicas=0
kubectl delete -f ollama.yaml
```

앱 YAML에는 PVC/Secret이 포함되지 않고 Job이 ownerReferences 없이 생성하므로 위 삭제에는 남는다.
namespace/PVC/Secret 직접 삭제는 별개다. 준비 Job 계정은 지정 PVC/Secret get 및 namespace 내 create만
허용하며 수정/삭제 권한은 없다. AI 검사 계정은 PVC get만 허용한다.

로컬 생성·동등성 검사는 수행했으나 일반 Kubernetes에 대한 실제 배포/추론은 미검증이다.
기타 게이트웨이 제한은 [상위 안내](../README.md)를 따른다.

기존 Service 갱신 시 할당 포트는 일반적으로 유지되며 삭제 후 재생성 시 달라질 수 있다.
