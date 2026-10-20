"""Verify the real controls, playback, the two doctrines, offline use, and narrow layouts."""
from pathlib import Path
import argparse
import tempfile
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent


def check(screenshots):
    screenshots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        errors, external = [], []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: external.append(request.url) if request.url.startswith("http") else None)
        page.goto((PROJECT / "index.html").as_uri())
        page.wait_for_function("!!window.breakTheLine")
        page.evaluate("window.__manualClock = true")
        # opens on Nelson's plan
        assert page.locator("[data-preset='nelson']").get_attribute("class") == "on"
        assert page.locator("[data-doctrine='cut']").get_attribute("class") == "on"
        assert page.locator("#phase").inner_text() == "/ APPROACH"
        assert page.locator("#clock").inner_text() == "+0:00"
        silent = int(page.locator("#r-silent").inner_text().split()[0])
        assert silent >= 10, silent
        assert page.locator("#r-taken").inner_text() == "12 / 12"
        assert page.locator("#verdict").inner_text().startswith("Decisive")
        page.screenshot(path=str(screenshots / "start.png"))
        # play with the manual clock: through the approach, the cut, the melee
        page.locator("#play").click()
        assert page.locator("#play-label").inner_text() == "Pause"
        page.evaluate("breakTheLine.advance(3.6)")
        assert page.locator("#phase").inner_text() in ("/ APPROACH", "/ BREAKING THROUGH")
        page.screenshot(path=str(screenshots / "approach.png"))
        page.evaluate("breakTheLine.advance(3)")
        assert page.locator("#phase").inner_text() == "/ MÊLÉE, TO LEEWARD"
        page.screenshot(path=str(screenshots / "melee.png"))
        page.evaluate("breakTheLine.advance(30)")
        assert not page.evaluate("breakTheLine.state.playing")
        assert page.locator("#phase").inner_text() == "/ OVER"
        assert page.locator("#play-label").inner_text() == "Replay"
        assert page.locator("#clock").inner_text() == "+4:00"
        # the old way: parallel, and they get away downwind
        page.locator("[data-preset='line']").click()
        assert page.locator("#angle").input_value() == "20"
        assert page.locator("[data-doctrine='haul']").get_attribute("class") == "on"
        assert page.locator("#verdict").inner_text().startswith("Indecisive")
        assert int(page.locator("#r-taken").inner_text().split()[0]) <= 2
        page.locator("#time").fill("300")
        assert page.locator("#phase").inner_text() == "/ LINE AGAINST LINE"
        page.screenshot(path=str(screenshots / "line.png"))
        # a single control change leaves the preset
        page.locator("[data-doctrine='cut']").click()
        assert page.locator("[data-preset='line']").get_attribute("class") in ("", None)
        assert int(page.locator("#r-taken").inner_text().split()[0]) >= 8
        # more wind, less time under fire
        page.locator("[data-preset='nelson']").click()
        page.locator("#wind").fill("6")
        assert page.locator("#wind-out").inner_text() == "6 kn"
        assert int(page.locator("#r-silent").inner_text().split()[0]) < silent
        for width in (390, 768):
            page.set_viewport_size({"width": width, "height": 900})
            page.evaluate("breakTheLine.render()")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), width
            page.screenshot(path=str(screenshots / f"w{width}.png"), full_page=True)
        browser.close()
        assert not errors, errors
        assert not external, external
    print("browser ok")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--screenshots", type=Path, default=Path(tempfile.gettempdir()) / "break-the-line-shots")
    check(parser.parse_args().screenshots)
