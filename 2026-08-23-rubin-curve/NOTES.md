# NOTES — 2026-08-23 · Rubin Curve

## Why this project

Today is Vera Rubin's birthday (Aug 23, 1928 — her 98th). Scouting the
date turned up two strong candidates: the Gossamer Condor's Kremer-prize
flight (Aug 23, 1977) and Rubin herself. The Condor lost for one reason:
yesterday's schooner-america was already low-speed aerodynamics (lift,
drag, polars), and two consecutive days of wing physics felt like a
repeat. Rubin's flat rotation curves touched nothing in the index —
closest neighbours are flash-spectrum (Doppler/spectroscopy, but for
helium in the Sun) and grand-tour (gravity, but orbital mechanics). A
galaxy you *measure* and then discover is mostly invisible is a genuinely
new concept for the collection.

The peg is also deliciously current: the Vera C. Rubin Observatory —
first light June 2025, named for her — is right now doing its decade-long
LSST survey, photographing the entire southern sky every few nights.

## How it works

**The physics engine** (`physics.js`, pure ES module so `node --test` can
exercise it):

- **Disk**: Freeman (1970) exponential-disk rotation curve in the exact
  Bessel form `v_d² = 4πGΣ₀h·y²[I₀K₀ − I₁K₁]`, `y = r/(2h)`,
  `Σ₀ = M/(2πh²)`. This is the honest Newtonian prediction from the
  starlight: rises roughly linearly, peaks near `2.15h` at
  `0.622√(GM/h)` (Binney & Tremaine anchors — both asserted in the
  tests), then falls, approaching Kepler `√(GM/r)` in the far field
  (also tested).
- **Halo**: pseudo-isothermal sphere, `v_h² = v∞²[1 − (r_c/r)atan(r/r_c)]`
  — solid-body inside the core, flat outside, so enclosed halo mass
  grows linearly with r. Total = `√(v_d² + v_h²)`, the standard
  rotation-curve-fit decomposition. Enclosed mass comes straight from
  the curve: `M(<r) = v²r/G`, so the dark fraction is
  `1 − M_disk(<r)/M_total(<r)` — 74% inside 24 kpc with the defaults.
- **Measurement**: the app measures the *real* curve (disk+halo, σ = 8
  km/s Gaussian noise, seed 42) regardless of what the model chips show —
  data is data. The pedagogy: flat points in, visible-mass prediction
  revealed, gap annotated (`×2.1 too fast` at 24 kpc with defaults).

**The Bessel functions** are the load-bearing detail. I didn't trust my
memory of the Abramowitz–Stegun / Numerical Recipes coefficient tables,
so I implemented them from definitions instead: I₀ and I₁ by their
all-positive power series (`(x²/4)^k/(k!)²` — no cancellation, converges
everywhere), K₀ from the small-argument harmonic-number series I derived
on paper (`−ln(x/2) − γ + Σ z^k/(k!)²(H_k − ln(x/2) − γ)`), and K₁ from
the Wronskian identity `I₀K₁ + I₁K₀ = 1/x`. Everything is validated
against 14 textbook reference values to 7 digits. Lesson burned in from
past projects: when you can derive it, don't recall it. (First test run
caught me anyway — one of my "reference" values for K1(5) was wrong, not
the code: 0.0099 vs the true 0.00405.)

**The sky canvas** has two modes sharing one particle population
(1500 exponential-disk stars, 230 bulge stars, 14 pink HII regions, all
seeded from `mulberry32(1970)`):

- *Spectrograph* (the default): near-edge-on disk (84°, M31 idealized
  from its true 77°), each star Doppler-tinted by its line-of-sight
  velocity `v·cosθ·sin i` — blue left, red right. Below it, a spectrum
  strip: the Hα line (lab 656.281 nm) walks left as you drag the slit
  outward, with a Δλ bracket to the dashed lab marker. Recording adds a
  chart point at `(r, |v|)`.
- *Orbit view*: the disk turning at true Newtonian angular speeds
  `ω(r) = v(r)/r` (in kpc/Gyr via 1 km/s = 1.0227 kpc/Gyr — the first
  unit conversion I've enjoyed in weeks). Star trails are a persistent
  offscreen canvas faded with `destination-out` each frame, so switching
  the halo off visibly slows the rim mid-flight. Inner stars lap the
  outer ones, so the initial log-spiral arm pattern winds up on its own —
  the winding problem as a free bonus.

**Time scale**: 55 Myr per real second. Inner region (1 kpc) turns about
once per 3 s; a star at 24 kpc takes ~15 s per revolution — slow enough
to look majestic, fast enough to see the differential shear accumulate
in the trails within ten seconds.

## Interesting notes

- **The unit anchor**: `G = 4.30091×10⁻⁶ kpc·(km/s)²·M☉⁻¹`. Once you work
  in kpc / km/s / M☉, every formula loses its scientific notation and the
  whole app is plain arithmetic.
- **The inner disk rises slightly faster than linearly** — the
  combination `I₀K₀ − I₁K₁` diverges like `ln(1/y)` as y→0, so
  `v_d ~ r·√ln(1/r)` near the centre. My first test asserted a strict
  linear ratio (0.5) and failed at 0.55 — not a bug, a real feature of
  the exact solution. The test now documents the correction.
- **Catastrophic cancellation** in the halo formula at small r
  (`1 − (r_c/r)atan(r/r_c)` is 1−0.999997…) — harmless here because
  v∞² multiplies it down, but worth remembering if anyone reuses it at
  tiny radii.
- **Rubin & Ford details** that shaped the UX: 67 emission regions,
  3–24 kpc, ~10 km/s accuracy (→ my σ = 8 noise and ±10 error bars),
  Kent Ford's DTM image-tube spectrograph (135 Å/mm dispersion, in the
  Smithsonian's collection), Lowell's 72-inch telescope — the same one
  Slipher used for the first galaxy Doppler shifts in 1912. The "12
  points" default and the sweep echo the paper without impersonating its
  data.
- **The dark percentage is honest for the toy galaxy**: 74% inside 24
  kpc, not Rubin's famous "factor of ten" — that quote refers to the
  full mass budget including gas and outer halo over a galaxy's whole
  extent. The header quote and the ledger number deliberately tell
  different truths.
- **Deliberately left out**: Bayesian curve fitting (overkill for a toy),
  the NFW halo profile (pseudo-isothermal gives a cleaner flat line for
  pedagogy), bulge mass as a separate component (it would only sharpen
  the inner rise), and audio. The winding problem is demonstrated, not
  simulated — density-wave theory would have doubled the scope for a
  footnote.
- **Video plan**: drive via `window.__demo.loadScenario()` —
  `m31-1970` (measure), `visible-fails` (halo off, warning chip),
  `reveal-halo` (ghost cloud + gold fit) — same recipe as the schooner
  video.
