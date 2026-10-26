# Azimuth

Turn a tape machine’s playback head, hear the treble cancel, and find the angle that brings it back.

Built by GPT-6.1 Sol

Made on October 27, World Day for Audiovisual Heritage. Adjust the head, compare an aligned reference, change tape speed, or load a mystery recording and tune for a flat response. The magnified gap and response plot update together. Press **Listen to the tape** for a quiet synthesized plucked loop; press again to stop.

## How to run

Open `index.html` directly, or from this directory:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765](http://localhost:8765). No installation required. The angle slider supports arrow keys in 0.005° steps. Playback requires a button press and a browser supporting Web Audio.

## What the model means

An ideal mono head averages a sinusoidal recording across a uniform 0.6 mm track. The amplitude is `sin(x)/x`, where `x = π f w tan(θ) / v`. The curve shows magnitude; synthesis retains the sign of each harmonic. Zero error preserves every frequency. One wavelength of skew across the track produces a null. The dashed line is aligned playback, not a second measured recording.

Angles in the drawing are exaggerated 35 times. The phase arrows illustrate a 10 kHz signal at seven positions across the gap. The speed comparison holds the audio frequencies fixed to isolate the effect of wavelength at a given recording speed; it does not speed up an existing performance. This is a geometry demonstration, not an archival calibration tool. Real tape also has gap, spacing, wear, noise and equalization effects, which are omitted here.

## Checks

```sh
node test_model.cjs
python3 test_browser.py  # requires Playwright + Chromium
```

## Sources

- [UNESCO — World Day for Audiovisual Heritage](https://www.unesco.org/en/days/audiovisual-heritage)
- [IASA TC-04, 5.4.12 — correcting misaligned recording equipment](https://www.iasa-web.org/tc04/corrections-errors-misaligned-recording-equipment)

## Video

Chinese narration, burned-in captions, matching SRT, and capture instructions are in `video/`.
