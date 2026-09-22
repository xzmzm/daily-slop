"""Exercise actual browser controls, touch, print pixels and exported PNGs."""
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import struct
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


def check(page, expression):
    page.wait_for_function(expression)


def main():
    output = Path(tempfile.mkdtemp(prefix='ink-register-checks-'))
    errors, failed_requests, external = [], [], []
    with serve() as port, sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width':1440, 'height':1080}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('requestfailed', lambda request: failed_requests.append(request.url))
        page.on('request', lambda request: external.append(request.url) if not request.url.startswith(f'http://127.0.0.1:{port}/') else None)
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/', wait_until='networkidle')
        check(page, '!!window.inkRegister')
        page.screenshot(path=str(output/'desktop.png'), full_page=True)
        initial = page.locator('#print').evaluate('(c)=>c.toDataURL()')
        page.get_by_role('button', name='Ink A', exact=True).click()
        check(page, "inkRegister.getState().view === 'a'")
        assert initial != page.locator('#print').evaluate('(c)=>c.toDataURL()')
        page.get_by_role('button', name='Ink B', exact=True).click()
        check(page, "inkRegister.getState().view === 'b'")
        page.get_by_role('button', name='Overprint', exact=True).click()
        page.locator('#align').click()
        check(page, 'inkRegister.getState().x === 0 && inkRegister.getState().y === 0 && inkRegister.getState().rotation === 0')
        page.locator('#print').focus()
        page.keyboard.press('Shift+ArrowRight')
        page.keyboard.press('ArrowUp')
        check(page, 'inkRegister.getState().x === 5 && inkRegister.getState().y === -.2')
        box = page.locator('#print').bounding_box()
        page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
        page.mouse.down()
        page.mouse.move(box['x'] + box['width']/2 + 35, box['y'] + box['height']/2 + 20, steps=10)
        page.mouse.up()
        check(page, 'inkRegister.getState().x > 10 && inkRegister.getState().y > 3')
        for design in ['sun', 'bloom', 'tide']:
            page.locator(f'[data-design="{design}"]').click()
            for palette in range(3):
                page.locator(f'[data-palette="{palette}"]').click()
                check(page, f"inkRegister.getState().design === '{design}' && inkRegister.getState().palette === {palette}")
        page.locator('#grain').uncheck()
        page.locator('#marks').uncheck()
        page.locator('#align').click()
        # Validate a solid sun/mountain intersection against the stated color model.
        page.locator('[data-design="sun"]').click()
        page.locator('[data-palette="0"]').click()
        check(page, "inkRegister.getState().design === 'sun'")
        page.wait_for_timeout(60)
        pixels = page.evaluate("""() => {
          const ctx = document.querySelector('#print').getContext('2d');
          return { pixel: [...ctx.getImageData(405,305,1,1).data], expected: InkCore.multiply(InkCore.paper,InkCore.palettes[0].a,InkCore.palettes[0].b) };
        }""")
        expected = [int(pixels['expected'][i:i+2],16) for i in (1,3,5)]
        assert all(abs(a-b) <= 1 for a,b in zip(pixels['pixel'][:3],expected)), pixels
        with page.expect_download() as pending:
            page.locator('#export').click()
        path = output/pending.value.suggested_filename
        pending.value.save_as(path)
        assert struct.unpack('>II', path.read_bytes()[16:24]) == (1800, 2200)
        assert path.stat().st_size > 10000
        page.screenshot(path=str(output/'finished-print.png'),full_page=True)
        for width in [320,390,768,1280,1920]:
            page.set_viewport_size({'width':width,'height':900})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        page.set_viewport_size({'width':1280,'height':800})
        for selector in ['.controls','.workbench']:
            box = page.locator(selector).bounding_box()
            assert box['y'] + box['height'] <= 800, selector
        page.screenshot(path=str(output/'short-desktop.png'))
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(output/'mobile.png'),full_page=True)
        # New touch context, independent from the mouse state above.
        touch = browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
        mobile = touch.new_page()
        mobile.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/')
        check(mobile, '!!window.inkRegister')
        bounds = mobile.locator('#print').bounding_box()
        x,y = bounds['x']+bounds['width']/2, bounds['y']+bounds['height']/2
        session = touch.new_cdp_session(mobile)
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
        session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+20,'y':y+20}]})
        session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        check(mobile, 'inkRegister.getState().x > 8 && inkRegister.getState().y > 5')
        # The whole app also works when opened directly, without a server.
        page.goto((PROJECT/'index.html').as_uri())
        check(page, '!!window.inkRegister')
        browser.close()
    assert not errors, errors
    assert not failed_requests, failed_requests
    assert not [url for url in external if not url.startswith('file:')], external
    print('PASS: HTTP + file, 3 compositions × 3 palettes, separation, mouse/touch/keyboard, overlap pixels, PNG export, 320–1920 px layout; no page errors.')
    print('Evidence:', output)


if __name__ == '__main__':
    main()
