# Ink Register — September 23, 2026

## Why this project?

Today's search went in two directions: September equinox stories, and Nintendo's beginnings as a playing-card maker. The repository already has a long run of astronomy and physics experiments, plus a darkroom and an ASCII image printer. Another sky simulation or image filter felt too close. The playing cards suggested a smaller, hands-on question: what happens when two separately printed colors meet slightly out of register?

[Nintendo's own history](https://www.nintendo.co.jp/corporate/en/history/index.html) dates Fusajiro Yamauchi's hanafuda production in Kyoto to 1889. That source gives the year, so the app and narration do not invent an exact founding-day claim. The [V&A's printmaking overview](https://www.vam.ac.uk/articles/what-is-print) supplied the wider woodblock-print context; [RISO's creative-printing page](https://www.riso.co.uk/print-solutions/risograph-creative/) supplied the modern ink-and-paper connection. This is an original contemporary two-ink toy, not a reconstruction of hanafuda production or any particular press.

The result is a little workshop for deliberately imperfect prints. Three original compositions give the same ink movement different consequences: a sun crossing an arch, a flower slipping off its stem, and a disc interrupted by waves. There are no imported artworks or product layouts.

## How it works

The artwork occupies a 900 × 1100 drawing space representing a 180 × 220 mm sheet. A millimeter therefore moves a plate by five drawing units. Each ink has a separate transparent canvas. Plate A stays fixed; B translates and rotates around the center of the sheet. Registration crosses belong to the plates, so their separation reveals the same transform as the artwork.

Both canvases are multiplied onto warm paper. For each RGB channel the fully covered result is `paper × inkA × inkB / 255²`; transparent edges also use normal alpha compositing. The three preview swatches use the same calculation. This makes the overlap predictable, but it is not a spectral pigment model or a color-managed production proof. Ink order is commutative in this simplified model.

Grain is seeded, with separate seeds for the paper and both plates. Thousands of small, partly transparent holes are punched from each ink canvas. Because the seed is fixed, dragging moves the existing texture instead of creating distracting new noise each frame. The plate canvases are rebuilt only when their artwork, colors, or finishing options change.

Pointer positions are transformed back through the paper's one-degree presentation tilt before converting movement into millimeters. The same conversion works on a narrow phone and a large monitor. Native range inputs provide another way to make every edit; arrow keys move the plate by 0.2 mm, or 5 mm with Shift. PNG export redraws the same state at twice the drawing resolution.

## Interesting notes

- The decorative paper tilt initially makes an apparently horizontal drag subtly vertical. Inverting that rotation keeps the artwork attached to the pointer.
- The neutral title strip and edition label are deliberately outside the two art plates. The separate-ink views retain them; they are useful previews, not ready-to-expose stencil files.
- An apparent third ink costs nothing in the color model, but can become almost black with complementary colors. The warm/cool palettes were chosen to make that intersection legible rather than promising a particular press result.
- No physics simulator, photo importer, editable typography, or print queue: those would bury the small pleasure of moving one plate.
- The video retains the user's established GLM 五点二 series-host introduction and 哈基米 voice. The project's actual builder is recorded separately as GPT-6.

## Verification

The browser test checks an actual solid overlap pixel against the model, exports a PNG and reads its dimensions, drags with mouse and touch, uses keyboard nudges, tries all nine composition/palette combinations, checks layouts from 320 to 1920 pixels, and opens the app both over HTTP and as a local file. Mathematical tests cover color identities, rotation, physical scaling, input bounds, and repeatable grain seeds.
