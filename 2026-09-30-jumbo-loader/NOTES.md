# Notes — Jumbo Loader

## Why this project?

September 30, 1968: the first 747, *City of Everett*, rolled out of the brand-new
Everett plant — more than twice the size of a 707, assembled by ~50,000 people Boeing
called "the Incredibles," in what is still the largest building in the world by
volume. The anniversary is well-trodden, so the interesting angle had to come from
elsewhere in the story.

The part I kept is the bet. Boeing believed supersonic transports would take over
passenger flying, so Joe Sutter's team designed the 747 to be *convertible*: the
flight deck moved up onto the hump so the nose could swing open for straight-in
main-deck cargo. SSTs never took the passengers; the freighter bet carried the type
for 54 years. A loading puzzle honors that half of the airplane.

The runner-up concept the same morning was Babe Ruth's 60th home run (also September
30, 1927) — a swing-timing toy. This won because no day in the index has ever touched
weight & balance, moment arms, or CG envelopes, and the mechanic *is* the history:
you feel why the hump exists the moment a bullion pallet walks your CG out the front
of the band.

## How it works

The core is the genuine loadmaster calculation, not an imitation:

- Every station has an **arm** in body inches. A loaded aeroplane is
  `CG_station = Σ(wᵢ·armᵢ + W_empty·arm_empty) / Σwᵢ`, reported as
  `%MAC = (CG_station − LEMAC) / MAC × 100` with the 747-100's LEMAC at STA 1325.6
  and MAC 327.8 in.
- The envelope is the classic narrowing box: forward limit slides aft as zero-fuel
  weight rises (16 %MAC empty → 22 at max), aft limit slides forward slightly
  (30 → 29), with a hard ceiling at MZFW. Dispatch checks weight → forward → aft →
  completeness, in that order, exactly the order a load sheet fails you in.

Numbers are rounded for play (OEW 354,000 lb, MZFW 526,000 lb) but the *shape* of
every failure is real: one 18,000 lb crate at STA 620 moves the CG 11 %MAC; the same
crate at 1600 moves it the other way half as far.

Missions were tuned with a random-search solver over placements:

| Mission | Items | Random placement succeeds |
| --- | --- | --- |
| Rollout rehearsal | 6 | ~15% |
| Spare-engine ferry | 7 | ~6% |
| Gold run | 8 | ~20% |

The gold run looks the easiest but isn't: bullion is dense enough that four pallets
decide the balance alone, and the flowers are nearly weightless ballast.

## Interesting notes

- **The aft limit was originally decorative.** First tuning pass had the aft limit at
  33 %MAC, and no legal-load arrangement could ever reach it — the tail stations just
  aren't far enough aft relative to the empty aeroplane. Half the chart was a promise
  the physics never kept. Dropping it to 30 %MAC made "everything stacked aft" fail
  tail-heavy (verified in the unit tests), which also makes the chart honest: both
  edges are reachable.
- The plumb line on the fuselage and the dot on the chart are the same number drawn
  twice — one in body inches, one in %MAC. Watching players (me) learn to read the
  plumb line first, then trust the chart, was the moment the UI clicked.
- The nose-door animation is one SVG group rotating about its hinge point; the
  "taxi + rotate" on dispatch is a single transform with the origin planted at the
  main gear, so the nose lifts the way a rotated aeroplane actually does.
- The 747 can genuinely carry a fifth engine on a wing pod — the "spare-engine
  ferry" mission nods to it, though the game makes you containerize the engine
  like a modern freighter outfit would.
- One deliberate omission: no fuel. Real dispatch includes fuel load and burnoff
  (CG moves as tanks empty); that's a second-degree-of-freedom puzzle that would
  double the scope. Zero-fuel weight is the honest frame for a cargo-only game.
- Slots hold exactly one item each — not because containers stack that way, but
  because "which station" is the decision under study; volume/ULD Tetris would be
  a different (also fun) game.
