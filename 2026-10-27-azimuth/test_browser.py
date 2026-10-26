import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
OUTPUT=Path(tempfile.mkdtemp(prefix='azimuth-check-'))
with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={'width':1440,'height':1100})
    errors=[]
    page.on('pageerror',lambda error: errors.append(str(error)))
    page.goto((ROOT/'index.html').as_uri())
    assert float(page.locator('#high').inner_text().split()[0]) < -15
    page.screenshot(path=str(OUTPUT/'desktop.png'),full_page=True)
    page.locator('#angle').fill('0')
    assert page.locator('#status-tag').inner_text()=='IN ALIGNMENT'
    assert float(page.locator('#high').inner_text().split()[0])==0
    page.locator('#angle').fill('0.4')
    slow=float(page.locator('#high').inner_text().split()[0])
    page.locator('#fast').click()
    assert float(page.locator('#high').inner_text().split()[0])>slow
    page.locator('#compare').click()
    assert page.locator('#compare').get_attribute('aria-pressed')=='true'
    assert float(page.locator('#high').inner_text().split()[0])==0
    page.locator('#compare').click()
    page.locator('#new-tape').click()
    assert page.locator('#tape-note').inner_text().startswith('Mystery tape 1')
    page.locator('#angle').fill('-0.175')
    assert page.locator('#status-tag').inner_text()=='IN ALIGNMENT'
    page.locator('#angle').focus()
    page.keyboard.press('ArrowRight')
    assert abs(page.evaluate('azimuth.state.angle')+.17)<1e-7
    page.locator('#listen').click()
    page.wait_for_timeout(200)
    assert page.evaluate('audio.state')=='running'
    # Inspect real output, rather than just the button state.
    page.evaluate('window.an=audio.createAnalyser();an.fftSize=2048;master.connect(an)')
    page.wait_for_timeout(650)
    assert page.evaluate('(()=>{let d=new Float32Array(an.fftSize);an.getFloatTimeDomainData(d);return d.some(v=>Math.abs(v)>.0001)})()')
    page.locator('#listen').click()
    assert not page.evaluate('azimuth.state.playing')
    for width in [320,390,768,1024,1280,1920]:
        page.set_viewport_size({'width':width,'height':1080})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        assert page.locator('#listen').bounding_box()['height']>=44
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(OUTPUT/'mobile.png'),full_page=True)
    assert not errors,errors
    browser.close()
print('PASS: alignment, speed, reference, mystery, keyboard, audible signal, stop, six responsive widths; no JS errors.')
print(OUTPUT)
