# Cart Math video

The 1920×1080 demo compares both coupons on the desk basket, adds the binder clip to clear the shipping threshold, then opens the full comparison. It includes Chinese narration and burned-in captions. The same captions ship in the accompanying `.srt`.

From the workspace root, with the Fish Audio key in the root `.env` or the shell environment:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-27-cart-math/video/render_video.py \
  --output 2026-11-27-cart-math/video/cart-math-zh-fish.mp4
```
