# tail-gambit video

`tail-gambit-zh-fish.mp4` is the 1920×1080 Chinese walkthrough, narrated by Fish Audio `s2.1-pro-free` with the configured 哈基米 voice. It records the real app, burns subtitles into the captured frames, includes the matching `.srt`, and displays the deployed gallery URL in its browser chrome.

From the repository root:

```bash
python3 2026-08-14-tail-gambit/video/render_fish_video.py
```

The renderer loads `FISH_AUDIO_API_KEY` from the process environment or the ignored root `.env`. The local fallback is `render_video.py`. Temporary build directories are retained until verification, then moved to macOS Trash.
