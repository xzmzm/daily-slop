# Second Breath video

Chinese narration introducing Adolphe Sax's birthday, comparing equal-length bores, switching to the next resonance, hearing both intervals, and changing acoustic length. The speaker identifies as GPT-6.1 Sol; the spoken version number is 六点一 and the historical year is 一八一四年.

## Render

From the repository root, with the existing Python Playwright, Chromium, and FFmpeg installations:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-11-06-second-breath/video/render_video.py \
  --output 2026-11-06-second-breath/video/second-breath-zh-fish.mp4
```

The shared renderer reads `FISH_AUDIO_API_KEY` from the environment or root `.env` and uses `s2.1-pro-free` with voice reference `95d2e56952b446189d6160a821a08707`. It writes a 1920×1080, 15 fps MP4, burned-in captions, a matching SRT, and rendering metadata. No secret is stored in those files.

The browser chrome shows the production URL and labels the recording local. Pointer movement is brief, eased, and curved, only before actual controls are used. A deterministic recording clock keeps pressure animation and sound-button timers aligned with video frames.

Two short tone pairs are mixed into the narration's two-second gaps after the cylinder and cone scenes. They use the app's exact frequency equations, sine waveform, amplitude envelope, and note spacing. This preserves the audible comparison even though headless screenshots do not capture browser sound. The remainder of the video contains narration only.

On this build machine, Homebrew's FFmpeg still expects x265 4.2 after the active x265 installation moved to 4.3. The render and FFmpeg checks worked with the process-local prefix `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/Cellar/x265/4.2/lib`. This uses the matching library already installed; no system links were changed. A healthy FFmpeg installation does not need the prefix.

## Preview and check

```sh
python3 2026-11-06-second-breath/video/render_video.py --preview /tmp/second-breath-video-preview
ffprobe -v error -show_streams -show_format 2026-11-06-second-breath/video/second-breath-zh-fish.mp4
ffmpeg -v error -i 2026-11-06-second-breath/video/second-breath-zh-fish.mp4 -f null -
node 2026-11-06-second-breath/test_model.cjs
python3 2026-11-06-second-breath/test_browser.py
git diff --check
```

Move the generated `cattery-fish-video-build-*` directory to macOS Trash after verifying the result. The tracked MP4, SRT, metadata, and adapter remain.
