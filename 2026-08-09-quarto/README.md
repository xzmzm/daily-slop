# quarto

Built by GLM-5.2

A **booklet imposition studio** for National Book Lovers Day (August 9).

Here is the one thing about bookbinding that surprises everyone: when you
print a saddle-stitched booklet, **the pages are not laid out on the sheet in
reading order**. A 16-page booklet's cover sheet carries pages `16` and `1` on
the same face, and `2` and `15` on the other. Only after you nest the sheets,
fold once down the middle, and staple through the crease do the pages fall into
`1, 2, 3 …` sequence. That arrangement is called **imposition**, and it is the
single most counter-intuitive fact about how a physical book is made.

quarto makes the invisible geometry visible. Pick a page count and see the real
print layout of every sheet, watch the outer sheet fold into a signature, flip
through the finished booklet in reading order, and read the closed-form math
behind it all.

## What you can do

- **See the sheets** — every sheet of the booklet is shown with its true
  print-time page positions: two pages on the outside face, two on the inside.
  The outer sheet is tagged as the cover; the innermost is the center.
- **Watch one fold** — the outermost sheet's two halves fold together in a short
  animation, so you can see how pages `[16, 1]` collapse into a cover.
- **Read the finished book** — flip through the assembled leaves 1 → N, each
  page carrying a short line from an essay on how a book is made. The reader
  also tells you which sheet each leaf came from.
- **Read the math** — the closed-form imposition formula, a sheet-by-sheet
  table, and the invariant that **every face of every sheet sums to P + 1**.

Page count ranges from 4 (a single-sheet *folio*) to 32 (*sexto-decimo*).
Use the −4 / +4 buttons, the preset dropdown, or the `[` / `]` keys. In the
booklet view, the arrow keys turn the leaves.

## How to run

No build step, no dependencies:

```
python3 -m http.server 8765
```

then open <http://localhost:8765/2026-08-09-quarto/>.

(Any free port works — just avoid 8000, which is reserved on this machine.)

## The imposition formula

For a booklet of **P** pages there are **P/4** sheets. Sheet *i* (counting from
0 at the outside) carries four pages given by:

```
front (outside) = [ P − 2i , 2i + 1 ]     ← the cover sheet
back  (inside)  = [ 2i + 2 , P − (2i+1) ]
```

Each of the four faces sums to **P + 1** — that is the invariant that makes the
whole scheme work. For the canonical 8-page booklet:

| sheet | front (outside) | back (inside) |
| --- | --- | --- |
| 1 (outer) | `[8, 1]` | `[2, 7]` |
| 2 (inner) | `[6, 3]` | `[4, 5]` |

## Verification

The imposition engine is asserted in Node against hand-computed expectations —
the classic 8-page layout, the 16-page octavo expansion, the folio, the face-sum
invariant across P = 4…32, page uniqueness, reading-order provenance, the
cover-and-center claims, and input validation. Run it with:

```
node test_engine.js
```
