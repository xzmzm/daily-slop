#!/usr/bin/env python3
"""Playwright behavior checks; development tooling, not an app dependency."""
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent


def actors(page, selector):
    """Read actual projected drawing positions, independently of order labels."""
    return page.eval_on_selector(selector, """svg => Array.from(svg.children)
        .filter(el => el.tagName.toLowerCase() === 'g')
        .map(el => ({name: el.querySelector('text').textContent.trim().split(' ')[0],
                    x: el.transform.baseVal.consolidate().matrix.e,
                    scale: el.transform.baseVal.consolidate().matrix.a}))""")


def screen_point(page, x, y):
    return page.eval_on_selector('#stage', """(svg, coords) => {
        const p = svg.createSVGPoint(); p.x = coords[0]; p.y = coords[1];
        const q = p.matrixTransform(svg.getScreenCTM()); return {x:q.x,y:q.y};
    }""", [x, y])


def main():
    errors, requests = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('request', lambda r: requests.append(r.url))
        page.goto((PROJECT / 'index.html').as_uri())
        page.wait_for_function('!!window.cutAcross')
        page.evaluate('cutAcross.useManualClock()')
        assert 'Cut Across' in page.title()
        assert page.evaluate('cutAcross.getState()') == {
            'cameraA': 55, 'cameraB': 135, 'playing': False, 'shot': 'a', 'time': 0}
        assert page.locator('#status').inner_text() == 'CONTINUITY HOLDS'
        assert page.locator('#same-side').get_attribute('aria-pressed') == 'true'

        # The actual drawings reverse left/right after a cross-line preset.
        positions = {a['name']: a for a in actors(page, '#frame-b')}
        assert positions['ADA']['x'] < positions['JULES']['x']
        assert abs(positions['JULES']['x'] - (380 + 530 * math.sqrt(.5) / (4 + math.sqrt(.5)))) < .002
        page.click('#cross-line')
        assert page.evaluate('cutAcross.getState().cameraB') == 225
        assert page.locator('#status').inner_text() == 'SCREEN DIRECTION FLIPS'
        assert page.locator('body.crossed').count() == 1
        assert page.locator('#cross-line').get_attribute('aria-pressed') == 'true'
        positions = {a['name']: a for a in actors(page, '#frame-b')}
        assert positions['ADA']['x'] > positions['JULES']['x']
        page.click('#select-b')
        assert page.evaluate('cutAcross.getState().shot') == 'b'
        assert page.locator('#monitor-label').inner_text() == 'CAMERA B'
        assert page.locator('#monitor').get_attribute('aria-label').startswith('Camera B: JULES')
        assert actors(page, '#monitor') == actors(page, '#frame-b')

        # Keyboard access to the slider includes both on-axis boundary cases.
        slider = page.locator('#camera-b-angle')
        slider.focus()
        slider.press('Home')
        assert page.evaluate('cutAcross.getState().cameraB') == 0
        assert page.locator('#status').inner_text() == 'ON THE AXIS'
        assert page.locator('body.axis').count() == 1
        axis = actors(page, '#frame-b')
        assert all(a['x'] == 380 for a in axis)
        assert axis[0]['name'] == 'ADA' and axis[1]['name'] == 'JULES', axis  # far actor draws first
        page.eval_on_selector('#camera-b-angle', "el => {el.value=180; el.dispatchEvent(new Event('input'));}")
        axis = actors(page, '#frame-b')
        assert axis[0]['name'] == 'JULES' and axis[1]['name'] == 'ADA', axis
        slider.press('End')
        assert page.evaluate('cutAcross.getState().cameraB') == 359
        slider.press('ArrowLeft')
        assert page.evaluate('cutAcross.getState().cameraB') == 358
        assert page.locator('#status').inner_text() == 'SCREEN DIRECTION FLIPS'

        # Drag B from the upper half-plane to its lower counterpart.
        page.click('#same-side')
        start = screen_point(page, 220 + 144 * math.cos(math.radians(135)),
                             196 - 144 * math.sin(math.radians(135)))
        target = screen_point(page, 220 + 144 * math.cos(math.radians(225)),
                              196 - 144 * math.sin(math.radians(225)))
        page.mouse.move(start['x'], start['y'])
        page.mouse.down()
        page.mouse.move(target['x'], target['y'], steps=10)
        page.mouse.up()
        assert page.evaluate('cutAcross.getState().cameraB') == 225
        assert page.locator('#camera-b.dragging').count() == 0
        assert page.locator('#angle-value').inner_text() == '225°'

        # Playback performs an instantaneous cut at two seconds and resumes after pause.
        page.click('#reset')
        page.click('#play-cut')
        assert page.locator('#play-cut').get_attribute('aria-pressed') == 'true'
        page.evaluate('cutAcross.tick(1.99)')
        assert page.evaluate('cutAcross.getState().shot') == 'a'
        page.evaluate('cutAcross.tick(.01)')
        assert page.evaluate('cutAcross.getState().shot') == 'b'
        assert page.locator('#timecode').inner_text() == '00:02:00'
        page.evaluate('cutAcross.tick(.33)')
        page.click('#play-cut')
        paused = page.evaluate('cutAcross.getState()')
        page.evaluate('cutAcross.tick(10)')
        assert page.evaluate('cutAcross.getState()') == paused
        page.click('#play-cut')
        page.evaluate('cutAcross.tick(1.67)')
        assert page.evaluate('cutAcross.getState().shot') == 'a'
        page.click('#select-b')
        assert page.evaluate('cutAcross.getState()') == {
            'cameraA': 55, 'cameraB': 135, 'playing': False, 'shot': 'b', 'time': 2}
        page.click('#reset')
        assert page.evaluate('cutAcross.getState()') == {
            'cameraA': 55, 'cameraB': 135, 'playing': False, 'shot': 'a', 'time': 0}

        # Set API normalizes camera angles and guards invalid timing inputs.
        page.evaluate('cutAcross.set({cameraB:-135})')
        assert page.evaluate('cutAcross.getState().cameraB') == 225
        before = page.evaluate('cutAcross.getState()')
        page.evaluate('cutAcross.set({cameraB:NaN}); cutAcross.tick(NaN); cutAcross.tick(-1)')
        assert page.evaluate('cutAcross.getState()') == before
        assert all(u.startswith('file://') for u in requests), requests

        # Narrow views keep the workbench usable without horizontal scrolling.
        for width in [320, 390, 768]:
            mobile = browser.new_page(viewport={'width': width, 'height': 844})
            mobile.on('pageerror', lambda e: errors.append(str(e)))
            mobile.goto((PROJECT / 'index.html').as_uri())
            mobile.wait_for_function('!!window.cutAcross')
            assert mobile.evaluate('document.documentElement.scrollWidth') <= width, width
            mobile.click('#cross-line')
            assert mobile.locator('#status').inner_text() == 'SCREEN DIRECTION FLIPS'
            assert mobile.locator('#stage').bounding_box()['width'] >= 230
            assert mobile.locator('#monitor').bounding_box()['width'] >= 225
            mobile.close()
        calm = browser.new_page(viewport={'width': 1200, 'height': 800}, reduced_motion='reduce')
        calm.on('pageerror', lambda e: errors.append(str(e)))
        calm.goto((PROJECT / 'index.html').as_uri())
        calm.wait_for_function('!!window.cutAcross')
        assert not calm.evaluate('cutAcross.getState().playing')
        browser.close()
    assert not errors, errors
    print('browser checks passed:', len(requests), 'local requests; geometry, controls, playback, drag, mobile')


if __name__ == '__main__':
    main()
