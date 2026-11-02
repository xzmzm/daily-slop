# Cabin Heat

Sputnik 2 carried Laika into orbit on 3 November 1957; switch off its two faults and watch the cabin's heat balance decide whether she survives.

Built by Claude Opus 5.5

## How to run

Open `index.html` directly in a browser. Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. Everything runs on your own device.

## Try it

- **Core stage**: stayed attached (as flown) or separated (as designed).
- **Insulation**: torn (as flown) or intact.
- **Cooling fan**: running or off.

Press **Fly nine hours** or drag the scrubber. The scene shows sunlight or Earth's shadow and colours the cabin by temperature; the bars compare heat coming in with heat radiated away at that moment. The chart plots nine hours of cabin temperature against the 40 °C line, with the design case as a faint reference. The readouts give when the cabin passes 40 °C, its peak in nine hours, and where it would eventually settle.

Puzzle: which single fault, fixed on its own, would have kept the cabin under 40 °C?

This is a one-node teaching model with invented constants. It is **not** a reconstruction of the real spacecraft's thermal design or telemetry.

## Tests

From the repository root, run `python3 2026-11-03-cabin-heat/test_browser.py` (Python Playwright with Chromium).
