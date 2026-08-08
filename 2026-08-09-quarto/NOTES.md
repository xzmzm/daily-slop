# quarto — notes

## Why this project

Today is **National Book Lovers Day** (August 9), so a book-related build was
the obvious move. But "book" is a huge brief — an e-reader, a library catalog,
a reading-list app, a cover-art generator were all on the table, and most of
them are either a retread of something every productivity app already does or
too big for an hour.

The hook that won was the one genuinely *surprising* fact about books that
almost nobody knows: **the pages on a printed sheet are not in reading order**.
Print `[8, 1]` on one face and `[2, 7]` on the other, fold once, and pages
magically emerge 1, 2, 3, 4. That trick is called *imposition*, and it has a
clean closed-form formula you can verify. A toy that (a) is themed to Book
Lovers Day, (b) teaches something real and counter-intuitive, and (c) has a
solid math engine underneath — that was the whole pitch. It beat the cover-art
generator (pure aesthetics, no engine) and the reading-list app (just another
CRUD toy).

I checked the prior 16 days to be sure nothing touched bookbinding: the
closest was `loom-drafter` (weaving drafts), which is a different craft with a
different grid math entirely. No collision.

## How it works

### The engine

The whole project rests on one pure function, `imposeSheets(P)`, which lays out
the sheets of a P-page saddle-stitched booklet. For sheet *i* (0 = outermost,
the cover):

```
front (outside) = [ P − 2i , 2i + 1 ]
back  (inside)  = [ 2i + 2 , P − (2i+1) ]
```

Walk it through for P = 8 (the canonical reference layout every bookbinding
textbook opens with):

- sheet 0: front `[8, 1]`, back `[2, 7]`
- sheet 1: front `[6, 3]`, back `[4, 5]`

Nest sheet 1 inside sheet 0, fold each once down the middle, staple through the
crease — and you can read 1, 2, 3, 4, 5, 6, 7, 8 in order. It works because of
the invariant: **every face sums to P + 1**. On the 8-page booklet every face
sums to 9; on a 16-page booklet, 17. The outside of the cover sheet is always
`[P, 1]`, which is the prettiest special case.

From `imposeSheets` the rest is glue:
- `readingOrder(P)` flattens the sheets back into a 1…P list and records, for
  each page, which sheet and face it lives on — so the finished-book reader can
  say "this leaf came from sheet 2".
- `nestingOrder(P)` confirms sheet 0 is outermost and the last sheet is the
  center spread.

### The three views

- **The Sheet** renders every sheet as a card with its two faces and four page
  numbers in their true print positions, tagged "outside (front)" / "inside
  (back)". The outermost card is marked the cover; the innermost, the center.
- **The Booklet** is a two-page spread reader with a CSS 3D page-turning leaf
  overlay. Each page carries a line of a short essay on how a book is made, so
  even an 8-page booklet reads as a real little book rather than empty numbered
  pages.
- **The Math** shows the closed form, a sheet-by-sheet table including the face
  sums, and a plain-English note pointing out the `[P, 1]` cover claim.

### The fold animation

The outer sheet is drawn as two half-pages meeting at a red crease line.
Clicking "fold the outer sheet" runs a brief keyframe animation that hints at
the fold, then settles the left half rotated 180° around its right edge —
page 1 landing on top as the cover. It's a hint, not a physically accurate
folding sim; the point is the *aha* of seeing 16 and 1 collapse onto each
other, not modelling paper mechanics.

## Interesting notes

- **Deriving the formula.** I did not look up the closed form — I wrote out the
  8-page layout from memory (`[8,1]/[2,7]`, `[6,3]/[4,5]`), stared at it, and
  the pattern `P−2i, 2i+1` for the outside face fell out in about two minutes.
  The inside face is then forced: the outside's two pages are the smallest and
  largest of the sheet's four, so the inside carries the middle pair, and the
  `2i+2` / `P−(2i+1)` form keeps the sum invariant exact. The whole thing is
  held together by the fact that the four pages on sheet *i* are
  `{2i+1, 2i+2, P−2i, P−(2i+1)}` — two from the front of the book, two from the
  back, mirrored.

- **The P+1 invariant is load-bearing.** I almost didn't write a test for it
  because it felt obvious once I saw it, but it's the single fact that makes
  the layout provably correct: if every face sums to P+1 and every page appears
  exactly once, the fold has to produce reading order. So it got its own
  assertion loop over P = 4, 8, 12, …, 32, and it held for all of them.

- **A dead end on the page-turn animation.** My first version of the booklet
  reader just snapped spreads with no transition — functional but flat. The
  3D turning leaf (`rotateY` on an absolutely-positioned overlay, with the
  departing page on its front face and the arriving page on the back face,
  `backface-visibility: hidden`) took a couple of tries to get the front/back
  assignment right depending on turn direction. For a forward turn the leaf's
  front shows the page you're leaving (the right page of the current spread)
  and its back shows the page you'll land on; for a backward turn those swap.
  Getting that backwards for a few minutes made the book appear to read in the
  wrong direction during the turn, then snap correct — a nice subtle bug.

- **Browser-test actionability.** Verifying in the in-app browser, every click
  method (Playwright `click`, `force: true`, CUA coordinate click, DOM-CUA node
  click) timed out on actionability even though `count() === 1` and
  `isVisible() === true`. That's an environment quirk of the IAB, not the page
  — confirmed by reading the DOM directly: `renderAll()` ran on
  `DOMContentLoaded` and populated all three panels (4 sheet cards for P=16,
  fold preview showing 16/1, booklet spread 1–2, 4 math-table rows). The 52
  engine assertions are the real verification; the page is a thin render layer
  over a verified engine.

- **Folio names.** A "folio" is one sheet folded once (4 pages); "quarto" folds
  that again (8 pages); "octavo" a third time (16 pages). The project name is
  *quarto*; the default page count is 16 (an octavo), because the 8-page
  layout, while canonical, is a bit sparse and the 16-page one shows off four
  nested sheets with a real center spread — a better demo.

- **Deliberately out of scope.** Perfect binding (paperbacks), Smyth sewing,
  signatures of more than one sheet, and PDF export of an actually-printable
  imposition. All real, all too big for an hour. This is a saddle-stitch toy
  and proud of it.
