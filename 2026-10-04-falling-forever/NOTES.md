# Notes — falling forever

## Why this project

Today is 4 October: Sputnik 1, 69 years ago to the day. The gallery already
has plenty of space (Grand Tour, Luna 2, DART), but nothing about the one
thing every orbit shares: *falling*. The plan was to make the falling itself
the mechanic — Newton's cannonball from the *Principia* (the picture that
predicts Sputnik 270 years early) on one bench, and the beep everyone on
Earth actually heard on the other. The Doppler glide of that beep is the
rare physics constant that is both exactly computable and audible, so the
second bench could be honest to the hertz.

## How it works

**Cannon bench.** One law — a = −μ·r̂/r² — integrated with velocity-Verlet at
a step tied to the local curvature time (dt ∝ r/v, clamped 0.25–20 s), which
keeps energy drift invisible across every slider value. The trajectory is
only for drawing; the *verdict* is analytic: Kepler elements computed from
the exact launch state (energy → a, angular momentum → e), so "orbit ·
94.4 min, perigee 498 km" never inherits integrator error. Two facts fall
out that make the bench worth playing:

- Horizontal launch is always an apsis: below circular speed the launch point
  is your **apogee** (you dive from there); above it, the launch point is your
  **perigee**. So "did it hit?" reduces to *is 2a − r_launch below the
  ground?* — a cliff between 7.45 km/s (impact 15,300 km downrange, nearly
  halfway around the planet) and 7.50 km/s (orbit, perigee 95 km, 90.3-min
  lap).
- Downrange distance explodes near that cliff — the slow accumulation of
  "the ground curving away" is the whole show, so impacts are labelled with
  their downrange so the march is visible.

**Beep bench.** Sputnik's e = 0.052, so a circle at the mean radius is a
defensible stand-in. The pass model is deliberately 3D-lite: satellite on a
circle in the xy-plane, observer on the sphere at out-of-plane angle ψ. ψ = 0
is a zenith pass; bisecting ψ against peak elevation gives any pass geometry,
and elevation, azimuth, range, and radial velocity all fall out of the
vectors. The first version put the observer *in* the plane — where every
pass crosses the zenith and "peak elevation" is meaningless; the fix is the
only genuinely 3D thing in the file (a dozen lines).

Doppler: Δf = −f₀·v_r/c with f₀ = 20.005 MHz. An overhead pass swings
±463 Hz. The audio trick: mixing the carrier against a local oscillator to a
~940 Hz beat preserves the shift *in absolute Hz*, so the glide you hear is
physically the shift the radio waves carried — heterodyne honesty, not an
artistic exaggeration. The 13-second compression squashes the glide *rate*,
not its range, and the page says so.

## Interesting notes

- **Thermal drift dwarfed the Doppler.** Sputnik's transmitter wandered
  roughly ±0.7 kHz with hull temperature — bigger than the ±463 Hz glide.
  The toggle adds a two-sine stand-in and stretches the beep pauses (the
  real duty cycle drifted 0.3/0.3 s toward 0.3/0.9 s with temperature). The
  point the bench makes: the drift is noise in both directions, the Doppler
  is a one-way glide, and that asymmetry is how you tell them apart.
- **Kepler as a sanity oracle.** Debugging the downrange readout, the numbers
  argued back: an "apogee 36,508 km" that looked wrong was actually correct
  *altitude* against a mental *radius* — the elements module was right and
  the human wasn't. Test suite now pins that case (10.5 km/s → apogee
  > 20,000 km) so the oracle stays in the loop.
- **Zenith is a plotting singularity.** In azimuth/elevation coordinates an
  overhead pass smears into a flat line along el = 90° because azimuth swings
  −90° → +90° at the top. Paths now break when consecutive azimuth jumps
  exceed 0.35 rad, which reads as the pass "through" the zenith instead of
  along it.
- **Newton's mountain is our choice.** He never gave a height; 500 km makes
  the bench legible (visible curvature, circular speed a tidy 7.62 km/s) and
  the page says we chose it. Escape at that altitude is 10.77 km/s, which is
  why the ICBM preset (6.9) still impacts — a nice lie-that-tells-the-truth
  about how much speed a real booster gains lower down.
- The R-7 core stage orbited right behind the satellite and was naked-eye
  bright; the beep got the fame, the spent booster did the visible flyover.
- Beep cadence on screen (0.36 s) is slowed relative to the ×58 time
  compression — at true compressed cadence the beeps would be 5 ms ticks,
  inaudible. The pitch each beep carries is sampled from the real geometry
  at that instant, so nothing else about the sound is invented.
