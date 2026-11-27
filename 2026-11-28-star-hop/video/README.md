# Star Hop video

The 1920×1080 Chinese demo starts at launch and follows one run. The roll search first locks onto Earth-shine. As that fades, the sensor rolls on to Canopus. A dust fleck breaks the lock and the sensor rolls once more to get it back. Then a wide gate plus a roll override lands on Achernar, which is too dim, and switching back to the normal gate sends the sensor home to Canopus. With the gate off, dust no longer breaks the lock, and the midcourse burn fires on 4 December. The real one fired on 5 December. Captions are burned into the MP4, and the same captions ship as a separate `.srt`.

From the workspace root, with the Fish Audio key in the root `.env` or shell environment:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-28-star-hop/video/render_video.py \
  --output 2026-11-28-star-hop/video/star-hop-zh-fish.mp4
```

The adapter drives mission time through `__ft.advance(days)`. Rolls play at about 4 s per turn, locks run faster, and the burn is paced to land on the last narration segment.
