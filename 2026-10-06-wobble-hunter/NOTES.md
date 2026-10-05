# Notes — Wobble Hunter (2026-10-06)

## Why this project?

Scouting 6 October turned up the strongest anniversary of the week: on this day in
1995, Mayor and Queloz stood up in Florence and announced a planet around a
Sun-like star. Every exoplanet story since starts there, it collected the 2019
Nobel, and the detection method — read the star's wobble off its Doppler shift —
is exactly the kind of invisible-physics toy this workspace loves: nothing to
see, everything to measure. No prior day has touched exoplanets, so the concept
slot was free.

The runner-up candidate was the 1927 *Jazz Singer* premiere (film-sound sync),
but the last two days already lived in film cutting and mechanical television;
astronomy won on novelty.

## How it works

Everything hangs off three formulas in `core.js`:

- **Kepler III**: `P = 365.25 d × √(a³ / (M⋆ + m))` with a in AU, masses in
  solar units. Star mass is fixed at 51 Peg's 1.06 M☉ — every preset orbits the
  *same* star, which keeps comparisons honest.
- **Velocity semi-amplitude**: `K = 28.4329 m/s × (m sin i / MJ) × (P/yr)^(-1/3)
  × (M/M☉)^(-2/3)`, circular orbit. The readout multiplies by sin i, so the tilt
  slider scales the signal; the drawn ellipse squashes by cos i. Face-on
  (i = 0) is a full circle in the sky panel and a flat line on the chart —
  the method's blind spot, shown live.
- **Wobble radius**: `a × m/(M⋆+m)` — 3,234 km for 51 Peg b, about half an
  Earth radius. The panel magnifies it to 44 px and prints the factor (~×800;
  the Earth preset drives it past ×60,000, which is its own lesson).

The discovery preset (m sin i = 0.46 MJ, a = 0.0522 AU, M = 1.06 M☉) lands on
P = 4.2304 d and K = 55.6 m/s, matching the published values.

The chart is **stateless**: v(t) = K sin i · cos(2πt/P) is evaluated per pixel
across a three-period window every frame. No sample buffer, no scrolling ring —
which means dragging the mass slider morphs the whole window continuously with
zero discontinuity, and the phase gridlines (one per period) stay put while the
"now" edge slides. Cheapest possible scrubbing UI.

The spectrum strip is honest about being a lie: the real Δλ at 56 m/s is
~10⁻⁴ nm, un-drawable, so the line's travel is a fixed ±46 px regardless of
amplitude (it tracks the *sign and phase*, colored blue/red, never pretending
to be to scale).

## Interesting notes

- **Phase gotcha worth internalizing**: radial velocity peaks when the star
  *crosses* the sky-plane midline (displacement zero, speed max), not when it's
  farthest off-center. The chart's extrema line up with the star passing the
  barycentre's level — I initially expected the opposite and the first browser
  test caught me.
- **Log-slider tick trap**: my first range labels assumed evenly spaced ticks.
  On a log scale, 1 M⊕ sits at slider 237 and 1 MJ at 819 — nowhere near the
  quarters. Fixed by labeling only true endpoints (0.1 M⊕ / 6 MJ).
- **Two labels were invisible for an hour**: `BARYCENTRE ✕` and `51 PEG`
  started as siblings of their SVG groups instead of children, so they rendered
  at absolute (14, 4) and (0, 52) — clipped to fragments in the panel corners.
  A full-page screenshot review caught both; they now ride inside the moving
  groups.
- The wobble circle was first drawn at 26 px, smaller than the 30 px star disc —
  so the barycentre cross sat permanently *inside* the star and read as missing.
  Growing it to 44 px lets the star swing clear of the ✕ at the extremes.
- Test tolerances taught the formula back to me: doubling mass does *not*
  exactly double K, because the planet also enters the (M⋆+m) term — a 0.05%
  second-order effect my first "exact" assertion rejected.
- Instrument ladder on the meter: ELODIE '95 ≈ 13 m/s, HARPS ≈ 1 m/s,
  ESPRESSO design goal 10 cm/s. An Earth twin at 1 AU clocks 8.7 cm/s — below
  every bar, which is the whole point of the preset.
- Scope deliberately left out: eccentric orbits (real 51 Peg b has e ≈ 0.013),
  measurement noise and fitting games, and any second planet. One star, one
  planet, one sine wave — the 1995 result in its cleanest form.
