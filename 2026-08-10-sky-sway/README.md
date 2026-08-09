# sky-sway

Built by GLM-5.2

**中文视频（Fish Audio 哈基米）：** [sky-sway-zh-fish.mp4](./video/sky-sway-zh-fish.mp4) · [字幕文件](./video/sky-sway-zh-fish.srt)

A **tuned-mass-damper studio** for Skyscraper Appreciation Day (August 10).

Here is the one thing about tall buildings that surprises everyone: a
skyscraper is a giant tuning fork. Wind shakes it near its natural frequency,
and at the top of an 80-floor tower that sway can easily reach tens of
centimeters — enough to make the top floors seasick. The trick that tames it
is a **tuned mass damper (TMD)**: a colossal pendulum or sliding block near
the top, tuned so it resonates *out of phase* with the building and bleeds
energy off. Taipei 101 hangs a **728-ton steel sphere** for exactly this
purpose; you can walk up and look at it.

sky-sway makes the invisible physics tangible. Watch a tower sway under wind,
toggle the damper on and off and see the sway explode, read the live
frequency-response curve, and turn the dials (mass ratio, tuning, damping)
yourself — or hit **auto-tune** and let Den Hartog's 1928 formulas find the
optimum.

## What you can do

- **Watch it sway** — the tower bends in its first cantilever mode under
  harmonic wind forcing, the amber damper sphere swings against it out of
  phase. Hit **💨 gust** (or press space) to kick it.
- **Toggle the damper** — flip it off and watch the top-floor sway climb to
  the bare resonance 1/(2ξ₁). Flip it back on and the TMD splits that one
  tall peak into two short ones.
- **Read the response curve** — a live plot of dynamic amplification |H|
  vs. forcing frequency, with the bare-tower curve (red), the with-TMD
  curve (green), and the Den Hartog minimized-peak height √(1+2/μ) (dashed).
- **Tune it yourself** — drag μ, f, ξ₂ and watch the green curve's two peaks
  grow apart and go unequal. Then hit **auto-tune** to snap them back to
  Den Hartog's equal-height optimum.
- **Try real buildings** — presets for Taipei 101, Shanghai Tower, a thin
  steel tower, and a stubby concrete block.

## How to run

No build step, no dependencies:

```
python3 -m http.server 8765
```

then open <http://localhost:8765/2026-08-10-sky-sway/>.

(Any free port works — just avoid 8000, which is reserved on this machine.)

## The math

For a damper of mass *m* hung off a structure of mass *M*, with mass ratio
**μ = m/M**, Den Hartog's 1928 optimum (the H∞-minimizing tuning for an
undamped primary under harmonic forcing) is:

```
f_opt  = 1 / (1 + μ)                  ← damper frequency  ω₂/ω₁
ξ_opt  = √( 3μ / [8 (1+μ)³] )         ← damper damping ratio
|H|max = √( 1 + 2/μ )                 ← the minimized peak height
```

At this tuning the structure's displacement transfer function develops **two
peaks of exactly equal height** — the famous "equal peaks" invariant. That
flattening of the resonance is the whole reason a 728-ton pendulum hangs
inside Taipei 101.

## Verification

The engine is asserted in Node against Den Hartog's closed forms, the
equal-peaks invariant (at its stated condition of an undamped primary), the
no-damper (μ→0) collapse to the SDOF transfer function, the minimized-peak
height √(1+2/μ), and RK4 energy conservation / exponential decay. Run it with:

```
node test_engine.js
```
