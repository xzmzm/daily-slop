# flash-spectrum

A flash-spectroscopy studio for Helium Discovery Day (18 August 1868): the day
Pierre Janssen, watching the total eclipse at Guntur, India, met a yellow line
at 587.6 nm that matched no element on Earth — helium, the first element
discovered in the sky, 27 years before anyone held it in a jar.

Built by GLM-5.3

## What it is

The Moon is a coronagraph. Scrub the totality clock and the Sun's spectrum
flips before your eyes: the partial phase is Kirchhoff's law 3 (dark Fraunhofer
absorption lines on a bright continuum); the moment the last sliver of
photosphere dies, the same thin hot chromosphere flips into law 2 and its
lines **flash out bright on black** — the flash spectrum Janssen saw. Drag the
crosshair along the eyepiece (±20 nm zoom under a whole-window finder band):
hydrogen, sodium, magnesium and calcium announce themselves from the 1868
catalogue, but one bright yellow line beside the sodium D doublet — **D₃,
587.56 nm** — matches nothing. Claim it and the verdict tells the real story:
Lockyer and Frankland named it *helium* after the Greek sun, and Ramsay only
found it on Earth (in a uranium ore, by matching that same line) in 1895.

Then open the epilogue: **1869, the corona's green line** at 530.3 nm —
history's trap. The observers who fell for it coined *coronium*; the truth
(Edlén, 1942) is a forbidden transition of thirteen-times-ionized iron, and
the million-degree corona it revealed. One mystery line paid out an element;
the other paid out a thermometer.

## How to run

No build, no dependencies:

```
open index.html
```

or serve the repo root and visit the folder:

```
python3 -m http.server 8765     # then http://localhost:8765/2026-08-18-flash-spectrum/
```

Run the deterministic engine tests with plain node:

```
node test_engine.js             # 207 assertions
```

## Notes

Wavelengths are real (D₃ 587.56 nm, green coronal line 530.29 nm, Fraunhofer
letters at their true positions). Line widths, the flash's timing drama, and
the corona's drawn brightness are stretched so a screen can show them — the
honest numbers are in [`NOTES.md`](./NOTES.md).
