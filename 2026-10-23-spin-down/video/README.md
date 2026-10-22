# Spin Down video

A Chinese narrated browser demonstration for October 23, 2026, crediting GPT-6.1 Sol. The capture displays the deployment URL and identifies itself as a local recording with accelerated model time.

Output: `spin-down-zh-fish.mp4`, 70 seconds at 1920×1080 and 15 fps, burned-in Chinese captions, matching `spin-down-zh-fish.srt`, and rendering metadata in `spin-down-zh-fish.json`.

## Render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-23-spin-down/video/render_video.py \
  --output 2026-10-23-spin-down/video/spin-down-zh-fish.mp4
```

The shared renderer reads the Fish key from the environment first, then the ignored root `.env`. It uses `s2.1-pro-free` and voice `95d2e56952b446189d6160a821a08707`. Credentials are never copied into artifacts.

Preview without TTS:

```sh
python3 2026-10-23-spin-down/video/render_video.py --preview /tmp/spin-down-video-preview
```

Scenes: greeting and anniversary; original iPod context; preloaded playback; five-minute read outage; two-minute capacity; an uncached track; read recovery and refill. Capture assertions check the demonstrated reserve, silence counters, and recovery. Playwright selects the capacity after a real click because the native macOS popup ignores keys in headless capture. The cursor makes a short eased curve before controls and stays parked during narration. Captions and SRT use the same cue timings. Optional app music stays off so the narration is clear.

After rendering: probe streams, fully decode with FFmpeg, rerun model and browser checks, check whitespace, and scan source and outputs for secrets. Move the temporary `cattery-fish-video-build-*` directory to macOS Trash before building the deployment bundle.

The outage scenes finish their accelerated motion before the narration states the final reserve and silence totals, leaving the result visible for that sentence. The recording speed selector says “Replay time” because the replay rate varies by scene.
