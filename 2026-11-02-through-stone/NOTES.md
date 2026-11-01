# Through Stone — notes

## Why this project?

On November 2, 2017, the ScanPyramids team published its report of a large void above the Great Pyramid's Grand Gallery. The [original research paper](https://arxiv.org/abs/1711.01576) describes a feature at least 30 metres long, initially seen with nuclear emulsion films in the Queen's Chamber and then checked with two other detection technologies and independent analyses. Its purpose was unknown. The point that stuck with me was that the instrument is not shining a beam into the pyramid: it waits for particles produced by cosmic rays to come down through it.

Earlier daily projects have dealt with space, scattering and optics, but none has explored muon radiography. A directional count compared with a solid-stone expectation makes the central clue tangible without presenting a speculative room as an archaeological reconstruction.

## How it works

The detector is a point inside a triangular cross-section. For each of 17 angles from −48° to +48°, the program traces a unit-length ray upwards to the triangle's edge. A ray/rectangle intersection finds the length of that same path through the invented cavity; subtracting this from the full path gives the modeled stone thickness. For either the solid comparison or the cavity case, the survival probability is `exp(-0.0052 × stone length)` in drawing units. This simple attenuation law gives the right qualitative behavior, not a calibrated muon spectrum.

Each direction receives 90 simulated incoming particles per day, each accepted or rejected with that probability. A seeded pseudorandom stream per direction is replayed as the exposure changes, so 90 days contains the same first 30 days rather than an unrelated reroll. The bar is the simulated count; the short line is the *expected* solid-stone count, rounded only for display. Because the solid line is an expectation rather than another sampled dataset, some solid-looking directions are above and some below it by chance. Rays through the gap tend to show an excess that is easier to distinguish from noise over a longer exposure.

## Interesting notes

- The drawn space is a rectangle in a 2-D section, and its position, size, detector placement, sky flux and attenuation constant are invented. It is not a plan, a photograph, or an estimate of the actual Big Void's shape.
- The drawing uses equal incident flux per direction and no scattering, energy spectrum, detector response or angular dependence. Real muon analyses take these and the site's actual geometry into account.
- The long rays are back-projections from a detector; the particle direction is downward from the sky. Selecting a bar changes the highlighted line, and the cavity reveal changes only visibility, not the simulated measurement.
- A single directional peak does not locate a void uniquely in depth. The real collaboration combined observations and independent methods; this toy illustrates the count excess, not a full 3-D reconstruction.
