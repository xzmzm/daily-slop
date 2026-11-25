# Carryover video

The 1920×1080 Chinese demo roasts three turkeys. The first is pulled at 165°F and rested 30 minutes (safe, but dry, with a 9°F carryover). The second is pulled at 150°F with the same rest (safe and juicier). The third is pulled at 145°F and carved at once (not safe). Captions are burned into the MP4, and the same captions ship as a separate `.srt`.

From the workspace root, with the Fish Audio key in the root `.env` or shell environment:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-26-carryover/video/render_video.py \
  --output 2026-11-26-carryover/video/carryover-zh-fish.mp4
```
