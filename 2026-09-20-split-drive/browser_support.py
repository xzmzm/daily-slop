"""A loopback-only test server and a configurable Playwright browser."""
from __future__ import annotations
from contextlib import contextmanager
import functools
import http.server
import os
from pathlib import Path
import threading
PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT.parent
@contextmanager
def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *_): pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try: yield server.server_port
    finally: server.shutdown();server.server_close()
def launch(p):
    executable=os.environ.get('BROWSER_EXECUTABLE')
    return p.chromium.launch(**({'executable_path':executable} if executable else {}))
def load(page,port,capture=False):
    page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/'+('?capture=1' if capture else ''),wait_until='networkidle')
    page.wait_for_selector('#track-canvas[data-ready=true]')
