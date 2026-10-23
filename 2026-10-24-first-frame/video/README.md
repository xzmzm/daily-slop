# First Frame video

1920×1080 Chinese walkthrough of the live app, with Fish Audio `s2.1-pro-free`, the shared user voice, burned-in captions, and matching SRT. Model attribution: GPT-6.1 Sol, spoken “GPT 六点一 Sol”. Historical years are spoken digit by digit.

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py --project-module 2026-10-24-first-frame/video/render_video.py --output 2026-10-24-first-frame/video/first-frame.mp4
```

The shared renderer reads the environment or ignored root `.env`. Capture uses a temporary local server; browser chrome displays `https://dailyslop.pages.dev/2026-10-24-first-frame/` and explicitly labels the local procedural recording. The cursor makes short eased movements before actual clicks and keyboard-driven lens adjustments.

Preview composition without generating narration:

```sh
python3 2026-10-24-first-frame/video/render_video.py --preview /tmp/first-frame-preview
```

After a successful render, verify with ffprobe, a full ffmpeg decode, project browser checks, whitespace and secret scans. Move the generated `cattery-fish-video-build-*` folder to macOS Trash after verification.
