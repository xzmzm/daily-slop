# Loop Tiles — November 13, 2026

## Why this project?

The last few builds explored comet landings, acoustic ranging, electrical protection, and X-rays. Today needed something smaller and more hands-on: a field of curves whose rules fit in one sentence, but whose connections are hard to predict by eye.

Web scouting led to [Truchet tiles](https://en.wikipedia.org/wiki/Truchet_tiles), specifically the square containing two quarter-circle arcs. Truchet's 1704 work used divided triangles; the curved variant came later. This build uses that established geometric motif, not a claim to have invented it. There is no November 13 anniversary story attached. The daily idea is the interaction: turn a square, then follow the consequences across the field.

The repository already has a loom drafter and a desktop tiling toy. This is neither cloth nor window layout: the subject is connectivity. I kept it to an 8×8 board, two modes, and a small starter exercise rather than expanding it into a puzzle campaign.

## How it works

Number each tile's edges north, east, south, west. Orientation zero pairs north with east and south with west; orientation one pairs north with west and south with east. Rotating 90 degrees toggles that bit. Rotating 180 degrees returns to the same visible motif.

Each curved arc becomes one graph node. Its two ends connect to the matching edge of a neighboring tile, or terminate at the outer boundary. Traversing all nodes partitions the board into components. Every internal arc has degree two, so components cannot branch. A component with no boundary ends is a closed loop; an open component has exactly two boundary ends.

There are always 128 arcs in the board, even when a turn merges two components or splits one. Loop length counts arcs rather than unique tiles. This matters because a single component can use both curves in one tile without crossing or joining there.

Seed text is hashed into a deterministic 32-bit generator; its output picks each orientation. It is for reproducibility, not cryptography. Shuffle obtains a fresh short seed from the browser's random source. The starter challenge uses the same fixed seeded background with the four center orientations arranged one rotation away from a four-arc circuit. It is deliberately not a solver or procedural challenge generator.

In Trace mode, a pointer click is compared with the radius-50 circles around the two appropriate tile corners. The nearer curve chooses the component. Keyboard activation consistently chooses the north arc. Graph analysis is recomputed after each turn; 128 nodes are small enough that incremental bookkeeping would add complexity without benefit.

## Interesting notes

- The first SVG sweep flags joined the correct endpoints but bent around the wrong corners. The field looked like pinched diamonds instead of smooth little loops. Reversing the flags fixed the drawing; the graph itself did not need to change. The browser suite checks sampled SVG geometry against the corner-radius construction.
- A tile can contain an open thread and a closed loop at the same time. Color belongs to an arc, never to the whole tile.
- The model suite checks exhaustive small boards and compares seeded boards with an independent edge-graph oracle, rather than checking only a few expected counters.
- Green loops are visible before any interaction; selecting a strand adds orange without turning the entire board into a rainbow. The paper-and-sage palette is deliberately quiet.
- No timer, win streak, persistence, score optimization, or sound. Turning and tracing is the whole toy.
- The Chinese video uses the existing shared Fish renderer. Screenshots are held between actual UI changes, and identical video frames are hard-linked in the temporary build directory. The public address shown in the recording is an intended deployment URL, explicitly marked as a local recording—not a deployment check.

## Sources

- [Truchet tiles — geometry and historical overview](https://en.wikipedia.org/wiki/Truchet_tiles). Read November 13, 2026. The component analysis, UI, tests, and challenge are implemented locally for this build.
