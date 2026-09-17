# Pendulum Room

A small observatory for a turning Earth: move a Foucault pendulum between latitudes and make hours of precession visible.

Built by GPT-6 Astra

[Open the observatory](https://dailyslop.pages.dev/2026-09-18-pendulum-room/) · [Chinese video](./video/pendulum-room.mp4) · [Subtitles](./video/pendulum-room.srt)

Made for September 18, Léon Foucault’s birthday in 1819. A floor-fixed dial records a swing direction each hour. Compare Paris, Kuala Lumpur, the equator, Sydney, and the North Pole, or choose any latitude yourself.

## How to run

Open `index.html` directly, or serve the repository root:

```bash
python3 -m http.server 8765
```

Visit <http://localhost:8765/2026-09-18-pendulum-room/>. No installation or build step.

## Using the room

- Change latitude with the slider or place buttons. Elapsed time stays the same for direct comparison.
- Scrub anywhere between release and 48 hours; each faint gold line records an hourly direction.
- Run time at one simulated hour per two seconds, jump six hours, or reset to release.
- Read the signed direction from above, hourly rate, full 360° cycle, and accumulated angle.

The initial view is paused at six hours in Paris. Native buttons and sliders support keyboard and touch. The bob stays still with reduced motion enabled; time advances only when requested. Hiding the tab pauses playback.

## What is being modelled

The ideal small-angle Foucault precession rate is `360° / 23.9344696 h × sin(latitude)`. Positive angles mean clockwise from above. At the equator the rate is zero and the precession period is infinite; negative latitudes reverse direction. A line has two ends, so it looks the same after 180°, while a directed precession cycle is 360°.

The bob is a visual guide with a readable 3.8-second animation period, independent of the accelerated precession clock. Gold lines are hourly snapshots, **not a physical continuous bob trajectory**. Drag, imperfect release, and elliptical drift are omitted. The historical wire length is context, not an adjustable simulation parameter.

## Verification

```bash
node 2026-09-18-pendulum-room/test.cjs
python3 2026-09-18-pendulum-room/test_browser.py
```

Run from the repository root. The browser check needs the server above, Python Playwright, and Chrome. It covers desktop/mobile controls, playback boundaries, keyboard input, reduced motion, browser errors, and direct-file loading. Physics checks cover independent benchmarks and symmetry. Video generation uses the existing optional Fish Audio workflow; see [video notes](./video/README.md).

## Sources

- [University of St Andrews, Foucault biography](https://mathshistory.st-andrews.ac.uk/Biographies/Foucault/): September 18, 1819.
- [Panthéon, Foucault’s pendulum](https://www.paris-pantheon.fr/en/discover/foucault-s-pendulum): the 1851 demonstration and 67-metre suspension.
- [UNSW, the physics and mathematics](https://www.phys.unsw.edu.au/~jw/pendulumdetails.html): latitude dependence, direction, and sidereal rotation period.
