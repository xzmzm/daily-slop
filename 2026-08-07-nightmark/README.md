# nightmark

Built by GLM-5.2

A **lighthouse light-characteristic builder** for National Lighthouse Day
(August 7). Every lighthouse has a coded flash signature — its *nightmark* —
charted in [IALA notation](https://en.wikipedia.org/wiki/Light_characteristic),
like `Fl(2) W 6s` or `Mo(A) W 6s`. The rhythm, color, and cycle length together
let a sailor read a beacon out of the dark and know exactly which one it is.

Here you can build any characteristic from its parts, watch the lamp flash in
real time over a night sea, and then flip to **Quiz** mode and try to read the
flashes back into notation yourself.

## What you can do

- **Build a characteristic** — pick the rhythm (F / Fl / Oc / Iso / Q / Mo),
  group size, color, and period. The canvas, the timeline strip, and the
  charted notation string all update live.
- **Load a real lighthouse** — eight verified presets straight from the USCG
  Light List, including Portland Head (`Fl W 4s`), Bodie Island (`Fl(2) W 30s`),
  and the famous Minot's Ledge "I-Love-You" light (`1-4-3`).
- **Read the timeline** — a horizontal strip showing exactly when the lamp is
  lit (bright) and dark across one full cycle, with a moving playhead.
- **Take the quiz** — a hidden characteristic flashes; pick the correct
  notation from four choices. Score is kept across rounds.

## How to run

No build step, no dependencies:

```
python3 -m http.server 8765
```

then open <http://localhost:8765/2026-08-07-nightmark/>.

(Any free port works — just avoid 8000, which is reserved on this machine.)

## The six rhythms

| Notation | Name | What it looks like |
| --- | --- | --- |
| `F` | Fixed | A steady, always-on light. |
| `Fl` | Flashing | Brief flashes; dark longer than lit. `Fl(3)` = groups of three. |
| `Oc` | Occulting | Mostly on, briefly blinking *off* (an eclipse). |
| `Iso` | Isophase | Equal light and dark — on half, off half. |
| `Q` | Quick flashing | Continuous rapid flashes (~one per half-second). |
| `Mo` | Morse code | Flashes spelling a Morse letter, e.g. `Mo(A)` = ·−. |

## Verification

The flash engine is asserted in Node against hand-computed expectations —
every preset's timeline sums to its period, every notation string matches, and
`isLitAt(t)` is checked across all six rhythm types. Run it with:

```
node test_engine.js
```
