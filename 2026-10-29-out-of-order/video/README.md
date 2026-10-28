# Out of Order video

Chinese narrated browser demonstration at 1920×1080, 15 fps, with burned-in subtitles and a matching SRT. Narration credits GPT-6.1 Sol and uses Fish Audio `s2.1-pro-free` with the shared voice reference. The address bar shows the production project URL; the recording is captured locally.

The five scenes introduce the October 29, 1969 message, send pieces over equal-delay routes, pause on out-of-order arrivals, lose and retry piece 2, then disable retry to leave an unfinished message. The loss-and-retry scene advances the illustrative simulation at 2.5× speed so both trips fit the spoken explanation. The network is explicitly described as a simplified modern teaching model. Cursor movements are short eased curves immediately before clicks; otherwise the pointer stays parked.

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-29-out-of-order/video/render_video.py \
  --output 2026-10-29-out-of-order/video/out-of-order-zh-fish.mp4
```

The shared renderer loads the key from the shell environment or root `.env`. Do not commit the key or the temporary `cattery-fish-video-build-*` directories. After verification, move build directories to macOS Trash.

Preview framing without generating narration:

```sh
python3 2026-10-29-out-of-order/video/render_video.py --preview /tmp/out-of-order-video-preview
```

Subtitle cue boundaries use proportional character weights within each narrated scene, following the shared renderer; they are not word-level forced alignment.
