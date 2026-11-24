# Forty-Three build notes

## Why this project?

On 25 November 1915 Einstein submitted *Die Feldgleichungen der Gravitation* to the Prussian Academy. A week earlier, on 18 November, he had used the near-final theory to explain Mercury's perihelion advance. [Caltech Einstein Papers](https://einstein.caltech.edu/news/one-hundred-years-of-einsteins-field-equations-and-of-the-explanation-of-mercurys-perihelion)

The field equations are hard to put on a screen. The 43″ they explained is easy to show, and it has a good story attached: Le Verrier spotted the leftover in 1859, invented a planet called Vulcan to cover it, and astronomers looked for that planet for decades. Earlier days covered Triton, Venera 4 and a comet landing, but none touched relativity. It beat the other candidates for the date, Nobel's dynamite patent (1867) and *The Mousetrap* (1952).

## How it works

All figures are arcseconds per century.

- **Observed advance: 574.10 ± 0.65.** This is measured against the stars, after removing the ~5,025″ that comes from Earth's own wobbling axis.
- **Newtonian pulls.** The planetary terms are Clemence's 1947 values: Venus 277.86, Jupiter 153.58, Earth 90.04, and a small tail from the rest. Together they make 531.53, which leaves 42.57.
- **General relativity.** Each orbit adds `6πGM / (c²·a·(1−e²))` radians. That is 5.02×10⁻⁷ rad per orbit, times 415.2 orbits a century, which gives 42.98. It closes the gap to −0.41, inside the error bar.
- **Einstein 1913.** The *Entwurf* theory with Besso gives about 18. The page shows that it falls short.
- **Vulcan.** The page computes Vulcan live with the first-order secular formula, `dϖ/dt = (n/4)·(m/M)·α·ᾱ·b⁽¹⁾₃⸝₂(α)`. Here ᾱ = 1 for an interior perturber, and the Laplace coefficient comes from 2,000-point quadrature. At 0.20 AU, Vulcan needs about 1.32 Mercury masses. At 0.10 AU it needs 8.4.

The orbit canvas is drawn to scale (e = 0.206). The time slider rotates the dashed orbit by `574.10″ × centuries` and the solid one by your model's total. Their difference is the orange wedge.

## Interesting notes

- I checked the Vulcan formula against the real planets before trusting it. It gives 286 for Venus, 160 for Jupiter and 97 for Earth, which is 3–7% above Clemence. The difference is the higher-order eccentricity and inclination terms Clemence includes and I don't. I kept the simple formula because it only sizes Vulcan, and `sim.test.js` pins the 8% tolerance.
- Vulcan is a reasonable fix on paper. Supplying Le Verrier's own 38″ from 0.17 AU takes about 2 Mercury masses. A planet that size inside Mercury would have been bright enough for eclipse and transit hunts to find, and it never turned up.
- The gap wedge first filled the whole sky when I unticked Venus. After a million years the model was 770° off, and `ctx.arc` happily drew a full circle. Now the wedge only shows when the gap is under one turn, and the readout gives the real number.
- A CSS `display: grid` on the Vulcan controls overrode the `hidden` attribute, so the sliders stayed visible in every mode. It needed an explicit `[hidden] { display: none }`.
- Out of scope: Mercury's real eccentricity changes and the precession of its orbital plane. Both are real, but neither touches the 43″ story.
