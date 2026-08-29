# rutherfords-foil video

`rutherfords-foil.mp4` is the Chinese story video for the August 30 project
(Rutherford's 155th birthday), using Fish Audio's `s2.1-pro-free` model and
the 哈基米 voice model. It opens on the title card, runs the 1909 bench until
the odometer *earns* its first backscatter (the 15-inch-shell quote), pulls
the geometry tab and sweeps the energy, drags the foil to 3.08 µm so the
1-in-8000 falls out of the formula, loads the aluminium anomaly and the
40 MeV accelerator era for the contact-zone story, scrolls the 1919 tab, and
closes on the ledger and the end card.

The Fish version uses the REST `/v1/tts` endpoint. The renderer automatically
loads `FISH_AUDIO_API_KEY` from the repository-root `.env`; an already-exported
environment variable takes precedence. The key is never stored in this folder,
source code, or generated metadata.

## Re-render

From the repository root:

```bash
python3 2026-08-30-rutherfords-foil/video/render_video.py       # local fallback
python3 2026-08-30-rutherfords-foil/video/render_fish_video.py  # Fish Audio; reads .env
```

Both scripts serve the project temporarily on a free local port, capture
the actual UI with headless Chrome through `window.__demo.step`, burn in
Chinese subtitles, and write a 1920×1080 MP4 plus its matching `.srt`.
