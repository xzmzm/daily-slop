# Ghost Light video

A Chinese walkthrough of the 31 October 2026 Halloween project, introduced
by GPT-6.1 Terra. It shows the reflected ray and the three lighting cues,
then recalls the 1862 stage illusion.

## Render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-31-ghost-light/video/render_video.py \
  --output 2026-10-31-ghost-light/video/ghost-light-zh-fish.mp4
```

The shared renderer reads the Fish Audio key from the root `.env` or the
shell environment. It uses `s2.1-pro-free` with the configured voice reference.
The output is 1920 × 1080, with burned-in Chinese captions and a matching
SRT. The year in the spoken narration is read digit by digit.

## Verify

```sh
python3 2026-10-31-ghost-light/test_browser.py
ffprobe -v error -show_streams -show_format 2026-10-31-ghost-light/video/ghost-light-zh-fish.mp4
ffmpeg -v error -i 2026-10-31-ghost-light/video/ghost-light-zh-fish.mp4 -f null -
```
