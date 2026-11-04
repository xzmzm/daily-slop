# Long Wave video

`long-wave-zh-fish.mp4` is the 1920×1080 Chinese narrated demonstration, with burned-in captions, a matching `.srt`, and Fish Audio render metadata. It records the actual local app and displays the public project URL in browser chrome labelled `LOCAL RECORDING`.

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-05-long-wave/video/render_video.py \
  --output 2026-11-05-long-wave/video/long-wave-zh-fish.mp4
```

Preview framing without calling TTS:

```sh
python3 2026-11-05-long-wave/video/render_video.py --preview /tmp/long-wave-video-preview
```

The shared renderer reads `FISH_AUDIO_API_KEY` from the existing environment or the root `.env`, uses `s2.1-pro-free`, and selects voice `95d2e56952b446189d6160a821a08707`. See the [shared workflow](../../2026-08-08-cattery/video/README.md).

The introduction says “GPT 六 Astra”, matching `Built by GPT-6 Astra`. The recording resets the wave, follows its crossing, then compares the 200 m shelf, the 50 m shelf, and a uniformly deep ocean. The pointer makes short curved movements immediately before real clicks; it stays parked during explanation and the wave's movement. The final scene restores the shallow shelf and states the model's limits.

After rendering, verify with `ffprobe`, decode the complete MP4 with `ffmpeg -f null -`, run the project's model and browser checks, run `git diff --check`, and scan the changed artifacts for secrets. Move the renderer's `cattery-fish-video-build-*` directory to macOS Trash after verification.

## Local encoder note

This build encountered a Homebrew library mismatch: FFmpeg 8.1.1 expected `libx265.216.dylib`, but the active x265 version provided 217. The compatible library was still installed under `/opt/homebrew/Cellar/x265/4.2/lib`. Prefixing the render and verification commands with `env DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/Cellar/x265/4.2/lib` let them run without changing system links or packages. That workaround is specific to machines with this installed version; normally the commands above need no prefix.
