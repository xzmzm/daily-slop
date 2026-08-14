# NOTES — waggle-room

*Written 2026-08-15, World Honey Bee Day (third Saturday of August).*

## Why this project?

The date picked the topic: Aug 15 2026 is the third Saturday of August, i.e.
National/World Honey Bee Day. Scanning the 22 prior days: physics simulators,
astronomy, genetics, elections, crafts, chirality — but nothing about animal
communication. The waggle dance is the perfect daily-slop shape: one
surprising invariant you can *feel* in ten seconds, and a whole iceberg under
it. The invariant: **the dance replaces the sun with gravity.** Outdoors a
forager navigates by the sun; inside the pitch-dark hive there is no sun — so
the comb's "up" *becomes* the sun's direction, and the waggle run's tilt from
vertical is the food's angle from the sun. Von Frisch got the 1973 Nobel for
cracking it, partly by turning hives on their sides and watching the code break.

The runner-up ideas were Relaxation Day (what would the mechanic even be?) and
Lemon Meringue Pie Day (meringue weeping physics — too close to black-cow's
food-physics slot). The dance won because it's an encode/decode puzzle, which
is a genre this repo hadn't touched: a *language* you can grade.

## How it works

Two canvases, one rAF loop, one shared state. The dance parameters are
recomputed every frame from live state, so every input (drag, slider, dialect
button) changes the dance instantly — that liveness is the whole lesson.

**The rule** (`engine.js`): azimuths are degrees clockwise from north;
dance angle is degrees clockwise from vertical, wrapped to (−180, 180].

```
θ_dance = wrap180(az_flower − az_sun)          // direction
t_waggle = a + b · d(km)                       // distance, dialect (a, b)
d < threshold  →  round dance (no direction)   // form
```

**The sun** is a compact standard model: declination by Cooper's approximation
(Aug 15 → +13.78°), then
`az = 180° + atan2(sin H, cos H·sin φ − tan δ·cos φ)` at latitude 48.2° N
(Vienna — von Frisch country). The time slider is *solar* time, which keeps
noon exactly at meridian passage without an equation-of-time digression.
Time-compensation falls out for free: fixed flowers + moving sun ⇒ rotating
dance, and the test pins the invariant (8 afternoon hours rotate the dance by
exactly −Δaz(sun) — 151° here, *not* the naive 15°/h · 8 = 120°; at 48° N in
August the azimuth sweeps faster than mean near the horizon).

**The figure-eight** is a three-state machine: WAGGLE (duration = t_waggle,
position lerped along the run axis with a 13.5 Hz lateral sinusoid — the
waggle itself), LOOP (a semicircle back to the start, alternating sides), and
ROUND (below the threshold: plain circling). Run length on screen scales with
duration, because the real dancer walks the run. Every run is jittered
(σ ≈ 4°, ±4% duration) — real dancers scatter, and followers average several
runs, which is why the engine's `averageRuns` uses a *circular* mean (the
naive arithmetic mean explodes across the ±180° seam; there's a test where
+179° and −179° must average to 180°, not 0°).

**Dialects** are the honest fudge of this build. The distance–duration
calibration genuinely varies by subspecies and even between neighbouring
hives (Gardner/Seeley-school result), and it's inherited — the famous story
of a Carniolan strain in Japan keeping its ancestral Austrian calibration for
generations. But the exact three (slope, intercept) pairs I ship are
schematic, chosen to be distinct and labelled "schematic" in the UI; von
Frisch's own tables are nonlinear below a few hundred metres. The UI states
the calibration; NOTES confesses it.

**The recruit game** covers the field with an opaque "inside the hive" layer
— the flowers, the vector, the live-encoding card, and two of the four KPIs
all go dark (they'd leak the answer), while the comb keeps its protractor and
a run-timer chip, because a real follower bee *can* count waggles in the dark.
The target round is drawn from a seeded mulberry32, so `__demo.startRound(seed)`
is reproducible (the video relies on this). Scoring mirrors recruit
measurements: grade A needs ≤10° and ≤15% distance; "a real recruit would
find it" means ≤15° and ≤25%.

## Interesting notes

- **The `hidden` attribute doesn't hide flex.** The game cover was visibly
  dark on first load for ten minutes of debugging. Cause: my own
  `.field-cover { display: flex }` overrides the UA stylesheet's
  `[hidden] { display: none }` — author styles beat UA styles regardless of
  specificity. The fix is the one-line `.field-cover[hidden] { display: none; }`.
  Meanwhile `getImageData` kept returning a perfect parchment field, because
  it reads the canvas, not the composited page — pixel-sampling the canvas
  can't see a div sitting on top of it.
- **Degrees/radians, again.** First test run: the sun rose in the west and
  set in the east (azimuth garbage, monotonicity failing). The hour angle was
  in degrees going straight into `Math.sin`. Two characters of `* RAD`.
  The embarrassing part: noon still worked perfectly (`sin(0) = 0` in any
  unit system), so the bug hid until the sweep test caught it.
- **The 15°/h trap.** I wrote the time-compensation test expecting the dance
  to rotate 120° over 8 hours. It rotates 151°. The mean solar rate is
  15°/h of *hour angle*; the *azimuth* rate at 48° N in August is much faster
  in the long afternoons. The test now asserts the correct invariant —
  rotation = −Δaz(sun) — computed independently from the endpoints.
- **Watch the field, not the finger.** The old `unitVector(az)` convention
  (y up, north = 0) has to become y-down for canvas: `y = −cos(az)`. Getting
  this half-right mirrors the map; getting it fully right is why the
  encode→decode round-trip test sweeps 24 azimuths through actual pixel
  coordinates.
- **Waggle count > stopwatch.** The nicest emergent detail: at 13.5 Hz you
  don't need to time the run, just count waggles — ~13 per second, so a
  1 km Carniolan advertisement is a 14-waggle run. Bees presumably do the
  counting version; they don't wear watches.
- Deliberately out of scope: polarized-light navigation (the other half of
  von Frisch's Nobel), the sickle dance between round and waggle, tremble/
  stop signals, and the 230 Hz substrate-vibration story (one line on the
  census card, no simulation). The dance-floor market economics ("only
  winners dance") is copy, not mechanics.
