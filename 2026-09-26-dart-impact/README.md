# DART — the 33-minute shove

Built by GLM-5.3

A kinetic-deflection studio for the fourth anniversary of NASA's DART impact
(26 September 2022, 23:14 UTC): a 570 kg spacecraft hit the 160 m moonlet
Dimorphos at 6.14 km/s and shortened its 11.92-hour orbit around Didymos by
33 minutes — 27× the mission's 73-second success goal. Tune the ejecta recoil
β and the impact angle, launch your own impactor, then read the period change
off the mutual-event lightcurve exactly the way astronomers measured the real
one.

## What to do

- **Watch the system idle.** Sizes, separation and the orbit are true scale —
  Didymos really is a third of the orbital radius; Dimorphos skims ~800 m
  above its surface every 11.92 h.
- **Dead-stick splat (β = 1).** Even with no ejecta recoil at all, 570 kg at
  6.14 km/s shaves 9½ minutes off the period. The moonlet is that light.
- **Real DART (β = 3.61).** The splash of excavated rubble flies down-orbit
  and pushes the moonlet ~2.6× harder than the spacecraft alone — the
  asteroid shoved itself. Result: −33.0 min, e ≈ 0.03.
- **Glancing blow (45°).** The off-axis part of the impulse goes radial: it
  mostly raises eccentricity instead of shrinking the orbit, and you keep
  only cos 45° of the period change.
- **Measure it.** The lightcurve strip shows mutual-event dips drifting
  against the no-impact prediction — by day 4 the ticks land 4.6 h early.
  That cumulative walk-out is how −33 min was measured from Earth.

## How to run

No build, no dependencies:

```sh
open index.html
# or
python3 -m http.server 8765   # then visit http://localhost:8765/2026-09-26-dart-impact/
```

## Tests

```sh
node --test test.cjs          # orbit physics, β scaling, Kepler continuity
python3 test_browser.py       # drives the real page end to end
```

Orbit math is exact (vis-viva + Kepler's equation) with the published system
constants; ejecta ballistics, body shapes and the lightcurve are honest
simplifications — see [NOTES.md](NOTES.md). ESA's Hera arrives at Didymos in
December 2026 to weigh Dimorphos and survey the crater.
