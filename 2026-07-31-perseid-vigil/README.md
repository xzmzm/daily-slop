# ☄️ Perseid Vigil (2026-07-31)

A **night-by-night simulator of the 2026 Perseid meteor shower** — the one
happening right now (active Jul 17 → Aug 24, peaking Aug 12–13 under a new
moon). An all-sky fisheye view replays each night from 22:00 to 04:30:
meteors streak away from the true radiant in Perseus, the hourly rate follows
the shower's activity curve scaled by radiant altitude, and moonlight washes
out the faint ones. Scrub the slider across the season and watch the shower
build to its peak.

- **Slider / activity curve** — pick any of the 39 nights of the season.
- **`tonight` / `peak night`** — jump to Jul 31 or the Aug 12–13 maximum.
- **Click the sky** — wish on a meteor (spawns a bright one from the radiant).
- **Readout** — sim clock, nightly ZHR, live visible rate, radiant altitude,
  moon phase & up/down.

## How to run

No build step, no dependencies:

```
open index.html
```

or serve the folder (`python3 -m http.server`) and open the URL.
