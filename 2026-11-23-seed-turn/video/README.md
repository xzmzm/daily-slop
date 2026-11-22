# Seed Turn video

The 1920×1080 Chinese demo compares two spoke patterns with the golden angle, then turns on both seed traces. The MP4 includes burned-in captions. The matching `.srt` is also available separately.

From the workspace root, with the Fish Audio key in the root `.env` or shell environment:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-23-seed-turn/video/render_video.py \
  --output 2026-11-23-seed-turn/video/seed-turn-zh-fish.mp4
```
