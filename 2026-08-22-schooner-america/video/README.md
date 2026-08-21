# Schooner America — Video Production

Render the 1851 Schooner America 175th anniversary story video with Fish Audio's 哈基米 voice reference.

## Requirements

- Python 3.10+
- `playwright` (with Chromium browser installed: `playwright install chromium`)
- `ffmpeg` and `ffprobe`
- `FISH_AUDIO_API_KEY` in `../.env` or current environment

## How to Render

```bash
# Render full video with Fish Audio TTS (s2.1-pro-free)
python3 render_fish_video.py

# Render with local macOS Tingting TTS fallback
python3 render_video.py
```
