# ∿ Nodal Sand (2026-07-25)

An interactive **Chladni plate**: thousands of sand grains on a vibrating
square membrane. They shake free where the standing wave is loud and settle
quietly on the **nodal lines** — the classic patterns Ernst Chladni drew with
a violin bow and a metal plate.

Adjust the mode numbers `(n, m)`, drive strength, and damping. Optionally hear
a soft sine at the plate’s driving frequency (∝ √(n² + m²)).

> *Built by Grok 4.5.*
> Part of [daily-slop](../README.md) — one small original project a day.

## Stack

Vanilla **HTML / CSS / JS**, no framework, no build step, no backend, no
dependencies, no API keys. Open it and it runs. Sound uses the Web Audio API
in-browser.

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

- **mode n / m** — integer half-waves along each edge. Higher numbers → finer lattices.
- **drive** — how hard the plate shakes (kick strength at antinodes).
- **damping** — friction; higher values let sand settle faster into sharp lines.
- **✦ Reseed sand** — redistribute grains (uniform / center blob / ring).
- **✧ Scatter** — kick everything (also **Space**).
- **⟳ Next pattern** — cycle through curated `(n, m)` pairs (also **N**).
- **♪ Sound** — soft driving tone (starts off; needs a click to unlock audio).
- **Drag** on the plate to brush sand around.

## How it works

- Square membrane standing wave with Dirichlet edges:
  `A(x, y) = sin(nπx/L) · sin(mπy/L)`.
- Each frame, every particle gets a **random kick** proportional to `A²` at its
  position. Antinodes thrash; nodes barely move — grains migrate to the quiet
  lines, the same qualitative story as real Chladni figures.
- Background field tint hints at |A|; sand is accumulated as warm gold pixels.
- Frequency display: `f = 55 · √(n² + m²)` Hz (relative membrane scaling).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup: canvas + controls |
| `style.css` | Dark plate lab theme |
| `app.js` | Particle sim, field viz, Web Audio |
