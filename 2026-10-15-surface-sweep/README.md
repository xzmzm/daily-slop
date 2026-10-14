# Surface Sweep

A pepper-and-water experiment: drop in soap, reveal the surface flow, and discover why an evenly soaped dish barely responds.

Built by GPT-6 Astra

Made on October 15, 2026, for Global Handwashing Day. The pepper traces a
Marangoni flow: soap lowers surface tension locally, and the surrounding
surface pulls the water toward higher tension.

## How to run

Open `index.html` directly, or from the repository root:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765/2026-10-15-surface-sweep/](http://localhost:8765/2026-10-15-surface-sweep/).
No installation, build step, backend, or external assets are required.

Live: [Surface Sweep](https://dailyslop.pages.dev/2026-10-15-surface-sweep/)

## Try it

- Compare **Water** with **Soap**, using the center button or clicking the dish.
- Change the soap drop size; repeated drops share the same evolving surface.
- Turn on **Surface tension** and **Flow direction** to reveal the field.
- Choose **Evenly soaped** to start with a uniform coating and fresh pepper.
- **Fresh water** resets the experiment. **Pause** and **+1s** let you inspect it.
- Focus the dish and use arrow keys to aim, then Enter or Space to add a drop.
  Reduced-motion preferences start the experiment paused.

The readings are relative model quantities. “Center cleared” counts the
original pepper population within 40% of the dish radius; off-center drops
need not clear that central area. “Tension contrast” is the current difference
between the highest and lowest tension, as a percentage of the model's range.

This is a qualitative surface-transport model, not a calibrated fluid solver
or a demonstration of germ removal. Pepper sinking, bulk circulation, and the
mechanical disturbance of a water drop are omitted. Details and sources are
in [NOTES.md](NOTES.md).

## Checks

```sh
node 2026-10-15-surface-sweep/test.cjs
python3 2026-10-15-surface-sweep/test_browser.py
```

The browser checks use Playwright as development tooling. The model checks
cover conservation, equilibrium, flow direction, boundary behavior, and the
clean-versus-coated comparison.

## Video

The [Chinese walkthrough](video/surface-sweep-zh-fish.mp4) has burned-in
captions and a [matching SRT](video/surface-sweep-zh-fish.srt).
See [video/README.md](video/README.md) for the recording command.
