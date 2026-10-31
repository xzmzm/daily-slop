"""Exercise the live force readout, SVG, controls, and mobile layout."""
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = (Path(__file__).parent / 'index.html').as_uri()


def check(page):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL, wait_until='load')
    assert page.locator('#pull-value').inner_text() == '83.8'
    shallow_path = page.locator('#cable').get_attribute('d')
    assert page.locator('#hangers line').count() == 23
    assert page.locator('[data-sag="100"]').get_attribute('aria-pressed') == 'true'
    page.locator('[data-sag="200"]').click()
    assert page.locator('#pull-value').inner_text() == '41.9'
    assert page.locator('#sag-value').inner_text() == '200 m'
    assert page.locator('[data-sag="200"]').get_attribute('aria-pressed') == 'true'
    assert page.locator('#cable').get_attribute('d') != shallow_path
    assert 'reference dip' in page.locator('#comparison').inner_text()
    page.locator('#load').fill('100')
    assert page.locator('#pull-value').inner_text() == '83.8'
    page.locator('#sag').fill('60')
    assert page.locator('#pull-value').inner_text() == '279.5'
    assert '3.33×' in page.locator('#comparison').inner_text()
    assert page.locator('#sag-annotation').text_content() == '60 m dip'
    assert page.locator('[aria-pressed="true"]').count() == 0
    page.locator('#sag').fill('220')
    assert page.locator('#pull-value').inner_text() == '76.2'
    assert float(page.locator('#sag-line').get_attribute('y2')) < 344
    page.locator('#sag').focus()
    page.keyboard.press('ArrowLeft')
    assert page.locator('#sag-value').inner_text() == '210 m'
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for viewport in ({'width': 1440, 'height': 900}, {'width': 375, 'height': 812}, {'width': 320, 'height': 700}):
        page = browser.new_page(viewport=viewport)
        check(page)
        page.close()
    browser.close()
print('Browser checks passed at desktop and mobile sizes.')
