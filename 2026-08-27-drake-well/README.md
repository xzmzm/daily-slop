# Drake's Derrick · 德雷克的钻塔

**Built by GLM-5.3**

Cable-tool drilling studio for the 167th anniversary of the Drake Well
(27 Aug 1859: Edwin Drake's steam-powered rig struck oil at 69½ feet on Oil
Creek, Titusville PA — the world's first well drilled intentionally for oil,
and day one of the petroleum industry). Uncle Billy Smith looked down the
hole on a Sunday afternoon and found it standing in oil.

## What it teaches, with closed forms

1. **Percussion drilling** — each stroke is a free fall: `δ = η·m·g·h/(A·S)`,
   so Drake's 250 kg string dropping 0.9 m at 22 strokes/min advances
   **3.0 ft/day** in shale (S calibrated to the historical rate). And you
   cannot rush gravity: the beam cycle only lends the bit `T/2`, so running
   the engine 11× faster buys *less* than nothing — the effective drop
   saturates at `½g(T/2)²`.
2. **Why the oil climbs** — the water pressure in the first sand beats the
   oil column's weight: the oil rises `h = ΔP/(ρg)`; with 160 kPa of surplus
   it stands 65 ft up a 69.5 ft hole, a few feet from the derrick floor.
3. **Darcy radial inflow** — `q = 2πkhΔP/(μ·ln(re/rw))`. The logarithm is
   the protagonist: half the drawdown is spent within `√(rw·re) ≈ 3 m` of
   the wellbore, and doubling the drainage radius only pays
   `ln`-ratio — Drake's defaults land on ~24 bbl/day (~1,000 gal/day, the
   historical yield).
4. **Arps decline** — `q(t) = qi(1+bDi·t)^(−1/b)` with closed-form
   cumulative: b=0 is the solution-gas cliff, b→1 the flat water drive that
   kept Drake's well at ~1,000 gallons a day for three years. Below it, the
   1859→1861 price crash: **$20 → 49¢ a barrel**.
5. **API gravity** — `141.5/SG − 131.5`; water is exactly 10° by
   construction, Pennsylvania's kerosene-grade light crude is 42°, and an
   8° "crude" is asphalt.

## How to run

```bash
open index.html          # or:
python3 -m http.server 8765   # then visit http://localhost:8765/2026-08-27-drake-well/
```

Click **⚙ 开钻** — the rig first drives cast-iron casing through the
water-bearing gravel to bedrock at 32 ft (Drake's pipe-driving trick), then
spuds in. Watch the rate jump when the bit reaches the oil sand at 59 ft,
drop six inches into the crevice at 69.5 ft, and strike. Presets re-tell the
whole story: **Drake's actual well · the 1861 boom & bust · a water-drive
giant**. Tabs add the decline-curve board, the Darcy radial-flow view, the
API hydrometer, and a drilling log.

## Tests

```bash
node --test test_physics.mjs    # 18 exact-formula tests
```
