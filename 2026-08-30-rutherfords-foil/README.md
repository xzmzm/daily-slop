# Rutherford's Foil

Built by GLM-5.3

A Rutherford-scattering studio for the **155th birthday of Ernest Rutherford**
(born **30 Aug 1871**, Brightwater, New Zealand) — the man who, forty years
later in Manchester, read the 1-in-8000 backscattering his students Geiger and
Marsden found in 1909 and concluded the atom is almost entirely empty, with
all its positive charge in a **nucleus** ~20,000× smaller than the atom
itself.

The whole lesson is closed forms:

1. **The hyperbola** — `b(θ) = (k/2E)·cot(θ/2)` with `k = 2Z·e²/4πε₀`:
   the deflection angle only ever looks at *half* the angle and the impact
   parameter; `b₉₀ = k/2E` is the 90° threshold, and the closest approach is
   `r_min = (d+√(d²+4b²))/2` with head-on `d = k/E` — verified against an RK4
   propagation of the α through the Coulomb field to 1e-4 degrees.
2. **The cosec⁴ law** — `dσ/dΩ = (k/4E)²/sin⁴(θ/2)`: counting at 150° is
   194× rarer than at 30° (exactly `(sin15°/sin75°)⁴`), and its integral above
   any angle is the closed form `σ(>θ₀) = π·b(θ₀)²` — checked by numeric
   quadrature to 1e-6.
3. **The 1-in-8000** — single scattering in a thin foil: `P(>90°) = n·t·π·b₉₀²`,
   exactly linear in thickness. Drag the gold leaf to **3.08 µm** at 7.69 MeV
   (the RaC′ line) and the famous 1909 reading falls out of the formula; the
   bench's 0.4 µm foil gives 1-in-61,600. The visible tracks and flashes are a
   sampled demo beam — the odometers integrate the exact formula and every
   backscatter flash is *earned* by an integer crossing.
4. **How big is the nucleus** — `d = k/E` shrinks as 1/E against the contact
   radius `R_c = 1.2(A^⅓ + 4^⅓)`: crossing `E_crit = k/R_c` (25.6 MeV for
   gold, 6.8 MeV for aluminium) means the α *touches* the nucleus and pure
   Rutherford physics ends; the border impact parameter `b_c = √(R_c²−R_c·d)`
   gives the departure angle θ_c — 56° for 40 MeV on gold, drawn as dashed
   "the formula no longer applies" track continuations.
5. **1919** — `¹⁴N + α → ¹⁷O + p`, the first man-made nuclear reaction:
   `Q = −1.192 MeV` from atomic masses, threshold `E_th = −Q(1+mα/mN) =
   1.53 MeV` — comfortably cleared by the 7.69 MeV line, which is why
   Rutherford saw protons flying farther than the alphas themselves.

Includes the 1909 bench (radium source, collimator, gold leaf, ZnS screen rim
with exact-law histogram, a ×10⁷ magnifier showing live hyperbolic tracks,
contact marks, and the 15-inch-shell quote on the first earned backscatter),
the scintillation-screen counter, four chart tabs (geometry / sin⁻⁴ / nuclear
size / history), the timeline from Brightwater to rutherfordium, four presets
(Manchester 1909 · 1-in-8000 · aluminium anomaly · accelerator era), and 17
exact-formula node tests.

## How to run

```bash
python3 -m http.server 8765        # from the repo root
```

then open <http://localhost:8765/2026-08-30-rutherfords-foil/>. No build step,
no dependencies. Run the exact-formula tests with:

```bash
node --test 2026-08-30-rutherfords-foil/test_physics.mjs
```

## Video

`video/rutherfords-foil.mp4` — the Chinese story video (1920×1080, burned-in
subtitles + `.srt`), narrated by Fish Audio's 哈基米 voice. Re-render from the
repo root:

```bash
python3 2026-08-30-rutherfords-foil/video/render_fish_video.py
```

(reads `FISH_AUDIO_API_KEY` from the workspace-root `.env`).
