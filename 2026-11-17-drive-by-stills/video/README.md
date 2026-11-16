# Drive by Stills video adapter

A **six-segment** Chinese demonstration, rendered at **1920×1080 / 15 fps**,
with H.264 video, AAC narration, burned-in captions, and a matching SRT. The
opening credits **Claude Fable 5.2**, spoken as "Claude Fable 五点二".
November 17 is the day Lunokhod 1 reached the Moon (1970); the video drives
the same ground twice, once with a 21.1 s camera and once with a 3.2 s one.

- [Watch the video](drive-by-stills-zh-fish.mp4)
- [Subtitles](drive-by-stills-zh-fish.srt)
- [Render metadata](drive-by-stills-zh-fish.json)

## Render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-17-drive-by-stills/video/render_video.py \
  --output 2026-11-17-drive-by-stills/video/drive-by-stills-zh-fish.mp4
```

## Offline dry run

```sh
python3 2026-11-17-drive-by-stills/video/render_video.py --preview "$(mktemp -d)"
```

This captures the whole video silently with estimated narration lengths
(5.6 characters per second), runs every assertion below, and keeps two stills
per scene. It reads no keys and requests no speech. Run it before spending a
TTS call: the script depends on narration lengths (see "Timing").

## The recording owns the clock

The app is a real-time simulation, so screenshots taken at wall-clock speed
would not be reproducible. The adapter calls `Stills.manual(true)` and then
advances the rover by exactly `4 / 15` s of Moon time per captured frame
(the ×4 chip lit on the page), in whole 0.05 s simulation steps. The rover
keeps moving while narration plays.

Commands are real mouse clicks on the real pad. The two that open each drive
happen in a silent gap. The other two of the second drive (`TURN RIGHT` at
T+36.6 s, `FORWARD 2` at T+40.75 s) land during narration 4: the cursor makes
a short eased move just before each, the simulation clock is held at the
press time until the click lands, and then it catches up. These are the same
four commands at the same instants that `test_browser.py` uses.

## Six scenes

1. Parked beside the lander with one complete picture: the premise.
2. *Forward 2* with the 21.1 s camera. The rover stops itself at the crater
   rim at T+0:29; the first picture taken while moving arrives at T+0:43.
   Asserted before scene 3: one automatic stop, cause "crater rim".
3. *Show the ground truth*: the chart's fog of war against the full crater
   field.
4. The 3.2 s camera, *Turn left*, *Forward 2*, then the two timed commands.
5. Still driving: the command set, the gyro and the ninth wheel, and why the
   white box and the amber wedge sit in different places.
6. Arrived. Asserted before the narration: phase `arrived`, no automatic
   stops, odometer rounding to 59 m, under two minutes, which are the figures
   the narration quotes.

## Timing

The second drive takes 114 s of Moon time, 28.5 s of video. It starts about
2 s before narration 4, so narrations 4 and 5 plus the gap between them must
last at least 23 s or the rover has not arrived when narration 6 says it
has. The assertion in scene 6 catches that; lengthen the copy rather than
the gap. Scene transitions are 3.2 s silent gaps (1.6 s after the last).

Framing asserts the longest subtitle and that the masthead, picture, pad,
status line, chart, legend and sidebar stay above the caption band. The
footnotes are hidden during recording.

## Shared rendering interface

`render_video.py` imports the cattery capture helpers and exports `ROOT_DIR`,
`SEGMENTS`, `SUBTITLE_LINES`, `FPS`, `WIDTH`, `HEIGHT`, `SILENCE_BETWEEN`,
`SILENCE_TAIL`, `duration`, `free_port`, `wait_for_server`, `write_srt`,
`capture_frames`, and `assemble` for the shared Fish renderer.
