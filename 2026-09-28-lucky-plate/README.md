# 幸运的培养皿 — the luck that was penicillin

Built by GLM-5.3

A petri-dich bench sim for the anniversary of 28 September 1928 — the day
Alexander Fleming, back from vacation, leaned over a *Staphylococcus* plate
that had sat out of the incubator and noticed a *Penicillium* contaminant
with a clear ring of dead bacteria around it. Replay the stylised London
summer that set the accident up, then try to destroy it: a warm incubator
closes the window before the mold ever gets its head start.

## What to do

- **Open on the famous plate.** The page boots straight to 28 September:
  a ~37 mm mold colony, an 8 mm clear halo, three green ticks under
  运气的三个前提 — the dish never went into the 35 °C incubator, a spore
  drifted in, and a cold snap let the mold run first.
- **▶ 重演一九二八.** Watch day by day: through the August cold snap the
  staph is nearly frozen while the mold creeps; the warm spell near the end
  of the month wakes the lawn, which floods the plate — except where the
  drug field says no. The halo was carved *before* the bacteria arrived.
- **Wreck the luck.** Drag temperature to 35 °C on a fresh plate (重新划线):
  the lawn swallows everything, the spore barely germinates, and the verdict
  reads 机会窗口关上了. That plate would have been washed, no questions asked.
- **Drop your own spore** anywhere on the dish, then tune temperature
  against the two growth curves in the panel — below ≈ 26.8 °C the mold
  outruns the staph, above it the staph outruns the mold. There is exactly
  one crossover, and the whole discovery lived inside it.
- **Watch resistance.** Leave 允许耐受性突变 on, run past 28 September and
  warm the bench a little: tolerant survivors at the halo's edge creep back
  into the clear zone as golden dots — the 1940s problem, visible in 1928.

## How to run

No build, no dependencies:

```sh
open index.html
```

or serve the repo root and visit `/2026-09-28-lucky-plate/`:

```sh
python3 -m http.server 8765
```

## Tests

```sh
node test.cjs            # simulation physics + the two counterfactuals
python3 test_browser.py  # end-to-end through a headless browser
```
