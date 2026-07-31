# Eclipse Chaser — notes

## Why this project?

August 12, 2026 is the biggest skywatching day of the year: a total solar
eclipse across Greenland → Iceland → northern Spain, the Perseid peak, and
Venus at greatest elongation — all on the same night. Yesterday's build
covered the meteors (`perseid-vigil`); the eclipse itself is the bigger
story, and it's 11 days out, which is exactly when everyone starts asking
"will I see it from where I live?" That's the itch: a map you can click
that answers *what will I actually see from here*.

It beat the other candidates of the day (World Wide Web Day was Aug 1;
the Alpha Capricornids peaked today) because it's the news story with the
most *personal* payoff — the answer changes dramatically within a few
kilometres.

## How it works

The whole thing is one calibrated centreline plus a distance-based model:

1. **Real path data.** NASA's eclipse "google map" page embeds the TRACK.GOO
   polylines (northern limit, southern limit, centreline) for the first half
   of the path — Siberia → Arctic → Greenland NE. Those 52-point arrays are
   extracted verbatim (`nasa_arrays.json`).
2. **Wikipedia city anchors.** The second half is pinned by the published
   city table: greatest eclipse (65.2°N 25.2°W, 17:47:06 UT, 2m18s),
   Látrabjarg 2:13, Reykjavík 1:01, A Coruña 1:17, Palma 1:36, Madrid
   99.98% just outside the umbra, last umbral contact 18:35:17 UT.
3. **Spanish axis = least-squares fit.** The axis through Spain is fitted
   (`fit_span.py`, a tiny Nelder–Mead) against ~25 real city durations,
   with the hard constraint that Madrid sits just outside the 150 km
   half-width. Result: every Spanish city reproduces its real duration
   within ±10 s (most within ±3 s).
4. **Partial-phase falloff.** Outside the umbra, magnitude follows a
   two-piece isotropic falloff calibrated so London (91.42%), Paris
   (92.12%), Dublin (94.02%), Algiers (96.09%), Lisbon (94.52%) and
   Vestmannaeyjar (99.63%) come out nearly exact. The falloff flattens
   beyond ~400 km (the real penumbra is stretched toward the sunset limb)
   — a single cone would badly under-predict the northern cities.
5. **Times.** The path carries a time for every vertex, anchored to real
   city *maximum* times (monotone-filtered, since a few table entries are
   mutually inconsistent). Sun altitude at maximum comes from a simple
   solar-position formula with Aug-12 declination (+14.9°).

At runtime (`app.js`) every map pixel just measures its distance to the
polyline and reads magnitude/duration/time off it.

## Interesting notes

- **The Wikipedia city table is self-contradictory around Iceland.**
  Reykjavík (1:01) and Keflavík (1:39) are ~30 km apart; no smooth umbra
  can give both. Same for Borgarnes (0:40). I trusted Látrabjarg +
  Reykjavík + Vestmannaeyjar (the southern limit passing 13 km north of it)
  and documented the rest as approximate.
- **The max-time table taught me geometry.** Madrid (40.42°N) and Burgos
  (42.34°N) are on the *same meridian* yet their maxima are 3 minutes
  apart — not a table error, just the axis swinging past Madrid's
  perpendicular foot later than Burgos's. City max ≠ same-longitude.
- **The NASA "time line" waypoints are not the axis.** They're ~2–4°
  north of the true centreline everywhere I could check; using them as
  shape anchors initially dragged the path 500 km off. The Atlantic track
  is instead pinned by *sky geometry*: a capital's magnitude → moon–sun
  separation → ground distance from the axis, giving three distance
  circles whose intersections (with a ~1.7 km/s SE track) fix the axis
  to ±30 km.
- **Chord dip.** Straight-segment polylines dip inside the arc of a curved
  track — a chord between two points both 130+ km from Reykjavík still
  passes 120 km from it. Getting the Iceland exit right took an eastward
  "jog" vertex (Vestmannaeyjar's 99.63% is the constraint) plus a north
  jog past the greatest-eclipse point.
- **The duration taper.** C1→C4 is ~2h at the axis but shrinks toward the
  path ends (A Coruña 1:52, Palma ~1:20). A magnitude-only formula
  over-predicts by 45% at the ends; a simple taper by arc position fixes it.
- **Leaving out**: real Besselian-element math (I had the elements! — the
  NASA page embeds them — but full oblate-Earth shadow transforms were
  beyond the hour budget, and the calibrated polyline reproduces the
  flagship cities anyway), a 3D sky dome, and timezone handling for map
  clicks beyond a longitude heuristic (city chips carry exact offsets).

## Files

- `gen-path.py` — the recipe: NASA arrays + anchors → `path.js`
- `fit_span.py` — the Spanish axis least-squares fit (saved values are
  baked into `gen-path.py`)
- `nasa_arrays.json` — raw TRACK.GOO polylines from the NASA page
- `path.js` — generated centreline: `[lat, lon, timeUTCh, axisDurS, hwKm]`
- `coast.js` — simplified Natural Earth 110m coastlines for the map region
