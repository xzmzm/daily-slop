# Faraday's Ring

Built by GLM-5.3

An electromagnetic-induction studio for the 195th anniversary of the
discovery: **29 Aug 1831**, when Michael Faraday wound two coils on a soft
iron ring in the Royal Institution's basement, touched a battery to one and
watched the other's galvanometer needle **kick and fall back** — kick again,
the other way, when he broke the circuit. The first transformer, and the
birth of ε = −N·dΦ/dt.

The whole lesson is closed forms:

1. **Induction sees change, not current** — `ε₂ = −M·dI₁/dt` is exactly zero
   while the switch sits closed, no matter how many amps flow. Hold the key
   and the meter sleeps; the kicks live only at make and break, opposite
   signs (Lenz).
2. **The ballistic kick counts flux, not news** — `q = N₂ΔΦ/R₂` is
   independent of how fast you break: a 1 µs snap and a 10 ms slide deliver
   the *same charge* while the peak EMF differs by 10,000× (both verified by
   numeric quadrature over the piecewise-exact replay).
3. **The ring's whole job is reluctance** — `ℛ = l/(µ₀µ_r A)`, so
   `L = N²/ℛ` and `M = N₁N₂/ℛ = √(L₁L₂)` (k = 1, reciprocity exact). Take
   the iron away and every kick divides by exactly µ_r = 3000 — the
   near-miss that would have left Faraday staring at a sleeping needle.
4. **Volts by violence** — the break demands `|ε| = L·I₀/t_b`, but the
   contact arc clamps it at V_bd, which means *you cannot break faster than
   t_eff = L·I₀/V_bd*; the secondary sees exactly `V_bd·N₂/N₁` (because
   M/L₁ = N₂/N₁ on a shared core). That spike is the Ruhmkorff coil, the
   ignition coil's 26 kV, and — through Hertz's spark gap — the first radio
   waves.
5. **What the ring grew up into** — drive it with AC and `V_rms = π√2·f·N·Φ̂`
   (the "4.44" on every transformer nameplate), `V₂/V₁ = N₂/N₁`, and the
   B_max gauge warns when you push the little 6-inch ring past iron's 1.8 T
   knee — which is why real mains cores are big.

Includes the 1831 bench (iron ring, knife switch, ballistic galvanometer,
break sparks that only strike when the break is actually fast enough), a
dual-trace scope, the kick-anatomy tab with its equal-charge areas, the
magnetic-circuit tab (Φ = N₁I₀/ℛ as Ohm's law), the transformer tab, the
history ledger (Henry saw it first; Faraday published first), four presets,
and 16 exact-formula node tests.

## How to run

```bash
python3 -m http.server 8765        # from the repo root
```

then open <http://localhost:8765/2026-08-29-faradays-ring/>. No build step,
no dependencies. Run the exact-formula tests with:

```bash
node --test 2026-08-29-faradays-ring/test_physics.mjs
```
