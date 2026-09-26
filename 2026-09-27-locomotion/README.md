# Locomotion No. 1 — the 1,000 lb adhesion studio

Built by GLM-5.3

An adhesion-physics playground for the anniversary of the Stockton & Darlington
Railway's opening day (27 September 1825) — the world's first public railway to
haul passengers with a steam locomotive. Stephenson's *Locomotion No. 1* weighed
6½ long tons and could throw about a thousand pounds of pull at the rail; the
whole game is what that small number could and couldn't do. Drag the gradient,
load chaldron wagons, grease the rail with leaves — and watch the same train
steam ahead, spin its wheels, or stall outright.

## What to do

- **Run the default train.** Twelve loaded wagons on the level: the wheels bite,
  smoke beats four chuffs per wheel turn, and 1,000 lb gathers way slowly,
  because 51 tons behind 1,000 lb is honestly slow.
- **Climb 1 in 33.** The verdict flips to *stalls*: adhesion (3,640 lb dry) is
  fine — the cylinders simply don't make enough pull. That is exactly why the
  S&DR's two steep banks (Etherley and Brusselton, 1 in 30½ / 33½) were worked
  by **stationary steam engines and ropes**, not locomotives.
- **Grease the rail.** Same hill, *Leaves*: now the failure changes character —
  the adhesion bar collapses below cylinder pull and the drivers spin. Tick
  *Sand the rail*: the spin stops… and you're back to *stalls*. Sand adds grip,
  never horsepower.
- **Ride the survey.** The falling-grade preset shows the other half of 1825
  engineering: the line falls to the sea, so loaded coal trains were
  gravity-assisted all the way to Stockton.
- **Replay opening day.** The profile strip at the bottom runs the actual
  27 September choreography — rope up the banks, horses over the Gaunless,
  *Locomotion* from Mason's Arms — with the real numbers: 21 seated wagons,
  450–600 aboard, a 35-minute engine repair, 31 vehicles and 550 passengers
  out of Darlington, and a crushed foot near Stockton.

## How to run

No build, no dependencies:

```sh
open index.html
# or
python3 -m http.server 8765   # then visit http://localhost:8765/2026-09-27-locomotion/
```

## Tests

```sh
node --test test.cjs          # tractive effort, adhesion regimes, ladder, route
python3 test_browser.py       # drives the real page end to end
```

Locomotive data from the standard cited figures (9¾ in × 24 in cylinders, 50 psi,
4-ft coupled wheels, ~6.5 long tons); incline gradients after Tomlinson's
*The North Eastern Railway*. Rolling resistance and μ values are honest-era
simplifications — see [NOTES.md](NOTES.md).
