#!/usr/bin/env python3
"""Real controls, responsive layout, URL state and actual PNG download."""
import json
import os
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
from browser_support import PROJECT, ROOT, serve, launch, load
OUT=Path(os.environ.get('SHORTCUT_CHECK_DIR','/tmp/shortcut-trap-checks'))
OUT.mkdir(parents=True,exist_ok=True)
inline=os.environ.get('SHORTCUT_INLINE_PREVIEW')=='1'
checks=[]
def ok(name,condition):
    assert condition,name
    checks.append(name)
def snap(page):return page.evaluate('shortcutTrap.snapshot()')
with serve() as port,sync_playwright() as p:
    b=launch(p)
    page=b.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1,accept_downloads=True)
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    load(page,port)
    ok('initial 65-minute split',snap(page)['flows']==[2000,2000,0] and snap(page)['average']==65)
    page.locator('#shortcut').focus();page.keyboard.press('Enter')
    ok('keyboard shortcut toggle',snap(page)['average']==80 and snap(page)['open'])
    page.locator('[data-route="2"]').click()
    ok('route highlight',snap(page)['selected']==2)
    page.locator('[data-policy="coordinated"]').click()
    ok('coordinated optimum',snap(page)['average']==64.6875 and snap(page)['flows']==[1750,1750,500])
    page.locator('#pause').click();before=snap(page)['elapsed'];page.evaluate('shortcutTrap.advance(2)')
    ok('pause freezes traffic markers',snap(page)['elapsed']==before)
    page.locator('#pause').click();page.evaluate('shortcutTrap.advance(2)')
    ok('resume advances traffic markers',snap(page)['elapsed']==before+2)
    page.locator('#demand').fill('1000');page.locator('[data-policy="selfish"]').click()
    ok('low demand benefits',snap(page)['average']==20 and snap(page)['delta']==-30)
    page.locator('#delay').fill('20');ok('shortcut time changes route cost',snap(page)['average']==40)
    page.locator('#demand').fill('10000');ok('high demand leaves shortcut unused',snap(page)['flows'][2]==0)
    page.locator('#reset').click();ok('reset restores original',snap(page)['average']==65 and snap(page)['demand']==4000 and not snap(page)['open'])
    page.locator('#curve').scroll_into_view_if_needed()
    box=page.locator('#curve').bounding_box();page.mouse.click(box['x']+34+(box['width']-50)*8/9,box['y']+50)
    ok('chart pointer selects demand',snap(page)['demand']==9000)
    if not inline:
        load(page,port,'?capture=1#demand=4000&delay=0&open=1&policy=coordinated')
        ok('shared URL restores assignment',snap(page)['average']==64.6875)
        page.context.grant_permissions(['clipboard-read','clipboard-write'])
        page.locator('#share').click()
        page.wait_for_function("document.querySelector('#notice').textContent.includes('copied')")
        copied=page.evaluate('navigator.clipboard.readText()')
        ok('copied URL carries parameters without capture mode','policy=coordinated' in copied and 'capture' not in copied)
        load(page,port,'?capture=1#demand=NaN&delay=-10&open=garbage&policy=bad')
        ok('malformed URL is bounded safely',snap(page)['demand']==4000 and snap(page)['delay']==0 and not snap(page)['open'])
        load(page,port)
    else:page.evaluate('shortcutTrap.reset()')
    page.locator('#shortcut').click()
    with page.expect_download() as download:page.locator('#export').click()
    image=OUT/'scenario-export.png';download.value.save_as(image)
    with Image.open(image) as im:ok('valid exported PNG',im.size==(1600,1180) and im.format=='PNG')
    for width,height in [(1440,1100),(1024,900),(390,844),(360,740)]:
        page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(60)
        size=page.evaluate('({w:innerWidth,scroll:document.documentElement.scrollWidth})')
        ok(f'no horizontal overflow at {width}px',size['scroll']<=size['w'])
        page.screenshot(path=str(OUT/f'browser-{width}.png'),full_page=True)
    page.emulate_media(reduced_motion='reduce');load(page,port)
    ok('reduced motion starts paused',snap(page)['paused'])
    page.set_viewport_size({'width':1440,'height':960});page.emulate_media(reduced_motion='no-preference');load(page,port)
    page.locator('#shortcut').click();page.evaluate('shortcutTrap.advance(3)')
    shots=ROOT/'gallery/shots';shots.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(shots/(PROJECT.name+'.png')))
    ok('no JavaScript runtime errors',not errors)
    ok('no runtime external requests',all(u.startswith(('http://127.0.0.1:','data:','about:')) for u in requests))
    b.close()
report={'status':'passed','mode':'in-memory local preview' if inline else 'HTTP browser tests','checks':checks,'errors':errors,'url_checks_skipped':inline}
(OUT/'browser-tests.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
