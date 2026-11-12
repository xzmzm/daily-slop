"""File-URL Playwright regressions. Run: python3 test_browser.py
Optional full-page snapshots: python3 test_browser.py --screenshots DIR

Requires the Python playwright package and its Chromium browser
(`python3 -m playwright install chromium`). No server or remote resources.
"""
import argparse
import math
from pathlib import Path
import sys
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


URL = Path(__file__).with_name('index.html').resolve().as_uri()
PAIRS = (((0, 1), (2, 3)), ((0, 3), (2, 1)))
PORTS = ((50, 0), (100, 50), (50, 100), (0, 50))
CENTERS = (((100, 0), (0, 100)), ((0, 0), (100, 100)))


def components(board):
    """Independent arc-graph oracle, not the application's analyzer."""
    unseen = set(range(128))
    result = []
    while unseen:
        pending = [min(unseen)]
        members, boundary = set(), 0
        while pending:
            sid = pending.pop()
            if sid in members:
                continue
            members.add(sid)
            unseen.discard(sid)
            tile, arc = divmod(sid, 2)
            row, col = divmod(tile, 8)
            for edge in PAIRS[board[tile]][arc]:
                nr = row + (-1, 0, 1, 0)[edge]
                nc = col + (0, 1, 0, -1)[edge]
                if not (0 <= nr < 8 and 0 <= nc < 8):
                    boundary += 1
                    continue
                neighbor = nr * 8 + nc
                other = next(a for a, ports in enumerate(PAIRS[board[neighbor]])
                             if (edge + 2) % 4 in ports)
                pending.append(neighbor * 2 + other)
        result.append((members, boundary == 0))
    return result


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
        self.context = self.browser.new_context(viewport=self.viewport,
                                                is_mobile=self.viewport['width'] < 500,
                                                has_touch=self.viewport['width'] < 500)
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
        self.page.wait_for_function('window.LoopApp !== undefined')

    def tearDown(self):
        try:
            self.assertEqual(self.errors, [], 'Console/page errors')
            self.assertEqual(self.remote, [], 'Non-file requests')
            self.assertEqual(self.failed_requests, [], 'Failed local resources')
        finally:
            self.context.close()

    def state(self):
        return self.page.evaluate('LoopApp.getState()')

    def tile(self, index):
        return self.page.locator(f'[data-tile="{index}"]')

    def check_state(self):
        state = self.state()
        self.assertEqual(len(state['board']), 64)
        self.assertTrue(all(type(x) is int and x in (0, 1) for x in state['board']))
        oracle = components(state['board'])
        loops = [members for members, closed in oracle if closed]
        self.assertEqual(state['loops'], len(loops))
        self.assertEqual(state['longestLoop'], max(map(len, loops), default=0))
        for selector, value in (('#loop-count', state['loops']),
                                ('#longest', state['longestLoop']),
                                ('#turns', state['turns'])):
            self.assertEqual(self.page.locator(selector).inner_text(), str(value))
        self.assertEqual(self.page.locator('#rotate-mode').get_attribute('aria-pressed'),
                         str(state['mode'] == 'rotate').lower())
        self.assertEqual(self.page.locator('#trace-mode').get_attribute('aria-pressed'),
                         str(state['mode'] == 'trace').lower())
        actual_closed = self.page.locator('.tile').evaluate_all('''tiles => tiles.flatMap(
            (tile, i) => [...tile.querySelectorAll('path')].flatMap(
                (p, a) => p.classList.contains('loop') ? [i * 2 + a] : []))''')
        self.assertEqual(set(actual_closed), set().union(*loops) if loops else set())
        return state

    def check_selection(self, sid):
        state = self.check_state()
        expected, closed = next(c for c in components(state['board']) if sid in c[0])
        analysis = self.page.evaluate('LoopModel.analyze(LoopApp.getState().board)')
        self.assertEqual(state['selected'], analysis['segmentComponent'][sid])
        highlighted = self.page.locator('.tile').evaluate_all('''tiles => tiles.flatMap(
            (tile, i) => [...tile.querySelectorAll('path')].flatMap(
                (p, a) => p.classList.contains('selected') ? [i * 2 + a] : []))''')
        self.assertEqual(set(highlighted), expected)
        self.assertTrue(self.page.locator('#thread-detail').inner_text().startswith(
            f'{len(expected)} curved arcs ·'))
        self.assertEqual(self.page.locator('#thread-title').inner_text(),
                         'This thread comes home.' if closed else 'This one leaves the field.')

    def load_seed(self, seed):
        self.page.locator('#seed').fill(seed)
        self.page.locator('#seed').press('Enter')
        return self.check_state()

    def test_layout_and_initial_counters(self):
        self.assertEqual(self.page.locator('.tile').count(), 64)
        self.assertEqual(self.page.locator('.tile svg path').count(), 128)
        self.assertEqual(self.page.locator('.tile:visible').count(), 64)
        sizes = self.page.evaluate('''() => ({width: innerWidth,
            document: document.documentElement.scrollWidth, body: document.body.scrollWidth,
            outside: [...document.querySelectorAll('main *')].filter(e => {
                const r = e.getBoundingClientRect();
                return r.width && (r.left < -1 || r.right > innerWidth + 1);
            }).map(e => e.id || e.tagName)})''')
        self.assertLessEqual(sizes['document'], sizes['width'])
        self.assertLessEqual(sizes['body'], sizes['width'])
        self.assertEqual(sizes['outside'], [])
        state = self.check_state()
        self.assertEqual(state['turns'], 0)
        self.assertEqual(state['mode'], 'rotate')
        self.assertIsNone(state['selected'])
        self.assertFalse(state['challenge'])
        self.save_snapshot('initial')

    def test_svg_corner_geometry_and_connected_endpoints(self):
        # getPointAtLength catches a reversed sweep even when endpoints are correct.
        data = self.page.locator('.tile').evaluate_all('''tiles => tiles.map(tile =>
            [...tile.querySelectorAll('path')].map(p => {
                const length = p.getTotalLength(), matrix = p.getScreenCTM();
                const points = Array.from({length: 17}, (_, i) => {
                    const q = p.getPointAtLength(length * i / 16);
                    const screen = new DOMPoint(q.x, q.y).matrixTransform(matrix);
                    return {x: q.x, y: q.y, sx: screen.x, sy: screen.y};
                });
                const style = getComputedStyle(p);
                return {length, points, stroke: style.stroke, fill: style.fill,
                        width: parseFloat(style.strokeWidth)};
            }))''')
        board = self.state()['board']
        self.assertEqual(set(board), {0, 1}, 'Cover both SVG orientations')
        for tile, arcs in enumerate(data):
            for arc, path in enumerate(arcs):
                with self.subTest(tile=tile, arc=arc):
                    cx, cy = CENTERS[board[tile]][arc]
                    self.assertAlmostEqual(path['length'], math.pi * 25, delta=0.1)
                    self.assertNotIn(path['stroke'], ('none', 'rgba(0, 0, 0, 0)'))
                    self.assertEqual(path['fill'], 'none')
                    self.assertGreater(path['width'], 0)
                    for point in path['points']:
                        self.assertAlmostEqual(math.hypot(point['x'] - cx, point['y'] - cy),
                                               50, delta=0.08,
                                               msg=f'Wrong circle center for tile {tile}, arc {arc}')
                        self.assertTrue(-0.05 <= point['x'] <= 100.05)
                        self.assertTrue(-0.05 <= point['y'] <= 100.05)
                    for point, edge in zip((path['points'][0], path['points'][-1]),
                                           PAIRS[board[tile]][arc]):
                        self.assertAlmostEqual(point['x'], PORTS[edge][0], delta=0.01)
                        self.assertAlmostEqual(point['y'], PORTS[edge][1], delta=0.01)
                        row, col = divmod(tile, 8)
                        nr, nc = row + (-1, 0, 1, 0)[edge], col + (0, 1, 0, -1)[edge]
                        if 0 <= nr < 8 and 0 <= nc < 8:
                            neighbor = nr * 8 + nc
                            other_arc = next(a for a, ports in enumerate(PAIRS[board[neighbor]])
                                             if (edge + 2) % 4 in ports)
                            endpoint = PAIRS[board[neighbor]][other_arc].index((edge + 2) % 4)
                            other = data[neighbor][other_arc]['points'][0 if endpoint == 0 else -1]
                            self.assertAlmostEqual(point['sx'], other['sx'], delta=0.15)
                            self.assertAlmostEqual(point['sy'], other['sy'], delta=0.15)

    def test_challenge_tile_27_closes_central_four_arc_component(self):
        self.page.locator('#challenge').click()
        before = self.check_state()
        self.assertTrue(before['challenge'])
        self.assertEqual(before['turns'], 0)
        self.assertEqual(self.page.locator('.tile.marked').count(), 1)
        self.assertIn('marked', self.tile(27).get_attribute('class'))
        center = {55, 57, 70, 72}
        self.assertFalse(any(m == center and closed for m, closed in components(before['board'])))
        self.tile(27).click()
        after = self.check_state()
        self.assertEqual([i for i in range(64) if before['board'][i] != after['board'][i]], [27])
        self.assertEqual(after['turns'], 1)
        self.assertTrue(any(m == center and closed for m, closed in components(after['board'])))
        self.assertIn('Loop closed!', self.page.locator('#challenge-status').inner_text())
        self.assertEqual(self.page.locator('.tile.marked').count(), 0)
        self.page.locator('#trace-mode').click()
        self.tile(35).focus()
        self.tile(35).press('Enter')
        self.check_selection(70)
        self.assertEqual(self.page.locator('path.selected').count(), 4)
        self.tile(35).blur()
        self.page.evaluate('window.scrollTo(0, 0)')
        self.save_snapshot('challenge-solved')
        self.page.locator('#reset').click()
        reset = self.check_state()
        self.assertEqual(reset['board'], before['board'])
        self.assertEqual(reset['turns'], 0)
        self.assertTrue(reset['challenge'])
        self.assertIsNone(reset['selected'])
        self.assertIn('Turn the orange-marked tile', self.page.locator('#challenge-status').inner_text())

    def test_position_based_tracing_and_north_keyboard_activation(self):
        initial = self.state()
        self.page.locator('#trace-mode').click()
        # Use actual rendered SVG geometry transformed into tile-local CSS pixels.
        # Exercise each orientation/arc at three interior positions, not tile centers.
        for orientation in (0, 1):
            index = initial['board'].index(orientation)
            for arc in (0, 1):
                for fraction in (0.2, 0.5, 0.8):
                    with self.subTest(orientation=orientation, arc=arc, fraction=fraction):
                        position = self.tile(index).evaluate('''(tile, args) => {
                            const p = tile.querySelectorAll('path')[args.arc];
                            const q = p.getPointAtLength(p.getTotalLength() * args.fraction);
                            const screen = new DOMPoint(q.x, q.y).matrixTransform(p.getScreenCTM());
                            const r = tile.getBoundingClientRect();
                            return {x: screen.x - r.left, y: screen.y - r.top};
                        }''', {'arc': arc, 'fraction': fraction})
                        self.tile(index).click(position=position)
                        self.check_selection(index * 2 + arc)
                for key in ('Enter', 'Space'):
                    self.tile(index).focus()
                    self.tile(index).press(key)
                    self.check_selection(index * 2)
        self.assertEqual(self.state()['board'], initial['board'])
        self.assertEqual(self.state()['turns'], 0)

    def test_arrow_navigation_rotate_enter_and_reset(self):
        before = self.state()
        for source, key, target in ((0, 'ArrowRight', 1), (0, 'ArrowLeft', 63),
                                    (0, 'ArrowUp', 56), (0, 'ArrowDown', 8),
                                    (63, 'ArrowRight', 0), (63, 'ArrowDown', 7)):
            self.tile(source).focus()
            self.tile(source).press(key)
            self.assertEqual(self.page.evaluate('document.activeElement.dataset.tile'), str(target))
        self.assertEqual(self.state(), before, 'Navigation must not rotate')
        self.tile(7).press('Enter')
        changed = self.check_state()
        self.assertEqual(changed['turns'], 1)
        self.assertEqual([i for i in range(64) if changed['board'][i] != before['board'][i]], [7])
        self.assertEqual(changed['board'][7], 1 - before['board'][7])
        self.page.locator('#reset').click()
        self.assertEqual(self.check_state(), before)

    def test_seed_reproducibility_empty_fallback_and_shuffle(self):
        seed = 'regression-loop-环路-13'
        first = self.load_seed('  ' + seed + '  ')
        self.assertEqual(self.page.locator('#seed').input_value(), seed)
        self.tile(12).click()
        self.assertEqual(self.state()['turns'], 1)
        again = self.load_seed(seed)
        self.assertEqual(first, again)
        self.page.reload(wait_until='load')
        self.assertEqual(self.load_seed(seed)['board'], first['board'])
        self.load_seed('different-regression-seed')
        self.assertNotEqual(self.state()['board'], first['board'])
        for blank in ('', '   '):
            fallback = self.load_seed(blank)
            self.assertEqual(self.page.locator('#seed').input_value(), 'november-13')
            self.assertEqual(fallback['board'], self.load_seed('november-13')['board'])
        old_seed = self.page.locator('#seed').input_value()
        old_board = self.state()['board']
        self.page.locator('#shuffle').click()
        new_seed = self.page.locator('#seed').input_value()
        shuffled = self.check_state()
        self.assertRegex(new_seed, r'^field-[0-9a-z]+$')
        self.assertNotEqual(new_seed, old_seed)
        self.assertNotEqual(shuffled['board'], old_board)
        self.assertEqual(shuffled['turns'], 0)
        self.assertFalse(shuffled['challenge'])
        self.assertIsNone(shuffled['selected'])
        self.assertEqual(self.load_seed(new_seed)['board'], shuffled['board'])

    def test_longest_loop_selection_matches_state(self):
        before = self.check_state()
        self.assertGreater(before['loops'], 0)
        self.page.locator('#show-longest').click()
        state = self.check_state()
        self.assertEqual(state['mode'], 'trace')
        analysis = self.page.evaluate('LoopModel.analyze(LoopApp.getState().board)')
        component = analysis['components'][state['selected']]
        self.assertTrue(component['closed'])
        self.assertEqual(component['length'], before['longestLoop'])
        self.check_selection(component['segments'][0]['tile'] * 2 + component['segments'][0]['arc'])


class DesktopTests(BrowserCases, unittest.TestCase):
    viewport = {'width': 1280, 'height': 800}


class MobileTests(BrowserCases, unittest.TestCase):
    viewport = {'width': 390, 'height': 844}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, add_help=False)
    parser.add_argument('--screenshots', type=Path, metavar='DIR',
                        help='save desktop/mobile initial and solved-challenge PNGs')
    options, test_args = parser.parse_known_args()
    if options.screenshots is not None:
        BrowserCases.screenshots = options.screenshots.expanduser().resolve()
        BrowserCases.screenshots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        with playwright.chromium.launch(headless=True) as browser:
            DesktopTests.browser = MobileTests.browser = browser
            unittest.main(argv=[sys.argv[0], *test_args], verbosity=2)
