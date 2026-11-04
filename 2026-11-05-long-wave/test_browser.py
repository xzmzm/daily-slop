"""Exercise real controls and responsive layouts, including offline file:// use."""
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1100})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((PROJECT / 'index.html').as_uri())
    state = lambda: page.evaluate('longWaveApp.getState()')
    assert abs(state()['x']-505)<.001
    page.locator('#shelf-jump').click()
    assert page.locator('#phase').inner_text()=='OVER THE SHELF'
    assert page.locator('#speed').inner_text()=='159'
    assert page.locator('#amplitude').inner_text()=='1.06'
    assert page.locator('#wavelength').inner_text()=='31.9'
    before=state()['x']
    page.locator('[data-depth="50"]').click()
    assert abs(state()['x']-before)<.001
    assert page.locator('#speed').inner_text()=='80'
    assert page.locator('#amplitude').inner_text()=='1.50'
    assert page.locator('#wavelength').inner_text()=='15.9'
    page.locator('[data-depth="4000"]').click()
    assert page.locator('#amplitude').inner_text()=='0.50'
    assert page.locator('#speed').inner_text()=='713'
    page.locator('#depth').fill('1000')
    assert state()['shelfDepth']==1000
    assert page.locator('[aria-pressed="true"]').count()==0
    page.locator('#reset').click()
    assert abs(state()['x']-80)<.001
    assert state()['seconds']==0 and not state()['playing']
    page.locator('#play').click()
    page.wait_for_timeout(300)
    assert state()['seconds']>0 and state()['playing']
    page.locator('#play').click()
    assert not state()['playing']
    page.locator('#time').fill('20')
    assert state()['seconds']==1200 and not state()['playing']
    page.locator('#time').focus()
    page.keyboard.press('ArrowRight')
    assert state()['seconds']>1200
    # Replay at the end restarts, and the slider can reach the exact final time.
    page.locator('#time').evaluate('(el)=>{el.value=el.max;el.dispatchEvent(new Event("input",{bubbles:true}))}')
    assert abs(state()['seconds']-state()['endTime'])<.01
    page.locator('#play').click()
    assert state()['seconds']<state()['endTime']*.1 and state()['playing']
    page.locator('#shelf-jump').click()
    for width in (320,390,768,1024,1440,1920):
        page.set_viewport_size({'width':width,'height':1080})
        page.wait_for_timeout(70)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), width
        assert page.locator('#ocean').bounding_box()['width']>200
    assert not errors, errors
    browser.close()
print('Long Wave browser checks passed: controls, physics readouts, keyboard, playback, 320–1920 px, file://.')
