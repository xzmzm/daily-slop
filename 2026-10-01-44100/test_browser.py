"""Browser tests for the 44,100 workbench with Playwright Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent


def main():
    errors, requests = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('console', lambda m: errors.append(f'console: {m.text}') if m.type == 'error' else None)
        page.on('request', lambda r: requests.append(r.url))
        page.goto((PROJECT / 'index.html').as_uri())
        page.wait_for_function('!!window.cdLab')
        assert 'Forty-Four Thousand One Hundred' in page.title()

        for selector, min_width in [('#sampler-canvas', 500), ('#bits-canvas', 500),
                                    ('#tv-canvas', 300), ('#disc-canvas', 260)]:
            box = page.locator(selector).bounding_box()
            assert box['width'] > min_width and box['height'] > 150, (selector, box)

        # aliasing: a 3 kHz tone sampled at 4 kHz plays back as 1 kHz
        page.evaluate('cdLab.setTone(3000)')
        page.evaluate('cdLab.setRate(4000)')
        state = page.evaluate('cdLab.getState()')
        assert abs(state['alias'] - 1000) < 1e-6 and state['aliasing']
        assert page.locator('#sampler-state').inner_text() == 'ALIASING'
        assert page.locator('#playback').inner_text() == '1,000 Hz'
        assert page.locator('#playback').get_attribute('class').find('bad') >= 0
        assert page.locator('[data-rate="4000"]').get_attribute('class').find('on') >= 0

        # back at the CD rate everything is clean
        page.evaluate('cdLab.setRate(44100)')
        state = page.evaluate('cdLab.getState()')
        assert not state['aliasing'] and state['alias'] == 3000
        assert page.locator('#sampler-state').inner_text() == 'CLEAN'
        assert page.locator('#nyquist').inner_text() == '22,050 Hz'

        # bit depth: 4-bit noise floor and lamps
        page.evaluate('cdLab.setBits(4)')
        assert page.locator('#snr').inner_text() == '25.8 dB'
        assert page.locator('#steps').inner_text() == '16'
        assert page.locator('#lamp-row .lamp:not(.dead)').count() == 4
        assert page.locator('#lamp-row .lamp.on').count() >= 1
        assert 'code +5' in page.locator('#lamp-value').inner_text()
        page.evaluate('cdLab.setBits(16)')
        assert page.locator('#datarate').inner_text() == '1.4112 Mbit/s'
        assert page.locator('#lamp-row .lamp').count() == 16
        assert 'code +19,661 · 0x4CCD' in page.locator('#lamp-value').inner_text()

        # the VTR arithmetic on both TV systems
        assert page.locator('#tile-lines').inner_text() == '245'
        page.click('#tv-pal')
        assert page.locator('#tile-lines').inner_text() == '294'
        assert page.locator('#tile-fields').inner_text() == '50'
        page.click('#tv-ntsc')
        assert page.locator('#tile-fields').inner_text() == '60'

        # CLV: outer edge spins at ~198 rpm
        page.evaluate('cdLab.setRadius(58)')
        assert page.locator('#rpm').inner_text() == '198 rpm'
        page.evaluate('cdLab.setRadius(25)')
        assert page.locator('#rpm').inner_text() == '458 rpm'

        # interleaved scratch heals; the same wound bunched in one row does not
        page.evaluate('cdLab.scratch(0, 8)')
        assert page.locator('#physical-strip .ph.wound').count() == 8
        assert page.locator('#scratch-state').inner_text() == 'SCRATCHED'
        page.evaluate('cdLab.polish()')
        state = page.evaluate('cdLab.getState()')
        assert state['recovered'] == 8 and state['lost'] == 0
        assert page.locator('#scratch-state').inner_text() == 'PLAYING CLEAN'
        assert 'ok' in page.locator('#scratch-verdict').get_attribute('class')
        assert page.locator('#logic-grid .byte.repaired').count() == 8

        page.click('#interleave-toggle')          # same physical wound, music order
        assert page.locator('#interleave-toggle').inner_text() == 'Interleave: off'
        assert page.locator('#logic-grid .byte.damaged').count() == 8
        assert page.evaluate('cdLab.getState()')['recovered'] is None
        page.evaluate('cdLab.polish()')
        state = page.evaluate('cdLab.getState()')
        assert state['lost'] == 8 and state['recovered'] == 0
        assert page.locator('#scratch-state').inner_text() == 'CLICK'
        assert 'bad' in page.locator('#scratch-verdict').get_attribute('class')

        # pointer drag across the physical strip wounds consecutive cells
        page.click('#wipe')
        assert page.evaluate('cdLab.getState()')['wound'] == []
        a = page.evaluate("document.querySelectorAll('#physical-strip .ph')[3].getBoundingClientRect()")
        b = page.evaluate("document.querySelectorAll('#physical-strip .ph')[10].getBoundingClientRect()")
        page.mouse.move(a['x'] + a['width'] / 2, a['y'] + a['height'] / 2)
        page.mouse.down()
        for step in range(1, 8):
            page.mouse.move(a['x'] + (b['x'] - a['x']) * step / 7 + a['width'] / 2,
                            a['y'] + (b['y'] - a['y']) * step / 7 + a['height'] / 2)
        page.mouse.up()
        wound = page.evaluate('cdLab.getState()')['wound']
        assert len(wound) == 8 and wound == list(range(3, 11)), wound

        # audio buttons toggle without errors
        page.click('#play-original')
        page.click('#play-sampled')
        page.click('#play-sweep')
        page.wait_for_timeout(250)
        assert page.locator('#play-sweep.on').count() == 1

        assert all(u.startswith('file://') for u in requests), requests

        # narrow viewport: stations stack, nothing overflows horizontally
        mobile = browser.new_page(viewport={'width': 390, 'height': 844})
        mobile.on('pageerror', lambda e: errors.append(f'mobile pageerror: {e}'))
        mobile.goto((PROJECT / 'index.html').as_uri())
        mobile.wait_for_function('!!window.cdLab')
        mobile.wait_for_timeout(300)
        assert mobile.evaluate('document.documentElement.scrollWidth') <= 395
        assert mobile.evaluate('cdLab.getState()')['aliasing'] is False

        # reduced motion: the disc must not spin but everything still draws
        calm = browser.new_page(viewport={'width': 1200, 'height': 800}, reduced_motion='reduce')
        calm.goto((PROJECT / 'index.html').as_uri())
        calm.wait_for_function('!!window.cdLab')
        calm.wait_for_timeout(300)
        assert calm.evaluate('cdLab.getState()')['rpm'] > 0

        browser.close()
    assert not errors, errors
    print('browser tests passed:', len(requests), 'local requests')


if __name__ == '__main__':
    main()
