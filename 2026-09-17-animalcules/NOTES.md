# NOTES — The Little Animals

## Why this project?

Today is the 343rd anniversary of microbiology's favourite letter: on 17 September 1683
Antonie van Leeuwenhoek wrote to Francis Aston at the Royal Society about what he found in
"the scurf of the teeth" — the first undisputed description of bacteria. The recent run of
daily builds had been aerospace (Luna 2), office machinery (Xerox 914, RAMAC) and computing
(PageRank, Kilby); optics plus biology was a genuinely new domain. And the physics turned
out to be irresistible: the instrument that made the discovery is a *single glass ball*,
whose entire imaging behaviour fits in three closed-form lines plus one honest trade-off
curve.

## How it works

**The ball lens.** For a sphere of diameter D and index n, the paraxial focal length
(measured from the centre) is f = nD/4(n−1); as a magnifier at the 250 mm near point it
gives M = 250/f. The tangent cone from an axial object sitting at the front focus has
sin u = R/f, and since f = nR/2(n−1) the R cancels: **NA = 2(n−1)/n depends only on the
glass**. For soda-lime (n = 1.52) that is 0.684, and the Abbe limit λ/2NA = 0.40 µm —
bacteria are right at the edge of what a bead of glass can ever show. The two identities
worth remembering: M·D = 1000(n−1)/n (small beads buy magnification), NA = R/f (index buys
resolution). The eye closes the design: a feature must subtend 1 arcminute, so the
magnification needed for detail d is M = 250 mm · 1′/d, and the largest bead whose
diffraction limit still clears the eye's bar is D = 1.89 mm at n = 1.52 — pinheads or
nothing.

**The colour trap.** A perfect sphere would be diffraction-limited; real glass disperses.
With Cauchy dispersion anchored to an Abbe V-number, blue and red focus Δf = (D/4)·|n_F/(n_F−1)
− n_C/(n_C−1)| apart — 11.9 µm for a 1.6 mm crown bead, thirty times the diffraction spot.
Stopped down to cone NA, the total blur is √[(λ/2NA)² + (Δf·NA)²], whose minimum is
closed-form: **NA\* = √(λ/2Δf), d_min = √(λΔf)** ≈ 2.6 µm for the default bead. The
surviving instruments measure 1–2.1 µm (van Zuylen 1981) — the model is conservative by
<2× (it charges the full axial colour at midpoint focus; the eye's spectral response and
off-axis viewing shave some of it). This machine is the honest heart of the page: the bead
was never diffraction-limited, it was colour-limited, and Leeuwenhoek found the sweet spot
empirically four decades before Dollond's achromat.

**The exact ray trace** (Machine I) refracts each ray with Snell's law at entry and exit —
no paraxial shortcut. Two facts fell out that I pinned as tests: near the axis the exit
angle grows as h³ (classic Seidel scaling — halve the height, eighth the aberration), and
a ray entering a sphere from air can *never* total-internally reflect on exit, because the
internal angle at the far surface always equals the refracted entry angle, which is
sub-critical by construction. Opening the pupil slider to the full 0.68 cone shows the real
reason his images were described as "a little thick": marginal rays leave at crazy angles.

**The plaque.** Machine III draws the three sorts he described at true µm scale and
convolves them with the bead's own blur (canvas `filter: blur`), so the resolution physics
and the biology meet in one picture: the pike (12 µm × 0.25 µm — an oral spirochete) is a
darting thread whose *width* never resolves at 1–2 µm, exactly matching his drawings of a
body that "bent into curves"; the 0.8 µm cocci sit below the measured floor, matching the
"exceeding small" third sort. Density: modern oral microbiology puts wet plaque at ~10¹¹
bacteria/gram, so his 1 mg scrape out-populated the Dutch Republic (~1.9 M in 1675) fifty
times over — the "unbelievably great company" line was, if anything, an understatement.

## Interesting notes / dead ends

- My first Cauchy anchor had a sign error (blue focusing long), which put Δf at 14.9 µm
  instead of 11.9; the flint-glass comparison in the tests caught it because the ratio
  refused to hit the pinned 1.48.
- The first ray-trace version used the outward normal at the exit surface, so every exit
  ray came out backwards (exit angle −3 rad for a paraxial ray). The fix — flip the normal
  to face the incoming ray — is now commented in `engine.js` as the load-bearing line.
- I initially wrote a "verdict on the width" only, which marked *everything* invisible at
  1.4 µm. Narrow-but-long creatures resolve along their length and vanish across their
  width; the readout now reports both ("seen" vs "shape resolved"), which is exactly the
  historical picture.
- Modelled, not documented: the 0.5 mm focus-screw pitch (a period-typical fine screw) and
  the quadrature blur model. Documented: everything else, including the letter's date,
  addressee, publication, the surviving instruments' 68×–275× and 1–2.1 µm (counts of
  survivors vary by source — Wikipedia says nine today), >500 lenses, ~560 letters, FRS
  February 1680, Peter the Great's 1697 boat visit, and Ford's 1981 strong-room find.
- The vinegar detail (wine vinegar stopped the swimmers) is reported by Ed Yong from the
  letter's text; the on-screen quotes are the Dobell/Berkeley wording of the batter, pike
  and top-spinner passages, checked verbatim.
- Deliberately out of scope: how he actually ground the beads (nobody knows — that's the
  charm), compound-microscope ray tracing, and any live-cell motility modelling beyond
  sinuous wiggle + tumble.
