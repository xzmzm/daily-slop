# Notes — tail-gambit

## Why this project?

August 14 is World Lizard Day. The obvious lizard app would have been a species gallery, but the strange mechanism of autotomy is much better suited to an interaction: a lizard does not merely “lose” its tail. It actively contracts muscles around a pre-existing fracture plane, and the discarded tail keeps producing patterned motion. That is an unusually legible bargain—spend a body part and its stored energy to buy a few seconds of someone else's attention.

This beat a camouflage toy and a terrarium-temperature planner because neither had such a sharp single action. Here, pressing Space is the biology lesson.

## How it works

Every strike lasts 2.4 seconds. Pressing the release control starts a short species-strategy fracture delay. The engine compares the completed detachment time with predator contact. A Gaussian timing curve rewards a release shortly before contact, while a separate reacquisition term penalizes dropping extremely early. Tail vigor scales the final distraction score. These numbers make a readable game; the interface says explicitly that they are an illustrative model and not measured survival probabilities.

The detached tail is a chain of points. Segment `i` gets the angle

`θᵢ(t) = A exp(−t/τ) sin(2πft − ki)`

so activity alternates, travels along the tail, and fades. This is a schematic rather than a neuromuscular simulation, but it captures the surprising experimental observation that rhythmic left/right activity persists after separation and can propagate along a non-regenerated tail.

Recovery uses two deliberately simple curves. Replacement length rises quickly after the early wound phase and then saturates; sprint balance approaches baseline exponentially. Stored energy only partly returns because regrowing tissue itself costs energy. The note about anatomy is the important part: a regenerated lizard tail is supported by an unsegmented cartilage tube, not a newly rebuilt vertebral column.

## Interesting notes

- The first version made “drop immediately” a winning strategy. Adding predator reacquisition was the important design correction: a decoy is only valuable while attention is committed.
- The three animals are presented as strategy presets, not calibrated biological comparisons. Their relative timings make the interaction feel different without pretending that a browser game has species-level field estimates.
- The scope plot draws three phase-shifted segment traces from the exact same function that animates the tail, so the equation, telemetry, and visible motion cannot quietly disagree.
- Autotomy is active. Structural studies of Tokay geckos show distinct pre-severed sites whose microstructured surfaces adhere until muscular action separates them; passive pulling requires more force.

## Sources that shaped it

- Song et al., “Unique Structural Features Facilitate Lizard Tail Autotomy,” *PLoS ONE* (2012): fracture planes, adhesion microstructures, and active shedding.
- Dial & Fitzpatrick, “Muscle activity in autotomized tails of a lizard (Gekko gecko),” *Journal of Comparative Physiology A* (1996): alternating rhythmic activity and propagation after detachment.
- Gilbert et al., “Lizard tail regeneration: regulation of two distinct cartilage regions by Indian hedgehog,” *Developmental Biology* (2015): the regenerated cartilage tube.

## Deliberately left out

No blood, predation gore, population model, or claim that all lizards can autotomize. The one-hour build stays focused on the decision, the decoy motion, and the cost.
