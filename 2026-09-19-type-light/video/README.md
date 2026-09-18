# Type Light — video

A recorded walkthrough of the real app: source reveal, two-character
quantization, both dithering modes, resolution, palettes, and text export.
The visible address bar shows the deployment URL; frames are captured from
the local build, not represented as proof of an already completed deployment.

## Render

From the repository root, with ffmpeg/ffprobe, Node, and a Chinese font installed:

```sh
python3 -m pip install playwright pillow
python3 -m playwright install chromium
python3 2026-09-19-type-light/video/render_video.py
```

Outputs: `type-light.mp4`, `type-light.srt`, and `type-light.json`.
The MP4 is **1920 × 1080, 20 fps, H.264, AAC**, with burned-in Chinese
subtitles. Metadata states the audio mode and duration. The renderer also
captures the gallery thumbnail and rebuilds the manifest with `--no-shots`.
It ends with a full ffmpeg decode check.

## Audio, without surprises

When `FISH_AUDIO_API_KEY` is available, the script reuses the cattery Fish
Audio helper: `s2.1-pro-free`, voice reference
`ae5adc6778ac459e8d6106b82f88fa2b`. A shell variable takes precedence over
repository-root `.env`. Keys are never written to source, logs, or metadata.
GitHub Actions uses the repository secret of the same name, when configured.

Without a key, the renderer makes a **Chinese-captioned, original-music
edition with no spoken narration**. The badge in the video and its JSON
metadata say so. The 83.4-second fallback soundtrack is generated from sine
waves, not downloaded audio. `--captions-only` selects this version explicitly.
A configured Fish request that fails is reported as an error, not silently
replaced by a different voice.

## Reproducibility and checks

Playwright's clock advances by 50 ms per output frame. A small visible cursor
moves briefly before genuine page interactions and stays parked during
explanations. The script shares the cattery caption/browser-overlay helpers.
Chinese years are spelled digit by digit in spoken text; SRT retains digits.

```sh
node 2026-09-19-type-light/test.cjs
python3 2026-09-19-type-light/test_browser.py
ffprobe -v error -show_streams -show_format 2026-09-19-type-light/video/type-light.mp4
ffmpeg -v error -i 2026-09-19-type-light/video/type-light.mp4 -f null -
git diff --check
```

`--output /path/demo.mp4` changes the destination. `--max-seconds 3` creates
an explicitly marked preview; its SRT still contains the complete script.
`--inline` is for environments that block local URL navigation and skips the
native download click. `--skip-gallery` prevents gallery mutation when working
from a partial repository. Capture work directories are retained for diagnosis.

The dedicated GitHub Actions workflow runs tests, renders, uploads the video
artifact, and commits the generated media and thumbnail back to `main`.
