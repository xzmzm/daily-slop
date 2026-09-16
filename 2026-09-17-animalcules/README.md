# The Little Animals — 17 September 1683

A studio for the 343rd anniversary of the first description of bacteria: on 17 September 1683
the Delft draper Antony van Leeuwenhoek scraped the batter-thick film off his own teeth,
looked at it through a bead of glass he had ground himself, and wrote to the Royal Society
about animalcules "very prettily a-moving". Four closed-form machines run the optics, the
resolution limit and the plaque itself.

Built by GLM-5.3

## How to run

No build step, no dependencies:

```bash
python3 -m http.server 8765     # from the repository root
```

then open <http://localhost:8765/2026-09-17-animalcules/> — or just open `index.html`
directly. Run the physics assertions with `node test_animalcules.mjs` (73 exact-formula
checks).

## The four machines

1. **A bead of glass** — the whole microscope: a 1–2 mm ball lens between brass plates, the
   specimen on a pin at the front focus, a screw for focusing. The ray fan is traced exactly
   (Snell's law twice per ray), and the algebra collapses to three lines: f = nD/4(n−1),
   M = 250 mm/f, and a numerical aperture NA = 2(n−1)/n with no D in it — diameter buys
   magnification, index buys resolution. The bead must stay pinhead-sized or its own
   diffraction limit falls below the eye's 1-arcminute bar: at n = 1.52 nothing bigger than
   1.89 mm qualifies.
2. **The colour trap** — why the best lenses of the age stopped at 1–2 µm instead of
   diffraction's promised 0.4 µm: dispersion puts blue and red 11.9 µm apart, the smear grows
   with the accepted cone while diffraction shrinks with it, and minimising the quadrature
   sum has a closed form, NA* = √(λ/2Δf), d_min = √(λΔf) ≈ 2.6 µm — within a factor of two
   of the 1–2.1 µm measured on the surviving instruments. Swap in flint glass and watch the
   floor drop.
3. **The scurf of the teeth** — the letter of 17 September 1683, live: the plaque ecosystem
   at true µm scale, every creature blurred by the machine's own resolution, which is exactly
   why the pike (12 µm long, 0.25 µm thick) was a darting thread that never resolved and the
   "exceeding small" third sort barely showed as dots. Sample the old man who never cleaned
   his teeth, drop the wine vinegar as he did, and count the company: at 10¹¹ bacteria per
   gram of wet plaque, one milligram out-populates the Dutch Republic fifty times over.
4. **From Delft to the strong room** — drag the resolution floor from Hooke's compound to
   the electron microscope and watch each creature come into view, with the timeline from
   the 1676 pepper-water letter through Pasteur, Koch, Ruska and Brian Ford's 1981 discovery
   of Leeuwenhoek's original specimen packets in the Royal Society's strong room.

## Files

- `engine.js` — all closed-form optics and documented anchors (pure functions)
- `app.js` — the four animated machines
- `test_animalcules.mjs` — 73 exact-formula assertions pinning the numbers
- `video/` — the Chinese narration video (Fish Audio) and its renderer
