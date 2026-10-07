#!/usr/bin/env python3
"""Playwright behavior checks; development tooling, not an app dependency."""
import pathlib

from playwright.sync_api import sync_playwright

PROJECT_DIR = pathlib.Path(__file__).resolve().parent
def full_pass(page):
    """Tick in frame-sized steps from wherever the pass stands until the
    verdict hold begins, whatever the rAF loop did before the manual clock."""
    for _ in range(90):
        page.evaluate("scanLine.tick(1/15)")
        if page.evaluate("scanLine.getState().phase") == "hold":
            page.evaluate("scanLine.tick(1/15)")
            return
    raise AssertionError("sweep never completed")


def main():
    errors, requests = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('request', lambda r: requests.append(r.url))
        page.goto((PROJECT_DIR / 'index.html').as_uri())
        page.wait_for_function('!!window.scanLine')
        page.evaluate('scanLine.useManualClock()')
        assert 'Scan Line' in page.title()

        # Defaults: the classic example label, sweeping, normal speed. (The
        # rAF loop runs briefly before the manual clock takes over, so sweepX
        # may have moved a little from zero.)
        boot = page.evaluate('scanLine.getState()')
        boot.pop('sweepX')
        assert boot == {
            'digits': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 5],
            'flipped': False, 'smudges': [], 'playing': True, 'slow': False,
            'phase': 'sweep', 'sweepIndex': 0,
            'liveDigits': [], 'liveStage': 'quiet', 'result': None}
        assert page.locator('#verdict-status').inner_text() == 'AWAITING SWEEP'

        # A pass decodes digit by digit; mid-sweep the first half has resolved.
        # set() restarts the pass, so the tick count is deterministic.
        page.evaluate('scanLine.set({smudges: []})')
        page.evaluate('scanLine.tick(1.0)')
        mid = page.evaluate('scanLine.getState()')
        assert mid['phase'] == 'sweep' and 45 < mid['sweepX'] < 55, mid['sweepX']
        assert mid['liveDigits'] == [0, 1, 2, 3, 4], mid['liveDigits']
        assert page.locator('#verdict-status').inner_text() == 'AWAITING SWEEP'

        # Completing the pass accepts the label with the check digit agreed.
        full_pass(page)
        done = page.evaluate('scanLine.getState()')
        assert done['phase'] == 'hold'
        assert done['result']['ok'] is True
        assert done['result']['digits'] == [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 5]
        assert done['result']['direction'] == 'FWD'
        assert page.locator('#verdict-status').inner_text() == 'ACCEPTED'
        assert 'check digit 5 agrees' in page.locator('#verdict-hint').inner_text()
        assert page.locator('#direction-chip b').inner_text() == 'L→R'
        assert page.locator('#r11').inner_text() == '5'
        # The waveform must be painted: gold trace across the panel. (Rare
        # headless getImageData hiccups return empty once; redraw and retry.)
        gold = 0
        for _ in range(2):
            gold = page.evaluate("""() => {
                const c = document.getElementById('scan-canvas');
                const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
                let n = 0;
                for (let i = 0; i < d.length; i += 4)
                    if (d[i] === 233 && d[i+1] === 196 && d[i+2] === 106) n++;
                return n;
            }""")
            if gold > 3000:
                break
            page.evaluate('scanLine.tick(1/15)')
        assert gold > 3000, gold

        # An upside-down label still scans: parity tells the decoder to reverse.
        page.evaluate('scanLine.set({flipped: true})')
        full_pass(page)
        st = page.evaluate('scanLine.getState()')
        assert st['result']['ok'] is True and st['result']['direction'] == 'REV'
        assert st['result']['digits'] == [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 5]
        assert page.locator('#verdict-status').inner_text() == 'ACCEPTED'
        assert page.locator('#direction-chip b').inner_text() == 'R→L · UPSIDE DOWN'
        assert page.locator('#flip').get_attribute('aria-pressed') == 'true'

        # Ink in the quiet zone: the decoder refuses to sync at all.
        page.evaluate('scanLine.set({flipped: false, smudges: [{a: 5, b: 7}]})')
        full_pass(page)
        st = page.evaluate('scanLine.getState()')
        assert st['result']['ok'] is False
        assert st['result']['reason'] == 'QUIET ZONE VIOLATION'
        assert 'QUIET ZONE' in page.locator('#verdict-status').inner_text()

        # Ink across a digit block: an unreadable seven-module pattern.
        page.evaluate('scanLine.set({smudges: [{a: 24, b: 27}]})')
        full_pass(page)
        st = page.evaluate('scanLine.getState()')
        assert st['result']['ok'] is False
        assert st['result']['reason'] == 'UNREADABLE DIGIT'

        # A misprinted check digit parses, then fails the rule; the panel agrees.
        page.evaluate('scanLine.set({smudges: [], digits: [0,1,2,3,4,5,6,7,8,9,0,3]})')
        full_pass(page)
        st = page.evaluate('scanLine.getState()')
        assert st['result']['reason'] == 'CHECK DIGIT MISMATCH'
        assert st['result']['expected'] == 5 and st['result']['read'] == 3
        assert page.locator('#verdict-status').inner_text() == 'REJECTED — CHECK DIGIT MISMATCH'
        assert 'expect 5' in page.locator('#verdict-hint').inner_text()
        assert page.locator('#check-stamp').inner_text() == 'PRINTED 3 · SUMS EXPECT 5'
        assert 'check-stamp bad' in page.locator('#check-stamp').get_attribute('class')
        assert page.locator('#r11').get_attribute('class').find('bad') > 0

        # FIX CHECK DIGIT reprints the honest digit and the pass is accepted again.
        page.click('#fix-check')
        assert page.locator('#d11').input_value() == '5'
        assert page.locator('#check-stamp').inner_text() == 'CHECK DIGIT 5 — VALID'
        full_pass(page)
        assert page.evaluate('scanLine.getState().result')['ok'] is True

        # Editing a digit through the real input updates the encoder.
        page.fill('#d7', '1')
        page.evaluate('scanLine.set({})')  # no-op, but re-render
        digits = page.evaluate('scanLine.getState().digits')
        assert digits == [0, 1, 2, 3, 4, 5, 6, 1, 8, 9, 0, 5]
        # The printed check digit 5 no longer fits the tampered maker half.
        assert page.locator('#check-stamp').inner_text() == 'PRINTED 5 · SUMS EXPECT 1'
        full_pass(page)
        assert page.evaluate('scanLine.getState().result')['reason'] == 'CHECK DIGIT MISMATCH' 
        page.evaluate('scanLine.set({digits: [0,1,2,3,4,5,6,7,8,9,0,5]})')

        # Transport: pause freezes the laser; slow quarters the rate.
        page.click('#play')
        assert page.evaluate('scanLine.getState().playing') is False
        frozen = page.evaluate('scanLine.getState().sweepX')
        page.evaluate('scanLine.tick(1)')
        assert page.evaluate('scanLine.getState().sweepX') == frozen
        assert page.locator('#play').get_attribute('aria-pressed') == 'false'
        page.click('#play')
        page.click('#speed-slow')
        assert page.locator('#speed-slow').get_attribute('aria-pressed') == 'true'
        assert page.evaluate('scanLine.getState().slow') is True
        x0 = page.evaluate('scanLine.getState().sweepX')
        page.evaluate('scanLine.tick(1)')
        x1 = page.evaluate('scanLine.getState().sweepX')
        assert 14 < x1 - x0 < 24, (x0, x1)   # ~113/5.4 modules per second
        page.click('#speed-normal')

        # Guard against invalid patch input.
        before = page.evaluate('scanLine.getState().digits')
        page.evaluate('scanLine.set({digits: [9,9], smudges: "x", flipped: 3}); scanLine.tick(NaN); scanLine.tick(-1)')
        after = page.evaluate('scanLine.getState()')
        assert after['digits'] == before
        assert after['flipped'] is False

        # The 1952 bullseye: rings from the same modules, any ray angle.
        rings = page.evaluate('document.querySelectorAll("#bull-rings circle").length')
        assert rings == 113
        note0 = page.locator('#runs-note').inner_text()
        assert 'same at every angle' in note0
        page.fill('#angle', '217')
        page.dispatch_event('#angle', 'input')
        assert page.locator('#angle-value').inner_text() == '217°'
        assert 'θ = 217°' in page.locator('#runs-note').inner_text()
        ray = page.eval_on_selector('#bull-ray', 'el => [el.getAttribute("x2"), el.getAttribute("y2")].map(Number)')
        import math
        assert abs(ray[0] - (130 + math.cos(math.radians(217)) * 118)) < 0.01
        assert abs(ray[1] - (130 - math.sin(math.radians(217)) * 118)) < 0.01

        assert all(u.startswith('file://') for u in requests), requests

        # Narrow screens stay usable without horizontal scrolling.
        for width in [320, 390, 768]:
            mobile = browser.new_page(viewport={'width': width, 'height': 844})
            mobile.on('pageerror', lambda e: errors.append(str(e)))
            mobile.goto((PROJECT_DIR / 'index.html').as_uri())
            mobile.wait_for_function('!!window.scanLine')
            assert mobile.evaluate('document.documentElement.scrollWidth') <= width, width
            assert mobile.locator('#label-canvas').bounding_box()['width'] >= 230
            assert mobile.locator('#scan-canvas').bounding_box()['width'] >= 225
            mobile.evaluate('scanLine.useManualClock(); scanLine.set({playing:true})')
            full_pass(mobile)
            assert mobile.locator('#verdict-status').inner_text() == 'ACCEPTED'
            mobile.close()
        calm = browser.new_page(viewport={'width': 1200, 'height': 800}, reduced_motion='reduce')
        calm.on('pageerror', lambda e: errors.append(str(e)))
        calm.goto((PROJECT_DIR / 'index.html').as_uri())
        calm.wait_for_function('!!window.scanLine')
        assert not calm.evaluate('scanLine.getState().playing')
        assert 'Release the laser' in calm.locator('#play').inner_text()
        browser.close()
    assert not errors, errors
    print('browser checks passed:', len(requests),
          'local requests; sweep decode, flip, smudges, check digit, transport, bullseye, mobile')


if __name__ == '__main__':
    main()
