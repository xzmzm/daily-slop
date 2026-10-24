"""Boundary, interaction, keyboard and responsive checks. No server required."""
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width":1440,"height":1000})
    errors = []
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto((PROJECT/'index.html').as_uri())
    # Compare every minute against the browser's independent IANA zone data.
    assert page.evaluate('''() => {
      const f = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
      for(let m=0;m<=180;m++){
        const s=twiceAtOne.instant(m);
        if(twiceAtOne.fmt(s.local)!==f.format(new Date(Date.UTC(2026,9,25,0,m))))return false;
      }return true;
    }''')
    for minute, clock, zone in [(59,'01:59','BST'),(60,'01:00','GMT'),(119,'01:59','GMT'),(120,'02:00','GMT'),(180,'03:00','GMT')]:
        page.evaluate('(m)=>twiceAtOne.select(m)',minute)
        assert page.locator('#clock').inner_text()==clock
        assert page.locator('#zone').inner_text()==zone
    page.locator('#first').click()
    assert page.locator('#clock').inner_text()=='01:30'
    assert page.locator('#utc').inner_text()=='00:30 UTC'
    page.locator('#second').click()
    assert page.locator('#clock').inner_text()=='01:30'
    assert page.locator('#utc').inner_text()=='01:30 UTC'
    assert page.locator('#kl').inner_text()=='09:30'
    page.locator('#time').focus()
    page.keyboard.press('ArrowRight')
    assert page.locator('#clock').inner_text()=='01:31'
    page.locator('#seam').click()
    page.wait_for_function('twiceAtOne.minutes>=61')
    assert page.locator('#zone').inner_text()=='GMT'
    page.locator('#play').click()
    frozen=page.evaluate('twiceAtOne.minutes')
    page.wait_for_timeout(500)
    assert page.evaluate('twiceAtOne.minutes')==frozen
    page.evaluate('twiceAtOne.select(30)')
    page.screenshot(path='/tmp/twice-at-one-desktop.png',full_page=True)
    for width in [320,390,768,1280,1920]:
        page.set_viewport_size({'width':width,'height':1000})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path='/tmp/twice-at-one-mobile.png',full_page=True)
    assert not errors,errors
    browser.close()
print('PASS: 181 IANA comparisons, fold boundaries, both occurrences, keyboard, playback, five responsive widths; no page errors.')
