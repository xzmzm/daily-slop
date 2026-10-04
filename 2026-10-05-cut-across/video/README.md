# Cut Across — Chinese walkthrough

A narrated recording of the continuity lab: see the two cameras on a floor
plan, play alternating shots, move camera B across the actors' axis, and watch
the characters change screen sides without moving in the room.

The October 5 prompt came from the 1962 London premiere of *Dr. No*. The lab
illustrates a general filmmaking convention; it makes no claim that this film
invented it. The closing narration also notes that showing a camera move or
deliberately disorienting the viewer can make crossing the line a useful choice.

Uses Fish Audio `s2.1-pro-free` and the configured 哈基米 voice through the shared
cattery renderer. The opening names **GPT-6**, spoken “GPT 六”. The year 1962
is spoken 一九六二年; subtitles keep ordinary digits. The finished video is
65.72 seconds at 1920 × 1080 / 15 fps, with Chinese captions burned in and a
matching 12-cue SRT.

## Re-render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-05-cut-across/video/render_video.py \
  --output 2026-10-05-cut-across/video/cut-across-zh-fish.mp4
```

The shared renderer reads `FISH_AUDIO_API_KEY` from the ignored workspace `.env`,
with an existing environment variable taking precedence. Never include the value
in source, metadata, command arguments or logs. Requires Python Playwright,
Chromium, `ffmpeg` and `ffprobe`.

## Capture details

The browser chrome shows the production project URL and labels the capture
**LOCAL RECORDING**. The app's manual clock advances by one fifteenth of a second
for each recorded frame. The footage uses the real playback and camera preset
buttons, asserts their resulting state, and checks that both shots appear in
each comparison. The pointer stays parked during narration; before each real
click it makes a short, eased, slightly curved movement and settles. Captions
are timed proportionally within each spoken segment.

Preview the framing with a fresh temporary directory:

```sh
python3 2026-10-05-cut-across/video/render_video.py --preview "$(mktemp -d)/preview"
```

After rendering, run the project checks, `ffprobe`, a full `ffmpeg -f null -`
decode, `git diff --check`, and a secret scan. Then move the printed
`cattery-fish-video-build-*` directory to macOS Trash.

The finished build passed all six core geometry tests, the browser checks
(controls, playback, drag and mobile layout), stream probing, a full decode,
subtitle timing and narration checks, `git diff --check`, and an exact-key and
token-pattern secret scan. Both temporary render directories were moved to
Trash. Opening and crossed-camera frames were also checked visually.

Sources: [BFI on the Dr. No premiere](https://www.bfi.org.uk/features/happy-50th-anniversary-mr-bond)
and [Adobe on the 180-degree rule](https://www.adobe.com/uk/creativecloud/video/discover/what-is-the-180-degree-rule.html).
