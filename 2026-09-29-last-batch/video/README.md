# Last Batch walkthrough

A 96-second, 1920 × 1080 Chinese walkthrough of the actual bakery: open a month, inspect a day, switch between customer forecasts, try the best batch, and raise bake costs. Narration uses Fish Audio `s2.1-pro-free` and the configured 哈基米 voice. Captions are burned into the MP4 and provided as a matching SRT.

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-09-29-last-batch/video/render_video.py \
  --output 2026-09-29-last-batch/video/last-batch-zh-fish.mp4
```

Requires Python Playwright, Chromium, and `ffmpeg`/`ffprobe`. The shared renderer reads `FISH_AUDIO_API_KEY` from the ignored workspace-root `.env`; an existing environment variable takes precedence. The key is never embedded in source, narration metadata, or command arguments.

The opening credits the actual builder, GPT-6 Astra, pronounced “GPT 六 Astra”. September 29's food-loss-and-waste observance supplies the reason for the project. The narration contains no historical years.

The browser chrome shows the deployment URL and labels the capture as a local recording. The cursor stays parked during explanation and scrolling, with short curved movements before real clicks. Playwright's clock advances the app's actual opening sequence by one frame at a time, keeping the 30-day animation independent of screenshot speed. Still frames share hard links; the video is encoded once with fast-start metadata. Sentence captions are timed proportionally within each spoken segment.

Preview the caption framing:

```sh
python3 2026-09-29-last-batch/video/render_video.py --preview /tmp/last-batch-preview
```

After rendering, run the project's `verify_build.py`, which exercises the app, probes the streams, decodes the full video, validates subtitle timing and narration level, and scans source and artifacts against the configured key. Also run `git diff --check`. Move the printed `cattery-fish-video-build-*` directory to macOS Trash after verification.
