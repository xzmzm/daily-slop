# Second Breath

Same reed, different leap: see and hear why a straight bore jumps a twelfth while a widening bore jumps an octave.

Built by GPT-6.1 Sol

An air-column comparison for Adolphe Sax's November 6 birthday. Switch between the low note and the next resonance, change both columns' acoustic length, pause the pressure animation, and play each pair of notes.

## How to run

Open `index.html` directly, or serve the repository root:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765/2026-11-06-second-breath/](http://localhost:8765/2026-11-06-second-breath/).

[Live project](https://dailyslop.pages.dev/2026-11-06-second-breath/)

Sound starts only after a button press. Each button plays two quiet sine tones: the low note, then the next resonance. Press it again to stop. Animation starts paused if your device requests reduced motion.

## What the model represents

The ideal cylinder is closed at the reed and open at its other end. Its resonances are odd multiples of `c / (4L)`. The ideal cone's resonances are integer multiples of `c / (2L)`, measured from its virtual apex. Both use `c = 343 m/s`.

Real instruments have mouthpieces, tone holes, register vents, bells, losses, and end corrections. This experiment isolates the bore shape. The cone includes its virtual apex rather than pretending the reed sits at a zero-area point. Pressure curves are normalized and displayed in slow motion; they are not pictures of air moving up and down. Notes are nearest equal-tempered concert pitches with A4 = 440 Hz, not transposed instrument notation. Audio demonstrates frequency intervals rather than clarinet or saxophone timbre.

## Verification

```sh
node 2026-11-06-second-breath/test_model.cjs
python3 2026-11-06-second-breath/test_browser.py
```

The browser check uses the locally installed Python Playwright and Chromium. The app itself has no dependencies.

## Video

The [Chinese narrated video](video/second-breath-zh-fish.mp4) has [matching subtitles](video/second-breath-zh-fish.srt). Reproduction instructions are in [video/README.md](video/README.md).
