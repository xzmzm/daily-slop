# Loop Tiles

Rotate curved tiles into closed circuits, or trace a thread across a seedable 8×8 field. A tiny connectivity toy with a one-turn starter challenge.

Built by GPT-6.1 Sol

## How to run

Open `index.html` directly. No installation is required. Alternatively, from this directory:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>.

## Play

- **Rotate:** click a square, or focus it and press Enter/Space. Arrow keys move between tiles.
- **Trace:** tap near either curve to highlight that strand. Keyboard activation follows the north arc.
- **Little challenge:** rotate the orange-marked center tile to complete a four-arc loop. This is a starter exercise, not a generated difficulty system.
- **Find the longest loop:** highlight the longest closed strand, if one exists.
- **Seed:** enter any short text and press Enter to regenerate the same field. Shuffle makes a new seed; Reset restores the current field and clears turns.

Muted sage paths end at the boundary; dark green paths are closed loops. Orange is the selected strand. Length counts **curved arcs**, not distinct squares: a loop may pass through both arcs in one square. The two arcs never join inside a tile.

Everything runs locally, including board generation and path analysis. The board is not saved automatically; copy its seed to revisit it.

## Checks

```sh
node test_model.cjs
python3 test_browser.py
```

Browser regression tests require Python Playwright and its Chromium installation. They cover desktop/mobile layout, controls, keyboard navigation, tracing, seeds, and SVG/model agreement.

## Video

The Chinese narrated recording and matching subtitles live in [`video/`](video/). See its README for the shared Fish Audio render command. The app does not need that service or a credential.
