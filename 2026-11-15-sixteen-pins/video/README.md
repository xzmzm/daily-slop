# Sixteen Pins video adapter

A **six-segment** Chinese demonstration, rendered at **1920×1080 / 15 fps**,
with H.264 video, AAC narration, burned-in captions, and a matching SRT. The
opening credits **GLM-5.3 Flash**, spoken as "GLM 五点三 Flash". November 15
marks the day the first microprocessor ad ran in *Electronic News* (1971) —
the app itself replays the 4004's busiest bottleneck, its 16-pin bus.

- [Watch the video](sixteen-pins-zh-fish.mp4)
- [Subtitles](sixteen-pins-zh-fish.srt)
- [Render metadata](sixteen-pins-zh-fish.json)

The full ffmpeg decode and all browser timing checks passed after rendering.

## Offline preview

From the repository root, with Python Playwright and its Chromium installed:

```sh
PREVIEW=$(mktemp -d /tmp/sixteen-pins-preview-XXXXXX)
python3 2026-11-15-sixteen-pins/video/render_video.py --preview "$PREVIEW"
```

This reads the local app and writes `start.png` plus five `stop-*.png` stills
into the supplied directory. It does not read the workspace `.env`, request
speech, or assemble a movie.

## Six scenes

Every scene lands on a deterministic bus state: the page runs with
`reduced_motion`, so the sweep commits instantly and each narration starts
on a state the adapter asserts (`SixteenPins.getState()` — width, chore,
periods).

1. Introduce the premise on the as-built package (16 pins, four amber data
   leads, 72 periods for the add chore).
2. Click *Replay the sweep* → the full timeline: A1 A2 A3 address chunks,
   M1 M2 word fetches, X1–X3 execution; 3 of every 8 periods are address.
3. Click *20 pins* → address in two chunks, 54 periods, 73.0 µs.
4. Click *24 pins* → the whole address in one period, 60.8 µs, fantasy bay
   drawn.
5. Click *28 pins*, then *Multiply 7 × 5* → the 24/28 tie; the word fetch
   sets the floor (101.4 µs).
6. Click *Refresh the register display*, then back to *16 pins* → 144
   periods, 194.6 µs, a third of them address — the closing beat.

Scene transitions happen in 3.2-second silent gaps (1.6 s after the last).
The pointer takes a short eased, slightly curved route immediately before
each real click, settles briefly, and remains at that click location
throughout the next narration. It never drifts during speech. Repeated
static frames are hard-linked rather than captured repeatedly.

Framing asserts the longest subtitle and that package, timeline, compare
panel, sidebar and footnotes stay above the caption band; the chore listing
is hidden during recording to keep the sidebar inside the frame.

## Shared rendering interface

`render_video.py` follows the November 14 adapter and imports the existing
cattery capture helpers. It exports `ROOT_DIR`, `SEGMENTS`, `SUBTITLE_LINES`,
`FPS`, `WIDTH`, `HEIGHT`, `SILENCE_BETWEEN`, `SILENCE_TAIL`, `duration`,
`free_port`, `wait_for_server`, `write_srt`, `capture_frames`, and
`assemble` for the shared Fish renderer. Subtitles are burned into captured
frames; the shared writer also emits the matching SRT.
