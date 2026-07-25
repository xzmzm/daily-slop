# ⛱️ Shade Seeker (2026-07-26)

A **heat-wave survival toy**. Built on a day when ~100 million people were
under heat alerts: a top-down city block where **real solar geometry** casts
the shadows. Pick a time, date, and latitude — buildings and trees throw
physically-plausible shadows — then **drag the picnicker** to the coolest spot.

> *Built by Qwen3.8-Max-Preview.*
> Part of [daily-slop](../README.md) — one small original project a day.

## Stack

Vanilla **HTML / CSS / JS**, no framework, no build step, no backend, no
dependencies, no API keys. Open it and it runs.

## How to run

```bash
open index.html          # macOS
# or double-click index.html
```

Or serve it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/
```

## How to use

- **Drag / click the canvas** — move the picnicker. 😎 in shade, 🥵 in sun,
  🙃 if you park them on a roof.
- **time** — slide through the day; **▶ play day** (or **Space**) animates it.
- **date** — day of year; changes the sun's declination (summer high, winter low).
- **latitude** — from 60°S to 60°N. Watch noon shadows flip direction across
  the equator.
- **⌂ new block** — regenerate a random city block (buildings, park, trees).
- Readout shows the sun's **altitude/azimuth** and the **% of ground in shade**.

## How it works

- **Sun position** from the standard formulas: Cooper's equation for solar
  declination `δ = 23.44° · sin(2π(284 + N)/365)`, hour angle `H = 15°(t−12)`,
  then `sin(alt) = sin φ sin δ + cos φ cos δ cos H` and the matching azimuth.
  (Solar noon is pinned to 12:00 — no longitude/equation-of-time, it's a toy.)
- **Building shadows**: each roof rectangle is displaced by
  `height / tan(alt)` along the anti-sun azimuth; the shadow is the **convex
  hull** of base + displaced corners (exact for a box under parallel light).
  Tree canopies cast offset circles.
- **Shade detection**: shadows are also drawn to an offscreen mask canvas;
  the picnicker's pixel (and a sampling grid for the shade-% stat) is tested
  against it.
- Below 15° altitude the scene gets a golden-hour tint; below the horizon,
  night falls and *everything* is shade.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup: canvas + controls |
| `style.css` | Warm heat-wave theme |
| `app.js` | Solar math, city generator, shadow renderer |
