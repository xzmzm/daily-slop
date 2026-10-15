"""Exercise actual controls, rendering, offline use and responsive layouts."""
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
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("request", lambda req: external.append(req.url) if req.url.startswith("http") else None)
        page.clock.install()
        page.goto((PROJECT / "index.html").as_uri())
        page.wait_for_function("!!window.turnOrder")
        assert page.locator("#gap").inner_text() == "120"
        assert page.locator("#home-a").inner_text() == "120°"
        assert page.evaluate("""() => {
            const c=document.querySelector('canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
            let colored=0;for(let i=0;i<d.length;i+=4)if(d[i]>110&&d[i+3]>200)colored++;
            return colored>3000;
        }""")
        page.screenshot(path=str(screenshots / "desktop.png"), full_page=True)
        page.locator("#home").click()
        assert page.locator("#gap").inner_text() == "0"
        page.locator("#play").click()
        page.clock.run_for(3100)
        assert page.locator("#gap").inner_text() == "120"
        assert page.locator("#play").get_attribute("aria-label") == "Replay turns"
        box = page.locator("#angle").bounding_box()
        page.mouse.click(box["x"] + box["width"] * .985, box["y"] + box["height"] / 2)
        assert page.locator("#gap").inner_text() == "0"
        assert "half-turns" in page.locator("#observation").inner_text()
        page.locator('[data-preset="loop"]').click()
        assert page.locator("#home-a").inner_text() == "120°"
        assert "does not come home" in page.locator("#observation").inner_text()
        page.screenshot(path=str(screenshots / "loop.png"), full_page=True)
        page.locator('[data-preset="one"]').click()
        assert page.locator("#gap").inner_text() == "0"
        assert page.locator("#home-a").inner_text() == "0°"
        page.locator("#clear").click()
        assert page.locator("#play").is_disabled()
        for axis, sign in [("z", "1"),("y", "-1"),("x", "1"),("z", "-1"),("x", "-1"),("y", "1")]:
            page.locator(f'[data-axis="{axis}"][data-sign="{sign}"]').click()
            if page.locator(".move-chip").count() == 4:
                assert "signed angles cancel" not in page.locator("#observation").inner_text()
        assert page.locator(".move-chip").count() == 6
        assert page.locator('[data-axis="x"][data-sign="1"]').is_disabled()
        page.locator("#undo").click()
        assert page.locator(".move-chip").count() == 5
        page.locator("#timeline").fill("1.5")
        assert abs(page.evaluate("turnOrder.state.progress") - 1.5) < .001
        assert not page.evaluate("turnOrder.state.playing")
        page.locator('[data-preset="two"]').click()
        for width in [1280, 768, 390, 320]:
            page.set_viewport_size({"width": width, "height": 800 if width == 1280 else 900})
            page.wait_for_timeout(80)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Overflow at {width}px"
            for selector in ["#cube-a", "#cube-b", "#play", "#angle"]:
                box=page.locator(selector).bounding_box()
                assert box and box["width"] > 30 and box["x"] >= 0 and box["x"]+box["width"] <= width+1, (width,selector,box)
            if width == 1280:
                assert page.locator(".workbench").bounding_box()["y"] + page.locator(".workbench").bounding_box()["height"] < 790
            page.screenshot(path=str(screenshots / f"viewport-{width}.png"),full_page=True)
        assert not errors, errors
        assert not external, external
        browser.close()
    print(f"Browser checks passed: playback, half-turns, loop, one axis, editing, scrubbing, offline use, four viewport sizes. Screenshots: {screenshots}")


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--screenshots",type=Path)
    args=parser.parse_args()
    check(args.screenshots or Path(tempfile.mkdtemp(prefix="turn-order-browser-")))
