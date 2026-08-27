# weaf-660 video

`weaf-660.mp4` is the Chinese story video for the August 28 project — the
104th anniversary of radio's first paid commercial (28 Aug 1922, 5:15 pm:
WEAF New York, $50 for ten minutes, Mr. Blackwell pitching Hawthorne Court
apartments in Jackson Heights). Fish Audio `s2.1-pro-free` with the 哈基米
voice narrates; Playwright drives the real studio through its `__demo` API
(the transmitter going on air, the modulation walk m = 1 → 1.35 → 0.85 with
spectrum and splatter, the crystal-set tuning sweep onto 232.6 pF with the
RC ripple/clipping seesaw and the two-stage selectivity toggle, the day →
night propagation switch with skywave and drifting fade, the history tab
scroll, and a final tune back to WEAF) at 15 fps, 1920×1080, with burned-in
subtitles and a matching `.srt`.

The renderer loads `FISH_AUDIO_API_KEY` from the repository-root `.env`
(an exported environment variable takes precedence); the key is never
stored in this folder, source code, or generated metadata.

## Re-render

From the repository root:

```bash
python3 2026-08-28-weaf-660/video/render_fish_video.py   # Fish Audio; reads .env
python3 2026-08-28-weaf-660/video/render_video.py        # local Tingting fallback
python3 2026-08-28-weaf-660/video/render_video.py --srt-only
```

Both scripts serve the repository temporarily on a free local port,
capture the actual UI with headless Chrome, burn in the subtitles, and
write a 1920×1080 MP4 plus its `.srt`. All motion is stepped
deterministically through `window.__demo` (segment 2 uses a smoothstep
keyframe for the capacitor sweep so the dial lands on 232.6 pF exactly
where the narration says 「二百三十三皮法」), so re-renders are
frame-stable.
