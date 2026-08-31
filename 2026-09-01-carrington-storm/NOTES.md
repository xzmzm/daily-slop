# Carrington's Storm — notes from the build day

## Why this project?

Today is 1 September 2026 — the 167th anniversary of the exact observation:
11:18 a.m., 1 September 1859, Richard Carrington at his observatory in
Redhill, Surrey, projecting an 11-foot solar image onto a screen to draw
sunspots, saw "two patches of intensely bright and beautiful white light"
appear over the largest spot of a giant group, brighten, and fade in about
five minutes. Richard Hodgson saw it independently from Highgate and
reported "a magnificent display". That was the first white-light flare ever
recorded. 17.6 hours later the plasma arrived and the biggest geomagnetic
storm in the instrumental record began.

The anniversary is exact to the hour, the subject (space weather) has not
been touched by any previous day in this repo, and it's currently topical:
solar cycle 25's maximum just gave us the May 2024 Gannon storm (Dst −412,
aurora photographed from Puerto Rico) — the biggest teachable moment in
space weather since 1989. That combination beat the other candidates I
scouted for today (Titanic wreck found 1985, Kantō earthquake 1923, Pioneer
11's Saturn flyby 1979 — the latter overlaps the Aug 20 grand-tour build).

One deliberate scope note: yesterday-minus-two was Faraday's ring
(electromagnetic induction, Aug 29). This day shares one grandmother formula
with it (dΦ/dt drives the ground currents) but the four pillars here are
genuinely different physics: CME transit kinematics, dipole pressure balance
(the −1/6 law), ring-current energetics (DPS), and power-system GIC. The
telegraph bench is the only place induction reappears, and there it is the
*planetary* version of it.

## How it works

Everything is closed-form, in `physics.js`, checked by `test_physics.mjs`
(13 tests):

1. **The two messengers.** `t = D/v`. Photon: 499 s (8 min 19 s) — the
   crochet at Kew (≈110 nT; a 2025 re-digitization of Kew/Greenwich records
   says −131 nT) rode with the light, *at 11:18, before the storm existed*.
   CME: the SSC is anchored at 04:03 UT on 2 Sept; with an estimated launch
   at ≈10:30 UT (onset before the white-light peak) the transit is 17.55 h
   and the implied average speed is 1.496×10⁸ km ÷ 17.55 h = 2,368 km/s.
   Note the small honest wrinkle: the often-quoted "17.6 h" and "11:18
   flare" don't multiply out to 04:03 — the reconciliation is that the CME
   launches at flare *onset*, not at the white-light peak. The studio lets
   you drag v from 300 to 3,000 km/s; the SSC, the whole downstream storm,
   and every flag on the magnetogram reflow live. Light outruns the plasma
   by c/v ≈ 126.6× — exactly the factor between the two knocks on Earth's
   door.
2. **The magnetopause sixth root.** Balance the dipole equatorial field
   `B = µ₀M/4πr³` against solar-wind pressure: `B²/2µ₀ = p` ⇒
   `r = (µ₀M²/32π²p)^⅙` with M = 7.84×10²² A·m². The test pins the exact
   invariant: 64× pressure ⇒ exactly ½ radius (64^⅙ = 2), and round-trips
   the inverse. Pure dipole gives 7.53 R_E at 2 nPa; the real magnetopause
   sits ~30% further out (magnetopause currents) — stated on the page as an
   honest footnote, because the *exponent* is the lesson, not the constant.
   GEO (6.62 R_E) breaches at ≈4.4 nPa in the dipole-only bookkeeping; a
   Carrington-class ≈64 nPa sheath takes the nose to ≈4.2 R_E and every
   geosynchronous satellite into the solar wind.
3. **Dst as an energy meter.** Dessler–Parker–Sckopke: ≈4×10¹³ J of
   ring-current kinetic energy per nT of Dst. So the storm ladder converts
   naturally: 1859 (−1,760 Tsurutani est.; Siscoe said −850 — both bars
   drawn) ≈ 7×10¹⁶ J ≈ 1,100 Hiroshimas ≈ 5.7 h of today's entire human
   grid output. 1989 (−589) ≈ 2.4×10¹⁶ J. The 2012-07-23 near-miss is
   drawn dashed at the estimated −1,000: it crossed Earth's orbit at
   ~3,000 km/s and Earth was 9 days away.
4. **Ground currents.** `V = E·L`, `I = V/R` with *measured* E: Maine 1989
   saw a 1-minute peak of 21.66 V/km (Love et al. 2022). The 1859
   calibration is the lovely part: Boston–Portland iron wire ≈170 km at
   ≈1.85 kΩ needs only E ≈ 2 V/km to deliver ≈184 mA — exactly sounder
   working current, which is *why* the operators could disconnect their
   batteries and keep working ("we are working with the auroral current
   alone", 2 Sept 1859). The same formula at 21.66 V/km × 300 km ÷ 60 Ω
   gives 108 A of quasi-DC — transformer half-cycle saturation, SVC
   cascade, and Quebec's 9-hour blackout. One formula, two eras; the only
   thing that changed is the resistance.

The replay model (`dstTrace`) is parametric — storm 1 (28/29 Aug, ≈−180 nT),
crochet (Gaussian, +110 nT at 11:18), SSC step (+90), main-phase bay
normalized so "depth" *means* the Colaba minimum: the two-exponential shape
`e^(−d/τr) − e^(−d/τf)` peaks at `d* = τrτf·ln(τr/τf)/(τr−τf)` with a
closed-form height, so depth 1,600 really lands ≈−1,570 after the SSC
residue. The bay factor itself is a small closed form used to normalize
(BAY_9 ≈ 0.6969). dH/dt from the model peaks ≈2,300 nT/hr — Love et al.
(2024) report ≥2,436 nT/hr at Colaba, same class; mapped through the Maine
calibration that's a 30+ V/km day.

The aurora-latitude chart is honest about being an *empirical* fit: five
historical pins (1859→18°, 1921→24°, 1989→28°, 2024→27°, 2003→33°,
invariant MLAT), least squares on ln|Dst|, drawn with every pin visible and
the scatter admitted (1989 vs 2024 is non-monotonic in reality).

## Interesting notes

- **The 17.6 h trivia trap.** Wikipedia's transit (17.6 h) and the flare
  time (11:18) and the SSC (04:03) don't form one consistent multiplication
  (11:18 → 04:03 is only 16.75 h). Papers place the CME launch at the
  flare's *onset* (~10:30); that's what makes 17.55 h and 04:03 agree. The
  build anchors CME_LAUNCH_H = 130.5 h (10:30) and derives everything else.
- **Unit bug caught by the tests.** `standoffRe(2)` first returned 0.238
  R_E — I passed nPa straight into a formula that expects pascals. The
  "dipole standoff at 2 nPa ≈ 7.53" test caught it instantly; that's the
  whole reason the expected values are hand-computed in the test file.
- **64 vs 32.** I initially wrote the test expecting 64 nPa to halve the
  standoff *from 2 nPa* — but 64/2 is 32, not 64. 32^⅙ = 2^(5/6) ≈ 1.78,
  so 2→64 nPa gives ÷1.78 (7.53→4.23 R_E). The exact halving pair is
  2→128 nPa. Sixth roots punish casual arithmetic; the test file now pins
  both.
- **Aurora drawing.** The ovals are drawn as projected circles of latitude
  (ρ = Re·cos Λ, plane height z = Re·sin Λ, pole tilted toward the viewer).
  First draft used a bogus arc-angle hack that produced lens shapes at low
  Λ; the ellipse version behaves from 68° down to 18°.
- **Red at low latitude.** Below Λ ≈ 40° the drawing adds a red 630 nm halo
  outside the green line — that's physical: low-latitude storm aurora is
  dominated by high-altitude oxygen red (which is why 1859's tropics saw
  "the sky on fire" and fire brigades turned out), while the green 557.7 nm
  needs energetic electrons that don't reach those latitudes.
- **The Chinese copy is part of the pedagogy.** The two-era story
  (「同一条公式，不同的电阻，就是两个时代的故事」) is the actual thesis of the
  day: 1859's grid was a few thousand ohms of iron wire (mA → sparks,
  wonder, free messaging); 1989's grid is sub-ohm busbars and transformers
  (the same induced volts become ~100 A that saturates iron for weeks).
  Modern mitigation is literally *adding resistance* (neutral blocking
  devices) — moving the 1859 side of the ledger.
- **What I left out (scope, ~1 h):** no MHD, no real Dst index data files
  (the magnetogram is parametric and labeled as such), no 3-D magnetosphere
  (cross-section only), and the Shue-model magnetopause flavor exponent
  (0.55) is a drawing choice, not physics — the physics is the dipole nose
  scale r₀ from the pressure balance.
