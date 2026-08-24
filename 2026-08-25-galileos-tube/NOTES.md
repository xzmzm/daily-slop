# NOTES — Perspicillum (2026-08-25)

## Why this project?

Today is 25 August. Scanning "on this day": 25 Aug 1609 is the date Galileo
demonstrated the telescope to the Venetian Senate — the anniversary that
effectively founded both applied optics (the salary demo) and observational
astronomy (what he did with the free time). The repo already has plenty of
astro-*targets* (eclipse, Perseids, Voyager, rotation curves, Vesuvius) but
no geometric optics, and no ray tracer. A Galilean telescope is the perfect
intersection: the whole instrument is two thin lenses and one division, yet
it carries real subtlety (virtual exit pupil, vignetting-limited field,
dispersion). Different concept from every previous day — checked the full
`2026-*` folder list first.

## How it works

**The engine** (`physics.js`) is strictly paraxial first-order optics:

- A ray is `(y, θ)`. A thin lens does `θ ← θ − y/f`; propagation does
  `y ← y + θ·Δx`. The Galilean ocular is just `f < 0`. That's the entire
  tracer — everything else is bookkeeping and clipping against the three
  apertures (objective stop, ocular, eye pupil).
- **Focused transfer identity.** With ocular at `L = f_o + f_e`, a bundle
  entering at field angle α exits at exactly `M·α` with `M = f_o/|f_e|`,
  independent of entry height — the test asserts this to 1e-6°, and it only
  holds if propagation and refraction are *consistent*. Which is the story
  of the one real bug (below).
- **Exit pupil from ABCD matrices.** Image the objective stop through the
  ocular: the image plane is where B of `P(z)·L(f)·P(L)` vanishes, giving
  `z = L·f_eye/f_obj` (negative → virtual, inside the tube) and lateral
  magnification `|f_eye/f_o|`, so `D_x = D_obj/M`. All three closed forms
  are exact and tested.
- **True field of view.** The chief ray leaves the ocular at height `L·α`
  and walks `M·α` per cm, so the exit bundle (width `D_x`) fits a pupil of
  radius `r_p` only while `α·(L + ℓ·M) ≤ r_p − D_x/2`. That lever-arm law
  reproduces the historical ~15 arc-minute Galilean field, and a 40-step
  bisection over the actual ray tracer agrees with it to <2%. My *first*
  closed form forgot the `L·α` term and predicted a field 4× too big — the
  numeric sweep caught it before the test did.
- **Dispersion.** Cauchy `n = A + B/λ²` with crown values
  (n_d = 1.5168); lens power scales as `(n−1)`, so the blue focus lands
  ~1.5% short of red — 1.3 cm of longitudinal CA on a 66 cm objective,
  drawn as three colored bundles.
- **The 1610 sky.** Moon longitudes are mean-motion circular
  (1.769138/3.551181/7.154553/16.689017 d) with phases *calibrated to the
  Jan 7 sketch* (all four east, strung outward) — explicitly not an
  ephemeris, and the tab note says so. Venus phases come from circular
  coplanar orbits anchored at inferior conjunction; the tests pin k=0
  there, k>0.97 at half the 583.92-day synodic period, and peak elongation
  = arcsin(0.723) = 46.35°.

**The eyepiece view** uses one consistent window rule: both circles span
the same *apparent* angle `M × TFOV`, so the tube side shows exactly the
instrument's true field (the ledger number) and higher power visibly
trades field for size — Callisto keeps leaving the view at ×33, which is
precisely why Galileo's early sketches show only two or three moons.

## Interesting notes

- **The tan() bug.** I first propagated rays with `tan(θ)` but refracted
  with raw `θ`. For a focused scope the exit slopes came out ~9e-6 rad
  apart instead of 0 — invisible on screen, fatal to the "exactly M·α"
  test. Fix: strictly linear propagation. Lesson: in a paraxial model,
  *commit* to paraxial.
- **The empty-bench bug** was dumber: `benchView()` passed raw `state`
  (which stores `fEyeMag`, not `fEye`) into the physics helper → `xMax`
  became NaN → every `sx()` was NaN → canvas calls silently drew nothing
  (only the pixel-coordinate labels survived). Canvas NaNs don't throw,
  they just vanish — I ended up monkey-patching `strokeRect`/`moveTo` in
  the page to log non-finite args to find it.
- **Footer text must be drawn after `ctx.restore()`.** The scene draws
  inside a circular clip; my first scale-bar labels were decapitated by the
  arc and it took a zoomed screenshot to see why.
- **The field-of-view model is pupil-bound, not aperture-bound**, so TFOV
  barely changes from ×9 to ×20 (0.240° → 0.234°) while apparent field
  grows. That looked wrong until I checked it against the history: the
  *really* narrow fields of his ×30 scopes came from terrible off-axis
  aberrations and tiny oculars, not the first-order geometry. The app
  teaches the first-order truth; the NOTES teach the rest.
- **Deliberately out of scope:** spherical aberration, field curvature,
  the Moon tab (crater shading is a project of its own), and any claim
  that the moon phases are an ephemeris. JPL can't even do 1610 to
  sketch-level confidence without DE ephemeris extensions, and "calibrated
  to his notebook" is more honest and more fun.
- The Jan 7 ×33 coincidence: with the calibrated phases, the Medici preset
  shows *exactly* three starlets east of the disc (Callisto just outside
  the field) — the preset slider and the notebook agree by construction,
  but it still felt like magic the first time it rendered.
