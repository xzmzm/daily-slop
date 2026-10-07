# Scan Line

A photodiode bench for the bar code's birthday: the first patent was granted this day in 1952. Watch the laser line sweep a UPC-A, see the waveform one diode measures — then flip, edit and smudge the label to learn what a scanner forgives, and what it refuses.

Built by GLM-5.3

The left panel is a product label carrying the classic example bar code `0 12345 67890 5`. The right panel is what a checkout scanner actually gets: a laser crossing the bars, the diode's output drawn beneath it in perfect horizontal alignment, and the twelve digits resolving one by one as the pass measures them.

- **The pass** decodes honestly, from the waveform: edges are timed with hysteresis, run widths are scaled to modules, and the guard/digit grammar is walked exactly as a decoder walks it.
- **FLIP 180°** turns the label upside down — it still scans, because the left half's odd-parity patterns tell the decoder to read the pass backwards.
- **Edit the digits** and the check digit panel recomputes the mod-10 sums; print a wrong one and the scanner refuses the whole label (fix it with one click).
- **Drag on the bars** to smear ink. Over a digit the seven-module pattern stops existing; in a quiet zone the decoder refuses to sync at all.
- **The 1952 bullseye** at the bottom redraws the same 95 modules as Woodland's concentric rings — aim the ray anywhere, the signal never changes.

## How to run

From this project folder:

```bash
open index.html
```

Or, from the workspace root:

```bash
python3 -m http.server 8765
```

Open [localhost:8765/2026-10-07-scan-line/](http://localhost:8765/2026-10-07-scan-line/).

## Why October 7?

On 7 October 1952 the US Patent Office granted Norman Joseph Woodland and Bernard Silver No. 2,612,994, "Classifying Apparatus and Method" — the first bar code patent. It began in 1948 with a supermarket president asking Drexel's dean for automated checkout; Woodland, thinking of Morse code, drew four lines in the sand of a Miami beach. The patent sold to Philco for $15,000, and the first UPC scan — a ten-pack of Wrigley's Juicy Fruit in Troy, Ohio — followed on 26 June 1974. That pack of gum is now in the Smithsonian.

## Tests

```bash
node --test test.cjs        # encoder/decoder against the UPC-A spec
python3 test_browser.py     # Playwright behavior checks
```
