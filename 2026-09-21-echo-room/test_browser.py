#!/usr/bin/env python3
"""Exercise actual controls, audio, downloads, responsive layout and reduced motion."""
import base64
import io
import json
import os
from pathlib import Path
import wave
from playwright.sync_api import sync_playwright
from browser_support import serve,launch,load
OUT=Path(os.environ.get('ECHO_CHECKS_DIR','/tmp/echo-room-checks'))
def main():
    OUT.mkdir(parents=True,exist_ok=True);checks=[];errors=[]
    def check(name,value):
        assert value,name
        checks.append(name);print('PASS',name,flush=True)
    with serve() as port,sync_playwright() as p:
        browser=launch(p)
        page=browser.new_page(viewport={'width':1440,'height':1040},accept_downloads=True)
        page.on('pageerror',lambda e:errors.append(str(e)))
        transport=load(page,port)
        if os.environ.get('GITHUB_ACTIONS')=='true':check('CI uses real HTTP, not injected markup',transport=='http')
        snap=lambda:page.evaluate('echoRoom.snapshot()')
        initial=snap();check('app starts with gallery preset',initial['state']['width']==14)
        check('221 modeled paths',initial['stats']['count']==221)
        check('initial audio requires interaction','press play' in page.locator('#audio-status').inner_text())
        check('initial metrics are physically correct',abs(initial['stats']['directMs']-21.9918625838)<1e-7)
        check('all four wall paths are selectable',page.locator('#path-select option').count()==4)
        page.locator('#path-select').select_option('1,0');check('path selector highlights selected wall',snap()['selected']=='1,0')
        old=snap()['state']['listener']['x'];page.locator('#listener').focus();page.keyboard.press('ArrowRight')
        check('listener arrow keys move 0.1 metre',abs(snap()['state']['listener']['x']-old-.1)<1e-7)
        page.keyboard.press('Shift+ArrowRight');check('Shift arrow keys move 0.5 metre',abs(snap()['state']['listener']['x']-old-.6)<1e-7)
        pos=page.locator('#source').bounding_box();old=snap()['state']['source']['x'];page.mouse.move(pos['x']+15,pos['y']+15);page.mouse.down();page.mouse.move(pos['x']+85,pos['y']+27,steps=10);page.mouse.up()
        check('pointer drag moves sound source',snap()['state']['source']['x']>old+1)
        check('manual edits clear preset selection',page.locator('[data-preset][aria-pressed=true]').count()==0)
        page.locator('#reset').click();before=snap()
        page.locator('#absorption').fill('92');page.locator('#absorption').dispatch_event('input');after=snap()
        check('absorption slider updates the model',after['state']['absorption']==.92)
        check('absorption leaves all arrival times unchanged',[x['delay'] for x in before['paths']]==[x['delay'] for x in after['paths']])
        check('absorption reduces reflected energy',after['stats']['reflectedEnergy']<before['stats']['reflectedEnergy'])
        page.locator('#absorption').fill('100');page.locator('#absorption').dispatch_event('input');check('fully absorbing walls mute every reflection',all(x['gain']==0 for x in snap()['paths'] if x['order']))
        for preset,width in [('corridor',26),('studio',7),('gallery',14)]:
            page.locator(f'[data-preset="{preset}"]').click();check(preset+' preset',snap()['state']['width']==width)
        page.locator('#width').fill('30');page.locator('#width').dispatch_event('input');check('resize retains relative point placement',abs(snap()['state']['source']['x']-3.1*30/14)<1e-7)
        page.locator('#depth').fill('3');page.locator('#depth').dispatch_event('input');check('minimum room width keeps points inside',all(.2<=snap()['state'][k]['y']<=2.8 for k in ['source','listener']))
        page.locator('#pause').click();t=snap()['clock'];page.evaluate('echoRoom.advance(1)');check('pause freezes visual time',snap()['clock']==t)
        page.locator('#pause').click();page.evaluate('echoRoom.advance(.2)');check('resume advances visual time',snap()['clock']!=t)
        page.locator('[data-mode="direct"]').click();check('direct comparison mode',snap()['mode']=='direct')
        page.locator('#play').click();check('play resets pulse animation',snap()['clock']==0)
        dry=base64.b64decode(page.evaluate('echoRoom.audioBase64()'))
        page.locator('[data-mode="room"]').click();wet=base64.b64decode(page.evaluate('echoRoom.audioBase64()'))
        check('room audio differs from direct sound',wet!=dry)
        check('export bytes are a mono 44100 Hz WAV',wave.open(io.BytesIO(wet)).getparams()[:3]==(1,2,44100))
        if not os.environ.get('ECHO_INLINE_PREVIEW'):
            with page.expect_download() as pending:page.locator('#export').click()
            result=pending.value;result.save_as(str(OUT/'exported-echo.wav'));check('actual download has expected filename',result.suggested_filename=='echo-room-room.wav')
            check('downloaded WAV matches modeled samples',(OUT/'exported-echo.wav').read_bytes()==wet)
        page.locator('#reset').click();check('reset restores geometry and listening mode',snap()['state']==initial['state'] and snap()['mode']=='room')
        page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
        for width in [1024,740,390,320]:
            page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(50)
            check(f'no horizontal overflow at {width}px',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            check(f'handles are visible at {width}px',page.locator('#source').is_visible() and page.locator('#listener').is_visible())
            check(f'canvas remains usable at {width}px',page.locator('#room').bounding_box()['width']>=250)
            if width==390:page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
        reduced=browser.new_page(viewport={'width':1280,'height':900},reduced_motion='reduce');load(reduced,port)
        check('reduced motion starts paused',reduced.evaluate('echoRoom.snapshot().paused'));reduced.close()
        normal=browser.new_page(viewport={'width':1280,'height':900});normal.on('pageerror',lambda e:errors.append(str(e)));load(normal,port,False)
        start=normal.evaluate('echoRoom.snapshot().clock');normal.wait_for_timeout(160);check('normal page animates without capture mode',normal.evaluate('echoRoom.snapshot().clock')!=start)
        normal.locator('#play').click();normal.wait_for_timeout(180)
        check('real Web Audio playback succeeds','Playing:' in normal.locator('#audio-status').inner_text());normal.close()
        check('no browser JavaScript errors',not errors);browser.close()
    data={'status':'passed','browser_checks':len(checks),'transport':transport,'checks':checks,'errors':errors}
    (OUT/'browser-results.json').write_text(json.dumps(data,indent=2)+'\n');print(json.dumps(data),flush=True)
if __name__=='__main__':main()
