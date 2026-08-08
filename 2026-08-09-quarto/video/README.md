# quarto video

`quarto-zh-fish.mp4` is the Chinese story video for the August 9 project,
using Fish Audio's `s2.1-pro-free` model and the 哈基米 voice model. The
earlier `quarto-zh.mp4` is the local-TTS fallback. It introduces the
counter-intuitive idea (a sheet's pages are not in reading order), clicks
through the live browser app — the sheet layout, the fold animation, the
page-turn in the booklet reader, and the math tab — and ends on the P+1
invariant.

The Fish version uses the REST `/v1/tts` endpoint. The renderer automatically
loads `FISH_AUDIO_API_KEY` from the repository-root `.env`; an already-exported
environment variable takes precedence. The key is never stored in this folder,
source code, or generated metadata.

## Re-render

From the repository root:

```bash
python3 2026-08-09-quarto/video/render_video.py       # local fallback
python3 2026-08-09-quarto/video/render_fish_video.py  # Fish Audio; reads .env
```

To override the local value for one run:

```bash
FISH_AUDIO_API_KEY=... python3 2026-08-09-quarto/video/render_fish_video.py
```

Both scripts serve the project temporarily on a free local port, capture the
actual UI with headless Chrome, burn in Chinese subtitles, and write a 1920×1080
MP4 plus its matching `.srt` file. The cursor stays parked during narration and
scrolling, and only makes short eased movements before real clicks (opening the
fold, switching to the Booklet tab, turning a leaf, switching to the Math tab).
The page-turn leaf animation is allowed to play out fully so the 3D fold is
visible.
