# Triton Spiral

Triton, found 180 years ago today, circles Neptune backwards — and a backwards
orbit can only wind inward. Scrub 3.6 billion years of tides to the day the
moon shatters into the brightest ring the solar system has ever worn.

Built by GLM-5.3

Made on October 10, 2026 — 180 years to the day since Liverpool brewer
William Lassell found Triton, seventeen nights after Neptune itself. The app
replays the whole doomed courtship: the capture, the slow tidal spiral, the
Roche limit, and the ring that follows.

## How to run

Open `index.html` directly, or from the repository root:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765/2026-10-10-triton-spiral/](http://localhost:8765/2026-10-10-triton-spiral/).
No installation, build step, backend, or network access is needed.

## Using the lab

- **Scrub or play the timeline.** The ghost ellipses are the orbit's own past;
  the funnel they form *is* the story. The dashed ring is the Roche limit
  (2.3 Rₙ, ≈ 56,000 km); the dotted teal ring is the synchronous orbit
  (3.4 Rₙ), the line that decides a moon's fate.
- **Flip the direction.** Retrograde (real) Triton must fall; prograde Triton,
  beyond the synchronous line, drifts outward like Earth's Moon — its doom
  evaporates into a slow escape.
- **Switch presets.** *Today* starts from the measured orbit (a = 354,759 km,
  e ≈ 0.000016). *Just captured* starts from a plausible post-capture orbit —
  eccentric, wild, and cooking with tidal heat — and circularizes onto today's.
- **Run past the shatter.** Triton comes apart at the Roche limit into a ring
  of 2.1×10²² kg — over a thousand Saturns' worth of ring mass. The inner
  edge rains onto Neptune; let it run long enough and the outer edge buds
  back into new moons.

On-screen motion is illustrative (real orbits would be a blur at 50 Myr/s);
the orbit geometry, the timeline, and every readout come from the integrated
tidal model. Reduced-motion preferences are respected.

## Checks

```sh
cd 2026-10-10-triton-spiral && node tests.js
```

16 checks: Kepler's third law against the measured 5.877-day period, the
synchronous and Roche radii, the 3.6 Gyr time-to-shatter, the prograde
escape, capture circularization, and the tide-rate signs.

## Model notes

Constant-Q equilibrium tide (Goldreich & Soter 1966). Neptune's k₂/Q is
calibrated so Triton meets the Roche limit in 3.6 Gyr, inside the published
1–4 Gyr window; the capture preset assumes a young, ocean-bearing Triton
(k₂/Q = 0.05). The satellite-tide pair conserves orbital angular momentum
exactly, so a capture at (a₀, e₀) always settles at a₀(1−e₀²) — which is how
the preset's 985,442 km at e = 0.80 lands on today's 354,759 km. Details and
dead ends are in [`NOTES.md`](./NOTES.md).
