# barium glow video

`barium-glow-zh-fish.mp4` is the Chinese story video for the November 8
project, rendered with the shared Fish Audio pipeline (`s2.1-pro-free`, the
user's voice reference). It introduces Röntgen's night of 8 November 1895,
toggles the cardboard cover and raises the tube voltage to make the barium
screen jump, then takes plates of the book (hidden paperclip), the wood
(hidden nail), the hand at 60 kVp / 12 mA·s, and the lead disc that stops
everything. Burned-in Chinese subtitles; a matching `.srt` sits alongside.

## Re-render

From the repository root:

```bash
python3 2026-11-08-barium-glow/video/render_video.py --preview /tmp/barium-video-preview  # framing stills
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-08-barium-glow/video/render_video.py \
  --output 2026-11-08-barium-glow/video/barium-glow-zh-fish.mp4
```

The renderer loads `FISH_AUDIO_API_KEY` from the repository-root `.env`
(existing environment variables take precedence; the key is never copied into
this folder or its metadata). It serves the repo on a free local port, drives
the app through the deterministic recording clock, captures 15 fps frames,
and assembles a 1920×1080 MP4. The cursor stays parked during narration and
moves only for real clicks (cover toggle, object buttons, expose/fix).
Build directories named `barium-glow-*video-build-*` (the shared pipeline
creates `cattery-fish-video-build-*` ones) must be moved to Trash after
verification.
