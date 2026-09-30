"""Generate Accordion Catalog YAML using only Python's standard library."""
import json
from pathlib import Path

ROOT = Path(__file__).parent
NAME = "{{{.CATALOG.NAME}}}"
def value(key):
    return "{{.values." + key + "}}"

defaults = {"ollamaImage": "ollama/ollama:0.34.2", "gatewayImage": "python:3.12-slim",
            "model": "qwen3:8b", "pvcName": "ai-models", "tokenSecret": "ai-api-token",
            "cpuRequest": "1", "cpuLimit": "3", "memoryRequest": "7Gi", "memoryLimit": "9Gi"}
labels = {"app": NAME}
env = [{"name": "MODEL_NAME", "value": value("model")}]
bootstrap = '''set -eu
ollama serve &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT INT TERM
n=0
until ollama list >/dev/null 2>&1; do
  n=$((n+1)); [ "$n" -lt 60 ] || exit 1
  sleep 2
done
ollama pull "$MODEL_NAME"
kill "$server_pid"
wait "$server_pid" || true
trap - EXIT INT TERM
'''
ollama_env = env + [{"name": k, "value": v} for k, v in {
    "OLLAMA_HOST": "127.0.0.1:11434", "OLLAMA_MODELS": "/models",
    "OLLAMA_NO_CLOUD": "1", "OLLAMA_NUM_PARALLEL": "1",
    "OLLAMA_MAX_LOADED_MODELS": "1", "OLLAMA_MAX_QUEUE": "1",
    "OLLAMA_CONTEXT_LENGTH": "4096"}.items()]
model_mount = [{"name": "models", "mountPath": "/models"}]
model_resources = {"requests": {"cpu": value("cpuRequest"), "memory": value("memoryRequest")},
                   "limits": {"cpu": value("cpuLimit"), "memory": value("memoryLimit")}}
resources = [
    {"apiVersion": "v1", "kind": "ConfigMap", "metadata": {"name": NAME + "-gateway"},
     "data": {"gateway.py": (ROOT / "gateway.py").read_text(encoding="utf-8")}},
    {"apiVersion": "apps/v1", "kind": "Deployment", "metadata": {"name": NAME},
     "spec": {"replicas": 1, "strategy": {"type": "Recreate"},
              "selector": {"matchLabels": labels}, "template": {"metadata": {"labels": labels},
              "spec": {"automountServiceAccountToken": False, "terminationGracePeriodSeconds": 200,
                       "initContainers": [{"name": "prepare-model", "image": value("ollamaImage"),
                         "command": ["/bin/sh", "-c", bootstrap], "env": ollama_env,
                         "resources": model_resources, "volumeMounts": model_mount}],
                       "containers": [
                           {"name": "ollama", "image": value("ollamaImage"),
                            "args": ["serve"], "env": ollama_env, "resources": model_resources,
                            "volumeMounts": model_mount,
                            "readinessProbe": {"exec": {"command": ["ollama", "list"]},
                                               "periodSeconds": 10, "timeoutSeconds": 5}},
                           {"name": "gateway", "image": value("gatewayImage"),
                            "command": ["python", "-B", "/app/gateway.py"], "env": env,
                            "ports": [{"name": "http", "containerPort": 8080}],
                            "securityContext": {"runAsNonRoot": True, "runAsUser": 10001,
                                "allowPrivilegeEscalation": False, "readOnlyRootFilesystem": True,
                                "capabilities": {"drop": ["ALL"]}},
                            "resources": {"requests": {"cpu": "100m", "memory": "64Mi"},
                                          "limits": {"cpu": "500m", "memory": "256Mi"}},
                            "volumeMounts": [{"name": "code", "mountPath": "/app", "readOnly": True},
                                             {"name": "auth", "mountPath": "/auth", "readOnly": True}],
                            "readinessProbe": {"httpGet": {"path": "/readyz", "port": "http"},
                                               "timeoutSeconds": 5, "periodSeconds": 10},
                            "livenessProbe": {"httpGet": {"path": "/healthz", "port": "http"},
                                              "initialDelaySeconds": 10, "timeoutSeconds": 3}}],
                       "volumes": [{"name": "models", "persistentVolumeClaim": {"claimName": value("pvcName")}},
                                   {"name": "code", "configMap": {"name": NAME + "-gateway"}},
                                   {"name": "auth", "secret": {"secretName": value("tokenSecret"),
                                      "items": [{"key": "token", "path": "token"}]}}]}}}},
    {"apiVersion": "v1", "kind": "Service", "metadata": {"name": NAME},
     "spec": {"type": "ClusterIP", "selector": labels,
              "ports": [{"name": "http", "port": 8080, "targetPort": "http"}]}}
]
titles = ["Ollama 이미지", "게이트웨이 Python 이미지", "모델명", "기존 모델 PVC", "기존 API 토큰 Secret",
          "CPU 요청", "CPU 제한", "메모리 요청", "메모리 제한"]
