# Twenty-Three Wide video adapter

A **seven-segment** Chinese demonstration, rendered at **1920×1080 / 15 fps**,
with H.264 video, AAC narration, burned-in captions, and a matching SRT. The
opening credits **GLM-5.3 Flash**, spoken as "GLM 五点三 Flash". November 16
marks the night the Arecibo dish beamed the first deliberate interstellar
message (1974) — the app re-wraps the real 1,679 bits until the one prime
width draws a picture, then replays the broadcast and the 25,000-year flight.

- [Watch the video](twenty-three-wide-zh-fish.mp4)
- [Subtitles](twenty-three-wide-zh-fish.srt)
- [Render metadata](twenty-three-wide-zh-fish.json)

The full ffmpeg decode and all browser timing checks passed after rendering.

## Offline preview

From the repository root, with Python Playwright and its Chromium installed:

```sh
PREVIEW=$(mktemp -d /tmp/twenty-three-preview-XXXXXX)
python3 2026-11-16-twenty-three-wide/video/render_video.py --preview "$PREVIEW"
```

This reads the local app and writes `start.png` plus six `stop-*.png` stills
into the supplied directory. It does not read the workspace `.env`, request
speech, or assemble a movie.

## Seven scenes

Every scene lands on a deterministic app state: the page runs with
`reduced_motion`, so the transmit fills instantly and the flight clock freezes
at its physically true start (167.9 light-seconds out); each narration starts
on a state the adapter asserts (`Arecibo.getState()`).

1. Introduce the premise on the as-received wrap: the real bits at 23 wide,
   the feed at 73-wide breaks, and the 1974 broadcast facts.
2. Click *73 · THE SLAB* — the same tape at the other prime factor; the
   semiprime fact card explains why only two rectangles exist.
3. Click *23 · THE MESSAGE* — the picture appears: numbers, elements,
   nucleotides, helix, human, solar system, antenna.
4. Click *PAINT THE STANDARD COLORS*, then the *human* pick — the decode:
   height 14 × 126 mm, the 1974 population, 4.3 billion base pairs vs today's
   3.2.
5. Click *LIFT THE PEN*, add one hat pixel above the figure's head, then
   *RESTORE* — the rectangle survives every edit; the 1974 bits come back.
6. Click *Transmit* (×100) — the tape fills, the front parks at ≈50,335,000 km
   (167.9 light-seconds, about 50 million km), the flight phase waits.
7. Click *SKIP TO ARRIVAL* — the year-26,974 card; closing beat.

Scene transitions happen in 3.2-second silent gaps (1.6 s after the last).
The pointer takes a short eased, slightly curved route immediately before
each real click, settles briefly, and remains at that click location
throughout the next narration. It never drifts during speech. Repeated
static frames are hard-linked rather than captured repeatedly.

Framing asserts the longest subtitle and that feed, grid, transmit panel,
sidebar and footnotes stay above the caption band; the section detail box is
hidden during recording to keep the sidebar inside the frame.

## Shared rendering interface

`render_video.py` follows the November 15 adapter and imports the existing
cattery capture helpers. It exports `ROOT_DIR`, `SEGMENTS`, `SUBTITLE_LINES`,
`FPS`, `WIDTH`, `HEIGHT`, `SILENCE_BETWEEN`, `SILENCE_TAIL`, `duration`,
`free_port`, `wait_for_server`, `write_srt`, `capture_frames`, and
`assemble` for the shared Fish renderer. Subtitles are burned into captured
frames; the shared writer also emits the matching SRT.
