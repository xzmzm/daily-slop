# Surface Sweep video

`surface-sweep-zh-fish.mp4` is the Chinese walkthrough of the October 15,
2026 project. It introduces GPT-6 Astra, compares water and soap, reveals the
surface-tension field, repeats the test on a uniformly coated dish, and
finishes with an off-center drop.

## Render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-15-surface-sweep/video/render_video.py \
  --output 2026-10-15-surface-sweep/video/surface-sweep-zh-fish.mp4
```

Uses the shared Fish Audio `s2.1-pro-free` renderer and voice reference
`95d2e56952b446189d6160a821a08707`. The root `.env` supplies the API key;
an existing environment value takes precedence. The app itself needs no key.

The verified recording is 66.2 seconds. Output: 1920 × 1080, 15 fps,
H.264/AAC, burned-in Chinese captions, matching
SRT, and provider/timing metadata. A small browser bar shows the deployment
URL and identifies the footage as a local recording. The cursor uses short,
curved movements before actual clicks and stays in place during narration.

The frame clock advances the same model as the app. Some scenes deliberately
use slower model time to keep the gradient visible while it is discussed;
the app's model clock remains visible. Every interaction uses real UI controls.

## Check before narration

```sh
python3 2026-10-15-surface-sweep/video/render_video.py --preview /tmp/surface-sweep-video-preview
```

The framing check asserts that the experiment and observation fit above the
captions. After rendering, check with `ffprobe`, decode the complete MP4 with
`ffmpeg -v error -i video.mp4 -f null -`, rerun the model and browser checks,
run `git diff --check`, and scan new files for secrets. Move the generated
`cattery-fish-video-build-*` directory to macOS Trash after verification.
