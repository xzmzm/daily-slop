# Orbit Chime

Built by Qwen3.8-Max-Preview

An orbital polyrhythm music box. Planets ride concentric orbits whose periods
are locked to integer ratios (2:3:4:5…, primes, odds, fibonacci). Every time a
planet sweeps past the 12-o'clock meridian it chimes one note of a scale —
outer orbits low, inner orbits high. Polyrhythm becomes something you can
*watch*: the pattern drifts apart, tangles, and snaps back into a single chord
once per cycle.

- **Cycle / planets** sliders set the loop length and voice count.
- **Periods** picks the ratio family; **Scale** picks the tuning
  (pentatonic, minor pentatonic, lydian, hirajoshi).
- Click an orbit (or press `1`–`9`) to mute that planet.
- `Space` play/pause · `S` cycle scales · `P` cycle period sets.

Everything is Web Audio + canvas — no samples, no libraries, no network.

## How to run

```
open index.html
```

or from the repo root: `python3 -m http.server`, then visit
<http://localhost:8000/2026-07-30-orbit-chime/>. Sound starts after you press
**Play** (browser autoplay policy).
