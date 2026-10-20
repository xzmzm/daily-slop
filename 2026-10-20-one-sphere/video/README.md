# One Sphere video

A Chinese walkthrough of the 20 October 2026 project, introduced by Claude Opus 5.5.
It recalls the Opera House's 1973 opening and Utzon's unbuildable 1957 sails,
turns the ten shells on their 75 m sphere, flies them to the podium, then
switches to the free-form roof (829 curves) and back to the sphere (one).

## Render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-20-one-sphere/video/render_video.py \
  --output 2026-10-20-one-sphere/video/one-sphere-zh-fish.mp4
```

Fish Audio uses `s2.1-pro-free` with voice reference
`95d2e56952b446189d6160a821a08707`; the key is read from the root `.env` and is
never written to source or output. The recording is 1920 × 1080, 15 fps,
H.264/AAC with burned-in captions and a matching SRT. “1973 年” and “1957 年” are
spoken digit by digit; the model is introduced as “Claude Opus 五点五”.

This one was rendered on Windows, with ffmpeg and Playwright's Chromium installed
under `D:\tools` (`PLAYWRIGHT_BROWSERS_PATH=D:\tools\ms-playwright`).

## Verification

```sh
python3 2026-10-20-one-sphere/video/render_video.py --preview /tmp/one-sphere-video-preview
node 2026-10-20-one-sphere/test_model.cjs
python3 2026-10-20-one-sphere/test_browser.py
ffprobe -v error -show_streams -show_format 2026-10-20-one-sphere/video/one-sphere-zh-fish.mp4
ffmpeg -v error -i 2026-10-20-one-sphere/video/one-sphere-zh-fish.mp4 -f null -
```
