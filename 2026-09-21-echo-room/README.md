# Echo Room

A little room-acoustics studio: move a sound source and listener, trace the reflections, and hear how geometry and softer walls change a tap.

Built by GPT-6 Astra

[Open the experiment](https://dailyslop.pages.dev/2026-09-21-echo-room/)

## How to run

Open `index.html`, or serve the repository root:

```sh
python3 -m http.server 8765
```

Visit `http://localhost:8765/2026-09-21-echo-room/`. No installation, network requests, microphone permission, or API key is needed by the app.

## Try this

Drag **S** (source) or **L** (listener). Focus either dot and use arrow keys for 0.1 m steps, or Shift + arrow for 0.5 m. Press **Send a pulse** to hear the original synthesized tap; audio never autoplays. Start at low volume.

Compare **Direct only** with **With reflections**. Both use the same gain. Move the absorption slider without moving the dots: the reflected amplitudes shrink while their arrival times stay fixed. Gallery, Corridor and Studio are illustrative presets; their material values are not measurements. The wall selector highlights a first-order path. **Save audio .wav** downloads the exact mono samples used by the app.

The diagram replays at **0.06×**; audio and displayed milliseconds always use real time. **Pause view** freezes only the diagram. Reduced-motion preferences start the view paused.

## Model boundaries

This is a horizontal **early-reflection sketch**, not a calibrated room-acoustics package. The rectangular image-source model keeps paths with at most ten wall bounces. Generic configurations have 221 paths; exact corner hits are omitted because they lack a unique wall normal. Sound and the timeline use all retained paths; the room diagram draws orders zero through two. Floor, ceiling, diffraction, scattering, frequency-dependent absorption, binaural hearing and diffuse late reverberation are not modeled. There is no claimed RT60.

Each path uses `delay = length / 343` and pressure amplitude `sqrt(1 − absorption)^bounces / max(1, length)`. This is planar reflection geometry with a spherical-spreading approximation, not a two-dimensional wave-equation solution. The one-metre clamp regularizes coincident/very close source positions. Audio is a sparse convolution of a deterministic 24 ms tap, with linear fractional-delay interpolation, fixed gain and a soft safety limiter above 0.9. The arrival chart shows separate path amplitudes, not measured loudness or a full interference field.

## Tests

```sh
node 2026-09-21-echo-room/test.cjs
python -m pip install playwright pillow
python -m playwright install chromium
python 2026-09-21-echo-room/test_browser.py
```

Run from the repository root. The browser suite verifies real HTTP loading in GitHub Actions, keyboard/pointer controls, responsive layouts, Web Audio, reduced motion and WAV downloads. The optional `ECHO_INLINE_PREVIEW=1` mode injects the same local static files for restricted development environments; it is not permitted to substitute for HTTP in the CI suite.

## Video

[Chinese-narrated walkthrough](video/echo-room.mp4) · [Matching subtitles](video/echo-room.srt) · [Video metadata](video/echo-room.json)

See [video/README.md](video/README.md) for rendering. The video uses the established Fish Audio voice, burned-in Chinese captions, real browser interactions and the app's actual tap samples in the narration pauses. The shown URL is the deployment destination; recording takes place in a local browser, as marked in its chrome.
