# Firebreak — notes

## Why this project

October 8 is the night the Great Chicago Fire started (1871 — 155 years ago
tonight). It's also Fire Prevention Week's anchor, and the same cold front
that night drove the Peshtigo fire, the deadliest in US history, which almost
nobody has heard of. I'd been sitting on "ember spotting defeats firebreaks"
as a mechanism for a while: it's a beautiful counterintuitive physics story
(water is a wall for flames and a doormat for embers), it's interactive by
nature, and the anniversary gave it a stage. The other candidate for the day
was Don Larsen's perfect game (also Oct 8, 1956), but a 27-out probability
toy felt thin next to a city burning on screen.

## How it works

Two mechanisms, and the second one is the point of the whole piece:

**The flame front** is a cellular automaton on a 64×44 grid (one cell ≈ one
city lot; Chicago's street grid every 4th cell). Each burning cell attempts
each neighbor within a Euclidean distance of 2 every sim-minute with

    p = base · fuel(kind) · (0.35 + w/30) · exp(alignK·(cosθ − 1)) · exp(−0.85·(d − 1))

so spread leans hard downwind (`alignK = 0.35 + w/26`) and decays with
distance — a fire jumps a narrow street at 43% strength, which matters
because the street grid would otherwise make every block a fuel island.
Fire never crosses water: for d > 1.5 the path's third-points must be dry.
Buildings burn ~24 min (wood) or ~30 (brick, 0.42× receptivity).

**The ember storm** is what killed the real city. Ember count per minute is
`0.5·√burning·(w/30)^1.35`; each ember flies downwind with a Gaussian
heading scatter (σ ≈ 0.38 rad) and a **Rayleigh-distributed distance** with
σ = 0.6 + 0.115w cells. Rayleigh is the honest choice for absolute landing
distance of a wind-scattered particle, and it makes the UI chart trivial:
P(crossing the ~3-cell river) = exp(−river²/2σ²) — 77% at the default
32 mph gale. Landed embers smolder 3–8 min, then catch (60% on wood).
Once 10% of the city burns at once, the fire "makes its own wind": a
firestorm flag boosts ember range ×1.45 and rate ×1.6, with hysteresis.

**Gunpowder** (32 charges) clears a radius-1.7 circle to rubble — buildings
and plank streets alike. Each blast backfires with p = 0.08 + w/150, igniting
a nearby fuel cell: at gale strength roughly one blast in three betrays you,
which is the historical footnote playing out as a game mechanic.

## Interesting notes (the debugging was the project)

- **The fire refused to burn.** First tuning died in the barn yard; the
  tracer showed ~9 cells burned and out. Cause one: pacing — per-minute
  spread probability and burn duration together put the per-building
  reproduction number under 1, so every chain went extinct. Fix: burn
  buildings ~24 sim-minutes at a lower rate, so a front crawls at a
  historical speed (~0.1 cells/min at gale) while each building still
  reliably lights its neighbors.
- **Then the fire refused to cross streets.** With streets every 4th cell,
  adjacent-cell spread made each 3×3 block an island; even a distance-2
  kernel mostly hit street intersections (the offsets aligned with the
  wind are exactly the ones that hit the grid's cross streets). The fix is
  the most historically satisfying bug-fix I've shipped: **Chicago's
  streets and sidewalks were wooden**, so streets became 0.35-strength
  fuel. The city finally burned like a connected city.
- **Water leaked.** A diagonal kernel jump could clip a narrow neck of the
  south branch: one midpoint cell wasn't enough of a check. Now the path's
  ⅓, ½ and ⅔ points all have to be dry.
- **The river doesn't stop anything anyway** — with embers on, spot fires
  cross it within the first hour, which is precisely the lesson. With
  `emberScale: 0` (a test hook) the water wall holds perfectly, and that
  contrast is asserted in `test.cjs`.
- Calibration shortcut: the map's destroyed-% maps onto the real 17,500
  buildings, so the chip reads "≈ 12,400 / 17,500" mid-disaster. At the
  default gale, seed 7 burns ~62% of the city in about 4 sim-hours —
  compressed next to the real 27 hours, because the toy map is ~2 miles
  wide, not 3.3 square miles of dense city.
- The auto-rain (late Monday night, ~26.5 h in) almost never fires before
  the map runs out of city — the honest toy result. The RAIN button exists
  so you can be historical on demand.
- Headless-Chrome screenshots of the canvas occasionally come out blank
  white (a compositor race, zero impact on the buffer — `getImageData`
  shows the fire painted). Retaking the shot fixes it; don't chase ghosts.
