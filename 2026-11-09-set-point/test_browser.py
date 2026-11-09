#!/usr/bin/env python3
"""Check the cascade model and page behaviour in Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent


def text(page, selector):
    return page.locator(selector).inner_text()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((PROJECT / 'index.html').as_uri(), wait_until='load')

    # Steady state: line 1 carries about the recorded 356 MW, nothing tripped.
    assert round(page.evaluate('SetPoint.rideThrough(0)')) == 356
    assert 'L1 356 MW' in page.locator('#board').text_content()
    assert text(page, '#r-trips') == '0' and text(page, '#r-dark') == '0.0 M'
    assert text(page, '#r-peak') == '376 MW' and 'over' in text(page, '#r-margin')

    # 1963 setting + 100 MW swing: all five Beck–Toronto lines go, then the dark spreads.
    page.evaluate('SetPointApp.run(true)')
    r = page.evaluate('SetPoint.cascade(375, 100)')
    trips = [e for e in r['events'] if e['kind'] == 'trip']
    assert [e['line'] for e in trips[:5]] == [0, 1, 2, 3, 4], trips
    assert r['darkPop'] > 25, r['darkPop']
    darks = [e for e in r['events'] if e['kind'] == 'dark']
    assert darks[0]['buses'] == ['tor'], darks
    assert 'nyc' in darks[-1]['buses'] and 'bos' in darks[-1]['buses']
    assert text(page, '#r-dark') == f"{r['darkPop']:.1f} M"
    assert 'Beck–Toronto 1 trips at 376 MW' in text(page, '#log')
    assert 'PEOPLE IN THE DARK' in text(page, '#board-sub')

    # Raised setting: the same swing rides through.
    page.locator('[data-set="500"]').click()
    assert text(page, '#setpoint-out') == '500'
    page.evaluate('SetPointApp.run(true)')
    assert text(page, '#r-trips') == '0' and text(page, '#r-dark') == '0.0 M'
    assert 'The relays hold' in text(page, '#log')

    # No swing at 375 holds too; a low setting fails even without a swing.
    assert page.evaluate('SetPoint.cascade(375, 0).events.length') == 0
    assert page.evaluate('SetPoint.cascade(330, 0).darkPop') > 25

    # Animated run steps through and finishes.
    page.locator('[data-set="375"]').click()
    page.locator('#run').click()
    page.wait_for_function("!document.getElementById('run').disabled", timeout=15000)
    assert text(page, '#r-trips') == '7', text(page, '#r-trips')

    for width in (320, 390, 768, 1024, 1440):
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), width
    assert not errors, errors
    browser.close()

print('Set Point browser checks passed.')
