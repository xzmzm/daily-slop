# Locomotion No. 1 — video

Chinese-narrated 1080p tour of the adhesion studio, rendered with the shared
Fish Audio workflow (voice 哈基米, model `s2.1-pro-free`).

Render:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-09-27-locomotion/video/render_video.py \
  --output 2026-09-27-locomotion/video/locomotion-zh-fish.mp4
```

Outputs `locomotion-zh-fish.mp4` + `.srt` + `.json` (metadata) here. The
recording drives the real page: loads the opening-day train on the level,
stalls it on 1-in-33, spins the wheels under leaves, sands the rail, replays
the rope→horse→locomotive relay along the route profile, and coasts the
surveyed fall for the outro.

Layout previews only:

```sh
python3 video/render_video.py --preview /tmp/sdr-preview
```
