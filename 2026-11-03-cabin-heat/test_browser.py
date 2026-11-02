#!/usr/bin/env python3
"""Check the cabin heat model and page behaviour in Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent


def pick(page, key, value):
    page.locator(f'.switch[data-key="{key}"] button[data-value="{value}"]').click()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((PROJECT / 'index.html').as_uri(), wait_until='load')

    # As flown: passes 40 °C a few hours in.
    assert page.locator('#r-cross').inner_text() == '4 h 33 m'
    assert page.locator('[data-preset="flown"]').get_attribute('aria-pressed') == 'true'
    assert page.locator('#core-stage').is_visible()

    # Fixing only the insulation is not enough.
    pick(page, 'torn', 0)
    assert page.locator('#r-cross').inner_text() == '6 h 09 m', page.locator('#r-cross').inner_text()
    assert not page.locator('#torn').is_visible()

    # Separating only the core stage keeps the cabin under 40 °C for good.
    pick(page, 'torn', 1)
    pick(page, 'stage', 0)
    assert page.locator('#r-cross').inner_text() == 'never'
    assert float(page.locator('#r-settle').inner_text().split()[0]) < 40
    assert not page.locator('#core-stage').is_visible()

    # Fan off with the design craft still warms past 40 °C eventually.
    page.locator('[data-preset="designed"]').click()
    assert page.locator('#r-settle').inner_text() == '14.4 °C'
    pick(page, 'fan', 0)
    assert float(page.locator('#r-settle').inner_text().split()[0]) > 40
    assert page.locator('#r-cross').inner_text() == 'never'

    # Scrubbing into Earth's shadow drops the solar input.
    page.locator('[data-preset="flown"]').click()
    page.locator('#time').fill('80')
    assert 'SHADOW' in page.locator('#sun-state').inner_text()
    assert page.locator('#w-in').inner_text() == '40 W'
    page.locator('#time').fill('20')
    assert 'SUNLIGHT' in page.locator('#sun-state').inner_text()
    assert page.locator('#w-in').inner_text() == '144 W'

    page.locator('#play').click()
    page.wait_for_timeout(400)
    assert int(page.locator('#time').input_value()) > 20
    page.locator('#play').click()

    for width in (320, 390, 768, 1024, 1440):
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), width
    assert not errors, errors
    browser.close()

print('Cabin Heat browser checks passed.')
