# Forty-Three video

The 1920×1080 Chinese demo switches Venus off and on, runs the orbit forward a million years, closes the gap with a Vulcan, and then compares Einstein's 1913 and 1915 theories. Captions are burned into the MP4, and the same captions ship as a separate `.srt`.

From the workspace root, with the Fish Audio key in the root `.env` or shell environment:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-25-forty-three/video/render_video.py \
  --output 2026-11-25-forty-three/video/forty-three-zh-fish.mp4
```
