# Ink Register — verified build

- Numerical tests: 5 tests passed (multiply colors, rotation, display-independent movement, input bounds, seeded randomness).
- Browser: HTTP and direct-file loading; all 9 composition/palette combinations; mouse, touch and keyboard; real overlap pixels and PNG export; widths 320–1920 px; no runtime page errors or external asset requests.
- Video: 1920 × 1080, 15 fps, H.264 / AAC, 70.592 seconds, 2,235,826 bytes.
- Audio: Fish Audio `s2.1-pro-free`, configured 哈基米 voice; full decode passed; mean audio level -22.1 dB.
- Captions: 22 monotonic SRT cues within the video; the same cues are burned into the browser frames. Sentence timings are proportional within each narration segment.
- Actual year is spoken digit by digit; the builder introduction names GPT-6 Astra (spoken GPT 六 Astra, subtitled GPT-6 Astra).
- Secret scan: 19 source and output files, including MP4, index, manifest, and screenshot, checked against the actual configured key and token patterns; no matches.

The overlap uses RGB multiply, not a calibrated pigment or press model.
