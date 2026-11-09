# Set Point video

`set-point-zh-fish.mp4` is the Chinese narrated demonstration, with matching `.srt` captions. It records the local app while showing the intended public URL in the browser bar. The recorder switches the app to manual stepping (`SetPointApp.state.manual`) so each trip and collapse lands on the narration.

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-09-set-point/video/render_video.py \
  --output 2026-11-09-set-point/video/set-point-zh-fish.mp4
```

Framing previews without narration: `python3 2026-11-09-set-point/video/render_video.py --preview <dir>`.

The shared renderer reads `FISH_AUDIO_API_KEY` from the environment or the root `.env`. See the [shared video workflow](../../2026-08-08-cattery/video/README.md) for voice and rendering details.
