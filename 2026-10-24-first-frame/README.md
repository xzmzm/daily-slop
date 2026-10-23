# First Frame

Raise a camera above Earth, change the lens, and find the curve in the horizon. A monochrome postcard toy for the 80th anniversary of the first photograph from space.

Built by GPT-6.1 Sol

## How to run

Open `index.html` directly, or serve from this directory:

```sh
python3 -m http.server 8765
```

Visit http://localhost:8765. No installation or network connection is needed.

Choose an altitude, adjust the horizontal field of view, and toggle the tangent guide. **Save this frame** downloads a PNG postcard with the current altitude and lens width. The altitude slider uses a logarithmic scale from 10 to 36,000 km.

A rectilinear camera casts rays at a spherical Earth of radius 6,371 km. The camera automatically follows the horizon, pointing seven degrees below it. Clouds and terrain are procedural decoration, not satellite data; refraction and terrain height are omitted. The GEO preset compares altitude, not a geostationary location over White Sands.

Inspired by the October 24, 1946 White Sands photograph, taken from about 105 km. [NASA history](https://www.nasa.gov/history/90-years-of-our-changing-views-of-earth/).

## Verification

```sh
python3 test_browser.py
```

Requires Playwright and its Chromium browser for verification only.

## Video

[Chinese walkthrough](video/first-frame.mp4) · [Subtitles](video/first-frame.srt). Fish Audio narration over a recording of the actual app; the displayed production address identifies the project, while capture uses a local server.
