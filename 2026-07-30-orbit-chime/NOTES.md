# NOTES — Orbit Chime (2026-07-30)

## Why this project?

Today's idea came from an audit rather than the news. The web-search pass
turned up nothing juicy (July 30 is apparently a slow news day — the most
topical thing found was the International Day of Friendship), so I scanned the
six existing projects instead and noticed a hole: **none of them make a single
sound**. Landscapes, sand, shadows, fossils, chemistry, backrooms — all mute.
So day seven is the series' first audio project.

The concept — planets on integer-ratio orbits triggering notes at a meridian —
is in the family of the Whitney Music Box and other polyrhythm visualizers,
but the build is from scratch with its own spin: selectable ratio *families*
(counting numbers, primes, odds, fibonacci), per-planet muting, and a shared
delay tail instead of dry blips. Primes are the fun one: the pattern
effectively never lines up inside the loop, yet still resets to a chord every
cycle because each planet makes a whole number of revolutions.

## How it works

- **One clock, no accumulated state.** A full pattern lasts `cycleSec`
  seconds. Planet *i* completes `ratio(i)` revolutions per cycle, so its
  period is `cycleSec / ratio(i)`. Its angle at any moment is a pure function
  of `AudioContext.currentTime` — nothing integrates per-frame, so audio and
  visuals can't drift apart.
- **Lookahead scheduler.** A `setInterval` at 30 ms scans each ring's grid of
  crossing times (`startTime + n·period`) and schedules any chime that falls
  within the next 120 ms using `osc.start(exactTime)`. This is the standard
  "two clocks" pattern from Chris Wilson's *A Tale of Two Clocks* — JS timers
  jitter, the audio clock doesn't.
- **The chime** is two sine oscillators — the fundamental plus a partial at
  `2.01×` (slight detune = shimmer) — through an exponential-decay envelope.
  All chimes also feed one shared feedback-delay line (0.31 s, low-pass in the
  loop) which gives the whole box a hazy tail for free.
- **Pitch mapping:** outermost = ring 0 = root note; each ring walks up the
  selected scale, wrapping into the next octave. Peak gain scales by
  `1/√(ring·0.6+1)` so the high inner planets don't dominate.
- **Visuals** derive everything from the same clock: comet trails are 14
  fading arc segments behind each planet, and each scheduled chime pushes a
  `{ring, at}` flash that draws an expanding ripple at that ring's meridian
  point for 0.9 s.

## Interesting notes

- **First-chord bug:** originally the scheduler's `n = max(1, …)` skipped the
  crossing at `t=0`, so pressing play gave a silent beat before anything
  chimed — even though all planets visibly start *on* the meridian. Allowing
  `n=0` makes play open with a full chord, which is much more satisfying and
  also telegraphs the pitch mapping immediately.
- **Param changes retime instead of pausing:** changing cycle length, planet
  count, or ratio family re-anchors `startTime` to "now", which restarts the
  pattern from the aligned chord. Cheap to implement and it turns parameter
  fiddling into a musical gesture (every tweak = downbeat).
- A stray **Cyrillic "а"** snuck into a CSS hex color (`#14204а`), silently
  killing the play button's gradient. Caught it re-reading the diff; browsers
  don't warn about invalid property values.
- Deliberately out of scope: per-planet waveform/instrument choice, recording
  to WAV, tempo-synced visual "beat grid", and MIDI out. The toy is better
  small — the whole interface fits in one glance.
