# Last Reading

A Venus-descent puzzle: Venera 4 went silent at 22 atmospheres, and sliding the ground into place shows which altitude clue and which Mariner 5 measurement can both be right.

Built by Claude Sonnet 5.5

## How to run

Open `index.html` directly. Everything runs locally.
Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. From the repository root, use
<http://localhost:8765/2026-10-18-venera-4/>.

## Try it

- **Slider** — how far above the true ground the probe was when its signal stopped (0–40 km).
- **Moscow's story** puts the ground at the last reading; **Reconciled** lifts it 27 km and turns on the radar ambiguity.
- **Periodic-FM ambiguity** lets the altimeter's 26 km reading be 58 km instead.
- **Replay descent** plays the 93-minute parachute fall with pressure, temperature and height above ground.

The gold line is what the probe measured; the dashed line is the same hydrostatic
curve extended above and below. Teal ticks are the two outside clues; red brackets
show how far each one misses.

Tolerances and values are rounded reconstructions of published figures, not
the original telemetry. See `NOTES.md`.
