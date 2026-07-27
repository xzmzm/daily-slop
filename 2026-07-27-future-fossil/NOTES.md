# Future Fossil Bureau — build notes

*2026-07-27 · Built by GPT-5.6 Sol*

## Why this project?

By day four the workspace had three **visual science simulations** in a row
(seeded landscapes, a Chladni plate, solar shadows). The originality rule
demanded a genuinely different *concept*, so this one swings hard the other way:
a **text-based creative toy** with no canvas at all.

The idea came from a cluster of July 2026 archaeology headlines that all shared
one theme — *evidence survives, context disappears, and curators can be
extremely confident while being wrong*:

- A 2,400-year-old bronze chariot in Spain, read as a "ritual incense platform,"
  from a society that burned and abandoned its own buildings.
- The "Upton Lovell Shaman," assumed male for ~200 years, shown by DNA to be a
  woman — the clearest spark for the joke.
- A 1,200-year-old Maya astronomical formula decoded from damaged wall writing.
- Ancient DNA rewriting how two Medici brothers died.

The core gag: **what would historians in 2126 think a wireless earbud was
for?** You type one ordinary 2026 object and the app prints a dead-serious
museum catalog card from a century later — confident, wrong, and slightly sad.

## How it works

All the logic is in [`app.js`](./app.js); the museum-label styling does the rest.

1. **Deterministic by design.** The object name, a condition dropdown, and an
   optional "field note" clue are concatenated and run through an **FNV-1a hash**
   (`hashString`), which seeds a **mulberry32** PRNG (`makeRandom`). Same inputs →
   same card, every time. No `Math.random()` in the output path, no API, no
   backend.
2. **Template assembly.** Curated arrays — future title words, probable-use
   theories, curator notes, acquisition stories, condition copy — are sampled by
   the seeded RNG. The accession number `FFB.2126.0727.NNN` is just another draw.
3. **A touch of keyword awareness.** `makeTitle` scans the object for stems
   (`phone|ear|head` → `AURICULAR`, `cup|bottle` → `HYDRATION`, etc.) and splices
   the matching trait into the title, so "earbuds" reliably reads more
   plausibly-wrong than a pure random label would.
4. **Extras:** copy-to-clipboard flattens the card to plain text, print uses the
   browser's own dialog, and example buttons pre-fill objects.

## Interesting notes

- **The humor lives entirely in the corpus, not the logic.** The engine is a
  dead-simple hash → PRNG → template picker. All the comedy is in the hand-written
  strings ("negotiate with invisible subscription spirits," "curatorial tasting
  strictly prohibited," "found with seventeen charging leads of incompatible
  ritual standard"). Good template toys are a *writing* exercise wearing a
  *code* costume.
- **Determinism is a feature here.** Because the same object always yields the
  same card, a shared object name is effectively a shareable artifact — and it
  makes the toy feel authored rather than slot-machine random.
- **Keyword traits keep it from feeling generic.** Pure random templating
  produces cards that ignore what you typed; the small regex-driven trait
  injection is what makes each result feel *about your object*.
- **A publishing detour.** The building agent's default workflow pushed the app
  to a private hosted Sites URL, which prompted a fair "what are you doing,
  publish where?" — the canonical copy is, and always was, this local folder
  (see [`.openai/hosting.json`](./.openai/hosting.json)). Worth remembering that
  the daily-slop source of truth is the git repo, not any deployment.
- **Deliberately no backend, no fonts, no deps.** Everything is local and offline
  so the card renders identically months from now.
