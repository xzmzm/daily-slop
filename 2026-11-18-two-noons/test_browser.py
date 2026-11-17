"""Headless checks for Two Noons: the 4-minutes-per-degree offsets, the reset
at each zone's standard noon, the two noons east of a meridian and the lost
minutes west of one, the pinned town, and the real-time play loop.

Run: python3 test_browser.py   (needs Playwright + Chromium, verification only)
"""
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent


def state(page):
    return page.evaluate('Noons.getState()')


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto((HERE / 'index.html').as_uri())
        page.wait_for_selector('#map .town')
        page.evaluate('Noons.manual(true)')

        cities = {c['id']: c for c in page.evaluate('Noons._cities()')}
        assert len(cities) == 21, len(cities)
        for c in cities.values():
            assert abs(c['lon'] - c['zone']) <= 7.5, c
            assert math.isclose(c['off'], (c['zone'] - c['lon']) * 4, abs_tol=1e-9), c
            assert c['reset'] == 720 + c['zone'] * 4, c
        # New York City Hall is 0.994° east of 75° W: 3 min 58.6 s.
        assert math.isclose(cities['newyork']['off'] * 60, 238.56, abs_tol=0.01), cities['newyork']
        assert cities['detroit']['zone'] == 90 and round(cities['detroit']['off'], 1) == 27.8
        assert cities['pittsburgh']['off'] == -20 and cities['halifax']['zone'] == 60

        s = state(page)
        assert (s['t'], s['reset'], s['selected']) == (930, 0, 'newyork'), s

        # New York: sun noon at 16:56:01 GMT, clock reads 12:00; at 17:00 it is set back.
        page.evaluate('Noons.setTime(16*60 + 56.03)')
        s = state(page)
        assert abs(s['town']['station'] - 720) < 0.01, s
        page.evaluate('Noons.setTime(1019.99)')
        s = state(page)
        assert s['town']['station'] > 723.9 and s['reset'] == 2, s   # Halifax, Saint John already
        page.evaluate('Noons.setTime(1020)')
        s = state(page)
        assert s['town']['station'] == 720 and s['reset'] == 9 and s['twice'] == 3, s
        assert 'Set back 3 min 59 s' in page.inner_text('#verdict')
        assert page.locator('#trace circle').count() == 2              # two noons on the trace

        # Pittsburgh jumps forward 20 minutes: 11:40 straight to 12:00.
        page.locator('#towns li[data-id="pittsburgh"]').click()
        page.evaluate('Noons.setTime(1019.999)')
        assert abs(state(page)['town']['station'] - 700) < 0.01
        page.evaluate('Noons.setTime(1020)')
        s = state(page)
        assert s['selected'] == 'pittsburgh' and s['town']['station'] == 720, s
        assert 'Jumped forward 20 min 0 s' in page.inner_text('#verdict')
        assert page.locator('#trace circle').count() == 1

        # The whole day: 21 resets, every station on standard time.
        page.evaluate('Noons.setTime(1230)')
        s = state(page)
        assert (s['reset'], s['twice'] + s['skip']) == (21, 21), s
        assert s['twice'] == 7, s
        assert page.inner_text('#st-reset') == '21 / 21'

        # Clicking the map pins a town; its offset follows from where you clicked.
        box = page.locator('#map').bounding_box()
        page.mouse.click(box['x'] + box['width'] * (127.5 - 85) / 75, box['y'] + box['height'] * 0.5)
        s = state(page)
        assert s['selected'] == 'pin' and s['town']['zone'] == 90, s
        assert s['town']['lon'] == 85 and s['town']['off'] == 20, s   # snapped to the half degree
        assert page.locator('#towns li').count() == 22
        assert page.inner_text('#st-reset') == '21 / 21'              # the pin is not in the tally

        # Real-time play: 5 GMT minutes per second.
        page.evaluate('Noons.manual(false); Noons.setTime(930)')
        page.click('#play')
        page.wait_for_timeout(1200)
        s = state(page)
        assert s['playing'] and 4 < s['t'] - 930 < 8, s
        page.click('#play')
        assert not state(page)['playing']

        # Phone width: no horizontal scroll.
        page.set_viewport_size({'width': 390, 'height': 860})
        assert page.evaluate('document.documentElement.scrollWidth') <= 390
        assert not errors, errors
        browser.close()
    print('Two Noons: all browser checks passed')


if __name__ == '__main__':
    main()
