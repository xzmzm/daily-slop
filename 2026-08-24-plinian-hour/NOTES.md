# Plinian Hour — NOTES

## Why this project

The week was getting space-heavy: Voyager's gravity assists (Aug 20), Vera
Rubin's dark matter (Aug 23). August 24 offered the strongest anniversary on
the board — the traditional date of the 79 AD Vesuvius eruption — and it
pointed in a completely different direction: geology, atmospheric buoyancy,
and density currents, none of which any previous day had touched. The hook
writes itself: the eruption that buried Pompeii *also* named the eruption
type, because a 17-year-old's letters to Tacitus were accurate enough that
volcanologists still say "Plinian column". A day about the physics of the
column is also a day about the first volcanology ever written.

The design idea: the historical outcome (who got pumice, who got the surge,
and when) should *emerge* from sliders rather than be scripted — the
historical preset is just one parameter set, and the tests pin the physics
to the real chronology.

## How it works

Three independent sub-models, all closed-form (no ODE integration anywhere —
deliberately, for testability and speed):

**1. Column.** Height follows the quarter-power turbulent-plume scaling,
`H = 33 km · (ṁ/10⁸ kg/s)^0.25`, calibrated so the historical mass flux
(~1.3 × 10⁸ kg/s, from `ṁ = πr₀²u₀ρ_mix`) gives ~35 km — inside Carey &
Sigurdsson's 27–35 km estimate for the grey-pumice phase. `ρ_mix` is the
ideal-gas exit density divided by the volatile fraction (5%), because the
other 95% of the mass is pyroclasts riding along.

The fountain-collapse criterion is the honest-but-simplified core: the jet
leaves the vent *denser than air* (solids loading → `g_load ≈ 7–8 m/s²`
downward) and survives only if its ballistic coast `u₀²/2|g_load|` reaches
the buoyancy-reversal demand `2.2 km · √(ρ_mix/ρ_air)` — the height where
entrained dilution flips the mixture buoyant. The 2.2 km prefactor is a
**closure constant standing in for thermal dilution** (hot entrained air
expands and lifts; modelling that properly means the full Woods 1988
enthalpy-coupled ODEs, out of scope for a daily build). It's calibrated so
the historical jet (260 m/s, 1000 K) sustains with a thin +0.34 km margin —
which is exactly the drama I wanted: the real column was near the edge, and
the grey-phase collapses that killed Pompeii happened at night when it
crossed it. Monotonicity is exact: faster helps, hotter helps, and a 650 K
jet at the same speed falls back.

**2. Fallout.** Pyle (1989) exponential thinning on the dispersal axis:
`M(X,Y) = M₀·e^(−X′/b)·e^(−Y²/2w²)`, downwind branch length `b = 3.8 km ·
(1 + u_w/15)`, upwind branch 0.35·b, whole lobe shifted downwind by
`0.12·u_w·z_release/v_t,med`. Clast terminal velocity switches Stokes →
Newton drag at Re = 1/1000 with a log-space bridge (fine ash really does
come out at mm/s — the test asserts it). The absolute-magnitude calibration
(`M₀ = 0.75e-8·(erupted kg)^0.92`) was tuned to land Pompeii at ~190–220 cm
and upwind Herculaneum at ~5 cm — the documented contrast.

**3. Surge.** Benjamin box model for each collapse pulse: front speed
`U = 1.19·√(g′h)` with `h = V/πR²`, which integrates to `R²(t) = R₀² +
2Fr√(g′V/π)·t` — so arrival time is closed-form, and **runout depends only
on volume**: `R_max = √(V/πh_stop)`. That single fact is the whole night of
August 25: 1.4 km³ reaches Herculaneum (7 km) but not Pompeii (9.6 km);
2.2 km³ finally clears Pompeii's wall. Pulses carry angular sectors so the
radial model can still spare Pompeii at 1 AM while taking Herculaneum —
currents are steered by topography, and the sector widths encode that.

## Interesting notes

- **The MTT rabbit hole.** I first implemented a real Morton–Taylor–Turner
  plume ODE (Q, M, buoyancy flux, RK4). With the solids-loaded exit density
  (~4–5 kg/m³) the reduced gravity is so negative that the jet's momentum
  dies within ~2 km of the vent and *every* parameter set collapses. The
  missing physics is thermal: entrained cold air is heated by the hot
  gas+clasts and expands, which is most of why real columns work. Doing that
  right is the full Woods model — too much for today — so the quarter-power
  scaling (which *is* the dimensional-analysis result of the full physics)
  plus an explicit collapse criterion took its place. The closure constant is
  documented above rather than hidden.
- **Absolute isomass magnitudes fight back.** My first grain-class Gaussian
  mixture put ~30 kg/m² at Pompeii instead of ~1100. Root cause: spreading
  7 × 10¹² kg over realistic footprints gives ~10 kg/m² per class — real
  proximal deposits are *steep*, exponential with ~4 km decay, with most
  mass in the first 10 km. Switching to Pyle thinning fixed both the shape
  and the magnitude in one move.
- **The sea was on the wrong side.** First map build filled land as "right
  of the coastline polyline" — which put the Bay of Naples in the top-left
  corner and dry land over the Tyrrhenian. Fixed by filling land everywhere
  and biting the sea polygon (Naples → Pozzuoli → Misenum cape → inner shore
  → peninsula → open water) out of the SW corner.
- **Bearings need normalizing.** `atan2(dE, dN)` returns −106° for
  Herculaneum (WSW), and the wrap-aware sector test only *coincidentally*
  still hit it. Normalizing to [0, 360) fixed it properly; the test pins
  Herc at 253° ± 1.5.
- **A 340 m/s cold jet legitimately survives.** My first collapse test
  asserted a cold jet collapses at *any* speed; at 340 m/s it doesn't, and
  shouldn't — enough kinetic energy per kg carries even a cold load past the
  reversal height. The test now compares same-speed hot vs cold.
- **Vertical exaggeration is deliberate.** The section view is 40 km tall
  and 22 km "wide" in the same pixels; real volcano cross-sections do the
  same or the column is an invisible hairline. The map view is the honest
  geometry.
- **Left out:** pyroclastic-flow topographic channeling (sectors approximate
  it), lahars, the Sarno river floods, tsunami evidence in the bay, and the
  October-date debate (noted honestly in the README instead).
