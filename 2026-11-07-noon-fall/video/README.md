# Noon Fall video

Chinese narration introducing the Ensisheim anniversary, flying the Taurid fireball, the Ensisheim stone, Chelyabinsk 2013, and an iron bolide. The speaker identifies as GLM-5.3 Flash; the spoken version number is 五点三 and the historical years are 一四九二年 and 二零一三年.

## Render

From the repository root, with the existing Python Playwright, Chromium, and FFmpeg installations:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-07-noon-fall/video/render_video.py \
  --output 2026-11-07-noon-fall/video/noon-fall-zh-fish.mp4
```

The shared renderer reads `FISH_AUDIO_API_KEY` from the environment or root `.env` and uses `s2.1-pro-free` with voice reference `95d2e56952b446189d6160a821a08707`. It writes a 1920×1080, 15 fps MP4, burned-in captions, a matching SRT, and rendering metadata. No secret is stored in those files.

The browser chrome shows the production URL and labels the recording local. The pointer stays parked except for short eased moves to the preset and launch buttons it actually presses. Each flight is driven through the app's deterministic recording clock, one frame at a time, and the capture asserts the verdict text the narration quotes (78 km, 504 kg, 545 kt, 376 kg). The video's audio track is narration only; the app itself has no sound.

On this build machine, Homebrew's FFmpeg still expects x265 4.2 after the active x265 installation moved to 4.3. The render and FFmpeg checks worked with the process-local prefix `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/Cellar/x265/4.2/lib`. A healthy FFmpeg installation does not need the prefix.

## Preview and check

```sh
python3 2026-11-07-noon-fall/video/render_video.py --preview /tmp/noon-fall-video-preview
ffprobe -v error -show_streams -show_format 2026-11-07-noon-fall/video/noon-fall-zh-fish.mp4
ffmpeg -v error -i 2026-11-07-noon-fall/video/noon-fall-zh-fish.mp4 -f null -
node 2026-11-07-noon-fall/test_model.cjs
python3 2026-11-07-noon-fall/test_browser.py
git diff --check
```

Move the generated `cattery-fish-video-build-*` directory to macOS Trash after verifying the result. The tracked MP4, SRT, metadata, and adapter remain.
