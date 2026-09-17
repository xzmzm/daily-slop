# Pendulum Room video

Chinese walkthrough with Fish Audio `s2.1-pro-free` and the established 哈基米 voice. Built and introduced as GPT-6 Astra. 1920×1080, 15 fps, Chinese captions burned into the image, plus matching SRT.

From the repository root:

```bash
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-09-18-pendulum-room/video/render_video.py \
  --output 2026-09-18-pendulum-room/video/pendulum-room.mp4
```

Requires Python Playwright, Chrome, ffmpeg/ffprobe and `FISH_AUDIO_API_KEY` in the environment or root `.env`. An existing environment value takes precedence. The key never enters the artifacts.

The adapter captures the actual local app and shows its public URL in browser chrome. Real clicks add six hours, compare the equator, Sydney and Kuala Lumpur, then start the North Pole time-lapse. The cursor is parked during narration and moves with a short eased curve only before clicks. Static frames are shared with hard links; the final animated scene captures every frame with a deterministic Playwright clock, so screenshot speed cannot distort the experiment.

The subtitle text supplies the spoken script, with years converted to Chinese digits and the model name to `GPT 六 Astra` for speech. Captions use the shared renderer’s proportional segment timing, not forced word alignment. The bob’s separate illustrative pace is explained in both the app and narration.

After rendering: inspect representative frames, run ffprobe and a full ffmpeg decode, run the project checks, run `git diff --check`, and scan for secrets. Move the printed `cattery-fish-video-build-*` directory to macOS Trash after verification.
