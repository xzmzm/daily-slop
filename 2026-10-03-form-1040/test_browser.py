#!/usr/bin/env python3
"""Playwright checks for Form 1040 (1913). Development tool, not an app dependency."""
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT.parent


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> None:
    port = free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--directory", str(ROOT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    errors: list[str] = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1600, "height": 1000})
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"http://127.0.0.1:{port}/{PROJECT.name}/", wait_until="networkidle")
            page.wait_for_function("!!window.form1040")

            # Default state: the $23,000 engineer.
            assert page.text_content("#f-total").strip() == "$230.00", page.text_content("#f-total")
            assert page.text_content("#marginal-cents") == "2.0"

            # Persona below the exemption owes nothing.
            page.click('[data-income="580"]')
            assert page.text_content("#f-total").strip() == "$0.00"
            assert "never reaches you" in page.text_content("#who-sub")
            assert page.locator(".income-bar .seg.exempt").count() == 1

            # The oil magnate: top marginal 7%, effective 6%.
            page.click('[data-income="1000000"]')
            assert page.text_content("#f-total").strip() == "$60,020.00", page.text_content("#f-total")
            assert page.text_content("#marginal-cents") == "7.0"
            assert page.text_content("#effective-cents") == "6.0"
            assert page.locator(".income-bar .seg").count() == 8
            assert page.locator(".surtax tr.is-zero").count() == 0

            # Marriage moves only the normal tax: $60,010.
            page.click("#status-married")
            assert page.text_content("#f-total").strip() == "$60,010.00", page.text_content("#f-total")
            assert page.text_content("#f-exemption-amt") == "$4,000"
            page.click("#status-single")

            # Exactly at $50,000: the band shows $0.00 but the next dollar pays 3¢.
            page.evaluate("form1040.set({income: 50000})")
            assert page.text_content("#marginal-cents") == "3.0"
            assert page.text_content("#f-total").strip() == "$770.00"

            # Slider warp: track centre is cube-root of $1M = $125,000.
            page.eval_on_selector("#income-slider", "el => { el.value = 500; el.dispatchEvent(new Event('input')); }")
            assert page.evaluate("form1040.state().income") == 125000
            r = page.evaluate("form1040.state().total")
            assert abs(r - (1220 + 300 + 500 + 750 + 1000)) < 0.01, r  # 125k single: $3,770

            # The 2026 panel opens and fills in.
            page.click("#today-toggle")
            assert page.locator("#today-body").is_visible()
            assert "$" in page.text_content("#today-2026-tax")
            assert page.eval_on_selector("#bar-2026", "el => parseFloat(el.style.width)") > 10
            assert page.text_content("#today-note").count("37%") == 1

            # The staircase carries a coin and a fill under the curve.
            assert page.locator("#staircase .coin").count() == 1
            assert page.locator("#staircase .area").count() == 1

            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)
    if errors:
        raise SystemExit("page errors: " + "; ".join(errors))
    print("browser tests: all green")


if __name__ == "__main__":
    main()
