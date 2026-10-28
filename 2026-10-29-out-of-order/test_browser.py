from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
out=Path(tempfile.mkdtemp(prefix='packet-trip-check-'))
with sync_playwright() as p:
 browser=p.chromium.launch()
 page=browser.new_page(viewport={'width':1440,'height':1100})
 errors=[];remote=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:remote.append(r.url) if r.url.startswith(('http:','https:')) else None)
 page.goto((ROOT/'index.html').as_uri());page.evaluate('packetTrip.setRecordingClock(true)')
 page.locator('[data-scene=detour]').click();page.locator('#timeline').fill('4.4')
 assert page.evaluate('packetTrip.state.buffered.join()')=='3,5'
 assert page.locator('#message-output').inner_text().startswith('HELL')
 page.screenshot(path=str(out/'desktop.png'),full_page=True)
 page.locator('[data-scene=missing]').click();page.locator('#timeline').fill('7.5')
 assert page.evaluate('packetTrip.state.count')==1
 assert page.locator('.retry-packet').count()==1
 page.locator('#timeline').fill('8.05');assert page.evaluate('packetTrip.state.complete')
 page.locator('#retry').uncheck();page.locator('#timeline').fill('9');assert not page.evaluate('packetTrip.state.complete')
 page.locator('#retry').check();page.locator('#message').fill('<b>HELLO & 你好');page.locator('#send').click()
 page.locator('#timeline').fill('9');assert page.evaluate('packetTrip.state.complete')
 assert page.locator('#message-output').inner_text()=='<b>HELLO & 你好'
 assert page.locator('#message-output b').count()==0
 page.locator('#message').fill('HI');page.locator('#message').press('Enter');page.locator('#timeline').fill('9')
 assert page.locator('#arrival-strip .arrival').count()==2
 page.locator('[data-scene=even]').click();page.locator('#timeline').fill('9');assert page.evaluate('packetTrip.state.complete')
 page.locator('#play').click();assert page.evaluate('packetTrip.state.playing && packetTrip.state.time===0')
 page.evaluate('packetTrip.advance(10000)');assert not page.evaluate('packetTrip.state.playing')
 page.locator('#restart').click();assert page.evaluate('packetTrip.state.time===0')
 for width in [320,390,768,1024,1280,1920]:
  page.set_viewport_size({'width':width,'height':1080})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'mobile.png'),full_page=True)
 reduced=browser.new_page(reduced_motion='reduce');reduced.goto((ROOT/'index.html').as_uri())
 assert not reduced.evaluate('packetTrip.state.playing')
 reduced.locator('[data-scene=missing]').click();assert not reduced.evaluate('packetTrip.state.playing')
 assert not errors,errors
 assert not remote,remote
 browser.close()
print('PASS: controls, buffering, retry and failure, safe text, short messages, replay/end, responsive widths, reduced motion, offline; no JS errors.')
print(out)
