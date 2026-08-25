# NOTES — Lavoisier's Ledger

## Why this project?

Today (26 Aug 2026) is the 283rd birthday of Antoine-Laurent de Lavoisier,
born in Paris on 26 August 1743. The other candidates I considered — Lee de
Forest's triode (born 26 Aug 1873) and the Women's Equality Day anniversary —
lost to a simple scan of this repo: **chemistry had not been done yet** in 34
days of daily builds, and Lavoisier is the single most "ledger-shaped"
figure in the history of science. His whole method was an accounting
identity: weigh the closed system before, weigh it after, and demand the
difference be zero. That maps perfectly onto this workspace's house style —
one invariant, a few closed forms, and a table that refuses to lie. It also
contrasts nicely with yesterday (optics/ray tracing) and the day before
(volcanology): the instrument this time is not a tube or a column but a
balance.

## How it works

The entire app is a bookkeeping device over one mole map. `physics.js` is
pure and UI-free:

- **Species registry.** Molar masses are *derived*, not typed in:
  `M(SnO₂) = M(Sn) + 2·M(O)` computed from an atomic-mass table, so
  conservation errors can't hide inside inconsistent constants.
- **Air budget.** A sealed vessel of V litres holds exactly
  `n(O₂) = 0.2095 · V / 22.414` mol of "active air" (0 °C, 1 atm) plus
  `0.7905 · V / 22.414` mol of spectator N₂. This one line reproduces the
  historical observation that sealed-retort air shrinks by about a fifth
  and then the reaction *stops* — the tin runs out of oxygen long before it
  runs out of tin.
- **Extent of reaction.** One number ξ drives everything:
  `n_after = n_before ± ν·ξ`, with `ξ_max = min(n_i/ν_i)` over reactants
  (limiting reagent). An open vessel draws its O₂ from an unbounded
  atmosphere (ξ_max set by the sample alone); a sealed one only has the
  jar charge.
- **Two ways to weigh.** `weighedMass(sealed) = Σ n·M` over everything;
  `weighedMass(open) = Σ n·M` over condensed phases only. Every "mystery"
  of pre-Lavoisier chemistry is the difference between these two sums:
  metals *gain* what the air donates (+ξ·32.00 g for tin), charcoal *loses*
  exactly the CO₂ that walks away. Conservation itself is stated on a
  hypothetically-closed system: for open runs the books credit exactly the
  atmospheric gas that was drawn in, and the drift is then float dust
  (<1e-9 g in the tests).
- **Manometer.** Same T, same V ⇒ `P₁/P₂ = n₁/n₂` over gas moles. Tin
  sealed drops to 0.791× (the missing fifth), the calx run rises to 1.560×,
  and water synthesis collapses to 0.143× — the jar tries to suck itself
  into near-vacuum, which is why the historical experiment was done over
  mercury.

The UI is a canvas bench (bell jar on a digital balance, seeded-deterministic
particles, U-tube manometer, burner) plus a register, a mass-trajectory
chart (gold invariant line vs cyan open-pan line) and a "phlogiston court"
tab that compares the theory's sign prediction (metals should get *lighter*)
with the live observation. All motion is a pure function of clock `t`, and
`window.__demo.step(dt)` advances it, so the video renderer is frame-stable.

## Interesting notes

- **The air must be *inside* the system.** My first draft modeled the jar's
  O₂ as a mere "supply limit" and the conservation test failed by exactly
  the mass of unconsumed air. The fix is the pedagogical point: Lavoisier's
  scale weighs the air too. After that one-line change (add the jar's O₂
  charge to the initial mole map), every invariant snapped to 1e-15 g.
- **Open-vessel conservation needs a hypothetical closure.** You can't put
  "the atmosphere" in a mole map, so for open runs the books credit exactly
  ξ·ν moles of drawn-in feed gas before comparing totals. That is honestly
  how Lavoisier argued it: the missing mass isn't lost, it's an unrecorded
  transfer.
- **Calibrated defaults carry the history.** 43.32 g of HgO ≈ 0.200 mol, so
  the default calx run yields 40.12 g Hg + 3.20 g O₂ with ξ = 0.1 mol — the
  numbers in the narration are the numbers on screen. The tin retort's
  1.2 L of air holds only 0.359 g of O₂, so 10 g of tin converts just 13%:
  exactly why the historical retorts ended with leftover metal and a
  partial vacuum.
- **Water synthesis is sealed-only in the UI** — not because conservation
  fails, but because "open" has no meaning when both reactants are bottled
  gases. The disabled button is itself a small lesson: Cavendish's
  eudiometer had to be a closed vessel.
- The chart's y-axis degenerated for the water scenario (a perfectly flat
  gold line gives span 0 and every tick read "52.0"); the fix was a
  range floor, not fake data.
- Left out of scope: the gun-barrel steam decomposition (Fe + H₂O →
  Fe₃O₄ + H₂, done with Meusnier in April 1784), fermentation chemistry,
  and the metric system. Any one of them could be its own daily build.
- Lavoisier was guillotined on 8 May 1794. Lagrange: "It took them only an
  instant to cut off this head, and a hundred years might not suffice to
  reproduce its like."
