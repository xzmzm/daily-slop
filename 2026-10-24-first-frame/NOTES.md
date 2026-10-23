# First Frame — build notes

## Why this project?

October 24, 2026 is eighty years after the first photograph of Earth from space. A search for today's historical hooks led to [NASA's account of the 1946 White Sands camera flight](https://www.nasa.gov/history/90-years-of-our-changing-views-of-earth/). The existing playground already has orbital motion and telescope experiments; the missing interaction was photographic framing of a nearby planet. A tiny camera lets you separate two things that often get mixed together: climbing higher and widening a lens.

The photo wasn't recreated. Inventing a plausible monochrome surface kept this an offline toy and avoided presenting arbitrary clouds as historical evidence.

## How it works

Put a sphere of radius R = 6,371 km at the origin and a camera at (0, R+h, 0). For each pixel, create a pinhole-camera ray using the tangent of half the horizontal field of view. Rotate that ray downward by the horizon dip plus seven degrees. Solve the quadratic for intersection with the sphere; the nearest positive intersection is surface, and a miss is sky.

The dip follows from the tangent triangle: acos(R/(R+h)). The straight-line distance is sqrt(h(2R+h)). Those values don't depend on the lens. The orange guide goes through the projected centre of the limb, so it stays anchored while the horizon drops away toward the sides.

Surface x/z coordinates feed three octaves of smooth hashed value noise, with a threshold for pale clouds. Deterministic pixel grain, a dark vignette, and a faint atmospheric band suggest film without needing an image asset. An 800×360 buffer is enlarged into the export canvas; the render only runs when a setting changes.

## Interesting notes

An early sine-field cloud texture stretched into obvious stripes near the pole. Switching to smooth hashed noise in surface x/z coordinates removed the coordinate singularity and gave the film more convincing cloud patches.

The camera follows the horizon deliberately. A fixed pitch would let the limb leave the frame as altitude changed, turning a framing experiment into a hunt for the planet. Seven degrees below the limb keeps a useful amount of ground visible at the starting altitude.

The altitude slider is logarithmic. A linear 36,000 km range makes the difference between an airliner and the 1946 camera nearly impossible to select. Explicit presets preserve the historical 105 km setting exactly.

The high-altitude preset is labeled GEO HEIGHT rather than claiming an orbit over White Sands: geostationary orbits are equatorial. The toy also skips atmospheric refraction and real terrain, so the low-altitude numbers are ideal spherical geometry, not navigation advice.

The browser checks include rays just above and below the tangent, not just the displayed formula. They also drive the actual controls and export a real PNG. The video keeps the scene still while the narration describes it, and moves the cursor only before operating a control.
