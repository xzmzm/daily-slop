"""Browser behavior checks. Serve the repository on 8765 before running."""
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:8765/2026-09-18-pendulum-room/'


def set_range(page, selector, value):
    page.locator(selector).fill(str(value))


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome')
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.clock.install(time=0)
    page.clock.pause_at(0)
    page.goto(URL)
    page.clock.run_for(100)
    assert page.locator('#elapsed').input_value() == '6'
    assert page.locator('#rate-value').inner_text() == '11.33'
    assert page.locator('[data-place="paris"]').get_attribute('aria-pressed') == 'true'
    controls_y = page.locator('.time-controls').bounding_box()['y']
    page.locator('[data-place="kl"]').click()
    assert page.locator('.time-controls').bounding_box()['y'] == controls_y
    for place, direction in [('equator', 'No precession'), ('sydney', 'Counterclockwise'), ('pole', 'Clockwise')]:
        page.locator(f'[data-place="{place}"]').click()
        assert direction in page.locator('#direction-value').inner_text()
        assert page.locator('#elapsed').input_value() == '6'
    page.locator('[data-place="equator"]').click()
    assert page.locator('#period-value').inner_text() == '∞'
    set_range(page, '#latitude', -45)
    south = page.locator('#rate-value').inner_text()
    set_range(page, '#latitude', 45)
    assert page.locator('#rate-value').inner_text() == south
    assert page.locator('[data-place][aria-pressed="true"]').count() == 0
    page.locator('#latitude').focus()
    page.keyboard.press('ArrowRight')
    assert page.locator('#latitude').input_value() == '45.01'
    page.locator('#reset').click()
    assert page.locator('#elapsed').input_value() == '0'
    page.locator('#six-hours').click()
    assert page.locator('#elapsed').input_value() == '6'
    page.locator('#play').click()
    page.clock.run_for(2100)
    assert 7 <= float(page.locator('#elapsed').input_value()) <= 7.1
    page.locator('#play').click()
    paused = page.locator('#elapsed').input_value()
    page.clock.run_for(1000)
    assert page.locator('#elapsed').input_value() == paused
    set_range(page, '#elapsed', 47.9)
    page.locator('#play').click()
    page.clock.run_for(500)
    assert page.locator('#elapsed').input_value() == '48'
    assert page.locator('#play').get_attribute('aria-pressed') == 'false'
    page.locator('#six-hours').click()
    assert page.locator('#elapsed').input_value() == '48'
    page.locator('#play').click()
    page.clock.run_for(500)
    assert 0 < float(page.locator('#elapsed').input_value()) < 1
    set_range(page, '#elapsed', 12)
    assert page.locator('#play').get_attribute('aria-pressed') == 'false'
    set_range(page, '#latitude', .01)
    assert page.locator('#rate-value').inner_text() == '0.0026'
    assert 'days' in page.locator('#period-value').inner_text()
    for width in [320, 390, 768, 1280, 1920]:
        page.set_viewport_size({'width': width, 'height': 900})
        page.clock.run_for(50)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        box = page.locator('#dial').bounding_box()
        assert box['height'] > 200 and box['width'] > 250, box
        if width >= 741:
            page.locator('[data-place="paris"]').click()
            timeline_y = page.locator('.time-controls').bounding_box()['y']
            for place in ['kl', 'sydney', 'equator', 'pole']:
                page.locator(f'[data-place="{place}"]').click()
                assert page.locator('.time-controls').bounding_box()['y'] == timeline_y, (width, place)
    page.emulate_media(reduced_motion='reduce')
    page.goto(URL)
    page.clock.run_for(100)
    assert page.locator('#play').get_attribute('aria-pressed') == 'false'
    page.goto((Path(__file__).parent / 'index.html').resolve().as_uri())
    page.clock.run_for(100)
    page.locator('[data-place="sydney"]').click()
    assert 'Counterclockwise' in page.locator('#direction-value').inner_text()
    assert not errors, errors
    browser.close()
print('Browser checks passed: controls, keyboard, playback limits, 320–1920px, reduced motion and file://.')
