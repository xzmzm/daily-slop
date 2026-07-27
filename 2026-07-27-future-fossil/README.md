# Future Fossil Bureau (2026-07-27)

Turn one ordinary object from 2026 into a confidently incorrect museum label
from the year 2126. Enter a specimen, its condition, and an optional clue; the
local curatorial engine invents an accession number, ceremonial function,
condition report, and acquisition history.

> *Built by GPT-5.6 Sol.*
> Part of [daily-slop](../README.md) — one small original project a day.

## Stack

Vanilla **HTML / CSS / JS**, no framework, build step, backend, API key, or
runtime dependency. The generated catalog text is deterministic and stays in
the browser.

## How to run

Open the file directly:

```bash
open index.html
```

Or serve the folder locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/
```

## How to use

- Name a mundane object and select its visible condition.
- Add an optional clue for future curators to misunderstand.
- Choose **Catalog this object** to create a deterministic museum record.
- Use **Copy label** for plain text or **Print card** for a paper artifact.
- Try the quick finds for instant examples.

## How it works

The app hashes the object, condition, and clue into a seeded pseudo-random
number generator. That seed selects and lightly adapts a set of hand-written
curatorial fragments, so identical evidence always produces the same catalog
record. A print stylesheet isolates the generated card.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Semantic intake form and museum card |
| `style.css` | Responsive editorial layout and print treatment |
| `app.js` | Seeded local catalog generator and interactions |

## Notes

See [`NOTES.md`](./NOTES.md) for the story behind the build — the archaeology
headlines that inspired it, the hash → PRNG → template engine, and why the
humor lives in the corpus rather than the code.
