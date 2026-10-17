"""Verify real controls, chart rendering, offline use, and narrow layouts."""
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
        page.wait_for_function("!!window.venera")
        assert page.locator("#h-value").inner_text() == "0"
        assert page.locator("#r-p").inner_text() == "22"
        assert "Neither" in page.locator("#verdict").inner_text()
        assert page.locator("#chart polyline").count() >= 2
        page.screenshot(path=str(screenshots / "moscow.png"))
        page.locator('[data-h="27"]').click()
        assert page.locator("#alias").is_checked()
        assert "Both clues fit" in page.locator("#verdict").inner_text()
        assert int(page.locator("#r-p").inner_text()) > 100
        page.locator("#alias").uncheck()
        assert "Mariner 5 fits" in page.locator("#verdict").inner_text()
        page.locator("#alias").check()
        page.locator("#h").fill("10")
        assert page.locator("#h-value").inner_text() == "10"
        assert "Neither" in page.locator("#verdict").inner_text()
        page.locator("#play").click()
        page.evaluate("venera.advance(6)")
        assert abs(page.evaluate("venera.state.minute") - 46.5) < 4
        page.evaluate("venera.advance(7)")
        assert page.evaluate("venera.state.lost")
        assert page.locator("#g-time").inner_text() == "SIGNAL LOST"
        page.screenshot(path=str(screenshots / "lost.png"))
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
    parser.add_argument("--screenshots", type=Path, default=Path(tempfile.gettempdir()) / "venera-4-shots")
    check(parser.parse_args().screenshots)
