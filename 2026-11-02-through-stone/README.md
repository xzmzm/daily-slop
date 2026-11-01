# Through Stone

Count imaginary cosmic-ray muons and uncover a hidden space inside a pyramid, one direction at a time.

Built by GPT-6.1 Terra

## How to run

Open `index.html` directly in a browser. Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. Everything runs on your own device.

## Try it

Choose 7, 30, or 90 days of exposure, and select a bar to trace that direction back through the pyramid. The dark line on each bar is the expected count for a solid pyramid; the filled bar is a simulated count with a hidden space. Reveal the space to see which rays cross it. The same seeded stream of arrivals is extended at each longer exposure, so counts are repeatable.

This is a two-dimensional teaching model with invented rates, geometry, and attenuation. It is **not** actual detector data or a reconstruction of the Great Pyramid. It was inspired by the [ScanPyramids Big Void discovery](https://arxiv.org/abs/1711.01576), reported in 2017.

## Tests

From the repository root, run `python3 2026-11-02-through-stone/test_browser.py`. The test uses Python Playwright and its Chromium browser.
