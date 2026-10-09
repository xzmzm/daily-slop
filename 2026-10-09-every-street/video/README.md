# Every Street — Chinese walkthrough

A recording of the actual app for World Post Day, October 9, 2026. It walks
out and back on one street, undoes the wasted leg, highlights the market’s
four odd junctions, and demonstrates the shortest rounds in all three maps.
The narration opens with **GPT-6 Astra**, spoken “GPT 六 Astra”.

Uses Fish Audio `s2.1-pro-free` and the user's new default voice ID
`95d2e56952b446189d6160a821a08707`. The shared renderer and workspace
instructions preserve that preference for future daily-project videos.

The output is 1920 × 1080 at 15 fps, with Chinese narration, burned-in
subtitles, a matching SRT, and the public deploy URL in the browser chrome.
The chrome labels this as a local recording of the same app. The cursor
stays parked except for short eased movements immediately before real clicks.
Playback advances under a controlled browser clock, at 1.25× during automatic
tours so their completed totals remain visible before the next scene. Static frames share disk
storage, while changes and cursor movements are captured from the browser.

## Re-render

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-09-every-street/video/render_video.py \
  --output 2026-10-09-every-street/video/every-street-zh-fish.mp4
```

Requires Playwright with Chromium and `ffmpeg` / `ffprobe`. Reads
`FISH_AUDIO_API_KEY` from the ignored workspace-root `.env`; an existing
environment variable takes precedence. No credential is copied into video
metadata or source files.

Framing previews only:

```sh
python3 2026-10-09-every-street/video/render_video.py --preview /tmp/every-street-preview
```

After rendering, verify the video with `ffprobe` and a full `ffmpeg` decode,
run the project tests, check the diff and scan for secrets, then move the
temporary `cattery-fish-video-build-*` directory to macOS Trash.
