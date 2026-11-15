"""Headless checks for Sixteen Pins: timing math across packages and chores.

Run: python3 test_browser.py   (needs Playwright + Chromium, verification only)
"""
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
PERIOD_US = 1000 / 740


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto((HERE / 'index.html').as_uri())
        page.wait_for_selector('#bus canvas, #bus')

        # As built: 8 fetches x 8 periods = the datasheet cycle.
        s = page.evaluate('SixteenPins.getState()')
        assert (s['width'], s['chore']) == (4, 'add'), s
        assert (s['fetches'], s['periods']) == (8, 64), s
        assert math.isclose(s['microseconds'], 64 * PERIOD_US, rel_tol=1e-12), s
        assert math.isclose(s['addrShare'], 24 / 64), s

        # Wider fantasy packages shrink only the address chunks.
        for width, periods, addr_periods in [(8, 48, 16), (12, 40, 8), (16, 40, 8)]:
            page.click(f'.pkg[data-width="{width}"] button')
            s = page.evaluate('SixteenPins.getState()')
            assert (s['fetches'], s['periods']) == (8, periods), (width, s)
            assert math.isclose(s['addrShare'], addr_periods / periods), (width, s)

        # Chore sizes at the real 16-pin package.
        page.click('.pkg[data-width="4"] button')
        for chore, periods in [('mul', 112), ('scan', 144)]:
            page.click(f'.chore[data-chore="{chore}"] button')
            s = page.evaluate('SixteenPins.getState()')
            assert s['periods'] == periods, (chore, s)
        page.click('.chore[data-chore="add"] button')

        # The sweep ends on the full timeline and leaves the stats exact.
        page.click('#run')
        page.wait_for_function('!SixteenPins.getState().sweeping', timeout=15000)
        s = page.evaluate('SixteenPins.getState()')
        assert (s['revealed'], s['periods']) == (64, 64), s
        assert s['runCount'] == 1, s

        # Timeline, package and compare strip all rendered something.
        assert page.locator('#compare .bar-row').count() == 4
        assert page.locator('.pkg.on strong').inner_text() == '16 pins'
        assert 'fantasy' not in page.evaluate('document.querySelector("#package svg").textContent')
        page.click('.pkg[data-width="8"] button')
        assert 'fantasy lead' in page.evaluate('document.querySelector("#package svg").textContent')
        box = page.locator('.timeline-wrap').bounding_box()
        assert box['width'] > 300, box

        assert not errors, errors
        browser.close()
    print('Sixteen Pins checks passed')


if __name__ == '__main__':
    main()
