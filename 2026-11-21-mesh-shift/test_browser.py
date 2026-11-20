"""Verify deterministic sampling and the real, offline app in Chromium."""
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

URL = Path(__file__).with_name('index.html').resolve().as_uri()


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={'width': 1280, 'height': 800}, offline=True)
        errors, requests = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append(request.url))
        page.clock.install(time='2026-11-21T09:00:00+08:00')
        page.goto(URL)
        page.clock.pause_at('2026-11-21T10:00:00+08:00')
        result = page.evaluate('''() => {
          const school = survey.createSchool();
          const meshes = [5, 7, 9].map(mesh => survey.summarize(school, mesh));
          return {
            fixedSchool: JSON.stringify(school) === JSON.stringify(survey.createSchool()),
            counts: meshes.map(mesh => mesh.retained),
            means: meshes.map(mesh => mesh.mean.toFixed(1)),
            balanced: meshes.every(mesh => mesh.bins.reduce((sum, bin) => sum + bin.school, 0) === school.length
                && mesh.bins.reduce((sum, bin) => sum + bin.sample, 0) === mesh.retained),
            nested: meshes.slice(1).every((mesh, i) => mesh.fish.every((fish, j) =>
              !fish.retained || meshes[i].fish[j].retained)),
          };
        }''')
        assert result == {
            'fixedSchool': True, 'counts': [47, 25, 11], 'means': ['36.0', '40.5', '44.8'],
            'balanced': True, 'nested': True,
        }, result

        tow = page.locator('#tow')
        net = page.locator('#transect')
        expect(page.locator('#retained')).to_have_text('47')
        expect(page.locator('#phase')).to_have_text('Ready to tow')
        before = net.evaluate('canvas => canvas.toDataURL()')
        tow.click()
        page.clock.run_for(500)
        expect(tow).to_be_disabled()
        assert net.evaluate('canvas => canvas.toDataURL()') != before
        page.clock.run_for(2000)
        expect(page.locator('#phase')).to_have_text('Tow complete')
        expect(page.locator('#readout-label')).to_have_text('Observed sample')
        caught = net.evaluate('canvas => canvas.toDataURL()')
        tow.click()
        page.clock.run_for(2400)
        assert net.evaluate('canvas => canvas.toDataURL()') == caught

        page.get_by_role('radio', name='5 cm').press('ArrowRight')
        expect(page.locator('#retained')).to_have_text('25')
        tow.click()
        page.clock.run_for(300)
        page.get_by_role('radio', name='9 cm').check()
        page.clock.run_for(3000)
        expect(page.locator('#phase')).to_have_text('Ready to tow')
        expect(page.locator('#retained')).to_have_text('11')
        expect(page.locator('#mean')).to_have_text('44.8 cm')
        expect(page.get_by_role('listitem', name='20–29 cm, 0 sampled out of 23 in the school')).to_be_visible()

        for width in (320, 390, 620, 768, 1280):
            page.set_viewport_size({'width': width, 'height': 800})
            assert page.evaluate('document.documentElement.scrollWidth === innerWidth'), width

        mobile = browser.new_page(viewport={'width': 390, 'height': 844}, has_touch=True,
                                  reduced_motion='reduce', offline=True)
        mobile.on('pageerror', lambda error: errors.append(str(error)))
        mobile.goto(URL)
        mobile.locator('#tow').tap()
        expect(mobile.locator('#phase')).to_have_text('Tow complete')
        assert not errors, errors
        assert all(url.startswith('file:') for url in requests), requests
        browser.close()
    print('Offline tows, shared school, nested samples, replay, keyboard, reduced motion, and narrow layouts passed.')


if __name__ == '__main__':
    main()
