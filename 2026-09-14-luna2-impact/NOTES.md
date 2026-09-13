# NOTES — Luna 2 (2026-09-14)

## Why this project?

Today is 14 September — the Moscow-time date stamped on the first arrival of a
human-made object at another world. Luna 2 launched 12 September 1959 at
06:39:42 UT and its carrier tone stopped at 21:02:24 UT on 13 September, which
is 00:02:24 on 14 September in Moscow, the date TASS claimed. Sixty-seven
years to the day.

The hook that sold me: **Radio Moscow announced the impact time in advance,
and was 84 seconds off** — after a 38-hour flight of an unpowered 390 kg
sphere with no course correction possible. That's a prediction good to two
parts in a million over a ballistic coast across 384,400 km. The whole build
became "what does it take to hit a moving Moon with a thrown stone?"

I checked the other anniversaries first: Britain's 1752 calendar skip was
already taken by `2026-09-02-eleven-days`, and Voyager-style gravity assists
by `2026-08-20-grand-tour`. Luna 2's problem is the *inverse* of a gravity
assist — aiming, not stealing momentum — so it stands on its own.

## How it works

`luna2.js` is pure closed-form two-body arithmetic, pinned by 43 test
assertions in `test_luna2.mjs`:

- **Hyperbolic coast** — injection at 200 km perigee with hyperbolic excess
  v∞ = 1.65 km/s gives v_p = √(v_esc² + v∞²) = 11.137 km/s (the docs say
  "≈11.2"). Time to r = 384,400 km solves Kepler's hyperbolic form
  `M = e·sinh H − H` by Newton: **38.35 h, against the documented 38 h 22 m**
  (38.38 h). I did not fit the trajectory to documented state vectors — I
  picked the v∞ that reproduces the flight time, and everything else
  (perigee speed 11.14, arrival speed 2.19 km/s) fell out matching the
  historical figures.
- **The lead angle** — in 38.35 h the Moon, at 13.176°/day, walks 21.05°.
  So the launch must aim at empty space 21° ahead of the Moon. The canvas
  draws that sector.
- **Miss distance** — probe position from the closed-form conic, Moon
  circular at ωt, minimum over a scan (the *propagation* is closed-form;
  only the closest-approach search is numeric). Timing error τ produces
  miss ≈ v_Moon·τ: 84 s → 85.9 km (still inside the 1,737 km radius —
  the Moon buys ±1,698 s ≈ ±28 min of slack), and 6,285 s → 5,995 km,
  exactly Luna 1's January miss, which is presented as "a miss the size of
  Luna 1's", not a reconstruction of Luna 1's actual error.
- **Patched conic at the Moon** — arrival is nearly radial (v_t = h/r =
  0.19 km/s of 2.19), so the angle between v_arr and the Moon's velocity is
  85°, giving v∞,☾ = |v_arr − v_M| = 2.335 km/s and impact speed
  √(2.3757² + 2.335²) = **3.331 km/s** against the documented ~3.3. The
  slider rotates that angle so you can see the geometry do the work.
- **The magnetometer** — Earth's dipole B = B_eq(R/r)³√(1+3 sin²λ) decays
  from 31,200 γ at the equator to **0.142 γ at the Moon**, below the
  ±750 γ/2⁶ ≈ ±12 γ telemetry quantum. So silence past the quantum is a
  measurement: no lunar field above the published 20–30 γ bound, and no
  radiation belt either. (The chart is a dipole model, honest to ~20%.)
- **The sodium comet** — thermal speed √(8kT/πm) = 0.68 km/s at 500 K,
  1 kg of vapour spans the observed 650 km in ≈8 min, subtending
  13.8 arcmin at 156,000 + R_E km — 0.44 full Moons. The temperature
  slider is honest about the free parameter: nobody publishes the expansion
  temperature, and T ∈ [300, 900] K moves the 650-km time between 10.3
  and 6.7 minutes.

## Interesting notes

- **The 84 seconds pinned itself.** The NYT headline reads "Arrival Is
  Calculated Within 84 Seconds". In the model, 84 s of timing error means
  the Moon walks 1.023 km/s × 84 s = 85.9 km past the aim point — a
  46-arcsec angular error as seen from Earth. Two parts in a million of
  the flight, and it *still* hits, because the Moon's radius forgives
  ±28 minutes. The hard part wasn't precision, it was having any control
  at all: the third stage had no restart, so there was no parking orbit
  and no second chance — the entire 38-hour flight was decided in the last
  seconds of one burn.
- **My first sensitivity intuition was wrong by an order of magnitude.**
  I "remembered" that ±1 m/s at injection moves the arrival by thousands
  of km. The model says ~13 km per m/s (timing term v_M·dt/dv∞ ≈ 35 km
  per m/s partly cancelling a geometry term of similar size and opposite
  sign — worth re-deriving by hand if you don't believe it). Luna 1's
  5,995-km miss therefore corresponds to something like tens of m/s or a
  burnt-out-early stage, not the few m/s of my intuition.
- **Wikipedia's infobox says the mission lasted "2 days, 14 hours, 22
  minutes, 41 seconds" — which is a day too long**: that span runs from the
  UT launch (12 Sept 06:39:42) to the *Moscow-time* impact date treated as
  UT (14 Sept 21:02:24). The true UT span is 06:39:42 → 21:02:24 on the
  13th = **38 h 22 m 42 s**, which is what the tests pin; contemporaneous US
  press rounded it to "35 hours". The impact date itself is genuinely
  two-valued — UT says 13 September, Moscow time says 14 September — so the
  studio says "12–14 September" and lets both be true.
- **Two sodium releases, and I nearly conflated them.** The spent third
  stage vented its kilogram at ~156,000 km, twelve hours after launch
  (12 Sept ~18:42 UT); the probe itself released again on the 13th as it
  approached. The app's text credits the stack's kilogram at 156,000 km
  (the well-documented one) and says the probe "vented sodium again",
  which is as precise as the sources allow.
- **The pennant spheres are why the date is certain.** Two titanium
  spheres tiled with 72 pentagonal shields each (144 total, stamped
  СССР СЕНТЯБРЬ 1959), packed with explosive to scatter on impact.
  Khrushchev was landing in the US the next day with a replica for
  Eisenhower — now at the Eisenhower Library in Abilene, Kansas. The
  exact crater on the Moon has never been conclusively identified in
  LRO imagery; at 2.16 GJ the impact is small change by lunar standards.
- **Deliberately out of scope**: the 8K72's actual staging profile and
  liftoff mass (sources disagree; I show only the geocentric budget and
  the rotation bonus), the third stage's own impact ~30 min later (a
  timeline footnote), Luna 3's far-side photography, and any ephemeris
  beyond a circular lunar orbit — the real Moon's eccentricity would move
  the lead angle by less than the slider's step anyway.
- **Honesty ledger**: v∞ = 1.65 km/s is *calibrated* (chosen so the coast
  matches the documented 38 h 22 m; the real figure isn't published to
  three digits); the 200 km injection perigee, the circular lunar orbit,
  the 500 K sodium temperature and the dipole field model are reasonable
  defaults, all exposed as sliders or noted on the canvas. The flight
  times, speeds, magnetometer ranges, pennant count, 5,995 km, 84 s and
  14 km of teletype tape are sourced (Wikipedia / NASA history, verified
  this morning).
