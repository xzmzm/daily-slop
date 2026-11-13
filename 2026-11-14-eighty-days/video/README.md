# Eighty Days video adapter

A **six-segment** Chinese demonstration, rendered at **1920×1080 / 15 fps**,
with H.264 video, AAC narration, burned-in captions, and a matching SRT. The
opening credits **GLM-5.3 Flash**, spoken as "GLM 五点三 Flash". November 14
marks the day Nellie Bly sailed from Hoboken in 1889 — the app itself is the
real timetable replayed as a game.

- [Watch the video](eighty-days-zh-fish.mp4)
- [Subtitles](eighty-days-zh-fish.srt)
- [Render metadata](eighty-days-zh-fish.json)

The full ffmpeg decode and all 9 model / 12 browser tests passed after
rendering. These video files are Git artifacts; the Pages app bundle does not
publish MP4 or SRT files.

## Offline preview

From the repository root, with Python Playwright and its Chromium installed:

```sh
PREVIEW=$(mktemp -d /tmp/eighty-days-preview-XXXXXX)
python3 2026-11-14-eighty-days/video/render_video.py --preview "$PREVIEW"
```

This reads the local app (including `model.js`) and writes `start.png`,
`stop-southampton.png`, `stop-brindisi.png`, `stop-aden.png`,
`stop-hongkong.png`, `stop-chicago.png`, and `finish.png` into the supplied
directory. It does not read the workspace `.env`, request speech, or assemble
a movie.

## Seven scenes

The trip is driven by real clicks on the departure buttons; the page runs
with `reduced_motion` so each leg commits instantly and every scene starts
on a deterministic port.

1. Introduce the premise on the Hoboken board (two Atlantic liners, the
   pace bar with the N/B/V marks).
2. Click the *Augusta Victoria* → arrive Southampton, 2:30 a.m. on day 8.
3. Boat train → London, then the Paris route → Brindisi (the Verne detour
   that costs nothing).
4. P&O *Victoria* → Port Said, canal convoy → Aden.
5. Aden mail → Colombo → Penang → Singapore → Hong Kong (four quick clicks
   in one gap), landing on Christmas morning.
6. *Oceanic* → Yokohama, the Pacific crossing (the "180th meridian crossed"
   log entry), Overland Limited → Chicago.
7. In the closing gap, book the World special → the "A perfect run —
   72d 6h 11m" modal is the end beat.

Scene transitions happen in 3.2-second silent gaps (1.6 s after the last).
The pointer takes a short eased, slightly curved route immediately before
each real click, settles briefly, and remains at that click location
throughout the next narration. It never drifts during speech. Repeated
static frames are hard-linked rather than captured repeatedly.

Assertions after each gap compare the port card, home clock and state with
`EightyApp.getState()` / `EightyDays` (including the date-line log entry and
the exact record modal text). Framing asserts the longest subtitle and that
map, sidebar and footnotes stay above the caption band.

## Shared rendering interface

`render_video.py` follows the November 13 adapter and imports the existing
cattery capture helpers. It exports `ROOT_DIR`, `SEGMENTS`, `SUBTITLE_LINES`,
`FPS`, `WIDTH`, `HEIGHT`, `SILENCE_BETWEEN`, `SILENCE_TAIL`, `duration`,
`free_port`, `wait_for_server`, `write_srt`, `capture_frames`, and
`assemble` for the shared Fish renderer. Subtitles are burned into captured
frames; the shared writer also emits the matching SRT.
