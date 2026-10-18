"""Verify real controls, chart rendering, replay, offline use, and narrow layouts."""
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
        page.wait_for_function("!!window.sellProgram")
        page.evaluate("window.__manualClock = true")
        assert page.locator("#insured-value").inner_text() == "$75bn"
        assert page.locator("#chart polyline").count() == 2
        assert page.locator("[data-preset='1987']").get_attribute("class") == "on"
        close = float(page.locator("#r-close").inner_text())
        assert 1680 < close < 1800, close
        assert "formulas still wanted" in page.locator("#verdict").inner_text()
        page.screenshot(path=str(screenshots / "1987.png"))
        page.locator("[data-preset='none']").click()
        assert float(page.locator("#r-close").inner_text()) > 2150
        assert "bad morning" in page.locator("#verdict").inner_text()
        page.locator("#insured").fill("4")
        page.locator("#breaker").check()
        assert "−20% breaker shut the market" in page.locator("#verdict").inner_text()
        assert page.locator("#chart text", has_text="HALT").count() == 3
        page.locator("[data-preset='1987']").click()
        page.locator("#play").click()
        assert page.locator("#g-time").inner_text() == "9:30"
        page.evaluate("sellProgram.advance(6)")
        assert page.locator("#g-time").inner_text() == "12:30"
        page.evaluate("sellProgram.advance(8)")
        assert not page.evaluate("sellProgram.state.playing")
        assert page.locator("#g-time").inner_text() == "16:00"
        assert page.locator("#g-dow").inner_text() == page.locator("#r-close").inner_text()
        page.locator("#liquidity").fill("2")
        assert float(page.locator("#r-close").inner_text()) > 1950
        for width in (390, 768):
            page.set_viewport_size({"width": width, "height": 900})
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), width
            page.screenshot(path=str(screenshots / f"w{width}.png"), full_page=True)
        browser.close()
        assert not errors, errors
        assert not external, external
    print("browser ok")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--screenshots", type=Path, default=Path(tempfile.gettempdir()) / "sell-program-shots")
    check(parser.parse_args().screenshots)
