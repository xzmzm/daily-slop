"""Verify the real controls, playback, marker editing, offline use, and narrow layouts."""
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
        page.wait_for_function("!!window.stationBreak")
        page.evaluate("window.__manualClock = true")
        # opens as aired, hour fully drawn
        assert page.locator("[data-preset='aired']").get_attribute("class") == "on"
        aired = int(page.locator("#r-share").inner_text().rstrip("%"))
        assert aired > 30, aired
        assert page.locator("#r-longest").inner_text() == "37 min"
        page.screenshot(path=str(screenshots / "aired.png"))
        # play from the top with the manual clock
        page.locator("#play").click()
        assert page.locator("#play-label").inner_text() == "Pause"
        assert page.locator("#clock").inner_text() == "8:00:00"
        page.evaluate("stationBreak.advance(8)")
        assert page.locator("#clock").inner_text() == "8:16:00"
        assert page.locator("#phase").inner_text() == "/ FAKE NEWSCAST"
        assert "heat ray" in page.locator("#beat").inner_text()
        page.evaluate("stationBreak.advance(40)")
        assert page.locator("#play-label").inner_text() == "Replay"
        # click the newscast strip to add an announcement near 8:17
        box = page.locator("#view").bounding_box()
        sx = box["width"] / 1000
        x = box["x"] + (92 + 17.5 / 60 * (1000 - 92 - 18)) * sx
        page.mouse.click(x, box["y"] + 60 * sx)
        assert page.evaluate("stationBreak.state.extras.length") == 1
        added = int(page.locator("#r-share").inner_text().rstrip("%"))
        assert added < aired / 3, added
        assert page.locator("#r-dial").inner_text() == "0%"
        # click the marker again to remove it
        mx = box["x"] + (92 + page.evaluate("stationBreak.state.extras[0]") / 60 * (1000 - 92 - 18)) * sx
        page.mouse.click(mx, box["y"] + 60 * sx)
        assert page.evaluate("stationBreak.state.extras.length") == 0
        # evenly spaced loses to the best single spot
        page.locator("[data-preset='every10']").click()
        even = int(page.locator("#r-share").inner_text().rstrip("%"))
        page.evaluate("stationBreak.setExtras([20])")
        assert page.locator("#best-k").inner_text() == "1"
        page.locator("#best").click()
        best = int(page.locator("#r-share").inner_text().rstrip("%"))
        assert best < even, (best, even)
        assert page.locator("#verdict").inner_text().startswith("Announcing at 8:17")
        page.locator("#time").fill("25")
        page.screenshot(path=str(screenshots / "best.png"))
        # the skeptic slider
        page.locator("[data-preset='aired']").click()
        page.locator("#belief").fill("14")
        assert page.locator("#belief-out").inner_text() == "14 min"
        assert int(page.locator("#r-share").inner_text().rstrip("%")) < aired
        for width in (390, 768):
            page.set_viewport_size({"width": width, "height": 900})
            page.evaluate("stationBreak.render()")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), width
            page.screenshot(path=str(screenshots / f"w{width}.png"), full_page=True)
        browser.close()
        assert not errors, errors
        assert not external, external
    print("browser ok")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--screenshots", type=Path, default=Path(tempfile.gettempdir()) / "station-break-shots")
    check(parser.parse_args().screenshots)
