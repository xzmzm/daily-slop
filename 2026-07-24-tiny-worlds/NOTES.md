# Tiny Worlds — build notes

*2026-07-24 · Built by GLM-5.2*

## Why this project?

Day one of the daily-slop playground needed to set the tone: something small,
self-contained, and *visual* — a toy you can share, not a utility you have to
explain. A **seeded procedural landscape** fits perfectly. The whole appeal is
"one short string → one entire tiny world," and because the same seed always
rebuilds the same scene, worlds become shareable via a URL.

It's also the right *kind* of first project: pure client-side, no backend, no
dependencies, no API keys — exactly the default the workspace calls for. A
generative-art canvas toy proves the "open `index.html` and it runs" promise
before anything fancier shows up on later days.

## How it works

Everything flows from one seed string, in [`app.js`](./app.js):

1. **Deterministic randomness.** The seed is hashed with **cyrb53** into a
   uint32, which seeds a **mulberry32** PRNG. A small `Rng` class wraps it with
   `range / int / pick / chance` helpers. Same seed → same stream of numbers →
   same world, every time and on every machine.
2. **A world is plain data.** `buildWorld(seed)` uses that PRNG to *choose*, not
   draw: a palette (dawn / day / dusk / night), a horizon line, the celestial
   body's position and size, two hill layers, clouds, stars, birds, an optional
   sailboat, and water ripples. The result is a description object — no canvas
   calls yet.
3. **Then it renders.** `renderWorld()` paints that object back-to-front: sky
   gradient → stars → sun/moon (with glow) → clouds → birds → hills → water →
   boat → vignette → film grain. Hills are **summed sines**
   (`baseY − sin(x·f₁+φ₁)·a₁ − sin(x·f₂+φ₂)·a₂`), which is enough to read as
   rolling terrain without any noise library.

The seed also carries through the URL hash (`#seed=…`), with `hashchange` wired
up so browser back/forward walks between worlds.

## Interesting notes

- **Separating "decide" from "draw" is the trick that makes it deterministic.**
  Because `buildWorld` consumes the PRNG in a fixed order and rendering is a pure
  function of the resulting object, reproducibility falls out for free. The
  gotcha: the *order* of PRNG calls is now load-bearing — reorder two `rng`
  reads and every existing shared seed renders a different world.
- **Sub-seeds keep incidental detail from corrupting the main stream.** Moon
  craters and the grain pass spin up their *own* PRNGs (`seed + "::moon"`,
  `seed + "::grain"`) instead of drawing from the main sequence. That way you can
  add or tweak grain later without shifting every downstream random draw and
  silently breaking old seeds.
- **The film-grain + vignette pass is doing a lot of cohesion work.** 3,500
  tiny semi-transparent black/white pixels plus a radial darkening tie the flat
  gradient shapes together into something that reads as a single photographed
  scene rather than stacked vector layers.
- **Palette is the mood.** All four "times of day" share the same geometry code;
  only the colour table and a `night` flag differ (night adds stars, hides
  birds, gives the moon craters). One data table, four distinct feelings.
- **Process:** built the GLM-5.2 way per the workspace workflow — a bit of web
  searching for direction, a couple of clarifying questions, a quick plan, then
  iterate-and-verify in the browser before shipping.
- **Left out of scope:** true value noise, parallax/animation, and mobile-canvas
  resizing. A fixed 960×540 canvas kept day one honest and simple.
