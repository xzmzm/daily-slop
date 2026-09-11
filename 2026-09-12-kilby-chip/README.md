# Kilby's Germanium Bar

An interactive studio for the first working integrated circuit, demonstrated 68 years ago today: on 12 September 1958 at Texas Instruments in Dallas, Jack Kilby pressed a switch on a phase-shift oscillator built on a single 7/16 × 1/16 inch germanium bar, and the oscilloscope drew a continuous sine wave.

Built by GLM-5.3

## How to run

Serve locally with Python (port 8000 is reserved on this machine):

```bash
python3 -m http.server 8765
```

Then visit:
`http://localhost:8765/2026-09-12-kilby-chip/`

## Test suite

Run the 20 closed-form physics assertions with Node:

```bash
node test_kilby.mjs
```

## Features

- **Tyranny of Numbers desk**: the 1958 assembly problem as arithmetic. One logic gate discretely costs 8 parts, 16 solder joints and 8 wires; MTBF = 1/(N·λ). Slide the gate count, then flip to monolithic and watch a full board of parts collapse into a handful of packages (Apollo AGC preset included, with the ENIAC 17,468-tube / 2-day MTBF anchor).
- **The Germanium Bar cross-section**: the whole circuit as one piece of material — mesa transistor, bulk resistors (R = ρL/A, tunable), a reverse-biased junction capacitor (C = εA/W with live depletion width), and the hand-soldered gold flying wires that stood in for the interconnect TI could not yet make. Sends its R and C straight into the oscillator.
- **Phase-shift oscillator bench**: the actual circuit simulated in closed loop. Nodal state space for the three RC sections, instantaneous saturating amplifier, RK4 integration, triggered phosphor scope with audio. The exact results of the analysis: β = −1/29 at ωRC = 1/√6, minimum gain 29 (Routh–Hurwitz boundary of the closed-loop cubic), f₀ = 1/(2πRC√6), growth rate from the dominant root, and the describing-function settling amplitude.
- **Flying wires → planar → Moore's law**: Kilby's gold arcs versus Noyce's oxide-insulated aluminum traces side by side, then a clickable log-scale plot of transistors per chip from 1 (1958) to 4 T (2026) that computes the implied doubling time between any two landmarks — 1965–1971 comes out at ≈ 1.2 years, 1971–2023 at ≈ 2.1, which is Moore's own story in two clicks.
