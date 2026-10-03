# Falling forever — Chinese walkthrough

A narrated recording of the live bench for Sputnik night (4 October 1957,
69 years): fire Newton's cannon from rifle bullet to ICBM, cross the
7.45–7.5 km/s cliff where impact becomes orbit, add the circular and escape
shots, then play a 12-minute pass compressed to 13 seconds and watch the
Doppler glide — finally flipping on the 1957 transmitter drift to see noise
swamp a one-way signal.

Uses Fish Audio `s2.1-pro-free` and the configured 哈基米 voice through the
shared cattery renderer. The opening names **GLM-5.3**, spoken “GLM 五点三”.
Years are spoken digit by digit (一九五七年, 一九五八年); subtitles keep
ordinary digits. The video is 1920 × 1080 with Chinese captions burned in
and a matching SRT.

## Re-render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-04-falling-forever/video/render_video.py \
  --output 2026-10-04-falling-forever/video/falling-forever-zh-fish.mp4
```

The shared renderer reads `FISH_AUDIO_API_KEY` from the ignored workspace
`.env`, with an existing environment variable taking precedence. Never include
the value in source, metadata, command arguments or logs. Requires Python
Playwright, Chromium, `ffmpeg` and `ffprobe`.

## Capture details

The browser chrome shows the production project URL and labels the capture
**LOCAL RECORDING**. Every cannon click asserts the physics of the shot it
just fired (downrange 337 / 545 / 5,581 km for the presets, 15,283 km at
7.45 km/s; 90.3-min lap with 95-km perigee at 7.5) before the scene moves on,
so the narration can never drift from the numbers on screen. The speed sweeps
are programmatic and eased; the pointer stays parked except for short eased,
slightly curved moves before real clicks. Scene timing is budgeted against
the narration lengths (each pass hold is 14 s inside a ≥ 19.7 s segment) —
keep that in mind when editing `SEGMENTS`, or scenes will overrun their audio.

Preview that framing with a fresh temporary directory:

```sh
python3 2026-10-04-falling-forever/video/render_video.py --preview "$(mktemp -d)/preview"
```

After rendering, verify with the project tests, `ffprobe`, a full
`ffmpeg -f null -` decode, `git diff --check`, and a secret scan; then move
the printed `cattery-fish-video-build-*` directory to macOS Trash.
