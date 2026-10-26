"""Exercise real controls in both directions, plus keyboard and narrow layouts."""
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent
OUTPUT = Path(tempfile.mkdtemp(prefix='lock-tender-check-'))
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((PROJECT / 'index.html').as_uri())
    page.evaluate('lockTender.pauseAutomatic()')
    page.locator('#gate-lower').click()
    assert 'unequal water' in page.locator('#feedback').inner_text()
    assert page.locator('#gate-lower').get_attribute('aria-pressed') == 'false'
    page.screenshot(path=str(OUTPUT / 'desktop.png'), full_page=True)

    for direction in ['up', 'down']:
        page.locator('#' + direction).click()
        start, end = ('lower', 'upper') if direction == 'up' else ('upper', 'lower')
        page.locator('#sluice-' + start).click()
        page.evaluate('lockTender.tick(7.1)')
        page.locator('#sluice-' + start).click()
        page.locator('#gate-' + start).click()
        page.locator('#move').click()
        page.evaluate('lockTender.tick(2.5)')
        assert page.evaluate('lockTender.model.boat') == 'chamber'
        page.locator('#gate-' + start).click()
        page.locator('#sluice-' + end).click()
        page.evaluate('lockTender.tick(3.5)')
        assert '2.40' not in page.locator('#level').inner_text()
        assert page.evaluate('lockTender.boatPosition().h === lockTender.model.level')
        page.screenshot(path=str(OUTPUT / (direction + '-lifting.png')), full_page=True)
        page.evaluate('lockTender.tick(3.6)')
        page.locator('#sluice-' + end).click()
        page.locator('#gate-' + end).click()
        page.locator('#move').click()
        page.evaluate('lockTender.tick(2.5)')
        assert page.locator('#move').is_disabled()
        assert page.locator('#hint-title').inner_text() == 'Passage complete.'
        assert page.locator('#admitted').inner_text() == '288 m³'
        assert ('+2.40' if direction == 'up' else '−2.40') in page.locator('#boat-rise').inner_text()

    page.locator('#reset').click()
    page.locator('#sluice-upper').focus()
    page.keyboard.press('Enter')
    assert page.locator('#sluice-upper').get_attribute('aria-pressed') == 'true'
    page.keyboard.press('Space')
    assert page.locator('#sluice-upper').get_attribute('aria-pressed') == 'false'
    page.locator('#up').click()
    for width in [320, 390, 768, 1024, 1280, 1920]:
        page.set_viewport_size({'width': width, 'height': 1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        # Controls retain usable hit targets at every breakpoint.
        for selector in ['#gate-lower', '#sluice-upper', '#move']:
            box = page.locator(selector).bounding_box()
            assert box['width'] >= 44 and box['height'] >= 44, (width, selector, box)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.screenshot(path=str(OUTPUT / 'mobile.png'), full_page=True)
    assert not errors, errors
    browser.close()
print('PASS: real uphill/downhill controls, pressure feedback, boat height, keyboard, six widths; no page errors.')
print('Screenshots:', OUTPUT)
