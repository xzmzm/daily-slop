# ◍ Morphogen (2026-07-28)

An interactive **Gray–Scott reaction–diffusion** petri dish. Two virtual
chemicals — a *feed* and a self-catalysing *reactant* — diffuse across a grid at
different speeds. That single asymmetry is enough to spontaneously grow the
spots, stripes, mazes and coral fronds that Alan Turing predicted in 1952 as the
chemistry behind animal coat patterns.

**Drag on the dish to inoculate**, pick a recipe, nudge the `feed`/`kill` dials,
and watch the pattern reorganise itself in real time.

> *Built by Qwen3.8-Max-Preview.*
> Part of [daily-slop](../README.md) — one small original project a day.

## Stack

Vanilla **HTML / CSS / JS**, no framework, no build step, no backend, no
dependencies, no API keys. The whole simulation is a couple of `Float32Array`s
and a `requestAnimationFrame` loop. Open the file and it runs.

## How to run

```bash
open index.html          # macOS
# or double-click index.html
```

Or serve it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/
```

## How to use

- **Drag on the dish** — inoculate with the reactant; patterns bloom outward.
- **RECIPE** — curated `(feed, kill)` pairs: Corals, Mitosis, Labyrinth, Spots,
  Worms, Pulses. Each reseeds the dish.
- **feed / kill** — the two knobs that decide which pattern the system falls
  into. Tiny changes flip spots into stripes into chaos.
- **brush** — inoculation radius.
- **PALETTE** — Biolume / Ember / Ink / Bone colour ramps.
- **⏸ / ✦ Reseed / ✧ Clear** — pause, scatter fresh blobs, or wipe to empty.
- Keys: <kbd>Space</kbd> play · <kbd>R</kbd> reseed · <kbd>C</kbd> clear ·
  <kbd>N</kbd> next recipe.

## How it works

Each cell holds concentrations of two chemicals, `U` and `V`, updated with the
Gray–Scott equations (dt = 1):

```
U' = Du·∇²U − U·V²  + feed·(1 − U)
V' = Dv·∇²V + U·V²  − (kill + feed)·V
```

- `∇²` is a 3×3 Laplacian (orthogonal 0.2, diagonal 0.05, centre −1).
- `Du = 1.0`, `Dv = 0.5` — **V diffuses at half the rate of U**; that gap is the
  whole reason patterns form instead of smoothing to mud.
- Edges wrap (toroidal), buffers are ping-ponged, and 8 sim steps run per frame.
- Colour maps the contrast `U − V` through a 256-entry lookup table.

See [`NOTES.md`](./NOTES.md) for why this project, the dead ends, and the
constants that actually mattered.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup: petri-dish canvas + control panel |
| `style.css` | Dark bio-lab theme |
| `app.js` | Gray–Scott sim, palettes, painting, UI |
