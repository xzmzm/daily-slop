from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent
out = Path(tempfile.mkdtemp(prefix="spin-down-check-"))
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors, external = [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: external.append(request.url) if request.url.startswith("http") else None)
    page.goto((PROJECT / "index.html").as_uri())
    page.evaluate("spinDown.setLive(false)")
    assert page.locator("#cached-reserve").inner_text() == "20:00"
    assert not page.evaluate("spinDown.state.playing")
    page.locator("#play").click()
    page.locator("#block").click()
    page.evaluate("spinDown.advance(240)")
    assert page.locator("#direct-output").inner_text() == "SILENT"
    assert page.locator("#cached-output").inner_text() == "PLAYING"
    assert page.locator("#cached-reserve").inner_text() == "16:00"
    assert page.locator("#block").is_disabled()
    page.screenshot(path=str(out / "outage-desktop.png"), full_page=True)
    page.locator("#skip").click(); page.evaluate("spinDown.advance(1)")
    assert page.locator("#cached-output").inner_text() == "SILENT"
    page.evaluate("spinDown.advance(70)")
    assert page.locator("#cached-output").inner_text() == "PLAYING"
    assert not page.locator("#block").is_disabled()
    assert 'refill' in page.locator('#observation').inner_text()
    page.evaluate("spinDown.advance(25)")
    assert 'resting' in page.locator('#observation').inner_text()
    page.locator("#play").click()
    before = page.evaluate("spinDown.state.time")
    assert 'paused' in page.locator('#observation').inner_text()
    page.evaluate("spinDown.advance(100)")
    assert page.evaluate("spinDown.state.time") == before
    page.locator("#capacity").select_option("120")
    assert page.evaluate("spinDown.state.time") == 0
    page.locator("#play").click(); page.locator("#block").click(); page.evaluate("spinDown.advance(150)")
    assert page.locator("#cached-output").inner_text() == "SILENT"
    page.locator("#reset").click(); page.locator("#capacity").select_option("1200")
    page.locator("#speed").select_option("120")
    page.locator("#sound").click()
    assert page.locator("#sound").get_attribute("aria-pressed") == "true"
    page.locator("#sound").click()
    assert page.locator("#sound").get_attribute("aria-pressed") == "false"
    page.locator("#play").focus(); page.keyboard.press("Enter")
    assert page.evaluate("spinDown.state.playing")
    page.evaluate("spinDown.advance(360)")
    for width in [1920, 1280, 768, 390, 320]:
        page.set_viewport_size({"width": width, "height": 1080 if width == 1920 else 900})
        page.wait_for_timeout(90)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), width
        for selector in ["#play", "#block", "#skip", "#capacity", "#history", "#cached-card"]:
            box = page.locator(selector).bounding_box()
            assert box and box["width"] > 10 and box["x"] >= 0 and box["x"] + box["width"] <= width + 1, (width, selector, box)
        page.screenshot(path=str(out / f"width-{width}.png"), full_page=True)
    page.emulate_media(reduced_motion="reduce"); page.locator("#reset").click()
    page.locator("#play").click(); page.evaluate("spinDown.advance(20)")
    assert page.locator("#direct-card .platter").evaluate("el => el.style.transform") == "rotate(0deg)"
    page.locator("summary").click()
    assert page.locator(".notes").get_attribute("open") is not None
    assert not errors, errors
    assert not external, external
    browser.close()
print("Browser passed: outage, seek, capacity, sound, pause, keyboard, reduced motion, offline loading, 5 viewport widths. Screenshots:", out)
