"""Generate plain Kubernetes manifests from the same resources as the catalog."""
import argparse
import json
import re
from pathlib import Path
from build_catalog import NAME, catalog_defaults, catalog_resources, yaml_lines


def render(obj, name, values):
    if isinstance(obj, dict):
        return {k: render(v, name, values) for k, v in obj.items()}
    if isinstance(obj, list):
        return [render(v, name, values) for v in obj]
    if isinstance(obj, str):
        return re.sub(r"\{\{\.values\.(\w+)\}\}", lambda m: values[m[1]], obj.replace(NAME, name))
    return obj


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="ai-ollama")
    parser.add_argument("--namespace", default="ai")
    parser.add_argument("--values", type=Path, help="JSON overrides of catalog defaults")
    parser.add_argument("--storage-class", help="Override catalog StorageClass")
    parser.add_argument("--storage-size", help="Override catalog storage size")
    parser.add_argument("--node-port", type=int, default=30450)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "kubernetes")
    args = parser.parse_args()
    for name in (args.name, args.namespace):
        if len(name) > 50 or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?", name):
            parser.error("name/namespace must be DNS labels of at most 50 characters")
    values = dict(catalog_defaults)
    if args.values:
        overrides = json.loads(args.values.read_text(encoding="utf-8"))
        if not isinstance(overrides, dict) or any(k not in values or not isinstance(v, str) for k, v in overrides.items()):
            parser.error("values must contain known keys with string values")
        values.update(overrides)
    if args.storage_class is not None:
        values["storageClass"] = args.storage_class
    if args.storage_size is not None:
        values["storageSize"] = args.storage_size
    if not re.fullmatch(r"[1-9][0-9]{0,5}", values["storageRevision"]):
        parser.error("storageRevision must be a positive integer of at most six digits")
    if not 30000 <= args.node_port <= 32767:
        parser.error("node-port must be in the default Kubernetes range 30000-32767")
    rendered = render(catalog_resources, args.name, values)
    for resource in rendered:
        resource["metadata"]["namespace"] = args.namespace
        if resource["kind"] == "RoleBinding":
            for subject in resource["subjects"]:
                subject["namespace"] = args.namespace
        if resource["kind"] == "Service":
            resource["spec"]["ports"][0]["nodePort"] = args.node_port
    namespace = {"apiVersion": "v1", "kind": "Namespace", "metadata": {"name": args.namespace}}
    args.output.mkdir(parents=True, exist_ok=True)
    for filename, documents in [("namespace.yaml", [namespace]), ("ollama.yaml", rendered)]:
        content = "\n---\n".join("\n".join(yaml_lines(doc)) for doc in documents) + "\n"
        (args.output / filename).write_text(content, encoding="utf-8")
        print("Generated", args.output / filename)


if __name__ == "__main__":
    main()
