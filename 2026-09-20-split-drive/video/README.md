# Split Drive — walkthrough video

A recording of the actual page: open differential, tighter turn, axle lock,
mirrored turn, straight travel, full-lap distance, axle width, zero speed,
and native PNG export.

## Render

From the repository root, with ffmpeg, ffprobe, and a Chinese system font:

```sh
python3 -m pip install playwright pillow
python3 -m playwright install chromium
python3 2026-09-20-split-drive/video/render_video.py
```

Outputs are `split-drive.mp4`, `split-drive.srt`, and `split-drive.json`.
Video is **1920 × 1080, 20 fps, H.264/AAC**, with burned-in Chinese captions.
The browser overlay shows the deployment URL, while the frames are captured
from the local source build; the address is not proof of deployment status.

## Voice and fallback

The adapter reuses `2026-08-08-cattery/video/render_fish_video.py`, including
Fish model `s2.1-pro-free` and the configured 哈基米 voice. An environment
`FISH_AUDIO_API_KEY` takes precedence over the root `.env`. No key is stored
in code, output metadata, or logs. A configured API call that fails is an
error, not a reason to silently use another voice.

When no key is available, it produces a **Chinese-captioned original-music
edition with no spoken narration**. The visible badge and JSON say so.
`--captions-only` explicitly requests that mode. The fallback is 95.7 seconds,
including inter-scene pauses and a short tail. Its soundtrack is generated
from oscillators and contains no external audio assets.

## Reproducibility

`?capture=1` disables automatic time advance, not the UI. Each output frame
advances the app by exactly 1/20 display second, with the app's normal ¼×
visual time scale. The cursor moves briefly before real clicks/drags, then
stays parked. The export is exercised as an actual download.

`--preview /tmp/split-drive-checks` checks composition and writes a preview
without generating audio. `--output /path/demo.mp4` changes the destination.
`BROWSER_EXECUTABLE=/path/to/chromium` selects an installed browser.
The renderer also writes a gallery thumbnail and fully decodes the final MP4.
GitHub Actions runs tests, checks video streams and secrets, and commits the
finished media and refreshed gallery/index back to `main`.
