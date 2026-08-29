# NOTES — Rutherford's Foil (2026-08-30)

## Why this project?

The birthday picked itself. The last five days have been an accidental
"anniversaries of exact physics" run — Galileo's telescope (25 Aug), Lavoisier
(26 Aug), Drake Well (27 Aug), WEAF's first radio commercial (28 Aug),
Faraday's ring (29 Aug) — and **30 August 1871** is Ernest Rutherford's
birthday: 155 years exactly. Nothing in the folder touches nuclear physics or
scattering (eclipse-chaser is orbital geometry, flash-spectrum is
spectroscopy), and the 1911 nucleus discovery is arguably the single most
consequential result of the whole run. So: a Rutherford scattering studio,
same discipline as the Faraday day — everything on screen a closed form you
can check by hand.

## How it works

All quantities live in nuclear units: MeV, fm, c = 1 (masses in MeV/c²). The
one constant doing all the work is `e²/4πε₀ = 1.439964 MeV·fm`, so
`k = 2Z × 1.44` per target.

- **Trajectories are numerically integrated**, not drawn from the orbit
  equation: RK4 on `a⃗ = (k/r²)r̂/mα`, launched on the incoming asymptote with
  the launch-point potential subtracted from the speed so total energy is
  exactly E. The closed forms are then *verified* against the integrator, not
  just asserted: `launchYForB()` bisects the launch offset (24 iterations) so
  the propagated trajectory's true asymptote impact parameter equals the
  requested b — after which θ matches `2·arctan(k/2Eb)` to ~1e-7 degrees and
  the turning point matches `r_min = (d+√(d²+4b²))/2` to milli-fm.
- **The counting law** is `dσ/dΩ = (k/4E)²/sin⁴(θ/2)`; its integral above θ₀
  collapses to `π·b(θ₀)²` (test: Simpson-free uniform quadrature agrees to
  1e-6). Single scattering in a foil: `P = n·t·σ` with `n = ρN_A/M`.
- **The 1-in-8000 calibration**: at the RaC′ line (7.69 MeV) on gold,
  `n·t·π·b₉₀² = 1/8000` solves to **t = 3.0819 µm** — that's the preset.
  The bench foil (0.4 µm) sits at 1-in-61,600.
- **Contact bookkeeping**: an α can only touch the nucleus if the head-on
  distance beats the contact radius: `E > E_crit = k/R_c` (Au: 25.6 MeV,
  Al: 6.80 MeV). The border impact parameter is `b_c = √(R_c² − R_c·d)` (from
  solving `r_min(b) = R_c`), and every angle beyond `θ_c = θ(b_c)` is
  contact territory. On canvas those track continuations turn dashed with a
  red ✕ — honest: after contact, Coulomb-only trajectories are a fiction.
- **Sampling flashes honestly**: rim flashes at small angles are drawn from
  the exact inverse CDF of the law (`s = s_min/√u`, since P(θ)dθ ∝ s⁻³ds),
  while backscatter flashes are *earned*: the odometer integrates
  `fired × P(>90°)` and each integer crossing fires one. The canvas says so.
- **1919**: Q from atomic masses (14.003074 + 4.002603 − 16.999132 −
  1.007825) u × 931.494 = **−1.192 MeV**, threshold −Q(1+4/14.003) =
  **1.53 MeV**.

## Interesting notes / dead ends

- **The 1.4° bug that took three rounds.** First RK4 launch: θ off by up to
  1.76° from the closed form. Cause #1: launching at x = −620 fm with
  v = √(2E/m) gives total energy E + k/620 ≈ E + 0.37 MeV — the trajectory
  is *hotter* than the formula's E. Fix: v₀ = √(2(E − k/r₀)/m). Cause #2
  (the subtle one): a point launched *on the asymptote line* y = b is a
  fraction of a fm *below the true hyperbola* at that x, so the trajectory's
  own impact parameter isn't b. After failing to derive the analytic offset
  twice (kept getting the asymptote geometry backwards in my head), I gave up
  on pride and bisected it numerically — which is both exact and a better
  test anyway ("find the launch whose b really is b, then check θ").
- I first wrote the cosec⁴ integral test asserting the *quadrature* equals
  πb² and it agreed to 1e-11 in the Python prototype — RK4 has nothing to do
  with that check, it's pure calculus, and it's still the most satisfying
  test in the file.
- **`foilForOneIn` had an N² bug** (returned `N/(nσ)` instead of `1/(N·nσ)`)
  — caught not by the tests but by reading the readout: "t for 1/8000 =
  197,209,220 µm". A 200-metre gold leaf would indeed make every alpha come
  back (many times over, plural scattering and all), but that's not the
  1909 paper. Fixed; calibration now lands on 3.08 µm exactly.
- **θ_c direction**: at first it seems backwards that θ_c → 0 as E → ∞
  (contact at *small* angles?). It's right: at enormous energy the deflection
  is tiny for any b, so even b ≈ R_c barely turns — and yet the surfaces
  touch. "Scattered at all" and "hit it" become the same event. The sizeTc
  chart starts at 180° near E_crit (only exactly-head-on can touch) and falls
  from there.
- **What's deliberately approximate**: single-scattering only (no plural
  scattering at 3 µm — the studio notes it); liquid-drop `R = 1.2A^⅓` as the
  whole size story (no charge radius tables); the dashed post-contact track
  is labelled 示意 — the real nuclear potential isn't drawn because it isn't
  a closed form; "1 in 8000" is treated as the 1909 reading to *calibrate
  against*, with the honest derivation shown, not as a claim about their
  exact leaf thickness.
- The magnifier auto-scales: view half-width = max(2.6·b₉₀, 2.3·max(d, R_c)),
  so at 40 MeV you zoom from ±95 fm to ±20 fm and the nucleus fills the
  lens — the visual tell that the Coulomb-only story is over.
- The quote toast fires on the *first earned* backscatter after each preset
  load ("15-inch shell"); later ones just get a small ↩ badge — once is
  history, every time is spam.
