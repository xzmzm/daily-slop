"""Shared capture helpers. --inline renders the same assets without any network."""
from __future__ import annotations
import functools
import http.server
import os
import shutil
import threading
from contextlib import contextmanager
from pathlib import Path

PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT.parent

@contextmanager
def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *_args):
            pass
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        yield server.server_port
    finally:
        server.shutdown()
        server.server_close()

def launch(playwright):
    executable = os.environ.get('BROWSER_EXECUTABLE')
    # Prefer Playwright's matching revision; explicitly select system Chrome only
    # when requested (useful in offline containers with a preinstalled browser).
    return playwright.chromium.launch(**({'executable_path': executable} if executable else {}))

def load_page(page, port: int | None = None, inline: bool = False):
    if not inline:
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/', wait_until='networkidle')
    else:
        html = (PROJECT/'index.html').read_text(encoding='utf-8')
        html = html.replace('<link rel="stylesheet" href="style.css">', '')
        for name in ('core.js', 'app.js'):
            html = html.replace(f'<script defer src="{name}"></script>', '')
        page.set_content(html)
        page.add_style_tag(content=(PROJECT/'style.css').read_text(encoding='utf-8'))
        for name in ('core.js', 'app.js'):
            page.add_script_tag(content=(PROJECT/name).read_text(encoding='utf-8'))
    page.wait_for_selector('#display[data-ready="true"]')
