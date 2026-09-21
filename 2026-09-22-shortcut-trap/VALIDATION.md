# Shortcut Trap — verified build

- Numerical suite: **214,037 assertions** across 14,924 scenarios and 79,704 independent feasible-allocation samples.
- Browser: **22 checks**, actual local HTTP; URL/clipboard checks were not skipped; no JavaScript errors or runtime external asset requests.
- Video layout: **7 parameter states** checked for subtitle clearance.
- Recorded scene averages: **65, 65, 80, 80, 20, 90, 64.6875, 65 minutes**; coordinated flow **1,750 / 1,750 / 500**.
- Video: **1920 × 1080, 20 fps, H.264, yuv420p**, duration **104.600 seconds**, file size **5,732,719 bytes**.
- Audio: **AAC**, Chinese Fish Audio narration, configured `s2.1-pro-free` model and voice reference.
- Subtitles: **24 cues**, monotonic timing within the video duration; the renderer uses the same cues for the burned-in captions and SRT.
- Media integrity: **full FFmpeg decode passed**, video/audio stream checks passed, rendered duration matches measured narration plus gaps.
- Secret scan: **14 source/metadata files** checked for token patterns and the actual configured key; no matches. Credentials are not included in this report.
- Gallery screenshot exists; generated index/gallery are rebuilt by the publishing workflow.

These are executable checks, not a claim that the model predicts a real city's traffic. Sentence captions are proportionally timed within narration segments, not word-aligned transcripts.
