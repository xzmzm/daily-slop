# jupiter-mail · the first airmail

Built by GLM-5.3

Balloon Airmail Day (Aug 17): on this day in 1859 the aeronaut John Wise flew the
balloon *Jupiter* out of Lafayette, Indiana carrying the first US mail ever
entrusted to the air — 123 letters and 23 circulars in a locked bag, sealed for
New York. The wind had other plans: an hour later he put her down near
Crawfordsville, 26 miles south, and the postmaster forwarded the bag by rail.

A free balloon has no rudder, so **altitude is the steering wheel**: the wind
veers and freshens with height (an idealized Ekman spiral), and the set of
courses you can hold today is exactly the arc your wind ladder spans. Climb,
read the ladder, borrow the layer that points where you're going — and remember
that hydrogen (vented to descend) and sand (thrown out to climb) are two one-way
wallets, while the fabric leaks about 0.05 kg of gas a minute.

## How to run

```
open index.html
```

or

```
python3 -m http.server 8765        # from the repo root, then
# visit http://localhost:8765/2026-08-17-jupiter-mail/
```

## How to fly

1. Pick a sky (`1859 · the real flight`, `westerly interlude`, `gale from the
   north`), then **cast off**.
2. Hold **VALVE** (V) to vent hydrogen and descend; press **BALLAST** (B) to
   throw a 15 kg sandbag and climb; toggle the **TRAIL ROPE** (R) — Wise's own
   invention — to drag, brake, and hold a stable low altitude on arrival.
3. Watch the wind ladder (right): each altitude is a different course. The
   compass shows the arc you can hold and the bearing to the target town.
4. Land soft (≤ 2.5 m/s) within 5 km of a depot, before the evening mail train
   departs (2 h after release), and the verdict panel scores the whole journey —
   balloon leg plus the 1859 rail estimate to New York.

Runs the physics in `engine.js` (pure, deterministic, node-testable):
`node test_engine.js` — 73 assertions.
