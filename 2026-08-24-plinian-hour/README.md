# Plinian Hour — the 79 AD Vesuvius eruption studio

**Built by Ox Alpha**

August 24, 79 AD — the day Vesuvius opened after centuries of silence and
buried Pompeii, Herculaneum and Stabiae, and the eyewitness letters of Pliny
the Younger gave every volcano its most violent name: *Plinian*. This studio
replays the ~19 hours of that eruption as three pieces of real volcanology
you can push around:

- **Eruption cross-section** — the column as a buoyant jet: drag the exit
  velocity and magma-temperature sliders and watch the column clear (or fail
  to clear) the buoyancy-reversal height. Sustained, it punches through the
  tropopause and spreads an umbrella cloud at the neutral-buoyancy level
  (74% of the column top); clasts fall out and drift with the wind. Too cold
  or too slow, and the whole thing fountains back into a pyroclastic current.
  The collapse meter shows the live margin: ballistic coast vs reversal demand.
- **Bay of Naples map** — the tephra blanket as Pyle-exponential isomass
  shading, stretched downwind; five real towns at their true bearings and
  distances; collapse pulses sweeping out as Benjamin box-model density
  currents with closed-form arrival times.
- **The 19-hour timeline** — scrub or play from 1:00 PM Aug 24 to dawn Aug 25:
  white pumice phase, grey pumice phase, then the night of column collapse —
  the 1:07 AM surge that took Herculaneum's waterfront, the 6:47 AM surge
  down the Sarno to Stabiae (where Pliny the Elder died), and the 7:41 AM
  surge over Pompeii's wall. The verdict ledger tracks every town.

Physics (all in `physics.js`, exact-tested in `test_physics.mjs`):
quarter-power plume scaling `H = 33 km · (ṁ/10⁸ kg/s)^¼` calibrated to
Carey & Sigurdsson's 79 AD estimate; a fountain-collapse criterion
(ballistic coast `u₀²/2|g′|` vs reversal demand `2.2 km·√(ρ_mix/ρ_air)`);
two-regime clast terminal velocity (Stokes → Newton drag); Pyle exponential
thinning `M = M₀e^(−X/b)` on the dispersal axis with Gaussian crosswind;
box-model surge `U = Fr√(g′h)`, `h = V/πR²`, so arrival time to distance D
is `(D² − R₀²)/(2Fr√(g′V/π))` — runout depends only on collapsed volume.

## How to run

```
open index.html
```

or

```
python3 -m http.server 8765      # from the repo root
# → http://localhost:8765/2026-08-24-plinian-hour/
```

Tests: `node --test test_physics.mjs` (21 assertions: exact formula checks,
monotonicity sweeps, and the historical anchors — Pompeii ~2 m of pumice but
no surge until dawn, Herculaneum a few cm of ash and the first surge just
after 1 AM, Misenum untouched by any current).

## The history

Pliny the Younger, watching from Misenum across the bay, wrote the two
letters to Tacitus that name the eruption type: the stone-pine column, the
daylight that "did not remove the darkness so much as make way for it", the
ash that made the buildings rock. His uncle sailed toward the eruption to
rescue friends and died at Stabiae. The wind that day blew toward the
southeast — which is why Pompeii spent 18 hours under falling pumice while
upwind Herculaneum stayed almost clean, until the density currents, which
care nothing for wind, arrived in the dark.

*The traditional August 24 date comes from the medieval transcriptions of
Pliny's letters; a charcoal inscription found in 2018 argues for October.
The letters' events, not the exact calendar day, are what this studio models.*
