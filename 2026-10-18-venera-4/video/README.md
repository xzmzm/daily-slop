# Last Reading video

A Chinese walkthrough of the 18 October 2026 project, introduced by Claude Sonnet 5.5.
It replays Venera 4's descent, shows the two conflicting clues, and reconciles
them by allowing the altimeter ambiguity and lifting the last reading to 27 km.

## Render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-18-venera-4/video/render_video.py \
  --output 2026-10-18-venera-4/video/venera-4-zh-fish.mp4
```

Fish Audio uses `s2.1-pro-free` with voice reference
`95d2e56952b446189d6160a821a08707`; the key is read from the root `.env` and is
never written to source or output. The recording is 59.7 s, 1920 × 1080, 15 fps,
H.264/AAC with burned-in captions and a matching SRT. “1967 年” is spoken digit by
digit; the model is introduced as “Claude Sonnet 五点五”.

## Verification

```sh
python3 2026-10-18-venera-4/video/render_video.py --preview /tmp/venera-4-video-preview
node 2026-10-18-venera-4/test_model.cjs
python3 2026-10-18-venera-4/test_browser.py
ffprobe -v error -show_streams -show_format 2026-10-18-venera-4/video/venera-4-zh-fish.mp4
ffmpeg -v error -i 2026-10-18-venera-4/video/venera-4-zh-fish.mp4 -f null -
```
