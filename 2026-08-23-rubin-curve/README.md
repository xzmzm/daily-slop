# Rubin Curve — dark-matter rotation-curve studio

**Built by GLM-5.3**

Vera Rubin's birthday project (born Aug 23, 1928). Measure a galaxy's
rotation curve exactly the way she and Kent Ford did in 1970 — put a long
slit across M31, read the Doppler shift of the Hα line, and watch the
curve refuse to fall. Then ask Newton what the starlight alone allows,
and meet the 74% of the galaxy you cannot see.

- **Spectrograph mode** — edge-on M31 with blue-shifted (approaching) and
  red-shifted (receding) stars; drag the slit, watch the emission line walk
  away from its lab wavelength, and record `v = c·Δλ/λ` point by point.
- **Rotation curve chart** — your measurements against the visible-mass
  prediction (Freeman's exact exponential-disk curve), the halo, and the
  point-mass Kepler line. The red bracket measures how "too fast" the
  outer points are.
- **Orbit view** — the whole disk turning at Newtonian speeds. Switch the
  dark-matter halo off and the rim visibly slows down… but your data still
  says *flat*, and the warning chip lights up.
- **"See the invisible"** — the violet ghost cloud the flat curve demands.
- **Mass ledger** — inside 24 kpc (the paper's last measured point):
  M_visible ≈ 5.9×10¹⁰ M☉, total ≈ 2.3×10¹¹ M☉ → **74% invisible**.

Physics: exponential disk `v² = 4πGΣ₀h·y²[I₀(y)K₀(y) − I₁(y)K₁(y)]`
with `y = r/2h` (Bessel functions implemented from their defining series —
see `test_physics.mjs`), pseudo-isothermal halo
`v² = v∞²[1 − (r_c/r)·atan(r/r_c)]`, combined in quadrature. A flat curve
forces `M(<r) ∝ r` — mass that keeps growing into the dark.

## How to run

```
open index.html
```

or

```
python3 -m http.server 8765      # from the repo root
# → http://localhost:8765/2026-08-23-rubin-curve/
```

Tests: `node --test test_physics.mjs` (validates the Bessel functions
against textbook values and the disk curve against the Binney & Tremaine
peak anchors `R_peak ≈ 2.15 h`, `v_peak ≈ 0.622√(GM/h)`).

## The history

Rubin & Ford, *Rotation of the Andromeda Nebula from a Spectroscopic
Survey of Emission Regions*, ApJ **159**, 379 (1970): 67 HII regions from
3 to 24 kpc, Hα velocities good to ~10 km/s, measured with Kent Ford's
DTM image-tube spectrograph on Lowell Observatory's 72-inch telescope.
The curve stayed flat where the starlight said it should fall — and after
their 1980 survey of 21 more galaxies showed flatness was the rule, dark
matter became the central problem of physics. The Vera C. Rubin
Observatory in Chile — first light 2025, named for her — is now scanning
the whole sky every few nights.
