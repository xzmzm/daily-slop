# Plan B

On October 13, 2010, the last of 33 Chilean miners stepped out of the Fénix 2
capsule, 69 days after the San José mine caved in. Race the three drill plans
to the refuge 622 m down, then run the capsule until all 33 are up.

Built by GLM-5.3

The men survived on two days of rations until a probe borehole came back with
a note taped to the bit — *Estamos bien en el refugio, los 33*. Then three rigs
started drilling at once: Plan A's raise borer, Plan B's Schramm T130, Plan C's
oil rig. The first hole to arrive *in the workshop* would become the escape
shaft, so rate was only half the game: hard rock destroys bits, every change
means tripping every rod back out, and a hole that wanders 20 m off line
arrives in dead rock.

## How to run

Open `index.html` directly, or from the repository root:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765/2026-10-13-plan-b/](http://localhost:8765/2026-10-13-plan-b/).
No installation, build step, backend, or network access is needed.

## Using the lab

**Drilling (August 30 →):** each rig card shows depth, rate, bit life and how
far the hole has wandered off line.

- **Change bit** trips the whole string out and back — the trip takes longer
  the deeper you are. Run a bit to zero and it barely cuts; leave it dull long
  enough and it breaks downhole, costing a 36-hour fishing job.
- **Steer** halves your rate but pulls the hole back toward the workshop.
  Plan B holds line well enough to rarely need it; Plan C's fast oil-rig hole
  wanders, and an unsteered wander past ~11 m forces a pull-and-reposition.
- The **hard-rock bands** (180–260 m, 430–500 m) cut your rate and eat steel
  one and a half times faster.
- The first plan to reach its target inside a ±15 m box wins the race, and the
  calendar is the score: good bit management breaks through on October 9,
  like the real Plan B. Neglect the bits and you slide about ten days late.

**The lift (October 12 →):** the hole is reamed to 66 cm and cased in the top
56 m, then the capsule starts cycling.

- **Winch gear** sets the climb speed. The order was real: the four fittest
  first, then the weakest men, the toughest late, the foreman last. Weak riders
  tolerate less speed — pushing past their nerves forces the winch to ease
  while they settle.
- **Snags:** the capsule catches an edge or a wheel jams on the rough wall
  below the casing. Hold **REVERSE** (or `R`) until it backs off the shelf
  (20 m of retreat). Ignoring it just burns the clock.
- The counter to beat is the real operation: 33 men between 00:11 and 21:55
  on October 13, about 21 h 44 m, roughly 15 minutes of pure travel per round
  trip and the rest checks, loads and easy decisions.

## Checks

```sh
cd 2026-10-13-plan-b && node tests.js
```

28 checks: the hardness bands, trip-time growth, the rider order, the calendar
anchors (the note on day 17, the last man up on day 69), dull-bit fishing, the
off-target miss, the calibrated race, the ream, the lift's travel/check
split, snag stop-and-reverse mechanics, and winch nerves.

## Model notes

Plan rates are net-history-calibrated: B's 20.5 m/day gross over 624 m with
hard-band slowdowns, ~10 bit trips and the 82.9 h ream reproduces the real
October 9 08:05 breakthrough with careful play. Descent runs at 1.62 m/s,
climb at the gear setting (0.85–1.3 m/s), deviation is a per-metre random
walk (σ 1.05–6.8 m per 100 m by plan), and snag positions and rider nerves
are drawn from a seeded generator — every shift is a little different. Details
and dead ends are in [`NOTES.md`](./NOTES.md).
