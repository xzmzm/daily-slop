# 幸运的培养皿 — video

Chinese-narrated 1080p tour of the lucky plate, rendered with the shared
Fish Audio workflow (voice 哈基米, model `s2.1-pro-free`).

Render:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-09-28-lucky-plate/video/render_video.py \
  --output 2026-09-28-lucky-plate/video/lucky-plate-zh-fish.mp4
```

Outputs `lucky-plate-zh-fish.mp4` + `.srt` + `.json` (metadata) here. The
recording drives the real page: opens on the finished 28 September plate,
replays the 1928 summer day by day (cold snap → warm spell → halo), rests
on the three luck conditions, wrecks the counterfactual at 35 °C with a
look at the growth-curve crossover, then keeps culturing past the
observation at 24 °C to let resistant colonies creep back into the halo.

Layout previews only:

```sh
python3 video/render_video.py --preview /tmp/lp-preview
```
