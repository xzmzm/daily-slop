"""Verify the parked balance, turning load and solved puzzle in Chromium."""
from pathlib import Path
import unittest

from playwright.sync_api import expect, sync_playwright

URL = Path(__file__).with_name('index.html').resolve().as_uri()


class WheelTest(unittest.TestCase):
    def test_turn_and_swap(self):
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page(viewport={'width': 1280, 'height': 800})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.clock.install(time='2026-11-22T09:00:00+08:00')
            page.goto(URL)
            page.clock.pause_at('2026-11-22T10:00:00+08:00')
            torque = page.locator('#torque')
            peak = page.locator('#peak')
            angle = page.locator('#angle')
            turn = page.locator('#turn')
            reset = page.locator('#reset')
            expect(torque).to_have_text('0.0')
            expect(peak).to_have_text('8.5')

            turn.click()
            page.clock.run_for(1500)
            expect(turn).to_have_text('Pause turn')
            expect(torque).to_have_text('+8.5')
            expect(page.locator('#direction')).to_have_text('Clockwise')
            turn.click()
            angle.fill('270')
            expect(torque).to_have_text('−8.5')
            expect(page.locator('#direction')).to_have_text('Counterclockwise')
            reset.click()

            cabin_h = page.get_by_role('button', name='Cabin H, 6 riders')
            cabin_h.press('Space')
            expect(cabin_h).to_have_attribute('aria-pressed', 'true')
            cabin_h.press('Escape')
            expect(cabin_h).to_have_attribute('aria-pressed', 'false')
            cabin_h.click()
            page.get_by_role('button', name='Cabin F, 0 riders').click()
            expect(peak).to_have_text('0.0')
            expect(page.locator('#verdict')).to_have_text('Balanced through the entire turn.')
            for position in ('30', '90', '180', '270', '360'):
                angle.fill(position)
                expect(torque).to_have_text('0.0')

            turn.click()
            page.clock.run_for(6100)
            expect(angle).to_have_value('360')
            expect(turn).to_have_text('Run one turn')
            reset.click()
            expect(peak).to_have_text('8.5')
            self.assertEqual(errors, [])
            browser.close()

    def test_small_screen_has_usable_cabin_buttons(self):
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page(viewport={'width': 320, 'height': 740}, is_mobile=True, has_touch=True)
            page.goto(URL)
            self.assertEqual(page.evaluate('document.documentElement.scrollWidth'), 320)
            page.get_by_role('button', name='Cabin H, 6 riders').tap()
            page.get_by_role('button', name='Cabin F, 0 riders').tap()
            expect(page.locator('#peak')).to_have_text('0.0')
            browser.close()


if __name__ == '__main__':
    unittest.main()
