#!/usr/bin/env python3
"""Playwright behavior checks; development tooling, not an app dependency."""
import pathlib

from playwright.sync_api import sync_playwright

PROJECT_DIR = pathlib.Path(__file__).resolve().parent


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.goto((PROJECT_DIR / 'index.html').as_uri())
        page.wait_for_function('!!window.firebreak')
        page.evaluate('firebreak.useManualClock()')
        assert 'Firebreak' in page.title()

        # defaults: gale from the SW, 32 charges, the night not yet lit
        boot = page.evaluate('firebreak.getState()')
        assert boot['phase'] == 'ready'
        assert boot['windSpeed'] == 32
        assert boot['blastsLeft'] == 32
        assert boot['clockMin'] == page.evaluate('firebreakCore.START_MIN')
        assert page.locator('#ignite').is_enabled()

        # striking the match starts De Koven burning and the clock running
        assert page.evaluate('firebreak.ignite()') is True
        for _ in range(30):                       # 2 sim-minutes at 1x
            page.evaluate('firebreak.tick(1/15)')
        s = page.evaluate('firebreak.getState()')
        assert s['phase'] == 'burning'
        assert s['clockMin'] > boot['clockMin']
        assert s['destroyed'] >= 0

        # the wind bench answers live: chart and chips track the slider
        page.evaluate('firebreak.set({windSpeed: 10, windDir: 135})')
        s = page.evaluate('firebreak.getState()')
        assert s['windSpeed'] == 10
        assert s['emberCrossP'] < 0.35
        assert 'BLOCKS' in page.locator('#ember-reach').inner_text()
        assert '%' in page.locator('#ember-cross').inner_text()

        # blasting spends charges and shows on the map; rain ends the night
        r = page.evaluate('firebreak.blast(40, 10)')
        assert r['ok'] is True and r['cleared'] > 0
        assert page.evaluate('firebreak.getState()')['blasts'] == 1
        page.evaluate('firebreak.set({windSpeed: 34})')
        for _ in range(600):                      # let the fire do visible damage
            page.evaluate('firebreak.tick(1/15)')
            s = page.evaluate('firebreak.getState()')
            if s['phase'] != 'burning' or s['destroyed'] > 30:
                break
        assert s['destroyed'] > 20, s
        if s['phase'] != 'burning':
            # the city burned out before we got to it — relight a slower night
            page.evaluate('firebreak.reset()')
            page.evaluate('firebreak.set({windSpeed: 22})')
            page.evaluate('firebreak.ignite()')
            for _ in range(600):
                page.evaluate('firebreak.tick(1/15)')
                s = page.evaluate('firebreak.getState()')
                if s['destroyed'] > 20:
                    break
            assert s['phase'] == 'burning', s
        assert page.evaluate('firebreak.rainNow()') is True
        s = page.evaluate('firebreak.getState()')
        assert s['phase'] == 'ended' and s['rained'] is True
        assert page.locator('#verdict').is_visible()
        title = page.locator('#verdict-title').inner_text()
        assert title in ('THE CITY LIVES.', 'HALF OF CHICAGO.', 'CHICAGO BURNS.'), title

        # reset restores the intact city and a full powder keg
        page.evaluate('firebreak.reset()')
        s = page.evaluate('firebreak.getState()')
        assert s['phase'] == 'ready' and s['blastsLeft'] == 32 and s['destroyed'] == 0
        assert page.locator('#verdict').is_hidden()

        # UI buttons still drive the sim through real clicks
        page.click('#ignite')
        assert page.evaluate('firebreak.getState()')['phase'] == 'burning'
        page.click('#rain')
        assert page.evaluate('firebreak.getState()')['phase'] == 'ended'

        assert errors == []
        browser.close()
    print('browser checks passed')


if __name__ == '__main__':
    main()
