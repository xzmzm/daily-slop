"""Drive the real page: presets, sliders, steering modes, full flights and layouts."""
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
    return page.evaluate(f'(() => {{ const s = headway.getState(); return {expr}; }})()')


def set_range(page, selector, value):
    page.locator(selector).evaluate('(el, v) => { el.value = v; el.dispatchEvent(new Event("input", {bubbles: true})); }', str(value))


def main():
    output = Path(tempfile.mkdtemp(prefix='headway-checks-'))
    errors, external = [], []
    with serve() as port, sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: external.append(r.url) if not r.url.startswith((f'http://127.0.0.1:{port}/', 'data:')) else None)
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/', wait_until='networkidle')
        page.wait_for_function('!!window.headway')

        # Outbound: a 4 km/h tailwind gives 13 km/h and arrives in about 2 h 03 m.
        assert 'Élancourt in 2 h 03 m' in page.inner_text('#verdict'), page.inner_text('#verdict')
        assert page.inner_text('#gs') == '13.0 km/h'
        page.click('#fly')
        page.wait_for_function('headway.getState().ship.t > 0.1')
        assert page.inner_text('#fly') == 'Drop anchor'
        page.click('#fly')
        t = state(page, 's.ship.t'); page.wait_for_timeout(300)
        assert state(page, 's.ship.t') == t, 'pausing should stop the clock'
        page.evaluate('headway.fastForward(5)')
        result = state(page, 's.result')
        assert result and result['tone'] == 'good' and 'Landed at Élancourt' in result['text'], result
        assert abs(state(page, 's.ship.t') - 26.7 / 13) < 0.05
        assert page.inner_text('#fly') == 'Fly it again'
        page.screenshot(path=str(output / 'outbound.png'))

        # Homeward in a 12 km/h wind: impossible, and the flight proves it.
        page.click('[data-preset="home"]')
        assert "Can't be done" in page.inner_text('#verdict')
        assert page.inner_text('#crab') == '—' and page.inner_text('#eta') == 'never'
        assert page.locator('#cone').get_attribute('d').startswith('M0 0')
        page.evaluate('headway.fastForward(9)')
        result = state(page, 's.result')
        assert result and result['tone'] == 'bad', result
        page.screenshot(path=str(output / 'home.png'))

        # Drop the wind below airspeed: home becomes possible but slow.
        page.click('#reset')
        set_range(page, '#windSpeed', 6)
        assert state(page, 's.preset') is None
        assert page.locator('#cone').get_attribute('d') == ''
        verdict = page.inner_text('#verdict')
        assert 'past the 8-hour day' in verdict, verdict  # 26.7 km at 3 km/h
        set_range(page, '#windSpeed', 4)
        assert 'Étoile in 5 h 21 m' in page.inner_text('#verdict'), page.inner_text('#verdict')

        # Crosswind: crab angle and a track that still follows the line.
        page.click('[data-preset="cross"]')
        crab = int(page.inner_text('#crab').rstrip('°'))
        assert 45 < crab < 55, crab
        page.evaluate('headway.fastForward(1.5)')
        s = state(page, 's.ship')
        # Distance from the direct line stays near zero while crabbing.
        cross = abs(s['x'] * -10.0 - s['y'] * -24.8) / (24.8 ** 2 + 10 ** 2) ** .5
        assert cross < 0.05, cross

        # Manual heading into a crosswind drifts off the line.
        page.click('#reset')
        page.click('[data-steer="manual"]')
        assert not page.locator('#heading').is_disabled()
        set_range(page, '#heading', 248)
        page.evaluate('headway.fastForward(1)')
        s = state(page, 's.ship')
        cross = abs(s['x'] * -10.0 - s['y'] * -24.8) / (24.8 ** 2 + 10 ** 2) ** .5
        assert cross > 3, cross

        # No steam: pure balloon.
        page.click('[data-preset="calm"]')
        set_range(page, '#power', 0)
        assert 'The fire is out' in page.inner_text('#verdict')
        set_range(page, '#power', 0.4)
        assert page.inner_text('#powerOut') == '0.4 hp → 4.6 km/h'

        # Layouts: no horizontal scrolling from phone to large desktop.
        for width in (320, 390, 768, 1024, 1440, 1920):
            page.set_viewport_size({'width': width, 'height': 900})
            page.wait_for_timeout(50)
            assert page.evaluate('document.documentElement.scrollWidth') <= width, width
            page.screenshot(path=str(output / f'w{width}.png'), full_page=True)

        # Direct file load works too.
        local = browser.new_page()
        local.on('pageerror', lambda e: errors.append(str(e)))
        local.goto((PROJECT / 'index.html').as_uri())
        local.wait_for_function('!!window.headway')
        browser.close()
    assert not errors, errors
    assert not external, external
    print('browser checks passed; screenshots in', output)


if __name__ == '__main__':
    main()
