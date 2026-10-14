# Surface Sweep — October 15, 2026

## Why this project?

October 15 is [Global Handwashing Day](https://globalhandwashing.org/global-handwashing-day/about-ghd/).
The gallery already has genetics, bacterial growth, reaction–diffusion,
optics, and quite a lot of spaceflight. A kitchen experiment about a
surface-tension gradient was a new mechanism and a much smaller subject.

The [Fleet Science Center's pepper experiment](https://www.fleetscience.org/sites/default/files/2020-11/fleet-tv_pepper-and-soap.pdf)
suggests the useful first comparison: touch clean water with plain water,
then with soap. The [University of Minnesota's outreach account](https://sfa.cems.umn.edu/venture-2018-19/marangoni-effects)
adds an especially good detail: accidentally contaminating the water in
advance weakened their later soap-powered experiment. That became the
“Evenly soaped” button. A spectacular first drop is fun; a weak second
experiment makes the mechanism understandable.

## How it works

The circular dish is a mask on a 65 × 65 grid. Each included cell stores a
nonnegative, dimensionless surface concentration `c`. A soap drop adds a
Gaussian patch, with width fixed and height controlled by the dose slider.
Nothing is added for the water control. The visible ring merely marks contact.

Relative surface tension is `gamma(c) = 1 - c/(c + a)`, with `a = 0.22`.
This decreases and saturates: an extra drop changes a previously clean
surface much more than an already concentrated one. Particle velocity is
proportional to `grad(gamma)`, so pepper moves toward the cleaner surface.
The factor of 40 in the mobility is just a scale factor, not a measurement
of a particular detergent in mN/m.

Soap must spread too. Starting with a local mobility approximation
`u = 40 M grad(gamma)`, surface conservation gives
`dc/dt = div(D grad(c) - c u)`. The resulting nonlinear diffusion has
coefficient `D + 40 M a c/(c+a)^2`. Rather than estimating a separate
upwind flux, the implementation integrates that coefficient:

```
G(c) = D c + 40 M a [log((c+a)/a) + a/(c+a) - 1]
```

Each pair of adjacent cells exchanges `(G(ci)-G(cj)) dt/h²`. Every amount
subtracted from one cell is added to its neighbor. Edges leaving the circle
are absent, which implements a closed, no-flux boundary. Uniform fields
therefore remain exactly stationary, and soap mass is conserved between drops.

`D = 0.0008`, `M = 0.003`, and the maximum time step is 1/240 model second.
The diffusivity is bounded by `D + 10 M = 0.0308`; with `h = 1/32`, the
chosen step is below `h²/(4 × 0.0308)`, the square-grid explicit stability
bound. Pepper samples the tension gradient by bilinear interpolation. It
stays just inside the dish wall. The 1,100 flakes use a seeded generator,
so clean and coated experiments begin with exactly the same pepper.

## Notes from the build

- The first working engine cleared 95% of the central flakes after four
  model seconds on clean water, versus 17% with the uniform 1.2 coating.
  These are reproducible outputs of this model, not experimental measurements.
- The conservation test holds the total soap mass to within `1e-9` after
  multiple drops near the boundary. Testing a uniform coating also catches
  a common circular-mask mistake: treating cells outside the bowl as clean
  water would invent a current at the rim.
- The video and screenshots use the same renderer and model as the page.
  A small `window.sweep` interface advances model time deterministically;
  actual controls still supply all the drops and comparisons in the video.
- A wide desktop canvas uses `object-fit: contain`. Pointer coordinates
  account for the letterboxing; browser checks click the real dish at four
  widths rather than only exercising the center button.
- The first mobile screenshot exposed a missing space where a desktop line
  break was hidden. The next layout pass also shortened the controls so the
  full experiment fits the gallery's 1280 × 800 capture.

## What it leaves out

The local mobility law is an explanatory approximation. There is no solution
of the three-dimensional flow or pressure field, no adsorption/desorption,
no evaporation, no finite-size interaction between flakes, and no sinking.
A real water drop can disturb the surface mechanically; the control here
represents a gentle wet touch, without adding volume or diluting the existing
soap. Model seconds, drop sizes, and concentrations are illustrative.

Pepper is a flow tracer. Its outward movement is not evidence that soap
kills germs by making them flee. Keeping that distinction visible mattered
more than making this into a handwashing score or a germ-clearing game.

Additional background: [ACS, Surface Tension](https://www.acs.org/middleschoolchemistry/lessonplans/chapter5/lesson2.html).
