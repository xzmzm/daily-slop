# Mesh Shift build notes

## November 21

The FAO marks November 21 as World Fisheries Day. NOAA’s description of its research trawls raised a useful measurement question. A survey crew uses smaller mesh to sample a wider range of sizes than a commercial trawl typically retains. If all you saw was the catch, it would be easy to read a difference in gear as a difference in the fish population. [FAO’s World Fisheries Day page](https://www.fao.org/in-action/globefish/news-events/events/events-detail/world-fisheries-day-2026/en) · [NOAA’s survey trawl description, figure A-2](https://www.fisheries.noaa.gov/s3/2024-03/AFSC-2024-2029LOA-App-OPR1.pdf)

## How it works

A seeded generator makes 72 fish. Each length averages two uniform draws and maps the result into 12–56 cm before rounding, which puts more fish around the middle. Each fish also has a fixed random roll. For fish length L and mesh opening M, the retention probability is 1 / (1 + exp((5M − L) / 4)). A fish stays in the sample if its roll is below that probability. The constants give the three openings visibly different catch profiles at this school size.

Widening the mesh lowers the probability for every length, so keeping each roll fixed guarantees that every fish retained by a wider mesh would also stay in a narrower one. The histogram keeps both series on the scale of the largest whole-school bin. Each tow animates the same outcomes used to compute the bars and summary.

At 5 cm the sample is 47 fish with a mean length of 36.0 cm. At 9 cm it’s 11 fish at 44.8 cm. In this school the largest bin by length has just three fish, and all three make it into both samples. The 10–29 cm bands contain 31 fish between them, and zero make it into the 9 cm sample. The numbers and the animated mesh are illustrative. Real selectivity varies with fish shape and behavior, gear, and tow conditions.
