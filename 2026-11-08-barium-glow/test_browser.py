"""Exercise the shipped app directly from disk; no network or server required."""
from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent
output = Path(tempfile.mkdtemp(prefix='barium-glow-check-'))

def expose_for(page, seconds):
    """Run an exposure through the deterministic clock, as the video does."""
    page.evaluate('bariumGlow.expose()')
    assert page.evaluate('bariumGlow.state.mode') == 'exposing'
    for _ in range(200):
        page.evaluate('bariumGlow.advance(100)')
        if page.evaluate('bariumGlow.state.mode') == 'fixed':
            return
    raise AssertionError('exposure never reached MAS_MAX')

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 1100})
    errors, remote = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: remote.append(r.url) if r.url.startswith(('https:', 'http:')) else None)
    page.goto((PROJECT / 'index.html').as_uri())
    page.evaluate('bariumGlow.setRecordingClock(true)')
    assert page.evaluate('bariumGlow.state.mode') == 'idle'
    assert page.evaluate('bariumGlow.state.object') == 'book'
    assert page.locator('#kvp-value').inner_text() == '40 kVp'
    assert page.locator('#ma-value').inner_text() == '4 mA'
    assert page.locator('#r-mas').inner_text() == '0'
    assert page.locator('#cover').get_attribute('aria-pressed') == 'true'
    page.screenshot(path=str(output / 'desktop-idle.png'), full_page=True)

    # The recording clock freezes the rAF loop: nothing accumulates by itself.
    page.wait_for_timeout(400)
    assert page.evaluate('bariumGlow.state.mAs') == 0

    # Expose the book: mAs accumulate, the verdict grades the fixed plate.
    page.evaluate('bariumGlow.advance(2000)')
    page.evaluate('bariumGlow.expose()')
    assert page.evaluate('bariumGlow.state.mode') == 'exposing'
    page.evaluate('bariumGlow.advance(3000)')
    mas = page.evaluate('bariumGlow.state.mAs')
    assert 10 < mas < 14, mas
    page.evaluate('bariumGlow.expose()')
    assert page.evaluate('bariumGlow.state.mode') == 'fixed'
    grade = page.evaluate('bariumGlow.state.grade.stars')
    assert grade == 3, f'book at 40 kVp should be a textbook plate, got {grade}'
    assert '★' in page.locator('#verdict').inner_text()
    assert page.locator('#expose').is_disabled()
    page.screenshot(path=str(output / 'desktop-book.png'), full_page=True)

    # Changing anything returns to idle with a clean plate.
    page.locator('#object-hand').click()
    assert page.evaluate('bariumGlow.state.mode') == 'idle'
    assert page.evaluate('bariumGlow.state.mAs') == 0
    assert page.locator('#object-hand').get_attribute('aria-pressed') == 'true'

    # The hand wants harder rays; at 40 kVp a short run starves, 60 kVp shines.
    page.evaluate('bariumGlow.expose()')
    page.evaluate('bariumGlow.advance(1500)')
    page.evaluate('bariumGlow.expose()')
    verdict = page.locator('#verdict').inner_text()
    assert 'Fog' in verdict, verdict
    page.locator('#kvp').fill('60')
    assert page.locator('#kvp-value').inner_text() == '60 kVp'
    assert page.evaluate('bariumGlow.state.mode') == 'idle'
    page.evaluate('bariumGlow.expose()')
    page.evaluate('bariumGlow.advance(3000)')
    page.evaluate('bariumGlow.expose()')
    grade = page.evaluate('bariumGlow.state.grade.stars')
    assert grade == 3, f'hand at 60 kVp / 12 mAs should be a textbook plate, got {grade}'
    page.screenshot(path=str(output / 'desktop-hand.png'), full_page=True)

    # Cover toggle changes the room, not the beam — the plate stays graded.
    page.locator('#cover').click()
    assert page.locator('#cover').get_attribute('aria-pressed') == 'false'
    assert 'Cover off' in page.locator('#cover').inner_text()
    assert page.evaluate('bariumGlow.state.mode') == 'fixed'
    page.locator('#cover').click()

    # Lead blocks everything at any voltage.
    page.locator('#object-lead').click()
    page.evaluate('bariumGlow.expose()')
    page.evaluate('bariumGlow.advance(4000)')
    page.evaluate('bariumGlow.expose()')
    g = page.evaluate('bariumGlow.state.grade')
    assert g['blocked'] and g['stars'] == 0, g
    assert 'Lead stops' in page.locator('#verdict').inner_text()

    # Over-exposure: hard rays and a long run burn the plate black.
    page.locator('#object-hand').click()
    page.locator('#kvp').fill('120')
    expose_for(page, 4)
    assert page.evaluate('bariumGlow.state.grade.overExposed'), page.evaluate('bariumGlow.state.grade')
    page.screenshot(path=str(output / 'desktop-over.png'), full_page=True)

    # Fresh plate resets; sliders validate.
    page.locator('#newplate').click()
    assert page.evaluate('bariumGlow.state.mode') == 'idle'
    page.locator('#ma').fill('10')
    assert page.locator('#ma-value').inner_text() == '10 mA'
    try:
        page.evaluate('bariumGlow.setKvp(200)')
        raise AssertionError('setKvp(200) must throw')
    except Exception:
        pass

    # The deterministic clock still paints after everything.
    page.evaluate('bariumGlow.setRecordingClock(false)')
    page.wait_for_timeout(200)
    page.evaluate('bariumGlow.setRecordingClock(true)')

    for width in [320, 390, 700, 768, 1024, 1280, 1920]:
        page.set_viewport_size({'width': width, 'height': 1080})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
    page.set_viewport_size({'width': 1280, 'height': 800})
    box = page.locator('.observation').bounding_box()
    assert box['y'] + box['height'] <= 900, box
    page.screenshot(path=str(output / 'compact.png'))
    page.set_viewport_size({'width': 390, 'height': 844})
    page.screenshot(path=str(output / 'mobile.png'), full_page=True)

    assert not errors, errors
    assert not remote, remote
    browser.close()
print('PASS: expose/fix cycle, deterministic clock, hand sweet spot, lead blocks, over-exposure, validation, responsive widths, offline; no JS errors.')
print(output)
