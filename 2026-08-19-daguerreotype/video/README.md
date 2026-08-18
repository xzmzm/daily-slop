# daguerreotype video

`daguerreotype-zh-fish.mp4` is the Chinese story video for the August 19 (World Photography Day) project, using Fish Audio's `s2.1-pro-free` model and the 哈基米 voice reference ID.

It introduces the historical background (François Arago announcing Louis Daguerre's invention at the Institut de France in Paris on August 19, 1839 as a "gift free to the entire world"), demonstrates the 5-step darkroom process (polishing, iodine sensitization, camera obscura exposure on Boulevard du Temple, mercury vapor development at 65°C, fixing & gold toning), and showcases the "Mirror with a Memory" 3D tilt inspector demonstrating the positive/negative optical inversion and microscopic amalgam crystal grains.

The Fish version uses the REST `/v1/tts` endpoint. The renderer automatically loads `FISH_AUDIO_API_KEY` from the workspace-root `.env`; an already-exported environment variable takes precedence. The key is never stored in this folder, source code, or generated metadata.

## Re-render

From the workspace root:

```bash
python3 2026-08-19-daguerreotype/video/render_video.py       # local fallback (macOS Tingting)
python3 2026-08-19-daguerreotype/video/render_fish_video.py  # Fish Audio (reads .env)
```

To override the key for one run:

```bash
FISH_AUDIO_API_KEY=... python3 2026-08-19-daguerreotype/video/render_fish_video.py
```

Both scripts serve the project temporarily on a free local port, capture the actual UI with headless Chrome, burn in Chinese subtitles, and write a 1920×1080 MP4 plus its matching `.srt` file.
