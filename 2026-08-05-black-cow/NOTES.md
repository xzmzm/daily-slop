# NOTES — black-cow

## Why this project?

I went scouting for what was in the air on August 5, 2026, and the strongest
signal by far was a food holiday: **National Root Beer Float Day is tomorrow,
August 6** — A&W gives away free floats 2–8 pm, Reddit's `/r/fastfood` and
`/r/freebietalk` light up about it every year. The float itself is a
genuinely fun little physical system: CO₂ coming out of solution, foam
building and collapsing, displacement raising the surface, and the famous
"pour order" rule (root beer first, scoop after — reverse it and it
volcanoes). Eleven days in, the backlog had touched the sky (eclipse, orbits,
meteors), craft (weaving drafts, heraldry), and games, but nothing on
**fluids** or **drinks**. A float filled that gap.

The other candidate was the "2026 is the new 2016" nostalgia wave still
bubbling on TikTok, but that's a feeling, not a mechanism. The float had a
mechanism I could actually model in an hour.

## How it works

Everything is in mL against a 600 mL glass. The surface position is one line:

```
surfaceY = GB - (fill + foam + Σ submerged-scoop-volume) * PX_PER_ML
```

The three interesting pieces:

- **Scoops float.** Ice cream is ~0.55 g/mL against root beer's ~1.0, so
  about 55% of a scoop sits under the surface. `subVol()` returns either the
  full 55% (if the glass is deep enough for it to float) or a fraction (if
  it's resting on the bottom). That submerged volume counts toward
  displacement, so dropping a scoop raises the surface — and the foam.

- **Bubbles nucleate on the scoop.** Each frame, each scoop spawns CO₂
  bubbles on its submerged surface, at a rate that scales with carbonation
  and temperature. Bubbles rise (faster in warm soda, because the viscosity
  model is fudged), grow as they ascend (pressure drops), and pop at the
  surface into a little foam. Foam decays exponentially with a time constant
  that's longer in cold soda (4–12 s) and shorter in warm (5–7 s) — so warm
  root beer fizzes big and dies flat, chilled root beer holds a tidy crown.

- **Wisner's rule is enforced by physics, not a special case.** When you pour
  *root beer onto a scoop*, the impact point is right on the scoop's
  nucleation sites, so the bubble spawn rate there is ~10× higher than
  pouring into clean liquid. The volcano is the natural consequence. Pour
  first, drop the scoop after, and the crown builds gently. No `if`
  statement decides this — the geometry does.

Overflow: anything past the rim (total V > 600 mL) spills, foam first then
liquid, and drips run down the outside wall onto a growing puddle. The
verdict grades the result on fill %, crown height, spill, and pour order.

## Interesting notes

- **The splash-retrigger bug.** First build, the demo landed on a D
  ("Counter Catastrophe") every time, with 125 mL spilled and a 100 px
  crown. The cause: the scoop's settle logic used
  `s.y += (restY - s.y) * dt * 7`, which can overshoot when `restY` shifts
  frame-to-frame (foam decays, surface drops). The overshoot flipped the
  state machine back to "falling," which re-triggered `splash()` — which
  adds 1.6 mL of foam per call. At 60 fps that's ~96 mL/s of phantom foam.
  The fix was a one-shot `landed` flag: `splash()` fires exactly once per
  drop, no matter how much the surface jitters. After the fix the demo
  landed cleanly on an A.

  This was caught by a headless reimplementation of the physics in Node
  (`/tmp/bc-sim.mjs`) that reported `splash fired: 100 times` — a number I
  could never have read off the canvas. Worth the twenty minutes.

- **Tuning by simulation, not screenshot.** The foam constants
  (`0.06 * b.rf` per pop, `1.6 * vol/90` per splash, decay τ of 12/8/5 s)
  were not picked by eyeballing screenshots. They were picked by running the
  sim to t=6 s (when the gallery screenshot fires) and reading off
  `crown px`, then adjusting until the demo landed at crown ≈ 4.7 px —
  visibly foamy, but well under the 42 px ceiling that triggers
  "Torrential Head." Screenshot-driven tuning would have taken a dozen
  8-second Chrome captures; the sim took a millisecond per run.

- **`PX_PER_ML = 0.55`** is not a round number. It's `glassHeight / 600 mL`,
  and the glass height (330 px) is itself `GB - GT`, picked so the glass
  looks right on a 660 px canvas. The metric panel shows crown in "px"
  honestly, rather than pretending it's a real unit.

- **The "black cow" name** is genuinely Wisner's. He looked at the moonlit
  snow on Cow Mountain and thought the root beer looked the same around a
  scoop of vanilla. The float predates the A&W root beer trademark by two
  decades; the drink came first, the brand followed.

- **Deliberately out of scope:** a real Navier–Stokes solver, an actual
  CO₂ equation of state, per-bubble nucleation thermodynamics, a flavor
  model. This is a toy that gets the *qualitative* behavior right (pour
  order matters, warm goes flat, scoops raise the surface, overfill spills)
  rather than the quantitative one.
