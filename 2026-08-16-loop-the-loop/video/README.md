# loop-the-loop video

`loop-the-loop-zh-fish.mp4` is the Chinese story video for the August 16
project (National Roller Coaster Day), using Fish Audio's `s2.1-pro-free`
model and the 哈基米 voice. It introduces the one rule (a rail can only
push → v² ≥ g·r → release at 2.5r), drags the release handle onto the 2.5r
line and dispatches (weightless crest, 6 g entry), drops the height so the
car leaves the rail where N goes negative, rescues the same run with upstop
wheels, switches Prescott's 1898 circle for the 1976 clothoid teardrop
(peak g 6 → 3.4 on the same release), lets the friction preset stall and
roll back at 2.5× playback, and ends on the airtime hills. `render_video.py`
is the local-TTS fallback.

The Fish version uses the REST `/v1/tts` endpoint. The renderer automatically
loads `FISH_AUDIO_API_KEY` from the repository-root `.env`; an
already-exported environment variable takes precedence. The key is never
stored in this folder, source code, or generated metadata.

## Re-render

From the repository root:

```bash
python3 2026-08-16-loop-the-loop/video/render_video.py       # local fallback
python3 2026-08-16-loop-the-loop/video/render_fish_video.py  # Fish Audio; reads .env
```

To override the local value for one run:

```bash
FISH_AUDIO_API_KEY=... python3 2026-08-16-loop-the-loop/video/render_fish_video.py
```

Both scripts serve the project temporarily on a free local port, capture the
actual UI with headless Chrome, burn in Chinese subtitles, and write a
1920×1080 MP4 plus a matching `.srt`. The simulation is stepped
deterministically frame-by-frame via the app's `__demo` API (`setPaused`
plus `stepDraw`), so the coaster motion is identical on every render; the
rollback segment runs at 2.5× playback. The cursor stays parked during
narration and makes short eased moves before the real clicks (dispatch,
preset chips, the upstop checkbox) and the release-handle drag.
