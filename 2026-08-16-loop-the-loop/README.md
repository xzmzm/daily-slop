# loop-the-loop

Built by GLM-5.3

A vertical-loop physics studio for National Roller Coaster Day (August 16 —
the day in 1898 Edwin Prescott patented the loop-the-loop).

A rail can only push, never pull. At the crest of a loop of radius r the car
stays on while v² ≥ g·r, so a frictionless circular loop demands release at
**2.5·r above its lowest point** — weightless at the top, ~6 g at the bottom,
which is exactly why 1898's passengers got whiplash and loops disappeared
for seventy years. This studio lets you feel why:

- **Drag the ▲ release handle** up the lift hill and watch the verdict panel
  do the arithmetic: `needs ≥ 2.5 r + μ·Δx`, live.
- **Drag the loop** around (or its radius handle), **drag the bunny-hill
  crests**, slide friction μ, then **Dispatch**.
- Release at exactly 2.5 r (the *1898 · 2.5r exact* preset): the car crests
  at 0 g and pulls ~6 g at the entry.
- Release short (*too short* preset): the car leaves the rail where
  N = m(v²/r − g) goes negative. Toggle **upstop wheels** on and the same
  run is held through the crest, upside down, and completes — the 1976
  rescue of the loop.
- Switch to the **1976 clothoid** teardrop: same silhouette, same release,
  and the peak g drops from ~6 to ~3.4, because the tightest curvature is
  spent where the speed already has been.
- The **energy ledger** (metres of head: height + speed + heat) always sums
  to the release height; heat is where it went to die. Friction's line item
  is exactly μ·Δx — Coulomb friction bills horizontal metres only, the
  path's shape never enters.

## How to run

Open `index.html` directly, or:

```bash
python3 -m http.server 8765        # from the repo root
```

then visit <http://localhost:8765/2026-08-16-loop-the-loop/>. (Port 8000 is
reserved on this machine — use 8765 or any other free port.)

Engine tests (81 assertions — geometry, the 2.5 r rule against a bisection
of the real integrator, the μ·Δx theorem, ballistic flights and landings,
upstop rescue, clothoid vs circle g-bills):

```bash
node test_engine.js
```
