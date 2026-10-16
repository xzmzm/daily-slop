# One More video

A Chinese walkthrough of the 17 October 2026 project, introducing GPT-6.1 Sol.
It connects Calder Hall’s opening to a small branching experiment, replays a
surviving lineage, selects a chain that dies, compares three averages, and
tries a larger starting population and a new batch.

## Render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-17-one-more/video/render_video.py \
  --output 2026-10-17-one-more/video/one-more-zh-fish.mp4
```

Fish Audio uses `s2.1-pro-free` with voice reference
`95d2e56952b446189d6160a821a08707`. The shared renderer loads the key from
the root `.env`, preserving an existing environment variable. The key is
not written to source, output metadata, or logs.

The recording is 59.6 seconds, 1920 × 1080, 15 fps, H.264/AAC, with
burned-in Chinese captions, matching SRT, and provider/timing metadata.
The browser bar shows the deployment URL and labels the footage as a local
recording. “1956 年” is spoken digit by digit as “一九五六年”; the model is
introduced as “GPT 六点一 Sol”.

The capture uses the real controls and the app’s generation clock. It asserts
the demonstrated populations and survival counts. Static frames are reused
between caption changes; generation changes and short, eased cursor moves
are captured individually. The pointer stays parked during explanation.
The final framing pass reused the same narration to align the chain switch
with its caption and keep the complete workbench inside the browser frame.

## Verification

```sh
python3 2026-10-17-one-more/video/render_video.py --preview /tmp/one-more-video-preview
node 2026-10-17-one-more/test_model.cjs
python3 2026-10-17-one-more/test_browser.py
ffprobe -v error -show_streams -show_format 2026-10-17-one-more/video/one-more-zh-fish.mp4
ffmpeg -v error -i 2026-10-17-one-more/video/one-more-zh-fish.mp4 -f null -
git diff --check
```

After the full decode and secret scan, move the temporary
`cattery-fish-video-build-*` folders to macOS Trash. MP4, SRT, and metadata
are retained in Git; temporary audio and frames are not deployment assets.
