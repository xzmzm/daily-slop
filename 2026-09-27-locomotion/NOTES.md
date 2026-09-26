# NOTES — Locomotion No. 1, 27 September 1825

## Why this project?

The date picked itself: 27 September 1825 is the opening day of the Stockton &
Darlington Railway, the first public railway to run steam-hauled passenger
traffic, and 2025 was its bicentenary — so the anniversary is genuinely in the
air. The gallery had nothing on railways, and the adhesion story turned out to
be a better "physics fable" than the usual opening-day pageantry:

The punchline most retellings skip is that **the first steam railway outsourced
its hills**. Locomotion No. 1 could pull ~1,000 lb; a loaded coal train on the
1-in-33 banks needed four times that. So Etherley and Brusselton inclines were
worked by stationary winding engines hauling wagons up on ropes, letting them
down the far side — and the locomotive only worked the near-level stretch east
of Shildon. The famous "first train" was really a relay: rope → horse → rope →
locomotive. That relay *is* the app.

## How it works

Three forces, one verdict. Everything in the UI is derived from:

- **Cylinder pull** — two double-acting cylinders, 9¾ in bore × 24 in stroke,
  50 psi, 4-ft drivers: `TE = 2 × 0.85 × P × (πd²/4) × s / (πD)` ≈ **1,010 lbf**.
- **Adhesion ceiling** — `μ × adhesive weight`. The coupling rods made all four
  wheels drivers, so the whole 6.5 long tons (14,560 lb) counts: **3,640 lbf
  dry** (μ = 0.25), 2,184 wet (0.15), 1,456 frost (0.10), 874 under leaves
  (0.06). Sanding adds 0.10 μ, capped at dry.
- **Train demand** — `tons × (rolling + 2240 × grade)`. Rolling ≈ 10 lbf/ton
  (period estimates for iron-on-iron with plain bearings run 8–15). Grade is
  signed: falling grades give force back.

The verdict logic is a two-liner with a teaching payoff:

```
applied = min(TE, adhesion)
demand ≤ 0                     → coasting (gravity hauls)
demand ≤ applied               → runs
demand > applied, adhesion ≥ TE → stalls   (grip holds, pull doesn't)
demand > applied, adhesion < TE → slips    (grip runs out: wheelspin)
```

The *stalls vs slips* pair is the pedagogical heart: two different failures with
two different cures (lighten/soften the grade vs sand the rail), and sanding a
pull-limited train converts wheelspin into an honest stall.

Dynamics: `F = min(TE(v), adhesion) − (rolling + grade) − windage`, with
`TE(v) = TE₀ · v_half/(v + v_half)`, v_half = 8 mph — a crude stand-in for
early cutoff that caps the display speed near the 15 mph reporters clocked on
opening day. Acceleration is deliberately realistic: 50 tons behind 1,000 lb
takes real minutes to gather way, which is why the page warm-starts at ~4.5 mph.

## Interesting notes

- **The knife-edge that rewrote the constants.** With rolling resistance at
  12 lb/ton, the opening-day train (21 wagons + coach + 550 passengers ≈ 109
  tons) demanded *exactly* cylinder pull on the dead level — verdict "stalls",
  contradicting history. Dropping to 10 lb/ton moved the equilibrium to
  "crawls on the level, glides on the surveyed fall", which is what actually
  happened: Shildon→Stockton falls ~300 ft, and the run relied on it. The
  surveyors' gradient profile is as much a part of the machine as the boiler.
- **The ladder.** Level: 25 loaded wagons. 1 in 200: 11. 1 in 100: 6. 1 in 33
  (the real inclines): the engine plus **one** wagon. 1 in 10: can't start,
  not even light — 6.5 × 2240 × 0.10 = 1,456 lbf of self-haul exceeds the
  cylinders' 1,010.
- **Opening-day numbers** (from the standard accounts): 12 coal wagons roped up
  Etherley, horses across the Gaunless, rope up Brusselton; at Mason's Arms the
  coach *Experiment* plus 21 wagons fitted with seats, 450–600 aboard against
  300 planned; 10–12 mph bursts; a 35-minute engine repair; out of Darlington
  31 vehicles and 550 passengers, 3 h 07 min to Stockton; near the end a man
  fell from a wagon and had his foot crushed by the next one — included in the
  replay because the day really did have a casualty, and sanitising it felt
  dishonest.
- **Chuffs.** Two double-acting cylinders = 4 beats per wheel revolution; the
  smoke is emitted on wheel-turn phase, so the chuff rate climbs with speed
  (`v × 0.467/s`) exactly as it should.
- **Deliberate simplifications:** no moving-cylinder rod geometry (the
  connecting rod is drawn to the leading crank pin and left there); single TE
  figure regardless of cutoff; windage is a linear 6·v lbf; elevation profile
  is schematic but with honest relative shape and Tomlinson's incline grades;
  stone-block sleepers (the S&DR's original paving) rather than timber.
- **Dead end:** the first draft computed grade force as `mg·sin θ` with θ from
  the canvas slope angle — at 10% the difference from the `W × grade` small-angle
  form is under 0.5%, so the simpler per-cent form won. Also threw away a
  "runaway on falling grades" brake minigame; scope discipline, the coasting
  verdict makes the point.
