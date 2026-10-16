"""Verify real controls, graph rendering, offline use, and narrow layouts."""
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
        page.wait_for_function("!!window.oneMore")
        page.evaluate("oneMore.setLive(false)")
        assert page.locator("#k-value").inner_text() == "1.00"
        assert page.locator("#population").inner_text() == "12"
        assert page.locator("#surviving").inner_text() == "11"
        for selector in ["#tree", "#chart"]:
            assert page.locator(selector).evaluate("""c => {
              const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
              let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>100)n++;return n>500;
            }"""), selector
        page.screenshot(path=str(screenshots / "desktop.png"), full_page=True)
        page.locator("#play").click()
        assert page.locator("#generation-value").inner_text() == "00 / 24"
        page.evaluate("oneMore.advance(2.4)")
        assert page.evaluate("oneMore.state.generation") == 10
        page.locator("#play").click()
        assert not page.evaluate("oneMore.state.playing")
        page.locator("#generation").fill("24")
        assert page.locator("#step").is_disabled()
        page.locator('[data-k="0.8"]').click()
        assert "SUBCRITICAL" in page.locator("#regime").inner_text()
        assert page.evaluate("oneMore.getStats().expected") < .01
        page.screenshot(path=str(screenshots / "fade.png"), full_page=True)
        page.locator('[data-k="1.2"]').click()
        assert "SUPERCRITICAL" in page.locator("#regime").inner_text()
        assert page.evaluate("oneMore.getStats().expected") > 79
        page.locator('[data-source="32"]').click()
        assert page.evaluate("oneMore.getStats().expected") > 2500
        assert "UP TO 40" in page.locator("#sampling").inner_text()
        page.screenshot(path=str(screenshots / "grow.png"), full_page=True)
        page.locator("#next").click()
        stats = page.evaluate("oneMore.getStats()")
        assert page.locator("#chain-number").inner_text() == "CHAIN 02"
        page.locator("#previous").click()
        page.locator("#next").click()
        assert page.evaluate("oneMore.getStats()") == stats
        page.locator("#reroll").click()
        assert page.evaluate("oneMore.getStats().seed") != stats["seed"]
        page.locator("#k").focus()
        page.keyboard.press("ArrowRight")
        assert page.locator("#k-value").inner_text() == "1.21"
        page.locator('[data-k="1"]').click()
        page.locator('[data-source="1"]').click()
        page.locator("#generation").fill("0")
        assert page.locator("#population").inner_text() == "1"
        page.locator("#step").click()
        assert page.evaluate("oneMore.state.generation") == 1
        # Do not silently resurrect an extinct chain, even when k is above one.
        page.locator('[data-k="1.2"]').click()
        page.locator("#generation").fill("24")
        for _ in range(64):
            counts = page.evaluate("oneMore.getStats().counts")
            if 0 in counts:
                dead = counts.index(0)
                assert all(n == 0 for n in counts[dead:])
                break
            page.locator("#next").click()
        else:
            raise AssertionError("No extinct chain found")
        for width in [1280, 768, 390, 320]:
            page.set_viewport_size({"width": width, "height": 800 if width == 1280 else 900})
            page.wait_for_timeout(70)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Overflow at {width}px"
            for selector in ["#tree", "#chart", "#k", "#generation", "#play", "#reroll"]:
                box = page.locator(selector).bounding_box()
                assert box and box["width"] > 30 and box["x"] >= 0 and box["x"] + box["width"] <= width + 1, (width, selector, box)
            if width == 1280:
                box = page.locator(".workbench").bounding_box()
                assert box["y"] + box["height"] < 790
            page.screenshot(path=str(screenshots / f"viewport-{width}.png"), full_page=True)
        page.emulate_media(reduced_motion="reduce")
        page.reload()
        page.wait_for_function("!!window.oneMore")
        page.locator("#play").click()
        assert page.evaluate("oneMore.state.generation") == 24
        assert not page.evaluate("oneMore.state.playing")
        assert not external, external
        assert not errors, errors
        browser.close()
    print(f"Browser checks passed: playback, stepping, scrubbing, all regimes, sources, trial selection, keyboard, sampling, offline use, reduced motion, four viewports. Screenshots: {screenshots}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--screenshots", type=Path)
    args = parser.parse_args()
    check(args.screenshots or Path(tempfile.mkdtemp(prefix="one-more-browser-")))
