# Sell Program video

A Chinese walkthrough of the 19 October 2026 project, introduced by Claude Opus 5.5.
It recalls Black Monday's 22.6% fall, replays the default day with the unfilled
insurer orders piling up, then compares a run with no insurers and one with
today's circuit breakers.

## Render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-19-sell-program/video/render_video.py \
  --output 2026-10-19-sell-program/video/sell-program-zh-fish.mp4
```

Fish Audio uses `s2.1-pro-free` with voice reference
`95d2e56952b446189d6160a821a08707`; the key is read from the root `.env` and is
never written to source or output. The recording is 1920 × 1080, 15 fps,
H.264/AAC with burned-in captions and a matching SRT. “1987 年” is spoken digit by
digit; the model is introduced as “Claude Opus 五点五”.

The recording sets `data-fit` on the chart so its viewBox widens to the fixed
560 px height instead of letterboxing.

## Verification

```sh
python3 2026-10-19-sell-program/video/render_video.py --preview /tmp/sell-program-video-preview
node 2026-10-19-sell-program/test_model.cjs
python3 2026-10-19-sell-program/test_browser.py
ffprobe -v error -show_streams -show_format 2026-10-19-sell-program/video/sell-program-zh-fish.mp4
ffmpeg -v error -i 2026-10-19-sell-program/video/sell-program-zh-fish.mp4 -f null -
```
