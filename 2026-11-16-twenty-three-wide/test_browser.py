"""Headless checks for Twenty-Three Wide: the real bits, the semiprime wraps,
the decoded numbers, paint mode and the transmit states.

Run: python3 test_browser.py   (needs Playwright + Chromium, verification only)
"""
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1100})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto((HERE / 'index.html').as_uri())
        page.wait_for_selector('#grid')

        # As received: the 23-wide wrap, 397 ones, 1,679 cells.
        s = page.evaluate('Arecibo.getState()')
        assert (s['stride'], s['rows'], s['bits']) == (23, 73, 1679), s
        assert s['ones'] == 397, s
        assert (s['phase'], s['sent']) == ('idle', 0), s

        # The feed renders every bit, 23 lines of 73 characters.
        feed = page.locator('#feed').inner_text().replace('\n', '')
        assert len(feed) == 1679 and feed.count('1') == 397, (len(feed), feed.count('1'))

        # The wrong prime factor gives the slab; other widths run ragged.
        page.click('.snap[data-stride="73"]')
        s = page.evaluate('Arecibo.getState()')
        assert (s['stride'], s['rows']) == (73, 23), s
        assert 'slab' in page.locator('#factor').inner_text().lower()
        page.locator('#stride').evaluate('el => { el.value = 40; el.dispatchEvent(new Event("input")); }')
        s = page.evaluate('Arecibo.getState()')
        assert (s['stride'], s['rows']) == (40, 42), s  # ceil(1679/40) = 42 ragged rows
        assert 'ragged' in page.locator('#factor').inner_text()
        page.click('.snap[data-stride="23"]')
        assert page.evaluate('Arecibo.getState()')['stride'] == 23

        # Decoded numbers: the four self-calibrated figures hidden in the bits.
        decoded = page.evaluate('''() => {
            const g = Arecibo._bits2d();
            // base pairs: cols 10-11, rows 26-41, right column first, top-down
            let bp = 0n;
            for (let r = 26; r <= 41; r++) bp = (bp << 1n) | BigInt(g[r][11]);
            for (let r = 26; r <= 41; r++) bp = (bp << 1n) | BigInt(g[r][10]);
            // population: rows 48-53, cols 17-22, LSB upper-left
            let pop = 0n;
            for (let r = 48; r <= 53; r++) for (let c = 17; c <= 22; c++)
                pop |= BigInt(g[r][c]) << BigInt((r - 48) * 6 + (c - 17));
            // height: row 50, cols 2-5, MSB first
            let h = 0; for (let c = 2; c <= 5; c++) h = h * 2 + g[50][c];
            // dish: rows 71-72, cols 7-12, top row first
            let d = 0; for (let r = 71; r <= 72; r++) for (let c = 7; c <= 12; c++) d = d * 2 + g[r][c];
            return { bp: bp.toString(), pop: pop.toString(), h, d };
        }''')
        assert decoded['bp'] == '4294441822', decoded
        assert decoded['pop'] == '4292853750', decoded
        assert decoded['h'] == 14 and decoded['d'] == 2430, decoded

        # Sections: exactly seven picks, selecting one highlights it.
        assert page.locator('.pick').count() == 7
        page.locator('.pick[data-key="human"] button').click()
        s = page.evaluate('Arecibo.getState()')
        assert s['section'] == 4, s
        assert '1,764' in page.locator('#detail').inner_text()
        page.locator('.pick[data-key="human"] button').click()
        assert page.evaluate('Arecibo.getState()')['section'] is None

        # Colorize toggles without breaking anything.
        page.click('#colorize')
        assert page.evaluate('Arecibo.getState()')['colorize'] is True
        page.click('#colorize')

        # Paint mode flips exactly one bit; reset restores all 397.
        page.click('#paint')
        target = page.evaluate('''() => {
            const g = document.querySelector("#grid").getBoundingClientRect();
            const geo = Arecibo._geom();
            return { x: g.left + geo.pad + 6.5 * geo.cell, y: g.top + geo.pad + 0.5 * geo.cell };
        }''')  # row 0, col 6 — a 1 bit (number 4's top digit)
        page.mouse.click(target['x'], target['y'])
        s = page.evaluate('Arecibo.getState()')
        assert (s['ones'], s['edited']) == (396, True), s
        assert not page.locator('#reset').is_hidden()
        page.click('#reset')
        s = page.evaluate('Arecibo.getState()')
        assert (s['ones'], s['edited']) == (397, False), s
        page.click('#paint')

        # Transmit at x100: the tape fills, then the flight phase waits at the
        # skip button; arrival names the year.
        page.click('#speeds .chip[data-speed="100"]')
        page.click('#run')
        page.wait_for_function('Arecibo.getState().phase === "flight"', timeout=15000)
        s = page.evaluate('Arecibo.getState()')
        assert s['sent'] == 1679, s
        assert not page.locator('#skip').is_hidden()
        page.click('#skip')
        s = page.evaluate('Arecibo.getState()')
        assert s['phase'] == 'arrived' and s['arrivalYear'] == 26974, s
        assert '26,974' in page.locator('#tx-line').inner_text()

        # At x1 the airtime stat tracks bits sent; switching speed mid-run resets.
        page.click('#speeds .chip[data-speed="1"]')
        page.click('#run')
        page.wait_for_function('Arecibo.getState().sent >= 40', timeout=15000)
        s = page.evaluate('Arecibo.getState()')
        shown = float(page.locator('#st-air').inner_text().replace(' s', ''))
        assert math.isclose(s['sent'] / 10, shown, abs_tol=0.35), (s['sent'], shown)
        page.click('#speeds .chip[data-speed="100"]')  # mid-flight speed change resets
        s = page.evaluate('Arecibo.getState()')
        assert (s['phase'], s['sent']) == ('idle', 0), s

        # The canvas actually painted something sensible at 23 wide.
        w = page.evaluate('document.querySelector("#grid").width')
        h = page.evaluate('document.querySelector("#grid").height')
        assert w > 100 and h > 300, (w, h)

        assert not errors, errors
        browser.close()
    print('Twenty-Three Wide checks passed')


if __name__ == '__main__':
    main()
