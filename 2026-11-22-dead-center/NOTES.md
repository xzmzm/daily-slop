# Dead Center notes · 2026-11-22

## Why this project?

George Ferris died on November 22, 1896, three years after the Chicago World's Columbian Exposition. Its original Ferris wheel carried 36 cabins. I built a smaller wheel to see what happens when a load that looks balanced at the platform moves a quarter turn. The eight cabin positions and 36 riders are puzzle choices. [Linda Hall Library](https://www.lindahall.org/about/news/scientist-of-the-day/george-washington-ferris/) · [National Park Service nomination](https://npgallery.nps.gov/GetAsset/641a995c-6cdf-4584-b98a-5dc4514e43e2/)

## How it works

The cabins sit 45° apart. Give each rider the same weight and measure horizontal distance in wheel radii. Gravity contributes one rider-weight times that signed horizontal distance to the axle moment. Identical cabin masses cancel around the wheel.

With the wheel parked, calculate two sums over the eight cabin loads. Multiply each load by the sine of its cabin angle for the horizontal sum and by the cosine for the upward sum. At wheel angle θ, the moment is the horizontal sum times cos θ plus the upward sum times sin θ. Its peak absolute value over a turn is the hypotenuse of the two sums. The graph samples that curve for display and the puzzle checks the analytic peak.

## Interesting notes

The opening arrangement puts six riders in B and six in H, both above the axle. At the starting angle their horizontal contributions cancel. A quarter turn later those same groups contribute a combined 8.5 rider × radius units. Swap H with the empty F cabin and every occupied cabin has an equally loaded partner across the axle. The chart goes flat at every angle. Changes in motor effort here come from passenger weight alone. The model omits acceleration, friction, wind and cabin swing.