properties = {}
for index, ((key, default), title) in enumerate(zip(defaults.items(), titles)):
    properties[key] = {"type": "string", "default": default, "minLength": 1,
                       "x-ui-displayName": title, "x-ui-basic-option": True, "x-ui-order": index + 1}
schema = {"type": "object", "required": list(defaults), "properties": properties}
def yaml_lines(obj, indent=0):
    """Emit block YAML for our JSON-compatible resource objects."""
    pad = " " * indent
    entries = obj.items() if isinstance(obj, dict) else enumerate(obj)
    for key, item in entries:
        prefix = pad + (str(key) + ":" if isinstance(obj, dict) else "-")
        if isinstance(item, (dict, list)) and item:
            yield prefix
            yield from yaml_lines(item, indent + 2)
        elif isinstance(item, str) and "\n" in item:
            yield prefix + " |" + ("" if item.endswith("\n") else "-")
            for line in item.rstrip("\n").split("\n"):
                yield " " * (indent + 2) + line
        else:
            yield prefix + " " + json.dumps(item, ensure_ascii=False)


from catalog_storage import add_storage
catalog_defaults = dict(defaults, storageClass="accordion-storage", storageSize="20Gi", storageRevision="2")
for key, title in [
    ("storageClass", "StorageClass (실제 이름 필수)"),
    ("storageSize", "PVC 최소 용량"),
    ("storageRevision", "스토리지 작업 버전 (숫자, 재실행 시 증가)")]:
    schema["properties"][key] = {"type": "string", "default": catalog_defaults[key], "minLength": 1,
                                 "x-ui-displayName": title, "x-ui-basic-option": True}
schema["properties"]["pvcName"]["x-ui-displayName"] = "모델 PVC 이름 (없으면 생성)"
schema["properties"]["tokenSecret"]["x-ui-displayName"] = "API 토큰 Secret 이름 (없으면 생성)"
schema["required"] = list(catalog_defaults)
catalog_resources = add_storage(resources, NAME, value)
spec = "\n---\n".join("\n".join(yaml_lines(r)) for r in catalog_resources)
header = '''apiVersion: cicd.accordions.co.kr/v1beta1
kind: ClusterCatalogTemplate
metadata:
  name: ai-ollama-810d1
  labels:
    packageName: ai-ollama
    version: "3.1.0"
  annotations:
    accordions.co.kr/description: "CPU Ollama + Bearer gateway. PVC and token Secret created if absent, existing resources preserved. Single replica."
    accordions.co.kr/summary: "AI / Ollama"
    ui.accordions.co.kr/category: ai
spec:
  deployStrategy:
    defaultPolicy: Apply
    image:
      archiveCount: 5
      registryName: user-registry
    clusters:
      - name: localcluster
        namespaces: []
  resourceValues:
    - name: ai-ollama
      values: '''
output = header + json.dumps(catalog_defaults) + "\n  template:\n    resources:\n      - name: ai-ollama\n        policy: Apply\n        spec: |\n"
output += "\n".join("          " + line for line in spec.splitlines())
output += "\n        valueschema: " + json.dumps(schema, ensure_ascii=False)
output += "\n"
if __name__ == "__main__":
    import argparse
    import re
    parser = argparse.ArgumentParser()
    parser.add_argument("--deploy-namespace", required=True, help="Actual workload destination; must match the namespace selected in Accordion")
    args = parser.parse_args()
    for namespace in (args.deploy_namespace,):
        if namespace is not None and (len(namespace) > 63 or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?", namespace)):
            parser.error("namespace must be a Kubernetes DNS label of at most 63 characters")
    rendered_output = output.replace("namespaces: []", "namespaces: " + json.dumps([args.deploy_namespace]))
    (ROOT / "ollama-catalog.yaml").write_text(rendered_output, encoding="utf-8")
    print("Generated ollama-catalog.yaml")
