# Scan Line — Chinese walkthrough

A narrated recording of the photodiode bench: the laser sweeps a UPC-A at
quarter speed while the diode's waveform draws beneath the bars and the
twelve digits resolve one at a time; the maker half is then tampered through
the real digit input (`0 12345 6* 67890 5`) and the pass is refused for a
check-digit mismatch until FIX CHECK DIGIT reprints the honest one; a real
pointer drag smears ink across a digit block and the pattern stops
existing; the label is flipped 180° and scans again with the direction
badge reading R→L; finally the 1952 bullseye spins its ray to show the
same runs at every angle.

The October 7 prompt is the 1952 grant of US Patent 2,612,994 — Woodland
and Silver's "Classifying Apparatus and Method", the first bar code
patent. The closing narration covers the 1974 first scan (a ten-pack of
Juicy Fruit, now in the Smithsonian) and today's billions of daily scans.

Uses Fish Audio `s2.1-pro-free` and the configured 哈基米 voice through the
shared cattery renderer. The opening names **GLM-5.3**, spoken “GLM 五点三”.
Years are spoken digit by digit (一九七四年); subtitles keep ordinary digits
(1974 年), and non-year quantities stay as plain numbers. The finished
video is 1920 × 1080 at 15 fps with Chinese captions burned in and a
matching SRT.

## Re-render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-07-scan-line/video/render_video.py \
  --output 2026-10-07-scan-line/video/scan-line-zh-fish.mp4
```

The shared renderer reads `FISH_AUDIO_API_KEY` from the ignored workspace
`.env`, with an existing environment variable taking precedence. Never
include the value in source, metadata, command arguments or logs. Requires
Python Playwright, Chromium, `ffmpeg` and `ffprobe`.

## Capture details

The browser chrome shows the production project URL and labels the capture
**LOCAL RECORDING**. The app's manual clock advances one fifteenth of a
second per recorded frame. Scene 1 clicks the real ¼× speed button before
any pass completes, so the on-camera pass is slow enough to watch digits
pop; `sweep_to_result` only accepts a verdict from a pass that *started
after* the call, so a stale ACCEPTED left on screen never fakes a beat.
The footage uses the real digit input (click `#d7`, type `1`), the real
FIX CHECK DIGIT button, a real pointer drag on the label canvas for the
ink smear (modules ~24–27, an UNREADABLE DIGIT), the real FLIP 180°
button (asserting direction REV), and the real angle slider on the
bullseye. Every interaction asserts the resulting app state before
recording continues. The pointer stays parked during narration and
scrolling and only makes short eased, slightly curved moves before real
clicks. Captions are timed proportionally within each spoken segment.

Preview the framing with a fresh temporary directory:

```sh
python3 2026-10-07-scan-line/video/render_video.py --preview "$(mktemp -d)/preview"
```

After rendering, run the project checks, `ffprobe`, a full `ffmpeg -f null -`
decode, `git diff --check`, and a secret scan. Then move the printed
`cattery-fish-video-build-*` directories to macOS Trash.

Sources: [Wikipedia — Barcode](https://en.wikipedia.org/wiki/Barcode),
[Drexel on the inventors](https://drexel.edu/).
