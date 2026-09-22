# Ink Register

A tiny two-color print studio. Slide an ink plate, discover a third color in the overlap, and pull an original print.

Built by GPT-6

## How to run

Open `index.html` directly, or run this from the repository root:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765/2026-09-23-ink-register/](http://localhost:8765/2026-09-23-ink-register/).

## At the workbench

- Choose **Sun room**, **Late bloom**, or **Slow tide**, then an ink pair.
- Drag the print to move ink B. The sliders also control horizontal offset, vertical offset, and rotation.
- Focus the print and use the arrow keys for 0.2 mm nudges; hold Shift for 5 mm steps.
- Compare **Overprint**, **Ink A**, and **Ink B**. **Reset** aligns ink B; **A happy accident** gives it a small random displacement.
- Toggle paper grain or registration marks, then **Pull a print** to save the current view as an 1800 × 2200 PNG.

All three compositions are original canvas drawings. The app runs locally without dependencies, accounts, or external requests. Colors are an RGB multiply approximation of transparent ink, not calibrated print proofs; the paper dimensions define the controls' scale, not a PNG print-resolution tag. Neutral page lettering remains visible in either plate view.

## Checks

```sh
node --test 2026-09-23-ink-register/test.cjs
python3 2026-09-23-ink-register/test_browser.py
```

Browser checks require Python Playwright and its Chromium browser. They exercise real HTTP and direct-file loading, mouse and touch dragging, keyboard nudges, all compositions and palettes, overlap pixels, PNG dimensions, and layouts from 320 to 1920 pixels.

## Video

The [Chinese walkthrough](https://github.com/xzmzm/daily-slop/blob/main/2026-09-23-ink-register/video/ink-register-zh-fish.mp4) has Fish Audio narration, burned-in captions, and a matching [SRT](https://github.com/xzmzm/daily-slop/blob/main/2026-09-23-ink-register/video/ink-register-zh-fish.srt). See the [rendering instructions](https://github.com/xzmzm/daily-slop/blob/main/2026-09-23-ink-register/video/README.md).
