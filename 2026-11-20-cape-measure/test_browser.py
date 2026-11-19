"""Exercise the buildless page offline with Playwright Chromium."""
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(offline=True, viewport={'width': 1280, 'height': 800})
        page = context.new_page()
        errors, requests = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append(request.url))
        page.clock.install(time='2026-11-20T09:00:00+08:00')
        page.goto(Path(__file__).with_name('index.html').resolve().as_uri())
        page.clock.pause_at('2026-11-20T10:00:00+08:00')
        total = page.locator('#total')
        play, step = page.locator('#play'), page.locator('#step')
        status, reference = page.locator('#progress-text'), page.locator('#reference')
        chart = page.locator('#route')
        terrain = page.locator('#terrain').evaluate('canvas => canvas.toDataURL()')

        expect(total).to_have_text('260.2')
        page.get_by_role('radio', name='12 km', exact=True).press('ArrowLeft')
        expect(total).to_have_text('230.9')
        expect(reference).to_be_disabled()
        expect(page.locator('#breakdown')).to_have_text('9 full steps + 14.9 km to close')
        step.click()
        expect(status).to_have_text('Step 1 of 10')
        for _ in range(9):
            step.click()
        expect(status).to_have_text('Back at Gull Point')

        play.click()
        page.clock.run_for(1700)
        expect(play).to_have_text('Pause walk')
        expect(step).to_be_disabled()
        play.click()
        paused = status.inner_text()
        page.clock.run_for(3000)
        expect(status).to_have_text(paused)
        expect(play).to_have_text('Resume walk')
        play.click()
        page.clock.run_for(7000)
        expect(play).to_have_text('Replay walk')

        for span, distance in [('6', '331.4'), ('3', '389.1')]:
            page.locator(f'.spans label:has([value="{span}"])').click()
            expect(total).to_have_text(distance)
            expect(status).to_have_text('Start at Gull Point')
        original_route = chart.evaluate('canvas => canvas.toDataURL()')
        reference.check()
        expect(page.locator('#reference-key')).to_be_visible()
        expect(page.locator('#comparison')).to_contain_text('158.2 km longer')
        assert original_route != chart.evaluate('canvas => canvas.toDataURL()')
        assert terrain == page.locator('#terrain').evaluate('canvas => canvas.toDataURL()')
        reference.uncheck()
        assert original_route == chart.evaluate('canvas => canvas.toDataURL()')

        play.click()
        page.clock.run_for(500)
        page.get_by_role('button', name='Field notes').click()
        expect(page.get_by_role('dialog')).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.get_by_role('dialog')).to_be_hidden()
        expect(page.get_by_role('button', name='Field notes')).to_be_focused()
        expect(play).to_have_text('Resume walk')
        play.click()
        page.locator('.spans label:has([value="12"])').click()
        page.clock.run_for(17000)
        expect(status).to_have_text('Start at Gull Point')
        expect(total).to_have_text('260.2')

        for width in (320, 390, 768, 1024):
            page.set_viewport_size({'width': width, 'height': 844})
            assert page.evaluate('document.documentElement.scrollWidth === innerWidth'), width
        mobile = browser.new_page(viewport={'width': 390, 'height': 844}, has_touch=True,
                                  reduced_motion='reduce', offline=True)
        mobile.on('pageerror', lambda error: errors.append(str(error)))
        mobile.goto(page.url)
        mobile.locator('#step').tap()
        expect(mobile.locator('#progress-text')).to_have_text('Step 1 of 22')
        assert not errors, errors
        assert all(url.startswith('file:') for url in requests), requests
        browser.close()
    print('Offline chart, four spans, closure, overlay, playback, keyboard and narrow layouts passed.')


if __name__ == '__main__':
    main()
