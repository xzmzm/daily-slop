#!/usr/bin/env python3
"""Exercise the local experiment, including its directional model and layout."""
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent


def integer(locator):
    return int(locator.inner_text().replace(',', '').replace('−', '-'))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((PROJECT / 'index.html').as_uri(), wait_until='load')
    assert page.locator('#chart button').count() == 17
    assert page.locator('#angle-value').inner_text() == '+18°'
    count30 = integer(page.locator('#count-value'))
    reference30 = integer(page.locator('#reference-value'))
    assert count30 - reference30 > 100, (count30, reference30)
    assert page.locator('#cavity').get_attribute('opacity') == '0'
    # All four corners of the illustrated cavity must be inside the pyramid.
    cavity = page.locator('#cavity rect')
    x, y = float(cavity.get_attribute('x')), float(cavity.get_attribute('y'))
    w, h = float(cavity.get_attribute('width')), float(cavity.get_attribute('height'))
    for cx in (x, x + w):
        for cy in (y, y + h):
            half_width = (cy - 75) * 422 / 455
            assert 500 - half_width < cx < 500 + half_width

    page.locator('#reveal').click()
    assert page.locator('#reveal').get_attribute('aria-pressed') == 'true'
    assert page.locator('#cavity').get_attribute('opacity') == '1'
    assert integer(page.locator('#count-value')) == count30
    page.locator('#reveal').click()
    assert page.locator('#cavity').get_attribute('opacity') == '0'

    page.locator('[data-days="7"]').click()
    count7 = integer(page.locator('#count-value'))
    page.locator('[data-days="90"]').click()
    count90 = integer(page.locator('#count-value'))
    assert 0 < count7 < count30 < count90
    page.locator('[data-days="30"]').click()
    assert integer(page.locator('#count-value')) == count30

    # The opposite ray misses the cavity; its sampled count stays near the
    # same solid-stone expectation. The scene must follow the selected bar.
    page.locator('#chart button').nth(5).click()
    assert page.locator('#angle-value').inner_text() == '−18°'
    assert page.locator('#scene-angle').inner_text() == '−18°'
    assert abs(integer(page.locator('#count-value')) - integer(page.locator('#reference-value'))) < 60
    assert page.locator('#chart button').nth(5).get_attribute('aria-pressed') == 'true'
    assert page.evaluate('document.activeElement === document.querySelectorAll("#chart button")[5]')

    for width in (320, 390, 768, 1024, 1440):
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), width
        assert page.locator('#chart button').count() == 17
        assert page.locator('#reveal').is_visible()
    assert not errors, errors
    browser.close()

print('Through Stone browser checks passed.')
