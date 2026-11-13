# Eighty Days — NOTES

## Why this project?

Today is November 14. Scanning the workspace list, recent days had already
used: tile-rotation puzzles (Nov 13), microgravity rebounds, acoustic
multilateration, non-overlapping window managers, relay faults, X-ray
benches, fireball ballistics, wave shoaling, reed bores, election prediction,
muon tomography, catenaries. What nobody had done: a **timetable game** —
scheduling, connections, waiting.

Nov 14 delivers a perfect hook: on this day in **1889**, Nellie Bly sailed
from Hoboken on the *Augusta Victoria* to beat the 80 days of Jules Verne's
fiction — and did it in **72 days, 6 hours, 11 minutes**, while rival
journalist **Elizabeth Bisland**, racing westbound the same day, missed her
fast ship at Queenstown and took the slower Cunard *Bothnia*, docking four
days and a half behind. A race whose outcome was decided entirely by
timetables. That's the game.

Facts were checked against the itinerary table in Chapter XVIII of her book
(*Around the World in Seventy-Two Days*, Wikisource) plus contemporaneous
accounts of the Bisland race; the table gave exact arrival/departure times
for every port, down to "left Yokohama 10:55 a.m. Jan 7".

## How it works

**One clock, absolute hours.** Time is a single float: hours since
1889-11-14 00:00 UTC. The trip starts at `09:40 EST` (= 14.667h), the
moment she boarded. A port's local time is just `t + tz` run through a tiny
civil-calendar converter (`Nov 1889 → Feb 1890`, hand-rolled month table —
no `Date`, no time-zone library, no DST).

**Legs.** Each leg is `{from, to, carrier, durationHours, via, departures}`
where departures come in three flavors:

- `at` — fixed sailings as local civil `{mo, d, hh, mm}` at the origin
  (steamers; three are listed, matching the weekly mail cadence),
- `daily {hh, mm}` — trains, recurring every 24 h,
- `charterDelay` — the Chicago special, departing N hours after you book it.

`nextDepartures(leg, now)` returns strictly-future sailings; the UI lists
up to three with their wait. Choosing one sets `time = dep + duration`.

**The historical chain.** Every duration was derived from the real table:
Hoboken→Southampton is `Nov 14 10:10 EST → Nov 22 2:30 UTC` = 179h 20m, and
so on. The satisfying part: replaying her exact choices — *Augusta
Victoria*, boat train, the Paris route, *Victoria*, canal, Aden mail,
Colombo mail, Penang mail, China mail, *Oceanic* ×2, Overland, World
special — lands on **1734.18 h = 72d 6h 11m, the official record, to the
minute**. The node test asserts this. That also made leg durations
self-checking: any wrong tz offset or date-base bug shows up as a mismatch.

**Missed sailings.** At each departure, `missedSailings(port, arrived,
departed)` counts `at`-sailings that left while you stood in port. That's
the score: a perfect run misses zero; every miss typically costs a week
because the mail boats are weekly. Trains are excluded — they're daily and
nobody "misses" the 3:10 boat train in a meaningful sense.

**Bisland's marker.** Her westbound progress is 14 milestones (interpolated
from the account: 16 days San Francisco→Yokohama, 36 h there, 5 days to
Hong Kong, *Bothnia* from Queenstown Jan 18, New York Jan 30). The marker
interpolates lon/lat between milestones — with longitude *unwrapping*
(-122.4° → 139.6° goes west through -220°, then normalizes to +139.6°) so
she doesn't appear to cross the Atlantic.

**The date line is pure display math.** No special handling: Yokohama is
UTC+9, San Francisco UTC−8, the clock is absolute, so the local calendar
naturally steps back a day mid-crossing. The app just watches each leg's
`via` polyline for a lon jump > 180° and logs the event when it happens.

**Map.** Hand-coded low-poly equirectangular continents, 15 ports, dashed
full route, solid traveled route. `drawPath` unwraps longitudes and splits
segments at the ±180 screen edge (exit at x=W, re-enter at x=0).

## Interesting notes

- **The chain converges.** The interesting design discovery: from Brindisi
  eastward there is effectively *one* weekly mail chain, so every
  transatlantic choice — the fast Cunard *Etruria* arrives 21 h earlier —
  converges to the same Port Said sailing and the same finish. Historically
  true (that's why missing a boat was fatal), and it makes the game's
  "perfect run" unique: 72d 6h 11m or a week worse. The *Etruria* still
  earns its keep as a cushion (and as a counted "missed steamer" — you let
  Bly's actual ship sail without you).
- **The Verne detour was free.** Leaving London via Paris *and* via Cologne
  both catch the same Monday 3 a.m. *Victoria* at Brindisi. Her two days
  with Verne in Amiens cost nothing but nerve — the game reproduces that
  exactly, so the scenic route is the story route at no charge.
- **drawPath false crossing.** The first map had stray full-width orange
  lines: my pacific polyline touched exactly lon 180 and turned back west,
  and the crossing detector (comparing `floor((lon+180)/360)` on both ends)
  fired with fraction f = 0, splitting a non-crossing segment at the wrong
  screen edge. Fix: use a real great-circle shape that genuinely crosses
  into negative longitudes, *and* guard `0 < f < 1`.
- **Calendar rounding.** `hoursToCivil` rounds minutes; a duration ending
  in `…h 59.6m` would carry 60→61 minutes, so the carry order is
  minutes→hours→days, checked by the round-trip test.
- **Honest simplifications** (also stated in the page footer): time zones
  are rounded railway standard time (Penang got +6:30 as a nod to its real
  LMT +6:50); Bisland's milestone dates are interpolations, not table
  readings; the three listed sailings per hop are "the 1889 winter
  cadence", not a documentary archive — a fourth sailing didn't exist and
  the third is the last chance before stranding.
- **Left out on purpose:** a playable Bisland side (her mid-route facts are
  too thin to fake honestly), ticket prices and Pulitzer's expense account,
  and a "rush the special through the blizzard" mini-game. The rigidity of
  the mail chain is the drama; everything else is decoration.

## Verification

- `node --test test_model.cjs` — 9 tests: calendar round-trips, the exact
  historical chain, the Etruria variant, departure logic, missed-sailing
  counting, the date line arithmetic, stranding, Bisland's track, verdicts.
- `python3 test_browser.py` — 12 Playwright tests (desktop + mobile): board
  state, the full UI playthrough landing on the record modal, a missed
  *Oceanic* overshooting 80 days, stranding data, restart, layout overflow,
  canvas actually painted.
