# Twenty-Three Wide

Fifty-two years ago tonight the Arecibo dish beamed 1,679 bits at M13 — the
first deliberate interstellar message. 1,679 = 23 × 73, both prime: re-wrap
the tape and exactly one width draws a picture.

Built by GLM-5.3 Flash

## How to run

Open `index.html` directly. Everything runs locally.
Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. From the repository root, use
<http://localhost:8765/2026-11-16-twenty-three-wide/>.

## Try it

- **The feed** — the real 1,679 bits as beamed, broken every 73. Those line
  breaks are *not* the message; they are the other prime factor talking.
- **The width** — drag the slider or snap between 23 (the message, 73 rows)
  and 73 (the slab: same bits, unintelligible). Any other width runs ragged,
  because a semiprime has exactly two rectangles.
- **What it says** — the seven sections, top to bottom, with the standard
  colors (a modern courtesy; the beam carried no color). Click a section to
  isolate it and read the decode: numbers 1–10; H C N O P; the nucleotide
  formulas; 4,294,441,822 base pairs; a 1,764 mm human and 4,292,853,750 of
  us; the solar system with Earth lifted out of line; and Arecibo's
  306.18 m dish.
- **Paint your answer** — lift the pen and flip any bit at width 23. The
  rectangle survives every edit: cell count never changes, so the wrap never
  breaks. Restore the 1974 bits anytime.
- **Replay the broadcast** — transmit at ×1 / ×10 / ×100 with optional FSK
  blips (1 = 2,380.000010 MHz, 0 = 2,380.000000 MHz, dropped 3½ octaves for
  human ears), then follow the beam front past the Moon, Pluto's orbit and
  Voyager 1 — and skip 25,000 years ahead to M13, around year 26,974.

## What is real

- The grid carries the actual transmitted bit pattern (1,679 bits, 397 ones,
  73 rows × 23 columns), from the message published in *Icarus* (1975) and
  reproduced by Wikipedia.
- The decoded figures are read back out of the bits, not typed in: the
  base-pair count 4,294,441,822 (cols 10–11, rows 26–41, right column first),
  population 4,292,853,750 (rows 48–53, cols 17–22, LSB at upper left),
  height 14 × 126 mm = 1,764 mm (row 50, cols 2–5), dish 2,430 × 126 mm =
  306.18 m (rows 71–72, cols 7–12). The test suite re-decodes all four.
- Broadcast facts: November 16, 1974, at the telescope's rededication;
  2,380 MHz, ±10 Hz frequency-shift keying, 450 kW, 10 bits/s — 167.9 s of
  airtime, sent once toward M13 in Hercules, 25,000 light-years away.
- The section colors and highlight boxes are this page's annotation, not
  part of the signal.

## Verification

```sh
python3 test_browser.py
```

Requires Playwright and its Chromium for verification only.
