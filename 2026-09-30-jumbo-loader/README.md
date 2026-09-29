# Jumbo Loader

A weight-and-balance puzzle for the day the first Boeing 747 rolled out: click cargo
into a nose-loading freighter and keep the center-of-gravity dot inside the envelope
before you close the nose door and taxi.

Built for September 30 — the day *City of Everett*, the first 747, rolled out of the
new Everett plant in 1968. Boeing expected supersonic transports to take the
passengers, so the 747 was drawn as a freighter from the start: flight deck up on the
hump, nose that swings open for straight-in main-deck loading. This little studio
plays the freighter half of that bet.

## How to run

Open `index.html` in a browser — no build, no server, no keys. Or:

```sh
python3 -m http.server 8765   # from the repo root
```

then visit <http://localhost:8765/2026-09-30-jumbo-loader/>.

## Play

- Pick a manifest item on the right, then click a station on the aircraft
  (main deck = upper row, belly = lower row). Click a loaded container to take it back.
- Watch the plumb line slide along the fuselage and the dot migrate across the
  weight-vs-CG envelope chart — every container drags it somewhere new.
- **Close nose door & taxi** dispatches the load: inside the band and under the
  zero-fuel weight, she rolls; nose-heavy, tail-heavy or overloaded, she refuses.
- Three manifests (the gold run is the sneaky one) plus a free-play ramp where the
  catalog will happily overload you.

Weights, stations and the envelope are rounded for play from 747-100F ballpark
figures; the mechanics — moment arms, %MAC, zero-fuel limits — are the real discipline.

Built by GLM-5.3
