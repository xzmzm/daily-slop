# flash-spectrum — notes

## Why this project?

Today is the 158th anniversary of the eclipse of **18 August 1868**, observed
from Guntur, India by Pierre Janssen. In the spectrum of the prominences he
found a yellow line near sodium's D doublet that no laboratory sample produced.
That line — later called D₃ — was helium: the first element discovered
*off* Earth. Lockyer saw it independently on 20 October 1868, Lockyer and
Frankland named it after *hēlios* (the Greek sun) precisely because it had no
home on Earth, and it only turned up on a bench in 1895, when Ramsay freed gas
from cleveite (a uranium ore) and the same yellow line appeared in his tube.
The APS calls the pair of observations "August 18 and October 20, 1868: the
discovery of helium"; the French struck a medal with both men on it.

I almost let the day pass — the obvious candidates (Bad Poetry Day, National
Fajita Day) had no physics in them. But this story has the exact shape this
repo loves: **one big idea that flips**. A spectrum is a dictionary; the Moon
is the bookmark. And the epilogue writes itself, because spectroscopy's
*other* great mystery line is a trap: the green coronal line at 530.3 nm (first
seen at the 1869 eclipse) was named **coronium** and cheerfully added to
speculative periodic tables until Edlén (1942, on Grotrian's 1939 hint) showed
it is Fe XIV — iron with thirteen electrons stripped off — in a *forbidden*
transition that can only glow in the corona's near-vacuum. Which meant the
corona is over a million kelvin. One unknown line paid out a new element; the
other paid out a thermometer reading nobody believed for seventy years.

## How it works

**Kirchhoff's flip is the whole lesson.** A hot dense source (the photosphere)
emits a continuum; the cooler thin gas above it absorbs at exactly the
wavelengths that same gas emits when hot and alone. So the uneclipsed Sun
shows law 3 — dark Fraunhofer lines on bright continuum — and the instant the
Moon removes the continuum, the chromosphere is a hot thin gas against black:
law 2, same lines, bright. The app labels this live in the Kirchhoff strip,
and the trace plot makes the flip literal: Hα's dip at 656.28 nm becomes the
tallest peak in the spectrum.

**Eclipse geometry (exact).** `lensArea(d, R, r)` is the classic two-circle
lens: `R²·acos((d²+R²−r²)/2dR) + r²·acos((d²+r²−R²)/2dr) − ½√((−d+R+r)(d+R−r)(d−R+r)(d+R+r))`,
degenerate to the smaller disk inside `d ≤ |R−r|`. The scene is an
illustrative *central* eclipse: Sun radius 15.9′, Moon 16.6′ (a hair bigger —
that's why totality happens at all), relative angular rate 30.5′/h. Totality
half-duration = (R_m − R_s)/rate ≈ 82.6 s, so C2→C3 ≈ 2 min 45 s; the clock
spans 8 min before C2 to 165 s past C3. `uncovered(t) = 1 − lensArea/(πR²)`
drives the continuum — 15% at −8 min, 0.33% at −60 s, 0 during totality
(the corona floor takes over). The disk inset is drawn **to scale**, both
disks, no exaggeration — the crescent at −8 min is honestly 37 px wide.

**The flash.** Emission visibility = `emergence(t) × (0.55 + 0.45·flash(t))`
where `emergence = clamp01(1 − uncovered/0.015)` — the chromosphere only
matters once the photosphere is under 1.5% — and `flash` is a pair of 8-second
Gaussians centred on C2 and C3. So bright lines grow through the last ~90
seconds of partial phase (true: that is exactly how Janssen realised he could
see prominences *without* an eclipse the next day), blaze at second contact,
and settle to the mid-totality ring (0.55) — which is also true: the ring and
prominences keep shining between contacts.

**Measurement.** The crosshair lives on a ±20 nm eyepiece under a 380–740 nm
finder; at the eyepiece's scale D₃ (587.56) and D₂ (589.00) sit ~23 px apart —
comfortably resolvable, which in reality they are not to the naked eye (1.44
nm apart; Janssen's advantage was the spectroscope, not the spacing). Library
matching uses ±0.65 nm; feature finding ±1.0 nm. The 1868 catalogue has twelve
entries (Ca, H Balmer, Fe, Mg, Na, and Earth's own O₂ B-band at 686.7 —
telluric lines were understood by then) and **helium is deliberately absent
from it**, as history was. The engine tests pin the hinge: `matchLibrary(587.56)
=== null`.

**The verdicts.** Claiming D₃ returns the helium story (Guntur → Lockyer →
*helios* → Ramsay 1895); claiming helium's quieter lines (He I 447.1, 706.5)
returns "the same stranger in another colour"; claiming sodium gets rebuffed;
claiming empty continuum gets nothing. In the 1869 epilogue the green line
returns the coronium trap: Edlén, forbidden Fe XIV, and the million-degree
corona it implies. Both epilogue lines are real coronal lines (530.29 Fe XIV,
637.45 Fe XIII) sitting on a lifted near-black continuum.

**The palette.** `wavelengthToRGB` is Dan Bruton's approximation with edge
attenuation and γ=0.8; the display applies a `I^0.45` gamma stretch (standard
astro-image practice, and an honest stand-in for eye adaptation) so the dying
crescent at 0.3% still shows as a dim rainbow while totality stays black
except for the lines.

## Interesting notes

- **The corona is drawn ~1000× brighter than reality** (floor 0.0012 vs the
  true ~10⁻⁶ of the photosphere). The label says so in the footer; without the
  lie the screen would show nothing at all during totality. Every other
  number is straight.
- **Line widths are exaggerated ~50×** (σ ≈ 0.45–0.9 nm vs real Fraunhofer
  widths of hundredths of nm). Real widths would be sub-pixel. The
  *wavelengths* are exact, which is what the game is about.
- The **B-band at 686.72 nm is in the library as "O₂ (air)"** — some dark
  lines in a solar spectrum belong to *Earth's* atmosphere, and by 1868 that
  was known. A nice free lesson sitting in the catalogue.
- First test run failed three times before the physics did: my "500 nm is
  cyan" assertion was wrong (Bruton puts full cyan at 490; 500 is a
  green-leaning teal), my lens-area test used external tangency where I meant
  internal, and my "between D₃ and D₂ is no-man's land" wavelength of 588.5
  was in fact inside D₂'s ±0.65 tolerance — the no-man's land is only
  588.21–588.35 nm wide, which is itself a nice measurement of how careful
  Janssen had to be.
- The engine originally had helium's blue line (447.1) trip the "stranger"
  alert even when the player parked on hydrogen's Hγ at 434 — the fix was to
  add the Balmer Hγ/Hδ lines to the catalogue, because of course the Balmer
  series was known in 1868. The library must be *period-correct*, not merely
  small.
- The disk inset started as "offset exaggerated ×8" because I assumed the
  geometry would be invisible; at 9.2 px/arcmin the −8 min crescent is 37 px
  wide. The exaggeration was deleted and the caption rewritten — the honest
  picture was already legible.
- Scope creep I refused: an 1895 "Ramsay's tube" scene (discharge-tube
  spectrum) and per-line slit images of the crescent. Both would be pretty;
  neither is needed for the flip → measure → claim arc, and this is a
  one-hour-a-day repo.
