"""Accordion storage preparation resources; no PVC is owned by the catalog."""
import copy
from pathlib import Path


def add_storage(resources, name, value):
    result = copy.deepcopy(resources)
    cm_name = name + "-storage-" + value("storageRevision")
    config = {"apiVersion": "v1", "kind": "ConfigMap", "metadata": {"name": cm_name},
              "data": {"prepare_pvc.py": Path(__file__).with_name("prepare_pvc.py").read_text(encoding="utf-8")}}
    env = [{"name": k, "value": value(v)} for k, v in
           [("PVC_NAME", "pvcName"), ("STORAGE_CLASS", "storageClass"), ("STORAGE_SIZE", "storageSize"), ("TOKEN_SECRET", "tokenSecret")]]
    security = {"runAsNonRoot": True, "runAsUser": 10001, "allowPrivilegeEscalation": False,
                "readOnlyRootFilesystem": True, "capabilities": {"drop": ["ALL"]}}
    token_path = "/var/run/secrets/kubernetes.io/serviceaccount"
    volumes = [
        {"name": "storage-code", "configMap": {"name": cm_name}},
        {"name": "storage-auth", "projected": {"sources": [
            {"serviceAccountToken": {"path": "token", "expirationSeconds": 3600}},
            {"configMap": {"name": "kube-root-ca.crt", "items": [{"key": "ca.crt", "path": "ca.crt"}]}},
            {"downwardAPI": {"items": [{"path": "namespace", "fieldRef": {"fieldPath": "metadata.namespace"}}]}}
        ]}}]
    container = {"name": "prepare-pvc", "image": value("gatewayImage"),
                 "command": ["python", "-B", "/storage/prepare_pvc.py"], "env": env,
                 "securityContext": security,
                 "resources": {"requests": {"cpu": "50m", "memory": "32Mi"}, "limits": {"cpu": "250m", "memory": "64Mi"}},
                 "volumeMounts": [{"name": "storage-code", "mountPath": "/storage", "readOnly": True},
                                  {"name": "storage-auth", "mountPath": token_path, "readOnly": True}]}
    extra = [config]
    for suffix, create in [("storage", True), ("check", False)]:
        account = name + "-" + suffix
        rules = [{"apiGroups": [""], "resources": ["persistentvolumeclaims"],
                  "resourceNames": [value("pvcName")], "verbs": ["get"]}]
        if create:
            rules.append({"apiGroups": [""], "resources": ["persistentvolumeclaims"], "verbs": ["create"]})
            rules.extend([
                {"apiGroups": [""], "resources": ["secrets"], "resourceNames": [value("tokenSecret")], "verbs": ["get"]},
                {"apiGroups": [""], "resources": ["secrets"], "verbs": ["create"]}])
        extra.extend([
            {"apiVersion": "v1", "kind": "ServiceAccount", "metadata": {"name": account}, "automountServiceAccountToken": False},
            {"apiVersion": "rbac.authorization.k8s.io/v1", "kind": "Role", "metadata": {"name": account}, "rules": rules},
            {"apiVersion": "rbac.authorization.k8s.io/v1", "kind": "RoleBinding", "metadata": {"name": account},
             "roleRef": {"apiGroup": "rbac.authorization.k8s.io", "kind": "Role", "name": account},
             "subjects": [{"kind": "ServiceAccount", "name": account}]}
        ])
    extra.append({"apiVersion": "batch/v1", "kind": "Job", "metadata": {"name": name + "-pvc-" + value("storageRevision")},
                  "spec": {"backoffLimit": 6, "activeDeadlineSeconds": 600,
                           "template": {"spec": {"serviceAccountName": name + "-storage", "automountServiceAccountToken": False,
                                                  "restartPolicy": "Never", "containers": [container], "volumes": volumes}}}})
    pod = result[1]["spec"]["template"]["spec"]
    pod["serviceAccountName"] = name + "-check"
    pod["volumes"].extend(copy.deepcopy(volumes))
    check = copy.deepcopy(container)
    check["name"] = "check-pvc"
    check["command"].append("--check-only")
    pod["initContainers"].insert(0, check)
    return extra + result
