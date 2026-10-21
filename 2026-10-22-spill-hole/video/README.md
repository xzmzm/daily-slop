# Spill Hole video

Chinese narration by Fish Audio, with a real browser capture of the October 22, 2026 project. The opening credits GPT-6.1 Sol, matching the app’s README. The browser chrome displays the deployment URL and labels this as a local recording with accelerated replay.

Output: `spill-hole-zh-fish.mp4`, 1920×1080 at 15 fps, with burned-in Chinese captions, matching `spill-hole-zh-fish.srt`, and rendering metadata in `spill-hole-zh-fish.json`.

## Render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-22-spill-hole/video/render_video.py \
  --output 2026-10-22-spill-hole/video/spill-hole-zh-fish.mp4
```

The shared renderer reads the Fish key from the environment first, then the ignored root `.env`. It uses `s2.1-pro-free` and voice `95d2e56952b446189d6160a821a08707`. No credentials are copied into artifacts.

Preview the framing without TTS:

```sh
python3 2026-10-22-spill-hole/video/render_video.py --preview /tmp/spill-hole-video-preview
```

Scenes: introduction; Garnerin’s 1797 ride; sealed control; 6% vent; 20% vent and earlier touchdown; scrub back to a shared time; model limitations and sign-off. The three playback scenes compress the complete 30-second replay to fit their narration. The overlay cursor moves on a short eased curve just before each click and stays parked during explanations. Captions and the SRT share the same timing helper.

After rendering: probe the streams, fully decode with FFmpeg, rerun the model/browser checks, check whitespace, and scan the source and outputs for secrets. Then move the temporary `cattery-fish-video-build-*` directory to macOS Trash.
