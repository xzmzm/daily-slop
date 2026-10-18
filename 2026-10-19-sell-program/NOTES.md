# Sell Program — notes

## Why this project?

Today is 19 October, the anniversary of Black Monday: in 1987 the Dow fell
508 points, from 2246.74 to 1738.74, or 22.6% in one session. It is still the
largest one-day percentage drop in the index's history. The Brady Commission
pinned a large share of the damage on *portfolio insurance*, a strategy that
an estimated $60–90bn followed.

Other candidates for the date were Yorktown (1781) and Chandrasekhar's
birthday (1910). Black Monday won because it has one clean mechanism you can
put on a slider. Each investor following the rule was being prudent, and
together they caused the crash they were insuring against. Nothing in the
gallery had touched markets yet.

## How it works

`model.js` runs one trading day minute by minute (390 minutes) with flows in
$bn and a permanent, linear price impact: `P ← P·exp(net flow / depth)`.

**The insurers** follow CPPI (constant-proportion portfolio insurance), the
simplest form of the strategy:

- floor = 85% of Friday's wealth, cushion = wealth − floor
- target stock exposure = 5 × cushion (capped at total wealth)

On Friday that is 75% stock and 25% cash. When stocks fall by *x*, wealth
falls by 0.75*x* but the target falls by five times as much, so the formula
asks for about 3 × book × *x* of selling. That is the amplifier.

**The desks can't keep up.** Each minute an insurer can push through only
0.025% of its book. Everything else becomes a **backlog** (the red bars):
orders the formula wants executed that the market has not taken. Each sale
lowers the price, which raises everyone's backlog again.

**Bargain hunters** buy in proportion to the discount below Friday's close,
but divide that by `1 + FEAR·speed`, where *speed* is a smoothed rate of fall.
They step back while the tape is crashing. That fear term is why the decline
keeps going instead of settling.

**Circuit breakers** (the modern rule, which didn't exist in 1987) halt
trading for 15 minutes at −7% and −13% and end the day at −20%. During a halt
the bargain orders pile up and arrive together at the reopen.

## Interesting notes

- **The first version ran away.** I started with depth that thinned as
  selling built up ("stressed book"). That feedback was so strong that the
  default run fell 63% in twenty minutes and then recovered, a V instead of
  a slide. Making the *desks* the bottleneck (a fixed execution pace) and
  dropping the stress term gave the real shape: a grinding fall all day that
  closes at the low, which is what happened.
- **Tuning was a grid search** over depth, pace, value-buyer strength and fear.
  The targets were no insurers ≈ −2%, $75bn ≈ −22.6%, and insurer sales of
  around $6–9bn. The real figure for insurer sales is roughly $4bn of futures plus
  about $2bn of stock. The chosen setting gives −21.6% and $7.3bn sold.
- **The backlog is the striking number.** On the default run insurers sell
  $7bn and their formulas still want another ~$37bn at the bell. Real insurers
  famously fell far behind their own models that day. That gap between what the
  formula demands and what the market can absorb is the point of the project.
- **Breakers move the selling instead of removing it.** With $120bn insured
  and breakers on, the market shuts at −20% at 13:11, but about
  $65bn of orders are still waiting for Tuesday. The halts in the toy
  help a little, because queued bargain orders land at once. The −20% close
  mostly just stops the clock.
- Liquidity is the strongest lever: halve "buyers on the floor" and the default
  fall is about −41%; double it and the loop barely gets going (−11%).
- Left out: index arbitrage between Chicago futures and New York stocks, the
  specialist system, and Tuesday. Those were part of the real story but each
  is a project of its own.
