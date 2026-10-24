# Verification — October 25, 2026

- `python3 test_browser.py`: passed all 181 minute comparisons with Chromium's IANA `Europe/London` rules, exact fold boundaries, both 01:30 choices, Kuala Lumpur reference, native range keyboard input, playback/pause, and no page errors. No page overflow at 320, 390, 768, 1280 or 1920 px.
- `node --check app.js`: passed.
- Inspected desktop/mobile screenshots and 1920×1080 video framing. Controls and reference clocks fit above captions. The mobile diagram scrolls horizontally to preserve readable labels.
- Fish Audio: `s2.1-pro-free`, configured voice reference, six Chinese narration segments. The actual local app is recorded with production URL in browser chrome, labeled as a local recording.
- `ffprobe`: H.264 video, AAC audio, 1920×1080, 15 fps, 60.665011 seconds. Matching SRT and burned-in Chinese captions.
- Full `ffmpeg -v error -i video/twice-at-one.mp4 -f null -` decode: passed. Inspected the seam and closing scene in the encoded output.
- Secret scan compared root environment-file secret values with project source, docs, subtitles, metadata and finished media, and checked private-key/token patterns. Passed without printing credentials.

- Gallery: today’s thumbnail captured through the strict screenshot path; manifest rebuilt with `python3 tools/build_gallery.py --no-shots` using existing thumbnails for unchanged projects. Confirmed 94 entries, valid image paths, newest-first order and model attribution. The redundant full recapture of older projects was stopped after October’s screenshots completed.
- `git diff --check`: passed. Temporary Fish recording directory moved to macOS Trash.

This app deliberately models one specified London transition, not arbitrary time-zone rules. UTC state increases monotonically during playback; the displayed local clock jumps back once.
