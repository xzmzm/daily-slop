# Overboard video

The 1920×1080 Chinese demo flies one run. It starts over the Ross Ice Shelf, while the amber and green projections are explained. One food sack goes overboard and the amber line still ends in a red ×. A second sack lifts the line over the pass. The plane then climbs the glacier, loses height in the sinking air of the last miles, clears the pass by about 360 ft and reaches the plateau with three sacks left. Captions are burned into the MP4, and the same captions ship as a separate `.srt`.

From the workspace root, with the Fish Audio key in the root `.env` or shell environment:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-29-overboard/video/render_video.py \
  --output 2026-11-29-overboard/video/overboard-zh-fish.mp4
```

The adapter drives flight time through `__ft.advance(minutes)`. `fly_to(mile, second)` spreads the distance to each waypoint evenly over the frames before that caption, so the pass is crossed in the last narration segment.
