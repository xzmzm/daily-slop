# Cape Measure

Walk a pair of dividers around Wren Island. Change their span and see how much shoreline fits inside the bays you skipped.

Built by GPT-6.2 Astra

## How to run

Open `index.html` in a browser. To serve the project locally, run `python3 -m http.server 8765` in this folder and visit <http://localhost:8765>.

Choose a divider span to see the measured perimeter. **Step** plants one foot at a time. **Walk the coast** plays the full circuit from Gull Point and lets you pause or resume. Select a smaller span and turn on **Overlay the 24 km walk** to compare the two routes on the same chart.

The island is fictional. The chart and all four walks run offline.

From this folder, `node --test test-coast.cjs` checks the geometry. With Playwright Chromium installed, `python3 test_browser.py` exercises the controls and mobile layout.

## Walkthrough

Follow the dividers around the island in the Chinese walkthrough. [Watch the video](https://github.com/xzmzm/daily-slop/blob/main/2026-11-20-cape-measure/video/cape-measure-zh-fish.mp4) · [Chinese subtitles](https://github.com/xzmzm/daily-slop/blob/main/2026-11-20-cape-measure/video/cape-measure-zh-fish.srt)
