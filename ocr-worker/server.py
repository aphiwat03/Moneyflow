"""Local CPU-only HTTP microservice wrapping OpenThai2.1-OCR-Text-20261118 (v2.1.4).

Processes slip images strictly in memory and binds only to 127.0.0.1.
"""

from __future__ import annotations

from email.parser import BytesParser
from email.policy import default as email_policy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
import sys
import threading
import time
from typing import Any

from PIL import Image, ImageOps

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
HOST = os.environ.get("OCR_HOST", "127.0.0.1")
PORT = int(os.environ.get("OCR_PORT", "8001"))
THREADS = max(1, int(os.environ.get("OCR_THREADS", "1")))
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"

if str(MODEL_DIR) not in sys.path:
    sys.path.insert(0, str(MODEL_DIR))

from runtime.line_engine import LineOCR  # noqa: E402


def _load_ocr_engine() -> LineOCR:
    if not MODEL_DIR.exists():
        raise RuntimeError(f"Model directory not found: {MODEL_DIR}")
    return LineOCR(str(MODEL_DIR), threads=THREADS)


def _extract_image_bytes(content_type: str, body: bytes) -> bytes:
    lowered = content_type.lower()
    if "multipart/form-data" in lowered:
        raw_mime = f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8") + body
        msg = BytesParser(policy=email_policy).parsebytes(raw_mime)
        for part in msg.iter_parts():
            disp_name = part.get_param("name", header="content-disposition")
            part_type = (part.get_content_type() or "").lower()
            if disp_name in ("file", "image") or part_type.startswith("image/"):
                payload = part.get_payload(decode=True)
                if payload:
                    return payload
        raise ValueError("Missing 'file' image part in multipart body.")
    return body


def _normalize_lines(result: Any) -> tuple[str, list[dict[str, Any]]]:
    if not isinstance(result, dict):
        return str(result or ""), []
    text = str(result.get("text") or "")
    raw_lines = result.get("lines") or []
    lines: list[dict[str, Any]] = []
    for item in raw_lines:
        if not isinstance(item, dict):
            continue
        lines.append(
            {
                "text": str(item.get("text") or ""),
                "confidence": float(item.get("confidence") or 0.0),
                "row": item.get("row"),
                "box": item.get("box"),
            }
        )
    return text, lines


class _OcrRuntime:
    def __init__(self) -> None:
        self.engine = _load_ocr_engine()
        self.lock = threading.Lock()

    def recognize(self, image_bytes: bytes) -> dict[str, Any]:
        started = time.perf_counter()
        with Image.open(io.BytesIO(image_bytes)) as img:
            normalized = ImageOps.exif_transpose(img).convert("RGB")
            with self.lock:
                result = self.engine.read(normalized)

        text, lines = _normalize_lines(result)
        duration_ms = round((time.perf_counter() - started) * 1000)
        return {
            "provider": "local",
            "model": "OpenThai2.1-OCR-Text-20261118",
            "revision": "v2.1.4",
            "text": text,
            "lines": lines,
            "durationMs": duration_ms,
        }


def make_handler(runtime: _OcrRuntime):
    class OcrRequestHandler(BaseHTTPRequestHandler):
        server_version = "MoneyFlowOpenThaiOCR/2.1.4"

        def log_message(self, format: str, *args: Any) -> None:
            # Avoid logging sensitive file metadata; emit concise operational logs only.
            sys.stderr.write(f"[ocr-worker] {format % args}\n")

        def _send_json(self, status_code: int, payload: dict[str, Any]) -> None:
            encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(encoded)

        def do_GET(self) -> None:
            if self.path.split("?", 1)[0] == "/health":
                self._send_json(
                    200,
                    {
                        "status": "ok",
                        "model": "OpenThai2.1-OCR-Text-20261118",
                        "revision": "v2.1.4",
                        "threads": THREADS,
                        "ready": True,
                    },
                )
                return
            self._send_json(404, {"error": "Not found"})

        def do_POST(self) -> None:
            if self.path.split("?", 1)[0] != "/ocr":
                self._send_json(404, {"error": "Not found"})
                return

            try:
                content_length = int(self.headers.get("Content-Length") or "0")
            except ValueError:
                self._send_json(400, {"error": "Invalid Content-Length header"})
                return

            if content_length <= 0:
                self._send_json(400, {"error": "Empty request body"})
                return
            if content_length > MAX_IMAGE_BYTES + 65536:
                self._send_json(413, {"error": "Payload exceeds 5 MB limit"})
                return

            raw_body = self.rfile.read(content_length)
            content_type = self.headers.get("Content-Type") or "application/octet-stream"

            try:
                image_bytes = _extract_image_bytes(content_type, raw_body)
            except ValueError as exc:
                self._send_json(400, {"error": str(exc)})
                return

            if len(image_bytes) == 0:
                self._send_json(400, {"error": "Empty image payload"})
                return
            if len(image_bytes) > MAX_IMAGE_BYTES:
                self._send_json(413, {"error": "Image exceeds 5 MB limit"})
                return

            try:
                response = runtime.recognize(image_bytes)
            except Exception as exc:  # noqa: BLE001
                self._send_json(422, {"error": f"Failed to decode or read slip image: {exc}"})
                return

            self._send_json(200, response)

    return OcrRequestHandler


def main() -> int:
    print(f"[ocr-worker] Loading OpenThai2.1-OCR-Text-20261118 v2.1.4 from {MODEL_DIR} ...")
    runtime = _OcrRuntime()
    server = ThreadingHTTPServer((HOST, PORT), make_handler(runtime))
    print(f"[ocr-worker] Listening on http://{HOST}:{PORT} (threads={THREADS})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[ocr-worker] Shutting down...")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
