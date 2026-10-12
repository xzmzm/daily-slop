# Notes: Plan B

## Why this project?

October 13, 2010 is the day the last of the 33 San José miners came up — the
end of a rescue the whole world watched live. Sixteen years later it still
works as a game loop because it has a natural two-act structure: a race with
three competitors and one target, then a logistics problem with 33 iterations
of the same 624-m round trip.

What hooked me was that both halves are *arithmetic you can feel*. The race
wasn't won by the fastest driller — Plan C's oil rig drilled fastest and lost,
because its hole wandered and it started last. Plan B won by being fast
*enough*, straight *enough*, and ready in time. And the 22-hour lift wasn't
slow because of drama; it's 33 × (624 m down + checks + 624 m up), and almost
nothing in that product can be compressed. Other candidates for the day were
the Greenwich meridian vote of 1884 (a good story, but the toy would be a
timezone map) and the White House cornerstone of 1792 (no mechanism at all).

## How it works

**Time** is hours since the cave-in, August 5, 14:00. Day counting is
`floor(hours/24)`, which makes the two famous numbers land: the note is found
on day 17 and the last man tops out on day 69.

**Drilling.** Each plan is `depth`, `dev` (lateral offset), `bit` (life
fraction) and a state (`wait/drill/dull/trip/fishing/fault/off/halted/won`).
Per step of `dm` metres: rate × hardness (÷1.5 in the hard bands), bit life
falls by `dm × hardness / bitLife metres-per-bit`, and deviation does a random
walk with σ = plan's `wander` per √(100 m) (steering multiplies noise by 0.35
and pulls `dev` down exponentially at the cost of 45% of the rate). Crossing
the target depth inside ±15 m wins; outside it the hole passes the workshop
and dies. Plan C additionally faults to a 36-h pull-and-reposition above 11 m
of wander — that's the real "the bit wandered" story, and it's why steering
exists even though B rarely needs it.

The calibration target was the historical outcome: with bits changed around
25–30% life, B breaks through late on October 8 or on October 9 (the real
moment was 08:05). That works out to ~34 days at a net 18.4 m/day from its
September 5 spud — the gross rate is 20.5 m/day and the difference is trips
and hard bands.

**The lift.** Fixed sequence per rider: descend empty at 1.62 m/s, checks at
the bottom (4.5 min fit / 8 min priority / 6 min tough), climb at the gear
speed (0.85 / 1.05 / 1.3 m/s), 1.5 min handover. Each leg rolls a snag
(32% up, 15% down) at a random depth; a snag freezes the capsule until you
hold reverse for 2.5 m of backup. Climbing above a rider's tolerance
(1.0–1.35 m/s depending on condition) fills a "nerves" meter; full nerves
force a two-minute ease-down. The endgame compares your first-to-last span
against the real 21 h 44 m.

## Interesting notes

- **The wait-state bug that fooled the calibration.** Plans B and C were
  silently drilling while "waiting" for their spud dates — the state check
  fell through to the drilling block. The scary part: the numbers looked
  *plausible*, because autopilot-run Plan B still broke through around
  October 8–10. Only Plan C reaching "597 m in six days" gave it away.
  Lesson: a calibration can absorb a bug and still land near history; watch
  the absurd intermediate values, not just the finish line.
- **Hours vs days, twice.** My first `histBreakthrough` anchor produced
  "Oct 9 00:20" instead of 08:05 — I'd added 8 hours as `8/24` of an hour.
  Then the fix still failed the test by one minute ("08:04") because of
  plain rounding. The tests caught both; the fix in the end is the literal
  `1546 + 8 + 5/60`.
- **B's wander rate got halved (1.9 → 1.3 σ/100 m)** after watching the
  autopilot: with 1.9, a steer-above-4 m policy spent half its time steering,
  which cost 45% of the rate and pushed breakthrough to October 18. The real
  B's deviation control was genuinely good; the wander drama belongs to C,
  whose σ is 6.8. After the change, steer-on-B is a trap you can fall into
  yourself by being nervous — matching reports from the actual operation,
  where over-steering the pilot hole was a known way to lose days.
- **Early bit changes cost more bits but no days.** Changing at 30% life
  uses ~10 bits instead of ~7.4 at 0%, but a trip is only ~2–3 h, so the
  calendar barely moves. The real teeth are *not* changing: a dull bit drills
  at 15% and can break downhole into a 36-hour fishing job — the neglected
  run in the tests lands about ten days late, at October 19.
- **The lift is fast because nothing stalls it.** The model's standard-gear
  span is ~15 h against the real 21 h 44 m; the gap is all the pauses a real
  operation takes that a game shouldn't force on you every cycle (medical
  reviews, crew changes, a capsule wheel adjustment). Rather than fake them,
  the end card shows both numbers side by side.
- **Day numbers disagree with calendars by design.** Since the collapse was
  at 14:00, `floor(t/24)` day labels run 5–13 h "behind" calendar dates in
  between the anchors. I kept it because the day-17 note and day-69 finish —
  the numbers people actually remember — come out exactly right.
- Left out: the paloma supply lines as a resource game, the 34th man (a
  truck driver who escaped the collapse itself), individual miners' names
  with personal stats — it felt wrong to hang "weak nerves" labels on real
  people, so riders are conditions, and only Ávalos, Urzúa and González
  appear by name, at their historical moments.
