# daily-slop

One small, original web app shipped per day. Each project lives in a
`YYYY-MM-DD-<name>/` folder and is self-contained.

**Live gallery:** [dailyslop.pages.dev](https://dailyslop.pages.dev/)

See [`AGENTS.md`](./AGENTS.md) for the full workflow / stack rules.

Released under the [MIT License](./LICENSE).

## Gallery

A visual showcase of every daily project, with screenshots, a click-to-play
viewer, and each project's `NOTES.md` / `README.md` behind an ⓘ button:

```
python3 -m http.server 8765        # from the repo root
```

then open <http://localhost:8765>. (Port 8000 is reserved on this machine —
use 8765 or any other free port.) The gallery is generated — after adding a
new daily project, rebuild it with:

```
python3 tools/build_gallery.py
```

This rescans the project folders, re-parses the docs, and re-captures
screenshots via headless Chrome (falls back to placeholders without Chrome).
Use `--no-shots` to skip the screenshot pass.
Use `--strict-shots` in CI when a missing screenshot should fail the build.

The GitHub Actions deploy rebuilds the manifest and screenshots with Chrome,
then generates the ignored `dist/` upload bundle before deploying it to
Cloudflare Pages.

## Index

| Date | Project | Stack | Built by |
| --- | --- | --- | --- |
| 2026-07-24 | [tiny-worlds](./2026-07-24-tiny-worlds/) — generative-art toy, seeded procedural landscapes | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-07-25 | [nodal-sand](./2026-07-25-nodal-sand/) — interactive Chladni plate; sand settles on standing-wave nodes | Vanilla HTML/CSS/JS | Grok 4.5 |
| 2026-07-26 | [shade-seeker](./2026-07-26-shade-seeker/) — heat-wave toy; real solar geometry casts city shadows, drag the picnicker to shade | Vanilla HTML/CSS/JS | Qwen3.8-Max-Preview |
| 2026-07-27 | [future-fossil](./2026-07-27-future-fossil/) — ordinary 2026 objects become confidently wrong museum labels from 2126 | Vanilla HTML/CSS/JS | GPT-5.6 Sol |
| 2026-07-28 | [morphogen](./2026-07-28-morphogen/) — interactive Gray–Scott reaction–diffusion petri dish; paint two chemicals and watch Turing patterns grow | Vanilla HTML/CSS/JS | Qwen3.8-Max-Preview |
| 2026-07-29 | [backrooms](./2026-07-29-backrooms/) — endless procedural liminal-space walker; raycast yellow rooms, flickering lights, a hum, doorways that only go down | Vanilla HTML/CSS/JS | Kimi K3 |
| 2026-07-30 | [orbit-chime](./2026-07-30-orbit-chime/) — orbital polyrhythm music box; planets on integer-ratio orbits chime pentatonic notes at the meridian | Vanilla HTML/CSS/JS | Qwen3.8-Max-Preview |
| 2026-07-31 | [perseid-vigil](./2026-07-31-perseid-vigil/) — night-by-night simulator of the 2026 Perseid shower; real radiant geometry, ZHR activity curve, moonlight washout | Vanilla HTML/CSS/JS | Qwen3.8-Max-Preview |
| 2026-08-01 | [eclipse-chaser](./2026-08-01-eclipse-chaser/) — the Aug 12 2026 total eclipse from anywhere; NASA path data, click the map for your totality duration, magnitude and a phase-by-phase sun animation | Vanilla HTML/CSS/JS | DeepSeek-V4-Flash |
| 2026-08-02 | [feynmans-menu](./2026-08-02-feynmans-menu/) — restaurant stopping game; explore unknown tables or return to your favorite, then compare every dinner with Feynman’s optimal threshold | Vanilla HTML/CSS/JS | GPT-5.6 Sol |
| 2026-08-03 | [heraldic-forge](./2026-08-03-heraldic-forge/) — procedural coat-of-arms generator with proper tincture rules, field divisions, charges, furs, crests, and blazon descriptions | Vanilla HTML/CSS/JS | GLM-5-Turbo |
| 2026-08-04 | [loom-drafter](./2026-08-04-loom-drafter/) — interactive weaving draft in real four-quadrant notation; set threading, tie-up and treadling, and the drawdown, float analysis and woven cloth all follow, with `.wif` export | Vanilla HTML/CSS/JS | Claude Opus 5 |
| 2026-08-05 | [black-cow](./2026-08-05-black-cow/) — root beer float physics toy for National Root Beer Float Day; pour root beer, drop a scoop, CO₂ nucleation builds the foam crown and displacement decides whether you get a black cow or a foamy lake | Vanilla HTML/CSS/JS | DeepSeek-V4-Flash |
| 2026-08-06 | [ballot-lab](./2026-08-06-ballot-lab/) — same ranked ballots counted six ways (plurality, runoff, IRV, Borda, Condorcet, approval); watch three different winners emerge from identical votes and edit any ballot live | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-07 | [nightmark](./2026-08-07-nightmark/) — lighthouse light-characteristic builder for National Lighthouse Day; compose any IALA flash signature (F/Fl/Oc/Iso/Q/Mo), watch the lamp flash over a night sea, then read the flashes back in quiz mode; eight real verified lighthouses incl. Minot's Ledge 1-4-3 "I-Love-You" light | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-08 | [cattery](./2026-08-08-cattery/) — Mendelian cat-coat genetics sandbox for International Cat Day; breed two cats and each kitten's coat (tortoiseshell, tabby, dilute, calico, dominant-white) is rendered from its genes, with live Punnett squares showing why torties are almost always female | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-09 | [quarto](./2026-08-09-quarto/) — booklet imposition studio for National Book Lovers Day; a printed sheet's pages are not in reading order (the cover carries `[16,1]`), so see the real saddle-stitch layout, fold the outer sheet, flip the finished book, and read the closed-form math where every face sums to P+1 | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-10 | [sky-sway](./2026-08-10-sky-sway/) — tuned-mass-damper studio for Skyscraper Appreciation Day; a skyscraper is a giant tuning fork, so toggle the 728-ton pendulum on and off, watch the sway explode, and read Den Hartog's 1928 optimal-tuning formulas (f = 1/(1+μ), ξ = √(3μ/[8(1+μ)³])) that split one tall resonance peak into two equal short ones | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-11 | [sand-ripple](./2026-08-11-sand-ripple/) — aeolian bed-instability studio for Play In The Sand Day; the wind doesn't sculpt ripples, the bed sculpts itself, so watch a noise-seeded sand sheet self-organize into migrating ripples, read the live linear growth-rate spectrum σ(k) = (CLk²)/(1+(kL)²) − Dk² that selects the wavelength, drop a pile and watch it become a ripple | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-12 | [lathe-cut](./2026-08-12-lathe-cut/) — analog disc-cutting studio for Vinyl Record Day; the groove *is* the waveform, so pick a timbre and a wiggles-per-revolution count, cut the spiral into a spinning lacquer, drop the needle anywhere to play it back, and read λ = 2π·r·(rpm/60)/f as the resolution ceiling collapses toward the label (the inner-groove problem), plus the RIAA curve (3180 / 318 / 75 µs) | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-13 | [chiral-lab](./2026-08-13-chiral-lab/) — handedness studio for International Left-Handers Day; a left hand is a right hand seen through a mirror and never the other way around — so pick a chiral object (hand, helix, propeller, tetrahedral molecule, snail shell), drag-rotate its mirror image and try to superimpose it (you can't), read the one-line proof (det reflection = −1, det rotation = +1, so reflection·rotation ≠ identity), toggle one allowed reflection and it snaps perfectly into place; the flat F is chiral in 2D but achiral in 3D (flip it) | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-14 | [tail-gambit](./2026-08-14-tail-gambit/) — autotomy field trial for World Lizard Day; trigger a lizard's pre-built tail fracture during a predator strike, time the moving decoy before it is too early or too late, watch a damped travelling motor wave continue without the brain, then scrub through the stored-energy, sprint-balance and cartilage-tube regrowth bill that comes afterward | Vanilla HTML/CSS/JS | GPT-5.6 Sol |
| 2026-08-15 | [waggle-room](./2026-08-15-waggle-room/) — waggle-dance studio for World Honey Bee Day; inside the dark hive "up" means "toward the sun", so drag the flowers, slide the sun, switch the hive's inherited distance-dialect (t ≈ a + b·d, ~1 s of waggling per km), watch the figure-eight collapse into a round dance when it's close — then the field goes dark and you decode the dance yourself as a follower bee | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-08-16 | [loop-the-loop](./2026-08-16-loop-the-loop/) — vertical-loop studio for National Roller Coaster Day (Prescott patented the loop on Aug 16, 1898); a rail can only push, so v² ≥ g·r at the crest and a frictionless circle demands release at exactly 2.5r above its lowest point — drag the release handle, dispatch at 2.5r for a weightless crest and a 6g entry, release short and watch the car leave the rail where N = m(v²/r − g) goes negative, rescue it with 1976-era upstop wheels, switch Prescott's circle for Stengel's clothoid teardrop and the peak g halves, and read the energy ledger where friction's line item is exactly μ·Δx (Coulomb friction bills horizontal metres only — the path's shape never enters) | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-08-17 | [jupiter-mail](./2026-08-17-jupiter-mail/) — balloon-navigation studio for Balloon Airmail Day (Aug 17, 1859: John Wise flew the first US airmail, 123 letters, and landed 26 miles short); a free balloon has no rudder so altitude is the steering wheel — the wind veers and freshens with height (an idealized Ekman spiral), so climb the wind ladder to the layer that points at your town, spend one-way hydrogen (valve down) and sandbags (climb) while the fabric leaks 0.05 kg/min, brake on Wise's own trail rope, land soft before the evening train, and the verdict scores the mail's whole journey — balloon leg plus an 1859-plausible rail estimate to New York | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-08-18 | [flash-spectrum](./2026-08-18-flash-spectrum/) — flash-spectroscopy studio for Helium Discovery Day (Aug 18, 1868: Janssen, at the Guntur eclipse, met a yellow line matching no element on Earth); the Moon is a coronagraph — scrub the totality clock and Kirchhoff's flip happens live, dark Fraunhofer absorption lines blaze into the chromosphere's emission lines, then measure the flash with the crosshair: hydrogen, sodium and magnesium announce themselves from the 1868 catalogue, but D₃ at 587.56 nm matches nothing — claim it and it's helium, discovered in the sky 27 years before Earth; the epilogue shows the 1869 green coronal line, the "coronium" trap that took until 1942 (Edlén's forbidden Fe XIV) to unmask, revealing a million-degree corona | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-08-19 | [daguerreotype](./2026-08-19-daguerreotype/) — 1839 Daguerreotype darkroom and optical physics studio for World Photography Day (Aug 19, 1839: France releases photography as a gift free to the world); polish the silver plate to optical mirror, fume nanoscale AgI thin-film to the steel-lavender sensitivity peak (~72 nm), expose the Boulevard du Temple in a sliding-box camera where time-integration vanishes moving carriages while the stationary bootblack burns into silver, develop mercury amalgam crystals (Ag₃Hg₄) at 65°C, and tilt the finished plate in 3D under room glare to watch specular reflection flip the positive image into a ghostly negative | Vanilla HTML/CSS/JS | Gemini 3.7 Flash |
| 2026-08-20 | [grand-tour](./2026-08-20-grand-tour/) — Voyager 2 Grand Tour orbital mechanics and gravity-assist slingshot studio for its 49th launch anniversary (Aug 20, 1977); Gary Flandro's 176-year planetary alignment let one probe visit Jupiter, Saturn, Uranus, and Neptune by stealing orbital momentum from each gas giant — track the 49-year trajectory past the heliopause (119.7 AU) to 138 AU, zoom into each encounter's hyperbolic turn ($\sin(\delta/2) = 1/(1+r_p v_\infty^2/\mu)$) and vector triangle ($\vec{v}_{helio} = \vec{v}_p + \vec{v}_\infty'$), see the velocity curve step above the Sun's escape threshold, and listen to the Golden Record's Bach synthesized in the radio beam | Vanilla HTML/CSS/JS | Gemini 3.7 Flash |
| 2026-08-21 | [burroughs-adder](./2026-08-21-burroughs-adder/) — 1888 Burroughs mechanical adding machine and listing studio for its patent anniversary (Aug 21, 1888: US Patent 388,116); explore the full 81-key matrix, differential stop racks, spring-loaded tens-carry ripple, and the hydraulic oil dashpot ($F_d \propto \mu v$) that cured momentum overthrow, plus reverse-mesh downstroke register zeroing for totals | Vanilla HTML/CSS/JS | Gemini 3.7 Flash |
| 2026-08-22 | [schooner-america](./2026-08-22-schooner-america/) — 1851 America's Cup aerodynamic sail physics, wave-line hull hydrodynamics, and polar velocity studio for the 175th anniversary of the historic Isle of Wight regatta (Aug 22, 1851) | Vanilla HTML/CSS/JS | Gemini 3.7 Flash |
| 2026-08-23 | [rubin-curve](./2026-08-23-rubin-curve/) — dark-matter rotation-curve studio for Vera Rubin's birthday (born Aug 23, 1928); measure M31 the way Rubin & Ford did in 1970 — long-slit spectrograph, Doppler-shifted Hα, v = c·Δλ/λ — then watch the curve refuse to fall where the starlight (Freeman's exact exponential-disk Bessel curve) says it must, toggle the halo off and see the rim slow while the data stays flat, and read the mass ledger: 74% of the galaxy inside 24 kpc is invisible | Vanilla HTML/CSS/JS | GLM-5.3 |
