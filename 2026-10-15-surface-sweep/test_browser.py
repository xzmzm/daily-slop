"""Exercise the real page at desktop/mobile sizes, including keyboard and reduced motion."""
from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent


def main():
    shots = Path(tempfile.mkdtemp(prefix="surface-sweep-qa-"))
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1100})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto((PROJECT / "index.html").as_uri())
        page.evaluate("sweep.setLive(false)")
        page.screenshot(path=str(shots / "desktop.png"), full_page=True)
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
        page.locator("#water").click()
        assert page.locator("#dose").is_disabled()
        page.locator("#drop-center").click()
        page.evaluate("sweep.advance(2)")
        assert page.evaluate("sweep.state.stats().cleared") == 0
        page.locator("#soap").click()
        assert page.locator("#dose").is_enabled()
        page.locator("#drop-center").click()
        page.locator("#field").check()
        page.locator("#arrows").check()
        page.evaluate("sweep.advance(1.5)")
        page.screenshot(path=str(shots / "flow.png"), full_page=True)
        assert page.evaluate("sweep.state.stats().cleared") > 70
        page.locator("#coat").click()
        assert page.evaluate("sweep.state.stats().contrast") == 0
        page.locator("#drop-center").click()
        page.evaluate("sweep.advance(2)")
        assert page.evaluate("sweep.state.stats().cleared") < 30
        page.locator("#fresh").click()
        assert page.evaluate("sweep.state.stats().mass") == 0
        page.locator("#dish").focus()
        page.keyboard.press("ArrowRight")
        page.keyboard.press("Enter")
        assert page.evaluate("sweep.state.drops") == 1
        assert abs(page.evaluate("sweep.state.events[0].x") - .1) < .001
        page.locator("#pause").click()
        assert not page.evaluate("sweep.playing")
        before = page.evaluate("sweep.state.time")
        page.locator("#step").click()
        assert abs(page.evaluate("sweep.state.time") - before - 1) < .001
        for width in (390, 320, 768, 1920):
            page.set_viewport_size({"width": width, "height": 900})
            assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), width
            page.locator("#fresh").click()
            page.locator("#dish").scroll_into_view_if_needed()
            # Click actual dish coordinates, allowing for object-fit letterboxing.
            box = page.locator("#dish").bounding_box()
            scale = min(box["width"] / 900, box["height"] / 760)
            x = box["x"] + box["width"] / 2
            y = box["y"] + (box["height"] - 760 * scale) / 2 + 363 * scale
            page.mouse.click(x, y)
            assert page.evaluate("sweep.state.drops") == 1, width
            assert abs(page.evaluate("sweep.state.events[0].x")) < .01
            if width == 390:
                page.evaluate("sweep.advance(1)")
                page.screenshot(path=str(shots / "mobile.png"), full_page=True)
        reduced = browser.new_page(reduced_motion="reduce")
        reduced.goto((PROJECT / "index.html").as_uri())
        assert not reduced.evaluate("sweep.playing")
        reduced.locator("#drop-center").click()
        assert "Paused" in reduced.locator("#observation").inner_text()
        reduced.locator("#step").click()
        assert reduced.evaluate("sweep.state.stats().cleared") > 50
        assert not errors, errors
        browser.close()
    print("PASS: desktop/mobile, water/soap, coated control, reset, keyboard, pause, step and reduced motion")
    print("Screenshots:", shots)


if __name__ == "__main__":
    main()
