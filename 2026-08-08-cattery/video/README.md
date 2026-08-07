# cattery video

`cattery-zh-fish.mp4` is the Chinese story video for the August 8 project,
using Fish Audio's `s2.1-pro-free` model and the 哈基米 voice model. The
earlier `cattery-zh.mp4` is the local-TTS fallback.
It introduces the idea, clicks through the live browser app, shows the
expected-vs-actual ratios and Punnett square, and ends on the seven-locus
cheat sheet.

The Fish version uses the REST `/v1/tts` endpoint. The renderer automatically
loads `FISH_AUDIO_API_KEY` from the repository-root `.env`; an already-exported
environment variable takes precedence. The key is never stored in this folder,
source code, or generated metadata.

## Re-render

From the repository root:

```bash
python3 2026-08-08-cattery/video/render_video.py       # local fallback
python3 2026-08-08-cattery/video/render_fish_video.py  # Fish Audio; reads .env
```

To override the local value for one run:

```bash
FISH_AUDIO_API_KEY=... python3 2026-08-08-cattery/video/render_fish_video.py
```

Both scripts serve the project temporarily on a free local port, capture the
actual UI with headless Chrome, burn in Chinese subtitles, and write a 1920×1080
MP4 plus its matching `.srt` file. The cursor stays still during explanation
and scrolling, and only makes short eased movements before real clicks; this
avoids the unnatural long linear drifts from the first recording. The mother
picker is held open for about 1.8 seconds so its choices are visible.
