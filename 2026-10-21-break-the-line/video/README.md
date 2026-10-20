# Break the Line video

A Chinese walkthrough of the 21 October 2026 project, introduced by Claude Opus 5.5.
It recalls Trafalgar (1805) and the old parallel-line battle, plays the line of
battle (11 of 12 escape downwind), then Nelson's head-on cut: 19 silent minutes
for the lead ship, then all 12 taken from the leeward side.

## Render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-21-break-the-line/video/render_video.py \
  --output 2026-10-21-break-the-line/video/break-the-line-zh-fish.mp4
```

Fish Audio uses `s2.1-pro-free` with voice reference
`95d2e56952b446189d6160a821a08707`; the key is read from the root `.env` and is
never written to source or output. The recording is 1920 × 1080, 15 fps,
H.264/AAC with burned-in captions and a matching SRT. “1805 年” is spoken digit
by digit; the model is introduced as “Claude Opus 五点五”. The battle is
scrubbed by setting the frame index directly, so playback speed follows the
narration rather than the page's 10 battle-minutes per second.

## Verification

```sh
python3 2026-10-21-break-the-line/video/render_video.py --preview /tmp/break-the-line-video-preview
node 2026-10-21-break-the-line/test_model.cjs
python3 2026-10-21-break-the-line/test_browser.py
ffprobe -v error -show_streams -show_format 2026-10-21-break-the-line/video/break-the-line-zh-fish.mp4
ffmpeg -v error -i 2026-10-21-break-the-line/video/break-the-line-zh-fish.mp4 -f null -
```
