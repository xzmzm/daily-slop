# Rainbow Break

On October 11, 1950 the FCC made CBS's spinning-disk colour TV the US
standard. Watch red, green and blue fields take turns, then move your eye and
see the colours come apart.

Built by Claude Opus 5.5

CBS colour sent an ordinary black-and-white picture one colour at a time:
144 fields a second, each painted red, green or blue by a 1,440 rpm disk in
front of the tube. The eye mixes the three back into one colour picture,
until either the picture or the eye starts to move.

## How to run

Open `index.html` directly, or from the repository root:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765/2026-10-11-rainbow-break/](http://localhost:8765/2026-10-11-rainbow-break/).
No installation, build step, backend, or network access is needed.

## Using the lab

- **Slow ×1/120** slows the eye along with the disk, so you see each bare
  field: the tube shows only one colour's brightness, and the window at the
  top of the disk shows which colour is in front.
- **Field rate** (48–360 /s): at 48 the colours shimmer and the fringes
  triple in width; at 360 they almost vanish. The disk speed follows
  (six segments: rpm = fields/s × 10).
- **Hold still / Follow the ball.** The CBS camera shot each colour at its
  own moment. Hold your gaze and the moving ball lands as three offset colour
  images. Follow it and the ball comes clean, but now the bars, the lettering
  and the checkered floor slide across your retina and break into rainbows.
- **One frame, split** is what a single-chip DLP projector does: one frame
  shown as three colour fields. Following the ball now fringes everything.
- **Your B&W set**: a standard 525-line set expects 15,750 lines a second;
  CBS sent 29,160. It can't lock, so a colour broadcast shows no picture at
  all on any set already in people's homes.

The two fringe readouts give the R→B span, 2 × speed ÷ field rate, for
whatever slips across the retina.

## Checks

```sh
cd 2026-10-11-rainbow-break && node tests.js
```

20 checks: 1,440 rpm and 29,160 lines/s from the CBS numbers, field order,
perfect white from the three-field window, flicker strength against field
rate, the bounce path, and the fringe widths.

## Model notes

Picture: the latest three fields (a window of three field periods sliding
with time), each drawn where it landed on the retina at the field's midpoint.
Flicker: a four-stage 12 ms low-pass eye response to the field sequence,
applied as a colour tint over the picture. Field rates stop at 48/s and slow
motion keeps flashes at or below 3/s to avoid fast full-screen colour
flashing. Details and dead ends are in [`NOTES.md`](./NOTES.md).
