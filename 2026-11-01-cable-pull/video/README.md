# Cable Pull video

`cable-pull-zh-fish.mp4` is the Chinese narrated demonstration, with matching `.srt` captions. It shows the local app while the browser bar displays the intended public URL. It uses the shared Fish Audio renderer and the project-specific capture adapter.

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-01-cable-pull/video/render_video.py \
  --output 2026-11-01-cable-pull/video/cable-pull-zh-fish.mp4
```

The shared renderer reads `FISH_AUDIO_API_KEY` from the environment or the root `.env`. See the [shared video workflow](../../2026-08-08-cattery/video/README.md) for details.
