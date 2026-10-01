# Thirty Lines — Chinese walkthrough

A narrated recording of the real mechanical TV bench: follow the spiral disc,
switch to the single aperture, compare 15 and 60 columns on fine type, make the
receiver drift, then distinguish speed error from a fixed half-turn phase error.

Uses Fish Audio `s2.1-pro-free` and the configured 哈基米 voice through the shared
cattery renderer. The opening names **GPT-6.1 Sol**, spoken “GPT 六点一 Sol”.
The year 1925 is spoken 一九二五年; subtitles retain the ordinary digits.
The video is 1920 × 1080 with Chinese captions burned in and a matching SRT.

## Re-render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-02-thirty-lines/video/render_video.py \
  --output 2026-10-02-thirty-lines/video/thirty-lines-zh-fish.mp4
```

The shared renderer reads `FISH_AUDIO_API_KEY` from the ignored workspace `.env`,
with an existing environment variable taking precedence. Never include the value
in source, metadata, command arguments or logs. Requires Python Playwright,
Chromium, `ffmpeg` and `ffprobe`.

## Capture details

The browser chrome shows the production project URL and labels the capture
**LOCAL RECORDING**. The app’s manual clock advances one video frame at a time;
the same motor integrator, area sampler and receiver renderer drive live use and
recording. The pointer stays parked during explanations, makes short eased,
slightly curved movements before real clicks, and drags the actual phase slider.
Sentence captions are proportionally timed within each audio segment.

The page fits the three machines and their controls above the subtitle overlay.
Preview that framing with a fresh temporary directory:

```sh
python3 2026-10-02-thirty-lines/video/render_video.py --preview /tmp/thirty-lines-video-preview
```

After rendering, run `python3 2026-10-02-thirty-lines/verify_build.py` and
`git diff --check`. The verification includes the project tests, stream probing,
a complete decode, subtitle/narration checks, and an exact-key secret scan.
Move the printed `cattery-fish-video-build-*` directory to macOS Trash afterward.
