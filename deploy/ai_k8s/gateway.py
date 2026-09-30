"""Small, single-replica, server-to-server Ollama gateway. No third-party packages."""
import hashlib
import hmac
import json
import os
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODEL = os.environ.get("MODEL_NAME", "qwen3:8b")
TOKEN_FILE = os.environ.get("TOKEN_FILE", "/auth/token")
UPSTREAM = "http://127.0.0.1:11434"
SLOT = threading.BoundedSemaphore(1)
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def valid_token(header):
    try:
        with open(TOKEN_FILE, encoding="utf-8") as token_file:
            expected = token_file.read().strip()
    except OSError:
        return False
    if len(expected) < 32 or not header.startswith("Bearer "):
        return False
    return hmac.compare_digest(hashlib.sha256(header[7:].encode()).digest(),
                               hashlib.sha256(expected.encode()).digest())


def payload_for(body):
    messages = body.get("messages") if isinstance(body, dict) else None
    if not isinstance(messages, list) or not 1 <= len(messages) <= 32:
        raise ValueError("messages required")
    clean = []
    for message in messages:
        if not isinstance(message, dict) or message.get("role") not in ("system", "user", "assistant"):
            raise ValueError("invalid role")
        content = message.get("content")
        if not isinstance(content, str):
            raise ValueError("text only")
        clean.append({"role": message["role"], "content": content})
    if sum(len(m["content"]) for m in clean) > 6000:
        raise ValueError("input too long")
    return {"model": MODEL, "messages": clean, "stream": False, "think": False,
            "options": {"num_ctx": 4096, "num_predict": 512}, "keep_alive": "5m"}


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def log_message(self, *_):
        pass

    def reply(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/healthz":
            return self.reply(200, {"status": "alive"})
        if self.path == "/readyz":
            try:
                with OPENER.open(UPSTREAM + "/api/tags", timeout=3) as response:
                    models = json.load(response).get("models", [])
                ready = any(m.get("name") == MODEL for m in models)
                with open(TOKEN_FILE, encoding="utf-8") as token_file:
                    ready = ready and len(token_file.read().strip()) >= 32
            except Exception:
                ready = False
            return self.reply(200 if ready else 503, {"ready": ready})
        self.reply(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/api/chat":
            return self.reply(404, {"error": "not_found"})
        if not valid_token(self.headers.get("Authorization", "")):
            return self.reply(401, {"error": "unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if self.headers.get("Transfer-Encoding") or not 0 < length <= 32768:
                return self.reply(413, {"error": "invalid_body_size"})
            payload = payload_for(json.loads(self.rfile.read(length)))
        except (ValueError, UnicodeError):
            return self.reply(400, {"error": "invalid_request"})
        if not SLOT.acquire(blocking=False):
            return self.reply(429, {"error": "busy", "retryAfterSeconds": 10})
        try:
            request = urllib.request.Request(UPSTREAM + "/api/chat",
                data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
            with OPENER.open(request, timeout=180) as response:
                data = response.read(1048577)
                if len(data) > 1048576:
                    raise ValueError("upstream too large")
            self.reply(200, json.loads(data))
        except Exception:
            self.reply(502, {"error": "model_unavailable"})
        finally:
            SLOT.release()


class BoundedServer(ThreadingHTTPServer):
    connections = threading.BoundedSemaphore(16)

    def process_request(self, request, client_address):
        if not self.connections.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.connections.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.connections.release()


if __name__ == "__main__":
    BoundedServer(("0.0.0.0", 8080), Handler).serve_forever()
