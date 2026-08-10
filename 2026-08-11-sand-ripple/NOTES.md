# sand-ripple — notes

## Why this project

Today is **Play In The Sand Day** (August 11), so sand was the obvious
material — but the *mechanism* had to be new. Scanning the existing days,
`2026-07-25-nodal-sand` already did acoustic (Chladni) sand: sand bouncing
on a vibrating plate and settling on the standing-wave nodes. That is a
completely different physics from the sand I actually care about, which is
the aeolian kind — the ripples you see on a dune at sunset. So the rule
"every day must be a different concept" was satisfiable with the same
substrate, as long as the engine was different.

The hook that won was the **bed instability** (Anderson 1987). The
counterintuitive fact is that the wind doesn't shape ripples — the *bed*
shapes itself. A saltating grain hits the sand and splashes out a few
"reptating" grains. On a flat sheet, nothing accumulates. But the tiniest
bump's windward slope catches more impacts per unit area (because the
saltators come in at angle α ≈ 11°, so slope enhances the impact rate by
cot α ≈ 5×), and those extra reptators hop a mean distance L downwind and
land just past the crest. The bump grows, and migrates. No wind feedback
required — it's a genuine linear instability of the bed itself. That
mechanism has a clean, famous, *verifiable* closed form, which is the
difference between a toy that looks right and one that is right.

The reason this beat the other candidates (a tidal-sand-ridge toy, a
sand-castle packing puzzle, a hourglass-grain-fall visualization) is that
Anderson's dispersion relation is a 1-D linear operator I can derive,
discretize, and assert against — exactly the shape of engine that's worked
well in prior days (`sky-sway`'s Den Hartog, `quarto`'s imposition math).

## How it works

### The engine

The whole project rests on five pure pieces in `engine.js`:

1. **The hop kernel.** Reptating grains hop a mean distance L downwind.
   I use a geometric pmf `p[r] = (1−q) q^{r−1}`, `q = (L−1)/L`, so the mean
   is *exactly* L (unlike a truncated exponential, whose mean depends on
   the truncation point — a bug I hit in the first draft). Its
   characteristic function `P̃(k) = Σ p[r] e^{−ikr}` is the exact discrete
   analogue of Anderson's continuum `1/(1+ikL)`.

2. **The saltation flux operator.** Cell `i` erodes at rate `C · s_i`
   where `s_i` is the local slope (the perturbation part — the constant
   flat-bed flux cancels with deposition on a periodic domain). The eroded
   grains redeposit downwind by the hop kernel:
   `dep_i = Σ_r p[r] · erosion_{i−r}`. Net `Δh_i = −erosion_i + dep_i`.
   Mass-conserving by construction (Σp[r] = 1, and the Laplacian telescopes).

3. **The linear multiplier.** For a Fourier mode `h ∝ e^{ikx}` this gives
   the per-step multiplier (one-line derivation: erosion is proportional to
   `i·sin k · h`, deposition multiplies by `P̃(k)`):
   ```
   M(k) = 1 + C · i sin k · [ P̃(k) − 1 ]  −  D · (2 − 2 cos k)
   ```
   In the continuum limit (`dx → 0`, `L → ∞` with `kL` fixed), `P̃ →
   1/(1+ikL)` and `2−2cos k → k²`, recovering Anderson's closed form:
   ```
   Re σ(k) = (C L k²) / (1 + (kL)²)  −  D k²
   ```
   The first term is the bed instability (positive ⇒ grows); the second is
   surface creep (always negative, dominates at large k). The maximum
   selects the wavelength you actually see emerge.

4. **Angle-of-repose avalanching.** Dry sand won't stand steeper than ~33°.
   I sweep cell-to-cell and push mass wherever `|Δh| > tan(repose)` in
   either direction. The first draft only pushed downwind, which left
   upwind-facing cliffs standing — a real bug caught by test [9].

