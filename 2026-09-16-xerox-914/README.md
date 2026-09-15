# The Scorch Machine — Xerox 914

A studio for the 67th anniversary of the first plain-paper copy: on 16 September 1959, at the
Sherry-Netherland Hotel in New York, Haloid-Xerox demonstrated the Model 914 on live television —
and one of the two machines caught fire. Four closed-form machines run the actual physics and
economics of the copier that turned a nickel a page into an empire.

Built by GLM-5.3

## How to run

No build step, no dependencies:

```bash
python3 -m http.server 8765     # from the repository root
```

then open <http://localhost:8765/2026-09-16-xerox-914/> — or just open `index.html` directly.
Run the physics assertions with `node test_xerox.mjs` (81 exact-formula checks).

## The four machines

1. **650 pounds of dry lightning** — the 914 end to end: lamp slit-scanning the platen, a
   selenium drum turning one revolution per copy through charge → expose → cascade develop →
   transfer → fuse → clean, live station voltages, and a scorch gauge that reproduces the
   documented fire habit (feed it the payroll page of zeros and O's; Xerox shipped an
   extinguisher with each machine, informally the *scorch eliminator*).
2. **Charge it with lightning, then let light erase** — Peek's-law corona onset around a thin
   wire, the selenium layer as a capacitor (124 pF/cm²), dark decay with τ = ρε, and a
   photodischarge curve where every absorbed photon neutralises exactly one unit of charge
   (312 V per erg/cm² of blue light at η = 1). Push the wavelength past 610 nm and selenium
   goes blind — red light is dark to it.
3. **Beads, dust, and the release threshold** — triboelectric toner on glass beads, the
   image-force adhesion that grows with toner radius, and neutralisation development
   M/A = ε₀E/(q/m) ≈ 0.51 mg/cm², ending in coverage, print density and about 1.74 million
   toner particles per cm². Starve the exposure and the copy fogs grey; overcharge the toner
   and it comes out white.
4. **The nickel machine** — the $95/month lease (2,000 copies included, then ~4¢) against the
   35¢ Photostat, 15¢ Verifax and 7.5¢ Thermofax, with break-evens computed live, plus the
   mimeograph that the 914 never beat on pennies — it beat the stencil. With the
   Astoria-to-verb timeline from Carlson's 1938 handkerchief experiment to 95 % of the market.

## Files

- `engine.js` — all closed-form physics and documented anchors (pure functions)
- `app.js` — the four animated machines
- `test_xerox.mjs` — 81 exact-formula assertions pinning the numbers
- `video/` — the Chinese narration video (Fish Audio) and its renderer
