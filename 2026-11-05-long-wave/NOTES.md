# Long Wave — November 5, 2026

## Why this project?

Today's web scouting found UNDRR's World Tsunami Awareness Day material for November 5. The collection has acoustic reflections, standing waves, a surface-tension experiment, and a ship lock, but no ocean-wave shoaling experiment. The useful little surprise is that a long wave can move at aircraft-like speeds in deep water while its surface displacement stays small. Shallower water changes its speed, spacing, and amplitude together.

I chose that one relationship over an evacuation game or a dramatic breaking-wave animation. It fits the daily scope and lets the interaction make a precise comparison: hold the crest's location still and change the water underneath it.

## How it works

The fictional section is 900 km long. Depth is 4,000 m to 240 km, follows a half cosine down to the selected shelf depth between 240 and 660 km, then stays constant. The cosine gives a continuous slope at both ends. Shelf depth ranges from 50 to 4,000 m; selecting 4,000 removes the slope entirely.

For a long wave, the local propagation speed is `c = sqrt(g h)`. A trapezoidal integral of `dx/c` at 250 m spacing builds a monotonic travel-time table. Subtracting the value at 80 km makes the marked crest start there at time zero. Binary search inverts the table to find its position for any time.

The wave packet is a cosine with a Gaussian envelope, expressed in travel time instead of distance. Its period is 720 seconds and the envelope's standard deviation is 0.72 periods. The same temporal period therefore occupies less horizontal distance where propagation is slower. A local sinusoid in the lower comparison isolates this wavelength change; that small comparison intentionally keeps the two drawn amplitudes equal.

Conserving ideal energy flux `a² c` gives Green's-law amplitude `a = 0.5 × (4000/h)^(1/4)`. At 200 m the crest is about 1.06 m above still water and moves at 159 km/h; at 50 m it is about 1.50 m and moves at 80 km/h. The deep-water reference is 0.50 m, 713 km/h, and a 142.6 km wavelength.

This is a prescribed one-way asymptotic wave packet, not a solution of the full shallow-water equations. In particular, it cannot predict reflected waves, coastal run-up, or actual arrival times on a real coastline. The slope is deliberately broad, but the slowly varying approximation still becomes less accurate for a real wave over rapidly changing depth.

## Interesting notes

- Keeping time fixed when changing depth makes the crest jump to a different place. Instead, the depth control saves its current position and recomputes the time there. The visible clock changes too; this is intentional, since the new sea floor has a different travel time.
- A half-metre crest beside a four-kilometre sea-floor scale would be invisible. The water surface and bathymetry therefore use separate vertical scales, explicitly labelled on the drawing. The depth schematic also has a fixed vertical offset: without it, exaggerated troughs would cross the shallow shelf on screen even though the actual water is 50 m deep.
- The marked point is the centre of the imposed packet, with phase zero. Across the slope, the spatial amplitude gradient can shift the actual nearby maximum slightly. The point follows a phase crest rather than searching each frame for the tallest pixel.
- There is no random sea texture. The pattern should be attributable to the selected depth, not decoration. Colour, contour lines, and one orange marker do the visual work.
- Checks use invariants that would catch unit mistakes: constant-depth travel must equal distance divided by speed, every local wavelength must recover the same 720-second period, and `a² c` must remain constant across the whole section.
- The video records the real controls and shows the public deployment address in a browser overlay labelled as a local recording. Narration uses the model attribution from this project's README.

## Reading that sparked it

[UNDRR's 2026 observance](https://tsunamiday.undrr.org/publication/documents-and-publications/world-tsunami-awareness-day-2026-concept-note), [NOAA's tsunami overview](https://www.noaa.gov/education/resource-collections/ocean-coasts/tsunamis), and the University of Washington's explanations of [shallow-water speed](https://earthweb.ess.washington.edu/tsunami/general/physics/characteristics.html) and [shoaling](https://earthweb.ess.washington.edu/tsunami/general/physics/transform.html).
