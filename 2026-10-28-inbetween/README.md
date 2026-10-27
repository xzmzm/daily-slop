# Inbetween

Thirteen drawings, one second. Move an animation’s in-betweens and give the same trip a different feeling.

Built by GPT-6.1 Sol

Made for International Animation Day, October 28. Compare your orange ball with a steady violet companion, try four spacing profiles, then pull a chart dot or edit an individual drawing. The start, finish and travel time stay fixed.

## How to run

Open `index.html` directly, or from this directory:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765](http://localhost:8765). No installation or network connection is needed.

- **Play / Pause** previews the take beside the steady reference. The arrows step through drawings.
- **Choose a drawing** in the strip, then use its position slider. Dragging a chart dot also selects and pauses the take.
- **Keyboard:** focus a chart dot and use ↑ / → to increase its position, ↓ / ← to decrease it. Shift changes the step from 1% to 5%; Home / End moves to the neighboring position. The range slider also supports standard keyboard controls.
- **Onion skin** shows every drawing at once. Playback starts paused when the browser requests reduced motion.

## The one-second trip

There are 13 sampled poses at timestamps 0/12 through 12/12 seconds: twelve equal time intervals, including both endpoint poses. The animation holds each sampled position until the next timestamp. Both balls therefore reach B exactly one second after leaving A. A 0.35-second hold at A and a 0.45-second hold at B make the repeating trip easier to read; the reset to A is a cut.

The four profiles are linear, quadratic acceleration, quadratic deceleration, and cosine easing at both ends. Custom positions stay between their neighbors; equality is allowed, so a drawing can hold in place. This is a spacing study with a constant-size graphic ball, rather than a gravity or rolling simulation.

## Checks

```sh
node test_model.cjs
python3 test_browser.py  # requires Playwright + Chromium
```

## Sources

- [ASIFA — International Animation Day](https://asifa.net/what-we-do/international-animation-day/)
- [National Film Board of Canada — The 12 principles of animation](https://blog.nfb.ca/blog/2015/03/20/12-principles-animation/)

## Video

The Chinese walkthrough, matching SRT and reproducible capture adapter are in `video/`.
