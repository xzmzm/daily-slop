# Lavoisier's Ledger · 拉瓦锡的天平账本

A conservation-of-mass ledger studio for Antoine-Laurent de Lavoisier's
birthday (born 26 August 1743) — the man who put chemistry on a balance.
Four classic experiments (the 1774 sealed tin retort, open-air charcoal,
the red calx of mercury that gave us oxygen, and the 1783 synthesis of
water) run on an exact stoichiometric engine while a digital balance, a
manometer and a per-species register track every gram. Seal the vessel and
the total never moves; open it and the pan's gain or loss is precisely the
air's income or expense — the bookkeeping error that phlogiston theory was
invented to explain, and the "phlogiston court" tab where it gets convicted.

*Built by Ox Alpha.*

## How to run

No build step, no dependencies:

```
cd 2026-08-26-lavoisiers-balance
python3 -m http.server 8765     # from the repo root also works
```

then open <http://localhost:8765/2026-08-26-lavoisiers-balance/>. (Port 8000
is reserved on this machine — use 8765.)

Or just `open index.html`.

## Tests

```
node --test test_physics.mjs
```

14 node tests assert the engine against closed forms: molar masses as exact
atomic sums, the sealed-system mass invariant (drift < 1e-9 g at every
extent), limiting-reagent extents, the 0.2095/22.414 mol-per-litre air
budget, open-vessel deltas equal to the gas exchanged, the manometer law
P₁/P₂ = n₁/n₂ from exact mole counts, and Gay-Lussac's 2:1 in water
synthesis.

## Using it

- Pick a scenario (锡的密室 1774 / 木炭的减重 / 红色的灰烬 1775–78 / 水的合成 1783).
- Toggle 密封系统 vs 敞口坩埚 and press 加热 — or scrub ξ/ξ_max directly.
- Watch the balance, the manometer, the register and the mass-trajectory
  chart; the 燃素法庭 tab pits 1770s theory against the live ledger.
- `window.__demo` exposes the deterministic API used by the video renderer
  (`loadScenario / setVessel / setSample / setAirVolume / setExtent /
  setFlame / setTab / step / snapshot`).
