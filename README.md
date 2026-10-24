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

If GitHub Actions minutes are unavailable, build and publish from a local
machine with Chrome and an authenticated Wrangler installation:

```sh
python3 tools/build_gallery.py --strict-shots
python3 tools/build_dist.py
wrangler whoami
wrangler pages deploy dist --project-name=dailyslop --branch=main --commit-hash="$(git rev-parse HEAD)"
```

Use a fresh `dist/` for the upload; if it already exists, move it with
`trash dist` before rebuilding. Complete and clean up video captures first,
so temporary frames do not enter the upload bundle. The MP4 and SRT live in
Git; the Pages bundle contains the interactive apps and gallery.

## Index

The project list is split into one file per month, newest first.

| Month | Projects |
| --- | --- |
| [October 2026](./index/2026-10.md) | 25 |
| [September 2026](./index/2026-09.md) | 30 |
| [August 2026](./index/2026-08.md) | 31 |
| [July 2026](./index/2026-07.md) | 8 |
