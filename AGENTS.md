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

- Vanilla: `open index.html` (or `python3 -m http.server` then visit the URL).
- FastAPI: `python3 -m uvicorn main:app --reload` then open `http://localhost:8000`.
- Framework: `pnpm install && pnpm dev`.

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

## File / delete policy

Inherited from the user-level `AGENTS.md`: **never use `rm` / `rm -rf`** — use
`trash` for anything that must go, and prefer not deleting at all (use
`mktemp -d` for throwaway work). See the user-level instructions for details.
