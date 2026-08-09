# sky-sway video

`sky-sway-zh-fish.mp4` is the Chinese story video for the August 10 project,
using Fish Audio's `s2.1-pro-free` model and the 哈基米 voice model.
`sky-sway-zh.mp4` is the local-TTS fallback.
It introduces the idea (a skyscraper is a giant tuning fork), clicks the
gust button to kick the tower, toggles the damper off to show sway explode,
scrolls to the response curve, then turns auto-tune on to produce the
equal-height Den Hartog peaks.

The Fish version uses the REST `/v1/tts` endpoint. The renderer automatically
loads `FISH_AUDIO_API_KEY` from the repository-root `.env`; an already-exported
environment variable takes precedence. The key is never stored in this folder,
source code, or generated metadata.

## Re-render

From the repository root:

```bash
python3 2026-08-10-sky-sway/video/render_video.py       # local fallback
python3 2026-08-10-sky-sway/video/render_fish_video.py  # Fish Audio; reads .env
```

To override the local value for one run:

```bash
FISH_AUDIO_API_KEY=... python3 2026-08-10-sky-sway/video/render_fish_video.py
```

Both scripts serve the project temporarily on a free local port, capture the
actual UI with headless Chrome, burn in Chinese subtitles, and write a 1920×1080
MP4 plus its matching `.srt` file. The cursor stays parked during narration
and scrolling, and moves only shortly before a real click (gust, damper
toggle, auto-tune). Movements are eased with a slight arc and a short settle
pause — never a long linear drift. The damper stays off long enough to show
the bare-resonance sway climb, and auto-tune is held long enough for the two
green peaks to settle visibly equal.

## Cursor choreography

- **Segment 1 (intro):** title card → park near the building.
- **Segment 2 (live stage):** pointer parked; the swaying tower + damper
  sphere carry the shot.
- **Segment 3 (gust + damper off):** eased move to the gust button, click,
  watch damped sway; eased move to the damper toggle, click it off, watch
  the bare resonance climb.
- **Segment 4 (the plot):** gentle scroll down to frame the response curve
  and the formula card while the red/green curves are explained.
- **Segment 5 (auto-tune):** scroll back up, turn the damper on, click
  auto-tune — the two green peaks snap to equal height.
