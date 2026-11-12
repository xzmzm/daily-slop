"""
Browser integration test for 2026-11-12-comet-bounce using Playwright.
Tests layout, canvas rendering, scenario switches, telemetry HUD, and simulation execution.
"""

from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT_DIR = Path(__file__).resolve().parent
INDEX_HTML = (PROJECT_DIR / 'index.html').as_uri()

def test_page():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1600, 'height': 950})
        page.on('pageerror', lambda err: errors.append(str(err)))
        page.goto(INDEX_HTML, wait_until='networkidle')

        # 1. Check title & masthead
        title = page.title()
        assert 'Comet Bounce' in title, f'Unexpected title: {title}'
        assert page.locator('h1').text_content().strip() == 'Comet Bounce'

        # 2. Check canvases
        sim_canvas = page.locator('#sim-canvas')
        assert sim_canvas.is_visible(), 'sim-canvas must be visible'
        civa_canvas = page.locator('#civa-canvas')
        assert civa_canvas.is_visible(), 'civa-canvas must be visible'

        # 3. Check Telemetry elements
        hud_time = page.locator('#hud-time').text_content()
        assert 'T+00:00:00' in hud_time, f'Expected initial elapsed time, got {hud_time}'

        val_alt = page.locator('#val-altitude').text_content()
        assert 'm' in val_alt, f'Expected altitude in meters, got {val_alt}'

        # 4. Test Playback execution
        page.locator('#btn-play').click()
        page.wait_for_timeout(600)
        page.locator('#btn-play').click()

        new_time = page.locator('#hud-time').text_content()
        print(f'Advanced sim time after play: {new_time}')
        assert new_time != hud_time, 'Simulation time should advance when playing'

        # 5. Test Historical Scenario: Touchdown 1 at ~330s (rebound) and Touchdown 3 at ~6000s (settled)
        page.locator('.preset-btn[data-preset="historical"]').click()
        page.wait_for_timeout(100)

        page.evaluate("window.CometApp.step(330)")
        hud_status_bounce = page.locator('#hud-status').text_content()
        hud_touches_bounce = page.locator('#hud-touches').text_content()
        assert hud_status_bounce == 'IN REBOUND ARC', f'Expected IN REBOUND ARC, got {hud_status_bounce}'
        assert hud_touches_bounce == '1', f'Expected 1 touchdown, got {hud_touches_bounce}'

        page.evaluate("window.CometApp.step(5700)")
        hud_status_settled = page.locator('#hud-status').text_content()
        hud_touches_settled = page.locator('#hud-touches').text_content()
        assert hud_status_settled == 'RESTING (TOY)', f'Expected RESTING (TOY), got {hud_status_settled}'
        assert int(hud_touches_settled) >= 2, f'Expected >=2 touchdowns, got {hud_touches_settled}'

        # 6. Test Preset switching: Nominal scenario
        nominal_btn = page.locator('.preset-btn[data-preset="nominal"]')
        nominal_btn.click()
        page.wait_for_timeout(200)

        # Check that harpoons and thruster are enabled
        assert page.locator('#check-harpoons').is_checked() is True, 'Nominal preset should enable harpoons'
        assert page.locator('#check-thruster').is_checked() is True, 'Nominal preset should enable thruster'

        # Step simulation to touchdown
        page.evaluate("window.CometApp.step(330)")
        hud_status_nominal = page.locator('#hud-status').text_content()
        assert hud_status_nominal == 'ANCHORED (TOY)', f'Expected ANCHORED (TOY), got {hud_status_nominal}'
        assert page.locator('#hud-touches').text_content() == '1'

        # 7. Test Preset switching: Escape scenario
        escape_btn = page.locator('.preset-btn[data-preset="escape"]')
        escape_btn.click()
        page.wait_for_timeout(200)

        # 8. Test Scrubber seek
        scrubber = page.locator('#time-scrubber')
        scrubber.fill("3600")
        page.evaluate("document.getElementById('time-scrubber').dispatchEvent(new Event('input'))")
        page.wait_for_timeout(200)
        scrubbed_time = page.locator('#hud-time').text_content()
        assert 'T+01:00:00' in scrubbed_time, f'Expected T+01:00:00 at 3600s, got {scrubbed_time}'

        # Scrubbing retains custom hardware and slider choices.
        page.locator('label.toggle-item').filter(has=page.locator('#check-harpoons')).click()
        page.locator('#slider-restitution').fill('0.52')
        page.locator('#slider-restitution').dispatch_event('input')
        scrubber.fill('400')
        scrubber.dispatch_event('input')
        assert page.evaluate('window.CometApp.getSim().harpoonsEnabled') is True
        assert page.evaluate('window.CometApp.getSim().restitution') == 0.52
        assert page.locator('#hud-status').text_content() == 'ANCHORED (TOY)'

        # CSS-scaled pan: the lander's screen location follows the CSS delta.
        page.locator('.preset-btn[data-preset="historical"]').click()
        box = sim_canvas.bounding_box()
        page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        page.mouse.down()
        page.mouse.move(box['x'] + box['width'] / 2 + 40, box['y'] + box['height'] / 2 + 20)
        page.mouse.up()

        # Scaled center drop should equal the panned world center.
        page.locator('#btn-drop-mode').click()
        page.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        page.evaluate('window.CometApp.pause()')
        scrubber.fill('0')
        scrubber.dispatch_event('input')
        state = page.evaluate('({x: CometApp.getSim().x, y: CometApp.getSim().y, preset: CometApp.getSim().preset})')
        assert abs(state['x'] - (-40 * 1120 / box['width'] / 0.22)) < 3, state  # Mouse coordinates round to physical pixels (~5 m/pixel here).
        assert abs(state['y'] - (200 + 20 * 680 / box['height'] / 0.22)) < 3, state  # Mouse coordinates round to physical pixels (~5 m/pixel here).
        assert state['preset'] == 'custom'
        page.locator('#btn-reset').click()
        assert page.evaluate('CometApp.getSim().preset') == 'custom'
        page.locator('#btn-drop-mode').click()

        # Reset back to historical
        page.locator('.preset-btn[data-preset="historical"]').click()
        page.wait_for_timeout(200)

        browser.close()

    assert not errors, f'Console errors detected: {errors}'
    print('✓ All browser integration tests passed with 0 console errors!')

if __name__ == '__main__':
    test_page()
