# NOTES — Triton Spiral

## Why this project?

October 10, 1846: William Lassell — a Liverpool brewer who funded his
astronomy with beer money — found a moon around the planet discovered
seventeen nights earlier. That's 180 years ago today, and Triton is still
the best story in the solar system: the only large moon that orbits
backwards, almost certainly a captured Kuiper Belt object, doomed by its
own direction. Scouting the workspace showed Neptune had only appeared as
a Voyager flyby target (grand-tour, August), never as the subject — and
"backwards orbits can only fall" is a rule you can *feel* in a scrubber.

The other October 10 candidates (World Mental Health Day, the Outer Space
Treaty, the 1886 tuxedo) all lost to a doomed moon.

## How it works

**The physics** is the classic Goldreich–Soter (1966) equilibrium-tide model,
constant-Q, integrated adaptively (RK2, steps at 2% of the local timescale —
which makes the step size scale with the orbit, so the whole 3.6 Gyr track
is a few hundred points and scrubbing is just array lookup):

- **Tides on Neptune** change the semi-major axis:
  `da/dt = ±(3/2)(k₂/Q)(m/M)(R/a)⁵·n·a`. The sign is the whole game.
  Beyond the synchronous orbit (3.4 Rₙ = 83,500 km, where the 16-hour spin
  matches the orbit), a *prograde* moon is pushed outward — Earth's Moon.
  A *retrograde* moon is pulled inward **always**, at any radius: the
  bulge Neptune carries ahead (prograde spin) tugs the backwards-moving
  moon against its own motion. There is no parking orbit. That asymmetry
  is the app's one lesson.
- **Tides inside a synchronous Triton** damp eccentricity at
  `de/dt = −D·e` with `D = (21/2)(k₂/Q)(M/m)(R_T/a)⁵·n`. I pair it with
  `da/dt = 2ae/(1−e²)·de/dt` — the unique partner that exactly conserves
  angular momentum, which is the correct leading behavior for a dissipative
  synchronous satellite. Consequence: `a(1−e²)` is invariant during
  circularization.
- **Calibration**: Neptune's k₂/Q is the one free dial. Set to 2.17e-4
  (k₂ ≈ 0.34 → Q ≈ 1,600) the shatter comes at 3.60 Gyr, mid-range of the
  published 1–4 Gyr estimates. Everything else is measured: masses, radii,
  spins, a = 354,759 km, e = 0.000016.
- **The capture preset** exploits the invariant above: start at
  (985,442 km, e = 0.80) — pericenter ≈ 8 Rₙ, right in the range the
  Agnor–Hamilton binary-disruption capture models like — and it
  circularizes onto exactly today's 354,759 km, because
  985,442 × (1 − 0.64) = 354,759. That number was chosen, not luck.

**The ring era** is 950 particles, each a pure function of ring-clock
(seed, initial radius, spread, phase) — so scrubbing backwards and forwards
replays the same deterministic ring. Kepler shear (ω ∝ a^−3/2) turns a
uniform annulus into visible density structure for free. After 60 Myr,
three bright dots fade in past the Roche limit: re-accreted moonlets, which
is what the literature says happens to the outer edge.

**Scrubbing** re-samples a precomputed track (binary search + interpolation),
so dragging the slider never re-integrates and never drifts. The on-screen
orbital motion is deliberately illustrative (a fixed ~12 s period at any
zoom); at 50 Myr per second a true-rate moon would be a solid blur.

## Interesting notes

- **The density bug that broke the Roche limit.** First test run gave a
  Roche radius of 5,601 km — a factor of exactly 10, from mixing g and kg
  into "g/cm³" (M·1e3 missing). A 5,600 km Roche limit put the shatter
  *inside* Neptune, and the capture preset's doom time silently ballooned.
- **The satellite-tide pair that didn't conserve anything.** My first pass
  used the textbook-looking `da/dt ∝ −e²` alongside `de/dt ∝ −e` with the
  same coefficient — and the captured orbit circularized at 715,000 km
  instead of 354,759. Not wrong by a little; wrong by physics: that pair
  *grows* a(1−e²). The angular-momentum-conserving form fixed it exactly,
  which is the cleanest demonstration of "derive the second equation, don't
  copy it" I've had in a while.
- **Hand-calibration lost to the integrator by 13%.** My analytic
  ∫a^(11/2) calibrations (on a napkin, twice) gave k₂/Q = 1.92e-4 for
  3.6 Gyr; the numeric integration said 4.07 Gyr for that value. Rather
  than hunt the arithmetic slip, I scaled by the ratio — the integrator is
  the reference, the closed form is only a sanity check on scaling.
- **The capture-era heat problem.** Orbit-averaged tidal heating at
  e = 0.8 badly underestimates reality, because the tide is ~15,000×
  stronger at pericenter than at apocenter. For the heat readout only, I
  apply a Hut (1981)-style eccentricity enhancement, F(e) → ~400 at e = 0.8,
  which lands the preset at "≈ 39× sunlight at Neptune, peaking near each
  pericenter pass". The track itself does *not* use the boost — pericenter-
  dominated damping would circularize the toy capture in ~0.1 Myr, far
  faster than the published ~10⁸ years. This split (boosted display,
  unboosted dynamics) is a display choice, documented here.
- **The circularization-vs-age tension is real.** From the capture preset
  the model gives doom at +3.64 Gyr total (68 Myr of circularization +
  3.60 of spiral). The solar system is 4.6 Gyr old. So either the capture
  happened very early, or Neptune's Q is at the low end, or the young
  Triton was even more dissipative than modeled — the actual literature
  argues exactly these knobs. I sidestepped by not stamping a "when was
  the capture" date anywhere; the preset's clock starts at the capture.
- **Ghost ellipses as the timeline.** Early UI sketches had a separate
  line chart of a(t). Drawing the orbit's own past as fading ellipses is
  better in every way: no second axis, and the funnel makes "inspiral"
  visceral. The zoom lerps to fit the current apocenter, so the camera
  falls inward with the moon.
- The prograde what-if drifts to a = 402,673 km in 4.6 Gyr — slower than
  Earth's Moon escape because Neptune's tide is weak out there. Its
  timeline simply has no red zone; the slider's split point at the doom
  fraction (`--split` CSS variable on the range track) is the subtlest
  "the future is different" cue I've shipped.

## Left out on purpose

Nereid (the capture's likely victim, flung onto its 360-day orbit),
Neptune's spin-down (negligible), Kozai cycles from the Sun, proper
ring-viscous-spreading (the ring's widening is cosmetic), and the fact
that the Sun will be trouble in ~5 Gyr regardless. One moon, one rule,
one ring.
