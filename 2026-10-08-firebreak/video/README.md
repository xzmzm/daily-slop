# Firebreak — Chinese walkthrough

A narrated recording of the 1871 bench: the match is struck at the De Koven
Street barn and the front leans hard northeast with the gale; a gunpowder
firebreak is cut across the fire's path one charge a second (three of the
five blasts backfire on camera — seed 7 is an honest night); the wind slider
is dragged from 32 to 45 mph so the ember histogram swallows the river mark;
then Monday's rain is clicked and the verdict settles on **CHICAGO BURNS.**
with ≈ 11,000 of 17,500 buildings gone. The closing narration covers
Peshtigo, the deadlier fire from the same cold front, and Fire Prevention
Week.

The October 8 prompt is the Great Chicago Fire's 155th anniversary — it
started this night in 1871 and burned until rain fell late Monday night.
The cow-and-lantern story was a reporter's invention (he admitted it in
1893); the narration keeps the record straight.

Uses Fish Audio `s2.1-pro-free` and the configured 哈基米 voice through the
shared cattery renderer. The opening names **GLM-5.3**, spoken “GLM 五点三”.
Years are spoken digit by digit (一八九三年); subtitles keep ordinary digits
(1893 年), and non-year quantities stay as plain numbers. Segment 3's storm
footage runs at one-third sim speed after the wind drag so the fire is still
alive for segment 4's rain — with the accelerated wind the whole night
otherwise burns out mid-scene. The finished video is 1920 × 1080 at 15 fps
with Chinese captions burned in and a matching SRT.

## Re-render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-08-firebreak/video/render_video.py \
  --output 2026-10-08-firebreak/video/firebreak-zh-fish.mp4
```

Reads `FISH_AUDIO_API_KEY` from the workspace-root `.env`. Framing previews
only: `python3 2026-10-08-firebreak/video/render_video.py --preview DIR`.
Build directories (`cattery-fish-video-build-*`) are temporary — move them
to the Trash after verification.
