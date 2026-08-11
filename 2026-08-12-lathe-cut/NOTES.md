# lathe-cut — notes

## Why this project

Today is **Vinyl Record Day** (August 12), one of three observances sharing
the date (the others are World Elephant Day and International Youth Day).
Vinyl won because it has a single, beautiful, *mechanical* fact at its
centre that I'd never built a toy around: **the groove is the waveform.**
There is no sampling, no digits — the lateral bumpiness of a single
continuous spiral groove, traced by a needle, *is* the sound. Everything
else (the inner-groove problem, RIAA equalization, why 12 inches and 33⅓
rpm) falls out of that one idea.

Scanning the existing days, nothing touched analog recording.
`orbit-chime` was orbital-resonance polyrhythm (rhythm, not waveforms),
`nodal-sand` was a vibrating plate. The record lathe was wide open, and it
carries the same flavour of engine that has worked well here: a clean,
famous, *verifiable* closed form (here, `λ = 2πr·(rpm/60)/f`) that I can
derive, discretize, and assert against.

## How it works

### The hero identity

The whole project rests on one line. The needle at radius `r` on a disc
spinning at `rpm` has linear velocity `v = 2πr·(rpm/60)` (mm/s). One cycle
of an audio frequency `f` lasts `1/f` seconds, during which the needle
travels `v/f` millimetres. That distance is the **wavelength** engraved
into the lacquer:

```
λ(r, f) = 2π · r · (rpm / 60) / f
```

Because `λ` is proportional to `r`, it *shrinks toward the label*. At the
outer groove of a 33⅓ rpm 12-inch record (r = 146 mm) a 1 kHz tone occupies
0.51 mm of groove; at the inner groove (r = 70 mm) the same tone occupies
0.24 mm. Keep going — a 25 kHz overtone needs 0.020 mm at the outer edge
(just resolvable by a real ~25 µm cutter tip) but at the inner groove the
ceiling is ~9.8 kHz and the top of the audible band is simply
unrecordable. That is the **inner-groove problem**, and it is the entire
reason an LP's treble audibly degrades in its last minutes. The cutter-bar
in the UI draws this as a retreating "treble headroom" gauge as the stylus
moves inward.

### Wiggles ↔ frequency

The directly observable feature of a groove is how many wiggles fit in one
revolution — call it `gpr`. One revolution takes `60/rpm` seconds, so the
real audio frequency is

```
f = gpr · (rpm / 60)
```

and a real A440 on a 33⅓ rpm side is **exactly 792 wiggles per revolution**
(440 × 1.8). That number is invisible to the eye (you cannot resolve 792
wiggles around one circle), so the canvas is an honest **schematic**: it
draws a legible ~6–40 turns and a `gpr` you choose from 2 to 64, each turn
carrying exactly that many wiggles of the chosen timbre. The algebraic
identity `2πr/gpr = 2πr·(rpm/60)/(gpr·rpm/60)` guarantees that the visible
wavelength and the physical wavelength agree exactly — the test suite
asserts this across a sweep of `gpr` and `r`, which is the difference
between a toy that looks right and one that *is* right.

### The spiral

The groove is an Archimedean spiral `r(θ) = rOuter − (pitch/2π)·θ`, where
`pitch` is the centre-to-centre spacing between adjacent turns (the
"lines per inch" figure on a sleeve is `25.4/pitch`). From that:
- turns = `(rOuter − rInner)/pitch`,
- side time = `turns/rpm` minutes (a 0.16 mm pitch over the 76 mm band at
  33⅓ rpm is ~14.3 min — a short LP side),
- total groove length = `∫₀^θf r(θ)dθ`, the closed form
  `rOuter·θf − (pitch/2π)·θf²/2`, which a 200 000-step Riemann sum
  confirms to 1e-10 (the needle travels ~320 m on a side — hundreds of
  metres of groove on one disc).

### RIAA equalization

Bass makes a wide, lateral groove that would eat the pitch and make the
needle jump; treble makes a tiny groove that would sink below the surface
noise. So cutting **pre-emphasizes** the signal (boost highs, cut lows) and
playback **de-emphasizes** with the exact inverse — the famous RIAA curve,
three time constants: `τ0 = 3180 µs` (50.05 Hz pole), `τ1 = 318 µs`
(500.5 Hz zero), `τ2 = 75 µs` (2122 Hz pole):

```
H(s) = (1 + s·τ1) / [ (1 + s·τ0)(1 + s·τ2) ]
```

normalized to 0 dB at 1 kHz. The UI plots this curve with its landmark
values (100 Hz ≈ +13.1 dB, 10 kHz ≈ −13.7 dB, 20 kHz ≈ −19.6 dB) — I had
the 20 kHz landmark wrong at first (−19.27) and the test caught it: the
pure-three-time-constant value is **−19.62 dB**, the −19.27 you see in
some tables comes from a different reference/IEC amendment. Trust the
math, not the memory.

## Interesting notes

- **The "two wavelengths" coincidence.** The wiggle wavelength
  `2πr/gpr` and the arc-velocity wavelength `2πr·(rpm/60)/f` look like
  different computations but are the *same line* once `f = gpr·rpm/60`.
  Making that equivalence a tested invariant was the cleanest way to keep
  the schematic honest: the picture can be enlarged for legibility without
  lying about the physics, because the relationship `gpr ↔ f` is exact.
- **Float32 bit me.** `waveformTable` returns a `Float32Array` (Web Audio
  wants Float32), so the "table equals point samples" assertion failed at
  1e-12; the values agree to ~7 digits, which is the float32 precision.
  Relaxed to 1e-6.
- **Schematic vs. real pitch.** Early versions tied the visible turn count
  to the real pitch (0.08–0.40 mm), which drew 200–950 turns — an
  illegible grey smear. The fix is a fixed visual band of 6–40 turns that
  scales *opposite* to pitch (denser real pitch → a few more visible
  turns), with an explicit "schematic" disclaimer. The KPIs (grooves/in,
  side time, total turns) use the real pitch, so the numbers stay honest.
- **Geometry drift bug.** The first version drew the spiral from the
  *disc edge* (152.4 mm) to the *label*, so the cutting-head readout
  drifted to 46 mm (inside the real 70 mm runout) and the inner-groove
  ceiling was off. Fixed by making the spiral and the head both span the
  real modulated band (146.05 → 70.0 mm); now the stylus radius reads
  correctly throughout the cut and the resolution ceiling is exact.
- **Audio honesty.** A `gpr` of 24 at 33⅓ rpm is a 13.3 Hz tone —
  sub-audible. The monitor speaker shifts the fundamental up by octaves
  until it's audible (≥ 70 Hz) and says so on the panel, rather than
  silently lying about the pitch. The shape (timbre) is always truthful.
- **Backmasking** is just reversing the spin and the traversal direction.
  No hidden messages were encoded in the making of this toy.
- Ideas deliberately left out of scope: stereo 45/45 groove walls (two
  modulations at ±45°), variable-pitch cutting (the lathe squeezing turns
  tighter during quiet passages), and a real-time RIAA pre-emphasis on
  the *cut* side. Each would roughly double the engine; all are natural
  follow-ups.
