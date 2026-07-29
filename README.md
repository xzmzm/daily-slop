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
python3 -m http.server        # from the repo root
```

then open <http://localhost:8000>. The gallery is generated — after adding a
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
