"""Exercise real controls and clocked transmission; all app requests stay local."""
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent

def main():
    errors, external = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: external.append(request.url) if request.url.startswith("https:") else None)
        page.goto((PROJECT / "index.html").as_uri())
        page.wait_for_function("!!window.thirtyLines")
        page.evaluate("thirtyLines.useManualClock()")
        assert page.evaluate("thirtyLines.getState().paused"), "Reduced motion starts paused"
        page.locator("#pause").click()
        page.evaluate("thirtyLines.tick(1)")
        state = page.evaluate("thirtyLines.getState()")
        assert state["serial"] == 1200 and state["receiveSerial"] == 1200
        page.locator("#break-sync").click()
        assert page.locator("#status").inner_text() == "RECEIVER DRIFTING"
        assert page.locator("#drift-value").inner_text() == "+2.5%"
        assert "307.5" in page.locator("#sync-readout").inner_text()
        assert page.evaluate("thirtyLines.getState().receiveSerial") == 1200, "Speed change preserves motor position"
        for _ in range(6): page.evaluate("thirtyLines.tick(1)")
        state = page.evaluate("thirtyLines.getState()")
        assert abs(state["receiveSerial"] - state["serial"] - 180) < .001
        drifting = page.evaluate("thirtyLines.getMemory()")
        page.locator("#lock").click()
        assert page.locator("#status").inner_text() == "SIGNAL IN SYNC"
        assert drifting != page.evaluate("thirtyLines.getMemory()")

        for lines in (15, 60, 30):
            page.locator(f'[data-lines="{lines}"]').click()
            assert page.evaluate("thirtyLines.getState().lines") == lines
            assert len(page.evaluate("thirtyLines.getMemory()")) == lines * 80
            assert page.locator(f'[data-lines="{lines}"]').get_attribute("aria-pressed") == "true"
        for subject in ("orbit", "type", "bill"):
            page.locator(f'[data-subject="{subject}"]').click()
            assert page.evaluate("thirtyLines.getState().subject") == subject
        page.locator("#phase").focus()
        page.keyboard.press("ArrowRight")
        assert page.locator("#phase-value").inner_text() == "1°"
        assert page.locator("#status").inner_text() == "PHASE MISALIGNED"
        page.locator("#lock").click()
        page.locator("#slit").click()
        assert page.evaluate("thirtyLines.getState().view") == "slit"
        assert page.locator("#slit").get_attribute("aria-pressed") == "true"
        page.locator("#memory").click()
        page.locator("#pause").click()
        before = page.evaluate("thirtyLines.getState()")
        page.evaluate("thirtyLines.tick(1)")
        assert page.evaluate("thirtyLines.getState()") == before
        page.locator("#step").click()
        assert abs(page.evaluate("thirtyLines.getState().serial") - before["serial"] - 80) < 1e-6
        assert page.locator("#column-readout").inner_text() == "COLUMN 02 / 30"

        for width in (360, 390, 760, 1024, 1280, 1920):
            page.set_viewport_size({"width": width, "height": 1080})
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Overflow at {width}px"
        assert not errors, errors
        assert not external, external
        browser.close()
    print("Browser: sync, motor continuity, phase, resolution, subjects, slit, pause/step, keyboard, six widths, and offline load passed.")

if __name__ == "__main__": main()
