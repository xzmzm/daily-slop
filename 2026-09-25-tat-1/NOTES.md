# NOTES — why and how TAT-1

## Why this project?

Today is 25 September — the day TAT-1, the first transatlantic *telephone*
cable, opened for service in 1956. Before it, telephoning Europe meant short
wave radio: noisy, quarrelsome with the ionosphere, and roughly one call at a
time. The cable opened with 36 channels of 4 kHz each (35 calls plus one
carrier holding up to 22 telegraph lines), on two coaxial cables — one per
direction — with polyethylene insulation and 51 flexible vacuum-tube
repeaters designed by Bell Labs. Transistors existed; Bell judged them too
new to bury under the Atlantic for twenty years.

The irresistible part is what happened four years later: TASI (time-assignment
speech interpolation), installed June 1960, took the cable's 37 working speech
channels in the busy direction and used them to carry **72 simultaneous
conversations** — by noticing that a telephone call is silent about two thirds
of the time. When you pause, your circuit is quietly handed to another caller;
when you draw breath to speak again, some circuit is found for your spurt.
That is a whole communication theory idea — statistical multiplexing, the
ancestor of every packet network — hiding inside a 1960s telephone exchange,
and it makes a perfect toy: you can *see* silence being recycled.

## How it works

**The speech model.** Each conversation alternates between spurts (uniform
0.35–1.55 s, mean ≈ 0.95 s) and gaps, with gap length scaled so that
spurt/(spurt+gap) ≈ the "talkativeness" slider (default 35%, the classic
telephone-traffic figure). Every caller has its own seeded RNG stream
(mulberry32), so changing one slider never reshuffles the other callers, and
the whole simulation is deterministic for the video renderer.

**TASI.** With TASI on, a spurt grabs the lowest-numbered idle circuit at its
first syllable and releases it at the pause. If all circuits are busy, the
spurt's start is *clipped* — it keeps trying every frame and connects mid-word
the moment a circuit frees. The stat that matters is clipped-speech fraction:
with 72 callers at 35% activity on 37 circuits, the binomial tail
P(more than 37 simultaneous talkers) is ≈ 0.2%, so speech stays essentially
clean — that's precisely the arithmetic that let Bell double the cable. Drop
to 24 circuits (below the mean demand of ≈ 25) and clipping becomes
plain.

**Without TASI** (opening-day mode) circuit *c* belongs to caller *c*
forever; callers beyond the circuit count simply cannot be placed — the
pre-TASI problem, shown as blocked rows. On opening day the cable's circuits
were ~34% speech and ~66% expensive silence.

**Cable physics.** Signals in polyethylene coax travel at ~⅔ c
(200,000 km/s). The route model is 3,700 km (the Clarenville–Oban geodesic is
3,346 km; the real cable follows the seabed, ≈ 2,000 nmi), so one way is
18.5 ms and a round trip 37 ms — long enough that the far-end hybrid's
reflection comes back as a distinct, infuriating echo, hence the echo
suppressors. Arm the suppressor in the toy and the far end never launches the
echo; but the suppressor also gates whoever tries to talk *back* while you
hold the line — the transatlantic lockout, which you can trigger by shouting
from both ends at once.

**Two clocks, stated honestly.** TASI runs in real seconds (spurts ~1 s). The
cable drawing runs at ≈ ×486 slow motion so a crossing takes 9 screen seconds.
Ratios (echo = +1 crossing, suppressor lockout windows) are exact; absolute
times on the canvas are stretched, and the chart bar says so.

## Interesting notes

- **The repeater arithmetic doesn't close.** Wikipedia's TAT-1 article states
  a 1,500 nmi deep-water section *and* "51 repeaters spaced at 37 nmi (69 km)
  intervals" — but 51 × 37 nmi ≈ 1,887 nmi, which doesn't tile 1,500 nmi.
  Probably one of the numbers describes a different mix (published accounts
  differ on shallow-water rigid British repeaters vs deep flexible Bell
  ones). The drawing sidesteps it: 51 pods evenly spaced across the whole
  modeled crossing, one every 74 km — and the test suite pins *that*
  self-consistency: `(51 − 1) × span = 3,700 km`.
- **72 is not a coincidence.** The seat map's 72 conversations are 12 western
  exchanges × 6 British ones — exactly TASI's 72 speech circuits from 37
  channels. Pedantically, TASI's 37→72 applied in the busy direction; the
  toy models the eastbound cable only and the westbound twin is drawn
  dimmed, "the other half of every call".
- **Bugs found while building, kept as lessons.** (1) Preset switches kept
  the previous preset's clip statistics, so "TASI 1960" showed 12% clipped
  — pure rush-hour residue; statistics now reset on any configuration
  change. (2) All callers initially spoke at t = 0 simultaneously, spiking
  clipping for the first second; first spurts are now staggered 0–2.5 s.
  (3) "Occupancy of held circuits" is trivially 100% under TASI (a held
  circuit *is* a talking circuit) — the honest number is speech as a share
  of *all* circuit-time: ~34% on opening day vs ~68% with TASI. That swap is
  the whole story of the project, visible in one stat.
- **Bathymetry is stylized** — shelf, slope, ~5 km abyssal plain, mirrored
  shelves — not digitized from the 1955–56 survey sheets. HMTS Monarch laid
  the deep section in two halves (1955 from Clarenville, 1956 from Oban);
  the mid-ocean splice marker is drawn where she joined them.
- **Left out for scope:** the SSB frequency plan (36 channels stacked in the
  line spectrum), the shallow-water armored cable types, TASI's
  187 ms connect memory and predictor that kept a caller's *own* circuit
  across pauses — all good future material. The hotline (1963) and Paul
  Robeson's transatlantic concerts (1957) rode this cable too.

## Sources

- Wikipedia, “TAT-1” — route, two-cable layout, polyethylene, 51 repeaters,
  channel counts (36 → 48 → 51), TASI 37 → 72 (June 1960), ownership
  50/40/10 AT&T/GPO/COTC, HMTS Monarch, retirement 1978, IEEE Milestone 2006.
- Propagation speed, echo delay and speech-activity figures are standard
  teletraffic numbers, recomputed here from first principles
  (3,700 km ÷ 200,000 km/s = 18.5 ms).
