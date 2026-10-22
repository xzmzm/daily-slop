# Why this project?

October 23, 2026 is twenty-five years after the original iPod announcement. Today’s web scout turned up two strong date hooks: Mole Day and the iPod launch. A molecule-counting toy risked becoming a unit converter; a generic music-player recreation would mostly copy someone else’s interface. The useful question was smaller: why can a machine with a mechanical disk keep playing while that disk is stopped?

The launch announcement’s claim of up to twenty minutes of shock protection supplied a good scale for an experiment. Rather than recreate a scroll wheel, Spin Down exposes the path from disk to reserve to playback. The earlier RAMAC build explored disk addressing, and 44100 explored digital audio; this one is about scheduling a producer that can work in bursts ahead of a steady consumer.

Source: [Apple Presents iPod](https://www.apple.com/newsroom/2001/10/23Apple-Presents-iPod/), October 23, 2001. The launch and advertised protection are historical; the scheduler and timings below are intentionally invented.

# How it works

The buffer’s unit is seconds of playable music. Playback consumes one stored second each simulated second. The disk can produce forty. A continuous-read control holds two seconds, stays awake, and discards excess supply when full. The other player holds either 120 or 1,200 seconds. It sleeps until thirty seconds remain, or twelve with the small buffer, waits two seconds for spin-up, and reads until full.

The model advances in steps no larger than 0.05 seconds. Each step conserves playback: heard time plus silent time equals elapsed time. Reads supply new material, playback consumes what is available, and reserve is clamped between zero and capacity. A five-minute outage blocks the producer while consumption continues. A seek discards both reserves and starts a new disk spin-up. A long enough outage empties even the large reserve; memory delays a shortage rather than removing it.

Disk duty counts every awake second, including spin-up and waiting for blocked reads. Preloading is outside the measurement window, so a short initial run can truthfully show zero disk duty for the cached player. That number cannot be converted into battery life without power measurements for the rest of the machine. No energy numbers are invented here.

# Interesting notes

- The twenty-minute setting survives a five-minute outage with fifteen minutes left when the outage starts immediately. The two-minute setting gives three minutes of silence under the same conditions. That simple contrast is more useful than adding bitrate and byte-accounting controls.
- The skip button intentionally requests an uncached track. Ordinary sequential track boundaries could already be buffered; pretending every song change must empty memory would teach the wrong thing.
- Only the read-ahead player is audible, using a generated eight-note loop. Accelerating model time changes depletion speed, not the pitch of the tune. A silent output is gated with a short gain ramp to avoid clicks.
- The drives, memory cells, equalizers and chart are drawn with CSS and canvas. The model is independent of the DOM so long outages and twelve-hour conservation can be tested without waiting for an animation.
- The cursor in the video is parked during explanations. It moves on short eased curves only for actual controls. Model time is stepped explicitly for a reproducible capture.
- Video framing initially pushed the observation sentence under the subtitle band. Reducing the recording-only title, diagram and chart heights left a clear gap. Headless macOS also ignored keyboard changes in its native select popup; the capture uses Playwright’s select action after the visible click.
- Left out on purpose: real music uploads, a library browser, exact iPod electronics, and battery estimates. The interesting part fits in one path: read, store, play.
