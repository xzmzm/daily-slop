# Mesh Shift walkthrough

The Chinese walkthrough runs the 5 cm and 9 cm tows over the same fish and compares their length distributions. The MP4 includes burned-in captions, and the SRT contains the matching cues.

## Re-render

Run from the repository root with Playwright Chromium, FFmpeg, and the Fish Audio key configured.

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-21-mesh-shift/video/render_video.py \
  --output 2026-11-21-mesh-shift/video/mesh-shift-zh-fish.mp4
```
