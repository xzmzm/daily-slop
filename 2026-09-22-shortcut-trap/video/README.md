# Shortcut Trap walkthrough

A real-browser walkthrough with Chinese narration, burned-in subtitles, a matching SRT, and the deployed project URL in a clearly labelled local-capture browser strip.

## Render

From the repository root:

```sh
python3 -m pip install playwright pillow
python3 -m playwright install chromium
python3 2026-09-22-shortcut-trap/video/render_video.py
```

FFmpeg, ffprobe, and a Chinese-capable font (the CI image installs Noto CJK) must also be available. `FISH_AUDIO_API_KEY` comes from the environment or the ignored workspace-root `.env`; the environment wins. No key is written to source, metadata, or logs.

The renderer reuses `2026-08-08-cattery/video/render_fish_video.py` with its existing `s2.1-pro-free` model and configured 哈基米 reference voice. That repository helper is a rendering dependency, not a dependency of the web app. The model attribution and spoken introduction are GPT-6 Astra.

```sh
python3 2026-09-22-shortcut-trap/video/render_video.py --preview /tmp/shortcut-trap-checks
```

Preview needs no narration key. It verifies the composition across several parameter states. There is no silent fallback for a requested narrated render: missing credentials or a narration error fail the job.

## Capture details

Output is 1920 × 1080, 20 fps, H.264 with `yuv420p` and AAC audio. Each frame is captured from Chromium while the app advances by a deterministic 1/20 second. Buttons, route highlights, sliders, and PNG export are operated through real browser controls. Slider drags end with an input event to remove browser-specific range-thumb rounding. The small cursor stays parked during explanations and moves on short eased curves only for actions.

The eight scenes compare closed/open roads, inspect unused alternatives, lower demand to 1,000, raise it to 9,000, show the coordinated 4,000-driver optimum, and close the link again. Segment durations are measured from the generated audio. Sentence subtitle boundaries are distributed by character count within each spoken segment; they are not word-level forced alignment. The same cue list drives both burned-in captions and SRT.

The capture strip displays the eventual public URL but explicitly says local recording; the renderer serves the checked-out app locally rather than pretending to record a completed deployment. Only the preview supports explicit in-memory injection in restricted environments. Published media must use local HTTP capture.

## Verification and publishing

`.github/workflows/shortcut-trap-video.yml` runs the numerical suite, HTTP browser tests, and layout preview before narration. It then checks metadata, scene values, subtitle timing, both media streams, and a full FFmpeg decode. Source/generated metadata are scanned for token patterns and the actual configured key without printing it. Generated `VALIDATION.md` records the checks that completed.

The workflow retains check screenshots and media artifacts, commits the finished video, SRT, metadata, validation report, gallery screenshot and index to `main`, and requests the existing Pages deploy workflow. Temporary render directories are outside the source tree; no cleanup command deletes user project files.
