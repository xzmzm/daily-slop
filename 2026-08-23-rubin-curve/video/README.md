# Rubin Curve — Video Production

Render the Vera Rubin birthday / flat rotation-curve story video with Fish
Audio's 哈基米 voice reference.

## Requirements

- Python 3.10+
- `playwright` (with Chrome channel available)
- `ffmpeg` and `ffprobe`
- `FISH_AUDIO_API_KEY` in `../.env` or current environment

## How to Render

```bash
# Render full video with Fish Audio TTS (s2.1-pro-free)
python3 render_fish_video.py

# Render with local macOS Tingting TTS fallback
python3 render_video.py
```

The script drives the real app through `window.__demo` scenarios
(`m31-1970` → measurement sweep → `visible-fails` → `reveal-halo`), captures
15 fps frames at 1920×1080 with the browser chrome and burned-in captions,
and writes `rubin-curve.mp4` + `rubin-curve.srt` next to this README.
