# Comet Bounce video

`comet-bounce-zh-fish.mp4` is the 1920×1080 Chinese narrated demonstration, with matching `.srt` captions. It records the local app while showing the intended public URL and a LOCAL RECORDING badge. The narration separates Philae's actual 12 November 2014 landing and nearly two-hour bounce from this illustrative 2D simulation; it does not claim to reconstruct the flight or the battery history.

The recording advances the simulation deterministically in short integration steps and asserts the rebound, settled, anchored, and escaped outcomes. The cursor stays parked except for short eased movements before actual clicks. Static frames are hard-linked, avoiding thousands of redundant temporary image copies.

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-12-comet-bounce/video/render_video.py \
  --output 2026-11-12-comet-bounce/video/comet-bounce-zh-fish.mp4
```

Framing previews without narration: `python3 2026-11-12-comet-bounce/video/render_video.py --preview <dir>`.

The shared renderer reads `FISH_AUDIO_API_KEY` from the environment or the root `.env`. See the [shared video workflow](../../2026-08-08-cattery/video/README.md) for voice and rendering details.
