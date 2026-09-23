# Headway walkthrough

A 1920 × 1080, 15 fps recording of the actual app: the outbound flight with a tailwind, a crosswind flight with a 51° crab, the impossible homeward leg with its reachable cone, and a slow successful return in a lighter wind. Chinese narration uses the established Fish Audio `s2.1-pro-free` model and 哈基米 voice. Captions are burned into the picture and supplied separately as SRT.

From the workspace root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-09-24-headway/video/render_video.py \
  --output 2026-09-24-headway/video/headway-zh-fish.mp4
```

Requires Python Playwright, its Chromium browser, and `ffmpeg`/`ffprobe`. The shared renderer reads `FISH_AUDIO_API_KEY` from the ignored workspace-root `.env`; an environment value takes precedence. Never put the key in an argument, source file, or metadata.

The page's own animation loop is switched off during recording (`headway.setAutoplay(false)`). Every frame calls `headway.tick(1/15, rate)`, so the wind streaks and flights move at the same speed however long each screenshot takes. Flights run at 0.2 flight-hours per second, and the final slow return runs at 0.7.

The opening keeps the user's GLM 五点二 series-host introduction. The builder attribution in the project README is Claude Opus 5.5. The spoken year is 一八五二年; its subtitle is 1852 年. The cursor stays parked during narration and moves briefly before each click.

To inspect the framing before narration:

```sh
python3 2026-09-24-headway/video/render_video.py --preview /tmp/headway-video-preview
```

`python3 2026-09-24-headway/verify_build.py` runs the app tests, `ffprobe`, a full decode, the SRT and narration checks, and a secret scan, then writes `VALIDATION.md`. Afterwards, move the printed `cattery-fish-video-build-*` work directory to macOS Trash.
