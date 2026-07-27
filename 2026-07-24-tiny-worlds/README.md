# 🌍 Tiny Worlds (2026-07-24)

A **seeded procedural landscape** generator. Each shuffle builds a unique tiny
world — sky gradient, sun or moon, layered hills, drifting clouds, water with a
celestial reflection, the occasional sailboat or gull — rendered to a `<canvas>`.

Every world is just a **seed** (a short string). The same seed always produces
the same world, so worlds are shareable: the URL carries `#seed=...`.

> *Built by GLM-5.2.*
> Part of [daily-slop](../README.md) — one small original project a day.

## Stack

Vanilla **HTML / CSS / JS**, no framework, no build step, no backend, no
dependencies, no API keys. Open it and it runs.

## How to run

Easiest — just open the file:

```bash
open index.html          # macOS
# or double-click index.html in your file manager
```

Or serve it (handy if you want the share-URL feature on `localhost`):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/
```

## How to use

- **🔀 Reshuffle** — generate a new random world (also bound to the `Space` key).
- **📋 Copy seed** — copy the current world's seed string.
- **🔗 Copy share URL** — copy a URL that recreates this exact world when opened.
- **Load** — paste any seed into the box to recreate that world.

## How it works

- A string seed is hashed ([cyrb53](https://github.com/bryc/code/blob/juggle-wip/HASHLOG.md#cyrb53))
  into a uint32, which seeds a **mulberry32** PRNG.
- That PRNG deterministically picks a **palette** (dawn / day / dusk / night),
  positions the celestial body, shapes the hills (summed sines), and scatters
  clouds, stars, birds, ripples, and an optional boat.
- Everything is drawn to a 960×540 canvas with gradients, silhouettes, and a
  subtle vignette + grain pass for cohesion.

See [`NOTES.md`](./NOTES.md) for why this project, the deterministic-seed
design, and the gotchas.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup: canvas + controls |
| `style.css` | Layout & theme |
| `app.js` | Seeded PRNG + procedural renderer |