5. **Surface creep (diffusion).** A discrete Laplacian with coefficient D.
   Physically this is the slow gravity-driven creep of grains on the
   surface; mathematically it is what stabilizes the shortest wavelengths
   and makes the bed pick a finite ripple spacing instead of just
   amplifying grid-scale noise.

### The numerics, and a units bug worth recording

The first draft divided every slope by `dx` (metres per cell), because I
wanted slopes in real-world rise/run. That made the dynamics explode:
`fluxStep` returned `1e+88` within 50 steps. The fix was to realize that
*all* of the dynamics lives naturally in cell units (height in grain
layers, distance in cells, k in rad/cell), and `dx` should be display
metadata only — never entering the time evolution. Once the engine was
dimensionless, mass conservation held to `1e-15` and the linear multiplier
matched simulated growth to `1e-14`.

The other nontrivial tuning was the **default C and D**. With `C = 0.55,
D = 0.06` (my first guess), the selected λ_fast came out at ~5.7 cells —
barely more than L, which is unphysical (real aeolian ripples are ~6L to
~30L). Raising D to 0.20 and dropping C to 0.35 pushed λ_fast to ~16 cells
(≈ 4L), in much better agreement with Anderson's prediction and with
observed desert ripples.

### The renderer

Three stacked canvases: a static desert-sky backdrop (gradient + low sun +
wind streaks), the bed profile (filled with a sand-toned gradient, lee
slopes shaded darker, crest highlighted), and a layer of saltating grains
flying overhead in shallow parabolic arcs. The bed is vertically
auto-scaled so the relief always fills a comfortable band — early on, when
ripples are sub-millimetre, you still see them; later, when they've
coarsened, the scale relaxes. The right panel plots Re σ(k) vs wavelength
with the unstable (red) and stable (green) regions filled and the
fastest-growing λ marked.

## Interesting notes

- **Linear vs. nonlinear wavelength.** This was the subtlest point. The
  linearly fastest-growing wavelength (λ_fast ≈ 16 cells ≈ 4L) is *not*
  the wavelength you end up with. Migrating ripples **coarsen**: smaller
  ripples travel faster, catch up to larger ones, and merge. Over ~6000
  steps the crest count dropped from ~49 to ~11, and the observed
  wavelength grew to ~5× λ_fast. My first end-to-end test asserted
  λ_obs ≈ λ_fast within 50%, which failed — correctly! — because the
  engine was telling the truth about a real physical effect (Yizhaq et
  al. 2012, Prigent et al.). The test now asserts λ_obs > λ_fast and
  λ_obs/L ∈ [8, 35], which matches field observations.

- **The continuum test is delicate.** Asserting the discrete σ(k) matches
  Anderson's continuum closed form requires `k → 0` (so the continuum
  approximation holds) AND `L → ∞` (so the geometric CF converges to
  1/(1+ikL)). I scan L = 8, 16, 32, 64 cells at fixed `kL = 1`, and the
  absolute error shrinks monotonically — exactly what a convergent limit
  should look like.

- **The "drop" button is a demo of the instability.** Drop a Gaussian
  pile on a flat bed and it doesn't just spread under diffusion — it
  turns into a migrating ripple, because the pile's windward face catches
  more saltation impacts and feeds the lee. This is the cleanest way to
  *see* the bed instability at work: the pile is the initial condition,
  the saltation does the rest.

- **Left deliberately out of scope:** 3-D bedforms (these are 1-D
  ripples), grain-size sorting (real ripples have a coarse crest and fine
  trough — "inverse grading" — which needs a second species of grain),
  and the transverse-dune / megaripple transition at high wind. Each
  would be a project of its own; the point of today was the linear
  instability, cleanly derived and cleanly visualized.

- **The spectrum panel is computed, not measured.** The red/green curve
  is Anderson's `Re σ(k)` evaluated analytically from the current dial
  settings — not a DFT of the bed. So it tells you what *should* be
  growing given the parameters, independent of what the (nonlinear,
  coarsened) bed happens to look like right now. Watching the curve
  reshape as you drag C, L, D is half the fun.
