# Notes: Rainbow Break

## Why this project?

On October 11, 1950 the FCC adopted CBS's field-sequential colour system as
the US standard. It was a strange winner. The picture went out as plain
black and white, one colour at a time, and a 1,440 rpm disk of red, green and
blue filters in front of the tube coloured each field. It worked, and early
reviewers thought it looked better than RCA's all-electronic rival. It was
also incompatible with every TV already in people's homes: a standard set
couldn't lock onto 405 lines at 144 fields a second and showed only a tearing
mess. RCA sued and lost in the Supreme Court in May 1951. CBS broadcast
colour from June 25 until October, when the Korean War halted colour set
production. In December 1953 the FCC adopted the compatible NTSC system
instead.

The idea of colour as a sequence of fields didn't go away, though. Single-chip
DLP projectors still spin a colour wheel, and their users still complain
about "rainbows" when they glance across the screen. That gave the lab a
mechanism to show rather than just an anniversary: the eye has to integrate
three fields into one colour, and anything that moves the picture relative
to the retina between fields pulls them apart.

Other October 11 candidates: Apollo 7 (orbital again; this workspace has
done a lot of orbits lately), and the Einstein–Szilárd letter reaching
Roosevelt (a chain-reaction toy, but the scope and framing were harder to
get right in an hour). The October 2 project was a Nipkow-disk TV bench, so
I kept away from scanning and sync. This lab is about colour fusion and
retinal slip; the B&W set's lost lock is a single toggle.

## How it works

`wheel.js` is the model; `app.js` draws.

**Field schedule.** Field k is lit during [k/rate, (k+1)/rate) and shows
colour k mod 3. The disk has six segments (R, G, B twice round), so
rpm = rate / 6 × 60: 144 fields/s gives 1,440 rpm and 48 complete RGB sets
per second. The disk drawing puts segment ⌊t·rate⌋ mod 6 under the tube
window, so the window always matches the lit field.

**What the eye builds.** The picture is a window three field periods long,
sliding with time. It covers part of the current field, the two before it
and the leftover part of the oldest one, which is the same colour as the
current field. Each channel's weights therefore add up to exactly one, so a
still picture is perfect at any field rate. Each field's scene is drawn in
its own colour channel with `globalCompositeOperation = "lighter"`, scaled
by its weight.

**Where each field lands.** Two times matter for every field:

- *Sample time*: when its picture was taken. A CBS colour camera shot each
  colour at its own moment (`k / rate`). "One frame, split" uses the start
  of the RGB set for all three fields, as a DLP projector does.
- *Retinal shift*: the eye is at `eyeX(mid)` while the field is lit and at
  `eyeX(now)` when we draw. Shifting the field by the difference puts it
  where it landed on the retina. With "hold still" the eye is fixed; with
  "follow the ball" it rides the ball's path.

The four cases come from those two times:

| | colour camera | one frame, split |
|---|---|---|
| hold still | ball fringes | no fringes, ball steps once per RGB set |
| follow ball | ball clean, scenery fringes | everything fringes |

In each case the R→B spread is 2 × slip speed ÷ field rate: 10 px at
720 px/s and 144 fields/s, 30 px at 48.

**Flicker.** The three-field window can't flicker, because white always
comes out white. Flicker comes from a separate eye model: a four-stage
cascade of 12 ms low-pass filters (a gamma impulse response, mean ≈ 48 ms).
Its exact integral over each field's light, `eyeCdf(t − a) − eyeCdf(t − b)`,
gives how a steady white is perceived right now. At 144 fields/s the ripple
is ±1 %; at 48 it is about ±27 %; in slow motion (eye slowed 120×) it is
one bare colour. That tint is multiplied over the picture.

**The B&W set.** The same fields are drawn as luminance, then copied onto
the screen in 3 px bands with a vertical stretch of 29,160 / 15,750, a
diagonal shear and a roll. It isn't a circuit simulation, just a picture of
a sweep that never locks.

## Interesting notes

- **The first eye model hid the effect it was meant to show.** I started
  with one physically motivated kernel for everything: weigh every field by
  the gamma response and draw them all. A white still screen came out right,
  but a moving ball turned into a ~40 px grey smear, because a 48 ms
  integration time at 900 px/s blurs far more than the 12 px colour
  separation. The rainbows were there in the maths and invisible on screen.
  Real vision deblurs motion; a single linear filter doesn't. Splitting the
  job fixed it: a sharp three-field window for *where*, the gamma filter
  only for *how much flicker*.
- **The single-pole version tinted everything.** Before the gamma cascade I
  used one exponential (τ = 40 ms). White at 144 fields/s came out
  (0.83, 0.99, 1.17), a hue rotating 48 times a second, which beats with a
  60 Hz display into a visible colour wobble. Four 12 ms stages bring the
  48 Hz ripple down to ±1 % while 8 Hz flicker (24 fields/s) still gets
  through, which is about right for colour flicker.
- **Following the ball should make it sharp.** It looks like a bug at
  first, but it follows from the CBS camera: each colour was captured at its
  own moment, so an eye tracking the motion lines all three up. DLP's
  rainbows come from showing one frame three times; on CBS they come from
  the eye moving relative to whatever stands still.
- **Photosensitivity limits shaped the controls.** The honest demo of a
  slow disk is full-screen red, green and blue flashing at 8 Hz, which is
  the kind of flashing that can trigger seizures. Field rates stop at 48/s,
  where the perceived ripple is a ±27 % tint, and slow motion is ×1/120,
  so the fastest bare-field sequence (360/s) shows 3 flashes a second.
  Reduced-motion users start paused.
- **Left out:** the 2:1 interlace (the visible effect is small next to
  colour breakup), phosphor decay, saccades (where DLP rainbows are actually
  noticed most), and the CBS adapter that let a modified B&W set show the
  colour broadcasts in black and white.
