# galileos-tube video

`galileos-tube.mp4` is the Chinese story video for the August 25 project —
the 417th anniversary of Galileo's telescope demo on St Mark's Campanile.
Fish Audio `s2.1-pro-free` with the 哈基米 voice narrates; Playwright drives
the real studio through its `__demo` API (ship distances on the campanile
tab, the field-angle sweep and defocus drag on the bench, chromatic
aberration, the ×20/×33 presets on Jupiter's moons, the Venus phase sweep,
Kepler mode) at 15 fps, 1920×1080, with burned-in subtitles and a matching
`.srt`.

The renderer loads `FISH_AUDIO_API_KEY` from the repository-root `.env`
(an exported environment variable takes precedence); the key is never
stored in this folder, source code, or generated metadata.

## Re-render

From the repository root:

```bash
python3 2026-08-25-galileos-tube/video/render_fish_video.py   # Fish Audio; reads .env
python3 2026-08-25-galileos-tube/video/render_video.py        # local Tingting fallback
python3 2026-08-25-galileos-tube/video/render_video.py --srt-only
```

Both scripts serve the repository temporarily on a free local port, capture
the actual UI with headless Chrome, burn in the subtitles, and write a
1920×1080 MP4 plus its `.srt`. All motion is stepped deterministically
through `window.__demo`, so re-renders are frame-stable.
