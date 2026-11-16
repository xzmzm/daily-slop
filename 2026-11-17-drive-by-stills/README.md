# Drive by Stills

Lunokhod 1 reached the Moon 56 years ago today and was driven from Crimea off
slow-scan television. Drive it yourself: the picture is a still that is always
old, and a crater sits on the direct line to the waypoint.

Built by Claude Fable 5.2

## How to run

Open `index.html` directly. Everything runs locally.
Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. From the repository root, use
<http://localhost:8765/2026-11-17-drive-by-stills/>.

## Try it

- **The picture** — the rover's last complete TV frame. The next one scans in
  from the top behind the amber line and takes one whole frame period to
  arrive. *Picture age* and *driven since it was taken* say how wrong it is.
- **The pad** — five go commands and one stop: forward at 0.8 or 2.0 km/h,
  reverse, turn left or right on the spot. Keys: `W`/`↑` forward 1, `2`
  forward 2, `S`/`↓` reverse, `A` `D` or `←` `→` to turn, `Space` to stop.
  Each command takes 1.28 s to reach the Moon and the confirmation takes
  1.28 s to come back; the button is outlined while it is in flight.
- **Straight ahead in second gear** — with the 21.1 s camera, press
  *Forward 2* and wait. The screen still shows the parking spot when the
  rover stops itself at the crater rim, 15 m out.
- **The navigator's chart** — built only from what delivered pictures have
  covered, plus the rover's heading and odometer. The amber wedge is where
  the picture on screen was taken; the white box is where telemetry says the
  rover is now. *Show the ground truth* reveals everything else.
- **The camera** — switch to 3.2 s per frame and drive the same ground. The
  log keeps finished drives side by side.
- **New ground** — another seeded patch, always with a crater on the direct
  line.

## What is real

- Luna 17 landed in Mare Imbrium on 17 November 1970 and delivered
  Lunokhod 1, the first remote-controlled rover on another world. It ran for
  322 days and covered about 10.5 km, driven by five-man crews.
- Two forward speeds, 0.8 and 2.0 km/h, and a command set of five "go"
  commands and one "stop".
- 1.28 s one-way light time (384,400 km).
- Frame periods of 3.2, 5.7, 10.9 and 21.1 s are the settings documented for
  Lunokhod 2's slow-scan cameras. Lunokhod 1 is usually described as sending
  about one picture every 20 s; I did not find a primary source for that
  figure, so the page offers the four documented settings and starts on the
  slowest.

## What is modelled

The terrain is procedural (seed 1970 by default). The 6°/s turn rate, the 1 m
camera height and 50° field of view, the hazard clearances, and the rule that
the rover halts itself at a rim or rock are this page's assumptions. The real
rover did carry tilt sensors that could stop it, a gyro for heading and a
trailing ninth wheel for distance, which is why those two gauges are nearly
live while the picture is not.

## Verification

```sh
python3 test_browser.py
```

Requires Playwright and its Chromium for verification only.
