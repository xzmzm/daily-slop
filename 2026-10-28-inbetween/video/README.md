# Inbetween video

`inbetween-zh-fish.mp4` is the 1920×1080 Chinese walkthrough with burned-in captions and a matching `inbetween-zh-fish.srt`. Its browser chrome shows the public project URL and identifies the local recording.

The narration credits GPT-6.1 Sol, spoken “GPT 六点一 Sol”, introduces International Animation Day, compares equal spacing with acceleration and deceleration, drags the seventh drawing on the chart, and finishes with easing at both ends.

## Re-render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-28-inbetween/video/render_video.py \
  --output 2026-10-28-inbetween/video/inbetween-zh-fish.mp4
```

The shared renderer uses Fish Audio `s2.1-pro-free` and voice reference `95d2e56952b446189d6160a821a08707`. It loads the key from the root `.env`, with an exported variable taking precedence.

The adapter clicks real controls and drags a real chart dot. A deterministic recording clock advances the app’s own playback model between captures. The cursor stays parked during narration and follows short eased curved movements before clicks or dragging. Frames are reused when the drawing, caption and cursor have not changed. Framing assertions keep the desk above the captions; capture assertions check the custom edit and final pose.

For a framing preview:

```sh
python3 2026-10-28-inbetween/video/render_video.py --preview /tmp/inbetween-video-preview
```

After rendering, run `ffprobe`, fully decode with `ffmpeg -f null -`, rerun both project checks, run `git diff --check`, scan new files for secrets, and move the generated `cattery-fish-video-build-*` directory to macOS Trash.
