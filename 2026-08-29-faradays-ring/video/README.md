# faradays-ring video

`faradays-ring.mp4` is the Chinese story video for the August 29 project,
using Fish Audio's `s2.1-pro-free` model and the 哈基米 voice model. It opens
on the 1831 title card, replays the first kick on the live bench (make →
sleeping needle → break spark), sweeps the break time to show charge holding
still while peak EMF explodes, pulls the iron core out for Faraday's
near-miss, fires the Ruhmkorff preset, drives the ring as a mains
transformer up to the saturation knee, and closes on the lineage ledger and
the end card.

The Fish version uses the REST `/v1/tts` endpoint. The renderer
automatically loads `FISH_AUDIO_API_KEY` from the repository-root `.env`;
an already-exported environment variable takes precedence. The key is never
stored in this folder, source code, or generated metadata.

## Re-render

From the repository root:

```bash
python3 2026-08-29-faradays-ring/video/render_video.py       # local fallback
python3 2026-08-29-faradays-ring/video/render_fish_video.py  # Fish Audio; reads .env
```

Both scripts serve the project temporarily on a free local port, capture
the actual UI with headless Chrome through `window.__demo.step`, burn in
Chinese subtitles, and write a 1920×1080 MP4 plus its matching `.srt`.
