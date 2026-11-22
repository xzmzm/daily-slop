# Seed Turn build notes

## Why November 23?

Written as 11/23, the date gives the first four positive Fibonacci numbers. Pisa's 2026 Fibonacci Days included a conference on November 23. The sunflower made a good subject because a small angle change produces a visible result, and the same set of seeds works for every comparison. [Pisa's Fibonacci Days program](https://www.turismo.pisa.it/index.php/en/eventi/fibonacci-days-2026)

## How it works

Seed number `i`, starting at zero, goes at polar angle `i × turn` and radius proportional to `sqrt(i + 0.5)`. This keeps the ring area added per seed constant. Each seed is drawn as a small ellipse on a canvas. The exact golden-angle preset uses `180 × (3 − sqrt(5))` degrees. The slider samples the interval from 130° to 145° in hundredths of a degree. [Vogel's sunflower model](https://doi.org/10.1016/0025-5564(79)90080-4)

At 135°, eight turns total three revolutions, so seed directions repeat after eight seeds. At 144°, five turns total two revolutions. At the golden angle, 21 turns fall about 7.66° past eight revolutions, and 34 turns fall about 4.74° short of thirteen revolutions. Those small errors have opposite signs. Joining seeds whose indices differ by 21 or 34 makes two families of curves bend in opposite directions.

## Interesting notes

The connections start at seed index 64 so the traces stay legible near the center. These are fixed index intervals. At other angles the same overlays can cut across the spokes, which makes it possible to see how much their apparent fit depends on the turn. The seed count stays fixed at 480 so the angle is the one quantity changing the placement.
