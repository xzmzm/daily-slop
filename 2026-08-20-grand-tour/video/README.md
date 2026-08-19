# Video Workflow · Voyager 2 Grand Tour

This folder contains the automated video rendering pipeline for the Voyager 2 Grand Tour project.

## Scripts

- `render_fish_video.py` — Primary production script rendering the video with Fish Audio's 哈基米 voice reference ID, generating `grand-tour-zh-fish.mp4`, `grand-tour-zh-fish.srt`, and `grand-tour-zh-fish.json`.
- `render_video.py` — Local fallback renderer using macOS built-in Tingting voice.
- `title.html` — Intro and outro title cards with animated SVG artwork.

## How to render

Ensure `FISH_AUDIO_API_KEY` is present in the workspace root `.env` file, then run:

```bash
python3 2026-08-20-grand-tour/video/render_fish_video.py
```
