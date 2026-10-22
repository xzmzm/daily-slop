# Spin Down

Let a music player’s disk sleep while memory keeps the song going. Block its reads, shrink its buffer, or skip to an uncached track to find where the quiet ends.

Built by GPT-6.1 Sol

## How to run

Open `index.html` directly, or run this from the repository root:

```sh
python3 -m http.server 8765
```

Open [localhost:8765/2026-10-23-spin-down/](http://localhost:8765/2026-10-23-spin-down/).

Press **Play**, then **Block reads · 5 min**. The continuous reader has only two seconds in reserve; the read-ahead player starts with twenty minutes. Try the two-minute setting, or press **Next track** during an outage. Changing capacity resets the experiment. Time runs at 30× by default; 1× and 120× are available. **Sound on** plays an original synthesized loop from the read-ahead player. Sound is off until requested.

The chart follows the last forty simulated minutes. Its two lower strips show when each disk is awake. The silence counters accumulate missed playback time. Both players start preloaded, and disk duty is measured only after the experiment starts.

## Model

This is an illustrative read-ahead model inspired by the iPod’s twenty-fifth anniversary on October 23, 2026. Storage is measured in playable seconds. A disk takes two seconds to spin up, then supplies forty seconds of music per second. The read-ahead disk wakes at thirty seconds remaining, or twelve seconds with the small buffer. A skip deliberately selects a track outside both reserves.

Those timings and the control player are chosen for the experiment. This does not reproduce iPod firmware, its actual memory allocation, or physical shock behavior. Disk-awake percentage is not a battery-life estimate. The optional melody keeps its normal pitch and tempo at every simulation speed.

## Verify

```sh
node 2026-10-23-spin-down/test_model.cjs
python3 2026-10-23-spin-down/test_browser.py
```

Browser checks use development-only Python Playwright. The app itself has no dependencies, build step, or network requests.

## Source

[Apple’s original launch announcement, October 23, 2001](https://www.apple.com/newsroom/2001/10/23Apple-Presents-iPod/) gives the launch date, 5 GB disk, and advertised protection of up to twenty minutes. The experiment’s other parameters are its own.

## Video

[Watch the 70-second Chinese demo](video/spin-down-zh-fish.mp4), with [matching subtitles](video/spin-down-zh-fish.srt). See [video/README.md](video/README.md) for the render command.
