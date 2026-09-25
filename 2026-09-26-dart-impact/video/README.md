# DART walkthrough

A 1920 × 1080, 15 fps recording of the actual app: the idle binary system at
true scale, a dead-stick splat (β = 1, −9½ min) contrasted with the real DART
shove (β = 3.61, −33 min, flash, ejecta plume, exaggerated new ellipse), and
the mutual-event lightcurve whose drifting ticks are how the period change was
measured from Earth. Chinese narration uses the established Fish Audio
`s2.1-pro-free` model and 哈基米 voice. Captions are burned into the picture
and supplied separately as SRT.

From the workspace root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-09-26-dart-impact/video/render_video.py \
  --output 2026-09-26-dart-impact/video/dart-zh-fish.mp4
```

Requires Python Playwright, its Chromium browser, and `ffmpeg`/`ffprobe`. The
shared renderer reads `FISH_AUDIO_API_KEY` from the ignored workspace-root
`.env`; an environment value takes precedence. Never put the key in an
argument, source file, or metadata.

The page's own animation loop is switched off during recording
(`dart.setAutoplay(false)`); every frame calls `dart.tick(1/15)`, so the
orbital motion advances deterministically however long each screenshot takes.
Cursor moves only precede real clicks (splat preset, launch, back to the real
preset, the real launch); it stays parked during narration.

The opening names the actual builder, matching the README's `Built by` line:
the subtitle shows GLM-5.3 and the narration reads GLM 五点三. The one year
mentioned (2022) is spoken 二零二二年; subtitles keep 2022 年. Non-year
quantities (6.1 公里每秒, 570 公斤, 73 秒, 33 分钟, 2.8 毫米) stay as
ordinary numbers in the narration.

To inspect the framing before narration:

```sh
python3 2026-09-26-dart-impact/video/render_video.py --preview /tmp/dart-video-preview
```

`python3 2026-09-26-dart-impact/verify_build.py` runs the app tests, `ffprobe`,
a full decode, the SRT and narration checks, and a secret scan, then writes
`VALIDATION.md`. Afterwards, move the printed
`cattery-fish-video-build-*` work directory to macOS Trash.
