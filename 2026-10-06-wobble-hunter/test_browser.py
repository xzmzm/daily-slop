#!/usr/bin/env python3
"""Playwright behavior checks; development tooling, not an app dependency."""
import math
import re

from playwright.sync_api import sync_playwright

PROJECT_DIR = Path = __import__('pathlib').Path(__file__).resolve().parent


def star_xy(page):
    """Read the drawn star-centre translate() from the SVG."""
    transform = page.eval_on_selector('#star-disc', 'el => el.getAttribute("transform")')
    x, y = (float(n) for n in re.findall(r'-?\d+(?:\.\d+)?', transform))
    return x, y


def needle_x(page):
    return float(page.eval_on_selector('#meter-needle', 'el => el.getAttribute("x1")'))


def chart_colors(page):
    return page.evaluate("""() => {
        const c = document.getElementById('chart');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        const seen = new Set();
        for (let i = 0; i < d.length; i += 40) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
        return seen.size;
    }""")


def main():
    errors, requests = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('request', lambda r: requests.append(r.url))
        page.goto((PROJECT_DIR / 'index.html').as_uri())
        page.wait_for_function('!!window.wobbleHunter')
        page.evaluate('wobbleHunter.useManualClock(); wobbleHunter.set({time: 0})')
        assert 'Wobble Hunter' in page.title()

        # The discovery preset reproduces the 1995 numbers.
        assert page.evaluate('wobbleHunter.getState()') == {
            'massMJ': 0.46, 'distAU': 0.0522, 'inclDeg': 90,
            'playing': True, 'speed': 2, 'time': 0}
        assert page.locator('#period-value').inner_text() == '4.23 d'
        assert page.locator('#k-value').inner_text() == '55.6 m/s'
        assert page.locator('#msini-value').inner_text() == '0.46 MJ'
        assert page.locator('#wobble-value').inner_text().startswith('3,23')
        assert page.locator('#status').inner_text() == 'LOUD ENOUGH FOR 1995'
        assert page.locator('#preset-discovery').get_attribute('aria-pressed') == 'true'
        assert chart_colors(page) > 12, 'radial-velocity chart must paint'

        # At t = 0 the star is at maximum line-of-sight speed, opposite the planet.
        sx, sy = star_xy(page)
        assert abs(sx - (220 - 44)) < 1e-6 and abs(sy - 190) < 1e-6, (sx, sy)
        assert page.eval_on_selector('#spec-line', 'el => Number(el.getAttribute("x1"))') > 400
        assert 'RECEDING' in page.locator('#spec-state').text_content()

        # Manual clock: one tick of one second equals two days at the default speed.
        page.evaluate('wobbleHunter.tick(1)')
        assert page.evaluate('wobbleHunter.getState().time') == 2
        assert page.locator('#clock').inner_text() == '2.0 d'

        # Tilted view: the star's drawn position follows the analytic wobble.
        page.evaluate('wobbleHunter.set({inclDeg: 30})')
        page.evaluate('wobbleHunter.tick(0.25)')  # t = 2.5 d, third quarter: approaching
        period = 365.25 * math.sqrt(0.0522 ** 3 / (1.06 + 0.46 * 9.5458e-4))
        theta = 2 * math.pi * 2.5 / period
        sx, sy = star_xy(page)
        assert abs(sx - (220 - math.cos(theta) * 44)) < 1e-6, (sx, sy)
        assert abs(sy - (190 - math.sin(theta) * 44 * math.cos(math.radians(30)))) < 1e-6
        assert math.cos(theta) < 0 and 'APPROACHING' in page.locator('#spec-state').text_content()

        # Tilt scales the projected wobble and the velocity alike.
        page.evaluate('wobbleHunter.set({time: 0})')
        assert page.locator('#k-value').inner_text() == '27.8 m/s'
        assert page.locator('#msini-value').inner_text() == '0.23 MJ'
        page.evaluate('wobbleHunter.set({inclDeg: 0})')
        assert page.locator('#k-value').inner_text() == '0.0 cm/s'
        assert page.locator('#spec-state').text_content() == 'REST λ₀'
        assert page.locator('#status').inner_text() == 'BELOW EVERY SPECTROGRAPH'
        assert page.locator('#meter-value').text_content() == '‹ 0.01 m/s'
        ry = float(page.eval_on_selector('#orbit-path', 'el => el.getAttribute("ry")'))
        rx = float(page.eval_on_selector('#orbit-path', 'el => el.getAttribute("rx")'))
        assert rx == 132 and ry == 132, 'face-on orbit projects to a full circle'
        page.evaluate('wobbleHunter.set({inclDeg: 90})')
        ry = float(page.eval_on_selector('#orbit-path', 'el => el.getAttribute("ry")'))
        assert ry < 1, 'edge-on orbit projects to a line'

        # Presets swap regimes; the meter needle follows the signal.
        needle_discovery = needle_x(page)
        page.click('#preset-jupiter')
        assert page.locator('#period-value').inner_text() == '11.5 yr'
        assert page.locator('#k-value').inner_text() == '12.1 m/s'
        assert page.locator('#preset-jupiter').get_attribute('aria-pressed') == 'true'
        assert page.locator('#preset-discovery').get_attribute('aria-pressed') == 'false'
        assert page.locator('#status').inner_text() == "A MODERN INSTRUMENT’S JOB"
        needle_jupiter = needle_x(page)
        assert needle_jupiter < needle_discovery
        page.click('#preset-earth')
        assert page.locator('#k-value').inner_text() == '8.7 cm/s'
        assert page.locator('#msini-value').inner_text() == '1.0 M⊕'
        assert page.locator('#status').inner_text() == 'BELOW EVERY SPECTROGRAPH'
        assert needle_x(page) < needle_jupiter

        # Keyboard slider control reaches both ends of the log scales.
        mass = page.locator('#mass')
        mass.focus()
        mass.press('Home')
        assert page.evaluate('wobbleHunter.getState().massMJ') < 0.00031
        mass.press('End')
        assert abs(page.evaluate('wobbleHunter.getState().massMJ') - 6) < 1e-9
        dist = page.locator('#dist')
        dist.focus()
        dist.press('End')
        assert abs(page.evaluate('wobbleHunter.getState().distAU') - 6) < 1e-9
        assert page.locator('#preset-earth').get_attribute('aria-pressed') == 'false'
        incl = page.locator('#incl')
        incl.focus()
        incl.press('Home')
        assert page.evaluate('wobbleHunter.getState().inclDeg') == 0
        incl.press('End')
        assert page.evaluate('wobbleHunter.getState().inclDeg') == 90

        # Transport: pause freezes the sky; speed buttons change the rate.
        page.click('#preset-discovery')
        page.click('#play')
        assert page.evaluate('wobbleHunter.getState().playing') is False
        frozen = page.evaluate('wobbleHunter.getState()')
        page.evaluate('wobbleHunter.tick(5)')
        assert page.evaluate('wobbleHunter.getState()') == frozen
        assert page.locator('#play').get_attribute('aria-pressed') == 'false'
        page.click('#play')
        page.click('#speed-year')
        assert page.locator('#speed-year').get_attribute('aria-pressed') == 'true'
        assert page.evaluate('wobbleHunter.getState().speed') == 365.25
        page.evaluate('wobbleHunter.tick(2)')
        assert page.evaluate('wobbleHunter.getState().time') > 700
        page.evaluate('wobbleHunter.set({speed: 2, time: 0})')

        # Guard against invalid inputs.
        before = page.evaluate('wobbleHunter.getState()')
        page.evaluate('wobbleHunter.set({massMJ: NaN, inclDeg: -5, speed: 0, time: -3}); '
                      'wobbleHunter.tick(NaN); wobbleHunter.tick(-1)')
        after = page.evaluate('wobbleHunter.getState()')
        assert after['massMJ'] == before['massMJ'] and after['inclDeg'] == 0
        assert after['time'] == 0 and after['speed'] == 2
        assert all(u.startswith('file://') for u in requests), requests

        # Narrow screens stay usable without horizontal scrolling.
        for width in [320, 390, 768]:
            mobile = browser.new_page(viewport={'width': width, 'height': 844})
            mobile.on('pageerror', lambda e: errors.append(str(e)))
            mobile.goto((PROJECT_DIR / 'index.html').as_uri())
            mobile.wait_for_function('!!window.wobbleHunter')
            assert mobile.evaluate('document.documentElement.scrollWidth') <= width, width
            mobile.click('#preset-earth')
            assert mobile.locator('#status').inner_text() == 'BELOW EVERY SPECTROGRAPH'
            assert mobile.locator('#sky').bounding_box()['width'] >= 230
            assert mobile.locator('#chart').bounding_box()['width'] >= 225
            mobile.close()
        calm = browser.new_page(viewport={'width': 1200, 'height': 800}, reduced_motion='reduce')
        calm.on('pageerror', lambda e: errors.append(str(e)))
        calm.goto((PROJECT_DIR / 'index.html').as_uri())
        calm.wait_for_function('!!window.wobbleHunter')
        assert not calm.evaluate('wobbleHunter.getState().playing')
        browser.close()
    assert not errors, errors
    print('browser checks passed:', len(requests),
          'local requests; presets, sliders, meter, chart, transport, mobile')


if __name__ == '__main__':
    main()
