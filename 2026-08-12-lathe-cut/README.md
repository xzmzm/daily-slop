# lathe-cut — analog disc-cutting studio

Built by GLM-5.2

A studio for **Vinyl Record Day** (August 12) that cuts an audio waveform
into a spinning lacquer and plays it back. The central idea: **the groove
*is* the waveform.** One cycle of a sound occupies exactly the arc the
needle travels in `1/f` seconds, so the wavelength laid into the lacquer is

```
λ = 2π · r · (rpm / 60) / f
```

Pick a **timbre** (sine / triangle / saw / square) and how many **wiggles
per revolution** the stylus engraves, cut the spiral, then drop the needle
anywhere on the disc to play it back through your monitor speaker. As the
head feeds inward the resolution ceiling collapses — the whole "inner-groove
problem" in one retreating bar.

The right panel shows the live numbers (linear velocity, λ for A440,
grooves/inch, side time), the hero `λ` identity evaluated at the outer, mid
and inner groove, the cutter-resolution ceiling, and the **RIAA playback
curve** (three time constants: 3180 / 318 / 75 µs).

> The canvas is an honest **schematic**: a real LP groove is sub-millimetre
> pitch and you cannot see individual turns, so it draws a legible ~6–40
> turns and says so. The waveform it draws is exact — each visible turn
> carries precisely `gpr` lateral wiggles, and `f = gpr · rpm/60`, so what
> you see is what is encoded. The physics readouts use the real pitch.

## How to run

No build step, no dependencies:

```bash
open index.html
```

or

```bash
python3 -m http.server 8765        # from this folder (or the repo root)
```

then open <http://localhost:8765/2026-08-12-lathe-cut/>. (Port 8000 is
reserved on this machine — use 8765 or any other free port.)

## Controls

- **⌖ cut** (or `Space`) — engrave the lacquer; the head feeds inward in
  real time at the chosen rpm.
- **⤓ drop needle** (or `n`), or click anywhere on the groove band — plays
  the cut program back through Web Audio; the needle drifts inward.
- **reset** (or `r`).
- **play backwards** — backmask: spin and traverse in reverse.
- Sliders: wiggles/revolution (the recorded frequency), groove pitch (real
  mm → grooves/inch), stylus excursion (display amplitude).
- 33⅓ / 45 rpm toggle.

## Tests

```bash
node test_engine.js        # 63 assertions: λ identity, spiral geometry,
                           # wiggles↔frequency equivalence, RIAA landmarks,
                           # cutter ceiling, arc length, end-to-end side
```
