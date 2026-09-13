# Luna 2 — First Object on the Moon

An interactive studio for Luna 2, the first human-made object to reach another world: launched 12 September 1959 at 06:39:42 UT from Baikonur on a direct-ascent 8K72, its radio cut off at 21:02:24 UT on 13 September — 00:02:24 on 14 September Moscow time, sixty-seven years ago today — as the 390.2 kg instrument sphere hit Mare Imbrium at 3.3 km/s, exactly where Radio Moscow had said it would, within 84 seconds.

Built by GLM-5.3

## How to run

Serve locally with Python (port 8000 is reserved on this machine):

```bash
python3 -m http.server 8765
```

Then visit:
`http://localhost:8765/2026-09-14-luna2-impact/`

## Test suite

Run the closed-form assertions with Node:

```bash
node test_luna2.mjs
```

## Features

- **The Shot** — a translunar shooting range propagated entirely in closed form (Kepler's equation solved by Newton, no integration). The Moon walks 21.1° along its orbit during the 38-hour coast, so you launch at empty space ahead of it. Fly the preset: on time it hits; 84 seconds late still hits (the Moon's 1,737-km radius buys ±28 minutes of slack); ~1 h 45 m late reproduces Luna 1's 5,995-km miss. One metre per second of injection error costs ~13 km at the Moon.
- **Direct Ascent, 11.2 km/s** — the flight-time-vs-injection-speed curve across all three conics: Hohmann (119.5 h, five days — beyond the batteries), parabolic escape (50.7 h), and Luna 2's hyperbola (38.4 h at v∞ = 1.65 km/s, calibrated to the documented 38 h 22 m). Plus the 0.323 km/s of free eastward rotation at Baikonur's latitude.
- **The Last Hour** — patched-conic capture: the probe crosses the Moon's orbit at 2.19 km/s nearly radially while the Moon runs at 1.02 km/s, so v_impact = √(v_esc,M² + v∞,M²) = 3.33 km/s and 2.16 GJ of impact energy scatter 144 engraved pentagonal pennants. Beside it, the magnetometer verdict: Earth's dipole has fallen to 0.14 γ at lunar distance, below the instrument's ±12 γ telemetry quantum — and still no lunar field above the 20–30 γ bound.
- **The Artificial Comet** — the tracking trick: 1 kg of sodium vented at 156,000 km fluoresces orange in the D-lines, expands at its thermal speed √(8kT/πm), reaches the observed 650 km in about eight minutes, and shows 13.8 arcmin across — 0.44 full Moons — in the skies of Alma-Ata, Byurakan, Abastumani, Tbilisi and Stalinabad. With the milestone strip from the 1958 failures to Apollo 11, 1,100 km away.

Sources: Wikipedia's Luna 2 article and NASA's history pages, verified 14 September 2026.
