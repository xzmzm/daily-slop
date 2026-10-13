# Glamorous Glennis

On October 14, 1947, Chuck Yeager flew the Bell X-1 past Mach 1. Drop from the
B-29, light the rocket chambers, and get through the shock that blanks the
elevator by using the moving tail.

Built by Claude Opus 5.5

## How to run

Open `index.html` directly, or from the repository root:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765/2026-10-14-glamorous-glennis/](http://localhost:8765/2026-10-14-glamorous-glennis/).
No installation, build step, backend, or network access is needed.

## Flying it

You start hanging under the B-29 at 20,000 ft and 250 mph, already falling.

| Control | Keys | What it does |
| --- | --- | --- |
| Chambers 1–4 | `1` `2` `3` `4` | Each XLR11 chamber is on or off: 1,500 lbf at sea level, about 1,680 lbf up high. Four lit drain the tanks in 2 min 47 s. |
| Elevator | `↑` `↓` (hold) | Normal pitch control. From Mach 0.88 to 0.94 it fades to 12% authority. |
| Stabilizer trim | `W` `S` (hold) | Moves the whole horizontal tail, slowly. It keeps full authority through the transonic band. |
| Autopilot | `A` | Flies Yeager's profile: two chambers to climb, push over near 42,000 ft, light the third, trim through, shut down 14 s after Mach 1.06. |
| Pause / drop again | `Space` / `R` | |

The flight ends when you've been unpowered for 25 s and are below Mach 0.9 (or
the tanks are dry and you're below 0.75), when the nose tucks past 40° down,
or below 5,000 ft. **Through the wall** means you held Mach 1 or more with the
flight path within 6° of level, as Yeager did. Diving through doesn't count.

What to watch:

- **Wavefronts** are drawn to scale with the local speed of sound and centred
  where the nose was when each was emitted. They bunch up ahead of the nose as
  you approach Mach 1 and form the Mach cone past it (angle = asin 1/M).
- **The Machmeter** stalls near 0.965 and then tips off its scale once you're
  through. The true Mach readout beside it doesn't stall.
- **Sound, here** drops from 707 mph at the drop altitude to 660 mph above
  36,000 ft, where the stratosphere stops getting colder.

## Checks

```sh
cd 2026-10-14-glamorous-glennis && node tests.js
```

25 checks: standard-atmosphere sound speeds (761 mph at sea level, 660 mph at
43,000 ft, isothermal above 36,089 ft), Mach 1.06 ≈ 700 mph, the 4× transonic
drag rise, elevator fade, tuck and buffet bands, the Machmeter stall, Mach
angles, burn time and thrust lapse, launch weight, the autopilot reaching about
Mach 1.07 near 42,000 ft level, and the same profile with trim locked tucking
into an unrecoverable dive.

## Model notes

Point-mass model in the vertical plane: thrust, drag
`q·S·(CD0(M) + k·CL²)` and gravity along the path, and a load factor
`n = 1 + 1.6·(stick·authority(M) + trim) − tuck(M)` turning the path. Details,
tuning and what was left out are in [`NOTES.md`](./NOTES.md).
