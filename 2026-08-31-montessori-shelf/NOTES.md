# Montessori's Shelf — notes for 2026-08-31

## Why this project?

Today is Maria Montessori's 156th birthday (31 Aug 1870, Chiaravalle). The
week's run of builds had been heavy lab physics — Lavoisier's balance, the
Drake well, WEAF's AM transmitter, Faraday's ring, Rutherford's foil — and
the shelf of candidates for today (Helmholtz for acoustics, Diana, the
Gleiwitz false flag, the 1886 Charleston earthquake) all pointed *back*
toward that same register. Montessori pointed somewhere new: pedagogy,
early childhood, a warm sunlit room instead of a dark lab. And once I
started reading the actual materials, the surprise was how much **exact
mathematics** is physically embedded in them — this house's favorite kind
of thing, hiding in a nursery.

## How it works

### The exchange algebra (the bench)

Every state of the work mat is a **category vector** `(u, t, h, k)` — loose
beads, ten-bars, hundred-squares, thousand-cubes — with value

```
V = u + 10t + 100h + 1000k
```

The bank exchange `10·(category i) ⇄ 1·(category i+1)` is value-neutral by
construction, and the tests fuzz 200 start states × 1000 random exchanges
each against a BigInt oracle (200,000 checks, zero drift). "Dynamic
addition" is then just two moves: **combine** (pointwise vector addition —
the physical act of sliding tray B onto tray A) and **canonicalize** (walk
each category to the bank until every digit < 10). The schoolbook vertical
addition with carries is *the same computation* — each carry `+1` is one
physical trip to the bank, which is why the bank tab shows the carry row
and the exchange count agreeing (3 exchanges = 3 carries for 3567+2795;
the 9999+1 cascade does 4 and overflows into a ten-thousand column, the
fifth category, which is why the mat stocks a 万 zone at all).

One subtlety I enjoyed: with two addends ≤ 9999, **each category can hold
at most 19 pieces** after a carry-in (9+9+1), so every category makes at
most one bank trip per problem. The maximum number of exchanges is 4 —
exactly the maximum number of carries in a 4-digit + 4-digit column
addition. The tests assert this agreement over a 500-case fuzz sweep.

### The pink tower (Nicomachus's theorem)

Ten cubes, edges 1..10 cm, volumes 1³..10³ cm³. Total:
`Σn³ = 3025 = 55²`, and 55 is exactly the number rods' total length
(1+2+…+10, in cm). The identity `Σn³ = T(n)²` holds for *every* prefix n,
not just ten — the tower tab's slider checks it live at each n.

The proof plate is the visual heart of the tab: tile a 55×55 square with
nested L-gnomons. Gnomon n (the ring added when the square grows from side
T(n−1) to T(n)) has area `T(n)² − T(n−1)² = n·(T(n)+T(n−1)) = n·n² = n³`
exactly — so the ten rings' areas are 1, 8, 27, …, 1000 and sum to the
whole square. Montessori children can't derive that; but they *stack the
rings as the broad stair / tower family*, and the number is sitting there
in the wood.

### The algebra boxes

The binomial cube is 8 pieces in a 2×2×2 grid: the cell at (i,j,k) has
dimensions drawn from {a,b} per axis, so the piece counts by term are
exactly 1, 3, 3, 1 — the binomial coefficients — and their volumes sum to
(a+b)³ because that's literally the box. The trinomial cube is 27 pieces
in 3×3×3 with counts 1 (×3 cubes), 3 (×6 prism types), 6 (corner blocks):
3 + 18 + 6 = 27. I cut the boxes at a=6,b=4 and a=5,b=3,c=2 so **both
are exactly 10 cm on a side, volume 1000 cm³ — identical to the pink
tower's largest cube.** That cross-material identity is asserted in the
tests (and printed in both tabs' ledgers). Commercial boxes use the
manufacturer's cuts; the identities, not the millimeters, are the point —
this is noted in README too.

Faces are colored per dimension letter (a red, b blue, c yellow), so any
two touching faces automatically match — which is the actual control of
error in the real material: the pattern only closes if the pieces are
right.

## Interesting notes (dead ends & tuning)

- **Countability was the hard-won visual requirement.** My first hundred-
  squares and thousand-cubes fanned out as diagonal decks with ~7 px
  offsets — beautiful, and *uncountable*: the vision check read 5 cubes
  as 1. A material whose whole job is counting can't ship that. Cubes now
  lay in brick-offset rows of three (56 px sprites), squares in a wider
  fan, and the vision check counts 3/5/6/7 and 2/7/9/5 exactly for
  3567+2795.
- **Sprite proportions had to be honest**: bar length ≈ square side ≈ cube
  edge (all are "10 beads"). The first draft had 86 px bars over 68 px
  squares over 84 px cubes, which both wasted zone width and lied about
  proportion. Final: bead 20, bar 58, square 56, cube 56×62.
- **The bank shelf is drawn at 0.62 scale** — banked groups park as tidy
  5×2 clusters, one cluster per exchange, so you can *see* three groups of
  ten sitting in the bank after 3567+2795. First attempt used a generic
  52 px slot pitch and the shelf became soup (35 px sprites overlapping).
- **The answer cards skip zero places Montessori-style** — 10,000 renders
  as a single 万-card, not "1 0 0 0 0"; the full sentence below restores
  the familiar spelling. (My first version skipped zeros except units,
  producing a weird "1万 + 0个" pair. Vision check caught it.)
- The bench is a pure function of `state.clock` (driven by
  `window.__demo.step(dt)`) so the video renderer can frame-step it;
  autoplay (`自动演示`) is on by default for a living gallery screenshot
  and is disabled by `setVideoMode(true)`.
- Iso painter's ordering for the algebra boxes: sort pieces by
  `(x + y + z)` ascending — the standard iso-voxel trick; cell dims differ
  per axis but pieces never interpenetrate, so the cheap sort is exact.
- The 一串十珠 wire: real ten-bars have beads on a wire; drawing the wire
  line *under* the beads (first) so beads occlude it took one iteration to
  get right.

## Historical notes (and honesty)

- Montessori was among Italy's first women physicians (University of Rome,
  1896) — commonly stated as "the first"; I wrote "among the earliest" to
  be safe.
- The famous alumni list (Page, Brin, Bezos, Wales, García Márquez,
  Julia Child, Anne Frank) is a compilation of commonly cited claims,
  marked as such in the UI; García Márquez is the best-documented
  (he credited Montessori method for his writing in memoir).
- The epitaph quote on the timeline ("I beg the dear all-powerful children
  to join me in creating peace among humans") is the documented
  Noordwijk epitaph, translated.
- "Help me to do it myself" (*Aiutami a fare da solo*) is the movement's
  signature phrase, marked in the UI as the child's request.
- Category colors follow the actual Montessori convention (units green,
  tens blue, hundreds red, thousands green — the cycle repeats), which is
  why the mat's zone tints and number cards alternate the way they do.
