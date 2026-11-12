# Loop Tiles video adapter

An **80.22-second**, six-segment Chinese demonstration, rendered at **1920×1080 / 15 fps**, with H.264 video, AAC narration, burned-in captions, and a matching SRT. The opening credits **GPT-6.1 Sol**, spoken as “GPT 六点一 Sol”. November 13 is a personal curiosity about connecting curved tiles, not an invented anniversary.

- [Watch the video](loop-tiles-zh-fish.mp4)
- [Subtitles](loop-tiles-zh-fish.srt)
- [Render metadata](loop-tiles-zh-fish.json)

The full ffmpeg decode and all 9 model / 14 browser tests passed after rendering. These video files are Git artifacts; the Pages app bundle does not publish MP4 or SRT files.

## Offline preview

From the repository root, with Python Playwright and its Chromium installed:

```sh
PREVIEW=$(mktemp -d /tmp/loop-tiles-preview-XXXXXX)
python3 2026-11-13-loop-tiles/video/render_video.py --preview "$PREVIEW"
```

This reads the local app (including `model.js`) and writes `start.png`, `challenge.png`, `solved.png`, `longest.png`, `traced.png`, and `seed-rotate.png` into the supplied directory. It does not read the workspace `.env`, request speech, or assemble a movie.

The 1920×1080 recording-only stylesheet makes the board 650×650 pixels, keeps the sidebar and footer above the subtitles, and disables transitions and animation. The browser bar shows the intended public URL with a **LOCAL RECORDING** badge. The app's files are not changed.

## Six scenes

1. Introduce the two-direction curved-tile puzzle on the initial field.
2. Actually click `#challenge`; show the orange-marked tile in the center.
3. Actually click tile 27 in Rotate mode, completing the central four-arc loop.
4. Click `#show-longest`; the app switches to Trace and highlights its longest closed component.
5. Click a precise point on tile 27's southeast arc to select the little central loop, not its other thread. Enable `#trace-mode` only if it is not already active.
6. Click Rotate, fill the seed field with `little-turns`, click its form submit button, and click tile 0 to demonstrate a repeatable field and a real rotation.

Scene transitions happen in 3.2-second silent gaps. The pointer takes a short eased, slightly curved route immediately before each real click, settles briefly, and remains at that click location throughout the next narration. It never drifts during speech or takes a decorative return trip. Repeated static frames are hard-linked rather than captured repeatedly; the page has no autonomous animation.

Assertions compare displayed loop/longest/turn counters with analysis of the real board. The solved state must have center orientations `[1, 0, 0, 1]` at indices `[27, 28, 35, 36]`, exactly one closed four-arc component using those tiles, no boundary endpoints, and the UI's success text. Tracing must select that component and exactly four SVG arcs. The longest-loop selection and seeded rotation are checked separately, as are framing and browser errors.

## Shared rendering interface

`render_video.py` follows the November 12 adapter and imports the existing cattery capture helpers. It exports `ROOT_DIR`, `SEGMENTS`, `SUBTITLE_LINES`, `FPS`, `WIDTH`, `HEIGHT`, `SILENCE_BETWEEN`, `SILENCE_TAIL`, `duration`, `free_port`, `wait_for_server`, `write_srt`, `capture_frames`, and `assemble` for the shared Fish renderer. Subtitles are burned into captured frames; the shared writer also emits the matching SRT.

To reproduce the requested render, run from the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-13-loop-tiles/video/render_video.py \
  --output 2026-11-13-loop-tiles/video/loop-tiles-zh-fish.mp4
```

The shared pipeline uses Fish Audio `s2.1-pro-free` and reference voice `95d2e56952b446189d6160a821a08707`. It reads `FISH_AUDIO_API_KEY` from the existing environment first, then the root `.env`, without putting the key into source or metadata. See the [shared workflow](../../2026-08-08-cattery/video/README.md). The capture server uses an allocated local port; the app README uses 8765. Never bind the reserved port 8000.

After rerendering, verify duration/resolution with `ffprobe`, decode the entire output with `ffmpeg -f null -`, run `node 2026-11-13-loop-tiles/test_model.cjs`, `git diff --check`, and a secret scan. Move temporary `cattery-*video-build-*` directories to macOS Trash only after verification.
