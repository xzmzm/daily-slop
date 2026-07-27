# Nodal Sand — build notes

*2026-07-25 · Built by Grok 4.5*

## Why this project?

Day two, and the one hard rule is *be different from yesterday*. Day one
(`tiny-worlds`) was a **static, seeded** generative landscape — you press
shuffle and get a still image. So the deliberate pivot here was toward
**live, continuous motion and real physics**: a Chladni plate, where thousands
of sand grains crawl across a vibrating surface and settle into the standing-wave
patterns Ernst Chladni first drew with a violin bow. Same "small visual toy"
spirit, completely different mechanism — simulation instead of illustration,
with optional sound on top.

It's the same vanilla, self-contained stack (no framework, no deps, no keys),
which kept it a genuine one-hour build rather than a physics-lab project.

## How it works

The whole thing lives in [`app.js`](./app.js) — ~10,000 particles in flat
`Float32Array` position/velocity buffers, stepped every frame:

1. **The standing wave.** For a square membrane the amplitude at any point is
   `A(x,y) = sin(nπx/W)·sin(mπy/H)`. The **nodal lines** are where `A = 0` — the
   grid of quiet lines that the mode numbers `(n, m)` carve up.
2. **The migration trick.** Each frame, every grain gets a random-direction kick
   whose strength is proportional to `A²` (amplitude squared). Loud antinodes
   thrash grains around violently; near the nodes `A → 0` so they barely move.
   Friction (`damping`) then bleeds off velocity, so grains statistically drift
   *out* of the noisy regions and **pool on the quiet nodal lines**. It's not a
   true PDE solve — it's a cheap, convincing stand-in that produces the right
   figures.
3. **Rendering.** Walls bounce grains back with energy loss; the plate is drawn
   as gold 1.2px specks over a tinted `|A|` backdrop with a vignette and rim.
4. **Sound (optional).** A single Web Audio sine at `f = 55·√(n²+m²)` Hz — the
   ideal-membrane frequency relation — lazily created on first click (browsers
   require a user gesture to start audio).

## Interesting notes

- **Caching the backdrop was a deliberate optimization.** The `|A|` field tint,
  vignette, rim, and nodal guide-lines are expensive per-pixel work, but they
  only change when `(n, m)` change. So they're rendered once to an **offscreen
  canvas** and blitted with a single `drawImage` each frame; only the 10k moving
  grains are redrawn. A `fieldDirty` flag triggers a rebuild when a slider moves.
  Without this, 60fps with 10k particles wasn't happening.
- **`A²`, not `|A|`, is what makes the lines sharp.** Squaring the amplitude
  sharpens the contrast between antinodes and nodes, so grains evacuate the loud
  zones decisively instead of milling around — the figures snap into focus much
  faster.
- **Frequency is real, the particle motion is faked — and that's the right
  call.** The `√(n²+m²)` tone is physically honest, but simulating actual plate
  eigenmodes was out of scope for an hour. The kick-by-`A²` heuristic looks
  correct and runs cheap, which is the better trade for a toy.
- **Verified by serving, not just linting.** `node --check app.js` for syntax,
  then `python3 -m http.server` to confirm it loads and runs cleanly (the server
  command ran long and got parked in the background — exit 143 is just the kill
  signal when it was stopped, not a failure).
- **Left out of scope:** rectangular/circular plates with non-integer modes,
  true FEM eigenmodes, and particle-count controls. Fixed square membrane,
  fixed 10k grains — enough to tell the story.
