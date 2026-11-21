# Dead Center video

The 1920×1080 Chinese demo uses the shared Fish Audio renderer. The live recording shows the starting imbalance, a swap between cabins H and F, and a balanced turn.

From the workspace root, with the Fish Audio key in the root `.env` or shell environment:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-22-dead-center/video/render_video.py \
  --output 2026-11-22-dead-center/video/dead-center-zh-fish.mp4
```

The renderer also writes matching `.srt` subtitles and `.json` metadata.
