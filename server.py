#!/usr/bin/env python3
"""Local-only server for Credit Card Tracker PWA.

- Serves static files from repo root (index.html, src/, public/ ...)
- Exposes JSON APIs that read the *private* Google Sheet via ez-google token on this host.

Security model:
- Bind to 127.0.0.1 only.
- Access via SSH tunnel from your laptop.

APIs:
- GET /api/unpaid  -> rows from Dashboard!P10:AC

"""

from __future__ import annotations

import argparse
import json
import os
import posixpath
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

WORKDIR = "/home/ubuntu/.openclaw/workspace/skills/ez-google"
SHEET_ID = "1unqcw12V48VJaKA83QKu0E2ZLbuvh1wrfKmBzLtG7fM"
TAB = "Dashboard"
RANGE_UNPAID = "P10:AC200"  # includes header row

REPO_ROOT = Path(__file__).resolve().parent


def run(cmd: list[str]) -> str:
    p = subprocess.run(cmd, cwd=WORKDIR, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip() or f"Command failed: {' '.join(cmd)}")
    return p.stdout


def sheets_get_tsv(rng: str) -> list[list[str]]:
    out = run(["uv", "run", "scripts/sheets.py", "get", SHEET_ID, f"{TAB}!{rng}"]).strip("\n")
    if not out or out.startswith("No data found"):
        return []
    return [line.split("\t") for line in out.splitlines()]


def rows_to_json(rows: list[list[str]]) -> dict:
    if not rows:
        return {"cols": [], "rows": []}
    cols = rows[0]
    data = rows[1:]
    # Trim trailing empty columns per row to keep payload small
    trimmed = []
    for r in data:
        rr = r[:]
        while rr and (rr[-1] == "" or rr[-1] is None):
            rr.pop()
        if not rr or rr[0] == "":
            continue
        trimmed.append(rr)
    return {"cols": cols, "rows": trimmed}


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        # Serve files from repo root
        path = urlparse(path).path
        path = posixpath.normpath(path)
        words = [w for w in path.split("/") if w and w not in {"..", "."}]
        p = REPO_ROOT
        for w in words:
            p = p / w
        return str(p)

    def _send_json(self, obj: dict, status: int = 200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith("/api/unpaid"):
            try:
                rows = sheets_get_tsv(RANGE_UNPAID)
                self._send_json(rows_to_json(rows))
            except Exception as e:
                self._send_json({"error": str(e)}, status=500)
            return

        # Default: static
        return super().do_GET()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bind", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8000")))
    args = ap.parse_args()

    httpd = ThreadingHTTPServer((args.bind, args.port), Handler)
    print(f"Serving on http://{args.bind}:{args.port} (repo: {REPO_ROOT})")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
