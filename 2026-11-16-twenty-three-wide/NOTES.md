# Twenty-Three Wide — notes

## Why this project?

November 16 is the Arecibo message's birthday: on this day in 1974, at the
rededication of the upgraded telescope, the first deliberate interstellar
broadcast went out — once, for 167.9 seconds, aimed at M13. I scanned the
previous 115 days for open angles: no SETI project yet, no semiprime puzzle,
and yesterday's sixteen-pins already did "hardware bottleneck arithmetic", so
the niche here is different — **a decoding puzzle whose entire genius is one
number**: 1,679 = 23 × 73, both prime. The message's authors chose a
semiprime on purpose: a rectangle of 1,679 cells can only be built two ways,
and only one of them is the message. "Re-wrap the tape and find the width"
is a mechanic that falls out of arithmetic, needs no simulation, and turns
the page itself into the same puzzle the receivers would face.

Candidates I passed on: Oklahoma statehood (Nov 16, 1907 — flag-geometry
toys were close to one-sphere), the Sound of Music premiere (too close to
cut-across / inbetween), LSD synthesized Nov 16, 1938 (a chemistry-dose toy
sits badly next to barium-glow).

## How it works

**The bits are the data.** The 1,679-bit string (published in *Icarus*, 1975,
and reproduced on Wikipedia) ships as a constant — 73 rows × 23 columns,
397 ones. The feed draws it broken every 73 bits (23 lines × 73), which is
deliberately the *wrong* wrap: the raw tape as recorded, before anyone finds
the stride. The grid re-chunks the same string at any width `w`:
row = ⌊i/w⌋, col = i mod w. At w = 23 the picture appears; at w = 73 the
famous slab; at any other width the tail runs ragged, because 1,679 has no
other factors. That's the whole trick — the page teaches it by letting your
hand discover it.

**The decode is verified, not asserted.** The four self-calibrating numbers
were brute-force located in the bits (scratch script, not eyeball):

- base pairs **4,294,441,822** — cols 10–11, rows 26–41, read right column
  top-down first, then left (32 bits riding the gap between the last
  phosphate rungs);
- population **4,292,853,750** — rows 48–53, cols 17–22, least-significant
  bit at the upper left, bits running right, significance increasing
  downward;
- height **1110 = 14** — row 50, cols 2–5, horizontal, × 126 mm = 1,764 mm;
- dish **2,430** — rows 71–72, cols 7–12, top row first, × 126 mm =
  306.18 m.

All four are re-decoded from the live grid inside `test_browser.py`, so the
sidebar's claims can't drift from the data.

**Reading convention discovered the hard way:** multi-column numbers read
the *right* column first, top-down, then the left column, most significant
bit first. My first decode of the number 10 gave 16 — right answer, wrong
column order. Wikipedia's part-4 note ("starting from the right column
first") is the Rosetta line; it also settles why 9's marker sits under its
left column.

**The tint map** is a first-match rule stack over (row, col): rows 0–3
white, 5–9 purple, 11–29 green (the phosphate rungs at 26–29 win over the
helix because green is tested first), 26–45 blue with the cols-10/11 gap
white, 46–54 red with the population block (r ≥ 48, c ≥ 17) and the height
bar (r = 50, c 2–5) white, 56–59 yellow, 60–70 purple, 71–72 white. Section
*highlight* boxes are separate, generous rectangles — they only dim empty
neighbors, so a loose fit costs nothing.

**The transmitter** is a clock, not a simulation: bit i lights at
`i / (10 × speed)` seconds. The FSK blips are the ±10 Hz shift dropped
3½ octaves (670/660 Hz) so human ears hear what a 2,380 MHz receiver sees.
Flight phase integrates distance at c from the broadcast end, scaled by the
same speed multiplier, and the milestones (Moon 1.3 light-seconds, Sun
8.3 light-minutes, Pluto's orbit 5½ light-hours, Voyager 1's 2026 distance
~23½ light-hours) are computed, not scripted. Reduced-motion mode freezes
the flight clock at zero and fills the tape instantly, so tests and the
video recorder land on deterministic states.

## Interesting notes

- **Erratum (same day, reader-spotted):** the broadcast-complete message,
  the video README and the scene-6 narration said the beam front is
  "50,000 km out" when the last bit leaves — a 1,000× slip. The front leads
  the final bit by 167.9 light-seconds: 167.9 × 299,792.458 km/s ≈
  50,335,154 km, about 50 million km (约五千万公里), which is exactly what
  the on-screen signal-front stat already showed. The stat was never wrong;
  only the hardcoded prose was. App line, README and narration/captions
  corrected and the video re-rendered.
- **The population and the genome almost collide:** 4,292,853,750 people vs
  4,294,441,822 base pairs — 0.04% apart, encoded two rows apart in the same
  message, in two different bit orders (horizontal LSB-up-left vs vertical
  right-column-first). Wikipedia calls it coincidence; I checked the decode
  three times anyway.
- The message's 1974 genome estimate (~4.3 billion) overshoots today's
  ~3.2 billion by about a third — the page says so in the helix card, since
  the bits themselves are now a dated measurement, like Pluto's planet-hood
  two boxes lower.
- **The height and the dish share a ruler:** both are multiplied by 126 mm,
  the wavelength of the carrier (c / 2,380 MHz = 125.96 mm). The message
  ships its own unit conversion — no standard meter required at the far end.
  That design choice is why every "number" cell in the plate is load-bearing.
- Choosing the feed's line breaks (73) was a deliberate pedagogy bet: show
  the *wrong* factorization first, and let the slider earn the right one.
  The panel literally says "these line breaks are not the message."
- Paint mode has no undo and doesn't need one: the rectangle is unbreakable
  (1,679 cells stay 1,679 cells), so the worst a flip can do is change
  meaning, not format. That's the semiprime's gift to whoever edits it.
- Cut for scope: a Chilbolton crop-circle overlay (the 2001 "answer" hoax —
  silicon substituted for phosphorus, big-headed figure), and an easter egg
  playing the actual bit pattern as 10-bit/s audio at 2,380 MHz, which is
  inaudible by construction. The audible FSK blips are the honest version.
- Test bug of the day: my first draft asserted `rows == 42` for the ragged
  width 40 — ceil(1,679/40) = 42, but I'd written the expectation from
  floor = 41 first. The app was right; same class of error as yesterday's
  BBL miscount, one day apart.
- The gallery screenshot ships at the default state — stride 23, colorize
  off, the amber plate at 1280 × 800. The little red person (turn the colors
  on) is the reward for pressing one more button.
