# Same Ship? video

`same-ship-zh-fish.mp4` records the actual browser app at 1920×1080 with Chinese narration and burned-in captions. The accompanying SRT uses the same cues.

From the repository root, with Playwright Chromium and FFmpeg available:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-19-same-ship/video/render_video.py \
  --output 2026-11-19-same-ship/video/same-ship-zh-fish.mp4
```

The shared renderer reads the Fish Audio key from the environment or the ignored workspace `.env`. The capture pauses at the first repair, the four-plank tie, and the two different verdicts after the refit.
