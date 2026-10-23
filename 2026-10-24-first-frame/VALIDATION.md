# Verification — October 24, 2026

- `python3 test_browser.py`: passed offline loading, no browser errors or external requests, image pixel variation, analytic horizon values at four altitudes, nadir/upward/tangent ray checks, lens-invariant horizon distance, actual range and preset controls, keyboard use, guide toggle, real PNG download, and overflow/control bounds at 1920, 1280, 768, 390 and 320 px.
- `node --check app.js` and Python compilation: passed.
- Video composition preview: passed checks that the viewfinder, controls and readings fit above captions. Inspected intro, high-altitude and captured final-scene images.
- Fish Audio output: H.264 video with AAC audio, 1920×1080, 15 fps, 67.533 seconds. Chinese subtitles are burned into the frames, with a matching SRT.
- `ffprobe` inspection and full `ffmpeg -v error -i video/first-frame.mp4 -f null -` decode: passed.
- `python3 tools/build_gallery.py --strict-shots`: passed for all 93 projects; new manifest and today’s thumbnail included.
- `git diff --check`: passed.
- Local environment/root `.env` secret values and private-key/token pattern scan across project source, documentation and finished media: passed without printing secret values.
- Temporary Fish recording directory moved to macOS Trash after verification.

The recording uses the actual app served locally. Its address overlay shows the intended production URL and labels the capture as a local procedural view. Geometry omits refraction and terrain; clouds are invented decoration.
