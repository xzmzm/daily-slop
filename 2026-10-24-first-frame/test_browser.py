from pathlib import Path
import math
import tempfile
from playwright.sync_api import sync_playwright

PROJECT=Path(__file__).resolve().parent
out=Path(tempfile.mkdtemp(prefix='first-frame-check-'))
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1050})
    errors=[];external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith('http') else None)
    page.goto((PROJECT/'index.html').as_uri())
    assert page.locator('#stamp').inner_text()=='105 KM'
    assert page.evaluate("""()=>{const c=document.querySelector('#scene'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let lo=255,hi=0;for(let i=0;i<d.length;i+=4){lo=Math.min(lo,d[i]);hi=Math.max(hi,d[i]);}return hi-lo>100;}""")
    before=page.locator('#distance').inner_text()
    page.locator('#fov').focus();page.keyboard.press('Home')
    assert page.locator('#distance').inner_text()==before
    page.keyboard.press('End')
    assert page.locator('#distance').inner_text()==before
    for h in [10,105,400,35786]:
        page.locator(f'[data-alt="{h}"]').click()
        g=page.evaluate('firstFrame.geometry(firstFrame.state.altitude)')
        assert math.isclose(g['distance'],math.sqrt(h*(12742+h)))
        assert math.isclose(g['dip'],math.degrees(math.acos(6371/(6371+h))))
        # Nadir hits exactly at Earth's surface; upward and horizontal rays miss.
        assert page.evaluate('(h)=>firstFrame.rayHit(0,-1,0,h)',h)==[0,6371,0]
        assert page.evaluate('(h)=>firstFrame.rayHit(0,1,0,h)',h) is None
        assert page.evaluate('(h)=>firstFrame.rayHit(0,0,1,h)',h) is None
        # A tangent ray touches the sphere, just below hits, just above misses.
        assert page.evaluate('h=>{const d=firstFrame.geometry(h).dip*Math.PI/180;return firstFrame.rayHit(0,-Math.sin(d+.00001),Math.cos(d+.00001),h)!==null}',h)
        assert page.evaluate('h=>{const d=firstFrame.geometry(h).dip*Math.PI/180;return firstFrame.rayHit(0,-Math.sin(d-.00001),Math.cos(d-.00001),h)===null}',h)
    page.locator('#guide').click()
    assert page.locator('#guide').get_attribute('aria-pressed')=='true'
    page.locator('#fov').focus();page.keyboard.press('End')
    assert page.locator('#fov-value').inner_text()=='120°'
    with page.expect_download() as download:
        page.locator('#save').click()
    download.value.save_as(out/'postcard.png')
    assert (out/'postcard.png').stat().st_size>10000
    page.locator('#altitude').focus();page.keyboard.press('Home')
    assert page.locator('#stamp').inner_text()=='10 KM'
    page.keyboard.press('End')
    assert page.locator('#stamp').inner_text()=='36,000 KM'
    for width in [1920,1280,768,390,320]:
        page.set_viewport_size({'width':width,'height':1080 if width==1920 else 1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
        for sel in ['canvas','#altitude','#fov','#save']:
            box=page.locator(sel).bounding_box()
            assert box['x']>=0 and box['x']+box['width']<=width+1,(width,sel,box)
        page.screenshot(path=str(out/f'width-{width}.png'),full_page=True)
    assert not errors,errors
    assert not external,external
    browser.close()
print('PASS geometry, controls, keyboard, PNG download, offline loading, five viewport widths:',out)
