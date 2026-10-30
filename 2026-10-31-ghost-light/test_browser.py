"""Exercise the light cues and responsive layout in a real browser."""
from pathlib import Path
from playwright.sync_api import sync_playwright

PAGE = (Path(__file__).parent / 'index.html').resolve().as_uri()

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for width, height in ((1440, 900), (390, 844)):
        page = browser.new_page(viewport={'width': width, 'height': height})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(PAGE, wait_until='load')
        assert page.locator('#hidden-value').inner_text() == '75%'
        assert page.locator('#stage-value').inner_text() == '45%'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'horizontal overflow'
        page.locator('[data-cue="vanish"]').click()
        assert page.locator('#hidden-light').input_value() == '0'
        assert page.locator('.ghost').evaluate('(el) => Number(el.style.opacity)') == 0
        assert page.locator('.ray').evaluate('(el) => Number(el.style.opacity)') == 0
        assert 'VANISHED' in page.locator('#stage-status').inner_text()
        assert page.locator('[data-cue="vanish"]').get_attribute('aria-pressed') == 'true'
        page.locator('[data-cue="appear"]').click()
        assert page.locator('#hidden-light').input_value() == '85'
        assert page.locator('.ghost').evaluate('(el) => Number(el.style.opacity)') > 0.6
        assert page.locator('#stage-light').input_value() == '35'
        darkness = page.locator('.stage-darkness').evaluate('(el) => Number(el.style.opacity)')
        page.locator('[data-cue="wash"]').click()
        assert page.locator('#stage-light').input_value() == '100'
        assert page.locator('.stage-darkness').evaluate('(el) => Number(el.style.opacity)') < darkness
        assert 'competes' in page.locator('#control-hint').inner_text()
        page.locator('#hidden-light').focus()
        page.keyboard.press('Home')
        assert page.locator('#hidden-value').inner_text() == '0%'
        assert page.locator('[data-cue="wash"]').get_attribute('aria-pressed') == 'false'
        assert not errors, errors
        page.close()
    browser.close()
print('Ghost Light browser checks passed (desktop and mobile).')
