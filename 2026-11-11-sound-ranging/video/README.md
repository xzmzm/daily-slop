# Sound Ranging video

`sound-ranging-zh-fish.mp4` is the Chinese narrated demonstration, with matching `.srt` captions. It records the local app while showing the intended public URL in the browser bar. The narration explains William Lawrence Bragg's sound ranging system on the Western Front, the Tucker hot-wire microphone and Bull string galvanometer, hyperbolic multilateration (TDOA), Bragg's atmospheric corrections, and the historic 11 November 1918 Armistice at 11:00 AM.

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-11-sound-ranging/video/render_video.py \
  --output 2026-11-11-sound-ranging/video/sound-ranging-zh-fish.mp4
```

Framing previews without narration: `python3 2026-11-11-sound-ranging/video/render_video.py --preview <dir>`.

The shared renderer reads `FISH_AUDIO_API_KEY` from the environment or the root `.env`. See the [shared video workflow](../../2026-08-08-cattery/video/README.md) for voice and rendering details.
