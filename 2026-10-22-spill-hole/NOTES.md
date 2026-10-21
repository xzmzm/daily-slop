# Spill Hole — October 22, 2026

## Why this project?

The October 22 search led to Garnerin’s balloon-to-parachute descent in 1797. FAI describes a basket hanging under an umbrella-like canopy and a severe pendulum effect from uneven rim spill. NASA’s Orion parachute interview uses the familiar grocery-bag parachute with a small hole as an example of improved stability. That gives one concrete interaction: remove material and make the ride steadier.

I scanned all four monthly indexes before choosing it. There are already balloons, an airship, spacecraft descents and a tuned mass damper. This focuses on a different mechanism: crown venting, with a visible drag-versus-stability comparison. I left out balloon steering, packing and opening shocks.

## How it works

Vertical motion uses constant-density quadratic drag. The projected disk is A = π × 3.5² square metres. With vent fraction p, the assumed drag area is 1.3 A (1−p)(1−0.9p). The first factor removes material; the second is an explicit, illustrative drag-coefficient change. Terminal speed is sqrt(2mg / (ρ CdA)), with m = 80 kg and ρ = 1.225 kg/m³. The exact displacement from rest is vt²/g × log(cosh(gt/vt)). The implementation uses a stable log-cosh expression and solves analytically for touchdown at 120 m.

Rocking uses a separate forced pendulum, integrated at 0.02 s with semi-implicit Euler. Angular acceleration is −1.6 sin(θ) − (0.06 + 8p)ω + 0.12(1−p/0.25)² sin(1.22t). Every run starts tilted by 0.22 rad with zero angular velocity. Venting raises damping and lowers periodic forcing. These coefficients are tuned for legibility, not measured or derived from fluid dynamics. Angle does not alter vertical drag: the two parts are intentionally decoupled.

The swing reading is the root-mean-square angle during each canopy’s own final eight seconds before touchdown. It is a full-run comparison, not a running average at the replay cursor. All vent settings share the same initial conditions and forcing phase. With no vent, the tracks match exactly.

## Interesting notes

The first oscillator forcing of 0.40 produced swings past 100 degrees. That made the pendulum look dramatic but overwhelmed the intended small comparison. Reducing it to 0.12 keeps the reference below 40 degrees throughout the modeled drop. The resulting 6% example has about 83% lower RMS rocking and 6% higher terminal speed. Those numbers describe this toy only.

A strict touchdown test caught floating-point residue of roughly 3 × 10⁻¹⁴ m. Samples at or after the analytic landing time now clamp exactly to zero. The baskets stop at the same ground line; their canopy and basket dimensions are schematic, while altitude uses a shared scale.

The crown opening scales with the square root of area fraction. Scaling its width directly with the percentage would substantially understate the visible hole. Mobile uses the same two lanes, with smaller canopies and controls stacked underneath. Reduced-motion playback jumps to the end; manual scrubbing still works.

## References

- https://www.fai.org/news/garnerin-1797
- https://www.nasa.gov/podcasts/houston-we-have-a-podcast/orion-parachutes/

Build and narration attribution: GPT-6.1 Sol.
