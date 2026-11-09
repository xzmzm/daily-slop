# No Overlap — notes

## Why this project?

Forty-three years ago today, 10 November 1983, Microsoft rented the Plaza Hotel in New York and announced Windows. The detail everyone forgets is the constraint at the heart of 1.0: **its windows could not overlap**. The desktop tiled itself; the current window got the big tile, everyone else filled a column and a row around it. Free overlapping windows only arrived with Windows 2.0 in December 1987 — and by then the Mac (January 1984) had already made overlap the expected way a desktop works.

That rule is a perfect daily-slop subject: one idea, easy to state ("no two windows ever share a pixel"), and it makes a satisfying interactive when the system visibly re-tiles after every action. It also breaks this month's streak of physics sims with a UI-mechanics toy, which was deliberate — the alternatives for the date were the Edmund Fitzgerald (waves again, too close to 2026-11-05-long-wave) and the first coast-to-coast direct-dialed call (a third network/telecom sim in a row). The tiling rule won.

## How it works

Everything is fractions. The desktop is a unit square; five numbers pin the whole layout:

- `colFrac` — the split between the left column (current window + bottom row) and the right column.
- `rowFrac` — the split inside the left column between the current window and the bottom row.
- `rightFracs[]` — inner boundaries of the right column's rows, relative to its height.
- `bottomFracs[]` — inner boundaries of the bottom row's columns, in absolute desktop units.

The current window always takes `(0, 0, colFrac, rowFrac)`. The remaining open windows are dealt in order: `ceil(n/2)` of them become rows filling the right column (full height), the rest become columns filling the bottom row. Because every rectangle is computed from the same few stored numbers, adjacent tiles share *exact* edges — floats like `0.62` and `1 - 0.62` are bit-identical complements, so the test suite can assert disjointness with plain `<` comparisons and an epsilon of 1e-9 that never fires.

Sashes are just edges of those rectangles, rendered as 13px-wide hot zones centered on the line. Dragging one updates exactly one number (the `main-col` sash additionally rescales `bottomFracs` so the bottom row keeps its proportions while the column moves). Drag totals are computed from a snapshot taken at pointerdown and re-applied on every move — the model's `dragSash` always mutates from "current" state, so re-applying the snapshot before each move keeps the drag absolute instead of accumulating deltas.

Zoom sets the current window to `(0, 0, 1, 1)` and iconifies the rest into the bottom strip; restoring any icon makes that window current, which un-zooms as a side effect. The 1987 mode keeps the same five windows but swaps rectangles for per-window float rects with a stagger on entry, a z-order counter for raise-on-click, and a pairwise-intersection counter for the overlapping-pairs readout (windows that participate get the red clash treatment).

The split of responsibilities follows the recent house pattern: `model.js` is pure layout/state logic (no DOM), `app.js` renders and wires pointer events, and `test_model.cjs` + `test_browser.py` test each layer — including a 200-drag fuzz loop asserting the tiles stay disjoint after arbitrary sash moves.

## Interesting notes

- Two bugs ate most of the build time. First, the content builders returned their elements but `windowEl` never appended them — five perfectly laid-out empty windows, which the geometry tests all passed because they only check rectangles. The lesson in miniature: tests assert what you thought to assert, nothing more. Second, `flex: 1` in the column-flex `#screen` set `flex-basis: 0%`, which silently overrode both `height` and `aspect-ratio` on `#tiles` and collapsed the desktop to zero height; the click hit-tests then landed in the icon strip. `flex: 1 1 auto` fixed it.
- The desktop tiling of the real Windows 1.0 was never documented in detail, so the three-zone layout here is an approximation of the look (big current tile top-left, tall column on the right, row along the bottom-left) rather than a reconstruction of the actual algorithm.
- Iconify is disabled in 1987 mode. Windows 2.0 did have minimize, but keeping icons tile-mode-only keeps both modes one idea each: 1983 = fixed rectangles, 1987 = floating ones.
- The clock shows the real current time — a deliberate nod that this is a live desktop, not a diorama; the calendar is the opposite, pinned to November 1983 with the 10th boxed.
- The `WIN COM` row in MS-DOS Executive is dated 11-10-83 and does nothing: clicking any file logs that Windows ships 20 November 1985. Two years of waiting, reproduced faithfully.
- The video's cursor choreography leans on sash drags and title clicks — they read clearly at 1080p because something *moves* without anything being destroyed; in 1987 mode the drag of one window onto another is the money shot.
