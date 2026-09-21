# September 22, 2026 — Shortcut Trap

## Why this project?

The official European Mobility Week site lists September 16–22 for the 2026 campaign. Its final day suggested a small transport experiment, rather than another visual physics instrument. The existing daily index already includes a differential-axle lab, but not route assignment: this project concerns how separate choices interact across a network, not how a car turns.

The hook is useful because it is testable with one button: adding a road can increase the travel time of every driver at equilibrium. Just as importantly, the same button helps at low demand and becomes irrelevant at high demand. The demand curve makes it harder to mistake the example for a general argument against roads.

Sources checked for this build: [European Mobility Week](https://mobilityweek.eu/home/) and the primary teaching text by Easley and Kleinberg, [chapter 8](https://www.cs.cornell.edu/home/kleinber/networks-book/networks-book-ch08.pdf). The campaign supplies the date connection; the textbook supplies the network, not the app design.

## The network, explicitly

Three directed routes run from S to T:

- Upper: S → A → T.
- Lower: S → B → T.
- Shortcut: S → A → B → T, available only when open.

S → A and B → T each cost their own assigned flow divided by 100, in minutes. A → T and S → B each cost 45 minutes. A → B costs `d` minutes, independent of flow. The controls expose total demand `q` and `d`.

Let `u` be the flow on each congestion-sensitive edge in a symmetric assignment. Each outer route carries `q-u`; the cross route carries `2u-q`. Feasibility is `q/2 ≤ u ≤ q`. The outer routes each cost `u/100 + 45`, while the cross route costs `2u/100 + d`.

### Individual incentives

At an interior Wardrop equilibrium, every used route has the same minimum cost. Equating the outer and cross costs gives `u = 100(45-d)`. Clamp that value to `[q/2, q]` to cover all-cross and no-cross boundary solutions. With the link closed, `u=q/2`.

This uses the nonatomic approximation: a single traveller has negligible effect on aggregate flow. It is not an exact finite-player atomic congestion game, despite presenting the aggregate flow as drivers. Fractional route allocations are permitted by the model.

At `q=4000, d=0`, the clamp gives `u=4000`. Everyone takes the cross route, which costs 80 minutes. Either unused outer route would cost 85 minutes, so a unilateral deviation does not help. Closing the connector gives a 2,000/2,000 split and 65 minutes.

### Coordinating the assignment

Total travel time is

```text
C(u) = 2u²/100 + 90(q-u) + d(2u-q).
```

Its derivative is `4u/100 - 90 + 2d`; the minimizer is therefore `u = 50(45-d)`, again clamped to the feasible interval. At the default demand, that produces flows `[1750,1750,500]` and an average of 64.6875 minutes. The cross-route users take 45 minutes and the outer-route users take 67.5, so the assignment is efficient but not stable under selfish rerouting.

Symmetry is sufficient here: for fixed cross flow, the total cost contains the sum of squares of the two congestible-edge loads. Balancing those loads minimizes their sum of squares, while the remaining terms depend only on total outer flow. The independent test grid deliberately samples asymmetric allocations to catch a mistaken symmetry assumption or factor of two.

## Rendering and interaction

The Canvas map uses sampled Bézier paths and arc-length lookup for marker placement. Road widths and marker counts convey assignment without promising one sprite per driver. Their visible speeds are illustrative, and a minimum display duration keeps the zero-time connector legible. Route labels and the route table, not the animation, give the model's actual times.

The lower chart solves the same analytic model over a demand sweep for the currently selected connector delay. Orange shading only appears where the open-link selfish equilibrium is slower than the closed-link baseline. The coordinated average can lie below both curves. The chart deliberately remains a comparison of selfish assignments, as its caption states; the sidebar shows the selected policy’s average.

URL fragments contain only the four bounded model parameters. Screenshot export draws a separate composition rather than trying to rasterize arbitrary HTML. No runtime external assets are necessary.

## Specific build notes

- The first chart-pointer test clicked page coordinates before scrolling the chart into view. Scrolling first made it test the intended control instead of an unrelated area.
- A restricted browser environment blocks localhost navigation. The explicit in-memory preview loads only this project's own files and records that URL/clipboard checks were skipped; the publishing workflow requires actual HTTP tests instead of treating the preview as equivalent.
- The video has a compact layout distinct from the normal page. Preview checks cover closed, open, low-demand, high-demand, coordinated, and delayed-link states so longer explanatory text cannot push the chart behind subtitles.
- The closed/open comparison always uses identical total demand. Coordinated averages are weighted by route flow, not an unweighted mean of the three route times.
- No claim is made about induced demand, real traffic queues, a measured road closure, or the relative merits of transport policy. Those require a different model and data.

## Deliberately left out

No toll optimizer, arbitrary graph editor, route-learning animation, or live traffic feed. One small network, two assignment rules, and a demand curve are enough to make the counterintuitive result inspectable.
