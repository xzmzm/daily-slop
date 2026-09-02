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
| 2026-08-01 | [eclipse-chaser](./2026-08-01-eclipse-chaser/) — the Aug 12 2026 total eclipse from anywhere; NASA path data, click the map for your totality duration and sun phases | Vanilla HTML/CSS/JS | DeepSeek-V4-Flash |
| 2026-08-02 | [feynmans-menu](./2026-08-02-feynmans-menu/) — restaurant stopping game; explore unknown tables or return to your favorite, then compare with Feynman's optimal threshold | Vanilla HTML/CSS/JS | GPT-5.6 Sol |
| 2026-08-03 | [heraldic-forge](./2026-08-03-heraldic-forge/) — procedural coat-of-arms generator with proper tincture rules, field divisions, charges, and blazons | Vanilla HTML/CSS/JS | GLM-5-Turbo |
| 2026-08-04 | [loom-drafter](./2026-08-04-loom-drafter/) — weaving draft in real four-quadrant notation; threading, tie-up and treadling drive the drawdown and cloth, with `.wif` export | Vanilla HTML/CSS/JS | Claude Opus 5 |
| 2026-08-05 | [black-cow](./2026-08-05-black-cow/) — root beer float physics toy; pour, drop a scoop, and foam plus displacement decides black cow or foamy lake | Vanilla HTML/CSS/JS | DeepSeek-V4-Flash |
| 2026-08-06 | [ballot-lab](./2026-08-06-ballot-lab/) — same ranked ballots counted six ways (plurality, IRV, Borda, Condorcet…); different winners from identical votes, editable live | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-07 | [nightmark](./2026-08-07-nightmark/) — lighthouse flash-characteristic builder; compose IALA signatures, watch them over a night sea, read them back in quiz mode | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-08 | [cattery](./2026-08-08-cattery/) — Mendelian cat-coat genetics sandbox; breed two cats and watch each kitten's coat fall out of live Punnett squares | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-09 | [quarto](./2026-08-09-quarto/) — booklet imposition studio; fold a saddle-stitch sheet whose pages aren't in reading order — every face sums to P+1 | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-10 | [sky-sway](./2026-08-10-sky-sway/) — tuned-mass-damper studio; toggle the 728-ton pendulum and watch the skyscraper's sway split into two tamer peaks | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-11 | [sand-ripple](./2026-08-11-sand-ripple/) — aeolian ripple studio; watch a sand bed self-organize into migrating ripples — the bed sculpts itself, not the wind | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-12 | [lathe-cut](./2026-08-12-lathe-cut/) — disc-cutting studio; the groove is the waveform — cut a lacquer, drop the needle anywhere, meet the inner-groove problem | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-13 | [chiral-lab](./2026-08-13-chiral-lab/) — chirality studio; drag-rotate a mirror image and try to superimpose it — you can't, and the determinant proves why | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-14 | [tail-gambit](./2026-08-14-tail-gambit/) — lizard autotomy trial; time the tail-drop against a predator strike, then scrub the energy and regrowth aftermath | Vanilla HTML/CSS/JS | GPT-5.6 Sol |
| 2026-08-15 | [waggle-room](./2026-08-15-waggle-room/) — waggle-dance studio; drag flowers and sun, watch the figure-eight collapse to a round dance, then decode it in the dark | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-08-16 | [loop-the-loop](./2026-08-16-loop-the-loop/) — roller-coaster loop studio; a rail can only push, so release short and the car leaves the track — circle vs clothoid | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-08-17 | [jupiter-mail](./2026-08-17-jupiter-mail/) — 1859 balloon-airmail navigator; altitude is the steering wheel — climb the wind ladder toward town before the gas runs out | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-08-18 | [flash-spectrum](./2026-08-18-flash-spectrum/) — eclipse flash-spectrum studio; watch Fraunhofer lines blaze into emission and catch D₃ — helium, found in the sky first | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-08-19 | [daguerreotype](./2026-08-19-daguerreotype/) — 1839 daguerreotype darkroom; polish, fume, expose the Boulevard du Temple, then tilt the plate and watch the image flip | Vanilla HTML/CSS/JS | Gemini 3.7 Flash |
| 2026-08-20 | [grand-tour](./2026-08-20-grand-tour/) — Voyager 2 gravity-assist studio; steal momentum from four planets on the 176-year alignment and ride past the heliopause | Vanilla HTML/CSS/JS | Gemini 3.7 Flash |
| 2026-08-21 | [burroughs-adder](./2026-08-21-burroughs-adder/) — 1888 Burroughs adding machine; 81 keys, tens-carry racks, and the oil dashpot that cured momentum overthrow | Vanilla HTML/CSS/JS | Gemini 3.7 Flash |
| 2026-08-22 | [schooner-america](./2026-08-22-schooner-america/) — 1851 America's Cup studio; the sail aerodynamics and wave-line hull behind the schooner America's Isle of Wight win | Vanilla HTML/CSS/JS | Gemini 3.7 Flash |
| 2026-08-23 | [rubin-curve](./2026-08-23-rubin-curve/) — Vera Rubin's rotation curves; measure M31's Doppler shift and watch the flat curve demand invisible mass | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-08-24 | [plinian-hour](./2026-08-24-plinian-hour/) — Vesuvius 79 AD studio; push the Plinian column past collapse and replay the 19-hour timeline that buried Pompeii | Vanilla HTML/CSS/JS | Ox Alpha |
| 2026-08-25 | [galileos-tube](./2026-08-25-galileos-tube/) — Galileo's telescope ray-traced; drag the eyepiece, split the focus, then sight the Medicean stars from the Campanile | Vanilla HTML/CSS/JS | Ox Alpha |
| 2026-08-26 | [lavoisiers-balance](./2026-08-26-lavoisiers-balance/) — Lavoisier's conservation of mass; four classic experiments where the sealed vessel never loses a gram | Vanilla HTML/CSS/JS | Ox Alpha |
| 2026-08-27 | [drake-well](./2026-08-27-drake-well/) — Drake Well drilling studio; drop the bit, strike oil at 69½ ft, and follow the 1859 boom to 49¢ a barrel | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-08-28 | [weaf-660](./2026-08-28-weaf-660/) — AM radio studio on WEAF's first paid commercial (1922); modulate, detect, tune the tank, and mind the clipping | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-08-29 | [faradays-ring](./2026-08-29-faradays-ring/) — Faraday's iron ring (1831); the meter sleeps while current merely flows and kicks at every change — the first transformer | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-08-30 | [rutherfords-foil](./2026-08-30-rutherfords-foil/) — Rutherford scattering; hyperbolic α tracks and the 1-in-8000 backscatter that emptied the atom into a tiny nucleus | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-08-31 | [montessori-shelf](./2026-08-31-montessori-shelf/) — Montessori math materials; golden-bead bank exchanges, the pink tower's cubic identity, and the binomial cube in wood | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-09-01 | [carrington-storm](./2026-09-01-carrington-storm/) — Carrington Event studio; light beats plasma by 17 hours, the magnetopause bows, and the telegraph runs on aurora alone | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-09-02 | [eleven-days](./2026-09-02-eleven-days/) — the eleven days Britain skipped in 1752; dual calendars, Conway's doomsday, and the Easter computus behind the reform | Vanilla HTML/CSS/JS | GLM-5.3 |
| 2026-09-03 | [bluebird-301](./2026-09-03-bluebird-301/) — Campbell's 301 mph Blue Bird run; the cube law of speed, Cardano's exact terminal speed, and the two-run wind rule | Vanilla HTML/CSS/JS | GLM-5.3 |
