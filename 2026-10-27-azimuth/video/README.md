# Azimuth video

`azimuth-zh-fish.mp4` is the 1920×1080 Chinese story video, with burned-in captions and a matching `azimuth-zh-fish.srt`. The browser chrome shows the public project URL; the badge identifies the local recording.

The narration introduces World Day for Audiovisual Heritage, compares the initial low- and high-frequency losses, turns the playback head into alignment, compares recording speeds, then finds the angle of a mystery tape. It credits GPT-6.1 Sol, spoken “GPT 六点一 Sol”. The audio track is narration; the interactive app’s optional synthesized loop is available on the site.

## Re-render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-27-azimuth/video/render_video.py \
  --output 2026-10-27-azimuth/video/azimuth-zh-fish.mp4
```

The shared renderer uses Fish Audio `s2.1-pro-free` with voice reference `95d2e56952b446189d6160a821a08707`. It reads the workspace `.env`, with an exported environment variable taking precedence. No key is included in the project.

The capture uses real browser mouse drags and button clicks. The cursor stays still between actions and takes short eased curved paths before clicks. Static frames are cached between caption or state changes. The adapter asserts successful alignment and checks that the interface stays above the caption area.

For a framing preview:

```sh
python3 2026-10-27-azimuth/video/render_video.py --preview /tmp/azimuth-video-preview
```

After rendering, inspect the MP4 with `ffprobe`, fully decode it with `ffmpeg -f null -`, rerun both project checks, run `git diff --check`, scan the new files for secrets, and move the generated `cattery-fish-video-build-*` directory to macOS Trash.
