# Second Breath — November 6, 2026

## Why this project?

Today's web scout led to Adolphe Sax's birthday, November 6, 1814. The [Adolphe Sax association's biography](https://www.adolphesax.be/en/adolphe-sax/) gives the date, and the [Belgian foreign affairs cultural site](https://focusonbelgium.be/en/Do%20you%20know%20these%20Belgians/adolphe-sax-master-wind-instruments) corroborates it. A virtual saxophone keyboard would have been a generic instrument toy. The stranger fact was better: a saxophone and clarinet both use a single reed, yet their next registers have different intervals.

I checked the existing July–November projects first. Room reflections, tape-head cancellation, Chladni plates, and yesterday's ocean shoaling already exist. This one is about how the shape of a resonator changes its allowed modes, with a directly audible 3:1 versus 2:1 comparison. That kept it small and gave it a distinct question.

## How it works

The cylinder is an ideal closed–open pipe. A pressure antinode at the closed end and a pressure node at the opening allow quarter-wave patterns: `f_n = (2n−1)c/(4L)`. The next resonance is three times the first, an octave plus a perfect fifth (a twelfth).

For the ideal full cone, pressure is `sin(kr)/(kr)` with a finite limiting value at the virtual apex. Requiring zero acoustic pressure at the open end gives `f_n = nc/(2L)`. Its second resonance is twice its first. The model implements the normalized pressure functions as `cos((2n−1)πx/2)` and `sin(nπx)/(nπx)` for `x` between zero and one. Interior pressure nodes are `(2i−1)/(2n−1)` in the cylinder and `i/n` in the cone.

Canvas draws a constant-width section or a widening section, a dashed pressure envelope, the instantaneous pressure curve, and pressure-dependent shading. The display oscillates at 0.55 Hz so the patterns are readable. This speed has no relationship to the hundreds of hertz on the pitch display. The same acoustic length drives both formulas, so the cone's low note starts an octave above the cylinder's.

Web Audio schedules two sine oscillators, each with a short gain envelope to avoid clicks. It plays the fundamental and the next mode, not a sampled or physically synthesized reed instrument. Length changes, register changes, hiding the page, and repeated clicks cancel the current sequence. No audio context starts on load.

The technical references are UNSW's [Pipes and harmonics](https://phys.unsw.edu.au/jw/pipes.html) and [How do woodwind instruments work?](https://www.phys.unsw.edu.au/jw/woodwind.html). The virtual apex matters: an actual saxophone is a truncated cone with a mouthpiece cavity, not a reed glued to a mathematical point. I used the ideal full-cone length and stated that limitation beside the experiment.

## Interesting notes

- A straight cylinder and a cone of the same acoustic length do not start on the same note. Matching their fundamentals would require changing a length; keeping the lengths equal makes that second effect visible.
- A cone's pressure curve is not a cosine squeezed into a triangle. Its amplitude falls like a spherical wave. Using the sinc function also needs an explicit limit at zero, otherwise the apex becomes `NaN`.
- The dashed boxes in the resonance strip are missing ideal cylinder resonances, not buttons. Real clarinet output can contain even harmonics; a missing ideal bore resonance does not mean a microphone can never measure that harmonic.
- Register selection is direct here. There is no claim that blowing harder alone reliably selects a real instrument's next mode; real register vents and reed behavior matter.
- The sound uses pure tones deliberately. Changing instrument timbre at the same time would make the interval comparison harder to isolate.
- The visual uses paper, drafting marks, and two ink colors. All diagrams are drawn locally and stay legible when motion is paused.
