#!/usr/bin/env python3
"""Check the tiling desktop in Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent


def no_overlap(page, label):
    assert page.evaluate('NoOverlap.model.disjoint(NoOverlap.api.rects())'), label


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1500, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((PROJECT / 'index.html').as_uri(), wait_until='load')

    # Initial desktop: five windows tiled, none overlapping, MS-DOS Executive current.
    assert page.locator('.win').count() == 5
    no_overlap(page, 'initial')
    assert page.evaluate('NoOverlap.state.currentId') == 'dos'
    assert page.locator('#r-current').inner_text() == 'MS-DOS Executive'
    assert '5 tiled' in page.locator('#r-open').inner_text()
    assert page.locator('.sash').count() == 4
    assert page.locator('.win.clash').count() == 0

    # Click a title bar: that window becomes current and takes the big top-left tile.
    page.locator('#win-clock .title-name').click()
    assert page.evaluate('NoOverlap.state.currentId') == 'clock'
    frac = page.evaluate("""(() => {
      const t = document.getElementById('tiles').getBoundingClientRect();
      const w = document.getElementById('win-clock').getBoundingClientRect();
      return [w.width / t.width, w.height / t.height];
    })()""")
    col = page.evaluate('NoOverlap.state.colFrac')
    row = page.evaluate('NoOverlap.state.rowFrac')
    assert abs(frac[0] - col) < 0.01 and abs(frac[1] - row) < 0.02, frac
    no_overlap(page, 'after makeCurrent')

    # Drag the main column sash with the mouse: the split moves, tiles stay disjoint.
    sash = page.locator('.sash[data-kind="main-col"]')
    box = sash.bounding_box()
    y = box['y'] + box['height'] * 0.4
    page.mouse.move(box['x'] + box['width'] / 2, y)
    page.mouse.down()
    page.mouse.move(box['x'] - 90, y, steps=8)
    page.mouse.up()
    col2 = page.evaluate('NoOverlap.state.colFrac')
    assert col2 < col - 0.02, (col, col2)
    assert f'{round(col2 * 100)} %' == page.locator('#r-col').inner_text()
    no_overlap(page, 'after col sash drag')

    # Inner right-column sash moves too.
    rs = page.locator('.sash[data-kind="right"]')
    assert rs.count() == 1
    rbox = rs.bounding_box()
    x = rbox['x'] + rbox['width'] * 0.5
    before = page.evaluate('NoOverlap.state.rightFracs[0]')
    page.mouse.move(x, rbox['y'] + rbox['height'] / 2)
    page.mouse.down()
    page.mouse.move(x, rbox['y'] + 60, steps=8)
    page.mouse.up()
    assert abs(page.evaluate('NoOverlap.state.rightFracs[0]') - before) > 0.03
    no_overlap(page, 'after right sash drag')

    # Iconify a window: it joins the strip; clicking the icon brings it back as current.
    page.locator('#win-clock .sysbox').click()
    assert page.locator('#win-clock').count() == 0
    assert page.locator('.iconified').count() == 1
    assert page.locator('.iconified').inner_text() == 'Clock'
    no_overlap(page, 'iconified')
    page.locator('.iconified').click()
    assert page.evaluate('NoOverlap.state.currentId') == 'clock'
    assert page.locator('#win-clock').count() == 1
    no_overlap(page, 'restored')

    # Zoom: the current window takes everything, the rest wait at the icons.
    page.locator('#win-clock .zoom-btn').click()
    assert page.evaluate('NoOverlap.state.zoomed') is True
    assert page.locator('.win').count() == 1
    assert page.locator('.iconified').count() == 4
    assert page.locator('.sash').count() == 0
    page.locator('.iconified').first.click()
    assert page.evaluate('NoOverlap.state.zoomed') is False
    no_overlap(page, 'after zoom cycle')

    # 1987 rules: windows float, may overlap, and dragging stacks them.
    page.locator('#mode-overlap').click()
    assert page.evaluate('NoOverlap.state.mode') == 'overlap'
    assert page.locator('.sash').count() == 0
    assert page.evaluate('NoOverlap.api.pairs().count') > 0
    assert page.locator('.win.clash').count() >= 2

    src = page.locator('#win-dos .title')
    b = src.bounding_box()
    tgt = page.locator('#win-calendar').bounding_box()
    page.mouse.move(b['x'] + b['width'] / 2, b['y'] + 8)
    page.mouse.down()
    page.mouse.move(tgt['x'] + tgt['width'] / 2, tgt['y'] + tgt['height'] / 2, steps=10)
    page.mouse.up()
    assert page.evaluate('NoOverlap.api.pairs().count') >= 1
    dos = page.evaluate('NoOverlap.state.wins.dos.float')
    cal = page.evaluate('NoOverlap.state.wins.calendar.float')
    assert dos['l'] < cal['l'] + cal['w'] and cal['l'] < dos['l'] + dos['w'], (dos, cal)

    # Back to 1983: everything tiles again and the overlap count reads zero.
    page.locator('#mode-tile').click()
    assert page.evaluate('NoOverlap.state.mode') == 'tile'
    assert page.evaluate('NoOverlap.api.pairs().count') == 0
    assert page.locator('.win').count() == 5
    no_overlap(page, 'back to tile')
    assert 'tiles never overlap' in page.locator('#r-overlap').inner_text()

    # Reset puts the factory split back.
    page.evaluate('NoOverlap.api.dragSash("main-col", 0, 0.18)')
    page.locator('#reset-sashes').click()
    assert abs(page.evaluate('NoOverlap.state.colFrac') - 0.62) < 1e-9

    for width in (320, 390, 768, 1024, 1500):
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), width

    assert not errors, errors
    browser.close()
print('browser tests passed')
