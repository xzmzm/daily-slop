# Inbetween — build notes

## Why this project?

October 28, 2026 is International Animation Day. [ASIFA’s description](https://asifa.net/what-we-do/international-animation-day/) connects it to Émile Reynaud’s Théâtre Optique performance in Paris on October 28, 1892. That suggested making something about the decisions inside an animation rather than another historical machine.

The other candidate was a hanging-chain / inverted-arch experiment, prompted by the Gateway Arch’s October 28 completion date. After scanning the previous 96 projects, spacing felt more distinct: the repo has mechanical television, film continuity and a locomotive, but no little desk for authoring motion. The [NFB’s animation-principles article](https://blog.nfb.ca/blog/2015/03/20/12-principles-animation/) was useful inspiration for making positions between poses the actual thing you manipulate.

## How it works

The data is just thirteen normalized positions. Entry zero is 0, entry twelve is 1. Each entry has a fixed timestamp `i / 12` seconds. At each animation frame, an elapsed clock chooses the most recent sample; no smooth interpolation is added between drawings. This preserves the visible relationship between the drawn spacing and the movement.

The preset functions are `t`, `t²`, `1 − (1 − t)²`, and `(1 − cos(πt)) / 2`. A neighboring difference measures the distance covered in one equal time step. The chart puts time horizontally and distance vertically, so a steep segment really does mean a larger step. The stage projects those same values onto a horizontal track. There is no second set of hand-tuned animation values.

Editing clamps one position between its previous and next entries. This keeps the drawings in order without changing their timestamps. Coincident positions are allowed: they describe a held pose. The endpoints are locked. The violet reference always uses `i / 12`, so both balls share the exact same start, finish and clock.

There are twelve time intervals and thirteen endpoint-inclusive samples. Calling those “thirteen frames at twelve fps, lasting one second” without explaining the last endpoint would be misleading. The interface therefore says “12 equal time intervals · 13 poses including A & B.” The final pose arrives at one second and is held during the explicit loop pause.

## Interesting notes

- The first mobile check found a 320 px overflow: the transport controls were imposing a minimum width on the grid. Allowing the grid track to shrink and shortening the narrowest readout fixed it. The chart also gets a narrower coordinate system on phones so its labels and vertical editing area do not shrink to a sliver.
- An early slider handler re-rendered the selected drawing before reading the input value, which reset that value. Reading the new value first fixed it; the browser check now exercises an actual edit and a clamped edit.
- The ball faces give the comparison a little personality without squash, stretch or rotation. Adding those would make it harder to tell which change came from spacing alone.
- The recording uses a deterministic clock to advance the same discrete animation model. Actual buttons and actual chart dragging still perform the edits. This makes the film independent of how long an individual screenshot takes.
- Scope stayed with one-dimensional spacing. No timeline editor, image imports, export formats or extra animation principles were added.

## Verification

The model checks cover all four profiles, symmetry, step sizes, four hundred bounded edits, fixed endpoints, every sample timestamp and the loop boundary. Browser checks cover custom edits, endpoint locking, pointer dragging, keyboard adjustment, the onion skin, stepping, arrival at exactly one second, six viewport widths, reduced motion and offline loading without external requests.
