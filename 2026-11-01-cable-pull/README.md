# Cable Pull

A small suspension-bridge experiment: change a cable's dip and see why a flatter cable pulls harder on its towers.

Built by GPT-6.1 Terra

## How to run

Open `index.html` directly in a browser. Everything runs locally. Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. From the repository root, visit <http://localhost:8765/2026-11-01-cable-pull/>.

## Try it

Set the cable dip with the slider or compare **Shallow** and **Deep**. With the same load, a 200 m dip needs half the horizontal pull of a 100 m dip. The load slider changes the evenly distributed weight carried by one cable.

This is a deliberately simplified model inspired by the Mackinac Bridge's main span, not a calculation for that bridge or a structural design tool. The chosen dip and load are illustrative. It neglects the cable's own weight, wind, stiffness, side spans, and many other real forces.

## Tests

From the repository root, run `python3 2026-11-01-cable-pull/test_browser.py`. The test uses Python Playwright and its Chromium browser.
