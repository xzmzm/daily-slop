# falling forever

An orbital bench for the night Sputnik 1 started the Space Age (4 October 1957,
69 years ago today): fire Newton's 1687 cannon until falling turns into an
orbit, then play a real 12-minute pass and hear the beep's Doppler glide.

Built by GLM-5.3

## What it is

Two benches on one page:

- **I · Newton's cannon** — a cannon on a 500 km mountain, a muzzle-speed
  slider from rifle bullet (1 km/s) past escape (10.77 km/s). Real
  inverse-square gravity, integrated live. Watch the impact point march a
  third of the way around the planet as you approach 7.5 km/s — then miss
  forever: between 7.45 and 7.5 km/s the verdict flips from *impact 15,000 km
  downrange* to *orbit, 90-minute lap*. Kepler elements for every shot come
  from the exact launch state, so the period/perigee labels are analytic.
- **II · The beep** — Sputnik's pass over your sky, compressed to 13 seconds.
  Slide the peak elevation from overhead to grazing, press play, and listen:
  the beat note glides from +463 Hz (approaching) through zero at closest
  approach to −463 Hz (receding). The carrier is mixed down to a ~940 Hz
  beat, so the Hz shift you hear is exactly the shift the 20.005 MHz radio
  waves carried. Flip on the 1957 condition and the transmitter's thermal
  drift (±0.7 kHz) washes over the glide — bigger than the Doppler itself,
  which is exactly why the one-way glide was the tell.

## How to run

No build, no dependencies:

```bash
open index.html          # or:
python3 -m http.server 8765   # then visit http://localhost:8765/2026-10-04-falling-forever/
```

Sound needs one click on **Play the pass** (browser autoplay rules); the
Doppler chart animates fine muted.

Physics checks: `node test.cjs`.

## The numbers behind it

| fact | value |
| --- | --- |
| launch, orbit | 4 Oct 1957, 19:28 UTC, from Tyuratam |
| spacecraft | 83.6 kg polished sphere, 58 cm, four whip antennas |
| orbit | 215 × 939 km, 96.2 min, inclined 65.1° |
| radio | 20.005 & 40.002 MHz, ~1 W, ~0.3 s beeps |
| silence | 26 Oct 1957 (batteries, after 22 days) |
| reentry | 4 Jan 1958 |

The Doppler swing for an overhead pass at 20.005 MHz is ±463 Hz — hams
measured the orbit from that glide, the idea that later became the TRANSIT
satellite-navigation system.

Simplifications are listed in the page footer (mountain height chosen by us,
near-circular orbit model, in-plane pass geometry, sine-wave stand-in for the
thermal drift).
