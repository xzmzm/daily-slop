"""Small local HTTP/browser helpers; no server on reserved port 8000."""
from contextlib import contextmanager
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import threading
import shutil
PROJECT=Path(__file__).resolve().parent
ROOT=PROJECT.parent
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
@contextmanager
def serve():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
    if server.server_port==8000:
        server.server_close();raise RuntimeError('Reserved port selected')
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try: yield server.server_port
    finally: server.shutdown();server.server_close();thread.join(timeout=3)
def launch(p):
    binary=shutil.which('chromium') or shutil.which('google-chrome')
    return p.chromium.launch(headless=True,executable_path=binary,args=['--no-sandbox','--disable-dev-shm-usage'])
def load(page,port,capture=True):
    import os
    if os.environ.get('ECHO_INLINE_PREVIEW')=='1':
        # Explicit local-only preview for sandboxes with HTTP navigation disabled.
        html=(PROJECT/'index.html').read_text().replace('<link rel="stylesheet" href="style.css">','')
        for name in ['core.js','app.js']: html=html.replace(f'<script defer src="{name}"></script>','')
        page.set_content(html)
        page.add_style_tag(content=(PROJECT/'style.css').read_text())
        page.evaluate('(v)=>window.__ECHO_CAPTURE__=v',capture)
        for name in ['core.js','app.js']: page.add_script_tag(content=(PROJECT/name).read_text())
        mode='in-memory-local-preview'
    else:
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/'+('?capture=1' if capture else ''),wait_until='networkidle')
        mode='http'
    page.wait_for_function('window.echoRoom !== undefined')
    return mode
