# sand-ripple

Built by GLM-5.2

**中文视频（Fish Audio 哈基米）：** [sand-ripple-zh-fish.mp4](./video/sand-ripple-zh-fish.mp4) · [字幕文件](./video/sand-ripple-zh-fish.srt)

An **aeolian bed-instability studio** for Play In The Sand Day (August 11).

Here is the one thing about sand ripples that surprises everyone: the wind
does not sculpt them. The bed sculpts itself. A saltating grain strikes a
flat sheet of sand and splashes out a few short hops worth of "reptating"
grains — and nothing much happens. But give that sheet the tiniest bump, and
the bump's windward slope starts catching *more* impacts per unit area than
the flat ground around it (because the saltators descend at a shallow angle
α ≈ 11°). Those extra reptators hop a mean distance L downwind and land just
past the crest. The bump grows, migrates, and the flat bed turns into a field
of ripples — with no feedback from the wind at all. This is the **bed
instability** first derived by Anderson in 1987.

sand-ripple makes the invisible physics tangible. Watch a noise-seeded sheet
self-organize into migrating ripples, read the live linear growth-rate
spectrum σ(k) that selects the wavelength, turn the dials (wind strength,
hop length, surface creep, angle of repose), and drop a pile of sand and
watch it become a ripple.

## What you can do

- **Watch ripples grow** — the bed starts as imperceptible noise. The
  bed instability amplifies the fastest-growing Fourier mode until crests
  become visible, then migrate downwind and coarsen by merging.
- **Read the growth-rate spectrum** — a live plot of Re σ(k) vs wavelength.
  Where σ > 0 (red) the flat bed is unstable; where σ < 0 (green) surface
  creep damps it. The black triangle marks the fastest-growing λ.
- **Turn the dials** — wind strength C, reptation hop L, surface creep D,
  and angle of repose. Each reshapes the spectrum and the bed in real time.
- **Drop a pile** — hit **⛰️ drop** (or press space) to dump a Gaussian
  pile of sand and watch it relax into a migrating ripple.
- **Try presets** — gentle breeze, Sahara noon, sandstorm, fine powder,
  coarse grit.

## How to run

No build step, no dependencies:

```
python3 -m http.server 8765
```

then open <http://localhost:8765/2026-08-11-sand-ripple/>.

(Any free port works — just avoid 8000, which is reserved on this machine.)

## The math

For a Fourier bed mode `h ∝ e^{ikx}`, the discrete saltation step multiplies
it by the complex per-step multiplier:

```
M(k) = 1 + C · i sin k · [ P̃(k) − 1 ]  −  D · (2 − 2 cos k)
```

where `P̃(k) = Σ_r p[r] e^{−ikr}` is the characteristic function of the
reptation hop kernel (geometric, mean L) and `2 − 2 cos k` is the discrete
Laplacian eigenvalue. In the continuum limit `P̃ → 1/(1+ikL)`, giving
Anderson's 1987 growth rate:

```
Re σ(k) = (C L k²) / (1 + (kL)²)  −  D k²
```

The first term is the **bed instability** (slope-enhanced erosion +
downwind redeposition); the second is surface creep, which stabilizes the
shortest wavelengths and selects the observed ripple spacing.

## Verification

The engine is asserted in Node against mass conservation, the closed-form
linear multiplier's match to simulated single-mode growth, Anderson's
continuum closed form in the L → ∞ limit, the diffusion damping of short
wavelengths, the angle-of-repose avalanche invariant, and end-to-end
noise → ripple formation with the correct coarsening. Run it with:

```
node test_engine.js
```
