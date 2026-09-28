"""Check real bakery controls, replay invariants, sample totals and small screens."""
from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent


def main():
    evidence = Path(tempfile.mkdtemp(prefix='last-batch-checks-'))
    errors, external = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width':1440,'height':1100},reduced_motion='reduce')
        page.on('pageerror', lambda e:errors.append(str(e)))
        page.on('request', lambda r:external.append(r.url) if r.url.startswith('http') else None)
        page.goto((PROJECT/'index.html').as_uri())
        page.wait_for_function('!!window.lastBatch')
        page.screenshot(path=str(evidence/'desktop.png'),full_page=True)
        assert page.locator('#quantity').input_value() == '24'
        for forecast, optimum in [('regular',25),('split',33),('spike',19)]:
            page.locator(f'[data-forecast="{forecast}"]').click()
            page.locator('#run').click()
            page.wait_for_function('lastBatch.getState().revealed === 30')
            sample = page.evaluate('lastBatch.getState().days')
            assert page.locator('.day.revealed').count() == 30
            expected = page.evaluate('BatchCore.average(lastBatch.getState().q,lastBatch.getState().days,lastBatch.getState().cost)')
            for metric in ['sold','leftover','missed']:
                assert abs(float(page.locator('#'+metric).inner_text())-expected[metric]) <= .051
            page.locator('[data-day="0"]').click()
            assert page.locator('#tray-title').inner_text() == 'Morning 01'
            assert str(sample[0])+' customers' in page.locator('#tray-note').inner_text()
            if page.locator('#answer').is_hidden():page.locator('#reveal').click()
            assert page.locator('#best-quantity').inner_text() == str(optimum)
            page.locator('#use-best').click()
            assert page.locator('#quantity').input_value() == str(optimum)
            assert page.evaluate('lastBatch.getState().revealed') == 0
            page.locator('#run').click()
            page.wait_for_function('lastBatch.getState().revealed === 30')
            assert sample == page.evaluate('lastBatch.getState().days')
        page.screenshot(path=str(evidence/'rare-rush.png'),full_page=True)
        old = page.evaluate('lastBatch.getState().days')
        page.locator('#new-month').click()
        assert page.evaluate('lastBatch.getState().days') != old
        assert page.evaluate('lastBatch.getState().revealed') == 0
        # Native keyboard behavior reaches both oven limits and changes costs.
        page.locator('#quantity').focus();page.keyboard.press('Home')
        assert page.locator('#quantity').input_value() == '0'
        assert page.locator('#sold').inner_text() == '0.0'
        assert page.locator('#margin').inner_text() == '$0.00'
        page.keyboard.press('End')
        assert page.locator('#quantity').input_value() == '48'
        assert page.locator('#missed').inner_text() == '0.0'
        page.locator('#cost').focus();page.keyboard.press('End')
        assert page.locator('#cost-value').inner_text() == '$2.50'
        assert page.locator('#margin').inner_text().startswith('−$')
        for width in [320,390,768,1280,1920]:
            page.set_viewport_size({'width':width,'height':1080})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        page.set_viewport_size({'width':1280,'height':800})
        page.evaluate('window.scrollTo(0,0)')
        button=page.locator('#run').bounding_box()
        assert button['y']+button['height'] <= 800, button
        page.screenshot(path=str(evidence/'short-desktop.png'))
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(evidence/'mobile.png'),full_page=True)
        # A normal-motion run must cancel cleanly when a control changes.
        page.emulate_media(reduced_motion='no-preference')
        page.locator('#run').click()
        page.wait_for_function('lastBatch.getState().revealed > 2')
        page.locator('[data-forecast="regular"]').click()
        page.wait_for_timeout(250)
        assert page.evaluate('lastBatch.getState().revealed') == 0
        assert not page.evaluate('lastBatch.getState().running')
        # Touch controls and normal-motion completion work independently.
        touch = browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mobile = touch.new_page()
        mobile.on('pageerror',lambda e:errors.append(str(e)))
        mobile.goto((PROJECT/'index.html').as_uri())
        mobile.locator('[data-forecast="split"]').tap()
        mobile.locator('#run').tap()
        mobile.wait_for_function('lastBatch.getState().revealed === 30')
        mobile.locator('[data-day="4"]').tap()
        assert mobile.locator('#tray-title').inner_text() == 'Morning 05'
        mobile.locator('#reveal').tap()
        assert mobile.locator('#best-quantity').inner_text() == '33'
        browser.close()
    assert not errors, errors
    assert not external, external
    print('PASS: three forecasts, expected optimum, actual sample totals, replay, new month, day inspection, keyboard limits, cost changes, cancellation, touch, 320–1920 px; no errors or external requests.')
    print('Evidence:',evidence)


if __name__ == '__main__':main()
