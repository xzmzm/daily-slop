# NOTES — lucky plate

## Why this project

September 28 is the date multiple "on this day" sources give for Fleming's
first good look at the contaminated plate (he was back from Suffolk by
Sept 3; the celebrated observation is dated the 28th). The other candidate
for today was Falcon 1 Flight 4 reaching orbit (2008) — but the gallery
just had DART two days ago, so a second rocket week would repeat. The
penicillin plate also has the better story engine: an *accident* with
three separable preconditions, which is exactly the shape an interactive
toy wants.

The hook is that the discovery was contingent. Same spore, same staph, but
a plate kept at incubator warmth closes the window: the mold can't get a
head start and penicillin secretion shuts down above ~30 °C anyway. The
app is built around making that contingency touchable — a "运气的三个前提"
checklist that ticks live, and a temperature slider whose whole meaning is
one number: the crossover.

## How it works

Five fields on a 128×128 grid (0.703 mm/cell over a 90 mm dish), stepped
in 0.25-day substeps:

- **Bacteria** grow logistically at μ_s(T) = 3.2·exp(−((T−35)/9)²) per day,
  are killed at 1.2·(p − tolerance) per day wherever drug exceeds
  tolerance, and are buried where the mold takes the agar.
- **Mold** spreads as a diffusion–logistic wave (speed 2√(D_m·μ_m), D_m =
  0.035 cells²/day, μ_m peaking 1.5/day at 23 °C) after a 2-day
  germination lag from the spore.
- **Penicillin** is secreted by live mold at 2.2·exp(−((T−20)/8)²) per
  day, diffuses at D_p = 12.55 cells²/day (≈ 6.2 mm²/day — the real
  diffusivity of small solutes in agar), and decays at 0.12/day.
- **Tolerance** is per-cell, mutates under sub-lethal stress (5%/day,
  σ = 0.6 multiplicative), and is *advected with the bacterial flux* by
  diffusing the product c = tolerance·density alongside density itself —
  that is what lets one resistant survivor become a resistant colony.
- The 1928 script drives temperature through keyframes (cold snap ≈ 17 °C
  while Fleming is away, warm spell ≈ 26 °C in the last week of August);
  zone diameter is measured by casting 72 rays from the spore to the first
  live lawn.

The load-bearing number is the diffusion length λ = √(D_p/decay) ≈ 10
cells ≈ 7 mm. Halo width is set by the Bessel tail of a disk source:
p(r) ∝ I₁(R/λ)·K₀(r/λ) beyond a colony of radius R. That tail is brutally
steep — which is why the halo is a ring a few mm wide rather than the
whole plate, and why an earlier parameter set (D_p an order of magnitude
too small) produced no halo at all.

## Interesting notes

- **The first physics draft was wrong twice.** Penicillin diffusivity
  starts at D = 12 *cells²/day on the old 192-cell grid (0.47 mm cells):
  λ came out ~3.5 mm, so the steady-state drug field died essentially at
  the colony edge — tests measured a 0.3 mm halo. The fix was doing the
  Bessel math by hand: pick λ from the halo width you need, then invert
  for D and decay. Also lowered the grid to 128 cells, because explicit
  diffusion needs dt ≤ dx²/4D micro-steps and the boot-time 58-day burst
  has to stay under a second.
- **The mold couldn't grow at all in draft one.** The diffusion–logistic
  update skipped cells with m = 0 to save time — but a zero cell can only
  gain biomass if you evaluate the stencil *at* it. The colony sat at one
  cell forever while the tests politely failed.
- **A variable-shadowing bug painted the mold black.** `let rr, gr, br`
  inside the paint loop shadowed the `gr` grain array, so `gr[k]` was
  undefined, `sin(NaN)` → NaN, and `Math.max(0, NaN)` → 0 in ImageData.
  The dish rendered a black blob; the AI visual pass caught it after the
  logic tests had all passed. NaN in ImageData doesn't throw — it just
  clamps to black.
- **The cold snap needed σ = 9, not σ = 10.** With staph's temperature
  curve too wide, the lawn matured past 45% coverage during the cold snap
  before the mold reached 4 mm — the "mold got a head start" condition
  never fired and the luck checklist sat at 2/3. Narrowing to σ = 9 keeps
  staph genuinely frozen at 17 °C (0.07/day) while still growing at 20 °C
  (0.2/day) — which late-story resistance needs, since re-colonisation
  happens on a cool bench.
- **Resistance colonies originally couldn't form.** Tolerance reset to
  wild type wherever density fell below 0.02, which erased a mutant's
  identity exactly at its colony frontier. Threshold moved to 1e-3, and
  the bacterial diffusion coefficient dropped 0.38 → 0.16: at 0.38, an
  isolated survivor bleeds density (4·h·D = 1.5/day) faster than any
  staph can grow (μ_max = 1.3/day at 26 °C), so every resistant island
  melted before it could nucleate.
- **The mold eventually eats its own halo.** Keep culturing past
  September and the colony grows faster than the drug field can stay
  ahead of it; by "day 90" the zone diameter collapses onto the colony
  diameter. Unintended but true to life — old forgotten plates really do
  end up all mold.
- Boot state is deterministic (seeded mulberry32), so the gallery
  screenshot is always the same finished plate; the 58-day burst takes
  ~800 ms synchronously on load.
