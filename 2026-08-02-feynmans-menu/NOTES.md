# Notes — Feynman’s Menu

## Why this project?

The August 1, 2026 issue of *Science News* resurfaced a lovely bit of Richard
Feynman marginalia: while eating lunch in the 1970s, he turned the familiar
“favorite dish or something new?” dilemma into a stopping problem. The notes
were only recently deciphered and formally connected to the optimal solution.

- [Science News: the math of choosing a restaurant meal](https://www.sciencenews.org/article/math-restaurant-meal-feynman)
- [PNAS: Resolving Feynman’s restaurant problem](https://doi.org/10.1073/pnas.2509612123)

The other serious candidate was a glowing-pickle simulator, prompted by new
work on why electrified pickles flare orange. It would have looked great, but
this repository already has several physical simulations and almost no decision
games. A ten-click experiment about uncertainty was the more genuinely new
shape.

## How it works

Every unseen restaurant has a fixed quality sampled uniformly from 0 to 100.
You learn that score only by spending a dinner there. A revisit returns the same
score, so the only facts needed for the next choice are the best score seen and
the number of dinners left.

Feynman’s stopping threshold is:

```
t(n) = sqrt(n) / (sqrt(n) + 1)
```

Here `n` includes tonight. With one dinner left, the threshold is 0.5: revisit
anything better than the average unknown restaurant. With ten dinners left it
is about 0.76, because an excellent early discovery can be reused many times.
The threshold falls as the trip ends. Once the optimal policy starts returning,
it never needs to explore again.

Internally, scores stay as floating-point values; the interface only rounds to
one decimal place. That matters because the closed-form rule assumes a
continuous uniform distribution. Integer scores would introduce ties and make
the displayed rule a tiny approximation instead of the exact policy.

For the final comparison, the town is a seeded queue of unknown restaurants.
Both the player and the napkin policy encounter the same first, second, third,
and subsequent *new* restaurants. This makes “same town” meaningful even when
they choose to explore on different nights.

## Interesting notes

- The first dinner is taken automatically. With no known favorite, exploring
  is the only rational move, and skipping that empty state makes the page start
  on the actual dilemma.
- Returning is deliberately a one-night action rather than a “commit forever”
  button. The optimal strategy will keep returning once it crosses the line,
  but letting the player wander again makes deviations visible and testable.
- A player can beat the optimal policy on one seeded town. “Optimal” maximizes
  expected score across many unknown towns; it is not clairvoyant. The result
  copy calls out lucky wins instead of pretending the rule wins every deal.
- The tiny check marks in the dinner ledger grade the decision that was made
  using the information available *before* that meal. They do not judge the
  meal after its score is revealed. The opening ticket gets an `A` because that
  first, choice-free exploration is automatic.
- I avoided a canvas chart on purpose. The falling threshold is made from plain
  DOM columns and CSS custom properties, keeping this daily build structurally
  different from the recent simulation-heavy run.

Deliberately left out: custom score distributions, restaurant ratings, maps,
sharing, and a tutorial sequence. They would blur the one clean question:
when is your current best finally good enough?
