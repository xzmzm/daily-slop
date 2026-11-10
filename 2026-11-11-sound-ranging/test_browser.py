"""End-to-end browser tests for Sound Ranging web app."""
from __future__ import annotations

import subprocess
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT_DIR = Path(__file__).resolve().parent
ROOT_DIR = PROJECT_DIR.parent


def test_browser():
    errors = []
    # Start temporary local HTTP server on a free port (avoid 8000!)
    port = 8769
    proc = subprocess.Popen(
        ['python3', '-m', 'http.server', str(port), '--directory', str(ROOT_DIR)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    time.sleep(0.5)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 1280, 'height': 800})
            page.on('pageerror', lambda err: errors.append(str(err)))

            # Open project
            page.goto(f'http://127.0.0.1:{port}/{PROJECT_DIR.name}/', wait_until='networkidle')

            # 1. Check title and masthead
            assert 'Sound Ranging' in page.title()
            assert page.locator('#map-canvas').is_visible()
            assert page.locator('#tape-canvas').is_visible()

            # 2. Check initial Standard Preset readouts
            error_dist = page.locator('#error-dist').text_content()
            assert '0.0 m' in error_dist or float(error_dist.replace(' m', '')) < 1.0

            # 3. Test Fire Battery button
            page.locator('#fire-btn').click()
            time.sleep(0.2)
            assert page.evaluate('SoundRanging.state.isAnimating') is True
            assert page.evaluate('SoundRanging.state.waveRadius') > 0

            # Check timing table has 5 rows
            rows = page.locator('#timing-tbody tr').count()
            assert rows == 5, f'Expected 5 rows, got {rows}'

            # 4. Test Crosswind preset (without vs with Bragg correction)
            page.locator('.preset-btn[data-preset="crosswind"]').click()
            time.sleep(0.1)
            assert page.evaluate('SoundRanging.state.preset') == 'crosswind'
            assert page.evaluate('SoundRanging.state.correctionEnabled') is False

            # Verify uncorrected error is large (> 100m)
            err_uncorr_text = page.locator('#error-dist').text_content()
            err_uncorr = float(err_uncorr_text.replace(' m', ''))
            assert err_uncorr > 100, f'Expected uncorrected error > 100m, got {err_uncorr}'
            assert 'DRIFT' in page.locator('#error-badge').text_content()

            # Now toggle Bragg correction ON
            page.locator('label.switch').click()
            time.sleep(0.1)
            assert page.evaluate('SoundRanging.state.correctionEnabled') is True

            err_corr_text = page.locator('#error-dist').text_content()
            err_corr = float(err_corr_text.replace(' m', ''))
            assert err_corr < 2.0, f'Expected corrected error < 2m, got {err_corr}'
            assert 'PINPOINT FIX' in page.locator('#error-badge').text_content()

            # 5. Test Armistice preset
            page.locator('.preset-btn[data-preset="armistice"]').click()
            time.sleep(0.1)
            assert page.evaluate('SoundRanging.state.isArmistice') is True
            status_text = page.locator('#tape-status').text_content()
            assert '11 November 1918' in status_text
            assert 'All Traces Flat' in status_text

            # 6. Test dragging / setting battery position
            page.evaluate('SoundRanging.api.setBattery(-800, 3200)')
            time.sleep(0.1)
            pos_text = page.locator('#true-pos').text_content()
            assert '-800m' in pos_text and '3200m' in pos_text

            browser.close()
    finally:
        proc.terminate()
        proc.wait()

    assert not errors, f'Console errors detected: {errors}'
    print('All browser tests passed successfully!')


if __name__ == '__main__':
    test_browser()
