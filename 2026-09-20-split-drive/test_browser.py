#!/usr/bin/env python3
"""Exercise the actual page, including native PNG download and keyboard access."""
import json
import os
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
from browser_support import serve,launch,load

def main():
    checks=[]
    def check(name,ok):
        assert ok,name
        checks.append(name);print('PASS '+name,flush=True)
    out=Path(os.environ.get('TEST_OUTPUT_DIR','/tmp/split-drive-checks'));out.mkdir(parents=True,exist_ok=True)
    with serve() as port,sync_playwright() as p:
        browser=launch(p);context=browser.new_context(viewport={'width':1440,'height':1080},accept_downloads=True)
        page=context.new_page();errors=[];requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append(r.url))
        load(page,port)
        snapshot=lambda:page.evaluate('splitDrive.snapshot()')
        def slider(name,value):
            page.locator('#'+name).evaluate('(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));}',str(value))
        check('initial split matches the bend',snapshot()['solution']['rpm'][0]<snapshot()['solution']['rpm'][1])
        page.locator('#play').click();before=snapshot()['motion'];page.wait_for_timeout(150)
        check('pause freezes all motion',snapshot()['motion']==before)
        page.screenshot(path=str(out/'desktop.png'),full_page=True)
        slider('radius',3.5)
        check('tight radius applies immediately',snapshot()['state']['radius']==3.5)
        slider('track',2.4)
        check('track width applies',snapshot()['state']['track']==2.4)
        slider('speed',36)
        check('speed applies',snapshot()['state']['speed']==36)
        page.locator('#lock').click();s=snapshot()
        check('lock is accessible as a switch',page.locator('#lock').get_attribute('aria-checked')=='true')
        check('locked wheel speeds equal the carrier',abs(s['solution']['rpm'][0]-s['solution']['carrier'])<1e-9 and s['solution']['rpm'][0]==s['solution']['rpm'][1])
        check('locked bend reports physical mismatch',s['solution']['mismatch']>0 and 'slide' in page.locator('#status-copy').inner_text())
        check('road demand remains different while locked',page.locator('#left-required').get_attribute('style')!=page.locator('#right-required').get_attribute('style'))
        page.locator('[data-turn="-1"]').click()
        check('right bend makes left wheel outside',page.locator('#left-role').inner_text()=='OUTSIDE')
        check('right bend reverses mismatch signs',snapshot()['solution']['slip'][0]<0)
        page.locator('[data-turn="0"]').click()
        check('straight disables only the radius control',page.locator('#radius').is_disabled() and page.locator('#speed').is_enabled())
        check('straight has zero locked slip',snapshot()['solution']['mismatch']<1e-9)
        check('straight has no fictitious lap',page.locator('#left-lap').inner_text()=='—' and snapshot()['solution']['lap'] is None)
        slider('speed',0)
        check('zero speed stops wheel output',snapshot()['solution']['rpm']==[0,0] and 'Stopped' in page.locator('#status-title').inner_text())
        page.locator('#reset').click()
        check('reset restores defaults',snapshot()['state']['radius']==8 and snapshot()['state']['track']==1.6 and not snapshot()['state']['locked'])
        page.locator('#tight-turn').click()
        check('experiment configures a locked tight turn',snapshot()['state']['radius']==3.5 and snapshot()['state']['locked'])
        page.locator('#lock').click()
        gap=snapshot()['solution']['gap'];slider('radius',16)
        check('full-lap gap does not change with radius',abs(snapshot()['solution']['gap']-gap)<1e-9)
        page.locator('#reset').click();page.locator('#play').click()
        page.locator('#radius').focus();page.keyboard.press('Home');page.keyboard.press('ArrowRight')
        check('range control works from keyboard',snapshot()['state']['radius']==4)
        page.locator('#radius').evaluate('(e)=>e.blur()');page.keyboard.press('Space')
        check('space toggles playback outside controls',not snapshot()['state']['paused'])
        page.keyboard.press('r')
        check('R restores the study',snapshot()['state']['radius']==8)
        with page.expect_download() as pending:page.locator('#export').click()
        download=pending.value;download.save_as(str(out/'study.png'));im=Image.open(out/'study.png')
        check('study is a real PNG download',download.suggested_filename=='split-drive-study.png' and im.size==(1440,900))
        for w in [1600,1024,768,390,320]:
            page.set_viewport_size({'width':w,'height':900});page.wait_for_timeout(100)
            check(f'no horizontal overflow at {w}px',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'mobile.png'),full_page=True)
        mobile=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
        rp=mobile.new_page();load(rp,port)
        check('reduced-motion preference pauses initially',rp.evaluate('splitDrive.snapshot().state.paused'))
        mobile.close()
        page.set_viewport_size({'width':1440,'height':1080});load(page,port,True)
        start=snapshot()['motion']['time'];page.wait_for_timeout(100)
        check('capture mode does not advance itself',snapshot()['motion']['time']==start)
        page.evaluate('splitDrive.advance(4)')
        check('capture timing uses the documented quarter speed',abs(snapshot()['motion']['time']-start-1)<1e-9)
        check('no non-loopback network requests',all(u.startswith('http://127.0.0.1:') or u.startswith('data:') for u in requests))
        check('no browser exceptions',not errors)
        browser.close()
    report={'browser_checks_passed':len(checks),'checks':checks};(out/'tests.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
