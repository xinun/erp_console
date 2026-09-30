"""Create an absent claim, or validate without mutating an existing claim."""
import json
import base64
import secrets
import os
import re
import ssl
import sys
from decimal import Decimal
from pathlib import Path
from urllib import request, error, parse


def quantity(text):
    match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)([EPTGMK]i|[EPTGMk]|[eE][+-]?[0-9]+)?", text)
    if not match:
        raise ValueError("Unsupported storage quantity")
    number, suffix = match.groups()
    factor = {"": 1, **{p + "i": 1024 ** n for n, p in enumerate("KMGTPE", 1)},
              **{p: 1000 ** n for n, p in enumerate("kMGTPE", 1)}}
    if suffix and re.fullmatch(r"[eE][+-]?[0-9]+", suffix):
        multiplier = Decimal(10) ** int(suffix[1:])
    else:
        multiplier = factor[suffix or ""]
    return Decimal(number) * multiplier


def validate(pvc, storage_class, size):
    spec = pvc["spec"]
    if pvc.get("metadata", {}).get("deletionTimestamp"):
        raise ValueError("PVC is being deleted")
    if pvc.get("status", {}).get("phase") == "Lost":
        raise ValueError("PVC is Lost")
    if spec.get("storageClassName") != storage_class:
        raise ValueError("PVC StorageClass does not match")
    if spec.get("volumeMode", "Filesystem") != "Filesystem":
        raise ValueError("PVC must use Filesystem volumeMode")
    if "ReadWriteOnce" not in spec.get("accessModes", []):
        raise ValueError("PVC must support ReadWriteOnce")
    if quantity(spec["resources"]["requests"]["storage"]) < quantity(size):
        raise ValueError("PVC is smaller than requested; resize separately")


def ensure(api, name, storage_class, size, create=True):
    path = "/" + parse.quote(name, safe="")
    try:
        pvc = api("GET", path)
    except error.HTTPError as exc:
        if exc.code != 404 or not create:
            raise
        body = {"apiVersion": "v1", "kind": "PersistentVolumeClaim", "metadata": {"name": name},
                "spec": {"accessModes": ["ReadWriteOnce"], "volumeMode": "Filesystem",
                         "storageClassName": storage_class,
                         "resources": {"requests": {"storage": size}}}}
        try:
            pvc = api("POST", "", body)
        except error.HTTPError as conflict:
            if conflict.code != 409:
                raise
            pvc = api("GET", path)
    validate(pvc, storage_class, size)


def main():
    name, storage_class, size = (os.environ[k] for k in ("PVC_NAME", "STORAGE_CLASS", "STORAGE_SIZE"))
    for setting in (name, storage_class):
        if len(setting) > 253 or not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", setting):
            raise ValueError("PVC_NAME and STORAGE_CLASS must be valid names; replace CHANGE-ME")
    if quantity(size) <= 0:
        raise ValueError("Storage size must be positive")
    auth = Path("/var/run/secrets/kubernetes.io/serviceaccount")
    namespace = (auth / "namespace").read_text().strip()
    base = "https://kubernetes.default.svc/api/v1/namespaces/" + parse.quote(namespace, safe="")
    opener = request.build_opener(request.ProxyHandler({}), request.HTTPSHandler(context=ssl.create_default_context(cafile=str(auth / "ca.crt"))))

    def api(method, path, body=None):
        req = request.Request(base + path, method=method, data=json.dumps(body).encode() if body else None,
                              headers={"Authorization": "Bearer " + (auth / "token").read_text().strip(),
                                       "Content-Type": "application/json"})
        with opener.open(req, timeout=20) as response:
            return json.load(response)

    ensure(lambda method, path, body=None: api(method, "/persistentvolumeclaims" + path, body),
           name, storage_class, size, create="--check-only" not in sys.argv)
    print("PVC checked successfully", flush=True)
    if "--check-only" not in sys.argv:
        ensure_secret(lambda method, path, body=None: api(method, "/secrets" + path, body), os.environ["TOKEN_SECRET"])
        print("API token Secret checked successfully (token not logged)", flush=True)


def ensure_secret(api, name):
    if len(name) > 253 or not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", name):
        raise ValueError("Invalid TOKEN_SECRET name")
    path = "/" + parse.quote(name, safe="")
    try:
        obj = api("GET", path)
    except error.HTTPError as exc:
        if exc.code != 404:
            raise
        token = secrets.token_hex(32)
        body = {"apiVersion": "v1", "kind": "Secret", "metadata": {"name": name}, "type": "Opaque",
                "data": {"token": base64.b64encode(token.encode()).decode()}}
        try:
            obj = api("POST", "", body)
        except error.HTTPError as conflict:
            if conflict.code != 409:
                raise
            obj = api("GET", path)
    if obj.get("metadata", {}).get("deletionTimestamp"):
        raise ValueError("Token Secret is being deleted")
    try:
        token = base64.b64decode(obj.get("data", {}).get("token", ""), validate=True).decode("utf-8").strip()
    except (ValueError, UnicodeError):
        raise ValueError("Existing Secret token is invalid; repair explicitly") from None
    if len(token) < 32 or not token.isascii() or any(ch.isspace() for ch in token):
        raise ValueError("Existing Secret needs a token of at least 32 ASCII characters without whitespace; not overwritten")


if __name__ == "__main__":
    try:
        main()
    except error.HTTPError as exc:
        print("Kubernetes API error: HTTP", exc.code, file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print("PVC preparation failed:", str(exc), file=sys.stderr)
        sys.exit(1)
