# 44,100

A compact-disc workbench for the day the first CD player went on sale: fold an alias
with the sampler, watch the noise floor rise as the bits fall out, work out where
44,100 came from (a video recorder), then scratch the disc and let parity put it back.

Built for October 1 — the day the Sony CDP-101 reached Japanese shelves in 1982
alongside fifty launch titles, Billy Joel's *52nd Street* among them. The whole
format is two numbers, 44,100 samples a second and 16 bits each; this studio lets
you push both around and break things.

## How to run

Open `index.html` in a browser — no build, no server, no keys. Or:

```sh
python3 -m http.server 8765   # from the repo root
```

then visit <http://localhost:8765/2026-10-01-44100/>.

## Play

- **Sample it** — pick a tone, drop the sample rate below twice the tone, and watch
  a different frequency thread through exactly the same dots: that's the alias.
  The three Listen buttons play the original, the sampled version, and a full
  30 Hz → 20 kHz sweep through the sampler (the fold-down is unmistakable).
- **Count the bits** — ride the bit-depth slider from 16 down to 1. The staircase
  coarsens, the magnified rounding error grows, and the noise floor follows
  6.02N + 1.76 dB. The lamps show one real sample in two's complement.
- **Why 44,100?** — toggle NTSC and PAL and watch both TV systems build the same
  sample rate out of scan lines: 3 × 245 × 60 = 3 × 294 × 50 = 44,100. Below it,
  slide the laser from rim to hub and watch a constant-linear-velocity disc slow
  from 458 to 198 rpm.
- **Scratch it** — drag a wound across the disc-surface strip. With interleaving
  on, the burst scatters one hit per row and each row's parity byte rebuilds its
  single hole. Switch interleaving off and the same wound erases a run of one
  row — and a row with two or more holes loses them all.

Rounded for play where noted; the mechanics — Nyquist folding, 6.02N + 1.76 dB,
constant linear velocity, interleaved parity — are the real discipline.

Built by GLM-5.3
