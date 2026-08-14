# daily-slop — workspace instructions

This workspace is a **daily-build playground**: one small, original web app shipped per day.

## The cadence

- **One project per day**, in its own folder named `YYYY-MM-DD-<kebab-name>`
  (e.g. `2026-07-24-tiny-worlds`).
- **Scope: ~1 hour of work.** Small, focused, single-feature. No scope creep.
- **Self-contained:** every project must run locally with zero paid / external
  API keys. All data and procedural generation stays local.
- **Keep it tidy:** each project lives in its own folder with its own
  `README.md` describing what it is and how to run it, plus a `NOTES.md`
  with the story behind it (see "Per-project docs" below). The top-level
  `README.md` is an index linking to every day's project.

## Originality (the only hard rule that matters)

- **Every day must be different** — different *concept*, not just a different
  name. A to-do app on Monday and a "kanban app" on Tuesday is a fail.
- Before building, **scan the existing `YYYY-MM-DD-*` folders** to see what's
  already been done and pick something genuinely new.
- **Search the web first** for ideas — news, trends, what's hot, what's fun,
  weird niche utilities. Use whatever's in the air that day as raw material.
- Inspiration is encouraged; plagiarism of existing products is not.

## Stack policy

| Situation | Use |
| --- | --- |
| Frontend **framework** (React / Vue / Svelte / Next / Vite / Solid / …) | **`pnpm`** as the package manager. Never `npm`/`yarn` for a framework project. |
| **No framework** (the default for small/visual projects) | **Vanilla HTML / CSS / JS**, no build step, no `package.json`. |
| **Backend** (optional) | **Python + [FastAPI](https://fastapi.tiangolo.com/)** served by **`uvicorn`**. |

Rules of thumb:
- Prefer the **simplest stack that fits the idea**. A generative-art toy does
  not need React; a data dashboard probably does.
- If a project genuinely needs no backend (pure client-side), don't add one
  just for form. "Optional backend" means *optional*.
- Keep dependencies minimal — the fewer things to install, the more likely a
  months-old daily build still runs.

## Per-project structure (guideline, not law)

```
YYYY-MM-DD-<name>/
├── README.md          # what it is + how to run
├── NOTES.md           # why / how / interesting notes (see below)
├── index.html         # or framework entrypoint
├── (style / app code)
└── main.py            # only if there's a FastAPI backend
```

## Per-project docs

Each project ships **two** markdown files:

### `README.md` — the user-facing card

Short and practical: what it is, and a **"How to run"** section. Examples:

- Vanilla: `open index.html` (or `python3 -m http.server 8765` then visit the URL).
- FastAPI: `python3 -m uvicorn main:app --reload --port 8765` then open `http://localhost:8765`.
- Framework: `pnpm install && pnpm dev`.

> **Port policy (from the user-level `AGENTS.md`):** never bind anything to
> port **8000** — it's reserved. Use `8765` (or any other free port) for all
> local servers, and write that port into the project READMEs.

### `NOTES.md` — the story behind the build

The interesting part. Written the same day, while it's fresh. Suggested
sections (adapt freely, but cover the spirit of each):

- **Why this project?** — where the idea came from: the news item, trend,
  itch, or accident that sparked it, and why it beat the other candidates.
- **How it works** — the core mechanism/algorithm in plain language: the
  math, the data structure, the trick that makes it tick. Enough that a
  reader could re-implement it.
- **Interesting notes** — anything worth remembering: dead ends and rewrites,
  surprising behavior, tuning constants that mattered, things learned,
  ideas deliberately left out of scope.

Keep it honest and specific — "the shadow math was wrong for 20 minutes
because I mixed up azimuth conventions" is exactly the kind of note that
belongs here. A `NOTES.md` that could describe any project is a fail.

## Model attribution

When you know **which model** built a project (i.e. you know your own model
identity), record it:

- **Top-level `README.md` index:** add a **`Built by`** column naming the model
  (e.g. `GLM-5.2`).
- **Per-project `README.md`:** add a short `Built by <model>` line near the top.

Keep the name short and consistent across days (`GLM-5.2`, not the full
internal id like `builtin:zai-coding-plan/GLM-5.2`). If the model identity is
genuinely unknown, omit it rather than guess — the column/line is optional, not
mandatory.

**The model name only — nothing else on that line.** Never append the occasion,
date, or any commentary to a `Built by` value (not
`Built by GLM-5.3 · World Honey Bee Day (…)` — just `Built by GLM-5.3`).
The gallery renders this string verbatim in every card's footer next to the
stack, so extra text shows up on the card. Put the occasion/reason in the
tagline or the index description instead. `tools/build_gallery.py` trims the
value at the first `·` / `—` / `(` separator and prints a warning, but fix the
README when that warning appears.

## Daily workflow (for the agent)

1. **Note today's date.**
2. **Look at what already exists** (`ls -d YYYY-MM-DD-*`) — avoid repeats.
3. **Scout ideas** — web search for news/trends/fun, or pick a personal itch.
4. **Pick one concept** that's doable in ~1 hour and unlike prior days.
5. **Build it** following the stack policy above.
6. **Make sure it runs** — actually verify it, don't assume.
7. **Write the docs** — `README.md` (what + how to run) and `NOTES.md`
   (why / how it works / interesting notes), same day.
8. **Add it to the top-level `README.md` index.**
9. **Rebuild the gallery** — `python3 tools/build_gallery.py`. This regenerates
   `gallery/manifest.js` and the screenshots in `gallery/shots/` from the
   project folders; the root `index.html` showcase and `view.html` notes
   viewer need no manual edits.

## Daily project video workflow

When the user asks to create a video for today's project, use the Fish Audio
rendering workflow already established for `2026-08-08-cattery`:

- Read `FISH_AUDIO_API_KEY` from the workspace-root `.env` (ignored by Git),
  with an existing shell environment variable taking precedence. Never copy
  the key into source code, docs, metadata, logs, or chat output.
- Use Fish Audio model `s2.1-pro-free` with the user's 哈基米 voice reference
  ID, as configured in `2026-08-08-cattery/video/render_fish_video.py`.
- Render with `python3 2026-08-08-cattery/video/render_fish_video.py`. The
  output should be 1920×1080 with Chinese narration, burned-in subtitles, a
  matching `.srt`, and the deploy URL shown in the browser chrome.
- Keep the narration natural and lightly humorous. Start with
  “大家好，我是 GLM 五点二，来交 AI 每日作业了。” Use the day's date and
  the real reason for the project, but do not add artificial AI-style drama.
  Do not say the project has no API, and do not add implementation-stack
  explanations such as “原生 HTML、CSS 和 JavaScript”. Say “GLM 五点二”, not
  “GLM 负五点二”.
- The visible cursor is a small overlay for the headless recording. Keep it
  parked during narration and scrolling; move it only shortly before a real
  click (for example `mate`, opening the mother picker, and closing it). Use
  eased, slightly curved movement with a short settle pause—never a long
  linear drift across the screen. Keep the mother picker open long enough to
  show its choices (about 1.8 seconds in the current video).
- After rendering, run `ffprobe`, a full `ffmpeg -f null -` decode check, the
  project's tests, `git diff --check`, and a secret scan. Move temporary
  `cattery-*video-build-*` directories to macOS Trash after verification.

The reusable renderer and current video notes live in
`2026-08-08-cattery/video/README.md`; update that README when this workflow
changes.

## File / delete policy

Inherited from the user-level `AGENTS.md`: **never use `rm` / `rm -rf`** — use
`trash` for anything that must go, and prefer not deleting at all (use
`mktemp -d` for throwaway work). See the user-level instructions for details.
