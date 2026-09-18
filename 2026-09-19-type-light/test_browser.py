#!/usr/bin/env python3
"""Real-browser smoke tests: controls, image import, downloads, responsive layout."""
from __future__ import annotations
import argparse
import base64
import io
import json
import tempfile
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
from browser_support import PROJECT, launch, load_page, serve


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--inline', action='store_true', help='Test in-memory assets when navigation is unavailable')
    args = parser.parse_args()
    checks = []
    def check(name, condition):
        assert condition, name
        checks.append(name)
        print(f'PASS {name}', flush=True)
    with serve() as port, sync_playwright() as p:
        browser = launch(p)
        context = browser.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
        page = context.new_page()
        errors, external = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: external.append(request.url) if request.url.startswith('https://') else None)
        load_page(page, port, args.inline)
        state = lambda: page.evaluate('typeLight.snapshot()')
        def change(selector, value):
            page.locator(selector).evaluate('(el, value) => { el.value = value; el.dispatchEvent(new Event("input", { bubbles:true })); }', str(value))
            page.wait_for_timeout(75)
        check('startup produces thousands of cells', state()['cells'] > 2000)
        check('glyph coverage is sorted', state()['levels'] == sorted(state()['levels']))
        check('default reveal is halfway', state()['reveal'] == 50)
        page.locator('#play').click(); frozen = state()['time']; page.wait_for_timeout(180)
        check('pause freezes simulation time', state()['paused'] and state()['time'] == frozen)
        change('#columns', 48)
        check('resolution updates rows and actual export width', all(len(row) == 48 for row in page.evaluate('typeLight.getText()').splitlines()))
        change('#columns', 180)
        check('fine resolution works', state()['columns'] == 180)
        change('#reveal', 0)
        check('zero reveal hides divider', not page.locator('#compare-line').is_visible())
        change('#reveal', 100)
        check('full reveal hides divider', not page.locator('#compare-line').is_visible())
        change('#exposure', -1.2); change('#contrast', 1.8)
        check('exposure and contrast apply', state()['exposure'] == -1.2 and state()['contrast'] == 1.8)
        page.locator('#reset').click(); page.locator('#play').click()
        for source in ('orbits', 'signal', 'knot'):
            page.select_option('#source', source)
            page.wait_for_timeout(100)
            txt=page.evaluate('typeLight.getText()')
            check(f'{source} is nonempty', len(txt.replace(' ', '').replace('\n','')) > 100)
        if not state()['paused']: page.locator('#play').click()
        for mode in ('none', 'ordered', 'diffusion'):
            page.select_option('#dither', mode)
            page.wait_for_timeout(80)
            check(f'{mode} is selectable', state()['dither'] == mode)
        page.select_option('#charset', 'binary')
        check('binary export uses only space and @', set(page.evaluate('typeLight.getText()')) <= {' ', '@', '\n'})
        page.select_option('#charset', 'extended')
        check('extended alphabet is measured', len(state()['glyphs']) == 23)
        hashes=[]
        for palette in ('mint', 'amber', 'paper', 'color'):
            page.locator(f'[data-palette="{palette}"]').click()
            hashes.append(page.evaluate('typeLight.printDataURL()'))
            check(f'{palette} has accessible selected state', page.locator(f'[data-palette="{palette}"]').get_attribute('aria-pressed') == 'true')
        check('all four palettes render differently', len(set(hashes)) == 4)
        image=Image.new('RGB',(120,80))
        image.putdata([(x*255//119,y*255//79,128) for y in range(80) for x in range(120)])
        data=io.BytesIO();image.save(data,format='PNG')
        page.set_input_files('#file', {'name':'local-gradient.png','mimeType':'image/png','buffer':data.getvalue()})
        page.wait_for_function('typeLight.snapshot().source === "image"')
        check('image import stays local and pauses', state()['paused'] and page.locator('#play').is_disabled())
        page.set_input_files('#file', {'name':'invalid.txt','mimeType':'text/plain','buffer':b'not an image'})
        check('non-image import has a useful error', 'choose an image' in page.locator('#message').inner_text())
        page.set_input_files('#file', {'name':'broken.png','mimeType':'image/png','buffer':b'not a png'})
        page.wait_for_function('document.getElementById("message").textContent.includes("could not be decoded")')
        check('invalid image decoding is handled', 'could not be decoded' in page.locator('#message').inner_text())
        png=Image.open(io.BytesIO(base64.b64decode(page.evaluate('typeLight.printDataURL()').split(',')[1])))
        check('PNG contains the actual print dimensions', png.width == state()['columns']*9 and png.height == state()['rows']*16)
        if not args.inline:
            with page.expect_download() as captured: page.locator('#save-png').click()
            download=captured.value
            check('PNG downloads through the UI', download.suggested_filename == 'type-light.png' and not download.failure())
            with page.expect_download() as captured: page.locator('#save-text').click()
            download=captured.value
            check('text downloads through the UI', download.suggested_filename == 'type-light.txt' and not download.failure())
        else:
            print('INFO native download navigation deferred to HTTP/CI run', flush=True)
        page.locator('#copy').click(); page.wait_for_timeout(100)
        check('copy succeeds or reports the safe fallback', any(x in page.locator('#message').inner_text() for x in ('copied','Clipboard is unavailable')))
        page.locator('#reset').click()
        check('reset restores all defaults and removes image option', state()['source']=='knot' and state()['charset']=='classic' and page.locator('#source option[value="image"]').count()==0)
        page.locator('#play').click()
        page.locator('#columns').focus(); page.keyboard.press('Home'); page.keyboard.press('ArrowRight'); page.wait_for_timeout(60)
        check('slider keyboard control works', state()['columns']==52)
        page.locator('#columns').evaluate('(el)=>el.blur()'); page.keyboard.press('Space'); page.wait_for_timeout(60)
        check('space resumes when a form control is not focused', not state()['paused'])
        page.locator('#reset').click(); page.locator('#play').click()
        for width in (1280,768,390,320):
            page.set_viewport_size({'width':width,'height':900}); page.wait_for_timeout(75)
            check(f'no horizontal overflow at {width}px', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        page.set_viewport_size({'width':1280,'height':900})
        page.locator('#experiment').click();page.wait_for_timeout(500)
        check('experiment configures two-character diffusion', state()['charset']=='binary' and state()['dither']=='diffusion' and state()['reveal']==0)
        reduced=context.browser.new_context(viewport={'width':390,'height':844}, reduced_motion='reduce')
        reduced_page=reduced.new_page();load_page(reduced_page,port,args.inline)
        check('reduced motion pauses on startup', reduced_page.evaluate('typeLight.snapshot().paused'))
        reduced.close()
        check('no external requests from the app', not external)
        check('no JavaScript exceptions', not errors)
        browser.close()
    print(json.dumps({'browser_checks_passed':len(checks),'inline':args.inline},indent=2))

if __name__=='__main__': main()
