# NOTES — loom-drafter

## Why this project?

I went looking through early-August 2026 news for a hook and mostly found
eclipse coverage and ISS spacewalks — both of which this repo has already mined
(`2026-08-01-eclipse-chaser`, and enough sky projects already: orbit-chime,
perseid-vigil). Eleven days in, the backlog leans heavily *physics and sky*:
solar geometry, orbital ratios, meteor rates, reaction-diffusion, raycasting.
Nothing had touched **craft**.

Weaving drafts turned out to be the perfect fit, for one specific reason: a
draft is a tiny **declarative program**. You write three inputs, and the fabric
is the deterministic output — you cannot draw the cloth directly, you can only
specify the rules that produce it. That's a genuinely satisfying thing to make
interactive, and it's the opposite of the generative-art projects here where you
tweak parameters until it looks nice. Here, correctness is objective: a 2/2
twill has floats of exactly 2, and if it doesn't, I have a bug.

It also has an honest utility angle — the float analysis genuinely tells you
something a beginning weaver would otherwise learn by wasting yarn.

## How it works

Four quadrants, but only three are inputs:

- `threading[e]` — for each of 32 warp ends, which shaft (0..S-1) it's threaded
  through.
- `tieup[t][s]` — boolean: does treadle `t` raise shaft `s`? (Rising shed.)
- `treadling[p]` — for each of 32 weft picks, which treadle you press.

The entire drawdown is then one line:

```js
isWarpUp(e, p) = tieup[ treadling[p] ][ threading[e] ]
```

That's the whole model. Warp end `e` shows on the surface at pick `p` exactly
when the treadle for that pick happens to lift the shaft that end is threaded
on. Everything else — twill diagonals, bird's-eye diamonds, log-cabin
illusions — is emergent from those three arrays. I find it slightly astonishing
how much structure falls out of one array lookup composed with two others.

**Named patterns are just generator functions** over `(i, shafts)`. Straight
draw is `i % S`. Point threading is a triangle wave with period `2S-2`.
Advancing twill is `(i + floor(i/S)) % S`. Tromp-as-writ is literally
`treadling[p] = threading[p]` — you read your threading as your treadling,
which is why it produces symmetric diamond patterns for free.

**Float analysis** walks each column and row of the drawdown looking for the
longest run of consecutive same-side threads. It has to be *cyclic*, because
the 32×32 grid is one repeat of endless cloth — a run of 3 at the end of a
column continues into the 2 at the start, making 5. Getting this wrong
under-reports floats exactly at the pattern seam, which is where real cloth
fails.

**The cloth preview** doesn't draw one square per intersection. It computes the
runs first and draws each float as a single rounded capsule with a gradient
across its short axis, weft first and warp on top. That's why a 1/7 twill reads
as long shiny diagonals: it *is* one long shape, not eight adjacent squares.

## Interesting notes

**The `surprise` bug worth keeping a record of.** My first version guaranteed
"every treadle raises between 1 and S-1 shafts", reasoning that this prevents
dead treadles and flat picks. The browser immediately produced a draft reporting
*"24 warp ends never interlace"*. The invariant was wrong, and wrong in an
interesting way: what matters isn't per-treadle, it's **per-shaft across the
treadles the treadling actually presses**. A shaft that is lifted by *every*
used treadle has its warp ends floating on the surface for the entire repeat —
they're not woven in at all, they're just lying on top. The fix generates each
shaft's column across the used treadles and rejects all-true and all-false. Then
it analyzes the result and retries (up to 80 times) if anything reads `bad`.
3000 seeds now produce zero unweavable drafts, max float 6.

This is the exact class of bug that only shows up if you check semantics rather
than "did it render" — the original drafts *looked* fine as pixel grids.

**A labeling lie I caught by switching looms.** I'd hardcoded the tie-up names
`2/2 twill`, `3/1 twill`, `1/3 twill`. On 4 shafts those are right. On 8 shafts
`Math.max(3, S-1)` raises 7 shafts — so the menu said "3/1 twill" while weaving
an actual 7/1. Twill names are ratios of raised:lowered shafts, so the same
structure is `2/2` on four shafts and `4/4` on eight. Labels are now computed
functions of the shaft count (`balanced`, `warp-faced`, `weft-faced` keys with
`ratio(up, S)` labels), and switching looms relabels the whole menu. Verified:
`2/2 → 4/4`, `3/1 → 7/1`, and each one's measured float length matches its name.

**The "— edited by hand —" option.** Once you click a single tie-up cell, the
dropdown still saying "2/2 twill" is a lie. Any hand edit prepends a blank
option and selects it. Small thing, but the alternative is a UI that
misdescribes its own state.

**Shaft 1 goes at the bottom.** In the threading block, shaft 1 is the row
*nearest the drawdown*, not the top row — that's the paper convention, and it
matters because it makes the visual distance from a threading mark to its
drawdown consequence meaningful. `pick()` inverts the row index for both the
threading and the tie-up. I derived the layout geometry once in a `layout()`
function that both the renderer and the hit-tester read, specifically so drawing
and clicking can't drift apart.

**Hover hint was stale after clicks.** The hint text was only updated on
`mousemove`, so clicking a tie-up cell toggled it but left the description of
its *previous* state on screen. Extracted `setHint()` and called it after the
click too.

**WIF export was more satisfying than expected.** WIF is just an INI file, and
the 1997 spec is simple enough to hand-write. I validated it by parsing my own
output back and asserting a round-trip on threading, treadling and tie-up. It
means a draft made here could in principle be opened in real weaving software.

**Left out of scope:** multiple treadles per pick (real looms let you press two
at once — this would need `treadling[p]` to become a set), profile drafts,
warp/weft yarn thickness (WIF has fields for it and the renderer would show
sett differences), and a proper drawdown-to-draft inverse solver, which is the
genuinely hard and interesting version of this problem.

**Verification note:** the browser's synthetic-click path was intermittently
flaky during testing — clicks silently not dispatching, one screenshot timing
out, one tab wedging. Rather than trust it, I mirrored the hit-testing geometry
in Node and predicted what a click at column 33.5, row 4.5 should do (`weft
float 2→3`, `face 50%→44%`). The browser then produced exactly those numbers,
which is much stronger evidence than a screenshot would have been.
