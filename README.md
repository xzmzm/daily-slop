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
| 2026-08-09 | [quarto](./2026-08-09-quarto/) — booklet imposition studio for National Book Lovers Day; a printed sheet's pages are not in reading order (the cover carries `[16,1]`), so see the real saddle-stitch layout, fold the outer sheet, flip the finished book, and read the closed-form math where every face sums to P+1 | Vanilla HTML/CSS/JS | GLM-5.2 |
| 2026-08-08 | [cattery](./2026-08-08-cattery/) — Mendelian cat-coat genetics sandbox for International Cat Day; breed two cats and each kitten's coat (tortoiseshell, tabby, dilute, calico, dominant-white) is rendered from its genes, with live Punnett squares showing why torties are almost always female | Vanilla HTML/CSS/JS | GLM-5.2 |
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
