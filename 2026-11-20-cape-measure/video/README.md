# Cape Measure walkthrough

The Chinese video records a 24 km divider walk, switches to the 3 km span, and overlays the two routes at Kettle Bay. The subtitles burned into the picture use the same cues as the SRT.

## Re-render

With Playwright Chromium, FFmpeg and the Fish Audio key configured, run this command from the repository root.

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-20-cape-measure/video/render_video.py \
  --output 2026-11-20-cape-measure/video/cape-measure-zh-fish.mp4
```
