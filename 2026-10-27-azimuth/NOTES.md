# Azimuth — build notes

## Why this project?

October 27 is UNESCO’s World Day for Audiovisual Heritage. The interesting small interaction was hiding in IASA’s replay guidance: a recording can sound dull because the playback head does not match the original recording angle. That makes preservation tangible without inventing a generic archive browser. This is different from the earlier disc-cutting, CD parity and disk-buffer projects: the central event is spatial phase cancellation across one magnetic track.

I considered a film-shrinkage transport and a tape-splice toy. Azimuth won because one slider produces a visible and audible effect, and the adjustment has a clear goal.

## How it works

At frequency f, tape moving at speed v has a recorded wavelength v/f. A head tilted by θ spans a longitudinal offset w tan(θ) across track width w. Integrate a sinusoid uniformly over that offset and divide by the width: the result is sinc(π f w tan(θ)/v), using the unnormalized sinc sin(x)/x. The angle used is playback minus recording angle. Mystery tapes change the latter.

At the initial 0.4° error and 4.7625 cm/s, the first null is about 11.37 kHz. At half that frequency the amplitude is 2/π, an independent check used in the tests. Doubling speed doubles the null frequency when comparing recordings of the same audio frequency.

The audio is an 80-coefficient periodic wave with harmonics of 196 Hz falling as harmonic number to the power −0.85. Each signed coefficient is multiplied by the same sinc used by the graph, followed by a quiet repeating pluck envelope. Automatic waveform normalization is disabled: otherwise a browser could boost a damaged waveform and obscure the amplitude comparison. Playback begins only on a user click.

## Interesting notes

- A magnitude response can dip to zero and rise again. Finding a local high-frequency bump is not necessarily finding alignment; the mystery instruction asks for the flattest response across the whole band.
- The diagram exaggerates angles by 35, but the numeric response always uses the real angle. At literal scale, a 0.4° correction is almost invisible.
- The seven phase arrows depict samples of the 10 kHz phase distribution. The response uses the continuous integral, not a seven-sample approximation.
- Track width is an illustrative 0.6 mm, rather than a claim to model every cassette format. The speed switch is a controlled comparison, not a transport speed/pitch effect.
- The browser test checks nonzero samples from a Web Audio analyser as well as the controls, so a working play-button label alone cannot pass.
- No historical tape audio is used. The generated loop makes the demo self-contained and avoids implying that this toy restores a real archival recording.

## Reading

[UNESCO’s observance](https://www.unesco.org/en/days/audiovisual-heritage) supplied the date. [IASA’s replay-alignment guidance](https://www.iasa-web.org/tc04/corrections-errors-misaligned-recording-equipment) supplied the preservation connection: compensate during replay, before transfer.
