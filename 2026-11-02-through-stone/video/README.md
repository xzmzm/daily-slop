# Through Stone video

`through-stone-zh-fish.mp4` is the Chinese narrated demonstration, with matching `.srt` captions. It records the local app while showing the intended public URL in the browser bar.

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-02-through-stone/video/render_video.py \
  --output 2026-11-02-through-stone/video/through-stone-zh-fish.mp4
```

The shared renderer reads `FISH_AUDIO_API_KEY` from the environment or the root `.env`. See the [shared video workflow](../../2026-08-08-cattery/video/README.md) for voice and rendering details.
