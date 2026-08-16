# NOTES — jupiter-mail

## Why this project

August 17 is Balloon Airmail Day: on Aug 17, 1859, John Wise — the most
experienced aeronaut in America, 230-odd flights — carried 123 letters and 23
circulars in a locked US mail bag from Lafayette, Indiana, intended for New
York, in the balloon *Jupiter*. The plan was transcontinental; the wind was
from the NNE; about an hour later he landed near Crawfordsville, 26 miles
south, handed the bag to the postmaster, and the mail went on by train. The
first US airmail was a balloon *plus a train*.

That failure is the whole game. A free balloon cannot steer — it can only
choose its altitude and borrow whatever wind lives there. That's a genuinely
lovely mechanic for a toy: a steering wheel made of altitude, two one-way
resources (hydrogen and sand), a slow leak, and Wise's own trail rope as the
landing aid. I checked the index for collisions: nothing aviation-shaped, no
wind/weather toy yet (shade-seeker is solar geometry, sky-sway is a damper,
waggle-room is a bee). Balloon it is.

## How it works

### Altitude is the rudder — an idealized Ekman spiral

The wind profile is the textbook Ekman solution, compressed to game altitudes:

```
ζ = (z + z₀)/δ           z₀ = 150 m, δ = 1000 m
u(ζ) = U_g (1 − e⁻ᶻ cos ζ)      along the geostrophic wind
v(ζ) = U_g e⁻ᶻ sin ζ            to its left
```

Near the ground the wind is *backed* (turned left of geostrophic) and slowed;
aloft it veers right and freshens toward U_g. The 1859 scenario sets the
geostrophic wind toward 190° at 9 m/s, so the steerable arc spans roughly
156°–190° between 250 m and 3 km — and Crawfordsville, bearing 178° from
Lafayette, sits right in the middle at about 1 300 m. (The real winds that
afternoon are unrecorded; 190° is chosen so the historical landing is winnable,
not because I found a weather table. The *shape* of the veer is honest.)

Two details of the real spiral survive in the game: the speed *overshoots*
geostrophic near 2 km before relaxing back (the hodograph loop), and surface
wind is ~40° backed from aloft. The "courses you can hold" compass renders the
arc directly — the game's one-sentence lesson.

### A kilo of hydrogen lifts 13.4 kilos — at every altitude

The envelope is open at the neck, so the gas stays at ambient pressure and
temperature. Lift and displaced air then scale together with altitude:

```
lift = (M_air/M_H₂ − 1) · m_gas · g ≈ 13.37 · m_gas · g
```

which has no z in it. Climbing doesn't buy or lose lift — it swells the
envelope (48.5 kg of H₂ is 569 m³ at release, ~730 m³ at 2 500 m). The
consequences are the game's economy:

- the **only** way down is the valve (0.32 kg/s, gone forever),
- the **only** way up is sand (15 kg bags, 20 of them),
- the fabric leaks 0.0009 kg/s (≈0.05 kg/min), so a trimmed balloon sags —
  your free lift at release (~15 kg) is gone in about 20 minutes and you pay
  bags to stay up.

And she answers like a barge: the effective inertia includes ½ the mass of
displaced air (potential-flow added mass of a sphere — real, and it's why real
balloons feel like ships). A bag takes ~6 s just to reach 1 m/s of climb.
Vertical drag is quadratic on the projected sphere (C_d 0.55).

### The trail rope — Wise's automatic ballast

Wise spent decades advocating a dragging trail rope. Implemented: 60 m,
0.7 kg/m. Below 60 m the grounded portion carries its own weight (offloading
the ship — lift increases linearly as she sinks, a self-stabilizing
equilibrium at z where 0.7·(60−z) = heavy-kg) and drags on the ground
(exponential brake on ground speed, 12 s time constant fighting the 45 s wind
relaxation). Net effect: a heavy ship parks at a stable low altitude instead
of crashing — which produced the funniest bug of the day (below).

### The mail's whole journey

The verdict scores balloon + rail: estimated hours to New York fall with every
kilometre east you land (`48 − east_km/6`, clamped 30–54 h), +8 h for a field
landing, +10 h for a wrecked bag, +10 h for missing the evening train
(release + 2 h). These rail figures are **1859-plausible guesses, not archive
work** — the honest part of the sim is the flight physics, the geometry (real
coordinates: Lafayette 40.417 N 86.875 W, Crawfordsville 41.9 km at 178°), and
the fact that history's best move that day was "land at Crawfordsville and
let the railroad finish it."

## Interesting notes (the war stories)

- **The landing tests were unwinnable until I cut the release height.** A
  forced touchdown from 10 m at −1.8 m/s never lands: the ship still has her
  +15 kg of free lift, so she decelerates to a hover at ~1.5 m and climbs
  away. Physics 1, test design 0. The tests now start the last 2 m.
- **My first autopilot dropped six sandbags in six seconds.** A bang-bang
  controller sampled at 1 Hz with no latch: each check saw z < band and vz < 0
  and dropped another bag — a 90 kg swing, then the valve overshot the other
  way and she dove. Fix: 3-second valve bursts latched with a 30 s cooldown,
  bags rate-limited to one per 40 s.
- **"Valve until 120 m" turned the ship into a meteor.** Holding the valve
  open through a 1 400 m descent vents ~150 kg of hydrogen — she hit at
  33 m/s. A steady −3 m/s descent needs a one-time deficit of ~30 kg (≈2.4 kg
  of gas), not continuous venting; the arrival now governs descent *rate*.
- **The trail rope works so well she refuses to land.** Arriving ~36 kg heavy,
  the rope's offload equilibrium parks her at z = 60 − 36/0.7 ≈ 17 m, vz → 0,
  and only the diffusion leak (0.67 kg of lift per minute) walks her down. The
  arrival logic had to learn: below 60 m, valve only when nearly motionless —
  never while the rope is actively arresting you, or you fight it.
- **Ekman's speed overshoot broke my monotonicity test.** I asserted speed
  grows monotonically to 3 km; the real spiral peaks near ζ ≈ 2.2 (1.07·U_g)
  and relaxes back toward U_g. The test now asserts monotone *through the
  working band* plus the overshoot explicitly.
- **`hidden` ≠ hidden.** The verdict overlay's `display:flex` author rule
  beats the UA stylesheet's `[hidden] { display:none }` — so the "hidden"
  overlay dimmed the whole first screenshot. One line of CSS
  (`.overlay[hidden] { display:none }`) fixed what looked like a rendering bug.
- **Ship numbers are reconstructed**, not archival: 285 kg dry (envelope,
  basket, aeronaut, mail bag), 48.5 kg H₂ → 569 m³, 300 kg of sand. They give
  sensible terminal rates (2.3 m/s initial climb, 3–4 m/s valve descents) and
  a resource budget that makes an 80-minute mission feel like bookkeeping.
  If a historian swaps in *Jupiter*'s real figures, the tests will say what
  breaks.

## Deliberately out of scope

- Real 1859 weather reconstruction (no source; the hodograph is parameterized
  honesty).
- Nighttime boundary-layer decoupling / superheat thermals of the envelope —
  diffusion stands in for all of it.
- Multi-player racing other 1859 aeronauts (Wise flew competitively that
  decade; another day).
