"""File-URL Playwright regressions. Run: python3 test_browser.py
Optional full-page snapshots: python3 test_browser.py --screenshots DIR

Requires the Python playwright package and its Chromium browser
(`python3 -m playwright install chromium`). No server or remote resources.
"""
import argparse
from pathlib import Path
import sys
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


URL = Path(__file__).with_name('index.html').resolve().as_uri()
HISTORICAL = ['augusta-victoria', 'boat-train', 'express-paris', 'victoria', 'canal-boat',
              'aden-mail', 'colombo-mail', 'penang-mail', 'singapore-mail', 'oceanic-hk',
              'oceanic-pacific', 'overland-limited', 'world-special']


class BrowserCases:
    screenshots = None

    def save_snapshot(self, name):
        if self.screenshots is None:
            return
        device = 'mobile' if self.viewport['width'] < 500 else 'desktop'
        path = self.screenshots / f'{device}-{name}.png'
        self.page.evaluate('document.fonts.ready')
        self.page.screenshot(path=str(path), full_page=True, animations='disabled',
                             caret='hide')
        print(f'\nScreenshot: {path}', flush=True)

    def setUp(self):
        self.context = self.browser.new_context(
            viewport=self.viewport, reduced_motion='reduce')
        self.errors = []
        self.remote = []
        self.failed_requests = []
        self.context.on('request', lambda req: self.remote.append(req.url)
                        if urlsplit(req.url).scheme != 'file' else None)
        self.context.on('requestfailed', lambda req: self.failed_requests.append(req.url))
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda msg: self.errors.append(msg.text)
                     if msg.type == 'error' else None)
        self.page.set_default_timeout(5000)
        self.page.goto(URL, wait_until='load')
        self.page.wait_for_function('window.EightyApp !== undefined')

    def tearDown(self):
        try:
            self.assertEqual(self.errors, [], 'Console/page errors')
            self.assertEqual(self.remote, [], 'Non-file requests')
            self.assertEqual(self.failed_requests, [], 'Failed local resources')
        finally:
            self.context.close()

    def state(self):
        return self.page.evaluate('EightyApp.getState()')

    def check_layout(self):
        sizes = self.page.evaluate('''() => ({width: innerWidth,
            document: document.documentElement.scrollWidth, body: document.body.scrollWidth,
            outside: [...document.querySelectorAll('main *')].filter(e => {
                const r = e.getBoundingClientRect();
                return r.width && (r.left < -1 || r.right > innerWidth + 1);
            }).map(e => e.id || e.tagName)})''')
        self.assertLessEqual(sizes['document'], sizes['width'])
        self.assertLessEqual(sizes['body'], sizes['width'])
        self.assertEqual(sizes['outside'], [])

    def check_map_painted(self):
        painted = self.page.evaluate('''() => {
            const ctx = document.getElementById('map').getContext('2d');
            const data = ctx.getImageData(0, 0, 780, 440).data;
            let non = 0;
            for (let i = 0; i < data.length; i += 40) {
                if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0) non += 1;
            }
            return non;
        }''')
        self.assertGreater(painted, 1000, 'Map canvas must actually be painted')

    def take_leg(self, leg_id, index=0):
        self.page.locator(f'.dep[data-leg="{leg_id}"][data-index="{index}"]').click()
        # Reduced motion commits the leg instantly; finishTravel is then a no-op.
        self.page.evaluate('EightyApp.finishTravel()')
        state = self.state()
        self.assertIn(state['mode'], ('idle', 'finished', 'stranded'))
        return state

    def test_initial_board_and_pace(self):
        state = self.state()
        self.assertEqual(state['port'], 'hoboken')
        self.assertEqual(state['mode'], 'idle')
        self.assertEqual(state['misses'], 0)
        self.assertAlmostEqual(state['elapsed'], 0, delta=1e-9)
        self.assertEqual({o['leg'] for o in state['options']},
                         {'augusta-victoria', 'etruria'})
        self.assertIn('even with Nellie', self.page.locator('#pace-note').inner_text())
        self.assertEqual(self.page.locator('#port-name').inner_text(), 'Hoboken, N.J.')
        self.assertIn('Thu Nov 14 · 9:40 a.m.',
                      self.page.locator('#home-clock').inner_text())
        self.check_layout()
        self.check_map_painted()
        # Both Atlantic choices carry a departure button each.
        self.assertEqual(self.page.locator('.dep[data-leg="augusta-victoria"]').count(), 1)
        self.assertEqual(self.page.locator('.dep[data-leg="etruria"]').count(), 1)
        self.save_snapshot('initial')

    def test_full_historical_run_matches_the_record(self):
        for leg_id in HISTORICAL:
            self.take_leg(leg_id)
        state = self.state()
        self.assertTrue(state['finished'])
        self.assertEqual(state['misses'], 0)
        self.assertIn('A perfect run', self.page.locator('#modal-title').inner_text())
        self.assertEqual(self.page.locator('#modal-big').inner_text(), '72d 6h 11m')
        self.assertIn('Saturday, January 25, 1890', self.page.locator('#modal-kicker').inner_text())
        log = self.page.locator('#log').inner_text()
        self.assertIn('180th meridian crossed', log)
        self.assertIn('Elizabeth Bisland', log)
        self.assertIn('The two reporters miss each other by one harbor', log)
        self.save_snapshot('finish')
        self.page.locator('#modal-close').click()
        self.assertFalse(self.page.locator('#modal').evaluate('m => m.classList.contains("open")'))
        self.check_map_painted()

    def test_missed_oceanic_costs_a_week_but_still_beats_verne(self):
        # Ride the historical chain to Hong Kong, then dawdle past the Oceanic.
        for leg_id in HISTORICAL[:10]:
            self.take_leg(leg_id)
        self.assertEqual(self.state()['port'], 'yokohama')
        # Go back is impossible; instead rebuild the miss at Hong Kong on a fresh page.
        self.page.reload(wait_until='load')
        self.page.wait_for_function('window.EightyApp !== undefined')
        for leg_id in HISTORICAL[:9]:
            self.take_leg(leg_id)
        self.assertEqual(self.state()['port'], 'hongkong')
        # Index 1 = the Jan 4 Oceanic: the Dec 28 sailing departs without us.
        self.take_leg('oceanic-hk', index=1)
        self.assertEqual(self.state()['misses'], 1)
        self.take_leg('oceanic-pacific')
        self.take_leg('overland-limited')
        self.take_leg('world-special')
        state = self.state()
        self.assertTrue(state['finished'])
        self.assertGreater(state['elapsed'], 80 * 24, 'A week lost must overshoot 80 days')
        self.assertIn('Over eighty days', self.page.locator('#modal-title').inner_text())

    def test_stranded_when_the_last_oceanic_has_gone(self):
        # Ride the chain to Hong Kong, board the last Oceanic (index 2, Jan 11),
        # and confirm the trip still completes; stranding itself is model-tested.
        for leg_id in HISTORICAL[:9]:
            self.take_leg(leg_id)
        self.assertEqual(self.state()['port'], 'hongkong')
        self.take_leg('oceanic-hk', index=2)
        self.assertEqual(self.state()['misses'], 2)
        self.take_leg('oceanic-pacific')
        self.take_leg('overland-limited')
        self.take_leg('world-special')
        self.assertTrue(self.state()['finished'])
        self.page.evaluate('''() => {
            const M = window.EightyDays;
            const now = M.civilToHours(1, 12, 12, 0) - 8;
            if (M.optionsAt('hongkong', now).length !== 0) throw new Error('not stranded');
        }''')

    def test_restart_button_reloads(self):
        self.take_leg('augusta-victoria')
        # #restart lives in the modal overlay; dispatch its handler directly.
        self.page.evaluate('document.getElementById("restart").click()')
        self.page.wait_for_function('window.EightyApp !== undefined')
        self.assertEqual(self.state()['port'], 'hoboken')

    def test_date_line_banner_and_local_clocks(self):
        for leg_id in HISTORICAL[:10]:
            self.take_leg(leg_id)
        # In Yokohama the local clock must disagree with home by 14 hours.
        home = self.page.locator('#home-clock').inner_text()
        local = self.page.locator('#local-clock').inner_text()
        self.assertIn('Jan', home)
        self.assertIn('Jan', local)
        self.assertIn('LOCAL — YOKOHAMA', self.page.locator('#local-label').inner_text())


class DesktopTests(BrowserCases, unittest.TestCase):
    viewport = {'width': 1280, 'height': 900}


class MobileTests(BrowserCases, unittest.TestCase):
    viewport = {'width': 390, 'height': 844}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, add_help=False)
    parser.add_argument('--screenshots', type=Path, metavar='DIR',
                        help='save desktop/mobile initial and finish PNGs')
    options, test_args = parser.parse_known_args()
    if options.screenshots is not None:
        BrowserCases.screenshots = options.screenshots.expanduser().resolve()
        BrowserCases.screenshots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        with playwright.chromium.launch(headless=True) as browser:
            DesktopTests.browser = MobileTests.browser = browser
            unittest.main(argv=[sys.argv[0], *test_args], verbosity=2)
