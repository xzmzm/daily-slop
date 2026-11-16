# Drive by Stills — notes

## Why this project?

17 November 1970: Luna 17 landed in Mare Imbrium and Lunokhod 1 rolled off it,
the first wheeled vehicle driven on another world, steered from a bunker near
Simferopol. Other candidates for the date were the opening of the Suez Canal
(1869) and Bardeen and Brattain's first transistor-effect observations (1947).
The rover won because its difficulty is something you can feel in thirty
seconds with a keyboard: the drivers did not have video. They had slow-scan
stills, each one already old when it finished arriving, plus 1.28 s of light
time in each direction.

The workspace has plenty of spacecraft (luna2-impact, venera-4, grand-tour,
dart-impact) but they are all trajectory problems. Nothing so far was about
operating a machine through a delayed, sampled view of it.

## How it works

**The rover.** A fixed 0.05 s step. Six modes: forward at 0.8 or 2.0 km/h,
reverse at 0.8 km/h, turn left or right in place at 6°/s, stop. A pressed
button puts `{cmd, arrive: t + 1.28}` on a queue; the mode changes when the
clock reaches `arrive`.

**Telemetry.** Every step pushes a snapshot of the rover (position, heading,
odometer, mode, stop count) onto a short buffer. Everything the page shows as
"known on Earth" — the gauges, the lit command button, the white rover box on
the chart — reads the newest snapshot that is at least 1.28 s old. So a click
lights its button 2.56 s later, and an automatic stop is announced 1.28 s
after it happened.

**The camera.** A frame is exposed, then takes one whole period `T` to scan
out, then 1.28 s to cross. Frame `k` is exposed at `(k−1)·T` and complete at
`k·T + 1.28`. While it is arriving, the top `p = (t − e − 1.28)/T` of it is
drawn over the previous picture, so the horizon updates first and the ground
nearest the wheels updates last. The complete picture on screen is between
`T + 1.28` and `2T + 1.28` seconds old: 22 to 43 s at the slow setting, which
at 2 km/h is 12 to 24 m of driving.

**The picture itself** is a pinhole projection rendered once per exposure
into an offscreen canvas: camera 1 m up, 50° wide, screen row
`y = horizon + f·h/z`. Crater rims are 56-point circles projected point by
point, with the far half stroked light and the near half dark. From 1 m up a
3 m crater 15 m away is about a dozen pixels tall, which is the real reason
the drivers found this hard and why Lunokhod 2 got a camera mounted higher.

**Hazards.** A move is refused if it would push the rover deeper into any
keep-out circle (crater radius + 0.5 m, rock radius + 0.9 m). The rover stops
itself and counts it. Moves that reduce penetration are allowed, so reversing
or turning away always works.

**The chart** is fog of war. When a picture completes, every crater and rock
inside its 50° wedge out to 32 m is marked seen, and the wedge is added to a
single path that is filled once (one fill of many subpaths gives a flat union
instead of stacked translucent layers).

## Interesting notes

- The first default ground had a rock at 13.6 m, dead on the line, so the
  demonstration run stopped on a rock two metres before the crater it was
  supposed to find. Rocks are now rejected within 2.6 m of the first 22 m of
  the direct line.
- With the 21.1 s camera, *Forward 2* from the lander stops at the rim at
  T+0:29. Frame 1 completes at T+0:22 and shows the parking spot, because it
  was exposed at T+0. The first picture taken while moving arrives at T+0:43,
  14 s after the rover has already stopped. I did not tune for this; it falls
  out of 2 km/h, 15 m and 21.1 s.
- On arrival the simulation clock stops, and at first the telemetry buffer
  stopped with it: the chart froze with the rover 0.7 m short of where it
  was and the pad still showing *Forward 2*. Arrival now replaces the buffer
  with the final snapshot.
- The clean route on ground 1970 that the test and the video use was planned
  by hand from the crater list (left of the first crater, then one right turn
  and a straight run through a 2 m gap near 40 m and past a rock at 48 m with
  0.1 m to spare) and worked on the first try: four commands, 59.3 m on the
  odometer against 57.7 m in a straight line, T+1:54.
- I could confirm the 3.2 / 5.7 / 10.9 / 21.1 s frame settings only for
  Lunokhod 2. "About 20 s per frame" for Lunokhod 1 is widely repeated but I
  found no primary source, and the README says so.
- Left out: wheel slip and sinkage, slopes other than crater rims, the
  high-gain antenna that had to stay pointed at Earth, lunar night, and the
  crew's actual practice of driving in short dosed moves and stopping to
  look. That last one is the strategy the page teaches you anyway.
