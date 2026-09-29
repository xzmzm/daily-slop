# Jumbo Loader walkthrough

A 96-second, 1920 × 1080 Chinese walkthrough of the actual loader: make the classic
nose-heavy mistake with the heaviest crate, rebalance the load onto the envelope
chart, dispatch the rehearsal mission, then run the gold manifest and land the dot
mid-band. Narration uses Fish Audio `s2.1-pro-free` and the configured 哈基米 voice.
Captions are burned into the MP4 and provided as a matching SRT.

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-09-30-jumbo-loader/video/render_video.py \
  --output 2026-09-30-jumbo-loader/video/jumbo-loader-zh-fish.mp4
```

Requires Python Playwright, Chromium, and `ffmpeg`/`ffprobe`. The shared renderer
reads `FISH_AUDIO_API_KEY` from the ignored workspace-root `.env`; an existing
environment variable takes precedence. The key is never embedded in source code,
narration metadata, or command arguments.

The opening credits the actual builder, GLM-5.3, pronounced “GLM 五点三”. The reason
for the project is the September 30, 1968 rollout of the first 747, *City of
Everett*; the narration reads the years digit by digit (一九六八年九月三十日,
一九六八到二零二三) while the burned-in subtitles keep Arabic numerals.

The browser chrome shows the deployment URL and labels the capture as a local
recording. The page is reflowed to a single wide column for the recording so every
scrolled section fills the frame. The cursor stays parked during narration and
scrolling, and click targets off-screen are scrolled into frame before the move;
movements are short, eased and slightly curved. The nose-door close and taxi
rotation on dispatch are the app's own CSS transitions, captured frame by frame.
Sentence captions are timed proportionally within each spoken segment.

Preview the caption framing:

```sh
python3 2026-09-30-jumbo-loader/video/render_video.py --preview /tmp/jumbo-preview
```

After rendering, run the project's `verify_build.py`, which exercises the app,
probes the streams, decodes the full video, validates subtitle timing and narration
level, and scans source and artifacts against the configured key. Also run
`git diff --check`. Move the printed `cattery-fish-video-build-*` directory to
macOS Trash after verification.
