# Two Noons video adapter

A **six-segment** Chinese walkthrough, rendered at **1920×1080 / 15 fps**,
with H.264 video, AAC narration, burned-in captions, and a matching SRT. The
opening credits **Claude Opus 5.5**, spoken as "Claude Opus 五点五".

- [Watch the video](two-noons-zh-fish.mp4)
- [Subtitles](two-noons-zh-fish.srt)
- [Render metadata](two-noons-zh-fish.json)

## Render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-18-two-noons/video/render_video.py \
  --output 2026-11-18-two-noons/video/two-noons-zh-fish.mp4
```

## Offline dry run

```sh
python3 2026-11-18-two-noons/video/render_video.py --preview "$(mktemp -d)"
```

This captures the whole video silently, using narration lengths estimated at
5.6 characters per second. It runs every assertion and keeps two stills per
scene. It reads no keys and makes no TTS calls.

## The recording owns the clock

The page runs in `Noons.manual(true)` mode. During narration *n*, Greenwich
time moves linearly through `WINDOWS[n]`. In the silent gap after it the time
holds while the cursor makes real clicks.

| Scene | GMT window | What happens |
| --- | --- | --- |
| 1 | 15:30 → 16:46 | the premise; Halifax and Saint John reset at 16:00 |
| 2 | 16:46 → 17:02 | New York: sun noon at 16:56, set back at 17:00 |
| 3 | 17:02 → 17:10 | click Pittsburgh: the 20-minute jump |
| 4 | 17:10 → 18:03 | click Detroit: set back 27 min 48 s at 18:00 |
| 5 | 18:03 → 19:02 | click the map at 100° W, 35° N: a pin set back 20:00 at 19:00 |
| 6 | 19:02 → 20:30 | Pacific noon; tally 21 reset, 7 twice, 14 forward |

Assertions between scenes check the figures each narration quotes: two red
dots on New York's trace, 9 stations reset by 17:00, Detroit's 27.8 min, the
pin landing on exactly 100° W in the Mountain zone, and 21 / 7 / 14 at the end.
Framing asserts that the longest subtitle stays clear of the masthead, map,
controls, trace and tally.

## Shared rendering interface

`render_video.py` imports the cattery capture helpers and exports `ROOT_DIR`,
`SEGMENTS`, `SUBTITLE_LINES`, `FPS`, `WIDTH`, `HEIGHT`, `SILENCE_BETWEEN`,
`SILENCE_TAIL`, `duration`, `free_port`, `wait_for_server`, `write_srt`,
`capture_frames`, and `assemble` for the shared Fish renderer.
