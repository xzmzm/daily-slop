# Turn Order video

Chinese walkthrough of the October 16, 2026 project, introducing GPT-6.1 Sol.
It replays the two orders, checks the 180° exception, tries the four-turn
loop and a single-axis cancellation, then builds an X/Z sequence.

## Render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-16-turn-order/video/render_video.py \
  --output 2026-10-16-turn-order/video/turn-order-zh-fish.mp4
```

Uses Fish Audio `s2.1-pro-free` and voice reference
`95d2e56952b446189d6160a821a08707`. The root `.env` supplies the key;
an existing environment variable takes precedence. Credentials stay out of
the project, metadata, and output.

The verified recording is 67.2 seconds. Output: 1920 × 1080, 15 fps,
H.264/AAC, burned-in Chinese captions,
matching SRT, and provider/timing metadata. The small browser bar shows the
deployment URL and labels the footage as a local recording. The video uses
the actual app controls and the same rotation model, with a deterministic
playback clock. Cursor motion is short, eased, and slightly curved before
each click; it stays parked during narration.

## Verification

```sh
python3 2026-10-16-turn-order/video/render_video.py --preview /tmp/turn-order-video-preview
node 2026-10-16-turn-order/test_model.cjs
python3 2026-10-16-turn-order/test_browser.py
ffprobe -v error -show_streams -show_format 2026-10-16-turn-order/video/turn-order-zh-fish.mp4
ffmpeg -v error -i 2026-10-16-turn-order/video/turn-order-zh-fish.mp4 -f null -
git diff --check
```

The capture asserts the expected physical results at each demonstrated
step and checks the experiment and observation remain above the subtitles.
Identical still frames are copied between subtitle changes; animated turns
and cursor movements are captured individually. After the full decode and
secret scan, move `cattery-fish-video-build-*` to macOS Trash.
