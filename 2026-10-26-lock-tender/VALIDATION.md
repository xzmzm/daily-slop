# Verification — October 26, 2026

- `node test_model.cjs`: passed analytic half-drain/half-fill values, conservation of water volume, frame partition independence, no overshoot, pressure and movement interlocks, uphill/downhill passages, and reset.
- `python3 test_browser.py`: passed real control sequences in both directions, feedback for unequal levels, the boat following the waterline, keyboard Enter/Space, and overflow/hit-target checks at 320, 390, 768, 1024, 1280 and 1920 px. No browser page errors.
- `node --check` for both application scripts and Python source parsing: passed.
- Video framing: checked intro and lifting previews, then stills from the finished encoded video, with all controls and Chinese captions visible.
- `ffprobe`: 1920×1080, H.264 video at 15 fps, AAC audio, 65.916 seconds.
- Full `ffmpeg -f null -` decode: passed with no errors.
- Subtitles: 12 chronological Chinese cues; model attribution and Arabic subtitle year checked against the spoken script.
- `git diff --check` and a scan for the locally configured Fish key, common token patterns and private keys: passed. Temporary video frames and audio were moved to macOS Trash after verification.

The chamber and flow rate are explicitly illustrative. Checks validate the teaching model, not operational behaviour of a surveyed historical lock.
