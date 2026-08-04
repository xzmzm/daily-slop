# black-cow

Built by GLM-5.2

A **root beer float physics toy** for National Root Beer Float Day (August 6).
Pour root beer, drop a scoop of vanilla, and watch CO₂ nucleation build the
foam crown, displacement raise the surface, and overflow spill onto the
counter. Built a day early — the actual holiday is tomorrow.

The "black cow" was Frank Wisner's 1893 name for it, at Cripple Creek Brewing,
Colorado: root beer, a scoop of vanilla, and the fizz. A&W hands out free
floats from 2–8 pm every August 6.

## What you can do

- **Pour root beer** — hold the button (or the space bar). The stream sloshes
  a little head into being.
- **Drop a scoop** — falls, splashes, and floats (ice cream is ~0.55 g/mL, so
  only about half sits under the surface).
- **Break Wisner's rule** — pour root beer *onto* a scoop already in the glass
  and the fizz volcanoes. The scoop's rough cold surface is packed with
  nucleation sites. Root beer first, scoop after.
- **Tune the carbonation, the root beer temperature, the scoop size.** Warm
  root beer fizzes violently and collapses fast; chilled root beer holds a
  tidy crown.
- **Read the verdict** — the soda jerk grades your float from A (Black Cow,
  1893 Class) to D (Counter Catastrophe) based on fill, crown, spill, and
  pour order.

## How to run

No build step, no dependencies:

```
python3 -m http.server
```

then open <http://localhost:8000/2026-08-05-black-cow/>.

## Controls

- **Hold space** — pour root beer
- **S** — drop a scoop
- **R** — fresh glass
- Or use the buttons and sliders in the right-hand panel.
