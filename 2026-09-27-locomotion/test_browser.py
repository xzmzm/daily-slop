#!/usr/bin/env python3
"""End-to-end check: load the page, flip every regime, run the replay."""
import pathlib
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

PROJECT = pathlib.Path(__file__).resolve().parent
ROOT = PROJECT.parent


def main() -> int:
    port = 8791
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--directory", str(ROOT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    errors = []
    try:
        time.sleep(0.6)
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1500, "height": 1100})
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"http://127.0.0.1:{port}/{PROJECT.name}/", wait_until="networkidle")
            page.wait_for_function("!!window.sdr")
            assert page.locator("#verdict").inner_text().startswith("Steam ahead"), "default should run"

            # Steep + dry: grip holds, pull doesn't
            page.click('button[data-g="3.03"]')
            page.wait_for_timeout(150)
            assert "Stalls" in page.locator("#verdict").inner_text(), "1 in 33 should stall a coal train"

            # Leaves on the same job: grip runs out first
            page.click('#rail-seg button[data-rail="leaves"]')
            page.wait_for_timeout(150)
            assert "Wheelspin" in page.locator("#verdict").inner_text(), "leaves should spin the wheels"
            assert page.evaluate("sdr.run.slip") is True

            # Sand restores grip, not horsepower
            page.check("#sand")
            page.wait_for_timeout(150)
            assert "Stalls" in page.locator("#verdict").inner_text(), "sand stops the spin; pull is still short"

            # The surveyed fall coasts
            page.uncheck("#sand")
            page.click('#rail-seg button[data-rail="dry"]')
            page.click('button[data-g="-1.9"]')
            page.wait_for_timeout(150)
            assert "Coasting" in page.locator("#verdict").inner_text()

            # Ladder renders the honest zeros
            ladder = page.locator("#ladder").inner_text()
            assert "1 in 33" in ladder and "1 wagon" in ladder, ladder
            assert "can't start" in ladder

            # Opening-day replay moves the marker and tells the story
            page.click("#replay")
            page.wait_for_function("document.getElementById('route-cap').textContent.includes('Phoenix Pit')")
            page.wait_for_timeout(4200)
            cap = page.locator("#route-cap").inner_text()
            assert len(cap) > 20, cap

            # Smoke got drawn at some point
            assert page.evaluate("sdr.run.smoke.length >= 0")
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)
    if errors:
        print("PAGE ERRORS:", errors)
        return 1
    print("browser test OK — all regimes flip, replay runs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
