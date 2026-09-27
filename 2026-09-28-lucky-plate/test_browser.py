#!/usr/bin/env python3
"""End-to-end check: load on the Sept 28 plate, replay the summer, wreck the luck."""
import pathlib
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

PROJECT = pathlib.Path(__file__).resolve().parent
ROOT = PROJECT.parent


def main() -> int:
    port = 8792
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
            page.wait_for_function("!!window.plate")

            # The page opens on the finished accident: halo verdict, all luck met
            assert "抑菌圈" in page.locator("#ro-verdict").inner_text(), page.locator("#ro-verdict").inner_text()
            assert page.locator("#ro-date").inner_text() == "9月28日"
            luck_on = page.evaluate("document.querySelectorAll('#luck li.on').length")
            assert luck_on == 3, f"all three luck conditions met, got {luck_on}"
            zone = page.evaluate("plate.sim.stats().zoneMm")
            assert 24 < zone < 60, f"boot state zone {zone}"

            # Replay the fortnight live and let it finish
            page.click("#btn-replay")
            page.wait_for_timeout(400)
            assert page.locator("#ro-date").inner_text() != "9月28日", "replay should restart the clock"
            page.click("#btn-skip")
            page.wait_for_timeout(300)
            assert "抑菌圈" in page.locator("#ro-verdict").inner_text()

            # The incubator counterfactual: warm, and the halo never comes
            page.click("#btn-restreak")
            page.evaluate("plate.setTemp(35)")
            page.evaluate("plate.sim.dropSpore(64, 64)")
            for _ in range(6):
                page.evaluate("plate.tick(1)")
            s = page.evaluate("plate.sim.stats()")
            assert s["coverage"] > 0.85, f"lawn should swallow the plate, cov={s['coverage']}"
            assert s["moldMm"] < 6, f"mold should barely germinate, mold={s['moldMm']}"
            assert "太热" in page.locator("#ro-verdict").inner_text()

            # Dropping a spore by hand works and unsets the script
            page.click("#btn-restreak")
            page.evaluate("plate.setTemp(22)")
            page.evaluate("plate.sim.dropSpore(64, 70)")
            page.evaluate("plate.tick(30)")
            s = page.evaluate("plate.sim.stats()")
            assert s["moldMm"] > 10, f"bench-temp mold should grow, mold={s['moldMm']}"

            # Mutations toggle is wired through
            page.evaluate("plate.setMutations(false)")
            assert page.evaluate("plate.sim.mutations") is False
            page.evaluate("plate.setMutations(true)")
            assert page.evaluate("plate.sim.mutations") is True
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)
    if errors:
        print("PAGE ERRORS:", errors)
        return 1
    print("browser test OK — accident, counterfactual, hand-dropped spore all behave")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
