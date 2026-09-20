# Echo Room — verified build

- Core tests: **31 groups passed**, including 100 randomized rooms.
- Browser tests: **45 checks passed**, against the real local HTTP app.
- Desktop/mobile layouts, pointer/keyboard input, Web Audio, actual WAV download and reduced motion: passed.
- 1080p preview: subtitles clear the experiment and insight panel.
- Video: **1920 × 1080, 20 fps, H.264 yuv420p / AAC 44100 Hz**, 104.22 seconds.
- Chinese narration: Fish Audio `s2.1-pro-free`, configured repository voice.
- Seven sound demonstrations use exact app-generated WAV samples; one is direct-only.
- SRT: 23 nonempty timed captions; the same lines are burned into the recording.
- Full ffmpeg decode: passed.
- Secret scan: 18 files checked against the available private key and common token patterns; passed.
- MP4 SHA-256: `381b283ac8f941dd01a1e4349a01256d4f8dd7d5ccd7577358e69508717e32fb`.

The model is a finite planar early-reflection sketch, not a measured room response or full reverberation model. These checks do not certify acoustical design accuracy outside the documented assumptions.
