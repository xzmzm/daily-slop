# Line Break — build notes, September 8, 2026

## Why this project?

September 8 is [UNESCO’s International Literacy Day](https://www.unesco.org/en/days/literacy). That suggested a project about the physical experience of reading. The gallery already has a booklet-imposition tool, but nothing about choosing the breaks inside a paragraph. A railroad anniversary was another candidate; typography offered a smaller, more immediately editable experiment after several historical physics studios.

This does not simulate literacy difficulties or claim to improve literacy. The date is the spark for looking closely at text. All sample prose was written for this app.

## How it works

Canvas measures each word in the same 20px Georgia used by the output. Prefix sums make the width of any consecutive run of words cheap to calculate, with a measured space between words. The greedy algorithm takes the longest fitting run and repeats.

The optimizer works backward. At word i, try each fitting end j and add the current line’s squared leftover width to the cheapest known cost of the suffix starting at j. Store the best end and reconstruct the chosen lines from word zero. The final line has zero cost. An oversized word is permitted alone so every input can be laid out; its signed overflow is squared on non-final lines. Both algorithms use exactly the same cost rule.

Worst-case time is quadratic in word count; prefix sums, costs, and backpointers use linear space. Input is capped at 1,600 characters to keep live editing small. Rendering uses textContent, so pasted markup stays text.

The paragraph-wide idea is inspired by [Knuth and Plass, “Breaking paragraphs into lines” (1981)](https://onlinelibrary.wiley.com/doi/10.1002/spe.4380111102). This is a minimum-raggedness dynamic program, not a full implementation of their algorithm: no stretchable glue, penalties, fitness classes, hyphenation, or justification.

## Interesting notes

- The last line must be exempt. Otherwise the objective pressures a short, perfectly ordinary final line to look like a defect.
- A narrow column is not guaranteed to show a difference; greedy can already be optimal. The interface explicitly reports ties instead of claiming an improvement every time.
- Hatching shows real remaining space rather than a separate decorative chart. The faded final tail makes its exemption visible.
- Mobile preserves the requested typographic width in a horizontally scrollable sheet, while the surrounding layout stacks. Silently shrinking the text would make the width control dishonest.
- The tests use exhaustive legal-break enumeration as an independent oracle. The fixed example [3, 2, 2, 5], space 1, width 6 scores 16 greedily and 10 optimally.
- Video uses the existing cattery Fish renderer through a small project-module extension, preserving its voice settings and default command. Static frames with unchanged captions are hard-linked to avoid taking hundreds of identical screenshots.
- The spoken opening follows the repository’s GLM 五点二 house narration rule. The app, gallery attribution, and narration’s project credit identify the actual builder as GPT-6 Astra.
