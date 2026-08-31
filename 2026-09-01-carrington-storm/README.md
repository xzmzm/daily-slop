# Carrington's Storm · 卡林顿风暴

Built by GLM-5.3

A space-weather studio for the 167th anniversary of the **Carrington Event**
(1 September 1859, 11:18 a.m. — Richard Carrington, projecting the Sun at
Redhill, Surrey, saw two patches of white light flare over the great sunspot
group and fade in five minutes: the first white-light flare ever recorded.
17.6 hours later, at 04:03 UT, the plasma arrived and the strongest
geomagnetic storm in the instrumental record began — aurora over Cuba and
Hawaii, telegraph keys sparking, and the Boston–Portland line working for two
hours with its batteries disconnected.)

The whole lesson is closed forms:

- **The two messengers** — light crosses 1 AU in `t = 1AU/c = 499 s` (the
  Kew crochet jumped at 11:18 with the light); the CME crawled at
  ≈2,368 km/s for 17.55 h (`t = D/v`). Drag the speed slider and the whole
  magnetogram replay reflows.
- **The sixth root that protects us** — dipole magnetopause
  `r = (µ₀M²/32π²p)^⅙`: 64× the solar-wind pressure takes *exactly* half the
  standoff distance (64^⅙ = 2). A Carrington-class ≈64 nPa still crushes it
  to ≈4.2 R_E — *inside* geosynchronous orbit.
- **Dst as an energy bill** — Dessler–Parker–Sckopke: every nT of Dst is
  ≈4×10¹³ J of ring current. 1859 (−1,760 est.) ≈ 7×10¹⁶ J ≈ 1,100
  Hiroshimas circling the planet.
- **V = E·L, I = V/R** — the same formula ran the 1859 telegraph (2 V/km ×
  170 km ÷ 1.85 kΩ ≈ 184 mA — sounder-class, batteries optional) and killed
  the 1989 Quebec grid (21.66 V/km measured in Maine → 108 A of quasi-DC
  into transformer neutrals; 9-hour blackout).

Includes the 1-AU battlefield bench (spotted Sun, photon front, CME shock,
dipole magnetosphere with live magnetopause / GEO ring / ring current /
aurora ovals), the parametric Kew–Colaba magnetogram, five formula tabs
(race / magnetopause / ring-current ledger / telegraph &amp; grid /
chronology to the 2012 near-miss and 2024 Gannon storm), four presets, and
13 exact-formula node tests.

## How to run

```bash
cd 2026-09-01-carrington-storm
python3 -m http.server 8765     # or open index.html directly
```

Then visit <http://localhost:8765> (port 8000 is reserved on this machine —
use 8765 or any other free port). No build step, no dependencies.

## Tests

```bash
node --test test_physics.mjs
```

## Video

`video/carrington-storm.mp4` — the Chinese story video (1920×1080, burned-in
subtitles, matching `.srt`), narrated with Fish Audio's 哈基米 voice.

```bash
python3 video/render_fish_video.py   # reads FISH_AUDIO_API_KEY from ../.env
```
