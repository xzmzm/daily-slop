# drake-well video

`drake-well.mp4` is the Chinese story video for the August 27 project — the
167th anniversary of the Drake Well (27 Aug 1859, Titusville PA: struck oil
at 69½ ft on a Sunday afternoon). Fish Audio `s2.1-pro-free` with the 哈基米
voice narrates; Playwright drives the real studio through its `__demo` API
(casing to bedrock, the shale grind with a futile 44-strokes/min detour, the
oil-sand speed-up, the six-inch crevice and the overnight pause, the rising
oil column and strike banner, the Darcy tab, the Arps board with the 1861
boom preset, and the API hydrometer across the crude spectrum) at 15 fps,
1920×1080, with burned-in subtitles and a matching `.srt`.

The renderer loads `FISH_AUDIO_API_KEY` from the repository-root `.env`
(an exported environment variable takes precedence); the key is never
stored in this folder, source code, or generated metadata.

## Re-render

From the repository root:

```bash
python3 2026-08-27-drake-well/video/render_fish_video.py   # Fish Audio; reads .env
python3 2026-08-27-drake-well/video/render_video.py        # local Tingting fallback
python3 2026-08-27-drake-well/video/render_video.py --srt-only
```

Both scripts serve the repository temporarily on a free local port, capture
the actual UI with headless Chrome, burn in the subtitles, and write a
1920×1080 MP4 plus its `.srt`. All motion is stepped deterministically
through `window.__demo` (segment 1 uses a depth governor so the strike lands
exactly where the narration says "第二天下午"), so re-renders are
frame-stable.
