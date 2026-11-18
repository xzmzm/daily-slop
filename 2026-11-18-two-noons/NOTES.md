# Two Noons — notes

## Why this project?

18 November 1883 is "the day of two noons". US and Canadian railroads
dropped their dozens of private railroad times and set station clocks to five
standard meridians. The other candidate for the date was the first Touch-Tone
push-button phone service (18 November 1963). A DTMF keypad with a Goertzel
decoder would have been a good build too, but it is mostly heard, and today's
video needs something that reads on screen. Two noons shows up on a map.

Nothing in the workspace had done time zones. `eighty-days` gains a day going
round the world, but there the date line is a consequence. Here the zones
themselves are the subject.

## How it works

The changeover was not everywhere at noon. A [Union Pacific order](https://railroads.unl.edu/documents/view_document_id=rail.gen.0002.html)
set clocks to 9 a.m. Central east of Wallace, Kansas, and 8 a.m. Mountain
west toward Denver. The simulation uses standard noon in every zone so the
effect of longitude is easy to see.

Everything runs off one number: `t`, Greenwich minutes since midnight on that
Sunday. For a town at longitude `λ` (° W) in a zone with meridian `M`:

- sun (local mean) time = `t − 4λ`
- standard time = `t − 4M`
- the station clock shows sun time until `t = 720 + 4M`, the zone's standard
  noon, and standard time after that
- the correction is `off = 4(M − λ)` minutes. Positive means the town is east
  of its meridian, so its clock is ahead and gets set back.

Two noons follow from this. A town with `off > 0` reaches its own noon `off`
minutes before standard noon, so the station clock reads 12:00:00 then. At
standard noon it is set back to 12:00:00 and reads it again. A town with
`off < 0` reads `12:00 + off` at standard noon (11:40 for Pittsburgh) and goes
straight to 12:00. Those minutes never appear on its clock that day.

The zone is the meridian closest to the town (±7.5° bands). For these 21
towns that puts Detroit in Central and Halifax and Saint John on Intercolonial
time, the railroads' usual choices. I did not check every town against an 1883
timetable, and real zone edges zigzagged along division points.

The map is a plain equirectangular box (75° of longitude by 20° of latitude)
in SVG, without coastlines. A coastline would have looked like geography but
told you nothing, while the vertical bands and dashed meridians carry the
model. The noon line is a translated `<g>`. A town's red or blue dot, ring
pulse and `−3:59` badge are all recomputed from `t` on every render. Nothing
is stored as an "event", so scrubbing backwards just works.

## Interesting notes

- **The first trace went into an infinite loop.** It drew polylines with
  `for (t = a; t <= b; t += (b − a) / 60)`, and at the exact instant of a reset
  `a === b`, so the step was zero. The browser test that sets `t = 1020`
  (17:00 GMT) found it with a `RangeError: Invalid string length`. The loop
  now counts 0..60.
- **New York's 3 min 58 s.** The often-quoted figure matches New York City
  Hall's longitude, 74.006° W: 0.994° × 4 = 3.976 min = 3 min 58.6 s. The page
  rounds it to "3 min 59 s"; the test pins 238.56 s.
- **Denver nearly had one noon.** At 104.99° W it is 0.01° east of its
  meridian, so the simulation sets its clock back 2.4 seconds. By this model's rule that is still
  two noons. Seven of the 21 towns hear noon twice and fourteen jump forward.
- **Pins snap to half a degree.** Before that, a click landed at 100.11° W and
  the pin read "set back 19 min 33 s", which was right but useless for showing
  the 4-minutes-per-degree rule. Snapping makes a click at 100° W read exactly
  20:00.
- **Label placement is by hand.** Each town has one of four label anchors (r,
  l, t, b). The east coast cluster (New York, Philadelphia, Washington, Boston)
  and the Kansas City / St. Louis pair took three passes of screenshots.
- **Deliberately left out:** the equation of time (in mid-November the real
  sun is about 15 minutes ahead of the mean sun), railroad-time stations, and
  the irregular 1883 zone boundaries. Each would be more accurate and would
  hide the 4-minutes-per-degree rule.
