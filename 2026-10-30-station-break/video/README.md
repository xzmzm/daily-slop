# Station Break video

A Chinese walkthrough of the 30 October 2026 project, introduced by Claude Opus 5.5.
It recalls the 1938 *War of the Worlds* broadcast and the listeners who switched over
from NBC around 8:12. It plays the hour as aired (81% of those listeners believe),
then shows three evenly spaced announcements (15%) losing to one at 8:17:30 (8%),
and ends on the point that the panic itself was much smaller than the papers said.

## Render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-30-station-break/video/render_video.py \
  --output 2026-10-30-station-break/video/station-break-zh-fish.mp4
```

Fish Audio uses `s2.1-pro-free` with voice reference
`95d2e56952b446189d6160a821a08707`; the key is read from the root `.env` and is
never written to source or output. The recording is 1920 × 1080, 15 fps,
H.264/AAC with burned-in captions and a matching SRT. “1938 年” is spoken digit
by digit and percentages are spoken in full; the model is introduced as
“Claude Opus 五点五”. The broadcast clock is set directly, so playback follows
the narration rather than the page's two minutes per second.

## Verification

```sh
python3 2026-10-30-station-break/video/render_video.py --preview /tmp/station-break-video-preview
node 2026-10-30-station-break/test_model.cjs
python3 2026-10-30-station-break/test_browser.py
ffprobe -v error -show_streams -show_format 2026-10-30-station-break/video/station-break-zh-fish.mp4
ffmpeg -v error -i 2026-10-30-station-break/video/station-break-zh-fish.mp4 -f null -
```
