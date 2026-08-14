# waggle-room video

`waggle-room-zh-fish.mp4` is the Chinese story video for the August 15 project
(World Honey Bee Day), using Fish Audio's `s2.1-pro-free` model and the 哈基米
voice. It introduces the encoding rule (angle from vertical = angle from the
sun, duration = distance), drags the flowers, slides the sun from noon toward
evening to show time-compensation, switches hive dialects, collapses the dance
into a round dance at the hive, then plays one recruit round in the dark and
grades the guess. `render_video.py` is the local-TTS fallback.

The Fish version uses the REST `/v1/tts` endpoint. The renderer automatically
loads `FISH_AUDIO_API_KEY` from the repository-root `.env`; an already-exported
environment variable takes precedence. The key is never stored in this folder,
source code, or generated metadata.

## Re-render

From the repository root:

```bash
python3 2026-08-15-waggle-room/video/render_video.py       # local fallback
python3 2026-08-15-waggle-room/video/render_fish_video.py  # Fish Audio; reads .env
```

To override the local value for one run:

```bash
FISH_AUDIO_API_KEY=... python3 2026-08-15-waggle-room/video/render_fish_video.py
```

Both scripts serve the project temporarily on a free local port, capture the
actual UI with headless Chrome, burn in Chinese subtitles, and write a
1920×1080 MP4 plus its matching `.srt` file. The cursor stays parked during
narration and scrolling; it only makes short eased moves before real drags
and clicks (flowers, the solar-time slider, the dialect button, the game
round, and the guess on the dark cover). The recruit guess is scripted to
land 30° clockwise and 1.5× the true distance, which grades C on purpose —
with in-canvas fallbacks so the click always lands on the cover.
