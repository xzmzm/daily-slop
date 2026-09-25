"""Drive the real page: presets, impact choreography, statistics, layouts."""
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import tempfile
import threading

from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT.parent


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@contextmanager
def serve():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    assert server.server_port != 8000
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_port
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def state(page, expr):
    return page.evaluate(f'(() => {{ const s = dart.getState(); return {expr}; }})()')


def main():
    output = Path(tempfile.mkdtemp(prefix='dart-checks-'))
    errors, external = [], []
    with serve() as port:
      with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1660, 'height': 1100})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: external.append(r.url) if not r.url.startswith((f'http://127.0.0.1:{port}/', 'data:')) else None)
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/', wait_until='networkidle')
        page.wait_for_function('!!window.dart')
        page.evaluate('dart.setAutoplay(false)')

        # Idle: predicted stats for the real DART preset, ghost orbit visible.
        page.evaluate('dart.fastForward(20)')
        s = state(page, 's')
        assert s['phase'] == 'idle' and not s['launched'], s
        assert abs(s['stats']['dTmin'] + 33.0) < 0.25, s['stats']
        assert abs(s['stats']['dvMmS'] - 2.81) < 0.06, s['stats']
        assert 'predicted' in page.inner_text('#statMode')
        page.screenshot(path=str(output / 'idle.png'))

        # Launch: approach, impact, aftermath — measured numbers animate in.
        page.evaluate('dart.launch()')
        mid = state(page, 's.phase')
        assert mid == 'approach', mid
        page.evaluate('dart.fastForward(2.0)')
        assert state(page, 's.phase') == 'approach'
        page.evaluate('dart.fastForward(2.6)')  # 4.6 s > 4.2 s approach → impact
        assert state(page, 's.phase') == 'aftermath'
        page.evaluate('dart.fastForward(3.0)')
        s = state(page, 's.stats')
        assert abs(s['dTmin'] + 33.0) < 0.25, s
        assert abs(s['driftH4d'] - 4.6) < 0.15, s
        assert 'measured' in page.inner_text('#statMode')
        assert 'RESET' in page.inner_text('#launch')
        page.screenshot(path=str(output / 'aftermath.png'))
        page.evaluate('dart.fastForward(10)')  # sweep finishes, lightcurve settles
        page.screenshot(path=str(output / 'lightcurve.png'))

        # Presets rewire the sliders; reset happens automatically.
        page.evaluate('dart.apply("splat")')
        assert state(page, 's.phase') == 'idle'
        s = state(page, 's.stats')
        assert abs(s['dTmin'] + 9.5) < 0.6, s
        page.evaluate('dart.apply("glance")')
        s = state(page, 's.stats')
        assert abs(s['dTmin'] + 23.6) < 0.6, s  # cos 45° × 33 min
        page.evaluate('dart.set("theta", 60); dart.set("beta", 5)')
        assert state(page, 's.stats')['dTmin'] < -20

        # Free sliders: extreme corner stays physical and renders.
        page.evaluate('dart.apply("real"); dart.launch()')
        page.evaluate('dart.fastForward(12)')
        assert state(page, 's.phase') == 'aftermath'

        # Direct file:// load works too (no server dependency).
        page2 = browser.new_page(viewport={'width': 1200, 'height': 900})
        page2.on('pageerror', lambda e: errors.append('file:// ' + str(e)))
        page2.goto((PROJECT / 'index.html').as_uri())
        page2.wait_for_function('!!window.dart')
        page2.evaluate('dart.apply("real"); dart.launch(); dart.fastForward(9)')
        assert state(page2, 's.phase') == 'aftermath'
        browser.close()

        # Responsive widths must not throw.
        browser = p.chromium.launch(headless=True)
        for width in (320, 768, 1920):
            page3 = browser.new_page(viewport={'width': width, 'height': 1000})
            page3.on('pageerror', lambda e: errors.append(f'{width}px ' + str(e)))
            page3.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/', wait_until='networkidle')
            page3.evaluate('dart.setAutoplay(false); dart.fastForward(1)')
            page3.screenshot(path=str(output / f'w{width}.png'))
            page3.close()
        browser.close()

    assert not errors, errors
    assert not external, external
    print('browser checks passed — artifacts in', output)


if __name__ == '__main__':
    main()
