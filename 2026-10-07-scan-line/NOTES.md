# Notes — Scan Line

## Why this project?

The date did the picking: US Patent 2,612,994, "Classifying Apparatus and
Method" — the first bar code patent — was granted to Woodland and Silver on
**7 October 1952**, exactly 74 years ago today. The runner-up candidates for
the day were Luna 3's far-side photos (also 7 October, 1959) and KLM's
founding (1919), but the week had already been space-heavy (Sputnik on the
4th, 51 Pegasi b on the 6th), and the patent has the better story: a
supermarket executive, two Drexel students, Morse code drawn in Miami beach
sand, a bullseye that lost to a straight line.

The angle came from the observation that everything about bar codes in
popular culture is about the *picture* of the bars. But a laser scanner never
sees a picture — it sees one photodiode's brightness over time. Making that
the centerpiece (label strip on top, the diode's waveform directly beneath,
same x-axis) was the whole design.

## How it works

`core.js` is a complete, testable UPC-A codec:

- **Encode**: 12 digits → 95 modules. `101` guard, six 7-module odd-parity
  L patterns, `01010` centre guard, six 7-module even-parity R patterns
  (exact complements of L), `101` end guard. Check digit = `(10 − (3·odd + even) mod 10) mod 10`.
- **Sample**: `reflectance(x)` is diode output at a display-space coordinate.
  Edges are softened with a two-tap box filter (±0.30 module), which is what
  makes waveforms look like a real front-end instead of a square wave.
  Smudges are dark overlays in printed space; the `flipped` flag maps display
  to printed coordinates.
- **Threshold**: a Schmitt trigger — dark below 0.4, light again above 0.6.
  A plain 0.5 threshold chatters on every noise wiggle while the edge ramps
  through mid-scale (the first version produced 329 "runs" for a 40-edge
  code; hysteresis gives 40).
- **Scale**: the cheapest real-decoder trick — the narrowest run anywhere is
  one module, so divide every run by the minimum and round.
- **Parse**: walk the grammar (quiet ≥ 9, guard, 6×L, centre, 6×R, guard,
  quiet ≥ 9). If the forward walk fails, reverse the run list and walk
  again; success that way means the label was upside down, and the L/R
  parity split is precisely what makes that safe. A reversed-R pattern is
  provably in neither table, so direction detection can't misfire.
- **Check**: the parsed twelfth digit must equal the recomputed one, or the
  pass is refused with both numbers shown.

The live sweep decodes from *partial* runs each frame: `decodePartial`
drops the run still under the laser, so a digit appears only after the beam
has crossed one run past its last module. Reversed labels can't resolve
incrementally — the reversal needs the whole pass — so upside-down labels
show no digits until the sweep completes and then pop all twelve at once,
which is honest and, conveniently, a good visual lesson.

The 1952 bullseye reuses the same 95 modules as rings (innermost = first
guard bar). A ray from the centre crosses ring *r* at any angle, so the
sampled waveform is literally the same code path — the "same at every
angle" readout is not staged.

## Interesting notes

- **The mirror mode that couldn't exist.** The plan had three tamper modes:
  flip (accepted), mirror (rejected), smudge (rejected). Then came the
  realisation: for a single scan line, a horizontal mirror and a 180°
  rotation are *the same transform* — both just reverse the module order.
  A 1-D scanner physically cannot tell them apart, and both decode. That's
  not a bug in the sim; it's the parity design doing its job. The mode was
  cut, and this note is its headstone.
- **Two quiet bugs in the grammar walk.** The first draft checked the centre
  guard after *both* halves (the end guard never arrived); the second left a
  duplicate end-guard check after the loop, so every valid code died with
  "NO GUARD FOUND" *after* all twelve digits had decoded. The debug session
  where the parse reported `digits: [0,1,2,3,4,5,6,7,8,9,0,5], reason: NO
  GUARD FOUND` was a genuinely confusing two minutes.
- **Quiet zone strictness.** `MIN_QUIET` started at 4 modules ("tolerant
  demo decoder"). That let a smudge eat four of the nine leading quiet
  modules and still sync, failing later as a confusing NO GUARD. Requiring
  the full nominal quiet zone is both closer to real decoders (they use it
  as their reference level) and gives smudges the crisp rejection they
  deserve.
- **Determinism everywhere.** Waveform noise is a mulberry32 PRNG seeded by
  sweep index, so tests assert exact decodes and the video renders
  identically every time.
- The label sells "STONE-GROUND OAT CRACKERS", $3.29 — the workspace is
  called daily slop; the label may as well advertise the pantry.
- Tuning constants that mattered: edge softening 0.30 module (below 0.2 the
  hysteresis delay skews run widths; above 0.4 adjacent 1-module bars
  blur), noise amplitude 0.07 (up to ~0.09 still decodes), sweep 2.2 s
  normal / 5.4 s slow (slow is the teaching speed).
