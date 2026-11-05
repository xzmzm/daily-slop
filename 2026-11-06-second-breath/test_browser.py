"""Exercise the shipped app directly from disk; no network or server required."""
from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent
output = Path(tempfile.mkdtemp(prefix='second-breath-check-'))
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width':1440,'height':1100})
    page.add_init_script('''
      window.audioContextCount=0;window.scheduledFrequencies=[];
      const NativeAudio=window.AudioContext;
      window.AudioContext=class extends NativeAudio {
        constructor(...args){super(...args);window.audioContextCount++;}
        createOscillator(){const osc=super.createOscillator(),start=osc.start.bind(osc);
          osc.start=when=>{window.scheduledFrequencies.push(osc.frequency.value);return start(when);};return osc;}
      };
    ''')
    errors, remote = [], []
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:remote.append(r.url) if r.url.startswith(('https:','http:')) else None)
    page.goto((PROJECT/'index.html').as_uri())
    page.evaluate('secondBreath.setRecordingClock(true)')
    assert page.evaluate('secondBreath.state.mode') == 1
    assert page.locator('#cylinder-hz').inner_text() == '132'
    assert page.locator('#cone-hz').inner_text() == '264'
    assert page.evaluate('audioContextCount') == 0
    page.screenshot(path=str(output/'desktop-low.png'),full_page=True)
    page.locator('#try-next').click()
    assert page.locator('#overblow').get_attribute('aria-pressed') == 'true'
    assert page.locator('#cylinder-hz').inner_text() == '396'
    assert page.locator('#cone-hz').inner_text() == '528'
    assert page.locator('#cylinder-ladder .active').inner_text() == '3×'
    assert page.locator('#cone-ladder .active').inner_text() == '2×'
    assert page.locator('#cylinder-nodes').inner_text() == '1 interior pressure node'
    assert page.locator('#cylinder-ladder .absent').count() == 3
    page.screenshot(path=str(output/'desktop-next.png'),full_page=True)
    page.locator('#length').fill('100')
    assert page.locator('#length-value').inner_text() == '100 cm'
    assert page.locator('#cylinder-hz').inner_text() == '257'
    page.locator('#reset').click()
    assert page.locator('#length').input_value() == '65'
    page.locator('#low').focus();page.keyboard.press('Space')
    assert page.locator('#low').get_attribute('aria-pressed') == 'true'
    page.locator('#length').focus();page.keyboard.press('ArrowRight')
    assert page.locator('#length').input_value() == '66'
    page.locator('#motion').click()
    phase=page.evaluate('secondBreath.state.phase')
    page.evaluate('secondBreath.advance(500)')
    assert page.evaluate('secondBreath.state.phase') == phase
    page.locator('#motion').click();page.evaluate('secondBreath.advance(500)')
    assert page.evaluate('secondBreath.state.phase') > phase
    page.locator('#hear-cylinder').click()
    page.wait_for_function("document.querySelector('#hear-cylinder').getAttribute('aria-pressed')==='true'")
    assert 'Two pure tones' in page.locator('#audio-status').inner_text()
    frequencies=page.evaluate('scheduledFrequencies')
    assert abs(frequencies[1]/frequencies[0]-3)<1e-5
    page.locator('#hear-cylinder').click()
    assert page.locator('#hear-cylinder').get_attribute('aria-pressed') == 'false'
    page.locator('#hear-cone').click()
    page.wait_for_function("document.querySelector('#hear-cone').getAttribute('aria-pressed')==='true'")
    frequencies=page.evaluate('scheduledFrequencies')
    assert abs(frequencies[-1]/frequencies[-2]-2)<1e-5
    page.locator('#overblow').click()
    assert page.locator('#hear-cone').get_attribute('aria-pressed') == 'false'
    for width in [320,390,700,768,1024,1280,1920]:
        page.set_viewport_size({'width':width,'height':1080})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    page.set_viewport_size({'width':1280,'height':800})
    box=page.locator('.observation').bounding_box()
    assert box['y']+box['height']<=800,box
    page.screenshot(path=str(output/'compact.png'))
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(output/'mobile.png'),full_page=True)
    reduced=browser.new_page(reduced_motion='reduce')
    reduced.goto((PROJECT/'index.html').as_uri())
    assert not reduced.evaluate('secondBreath.state.playing')
    reduced.locator('#overblow').click()
    assert not reduced.evaluate('secondBreath.state.playing')
    assert not errors,errors
    assert not remote,remote
    browser.close()
print('PASS: register/pitch display, resonance strip, length/reset, keyboard, pause, sound/stop/cancel, responsive widths, reduced motion, offline; no JS errors.')
print(output)
