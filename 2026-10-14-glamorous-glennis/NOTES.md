# Notes: Glamorous Glennis

## Why this project?

Today is the 79th anniversary of the first level supersonic flight: Chuck
Yeager in the Bell X-1 #46-062, which he named *Glamorous Glennis* after his
wife, on October 14, 1947, over what is now Edwards AFB. He'd cracked two ribs
falling off a horse two nights before, and Jack Ridley cut him a length of
broom handle so he could latch the cockpit door one-handed.

The streak of recent days had already covered Sputnik's orbit (Oct 4) and
Doppler (Oct 1's Concorde was a runner-up then), so the obvious "sonic boom
toy" risked repeating those. What makes this day different is a control
problem rather than a speed record. The X-1 had enough rocket to go
supersonic. On the flight of October 10 Yeager reached about Mach 0.94 and
lost pitch control, because a shock wave sat on the horizontal tail and the
elevator behind it stopped working. The fix that made October 14 possible was
already built into the airplane: the whole stabilizer could be trimmed. So
the game is about using the trim switch, not only the throttle.

## How it works

**Atmosphere.** The 1976 standard atmosphere up to 20 km: temperature falls
6.5 K/km to 216.65 K at 11 km, then stays flat. Sound speed is
`a = √(1.4 · 287.05 · T)`, which gives 761 mph at sea level and 660 mph at
any height above 36,089 ft. Density at 43,000 ft is 20% of sea level, which is
why you want to be up there. Mach 1 is slower and the drag wall is a fifth
as tall.

**Rocket.** Four XLR11 chambers, each on or off (there was no throttle).
6,672 N at sea level, plus up to 900 N as the back-pressure goes away, at
3.42 kg/s each (Isp ≈ 200 s). 2,290 kg of propellant gives 167 s with all four
lit. Launch weight comes out at 12,258 lb against the commonly quoted 12,250.

**Drag.** `D = q·S·(CD0(M) + k·CL²)` with `S = 130 ft²` and `k = 0.075`. CD0
is 0.020 subsonic, rises smoothly to 0.080 at Mach 1.02 (four times as much),
then eases to 0.058 by Mach 1.32. That bump is "the sound barrier": it's
not infinite, just a fourfold jump in drag right where the elevator also quits.

**Pitch.** No moments, no angle of attack. The controls set a load factor
directly:

```
n = 1 + 1.6 · (stick · authority(M) + trim) − tuck(M)
γ̇ = g · (n − cos γ) / V
```

- `authority(M)` is 1 below 0.88, falls linearly to 0.12 at 0.94, stays there
  to 1.03, then recovers only to 0.40 by 1.10.
- `tuck(M)` is the shock-induced nose-down load. It ramps from 0 at 0.87 to 1
  at 0.96, then eases to a 0.6 plateau supersonic, where the lift centre has
  moved aft for good.
- `trim` moves at 0.12/s within ±0.6 and has no Mach dependence. That is the
  whole trick.
- `n` is clamped by stall (`CLmax = 1.25`) and by 4.5 g.

Full stick in the tuck zone buys 1.6 × 0.12 ≈ 0.19 g against a 1 g push
down, so the nose falls at about 1.6°/s unless you trim. Buffet is a ±0.175 g
seeded noise term centred on Mach 0.93. It shakes the drawing too.

**Machmeter.** Between true Mach 0.965 and 1.0 the gauge reads 0.965 with a
small wobble. Past 1.0 it reads true, and the dial (which stops at 1.0) pins
past its end stop. Yeager reported the needle fluctuating and then tipping off
the scale. Ground radar later reduced the data to Mach 1.06 (some reductions
say 1.07).

**Wavefronts.** Every 0.12 s of sim time the nose drops a circle at its
current world position. Each circle's radius is the local `a` times its age,
at 0.33 px/m, and it's drawn relative to where the X-1 is now. Nothing about
the cone is hard-coded. It appears because the circles can't keep up. The
two straight lines are drawn at `asin(1/M)` as a check, and they sit on the
envelope of the circles.

**Autopilot.** A proportional controller on flight-path angle with a
schedule: build speed to Mach 0.55, climb at 0.2 rad on two chambers to
38,500 ft, shallow out, level near 42,500 ft, light chamber 3 above 41,500.
Trim runs at full rate whenever elevator authority is under 0.6, which works
like an integrator for the error the stick can't hold. At Mach 1.06 it shuts
chamber 3, and 14 s later it shuts everything. It peaks at Mach 1.069–1.073
at about 42,200 ft with 27 s of level supersonic flight. History says
Mach 1.06 at 43,000 ft and roughly 20 s.

## Interesting notes

- **The first tuning went supersonic in the climb.** With all four chambers
  from the drop and a 0.32 rad climb, the model crossed Mach 1 at 40,000 ft
  still climbing 16°, then hit 1.26. Real X-1 flights climbed on fewer
  chambers and lit more at altitude, and switching the profile to two plus one
  brought the peak down to 1.07, close to the record.
- **Version two was too easy.** I added a Mach-locked trim test ("stick only")
  expecting it to fail, and it still went supersonic. The tuck pushed the climb
  down to level, the plane crossed Mach 1, the bump ended at 1.03, and the
  elevator came back. Two changes fixed it. Tuck now plateaus at 0.6 above
  Mach 1 instead of vanishing, which is closer to the real aft shift of the
  lift centre. Elevator recovery is capped at 40%. Now the trim-locked flight
  tucks past −40° at around Mach 1.1 and the test is meaningful.
- **"Level" needed a definition.** A dive-and-pull-out initially scored as
  level supersonic, because one frame within 8° of level at Mach 1.07 was
  enough. The outcome now uses accumulated seconds above Mach 1 with |γ| < 6°,
  and the status line says "only in a dive" when you went supersonic but
  never level.
- **The never-lit case.** The first end rule ("no thrust for 25 s") ended the
  flight 25 s after the drop if you were still reading the controls. It now
  starts counting only after a chamber has burned at least once. If you never
  light one, you sink until 5,000 ft.
- **Scales are split on purpose.** At 0.33 px/m a 31 ft X-1 would be 3 px
  long, so the airframe and B-29 are drawn at a cartoon scale while
  wavefronts and relative positions use the physical one. The footnote says
  so.

Left out: angle of attack and short-period pitch dynamics, the real
stabilizer's degrees (the UI shows ±4° as a label only), LOX jettison, the
landing on Rogers Dry Lake, and Bob Hoover's P-80 chase plane, which was
an easy cut but a sad one.
