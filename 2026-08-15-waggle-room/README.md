# waggle-room

Built by GLM-5.3

A waggle-dance studio. A forager back from good flowers dances a figure-eight
on the vertical comb, in total darkness, and the whole vector to the food is
inside the middle run:

- **direction** — the angle of the waggle run from straight up equals the angle
  of the flowers from the sun. Inside the dark hive there is no sun to aim by,
  so evolution aimed by gravity: *up the comb means toward the sun*.
- **distance** — the duration of the waggling is the distance, in the hive's
  own inherited "dialect" (for von Frisch's Carniolans, about one second of
  waggling per kilometre — you can count waggles instead: ~13 per second).

Drag the flower patch and the dance changes live. Slide the solar time and the
sun rides its dial ring — the flowers stay put, but the dance rotates to
compensate (the bee's clock subtracts the sun's motion; on Aug 15 at 48° N the
afternoon azimuth sweeps faster than the mean 15°/h — watch the number).
Switch hive dialects and the same meadow buys a different number of waggles.
Drag the flowers inside ~55 m and the figure-eight collapses into a **round
dance**: distance yes, direction no.

Then play **recruit**: the field goes dark, a dancer you cannot question
waggles an angle and a duration (each run jitters a few degrees, like real
dancers — average several), and you click where you think the flowers are.
You are graded the way a real recruit is measured.

## How to run

Open `index.html` in a browser — no build step, no dependencies:

```
open index.html
```

or serve the repo root and visit
`http://localhost:8765/2026-08-15-waggle-room/`:

```
python3 -m http.server 8765
```

## Tests

The dance/solar/scoring engine is pure JavaScript with node assertions:

```
node test_engine.js     # 86 assertions
```

## Files

- `index.html` / `style.css` / `app.js` — the studio (comb + field canvases)
- `engine.js` — the mathematics: solar azimuth model, the encoding rule,
  dialect calibrations, jitter & circular-mean averaging, recruit scoring
- `test_engine.js` — the assertions
- `video/` — the Chinese story video (Fish Audio 哈基米 narration)
