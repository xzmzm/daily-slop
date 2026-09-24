# TAT-1 — the silence multiplexer

Built by GLM-5.3

The 1956 transatlantic telephone cable as a live toy: speech spurts ride two
coaxial lines and 51 vacuum-tube repeaters across the seabed from Clarenville,
Newfoundland to Oban, Scotland — and TASI, the gadget Bell added in 1960,
doubles the cable by renting every caller's silences to somebody else.

## What to do

- **Watch the cable work.** Every colored dash on the eastbound coax is one
  caller's speech spurt; a dim stripe is a circuit held but silent. The plan
  runs at ~×500 slow motion — the real crossing is 18.5 ms at two-thirds of
  light speed in the polyethylene dielectric.
- **Opening day, 25 September 1956** — 35 calls, 36 channels, no TASI: every
  call owns a circuit, and two thirds of every circuit is silence.
- **TASI, June 1960** — 72 calls on 37 circuits. Spurts grab whichever circuit
  is free and give it back at every pause; the seat map shows the scramble.
- **Rush hour** — drop to 24 circuits and watch word-ends get clipped when
  more callers speak than there are lines.
- **Shout across the ocean** — send a test pulse and meet the echo 37 ms later
  (round trip). Arm the echo suppressor and the echo never comes home — but
  try shouting from both ends at once: the suppressor locks the second talker
  out, the classic transatlantic complaint.

## How to run

No build, no dependencies:

```sh
open index.html
# or
python3 -m http.server 8765   # then visit http://localhost:8765/2026-09-25-tat-1/
```

## Tests

```sh
node --test test.cjs          # cable physics, TASI math, determinism
python3 test_browser.py       # drives the real page end to end
```

Historical facts from the Wikipedia TAT-1 article (route, repeaters, channel
counts, TASI 37→72, HMTS Monarch, retirement 1978); the simulation and the
bathymetry are honest simplifications — see [NOTES.md](NOTES.md).
