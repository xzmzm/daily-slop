"""Drive the real page: presets, statistics, echo gate, lockout and layouts."""
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
    return page.evaluate(f'(() => {{ const s = tat1.getState(); return {expr}; }})()')


def main():
    output = Path(tempfile.mkdtemp(prefix='tat1-checks-'))
    errors, external = [], []
    with serve() as port, sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1660, 'height': 1100})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: external.append(r.url) if not r.url.startswith((f'http://127.0.0.1:{port}/', 'data:')) else None)
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/', wait_until='networkidle')
        page.wait_for_function('!!window.tat1')
        page.evaluate('tat1.setAutoplay(false)')

        # TASI 1960 default: 72 calls ride 37 circuits, silence recycled.
        page.evaluate('tat1.fastForward(60)')
        s = state(page, 's.stats')
        assert (s['conversations'], s['circuits']) == (72, 37), s
        assert abs(s['gain'] - 72 / 37) < 1e-9
        assert s['speechOnCircuits'] > 0.55, s
        assert s['clippedPct'] < 0.005, s
        assert 'Clean' in page.inner_text('#verdict'), page.inner_text('#verdict')
        assert page.inner_text('#stGain').startswith('1.95')
        page.screenshot(path=str(output / 'tasi1960.png'))

        # Opening day 1956: no TASI, 35 calls each own one of 36 circuits.
        page.evaluate('tat1.apply("day1")')
        page.evaluate('tat1.fastForward(60)')
        s = state(page, 's.stats')
        assert s['blocked'] == 0 and s['clipCount'] == 0, s
        assert s['speechOnCircuits'] < 0.45, s  # most of every circuit is silence
        assert 'silence' in page.inner_text('#verdict')
        page.screenshot(path=str(output / 'day1.png'))

        # Same cable without TASI but oversubscribed: calls simply not placed.
        page.evaluate('tat1.set("conversations", 72)')
        s = state(page, 's.stats')
        assert s['blocked'] == 36, s
        assert not page.locator('#stBlockedRow').is_hidden()
        page.screenshot(path=str(output / 'blocked.png'))

        # Rush hour: competition clips word-ends.
        page.evaluate('tat1.apply("rush")')
        page.evaluate('tat1.fastForward(40)')
        s = state(page, 's.stats')
        assert s['clippedPct'] > 0.05 and s['clipCount'] > 20, s
        assert 'Rush hour' in page.inner_text('#verdict')
        page.screenshot(path=str(output / 'rush.png'))

        # The echo: a shout comes home after a full round trip.
        page.evaluate('tat1.apply("tasi1960")')
        page.evaluate('tat1.fastForward(2)')
        assert page.evaluate('tat1.shout(1)') is True
        for _ in range(34):
            page.evaluate('tat1.tick(0.3)')  # 10.2 s > 9 s crossing
        assert 'Echo detached at Oban' in state(page, 's.echoStatus')
        for _ in range(34):
            page.evaluate('tat1.tick(0.3)')  # echo lands back at Clarenville
        assert 'Echo heard back at Clarenville' in state(page, 's.echoStatus')

        # Suppressor armed: no echo at all, and lockout while speech is inbound.
        page.evaluate('tat1.set("suppressor", true)')
        assert state(page, 's.suppressor') is True
        page.evaluate('tat1.shout(1)')
        for _ in range(34):
            page.evaluate('tat1.tick(0.3)')
        assert 'never launches the echo' in state(page, 's.echoStatus')
        assert page.evaluate('tat1.shout(-1)') is False  # gated while eastbound runs
        assert 'Lockout' in state(page, 's.echoStatus')
        page.screenshot(path=str(output / 'lockout.png'))

        # Sliders and the TASI switch are wired both ways.
        page.evaluate('tat1.set("suppressor", false)')
        page.locator('#conversations').evaluate('(el, v) => { el.value = v; el.dispatchEvent(new Event("input", {bubbles: true})); }', '8')
        page.locator('#circuits').evaluate('(el, v) => { el.value = v; el.dispatchEvent(new Event("input", {bubbles: true})); }', '5')
        page.locator('#activity').evaluate('(el, v) => { el.value = v; el.dispatchEvent(new Event("input", {bubbles: true})); }', '50')
        assert state(page, 's.stats.conversations') == 8
        assert state(page, 's.stats.circuits') == 5
        assert page.inner_text('#conversationsOut') == '8 calls'
        assert page.inner_text('#activityOut') == '50% talking'
        page.click('[data-preset="tasi1960"]')
        assert page.locator('[data-preset="tasi1960"]').get_attribute('class').find('active') >= 0

        # Layouts: no horizontal scrolling from phone to large desktop.
        for width in (320, 390, 768, 1024, 1440, 1920):
            page.set_viewport_size({'width': width, 'height': 900})
            page.wait_for_timeout(50)
            assert page.evaluate('document.documentElement.scrollWidth') <= width, width
            page.screenshot(path=str(output / f'w{width}.png'), full_page=True)

        # Autoplay resumes the live loop without errors.
        page.set_viewport_size({'width': 1660, 'height': 1100})
        page.evaluate('tat1.setAutoplay(true)')
        page.wait_for_timeout(700)
        assert state(page, 's.clock') > 0

        # Direct file load works too.
        local = browser.new_page()
        local.on('pageerror', lambda e: errors.append(str(e)))
        local.goto((PROJECT / 'index.html').as_uri())
        local.wait_for_function('!!window.tat1')
        browser.close()
    assert not errors, errors
    assert not external, external
    print('browser checks passed; screenshots in', output)


if __name__ == '__main__':
    main()
