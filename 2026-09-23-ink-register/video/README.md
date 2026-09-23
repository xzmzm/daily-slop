# Ink Register walkthrough

A 72-second, 1920 × 1080, 15 fps recording of the actual app: separate the plates, drag and rotate the orange ink, change the palette and composition, reset registration, hide the marks, and export a real PNG. Chinese narration uses the established Fish Audio `s2.1-pro-free` model and 哈基米 voice. The 22 captions are burned into the picture and supplied separately as SRT.

From the workspace root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-09-23-ink-register/video/render_video.py \
  --output 2026-09-23-ink-register/video/ink-register-zh-fish.mp4
```

Requires Python Playwright, its Chromium browser, and `ffmpeg`/`ffprobe`. The shared renderer reads `FISH_AUDIO_API_KEY` from the ignored workspace-root `.env`; an environment value takes precedence. Never put the key in an argument, source file, or metadata.

The opening introduces the project's actual builder, GPT-6 Astra: the spoken form is GPT 六 Astra, while its subtitle keeps GPT-6 Astra, matching the attribution in the project README. The spoken year is 一八八九年, while its subtitle is 1889 年. Browser chrome displays the deploy URL and labels the recording as local. The cursor remains still during narration and moves briefly before a click or the demonstrated drag. Still frames with identical captions use hard links to avoid wasting disk space. The final encode runs once and includes fast-start metadata.

To inspect the framing before narration:

```sh
python3 2026-09-23-ink-register/video/render_video.py --preview /tmp/ink-register-video-preview
```

After rendering, run the project tests, inspect `ffprobe` output, fully decode the MP4 with `ffmpeg -v error -i … -f null -`, check the SRT and secret scan, then move the printed `cattery-fish-video-build-*` work directory to macOS Trash.

`python3 2026-09-23-ink-register/verify_build.py` performs those app, stream, decode, subtitle, and credential checks and writes `VALIDATION.md`. Run the gallery builder separately, and use `git diff --check` before committing.
