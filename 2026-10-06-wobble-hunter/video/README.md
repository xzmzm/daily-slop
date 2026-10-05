# Wobble Hunter — Chinese walkthrough

A narrated recording of the radial-velocity lab: the star and its unseen
planet orbit a shared barycentre (wobble magnified, factor on the badge), the
spectral line swings blue and red, the scrolling velocity curve shows the
56 m/s signal, and the log-scale meter sets it against ELODIE '95, HARPS and
ESPRESSO precision. The footage then swaps in Jupiter (12.1 m/s, an
11.5-year wait for one full waveform), an Earth twin (8.7 cm/s, below every
instrument), and finally presses the orbit tilt to exactly face-on with the
slider's Home key — the planet keeps circling in the diagram while the signal
reads 0.0 cm/s and the verdict drops to "below every spectrograph".

The October 6 prompt is the 1995 Florence announcement of 51 Pegasi b by
Mayor and Queloz — the first exoplanet confirmed around a Sun-like star,
later awarded the 2019 Nobel Prize in Physics. The closing narration notes
the count has passed five thousand worlds since.

Uses Fish Audio `s2.1-pro-free` and the configured 哈基米 voice through the
shared cattery renderer. The opening names **GLM-5.3**, spoken “GLM 五点三”.
Years are spoken digit by digit (一九九五年, 二十四年, 三十一
年); subtitles keep ordinary digits (1995 年, 24 年, 31 年), and non-year
quantities stay as plain numbers (4.23 天, 56 米, 13 米, 12 米, 9 厘米).
The finished video is 114.31 seconds at 1920 × 1080 / 15 fps, with Chinese
captions burned in and a matching 23-cue SRT.

## Re-render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-06-wobble-hunter/video/render_video.py \
  --output 2026-10-06-wobble-hunter/video/wobble-hunter-zh-fish.mp4
```

The shared renderer reads `FISH_AUDIO_API_KEY` from the ignored workspace
`.env`, with an existing environment variable taking precedence. Never
include the value in source, metadata, command arguments or logs. Requires
Python Playwright, Chromium, `ffmpeg` and `ffprobe`.

## Capture details

The browser chrome shows the production project URL and labels the capture
**LOCAL RECORDING**. The app's manual clock advances one fifteenth of a
second per recorded frame (2 simulated days per real second at the default
speed). The footage uses the real preset buttons (51 Peg b, Jupiter, Earth
twin), the real 1 yr/s speed button, and the real orbit-tilt slider — clicked
once, then settled with the keyboard Home key for an exact 0° face-on view
(and End to restore 90° for the outro). Every interaction asserts the
resulting app state before recording continues. During the meter narration
the page scrolls smoothly to the detectability panel; the pointer stays
parked during narration and scrolling and only makes short eased, slightly
curved moves before real clicks. Captions are timed proportionally within
each spoken segment.

An earlier render clicked the tilt slider near its left end and landed on
4° — visibly "3.8 m/s" on screen while the narration said the signal
disappeared. The keyboard Home/End presses replaced that click for an exact
0°, and the re-render's on-screen chips read 0.0 cm/s with the flat curve.

Preview the framing with a fresh temporary directory:

```sh
python3 2026-10-06-wobble-hunter/video/render_video.py --preview "$(mktemp -d)/preview"
```

After rendering, run the project checks, `ffprobe`, a full `ffmpeg -f null -`
decode, `git diff --check`, and a secret scan. Then move the printed
`cattery-fish-video-build-*` directories to macOS Trash.

The finished build passed all six core physics tests, the browser checks
(presets, sliders, meter, chart, transport, mobile layouts), stream probing,
a full decode, subtitle timing and narration checks, `git diff --check`, and
an exact-key and token-pattern secret scan. Frames from the opening, the
meter segment, and the face-on tilt moment were reviewed visually. The
temporary build directories from both renders were moved to Trash after
verification.

Sources: [ESO on the 2019 Nobel Prize](https://www.eso.org/public/news/eso1919/)
and [NASA on 51 Pegasi b](https://science.nasa.gov/exoplanet-catalog/51-pegasi-b/).
