# 44,100 walkthrough

A Chinese walkthrough of the actual workbench: drop a 3 kHz tone into a 4 kHz
sampler and watch the alias fold to 1 kHz, ride the bit depth down to four bits,
toggle the TV system that minted 44,100, then scratch the disc twice — interleaved
and healed, then bunched and clicking. Narration uses Fish Audio `s2.1-pro-free`
and the configured 哈基米 voice. Captions are burned into the MP4 and provided as
a matching SRT.

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-01-44100/video/render_video.py \
  --output 2026-10-01-44100/video/44100-zh-fish.mp4
```

Requires Python Playwright, Chromium, and `ffmpeg`/`ffprobe`. The shared renderer
reads `FISH_AUDIO_API_KEY` from the ignored workspace-root `.env`; an existing
environment variable takes precedence. The key is never embedded in source code,
narration metadata, or command arguments.

The opening credits the actual builder, GLM-5.3, pronounced “GLM 五点三”. The reason
for the project is the October 1, 1982 launch of the Sony CDP-101 with fifty titles;
the narration reads the year digit by digit (一九八二年十月一日) and says 四四一零零
for the sample rate while the burned-in subtitles keep 44100.

The browser chrome shows the deployment URL and labels the capture as a local
recording. The page is reflowed to a single wide column for the recording so every
scrolled station fills the frame. The cursor stays parked during narration and
scrolling; it moves only before real clicks and the two strip scratches, which are
captured frame by frame as the wound grows. The disc canvas spins on its own
1/24-speed animation throughout. Sentence captions are timed proportionally within
each spoken segment.

Preview the caption framing:

```sh
python3 2026-10-01-44100/video/render_video.py --preview /tmp/44100-preview
```

After rendering, run the project's `verify_build.py`, which exercises the app,
probes the streams, decodes the full video, validates subtitle timing and narration
level, and scans source and artifacts against the configured key. Also run
`git diff --check`. Move the printed `cattery-fish-video-build-*` directory to
macOS Trash after verification.
