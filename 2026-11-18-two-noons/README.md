# Two Noons

On 18 November 1883 the US and Canadian railroads reset every station clock
to one of five meridians. Run that Sunday across a map of 21 towns: the ones
east of their meridian hear noon twice, the ones west of it skip ahead.

Built by Claude Opus 5.5

## How to run

Open `index.html` directly. Everything runs locally.
Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. From the repository root, use
<http://localhost:8765/2026-11-18-two-noons/>.

## Try it

- **Run the day.** Greenwich time runs from 15:30 to 20:30. The gold line is
  local mean noon, moving west at 15° an hour. Each zone's meridian turns red
  at its standard noon (16:00, 17:00, 18:00, 19:00 and 20:00 GMT). Every
  station in that zone is reset at that moment. `Space` plays and pauses,
  `←` `→` move one minute, and the slider scrubs.
- **Pick a town.** Click a dot or a row in the tally. The two clock faces show
  sun time and the station clock. The trace below them plots the station clock
  against Greenwich time, with a red dot each time it reads 12:00:00.
- **New York** is set back 3 min 59 s, so noon comes twice. **Pittsburgh**
  jumps from 11:40 to 12:00. **Detroit**, at the east edge of the Central
  zone, is set back 27 min 48 s.
- **Pin your own town.** Click anywhere on the map. The pin snaps to the
  nearest half degree and goes into the zone with the nearest meridian.

## What is real, what is modelled

- Real: the date; the five meridians (60°, 75°, 90°, 105° and 120° W, called
  Intercolonial, Eastern, Central, Mountain and Pacific); clocks set at
  standard noon; 4 minutes of time per degree of longitude; standard time
  becoming US law only in 1918.
- Modelled: every station starts on its own town's local mean time. In
  reality many stations ran on a railroad's time and many towns kept their own.
  Zones are ±7.5° around each meridian, where the real edges followed railroad
  division points. Longitudes are city centres, not the observatories that
  sent the time signals. The equation of time is ignored, so "sun time" is
  mean solar time.

## Verification

```sh
python3 test_browser.py
```

Requires Playwright and its Chromium for verification only.

## Video

A narrated Chinese walkthrough is in [`video/`](video/README.md).
