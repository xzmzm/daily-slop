# NOTES — Barium Glow

## Why this project?

The calendar did it again: **8 November 1895** is the night Röntgen noticed the glow — a barium platinocyanide screen flickering two metres from a Crookes tube he had covered in black cardboard so its light wouldn't leak. He spent the following weeks eating and sleeping in the lab, taking the famous hand radiograph on 22 December, and naming the mystery "X". Radiology's international day is today because of that evening. A darkened-room toy was irresistible: the app *is* the discovery beat (cover on, screen still glowing) followed by the occupation Röntgen founded (make a readable plate).

I checked the other candidates before committing: muon tomography already had its day on 2 November (through-stone — find a void in stone), and a security-scanner idea felt derivative of it. The distinguishing move here is that nothing is hidden: the paperclip and the nail are secrets, but the game is **technique** — voltage against dose against contrast, judged the way a radiographer judges a film.

## How it works

- **Attenuation.** `muAt(material, kVp)` returns a hand-set linear attenuation coefficient at 60 keV, stretched in energy: `μ60 · (w·(60/E)³ + (1−w)·(60/E)^0.35)`. The first term is photoelectric absorption (grows with Z, dies with E³); the second is a Compton floor that barely moves. Transmission is `exp(−Σ μᵢ·tᵢ)` per plate pixel over the object's thickness maps.
- **Tube output.** Photon flux at the plate scales with `(kVp/60)²` — the classic square law for bremsstrahlung output at fixed current. This is what couples the two dials: soft rays are cheap in voltage but starve the plate.
- **Grain.** Each plate pixel samples a Poisson count: Knuth's algorithm below 20 expected photons, a normal approximation above. Film density is `0.96·(1−e^(−n/140)) + 0.045` base fog, so the image darkens into place and noise melts as mA·s accumulate. Watching the hand condense out of snow is the payoff moment.
- **Grading.** The verdict uses expectation values only (deterministic, unit-testable): the subject's mean photon count must land in a window (fog below 60, black above 2000), and the shadow contrast `ln(T_major/T_minor)` must clear 0.32. Because exposure and contrast are judged separately, low-kVp images can legitimately pass — if you pay forty mA·s for them — which the verdict says out loud with a dose-cost sentence.
- **The discovery beat.** The cardboard cover only changes room light, never the beam: the barium screen (and its live shadow, drawn at 48×36 samples in phosphor green) glows either way. Screen brightness is `0.0018·flux·mA`, clamped — faint at 40 kVp, blazing at 95.

## Interesting notes

- **The physics corrected my game design.** I first assumed 30 kVp with a huge mAs would still fog — my test asserted it and failed, because the model correctly says 40 mA·s at 30 kVp is a real (contrasty!) image. Real radiography agrees: soft rays plus patience is a legitimate technique. The fog verdict now requires genuinely few photons, and the test documents the rescue instead.
- **My first `blocked` check averaged the whole plate**, so a lead disc "blocked" nothing — the air around it still burned black and carried the mean. The fix was to judge the *subject's* pixels: `solid` (any material), `major`/`minor` (the two groups the verdict compares), and `bare` (air). Same idea later paid off for fog: the eye reads the hand, not the field around it.
- **Fifteen minutes vs. three seconds.** Anna Bertha's hand needed ~15 minutes of exposure in 1895; the app's sweet spot is 12 mA·s, i.e. three seconds at 4 mA. The model note in the footer owns the difference — the app simulates plate response, not a 19th-century emulsion's speed.
- The hand is built from capsules (fingers with bone cores, metacarpal strips, radius and ulna) rasterised into thickness maps at 6 px/cm; the ring is a solid band in projection because the beam looks along the ring's axis. Getting a *readable* hand needed the bones to shadow flesh by ln-contrast ≈ 0.5 at 60 kVp — roughly Hounsfield's old lesson about kVp choosing bone-versus-tissue contrast.
- Dead end of the day: I briefly considered dual-energy (two exposures, color-code atomic number) as the mechanic. Too much UI for an hour; the single-plate technique race tells the same story.
- The video scene where the glow "jumps" is real model output, not an animation: raising kVp from 40 to 95 at fixed current multiplies the screen's photon rate by 5.6, and the drawn glow clamps at blazing.
