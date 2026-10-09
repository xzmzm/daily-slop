"""Real controls, keyboard routes, playback isolation, and narrow-screen layout."""
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        moment = datetime(2026, 10, 9, 6, tzinfo=timezone.utc)
        page.clock.install(time=moment)
        page.clock.pause_at(moment)
        page.goto((PROJECT / "index.html").as_uri())
        state = lambda: page.evaluate("everyStreet.getState()")
        assert state()["summary"]["current"] == "A"
        assert page.locator("#undo").is_disabled()
        page.locator('[data-node="I"]').click()
        assert state()["walk"] == ["A"]
        assert "out of reach" in page.locator("#status").inner_text()
        page.locator('[data-node="B"]').focus()
        page.keyboard.press("Enter")
        page.locator('[data-node="A"]').focus()
        page.keyboard.press("Space")
        assert state()["summary"]["distance"] == 240
        assert state()["summary"]["delivered"] == 1
        assert state()["summary"]["extra"] == 120
        page.locator("#undo").click()
        assert state()["walk"] == ["A", "B"]
        assert state()["summary"]["extra"] == 0
        page.locator("#odd-toggle").check()
        assert page.locator(".junction.odd").count() == 4
        page.locator("#solve").click()
        page.clock.run_for(1450)
        assert state()["mode"] == "solution"
        assert state()["summary"]["distance"] > 0
        page.locator("#solve").click()  # pause
        paused = state()["walk"]
        page.clock.run_for(1600)
        assert state()["walk"] == paused
        page.locator("#solve").click()  # resume
        page.clock.run_for(15000)
        assert state()["summary"]["complete"]
        assert state()["summary"]["distance"] == 1680
        assert not state()["running"]
        assert "shortest possible" in page.locator("#status").inner_text()
        page.locator("#back").click()
        assert state()["walk"] == ["A", "B"]  # viewing a solution never overwrites your attempt
        page.locator("#reset").click()
        assert state()["walk"] == ["A"]
        page.locator('[data-map="canal"]').click()
        assert page.locator(".junction.odd").count() == 0
        for node in ["B", "C", "D", "E", "F", "A"]:
            page.locator(f'[data-node="{node}"]').click()
        assert state()["summary"]["complete"]
        assert state()["summary"]["distance"] == 840
        assert state()["summary"]["extra"] == 0
        page.locator('[data-map="gardens"]').click()
        page.locator("#solve").click()
        page.clock.run_for(800)
        page.locator('[data-map="market"]').click()
        page.clock.run_for(3000)
        assert state()["walk"] == ["A"] and not state()["running"]
        # Cover all streets while still away from home: delivery alone is not completion.
        for node in state()["best"]["nodes"][1:-1]:
            page.locator(f'[data-node="{node}"]').click()
        assert not state()["summary"]["complete"]
        page.locator('[data-node="A"]').click()
        assert state()["summary"]["complete"]
        page.locator('[data-node="B"]').click()
        assert state()["summary"]["delivered"] == 12
        assert not state()["summary"]["complete"]
        assert "back to A" in page.locator("#status").inner_text()
        page.locator('[data-node="A"]').click()
        assert state()["summary"]["complete"]
        assert "saves 240 m" in page.locator("#status").inner_text()
        for width in [390, 320, 768, 1280]:
            page.set_viewport_size({"width": width, "height": 900})
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), width
        page.set_viewport_size({"width": 390, "height": 844})
        page.locator('[data-map="gardens"]').click()
        page.locator('[data-node="B"]').click()
        assert state()["walk"] == ["A", "B"]
        assert errors == [], errors
        browser.close()
    print("Browser controls, keyboard, playback, completion, and responsive checks passed.")


if __name__ == "__main__":
    main()
