# One More — build notes

## Why this project?

Today is 17 October 2026. The opening of Calder Hall on this day in 1956
suggested a small experiment about keeping a chain reaction going. I also
looked at the London Beer Flood anniversary; the more interesting interaction
here was the gap between an average and an individual history.

Earlier projects include Rutherford scattering, several orbital models, and
yesterday’s rotation-order experiment. This one is about branching randomness
and extinction. It does not attempt a plant control room or a reactor model.

The history is anchored in the contemporary
[Hansard answer](https://api.parliament.uk/historic-hansard/written-answers/1956/jan/31/power-stations)
and [Sellafield’s history](https://www.gov.uk/government/case-studies/calder-hall-decommissioning-the-worlds-first-commercial-nuclear-power-station).
The opening ceremony is the date being marked; this is not a claim that
Calder Hall was the first reactor ever connected to an electrical grid.

## How it works

The core is a Galton–Watson branching process. For every particle in a
generation, draw one uniform random number. With probability p = k / 2,
append two children to the next generation; otherwise append none.
The mean offspring count is therefore 2p = k, and the variance is k(2 − k).

The conditional expectation is E[N(g + 1) | N(g)] = kN(g). Repeating that
relation gives E[N(g)] = N₀kᵍ. That is the dashed line. The mint line averages
all 64 independent seeded trials; a dead chain contributes zero, rather than
being dropped from the calculation. Omitting the dead chains would make a
critical ensemble look as if its average were growing.

The tree stores each child’s parent index, so its links really are a lineage,
not a decorative fork pattern. The counters and graph use full populations.
Once a generation exceeds 40 particles, the tree draws evenly sampled nodes
at their original positions and labels that sampling explicitly. It shows
the most recent 13 generations so the connectors remain readable on a phone.

For one starting particle, extinction by generation g obeys the independent
recurrence q(0) = 0 and q(g + 1) = 1 − p + pq(g)². The model checks compare
30,000 trials against both that recurrence and the analytical mean. Tests
also check that zero is absorbing, every successful parent has two children,
and selecting a chain reconstructs exactly the same counts.

## Interesting notes

- The opening batch uses seed 20261049, chosen to give the first chain a
  visible surviving lineage. The other 63 chains are retained without
  filtering. At generation 12, 11 of 64 survive; at generation 24, six do.
  This is a reproducible illustration, not a freshly randomized measurement
  every time the page opens. “New trials” advances the seed by 104729.
- Even at k = 1.20, the second chain of the opening batch dies at generation
  two. That is a useful counterexample to treating a growing expectation
  as an individual guarantee.
- Starting with 32 particles is equivalent to adding 32 independent family
  trees. Relative fluctuations shrink roughly as 1 / √N₀, although no single
  finite run is obliged to sit on the expectation.
- A real reactor has more than a binary offspring distribution, delayed
  neutrons, spatial leakage, thermal feedback, and background sources. Those
  are deliberately outside this experiment. The animation clock is a reading
  aid, not a prediction in seconds.
- The graph rescales its vertical axis using only revealed generations.
  Its printed ticks change with that scale; future populations are not
  quietly used to set the current scale.
- The browser check opens the file directly and verifies that no HTTP
  requests occur. It also exercises 1280, 768, 390, and 320 pixel widths,
  keyboard slider input, playback, stepping, batch changes, and reduced motion.

## Deliberately left out

No reactor geometry, isotope settings, power conversion, or sound effects.
The small question is enough: how can the average hold still while most
individual chains disappear?
