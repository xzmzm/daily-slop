# Last Batch — September 29, 2026

## Why this project?

September 29 is the [International Day of Awareness of Food Loss and Waste](https://www.fao.org/platform-food-loss-waste/flw-events/international-day-food-loss-and-waste/en), co-convened by FAO and UNEP. A bakery's early-morning batch seemed like a small, playable version of the problem: unsold food is visible, but the people who found an empty shelf are easy to miss.

I scanned the previous 67 daily projects. There are physics labs, print toys, a genetics sandbox, a restaurant stopping game, and a routing paradox, but no perishable-inventory decision. Coffee brewing was another September 29 candidate; this idea won because a single slider could expose a useful surprise without another physical simulation.

The surprise is **three identical means and three different best decisions**. The app is an original bakery presentation of the classical newsvendor problem. The observance is the reason for making it today; the forecasts are invented for the experiment. The app does not equate maximizing margin with minimizing food waste. Office roulette makes that tension particularly obvious.

## How it works

For a batch `q`, demand `d`, sale price `p = 3`, and bake cost `c`:

```
sold = min(q, d)
leftover = q - sold
missed = d - sold
margin = p × sold - c × q
```

Multiply each outcome by its demand probability and add to get its expectation. We enumerate batches from 0 through 48, keeping the highest expected margin. When two margins tie within floating-point tolerance, we keep the smaller batch, which has fewer leftovers.

The independent check is the newsvendor critical quantile. The next bun improves expected margin only if `p × P(D > q) > c`. Equivalently, stop at the smallest batch whose cumulative probability reaches `(p − c) / p`. [MIT's stochastic-demand inventory lecture](https://ocw.mit.edu/courses/15-772j-d-lab-supply-chains-fall-2014/0d50c5c77382852102ee30b98f1d4657_MIT15_772JF14_Lec14.pdf) explains the single-period model and marginal-unit argument.

The three discrete distributions are normalized triangular weights:

- **The regulars:** centered at 24, supported on 18–30.
- **Office roulette:** equal mixtures centered at 14 and 34, each with radius 4.
- **A rare rush:** 75% centered at 18 and 25% centered at 42, each with radius 2.

All three means are exactly 24. At the default cost, the optimal batches are 25, 33, and 19. In the rare-rush case, 19 and 20 have equal expected margin; 19 has fewer leftovers. This exact tie is intentional and tested.

A seeded linear congruential generator produces 30 uniform draws; inverse-CDF sampling turns them into demand. Quantity and bake cost never enter the generator. Changing a batch therefore preserves the month. Changing forecasts transforms the same uniform draws through another CDF; **New month** changes the seed. This reduces random noise when comparing decisions, but a 30-day sample can still rank batches differently from the expected-value optimum.

## Interesting notes

The first temptation was to put a big “waste saved” score on the page. An empty oven would win that score while serving nobody, so the finished UI keeps sold buns, leftovers, missed customers, and margin visible together.

The bread tray is a count diagram: 48 positions, one glyph per baked bun. A sold bun becomes a green check; an unsold bun remains bread. Empty positions remain dotted outlines, so changing the batch does not rearrange the whole tray. It is drawn locally on canvas; the textual label supplies the same counts to screen readers.

The histogram is the forecast, while the 30 small columns are actual sampled mornings. A dashed orange mark shows the batch in both views. Keeping those two layers distinct matters: a favorable month is not proof that a policy is optimal.

Donation, discounted closing-time sales, learning a forecast from observations, and multiple products would each change the decision. They are deliberately outside this one-batch project.

The video capture initially stopped at its first opening animation because Playwright rejected a fractional `66.666…` millisecond clock tick. The fix alternates integer 66/67 ms ticks based on rounded frame boundaries. I kept the completed Fish Audio narration and recaptured into a fresh temporary directory. A separate caption preview caught insufficient scroll space below the expanded answer; extra bottom padding is confined to the recording stylesheet.
