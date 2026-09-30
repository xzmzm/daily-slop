# Notes — 44,100

## Why this project

October 1, 1982 is the day the compact disc became a product: Sony's CDP-101 went
on sale in Tokyo (¥168,000) alongside fifty CBS/Sony launch titles, the first being
Billy Joel's *52nd Street*. The date was too good to pass up, and the subject was a
deliberate bookend — the gallery already has the lathe-cut studio (August 12) for the
*analog* disc, so this is its digital successor. It also finally gives the audio
bench an information-theory day: earlier audio projects were about modulation (WEAF),
grooves (lathe-cut) and reflections (echo-room), never about sampling itself.

The runner-up candidates were Concorde's first Mach 1 (also October 1, 1969) and the
Model T's announcement (October 1, 1908). Concorde would have been aviation the day
after the 747 freighter; the Model T's learning curve was tempting but is really an
economics chart wearing a lab coat. The CD won on interactivity: aliasing is a thing
you can *hear* fold down in real time.

## How it works

**The alias fold.** Sampling a tone of frequency *f* at rate *fs* and replaying
through an ideal low-pass at *fs*/2 yields exactly one frequency in [0, *fs*/2]:
`|f − round(f/fs)·fs|`. The canvas draws the true wave, the sample-and-hold
staircase, and — when aliasing — the reconstructed wave, which threads through the
same sample dots as the original. That's the whole scandal of aliasing in one
picture: both curves fit the data perfectly; only one exists below Nyquist. The
time window is 10 periods of the tone, so a dense 44.1 kHz grid collapses into
faint amber bars (that density *is* the CD's point) while low rates show individual
dots.

**The audio is real, not narrated.** "Play through the sampler" fills a Web Audio
buffer by evaluating the sine only on the *fs* grid and linearly interpolating
between grid points on replay — the fold happens at sampling time, and any replay
filter can only low-pass at the device Nyquist, which the folded alias is safely
below. The sweep uses an exponential chirp (30 Hz → 20 kHz over 3 s) with linear
phase interpolation on the same grid: as the chirp climbs past *fs*/2 the pitch
visibly turns around and dives.

**The noise floor.** Uniform quantization of a full-scale sine leaves an error
signal with signal-to-noise ratio 6.02N + 1.76 dB: 98.08 dB at 16 bits, 25.84 dB
at 4 bits, 7.78 dB at 1. The error strip below the wave is that difference,
magnified ×2^(8−N) so shallow depths stay visible. A pleasant quirk surfaced in
the lamp row: 1-bit two's complement has the codes {0, −1} — a mid-tread quantizer
whose "positive half" is a single step, so +0.6 rounds to code 0.

**Why 44,100.** Early PCM adapters (Sony PCM-1600 era) stored stereo audio on video
tape machines by riding samples on scan lines. NTSC 525/60 has 245 usable lines per
field and 60 fields/s; PAL 625/50 has 294 and 50. With 3 samples per line both
products land on 3 × 245 × 60 = 3 × 294 × 50 = 44,100 — the only rate both worlds
could record. The ear's requirement was merely "comfortably above 40 kHz" (20 kHz
audio plus a guard band for the reconstruction filter's skirt); the VTR decided the
rest, and the menu option has outlived the machine by forty years. The field
diagram draws the actual line counts (262 and 313 total, blanking dimmed).

**The disc.** Constant linear velocity at 1.2 m/s means spin *ω = v/(2πr)*: 458 rpm
at the 25 mm inner edge, 198 rpm at 58 mm. The spiral is (58−25) mm ÷ 1.6 µm =
20,625 turns ≈ 5.4 km of track. The 780 nm laser through a 0.45-NA lens gives a
~1.7 µm spot — wider than the 0.5 µm pits — so the readout is interference, not a
needle. The canvas spins at 1/24 speed because 458 rpm at full speed would strobe.

**The scratch.** A toy of CIRC, the CD's Cross-Interleaved Reed–Solomon Code. Eight
rows of nine bytes, each with one XOR parity byte. Interleaving writes the disc in
column-major order, so a horizontal burst on the surface becomes one erasure per
row; XOR parity rebuilds exactly one erasure per row (erasure decoding — the
position is known from the wound, which is why one parity byte suffices). Kill the
interleave and the same burst erases eight cells of one row — and erasure decoding
is all-or-nothing, so with two unknowns and one equation the row loses every wounded
byte, not all-but-one. The real thing interleaves two Reed–Solomon layers across 108
frames and repairs gouges up to ~3,874 channel bits — about 2.5 mm of track —
without a click.

## Interesting notes

- The bit lamps were backwards for twenty minutes: the row is MSB-first, so a
  4-bit sample's live lamps are the *rightmost four*, and I had initially dimmed
  `i >= bits` — killing exactly the lamps that held the data. The browser test
  caught it (`lamp.on` count was 0 at 4 bits), which is the whole argument for
  testing the paint, not just the math.
- The window trick (10 periods of the tone) keeps the demo legible at every sample
  rate: when aliasing, the dot count is 10·fs/f < 20 by definition — aliasing is
  *always* sparse on this canvas, clean sampling is *always* dense. The visual
  density switch is the lesson.
- 44,100 × 2 × 16 = 1,411,200 bits/s. The disc's channel rate is 4.3218 Mbit/s —
  the difference is EFM (8 data bits → 14 channel bits + 3 merging), CIRC parity,
  subcode and sync. Every 16-bit sample costs 48 channel bits by the time it's a
  pit.
- DSD on SACD is 2.8224 MHz = 64 × 44,100 — the CD rate even seeded its successor.
- The 74-minute legend (Norio Ohga, opera singer, Beethoven's ninth, Bayreuth 1951)
  is told with a straight face in the history section but flagged as a legend in
  the copy; the well-sourced part is Philips wanting 11.5 cm/60 min and losing.
- The CDP-101 itself had one DAC time-multiplexed across both channels, leaving an
  ~11 µs inter-channel offset — an early-adopter artifact deliberately left out of
  the app; some jokes only land in the notes.
- Deliberately out of scope: oversampling filters, dither, and delta-sigma DACs.
  Dither would deserve its own studio someday — the noise-floor station is exactly
  one panel short of it.
