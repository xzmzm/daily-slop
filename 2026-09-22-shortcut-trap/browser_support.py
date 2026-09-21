"""Small reusable real-browser harness; port 8000 is never used."""
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import shutil
import threading
PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT.parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
@contextmanager
def serve():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    if server.server_port == 8000:
        server.server_close()
        server = ThreadingHTTPServer(('127.0.0.1', 8765), partial(Quiet, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try: yield server.server_port
    finally: server.shutdown(); server.server_close(); thread.join(timeout=5)
def launch(p):
    path = os.environ.get('CHROME_PATH')
    if not path and not Path(p.chromium.executable_path).exists():
        path = shutil.which('chromium') or shutil.which('google-chrome')
    return p.chromium.launch(headless=True, executable_path=path, args=['--no-sandbox','--disable-dev-shm-usage'])
def load(page, port, suffix='?capture=1'):
    if os.environ.get('SHORTCUT_INLINE_PREVIEW') == '1':
        # Inject only our own local assets when HTTP navigation is unavailable.
        # Full HTTP, URL-state and clipboard checks still run in CI.
        html = (PROJECT / 'index.html').read_text()
        html = html.replace('<link rel="stylesheet" href="style.css">', '')
        for name in ['model.js', 'app.js']:
            html = html.replace(f'<script defer src="{name}"></script>', '')
        page.set_content(html)
        page.add_style_tag(content=(PROJECT / 'style.css').read_text())
        page.evaluate('window.__SHORTCUT_CAPTURE__ = true')
        for name in ['model.js', 'app.js']:
            page.add_script_tag(content=(PROJECT / name).read_text())
    else:
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/{suffix}', wait_until='networkidle')
    page.wait_for_function('window.shortcutTrap !== undefined')
