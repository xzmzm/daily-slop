# Set Point — notes

## Why this project?

Today is the 61st anniversary of the Northeast blackout of 9 November 1965. At 5:16:11 pm a backup relay at the Sir Adam Beck station near Niagara Falls opened one of five 230 kV lines to Toronto. It had been set in 1963 to trip at 375 MW so it would coordinate with other protection, and the operators didn't know the number. The line's recorded load was about 356 MW, and a short swing that was never logged pushed it over. The flow moved onto the other four lines, they tripped too, and within minutes Ontario, New York and New England were dark. About 30 million people were without power, some for up to 13 hours. Afterwards Ontario Hydro raised the settings on all five relays.

Other candidates for 9 November were the fall of the Berlin Wall and the birthdays of Carl Sagan and Hedy Lamarr. The blackout won because the whole story turns on one number someone could have changed, which makes a natural slider. The workspace has *pearl-street* (Edison's first station) and *carrington-storm* (geomagnetic currents), but nothing about how a meshed grid moves flow around after a line trips.

## How it works

The board is a DC power flow over 8 buses and 13 lines. Each bus has fixed generation and load in MW. Each line has a reactance `x` and a limit.

- **Flow.** Within a connected island, pick a slack bus and build the susceptance matrix `B` (each line adds `1/x` to the diagonal of both ends and subtracts it off-diagonal). Solve `B θ = P` for the phase angles with Gaussian elimination. The flow on a line is `(θ_i − θ_j) / x`. Parallel paths share flow in inverse proportion to reactance, so when one line opens its flow goes to the others.
- **Balance.** Before solving, each island's generation is scaled by `load / gen`, standing in for governors picking up the slack.
- **Relays.** The five Beck–Toronto lines use the slider's set point as their limit. The others have fixed limits. After each solve, the line with the worst `|flow| / limit` above 1 trips, one per step. Tripping one at a time matters: identical parallel lines would otherwise all open together, and the real lines went in sequence over about 2.7 seconds.
- **Collapse.** After each trip the buses are regrouped into islands with a flood fill. An island whose load exceeds its generation by more than 8 % loses frequency and goes dark. An island with a surplus is scaled down and stays up.

At steady state line 1 carries 355.6 MW (its reactance is 0.97 against 1.00–1.03 for the others, so it is the most loaded). A +100 MW Toronto swing takes it to 375.8 MW. Each trip pushes the remaining lines higher: 460, 610, 911, 1812 MW. Toronto is left with 300 MW of its own generation against 2,115 MW of load and collapses. Beck and Niagara now have about 2,900 MW they can't send north, so it all heads east. The southern Niagara–Syracuse line takes 1,141 MW against a 700 MW limit and trips, Niagara–Rochester takes 2,370 MW and trips, and the eastern island is left 1,185 MW short and goes dark. Beck and Niagara stay lit as a small island with a surplus.

## Interesting notes

- My first dispatch had total generation 700 MW below total load, and the balancing step quietly scaled every generator up 6 %. Nothing broke, but the flows were not the ones I'd written down. I raised New York City's generation until the system balanced on its own.
- I tuned Toronto's load and New York City's generation so line 1 sits at the recorded 356 MW. With that, a 100 MW swing clears 375 MW by under a megawatt. That's close to how fine the real margin probably was, so I kept it.
- In this model a 355 MW setting fails with no swing at all, 356 MW holds with no swing, and 400 MW holds a 100 MW swing. The cascade is all or nothing. All five relays share one setting, and line 2 jumps to 460 MW the moment line 1 opens, so any setting low enough to trip line 1 is far too low to save line 2. The first relay decides whether the evening ends in a blackout.
- The southern Niagara–Syracuse line first drew straight on top of the Rochester route. It's now a quadratic curve, with its label placed at the curve's midpoint `(p0 + 2c + p2) / 4`.
- Left out: frequency dynamics, generator inertia, under-frequency load shedding, and the slow restart (the black start that took until the next morning in New York City). Times after the first trip are just a fixed step per event.
