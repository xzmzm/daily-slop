# 1888 Burroughs Adding Machine Story Video

Story video script and rendering pipeline for **1888 Burroughs Adding Machine Studio** (`2026-08-21-burroughs-adder`).

## Workflow

- Render with Fish Audio 哈基米 voice:
  ```bash
  python3 2026-08-21-burroughs-adder/video/render_fish_video.py
  ```
- Fallback local TTS render (macOS Tingting):
  ```bash
  python3 2026-08-21-burroughs-adder/video/render_video.py
  ```

Output is saved to `2026-08-21-burroughs-adder/video/burroughs-adder.mp4` with a matching `burroughs-adder.srt` subtitle file.
