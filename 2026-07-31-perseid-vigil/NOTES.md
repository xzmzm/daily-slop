# NOTES — Perseid Vigil

## Why this project?

Today's web scout landed straight on the Perseids: the shower has been active
since July 17, and every outlet is running the same story — the 2026 peak
(night of Aug 12–13) coincides with a **new moon**, the best viewing geometry
in years, up to ~100 meteors/hour. That's a real, timely hook, and nothing in
the previous seven days touches astronomy simulation (landscapes, Chladni
plates, solar shadows, museum labels, reaction–diffusion, backrooms, orbital
chimes). The question the news never answers well is *"what would I actually
see on a given night?"* — so that became the app: not a generic starfield
screensaver, but a rate-honest replay of the season, night by night.

## How it works

Everything hangs off UTC milliseconds and a handful of textbook formulas:

- **Activity curve.** ZHR is modelled IMO-style as exponentials in solar
  longitude, `10^(−b·|λ☉ − 140°|)`, with two components: a broad base
  (ZHR 20, b = 0.05) plus a sharp core (ZHR 80, b = 0.25) so late July still
  shows the real ~5–15/hr trickle instead of zero. λ☉ is a linear
  0.98565°/day approximation anchored at the predicted peak
  (2026-08-13 14:53 UTC = 140.0°).
- **Radiant altitude.** The radiant (RA 3h04m, Dec +57.4°) is run through the
  standard alt-az transform for a 45°N observer. Local sidereal time is
  cheated cleanly: `LST ≈ RA_sun + (localHour − 12)·15°`, with the sun's RA
  from its ecliptic longitude. Visible rate scales by `sin(alt)` — this is
  why the readout climbs through the night as Perseus rises in the NE.
- **Moonlight.** Moon phase comes from the real new-moon epoch
  (2026-08-12 17:37 UTC) and the synodic month. A full-ish moon that's up
  costs up to 3 magnitudes of limiting magnitude, and each lost magnitude
  keeps only 1/2.2 of meteors (population-index style), so the late-July
  waning gibbous visibly guts the rates. "Is the moon up" is a deliberately
  crude approximation: the moon transits `phase·24h` after the sun and is up
  ~6.2 h either side.
- **Drawing.** All-sky fisheye (zenith centred, `r = R·(1 − alt/90°)`).
  Meteors spawn Poisson-ish from the live rate, at a random angle/distance
  from the radiant, streaking radially *away* from it — with streak length
  proportional to distance from the radiant, which is the real foreshortening
  effect (meteors near the radiant come at you head-on and look short). A
  low-alpha fill instead of a clear gives long-exposure-style trails, so on
  peak night the classic "radiant burst" photo composes itself.

## Interesting notes

- The first cut used a single-slope curve (`ZHR 100 · 10^(−0.2·|Δλ|)`), and
  the verification screenshot for tonight (Jul 31) read **"ZHR 0"** — 12° of
  solar longitude at b = 0.2 is a ÷250 kill. Real Perseids are already at
  ~5–15/hr in late July; splitting into broad + core components fixed it
  without flattening the peak.
- The moon model accidentally teaches the news story: scrub from tonight to
  the peak and you watch the 90%-lit gibbous moon shrink to 0% *exactly* as
  the ZHR ramps — the whole reason 2026 is a good Perseid year in one slider.
- Time compression tuning mattered: a night is 6.5 sim-hours in 50 real
  seconds, so ~70 visible/hr becomes ~9 spawns/second at peak. Full rate
  looked like soup, so there's a `RATE_TASTE = 0.55` damping constant purely
  for taste. The readout numbers stay honest; only the pixels are damped.
- Sporadics get random directions and dimmer streaks so the radial pattern
  stays legible — without them the radiant geometry read as a bug ("why do
  they all come from one point?"), with them it reads as the *point*.
- Deliberately out of scope: real star catalogs (the stars are seeded random
  dressing), observer geolocation, and proper lunar ephemeris. Each would
  double the size for a detail the simulation's honesty doesn't need.
