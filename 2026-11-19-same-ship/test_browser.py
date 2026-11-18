"""Run with Python, Playwright and Chromium to exercise the offline page."""
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

URL = Path(__file__).resolve().with_name('index.html').as_uri()


def main():
    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(URL)
        slider = page.get_by_role('slider', name='Refit progress')
        replace = page.get_by_role('button', name='Replace a plank')
        undo = page.get_by_role('button', name='Undo')
        reset = page.get_by_role('button', name='Reset')
        verdict = page.locator('#verdict')
        expect(verdict).to_have_text('Berth A')
        expect(undo).to_be_disabled()
        expect(reset).to_be_disabled()
        page.get_by_role('radio', name='Its original wood').check()

        def boards():
            return page.locator('canvas').evaluate_all('docks => docks.map(dock => dock.toDataURL())')

        checkpoints = []
        for transferred in range(9):
            expect(slider).to_have_value(str(transferred))
            expect(slider).to_have_attribute('aria-valuetext', f'{transferred} of 8 planks replaced')
            expect(page.locator('#repaired-count')).to_have_text(f'{8 - transferred} / 8')
            expect(page.locator('#rebuilt-count')).to_have_text(f'{transferred} / 8')
            expected = 'Berth A' if transferred < 4 else 'Berth B' if transferred > 4 else 'A tie'
            expect(verdict).to_have_text(expected)
            checkpoint = boards()
            if checkpoints:
                assert all(current != previous for current, previous in zip(checkpoint, checkpoints[-1]))
            checkpoints.append(checkpoint)
            if transferred < 8:
                replace.click()

        expect(replace).to_be_disabled()
        page.get_by_role('radio', name='Its history').check()
        expect(verdict).to_have_text('Berth A')
        undo.click()
        assert boards() == checkpoints[7]
        slider.press('Home')
        expect(reset).to_be_disabled()
        assert boards() == checkpoints[0]
        slider.press('ArrowRight')
        assert boards() == checkpoints[1]
        slider.press('End')
        assert boards() == checkpoints[8]
        reset.click()
        expect(page.get_by_role('radio', name='Its history')).to_be_checked()
        assert boards() == checkpoints[0]

        for width in (320, 390, 768, 1024):
            page.set_viewport_size({'width': width, 'height': 844})
            assert page.evaluate('document.documentElement.scrollWidth === innerWidth'), width
        page.set_viewport_size({'width': 390, 'height': 844})
        replace.click()
        expect(slider).to_have_value('1')
        assert not errors, errors
        browser.close()
    print('Offline app passed all nine stages, both rules, undo, reset, keyboard and narrow layouts.')


if __name__ == '__main__':
    main()
