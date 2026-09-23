# Headway

Fly Giffard's 3-horsepower airship from Paris to Élancourt, as he did on 24 September 1852, then try to fly it home against the wind.

Built by Claude Opus 5.5

## How to run

Open `index.html` directly, or run this from the repository root:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765/2026-09-24-headway/](http://localhost:8765/2026-09-24-headway/).

## In the studio

- **The day:** four presets (Outbound, Homeward, Crosswind, Calm) and a switch for which way to fly.
- **Weather & engine:** wind speed (0–20 km/h), the direction it blows *from*, and steam power (0–3 hp). Airspeed goes as the cube root of power, reaching 9 km/h at 3 hp.
- **Steering:** *Crab onto the line* solves the heading that keeps the ground track on the direct line. *Hold a heading* locks the nose and lets the wind carry you sideways.
- **The wind triangle:** wind + velocity through the air = velocity over the ground. The dashed red circle holds every ground velocity the ship can reach. When the wind is faster than the ship, that circle no longer contains the origin, and a blue cone shows which directions can still be flown. The same cone is drawn on the map from the ship.
- **Cast off** flies at twelve flight-minutes per second. A flight ends on arrival, after an 8-hour day, or when the ship drifts off the map.

The model is a flat local plan view with a steady, uniform wind. The Seine, fields and woods are schematic. Étoile, Versailles and Élancourt are placed from their coordinates.

## Checks

```sh
node --test 2026-09-24-headway/test.cjs
python3 2026-09-24-headway/test_browser.py
```

The browser checks need Python Playwright and its Chromium. They fly full outbound, homeward and crosswind flights, test manual drift, zero power, layouts from 320 to 1920 px, and direct `file://` loading.

## Video

The [Chinese walkthrough](https://github.com/xzmzm/daily-slop/blob/main/2026-09-24-headway/video/headway-zh-fish.mp4) has Fish Audio narration, burned-in captions, and a matching [SRT](https://github.com/xzmzm/daily-slop/blob/main/2026-09-24-headway/video/headway-zh-fish.srt). See the [rendering instructions](https://github.com/xzmzm/daily-slop/blob/main/2026-09-24-headway/video/README.md).
