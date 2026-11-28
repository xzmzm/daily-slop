# Build notes

## Why this project?

On 28–29 November 1929 Bernt Balchen (pilot), Harold June, Ashley McKinley and Richard Byrd flew the Ford Trimotor *Floyd Bennett* from Little America to the South Pole and back. The best-known moment came on the way up: climbing the glacier to the polar plateau, the plane would not gain enough height to clear the pass, and they threw food overboard until it did. Accounts disagree on the details. Byrd's newspaper dispatches mention 125 lb and 250 lb, later retellings say two 150 lb sacks, and Balchen's own account remembers 300 lb of food that Byrd added at the last minute. They also disagree on whether the plane was over Liv or Axel Heiberg Glacier at the time. All of them agree on the decision: drop the food you'd need if forced down so the plane can climb now.

That trade-off is what the toy is about. It is also new for this folder. The closest recent days were orbital or attitude problems (Mariner 4's star lock, Lunokhod's delay), and none was about weight or climb performance. Other candidates for the date were Edison showing the phonograph (1877) and Enos the chimp's orbit (1961).

## How it works

- **Ceiling.** Gross weight sets an absolute ceiling, `9,750 + 2.2 × (15,000 − W)` ft. Each 150 lb sack is worth about 330 ft of ceiling.
- **Climb.** Climb rate is `1,000 × (1 − h/ceiling) × (1 + h/12,000) − sink(x)` ft/min, so the aircraft approaches its ceiling exponentially. The time constant is a few minutes, about 10 miles at 90 mph. That is why the *timing* of a drop matters, not just the total weight.
- **Fuel burn** is 6.5 lb/min, which makes the plane slowly lighter. A hands-off flight gains about 500 ft of ceiling on the way up, but not enough.
- **Sink.** From mile 34 a downdraft builds to 230 ft/min and holds until the pass. Inside it the aircraft loses height whatever it weighs, so all the climbing has to be done before mile 34.
- **Ice.** The profile is `300 + 9,300 × (0.25t + 0.75t³)` with `t = x/50`. It is gentle at the mouth and steep near the head. Coming within 50 ft of the ice counts as hitting it.
- **Projection.** Each frame the model is copied and integrated forward to the pass in 0.1-minute steps, once as it is and once with 150 lb less. Those two runs are the amber and green dashed lines. The tests check that the projection matches the flown result to within 30 ft.
- **Fuel margin** is the fuel on board, plus what has been burned since mile 0, minus the 3,060 lb needed at mile 0 to reach the Pole and get back to the depot. It starts at +214 lb, which covers one 25-gallon dump but not two.

| Strategy | Result |
| --- | --- |
| Hands off | Hits the ice at mile 49.4, 0.6 mi short of the pass |
| One sack at mile 10 | Hits the ice just at the pass |
| Two sacks at mile 10 | Clears by about 360 ft with 3 sacks left. This is about what the real crew did. |
| Two sacks at mile 44 | Too late: hits the ice |
| Two gasoline dumps | Clears, but 86 lb short at the depot |
| One sack and one gasoline dump | Clears with 4 sacks and 64 lb of fuel to spare. The greedy answer. |

## Interesting notes

- In the first tuning, one sack of ceiling was worth 510 ft and a single sack at mile 10 cleared by 350 ft, which made the decision trivial. Lowering it to 2.2 ft/lb and raising the base ceiling to compensate gave the shape I wanted: one sack is not enough, two are.
- The first fuel-margin formula added the burn back with the wrong sign before mile 0, so the margin went *up* as you flew over the shelf. The rewrite is one line: fuel now, minus need, plus `x / speed × burn`.
- At full scale the plot is 0–12,000 ft over 470 px, so a 300 ft clearance is about 10 px and you can't see whether you'll make it. The close-up box over miles 38–53 (8,900–10,900 ft) fixes that. It reuses the same drawing code with a different coordinate frame, clipped to the box.
- Things left out: the real choice between Axel Heiberg and Liv Glacier, side walls and turning room in the glacier, engine temperatures, and the flight on to the Pole and back. The ceiling, sink, burn and fuel figures are made up to fit the story. They are not Trimotor data.

Sources: [Air & Space Forces Magazine, "Poles Apart"](https://www.airandspaceforces.com/article/1104pole/), [South Pole Station history PDF](https://www.southpolestation.com/trivia/history/byrdflightoverpole.pdf), [The Henry Ford, Floyd Bennett Trimotor](https://www.thehenryford.org/collections-and-research/digital-collections/artifact/28759), [Papers Past, Byrd dispatch, Dec 1929](https://paperspast.natlib.govt.nz/newspapers/GEST19291202.2.39).
