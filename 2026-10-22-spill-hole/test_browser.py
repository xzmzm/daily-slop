from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent
out=Path(tempfile.mkdtemp(prefix='spill-hole-check-'))
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1100})
    errors=[];external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith('http') else None)
    page.goto((P/'index.html').as_uri());page.evaluate('spillHole.setLive(false)')
    assert page.locator('#vent').input_value()=='6'
    initial=page.evaluate('spillHole.getStats()')
    assert initial['speed']>5 and initial['rocking']<initial['referenceRocking']
    page.screenshot(path=str(out/'desktop.png'),full_page=True)
    page.locator('[data-vent="0"]').click()
    s=page.evaluate('spillHole.getStats()');assert s['left']==s['right']
    assert 'No cut' in page.locator('#observation').inner_text()
    page.locator('[data-vent="20"]').click();assert page.evaluate('spillHole.getStats().speed')>initial['speed']
    page.locator('#vent').focus();page.keyboard.press('ArrowLeft');assert page.locator('#vent').input_value()=='19'
    page.locator('#reset').click();assert page.evaluate('spillHole.state.time')==0
    page.locator('#play').click();page.evaluate('spillHole.advance(10)');assert page.evaluate('spillHole.state.time')==10
    page.locator('#play').click();assert not page.evaluate('spillHole.state.playing')
    page.locator('#time').fill('30');assert page.evaluate('spillHole.getStats().right.height')==0
    page.locator('#play').click();assert page.evaluate('spillHole.state.time')==0
    page.evaluate('spillHole.advance(31)');assert not page.evaluate('spillHole.state.playing')
    for width in [1920,1280,768,390,320]:
        page.set_viewport_size({'width':width,'height':1080 if width==1920 else 900})
        page.locator('[data-vent="6"]').click();page.locator('#time').fill('16')
        page.wait_for_timeout(80)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        for selector in ['#sky','#chart','#vent','#play','#time']:
            b=page.locator(selector).bounding_box();assert b and b['width']>20 and b['x']>=0 and b['x']+b['width']<=width+1,(width,selector,b)
        if width==1280:
            b=page.locator('.bench').bounding_box();assert b['y']+b['height']<790,b
        page.screenshot(path=str(out/f'width-{width}.png'),full_page=True)
    page.emulate_media(reduced_motion='reduce');page.locator('#reset').click();page.locator('#play').click()
    assert page.evaluate('spillHole.state.time')==30 and not page.evaluate('spillHole.state.playing')
    assert not errors,errors
    assert not external,external
    browser.close()
print('Browser passed: controls, keyboard, replay, reduced motion, offline loading, 5 viewport widths. Screenshots:',out)
