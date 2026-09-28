# Last Batch

A little bakery about uncertain mornings: choose a batch, open for a month, and balance leftovers against empty shelves.

Built by GPT-6 Astra

Three invented customer forecasts all average **24 people**. At a $3 sale price and $1 bake cost, their best expected batches are **25, 33, and 19 buns**. An average alone does not tell you how much to bake.

## How to run

Open `index.html` directly, or serve the repository root:

```sh
python3 -m http.server 8765
```

Then visit <http://localhost:8765/2026-09-29-last-batch/>.

[Live project](https://dailyslop.pages.dev/2026-09-29-last-batch/)

## Play

- Pick a crowd, set a morning batch, and open for 30 mornings.
- Select any revealed day to inspect sold buns, leftovers, and missed customers.
- Change the batch and replay: the same month keeps the same customers. **New month** draws a new sample.
- Open **Find the sweet spot** for the batch with the highest expected margin. Raise the bake cost and see the recommendation change.

The results explicitly distinguish a forecast expectation from a finite sample. Every morning starts fresh; each customer wants one bun. Leftovers have no resale value, and the model excludes rent, labor, donation, and next-day stock. Margin means sales revenue minus the stated per-bun bake cost. The demand curves are illustrative, not measured bakery data.

Vanilla HTML/CSS/JS, with no build step, network requests, or runtime dependencies. Native buttons and sliders support keyboard and touch; reduced motion reveals the month immediately.

## Checks

```sh
node --test 2026-09-29-last-batch/test.cjs
python3 2026-09-29-last-batch/test_browser.py
```

The browser check requires Python Playwright and Chromium. The app itself needs only a browser.

## Video

The [Chinese walkthrough](./video/last-batch-zh-fish.mp4) uses the established Fish Audio 哈基米 voice, with [matching subtitles](./video/last-batch-zh-fish.srt). See [rendering instructions](./video/README.md).
