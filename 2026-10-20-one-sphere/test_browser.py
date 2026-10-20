"""Verify the real controls, the 3D view, the assembly animation, offline use, and narrow layouts."""
from pathlib import Path
import argparse
import tempfile
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent


def painted(page, x, y):
    """Is the 3D canvas painting something other than sky at this fraction of its size?"""
    return page.evaluate("""([fx, fy]) => {
        const c = document.getElementById('view'), d = c.getContext('2d').getImageData(Math.round(c.width * fx), Math.round(c.height * fy), 1, 1).data;
        return d[0] + d[1] + d[2] > 200;
    }""", [x, y])


def check(screenshots):
    screenshots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        errors, external = [], []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: external.append(request.url) if request.url.startswith("http") else None)
        page.goto((PROJECT / "index.html").as_uri())
        page.wait_for_function("!!window.oneSphere")
        page.evaluate("window.__manualClock = true")
        assert page.locator("#chips button").count() == 10
        assert page.locator("[data-mode='sphere']").get_attribute("class") == "on"
        assert page.locator("#r-curves").inner_text() == "1"
        assert page.locator("#r-dev").inner_text() == "0.00 m"
        assert page.locator("#where").inner_text() == "/ ON THE SPHERE"
        assert painted(page, .5, .3), "shells on top of the sphere"
        page.screenshot(path=str(screenshots / "sphere.png"))
        # play to the podium with the manual clock
        page.locator("#play").click()
        assert page.locator("#play-label").inner_text() == "Pause"
        page.evaluate("oneSphere.advance(2.5)")
        assert page.locator("#where").inner_text() == "/ IN TRANSIT"
        page.evaluate("oneSphere.advance(3)")
        assert not page.evaluate("oneSphere.state.playing")
        assert page.locator("#where").inner_text() == "/ ON THE PODIUM"
        assert page.locator("#play-label").inner_text() == "Put them back on the sphere"
        assert page.locator("#assemble").input_value() == "1000"
        page.screenshot(path=str(screenshots / "podium.png"))
        # free-form: many curves, the selected shell is off the sphere
        page.locator("[data-mode='free']").click()
        curves = int(page.locator("#r-curves").inner_text().replace(",", ""))
        assert curves > 300, curves
        assert float(page.locator("#r-dev").inner_text().split()[0]) > 1
        assert "different curves" in page.locator("#verdict").inner_text()
        page.locator("#chips button", has_text="B3").click()
        assert "B3" in page.locator("#shell-name").inner_text()
        assert "B3 strays" in page.locator("#verdict").inner_text()
        page.screenshot(path=str(screenshots / "free.png"))
        # scrubbing back stops at the sphere; dragging turns the view
        page.locator("#assemble").fill("0")
        assert page.locator("#where").inner_text() == "/ ON THE SPHERE"
        yaw = page.evaluate("oneSphere.state.yaw")
        box = page.locator("#view").bounding_box()
        page.mouse.move(box["x"] + 300, box["y"] + 200)
        page.mouse.down()
        page.mouse.move(box["x"] + 400, box["y"] + 240, steps=5)
        page.mouse.up()
        assert page.evaluate("oneSphere.state.yaw") != yaw
        for width in (390, 768):
            page.set_viewport_size({"width": width, "height": 900})
            page.evaluate("oneSphere.render()")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), width
            page.screenshot(path=str(screenshots / f"w{width}.png"), full_page=True)
        browser.close()
        assert not errors, errors
        assert not external, external
    print("browser ok")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--screenshots", type=Path, default=Path(tempfile.gettempdir()) / "one-sphere-shots")
    check(parser.parse_args().screenshots)
