# Twice at One video

Chinese narration by Fish Audio `s2.1-pro-free`, voice reference `95d2e56952b446189d6160a821a08707`. Opens with the builder's name, GPT-6.1 Sol (spoken “GPT 六点一 Sol”).

The six scenes introduce today's UK clock change, show the two tracks, select both 01:30 occurrences, step across the exact seam, then finish past the repeated hour. Real browser controls are used for selections and range changes. The cursor moves briefly with easing before interaction and stays parked during explanations. The seam is advanced deterministically during capture, so TTS and machine speed do not affect the boundary demonstration.

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-25-twice-at-one/video/render_video.py \
  --output 2026-10-25-twice-at-one/video/twice-at-one.mp4
```

Run from the repository root. The shared renderer reads the Fish key from the shell environment or root `.env`. The output is 1920×1080 H.264/AAC with burned Chinese captions, matching SRT and provider metadata. Its browser chrome displays the production URL and identifies it as a local recording.

Preview framing without TTS:

```sh
python3 2026-10-25-twice-at-one/video/render_video.py --preview /tmp/twice-at-one-preview
```

See the [shared video workflow](../../2026-08-08-cattery/video/README.md).
