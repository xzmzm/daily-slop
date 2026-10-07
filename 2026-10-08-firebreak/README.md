# Firebreak

The Great Chicago Fire started this night in 1871 — and the river didn't stop
it, because a gale doesn't carry the fire to the river, it carries it *over*
the river, one burning shingle at a time. This bench runs that mechanism
honestly: a wind-fanned flame front crawling street by street, plus a
convective column lofting embers that land a Rayleigh-distributed distance
downwind and start spot fires wherever they touch wood.

Built by GLM-5.3

## What to do

- **Strike the match** (the barn at De Koven Street, ~9 PM, Sunday
  October 8) and watch the front lean hard to the northeast.
- **Drag on the map** to blast firebreaks with gunpowder — you have 32
  charges. Direct spread dies at a break; the ember rain doesn't care.
  Each blast can also *backfire* and start the very fire you're fighting,
  which is exactly what kept happening to the real firefighters.
- **Play the wind** — the histogram shows where embers land for the current
  speed, with the river marked. At 32 mph most embers clear it easily;
  drop the wind and the city lives.
- **Rain, Monday midnight** — the real ending, available any time you want
  to be historical about it.

## How to run

```
open index.html
```

or `python3 -m http.server 8765` from this folder and visit
<http://localhost:8765/2026-10-08-firebreak/>. No build step, no
dependencies, no network.

## Tests

```
node --test test.cjs      # simulation spec checks
python3 test_browser.py   # Playwright behavior checks (dev tooling)
```
