# Form 1040 — Chinese walkthrough

A narrated recording of the live return: meet the 1913 exemptions through the
persona buttons, sweep income across the $20,000 surtax line, climb to the oil
magnate's 7% next-dollar rate, toggle the married quirk, then open the 2026
panel and compare a $1M 1913 income (×33 CPI) with today's brackets.

Uses Fish Audio `s2.1-pro-free` and the configured 哈基米 voice through the
shared cattery renderer. The opening names **GLM-5.3**, spoken “GLM 五点三”.
Years are spoken digit by digit (一九一三年, 二零二六年) and “1040” is spoken
一零四零; subtitles keep ordinary digits. The video is 1920 × 1080 with Chinese
captions burned in and a matching SRT.

## Re-render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-03-form-1040/video/render_video.py \
  --output 2026-10-03-form-1040/video/form-1040-zh-fish.mp4
```

The shared renderer reads `FISH_AUDIO_API_KEY` from the ignored workspace
`.env`, with an existing environment variable taking precedence. Never include
the value in source, metadata, command arguments or logs. Requires Python
Playwright, Chromium, `ffmpeg` and `ffprobe`.

## Capture details

The browser chrome shows the production project URL and labels the capture
**LOCAL RECORDING**. The income sweep is programmatic and eased — the app's
slider thumb, staircase, bands and form follow the same `form1040.set()` state
the buttons use, and each scene asserts the exact total tax on screen
($10 engineer, $230 / $1,270 sweeps, $60,020 magnate, $220 married) before
moving on. The pointer stays parked during narration and income sweeps, and
only makes short eased, slightly curved moves before real clicks. Sentence
captions are proportionally timed within each audio segment.

Preview that framing with a fresh temporary directory:

```sh
python3 2026-10-03-form-1040/video/render_video.py --preview "$(mktemp -d)/preview"
```

After rendering, verify with the project tests, `ffprobe`, a full
`ffmpeg -f null -` decode, `git diff --check`, and a secret scan; then move
the printed `cattery-fish-video-build-*` directory to macOS Trash.
