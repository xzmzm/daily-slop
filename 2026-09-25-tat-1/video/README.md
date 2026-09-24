# TAT-1 walkthrough

A 1920 × 1080, 15 fps recording of the actual app: opening day 1956 (silence
holds the line), TASI from June 1960 (72 calls on 37 circuits, colors trading
seats), a rush-hour run with clipped word-ends, and the echo story — a shout
crossing at 18.5 ms, the 37 ms round-trip echo, the suppressor eating it, and
the lockout when both ends talk at once. Chinese narration uses the
established Fish Audio `s2.1-pro-free` model and 哈基米 voice. Captions are
burned into the picture and supplied separately as SRT.

From the workspace root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-09-25-tat-1/video/render_video.py \
  --output 2026-09-25-tat-1/video/tat1-zh-fish.mp4
```

Requires Python Playwright, its Chromium browser, and `ffmpeg`/`ffprobe`. The
shared renderer reads `FISH_AUDIO_API_KEY` from the ignored workspace-root
`.env`; an environment value takes precedence. Never put the key in an
argument, source file, or metadata.

The page's own animation loop is switched off during recording
(`tat1.setAutoplay(false)`); every frame calls `tat1.tick(1/15)`, so the cable
pulses advance at the same speed however long each screenshot takes. For the
echo scene the crossing is briefly set to 7.5 screen seconds so the full round
trip fits inside its narration; the timing ratios stay exact.

The opening names the actual builder, matching the README's `Built by` line:
the subtitle shows GLM-5.3 and the narration reads GLM 五点三. Spoken years
are 一九五六年 / 一九六零年 / 一九七八年; subtitles keep 1956 年 / 1960 年 /
1978 年. The cursor stays parked during narration and moves briefly before
each click (presets, shout, suppressor).

To inspect the framing before narration:

```sh
python3 2026-09-25-tat-1/video/render_video.py --preview /tmp/tat1-video-preview
```

`python3 2026-09-25-tat-1/verify_build.py` runs the app tests, `ffprobe`, a
full decode, the SRT and narration checks, and a secret scan, then writes
`VALIDATION.md`. Afterwards, move the printed `cattery-fish-video-build-*`
work directory to macOS Trash.
