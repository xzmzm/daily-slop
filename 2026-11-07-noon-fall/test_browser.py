"""Exercise the shipped app directly from disk; no network or server required."""
from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent
output = Path(tempfile.mkdtemp(prefix='noon-fall-check-'))

def fly(page):
    """Drive the whole flight through the deterministic clock, as the video does."""
    for _ in range(2000):
        page.evaluate('noonFall.advance(66)')
        if page.evaluate('noonFall.state.phase') == 'done':
            return
    raise AssertionError('flight never finished')

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 1100})
    errors, remote = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: remote.append(r.url) if r.url.startswith(('https:', 'http:')) else None)
    page.goto((PROJECT / 'index.html').as_uri())
    page.evaluate('noonFall.setRecordingClock(true)')
    assert page.evaluate('noonFall.state.phase') == 'idle'
    assert page.locator('#mass-value').inner_text() == '600 kg'
    assert page.locator('#r-alt').inner_text() == '—'
    page.screenshot(path=str(output/'desktop-idle.png'), full_page=True)

    # The Ensisheim preset flies and lands, with live readouts on the way.
    page.locator('#preset-ensisheim').click()
    assert page.locator('#mass-value').inner_text() == '600 kg'
    assert page.locator('#material-stony').get_attribute('aria-pressed') == 'true'
    page.locator('#drop').click()
    assert page.evaluate('noonFall.state.phase') == 'flying'
    page.evaluate('noonFall.advance(3000)')
    assert page.locator('#r-alt').inner_text() != '—'
    assert page.locator('#r-speed').inner_text() != '—'
    altitude_mid = float(page.locator('#r-alt').inner_text())
    assert 0 < altitude_mid < 100
    assert 'In flight' in page.locator('#verdict').inner_text()
    fly(page)
    verdict = page.locator('#verdict').inner_text()
    assert 'Landed' in verdict and 'kg' in verdict, verdict
    assert 'meteorite' in page.locator('#verdict').inner_text().lower()
    page.screenshot(path=str(output/'desktop-ensisheim.png'), full_page=True)

    # Determinism: the recording clock freezes the rAF loop; manual advance drives it.
    t1 = page.evaluate('noonFall.state.t')
    page.evaluate('noonFall.advance(1000)')
    assert page.evaluate('noonFall.state.t') == t1  # done clamps

    # The Taurid fireball shatters high with a flash.
    page.locator('#preset-taurid').click()
    assert page.locator('#mass-value').inner_text() == '100 kg'
    assert page.locator('#material-dust').get_attribute('aria-pressed') == 'true'
    page.locator('#drop').click()
    fly(page)
    assert 'Shattered' in page.locator('#verdict').inner_text()
    page.screenshot(path=str(output/'desktop-taurid.png'), full_page=True)

    # Chelyabinsk bursts with kilotons; the airburst label is drawn on canvas.
    page.locator('#preset-chelyabinsk').click()
    page.locator('#drop').click()
    fly(page)
    verdict = page.locator('#verdict').inner_text()
    assert 'Shattered' in verdict and 'kt' in verdict, verdict
    page.screenshot(path=str(output/'desktop-chelyabinsk.png'), full_page=True)

    # Iron punches through and lands near terminal velocity.
    page.locator('#preset-iron').click()
    page.locator('#drop').click()
    fly(page)
    assert 'Landed' in page.locator('#verdict').inner_text()

    # Dials: mass is logarithmic; changing anything returns to idle.
    page.locator('#mass').fill('0')
    assert page.locator('#mass-value').inner_text() == '100 g'
    page.locator('#mass').fill('100')
    assert page.locator('#mass-value').inner_text() == '10 kt'
    assert page.evaluate('noonFall.state.phase') == 'idle'
    page.locator('#speed').fill('72')
    assert page.locator('#speed-value').inner_text() == '72 km/s'
    page.locator('#angle').fill('5')
    assert page.locator('#angle-value').inner_text() == '5°'
    page.locator('#material-iron').click()
    page.locator('#drop').click()
    fly(page)
    page.locator('#speed').fill('20')
    assert page.evaluate('noonFall.state.phase') == 'idle'

    # Pause stops the automatic clock but manual advance still paints.
    page.locator('#speed').fill('14')
    page.locator('#mass').fill('47')
    page.locator('#drop').click()
    page.locator('#motion').click()
    assert page.evaluate('noonFall.state.playing') is False
    page.evaluate('noonFall.advance(500)')
    t_paused = page.evaluate('noonFall.state.t')
    assert t_paused > 0
    page.locator('#motion').click()
    assert page.evaluate('noonFall.state.playing') is True

    # Reduced motion: launch jumps straight to the verdict.
    reduced = browser.new_page(reduced_motion='reduce')
    reduced.goto((PROJECT / 'index.html').as_uri())
    reduced.evaluate('noonFall.setRecordingClock(true)')
    reduced.locator('#drop').click()
    assert reduced.evaluate('noonFall.state.phase') == 'done'
    assert 'Landed' in reduced.locator('#verdict').inner_text()

    for width in [320, 390, 700, 768, 1024, 1280, 1920]:
        page.set_viewport_size({'width': width, 'height': 1080})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
    page.set_viewport_size({'width': 1280, 'height': 800})
    box = page.locator('.observation').bounding_box()
    assert box['y'] + box['height'] <= 800, box
    page.screenshot(path=str(output/'compact.png'))
    page.set_viewport_size({'width': 390, 'height': 844})
    page.screenshot(path=str(output/'mobile.png'), full_page=True)

    assert not errors, errors
    assert not remote, remote
    browser.close()
print('PASS: presets fly and end correctly, live readouts, log mass dial, pause, reduced motion, responsive widths, offline; no JS errors.')
print(output)
