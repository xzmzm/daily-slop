# Line Break video

Chinese walkthrough with Fish Audio `s2.1-pro-free` and the established 哈基米 voice. 1920×1080, 15 fps, burned-in Chinese captions and matching SRT. The displayed address is the public project URL. Captures run locally before push.

From the workspace root:

```bash
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-09-08-line-break/video/render_video.py \
  --output 2026-09-08-line-break/video/line-break.mp4
```

Requires Python Playwright, Chrome, ffmpeg/ffprobe and `FISH_AUDIO_API_KEY` in the environment or root `.env`. Environment values take precedence. No key is saved with the video.

The capture adapter clicks Narrow, Wide and the whitespace checkbox, then scrolls to the editable copy. The cursor makes short eased moves only for these actual clicks and stays parked during narration and scrolling. Subtitle timing is proportionally allocated within each spoken segment, not word-level forced alignment.

After rendering, inspect representative frames, run ffprobe and a complete ffmpeg decode, run `node 2026-09-08-line-break/test.cjs`, check the diff and scan artifacts for secrets. Move the printed `cattery-fish-video-build-*` directory to macOS Trash after verification.
