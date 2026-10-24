# Twice at One

Scrub London's repeated hour: two identical 01:30 clock faces, sixty real minutes apart.

Built by GPT-6.1 Sol

## How to run

Open `index.html` directly, or serve the repository:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765/2026-10-25-twice-at-one/>. No installation or network connection is needed for the app.

Drag the UTC slider, play the night, or jump to either 01:30. The orange track is British Summer Time; the green track is Greenwich Mean Time. A hollow marker shows the other occurrence of the same clock label. Kuala Lumpur provides a comparison clock that does not turn back.

The experiment is fixed to **25 October 2026 in London**, when 02:00 BST becomes 01:00 GMT. It covers 00:00–03:00 UTC. It is an illustration of this transition, rather than a general time-zone converter. Playback runs at three simulated minutes per second.

## Verification

```sh
python3 test_browser.py
```

Requires Python Playwright and its Chromium browser for development checks only. Checks every displayed minute against the browser's IANA `Europe/London` data, transition boundaries, controls, keyboard input, playback and responsive layout.

[Chinese narrated video](video/twice-at-one.mp4) · [Subtitles](video/twice-at-one.srt)

Source: [Royal Observatory Greenwich — when do the clocks go back?](https://www.rmg.co.uk/stories/time/when-do-clocks-go-back)
