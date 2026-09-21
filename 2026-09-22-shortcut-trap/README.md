# Shortcut Trap

Open a shortcut, watch everyone arrive later, and separate the fastest individual route from the fastest collective commute.

Built by GPT-6 Astra

An interactive Braess-network experiment for September 22, the final day of European Mobility Week 2026. The default 4,000-driver commute takes **65 minutes with the shortcut closed**, but **80 minutes with it open** when everyone chooses their own best route. That is a model result, not a prediction for a particular city.

## How to run

Open `index.html` directly, or serve this directory:

```sh
python3 -m http.server 8765
```

Then visit `http://localhost:8765`. No install, account, or build is needed. From the repository root, visit `/2026-09-22-shortcut-trap/` instead.

[Live project](https://dailyslop.pages.dev/2026-09-22-shortcut-trap/) · [Build notes](NOTES.md)

## Try it

Open the shortcut, highlight each route, and compare the journey times. Drag **drivers** or **shortcut time** to find cases where the extra road helps, hurts, or goes unused. The lower chart is interactive too. Switch from **Everyone chooses** to **Coordinated** to minimize total travel time rather than individual incentives.

**Copy scenario** stores the parameters in a shareable URL fragment. **Save image** exports a 1600 × 1180 PNG with the network and numbers. Pause stops the traffic markers; reduced-motion preferences start them paused. All controls are keyboard accessible and numerical results are also shown as text.

## What the model assumes

The directed network has two congestion-sensitive roads, each costing `flow / 100` minutes, two fixed 45-minute roads, and an optional one-way connector. Flow means drivers assigned to an entire modelled commute, not vehicles per hour or the number of dots drawn on screen. Demand is fixed; there is no queue propagation, induced demand, or city calibration.

The solver computes a continuous-flow Wardrop equilibrium or the minimum-total-time assignment exactly. It does not simulate drivers learning routes. Animated markers illustrate those assignments and are not a microscopic traffic simulation; even a zero-minute connector needs visible screen motion.

At 4,000 drivers and a zero-minute shortcut, coordination assigns 1,750 drivers to each outer route and 500 to the shortcut, for **64.6875 minutes on average**. This is not a selfish equilibrium: some drivers would gain by switching. See `NOTES.md` for the derivation and caveats.

## Tests

```sh
node test.cjs
python3 -m pip install playwright pillow
python3 -m playwright install chromium
python3 test_browser.py
python3 video/render_video.py --preview /tmp/shortcut-trap-checks
```

The numerical suite sweeps demand, connector time, closure, and routing policy, then independently checks asymmetric feasible allocations. Browser tests exercise real controls, URL restoration, clipboard sharing, PNG export, reduced motion, responsive layouts, and runtime errors. In restricted rendering environments, `SHORTCUT_INLINE_PREVIEW=1` enables an explicit own-asset in-memory preview; its report marks URL checks as skipped. Publication requires the full HTTP tests.

## Video

[Chinese narrated walkthrough](video/shortcut-trap.mp4) · [Subtitles](video/shortcut-trap.srt) · [Capture metadata](video/shortcut-trap.json) · [Rendering instructions](video/README.md)

The project-specific GitHub Actions workflow renders and verifies these files, updates the index/gallery, publishes generated media to `main`, and invokes the existing Pages deployment. `VALIDATION.md` is generated only after the checks complete.

## Sources

- [European Mobility Week](https://mobilityweek.eu/home/): September 16–22, 2026.
- David Easley and Jon Kleinberg, [Networks, Crowds, and Markets, chapter 8](https://www.cs.cornell.edu/home/kleinber/networks-book/networks-book-ch08.pdf): the textbook Braess network and its 65-to-80-minute example.
