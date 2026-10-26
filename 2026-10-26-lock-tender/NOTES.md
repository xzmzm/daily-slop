# Lock Tender — October 26, 2026

## Why this project?

October 26 is the anniversary of the Erie Canal opening in 1825. The [New York State Archives account](https://www.nysarchivestrust.org/exhibits/erie-canal/construction-opening) describes DeWitt Clinton leaving Buffalo aboard the Seneca Chief. That boat trip suggested a smaller question than a map of the whole canal: how does a floating boat cross a hill?

The existing gallery has plenty of orbits, optical benches, machinery and transport experiments, but no canal lock. I picked a working gate-and-sluice sequence over a historical route map because the distinction between a big gate and a small water opening is something you can discover by trying the wrong control.

## How it works

The model has two fixed reaches, at 0 and 2.4 m, and a rectangular chamber between them. A sluice connects the chamber to one reach. Opening it changes the chamber height toward that reach; the boat follows the water surface while inside. The outer reaches are treated as reservoirs large enough that their levels do not change.

Flow speed is proportional to the square root of the remaining head difference. Rather than add a fixed amount per animation frame, the model integrates that relation exactly: the square root of the head decreases linearly, stops at zero, and is squared again. A full change takes seven illustrative seconds. This gives visibly slowing flow near equalisation without overshoot after a long time step. The admitted and released volumes are the chamber area, 120 m², multiplied by the change in level. A full fill admits 288 m³.

Rules are separate from drawing code. Gates refuse to open with unequal water levels or an open sluice. Sluices refuse to open with an open gate or the other sluice open. Gate movement is blocked while the boat crosses. This deliberately enforces a safe teaching sequence; real locks have varied machinery and operating procedures.

Each direction starts with the chamber at the *opposite* level to the arriving boat. Going uphill first needs a drain; going downhill first needs a fill. The player completes the whole cycle rather than arriving at a pre-prepared entrance. Boat travel uses smooth interpolation over 2.4 seconds, and animation can be stepped deterministically for browser checks and video capture.

## Interesting notes

- A side section cannot truthfully depict a pair of mitre gates swinging in plan. The drawing therefore uses a narrow timber section that fades when open, explicitly labelled as schematic rather than inventing a lifting gate.
- The pressure refusal shows the actual height difference. At equal levels the net hydrostatic load balances; this does not imply real gates have no friction or can open themselves.
- The chamber dimensions and lift are chosen for the illustration, not borrowed from a historical survey. Presenting them as an original Erie lock would give an attractive diagram more authority than it deserves.
- No automatic solution button: the prompt points at one useful control, but the player still opens and closes the actual gates and sluices.
- No canal network, pumps, tolls or water-saving basin puzzle. The little distinction between moving water and moving a boat is the day's entire idea.
