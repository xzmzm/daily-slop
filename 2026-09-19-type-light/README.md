# Type Light

An ASCII darkroom: turn a moving sculpture or your own image into measured characters, then compare dithering and export the print.

Built by GPT-6 Astra

## How to run

Open `index.html` directly, or serve the repository root:

```sh
python3 -m http.server 8765
```

Visit `http://localhost:8765/2026-09-19-type-light/`.
There is no installation or build step. The app makes no network requests;
imported images are decoded and processed in the current tab.

## A small experiment

Choose **Test signal**, set **Alphabet** to **2 characters**, and move
**Source reveal** to zero. Compare **None**, **Bayer 4 × 4**, and
**Floyd–Steinberg**. The characters do not change, but their arrangement
recovers intermediate tones.

The three built-in subjects are a rotating torus knot, an orbital still life,
and a gradient test signal. Other controls adjust resolution, exposure,
contrast, and four print palettes. Drag an image onto the preview or use
**Open your own image**. Imports are capped at 20 MB and resized to a maximum
2048-pixel edge before processing.

**Save PNG** exports the character print without the source overlay.
**.txt** exports real characters, including whitespace. **Copy** uses the
clipboard when permitted; otherwise it offers the text-file route. View text
in a monospace font. Font metrics can change its appearance across editors.

Press **Space** to pause, or **R** to reset, when a form field is not focused.
Reduced-motion preferences pause animated subjects initially.

## What is being measured?

The browser renders each glyph into a fixed cell and measures its ink
coverage. The alphabet is sorted by that measurement, not a hard-coded
brightness order. Coverage is normalized to the densest glyph; it is an
artistic tonal mapping, not a calibrated display-luminance reproduction.
The browser downsamples the source first; sampled sRGB colors are then
converted to linear-light relative luminance. This is not a fully
linear-light image-resampling pipeline.

## Tests

The app itself has no dependencies. Developer checks use Node and Playwright:

```sh
node 2026-09-19-type-light/test.cjs
python3 -m pip install playwright pillow
python3 -m playwright install chromium
python3 2026-09-19-type-light/test_browser.py
```

Pure tests cover luminance, tone mapping, quantization, diffusion boundaries,
and tone conservation. Browser tests cover controls, mobile layouts, image
imports, accessibility basics, clipboard fallback, and PNG/text downloads.
Use `BROWSER_EXECUTABLE=/path/to/chromium` to choose an existing browser.
`--inline` supports environments that disallow local URL navigation; this
mode explicitly skips native download navigation checks.

## Video

The actual browser walkthrough, matching SRT, capture script, and audio-mode
metadata live in [`video/`](./video/). The renderer uses the established Fish
Audio voice when its key is available. Otherwise it explicitly produces a
Chinese-captioned edition with an original synthesized soundtrack, not a
substitute voice. See [`video/README.md`](./video/README.md).

## Inspiration

September 19, 1982: [Scott Fahlman's original smiley proposal](https://www.cs.cmu.edu/~sef/Orig-Smiley.htm).
The anniversary is the prompt, not a claim that ASCII art began with smileys.
