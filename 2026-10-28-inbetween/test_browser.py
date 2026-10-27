"""Exercise the actual offline app, including keyboard, pointer and playback."""
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
OUTPUT = Path(tempfile.mkdtemp(prefix='inbetween-check-'))
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 1100})
    errors, remote = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda req: remote.append(req.url) if req.url.startswith(('http:', 'https:')) else None)
    page.goto((ROOT / 'index.html').as_uri())
    page.wait_for_function('!!window.inbetween')
    page.evaluate('inbetween.setRecordingClock(true)')
    page.locator('#play').click()
    assert not page.evaluate('inbetween.state.playing')
    page.locator('[data-preset=steady]').click()
    page.locator('.frame-card').nth(6).click()
    assert page.locator('#position-value').inner_text() == '50%'
    assert page.locator('#your-ball').get_attribute('transform') == page.locator('#steady-ball').get_attribute('transform').replace('220', '90')
    page.locator('#position').fill('56')
    assert abs(page.evaluate('inbetween.state.positions[6]') - .56) < 1e-8
    assert page.locator('#take-name').inner_text() == 'YOUR OWN SPACING'
    page.locator('#position').fill('99')
    assert abs(page.evaluate('inbetween.state.positions[6] - inbetween.state.positions[7]')) < 1e-8
    page.locator('.frame-card').nth(0).click()
    assert page.locator('#position').is_disabled()
    page.locator('.frame-card').nth(12).click()
    assert page.locator('#position').is_disabled()
    page.locator('[data-preset=both]').click()
    knot = page.locator('.knot').nth(6)
    knot.focus(); page.keyboard.press('ArrowUp')
    assert abs(page.evaluate('inbetween.state.positions[6]') - .51) < 1e-8
    page.keyboard.press('ArrowDown')
    assert abs(page.evaluate('inbetween.state.positions[6]') - .5) < 1e-8
    b = knot.bounding_box()
    page.mouse.move(b['x'] + b['width']/2, b['y'] + b['height']/2)
    page.mouse.down(); page.mouse.move(b['x'] + b['width']/2, b['y'] - 15, steps=8); page.mouse.up()
    assert page.evaluate('inbetween.state.positions[6]') > .6
    assert not page.evaluate('inbetween.state.playing')
    page.locator('#show-ghosts').uncheck()
    assert not page.locator('#ghosts').is_visible()
    page.locator('#show-ghosts').check()
    for name in ['launch', 'arrive', 'both']:
        page.locator(f'[data-preset={name}]').click()
        page.locator('#play').click()
        page.evaluate('inbetween.advance(350 + 1000)')
        assert page.locator('#current-frame').inner_text() == '13'
        assert page.locator('#your-ball').get_attribute('transform') == 'translate(830 90)'
        assert page.locator('#steady-ball').get_attribute('transform') == 'translate(830 220)'
        page.evaluate('inbetween.advance(450)')
        assert page.locator('#current-frame').inner_text() == '01'
        page.locator('#play').click()
    page.locator('#next').click()
    assert page.locator('#current-frame').inner_text() == '02'
    page.locator('#previous').click()
    assert page.locator('#current-frame').inner_text() == '01'
    page.locator('.frame-card').nth(6).click()
    page.screenshot(path=str(OUTPUT / 'desktop.png'), full_page=True)
    for width in [320, 390, 768, 1024, 1280, 1920]:
        page.set_viewport_size({'width': width, 'height': 1080})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        assert page.locator('#play').bounding_box()['height'] >= 42
    page.set_viewport_size({'width': 390, 'height': 844})
    page.screenshot(path=str(OUTPUT / 'mobile.png'), full_page=True)
    reduced = browser.new_page(reduced_motion='reduce')
    reduced.goto((ROOT / 'index.html').as_uri())
    assert not reduced.evaluate('inbetween.state.playing')
    assert reduced.locator('#play-text').inner_text() == 'Play'
    assert not errors, errors
    assert not remote, remote
    browser.close()
print('PASS: presets, editing, ordered frames, fixed endpoints, keyboard, pointer drag, ghosts, exact arrival, loop, stepping, six widths, reduced motion; no errors or external requests.')
print(OUTPUT)
