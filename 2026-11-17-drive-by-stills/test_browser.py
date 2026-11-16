"""Headless checks for Drive by Stills: the light delay, the slow-scan frame
timing, the automatic stop on the direct line, the fog-of-war chart and one
complete scripted drive.

Run: python3 test_browser.py   (needs Playwright + Chromium, verification only)
"""
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
LIGHT = 1.28
# A clean route on ground 1970, as (time the button is pressed, command).
ROUTE = [(0, 'LEFT'), (1.8, 'F2'), (36.6, 'RIGHT'), (40.75, 'F2')]


def state(page):
    return page.evaluate('Stills.getState()')


def step(page, seconds):
    page.evaluate(f'Stills.step({seconds})')


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto((HERE / 'index.html').as_uri())
        page.wait_for_selector('#chart')
        page.evaluate('Stills.manual(true)')   # the test owns the clock

        # Parked: one complete picture, nothing moving, clock stopped.
        s = state(page)
        assert (s['phase'], s['t'], s['period'], s['frame']) == ('ready', 0, 21.1, 0), s
        world = page.evaluate('Stills._world()')
        assert len(world['craters']) == 17 and len(world['rocks']) == 16, world
        first = world['craters'][0]            # the crater on the direct line
        wp = world['waypoint']
        off_line = abs(first['x'] * wp['y'] - first['y'] * wp['x']) / math.hypot(wp['x'], wp['y'])
        assert off_line < first['r'], (first, off_line)
        assert first['seen'] and s['seen'] >= 1, s   # visible in the parked picture

        # A command needs 1.28 s to arrive and 1.28 s more to be confirmed.
        page.click('.cmd[data-cmd="F2"]')
        s = state(page)
        assert (s['phase'], s['mode'], s['pending']) == ('driving', 'STOP', 1), s
        step(page, 1.25)
        assert state(page)['mode'] == 'STOP'
        step(page, 0.1)
        s = state(page)
        assert s['mode'] == 'F2' and s['teleMode'] == 'STOP', s
        step(page, 1.3)
        s = state(page)
        assert s['teleMode'] == 'F2', s
        assert math.isclose(s['y'], (s['t'] - LIGHT) * 2.0 / 3.6, abs_tol=0.05), s   # 2.0 km/h

        # Slow scan: the frame exposed at T+0 is complete at period + 1.28 s,
        # and it still shows the parking spot.
        step(page, 21.1 + LIGHT - s['t'] - 0.1)
        assert state(page)['frame'] == 0
        assert page.locator('#rx-label').inner_text().startswith('RECEIVING 001')
        step(page, 0.2)
        s = state(page)
        assert s['frame'] == 1 and s['picturePose']['y'] == 0, s
        assert s['y'] > 11 and s['pictureAge'] > 21, s

        # Straight at the waypoint in second gear: the rover stops itself at the
        # rim before any picture has shown the crater up close.
        step(page, 20)
        s = state(page)
        assert (s['mode'], s['stops'], s['trip']) == ('STOP', 1, 'crater rim'), s
        edge = math.hypot(first['x'] - s['x'], first['y'] - s['y'])
        assert math.isclose(edge, first['r'] + 0.5, abs_tol=0.05), (edge, first)
        assert 'AUTOMATIC STOP' in page.locator('#uplink').inner_text()

        # Reverse backs out; forward into the rim is refused again.
        page.click('.cmd[data-cmd="REV"]')
        step(page, 6)
        assert state(page)['y'] < s['y'] - 0.8
        page.click('.cmd[data-cmd="F1"]')
        step(page, 12)
        s2 = state(page)
        assert s2['stops'] == 2 and math.isclose(s2['y'], s['y'], abs_tol=0.05), s2

        # The chart only learns from delivered pictures; truth shows the rest.
        assert s2['seen'] < 17, s2
        page.click('#truth')
        assert state(page)['truth'] is True
        page.click('#truth')

        # Changing the camera starts a new drive. With 3.2 s frames the picture
        # is never much more than two frame periods old.
        page.click('#periods .chip[data-period="3.2"]')
        s = state(page)
        assert (s['phase'], s['t'], s['period'], s['stops']) == ('ready', 0, 3.2, 0), s
        t, worst_age = 0.0, 0.0
        for when, cmd in ROUTE:
            while t < when - 1e-9:
                dt = min(0.5, when - t)
                step(page, dt); t += dt
                worst_age = max(worst_age, state(page)['pictureAge'])
            page.click(f'.cmd[data-cmd="{cmd}"]')
        step(page, 80)
        s = state(page)
        assert (s['phase'], s['stops'], s['runs']) == ('arrived', 0, 1), s
        assert s['waypoint'] < 2.5 and 57 < s['odo'] < 61, s
        assert 5 < worst_age <= 2 * 3.2 + LIGHT + 0.6, worst_age
        assert 'Waypoint reached' in page.locator('#uplink').inner_text()
        assert page.locator('#runs li').count() == 1
        assert page.locator('.cmd[data-cmd="F1"]').is_disabled()

        # New ground is different ground; back to the lander resets the run.
        before = page.evaluate('Stills._world()')['craters'][1]
        page.click('#newground')
        s = state(page)
        assert (s['seed'], s['phase'], s['t']) == (1971, 'ready', 0), s
        assert page.evaluate('Stills._world()')['craters'][1] != before

        # Keyboard drives too, and the real-time clock runs when not in manual.
        page.evaluate('Stills.manual(false)')
        page.keyboard.press('ArrowUp')
        page.wait_for_function('Stills.getState().mode === "F1" && Stills.getState().y > 0.2', timeout=8000)
        page.keyboard.press(' ')
        page.wait_for_function('Stills.getState().mode === "STOP"', timeout=8000)

        # Both canvases painted.
        assert page.evaluate('document.querySelector("#chart").width') > 200
        lit = page.evaluate('''() => {
            const d = document.querySelector("#tv").getContext("2d").getImageData(320, 400, 1, 1).data;
            return d[0];
        }''')
        assert lit > 100, lit   # sunlit regolith in the foreground

        assert not errors, errors
        browser.close()
    print('Drive by Stills checks passed')


if __name__ == '__main__':
    main()
