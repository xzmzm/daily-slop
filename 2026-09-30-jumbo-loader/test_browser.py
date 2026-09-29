"""Exercise the real loader UI: placement flow, verdicts, missions, sandbox, screens."""
from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent
SOLUTIONS = {
    0: {'machinery': ['m7', 'm8'], 'pallet': ['m4', 'l4', 'l5'], 'mail': ['l0']},
    1: {'engine': ['m3'], 'machinery': ['m5', 'l5', 'm6', 'm7'], 'mail': ['l2', 'm8']},
    2: {'gold': ['l3', 'm5', 'l6', 'm6'], 'flowers': ['m1', 'm4', 'l5'], 'mail': ['l0']},
}


def main():
    evidence = Path(tempfile.mkdtemp(prefix='jumbo-loader-checks-'))
    errors, external = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1100}, reduced_motion='reduce')
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: external.append(r.url) if r.url.startswith('http') else None)
        page.goto((PROJECT / 'index.html').as_uri())
        page.wait_for_function('!!window.jumboLoader')
        page.screenshot(path=str(evidence / 'desktop.png'), full_page=True)

        # initial readouts: empty 747
        assert page.locator('#zfw').inner_text() == '354,000 lb'
        assert page.locator('#cg').inner_text() == '24.0 %MAC'
        assert page.locator('#door-state').inner_text() == 'NOSE DOOR OPEN'
        assert page.locator('.slot.free').count() == 16

        # selecting an item arms every empty slot
        page.locator('#manifest li button').nth(0).click()
        assert page.locator('.slot.arm').count() == 16
        # place machinery all the way forward -> nose-heavy verdict, CG pulled forward
        page.locator('#slot-m0').click()
        assert page.locator('.slot.arm').count() == 0
        cg = float(page.locator('#cg').inner_text().split()[0])
        assert cg < 13
        assert 'Nose-heavy' in page.locator('#verdict').inner_text()
        # dispatching a bad load must refuse and keep the nose door open
        page.locator('#dispatch').click()
        assert page.evaluate('jumboLoader.getState().dispatched.kind') == 'nose'
        assert page.locator('#door-state').inner_text() == 'NOSE DOOR OPEN'
        # clicking the loaded container returns it to the manifest
        page.locator('#slot-m0').click()
        assert page.locator('#manifest button:not(.loaded)').count() == 6

        # mission 1 full solution dispatches, closes the nose door, taxis
        for index in range(6):
            page.locator('#manifest li button').nth(index).click()
            slot = SOLUTIONS[0][page.evaluate(f'jumboLoader.getState().items[{index}].type')].pop()
            page.locator(f'#slot-{slot}').click()
        assert 'Dispatch cleared' in page.locator('#verdict').inner_text()
        assert 'ok' in page.locator('#verdict').get_attribute('class')
        page.locator('#dispatch').click()
        page.wait_for_timeout(400)
        assert page.locator('#door-state').inner_text() == 'NOSE DOOR CLOSED'
        page.screenshot(path=str(evidence / 'dispatched.png'))
        # unloading after a dispatch reopens the door
        page.locator('#unload').click()
        assert page.locator('#door-state').inner_text() == 'NOSE DOOR OPEN'

        # missions 2 and 3 also carry authored solutions
        for mission, solution in [(1, SOLUTIONS[1]), (2, SOLUTIONS[2])]:
            page.locator(f'[data-mission="{mission}"]').click()
            assert page.evaluate('jumboLoader.getState().mission') == mission
            live = dict(solution)
            for index in range(page.locator('#manifest li button').count()):
                page.locator('#manifest li button').nth(index).click()
                kind = page.evaluate(f'jumboLoader.getState().items[{index}].type')
                page.locator(f'#slot-{live[kind].pop()}').click()
            assert 'Dispatch cleared' in page.locator('#verdict').inner_text(), mission

        # sandbox: catalog adds cargo, enough machinery overloads the zero-fuel weight
        page.locator('[data-mission="3"]').click()
        assert page.locator('#catalog').is_visible()
        for _ in range(19):
            page.locator('[data-add="machinery"]').click()
        slots = page.evaluate('[...document.querySelectorAll(".slot.free")].map(g => g.dataset.slot)')
        for index in range(13):
            page.locator('#manifest li button').nth(index).click()
            page.locator(f'#slot-{slots[index]}').click()
        assert 'Over maximum zero-fuel weight' in page.locator('#verdict').inner_text()
        page.locator('#dispatch').click()
        assert page.evaluate('jumboLoader.getState().dispatched.kind') == 'weight'
        assert page.locator('#door-state').inner_text() == 'NOSE DOOR OPEN'

        # keyboard: focus a slot and place with Enter
        page.locator('[data-mission="0"]').click()
        page.locator('#manifest li button').nth(0).click()
        page.locator('#slot-m4').focus()
        page.keyboard.press('Enter')
        assert page.locator('#slot-m4.loaded').count() == 1

        # narrow screens stack without horizontal scroll
        for width in (390, 768, 1920):
            page.set_viewport_size({'width': width, 'height': 1000})
            page.wait_for_timeout(120)
            overflow = page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            assert overflow <= 0, (width, overflow)
        page.set_viewport_size({'width': 1440, 'height': 1100})
        page.screenshot(path=str(evidence / 'final.png'), full_page=True)

        # touch tapping works through the pointer path
        phone = browser.new_page(viewport={'width': 390, 'height': 1000}, has_touch=True)
        phone.on('pageerror', lambda e: errors.append(str(e)))
        phone.goto((PROJECT / 'index.html').as_uri())
        phone.wait_for_function('!!window.jumboLoader')
        phone.locator('#manifest li button').nth(0).tap()
        phone.locator('#slot-m5').tap()
        assert phone.locator('#slot-m5.loaded').count() == 1
        phone.close()
        browser.close()
    assert not errors, errors
    assert not external, external
    print(f'browser checks passed; evidence in {evidence}')


if __name__ == '__main__':
    main()
