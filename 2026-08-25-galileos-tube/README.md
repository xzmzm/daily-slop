# Perspicillum — Galileo's tube, ray-traced

**Built by Ox Alpha**

417 years ago today — the morning of **25 August 1609** — Galileo Galilei
climbed St Mark's bell tower and showed the Venetian Senate incoming ships
hours before any naked eye could swear to them. His salary was doubled and
his chair at Padua made lifelong. This is his telescope as a live optical
bench: two thin lenses, ray-traced in paraxial first-order optics.

- **Optical bench** — parallel bundles enter the objective, converge toward
  the common focal plane, and leave the *concave* ocular parallel again but
  at M× the angle. Drag the eyepiece off the common focus and watch the exit
  beams stop being parallel. Toggle chromatic aberration and blue focuses
  measurably short of red (Cauchy crown-glass dispersion).
- **The whole lesson, in closed form** — M = f_obj/|f_eye|, tube length
  L = f_obj + f_eye (shorter than the objective's focus — that's the
  Galilean trick), exit pupil D_x = D_obj/M, and the exit pupil's position
  z = L·f_eye/f_obj: *negative*, i.e. a virtual pupil trapped inside the
  tube, which is why the true field squeezes to ~14 arc-minutes.
- **What he saw** — three targets in the eyepiece view, naked eye vs tube:
  the **Campanile demo** (ships, detection thresholds, horizon geometry and
  the ~3 h sighting lead at 4 knots), the **Medicean stars** (four moons on
  their real 1.77/3.55/7.15/16.69-day periods; slide to Jan 7 and the ×33
  tube shows exactly the three starlets east of Jupiter that he sketched),
  and **Venus phases** (k = (1+cos ψ)/2 from circular orbits anchored at
  inferior conjunction — gibbous is impossible if Venus orbits the Earth).
- **Kepler mode** — flip the ocular convex: real exit pupil, wider field,
  upside-down image. Presets: Padua ×9, Sidereus Nuncius ×20, Medici ×33.

Physics: thin-lens refraction `θ ← θ − y/f` with paraxial transfer,
ABCD-matrix imaging for the exit pupil, Cauchy `n(λ) = A + B/λ²` for
dispersion, mean-motion circular orbits for the 1610 sky. The numeric
field-of-view sweep (ray clipping) matches the closed-form lever-arm law
`α½ = atan[(r_pupil − D_exit/2)/(L + ℓ·M)]` — see `test_physics.mjs`.

## How to run

```
open index.html
```

or

```
python3 -m http.server 8765      # from the repo root
# → http://localhost:8765/2026-08-25-galileos-tube/
```

Tests: `node --test test_physics.mjs` (13 tests: Cauchy reference values,
trace-vs-matrix identities, upright/inverted exit slopes, aperture clipping,
numeric-vs-closed-form field of view, moon periods, Venus phase anchors).

## The history

Galileo heard of the Dutch spyglass in May 1609, built his own from a
three-power toy to an eight-power instrument in weeks, and demonstrated it
to the Senate from St Mark's Campanile on 25 August 1609. The gift bought
him financial freedom; what he did next bought him immortality. By January
1610 he had turned a lagoon spyglass on the sky — *Sidereus Nuncius*
(March 1610) announced lunar mountains and four Jovian "planets"; by
December 1610 the phases of Venus had cracked the Ptolemaic system open.
He called the gadget a *perspicillum*. The two surviving instruments are in
Museo Galileo, Florence — the leather-bound ×14 and the ×20 with its broken
objective.
