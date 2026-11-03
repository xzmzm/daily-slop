#!/usr/bin/env python3
"""Check the election-night model and page behaviour in Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent


def text(page, selector):
    return page.locator(selector).inner_text()


def jump(page, step):
    page.locator('#time').fill(str(step))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((PROJECT / 'index.html').as_uri(), wait_until='load')

    # The table matches the real 1952 split.
    assert page.evaluate('EarlyReturns.TOTAL_EV') == 531
    assert page.evaluate("EarlyReturns.STATES.filter(s => s.r52 > 50).reduce((a, s) => a + s.ev, 0)") == 442

    # 8:30 pm: Stevenson leads the raw count, but the swing projection calls it for Ike.
    assert text(page, '#clock') == '8:30 PM'
    assert text(page, '#r-counted') == '5.6 %'
    assert float(text(page, '#r-raw').split()[0]) < 50
    assert text(page, '#tt-odds') == 'CHANCES ARE 100 TO 1 IN FAVOR OF EISENHOWER', text(page, '#tt-odds')
    assert int(text(page, '#p-r')) >= 266

    # The typo pulls the odds down to roughly a coin toss.
    page.locator('[data-typo="1"]').click()
    odds = text(page, '#tt-odds')
    assert '100 TO 1' not in odds, odds
    p_ike = page.evaluate('EarlyReturns.snapshot(EarlyReturns.buildNation(), 20.5, true).pIke')
    assert 0.25 < p_ike < 0.75, p_ike
    page.locator('[data-typo="0"]').click()

    # Before polls close there are no returns.
    jump(page, 0)
    assert text(page, '#tt-odds') == 'AWAITING RETURNS'
    assert text(page, '#r-raw') == '—'

    # By 4 am everything is in and the count matches the result.
    page.locator('[data-jump="108"]').click()
    assert text(page, '#clock') == '4:00 AM'
    assert text(page, '#r-counted') == '100.0 %'
    assert text(page, '#p-r') == '442' and text(page, '#p-d') == '89'
    assert 'Eisenhower 442, Stevenson 89' in text(page, '#verdict')

    # The count view greys states with no returns.
    page.locator('[data-jump="18"]').click()
    page.locator('[data-view="count"]').click()
    assert text(page, '#map-sub') == '/ COUNT SO FAR'
    grey = page.evaluate("[...document.querySelectorAll('.tile rect')].filter(r => r.getAttribute('fill') === 'var(--none)').length")
    assert 30 < grey < 48, grey

    page.locator('#play').click()
    page.wait_for_timeout(400)
    assert int(page.locator('#time').input_value()) > 18
    page.locator('#play').click()

    for width in (320, 390, 768, 1024, 1440):
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), width
    assert not errors, errors
    browser.close()

print('Early Returns browser checks passed.')
