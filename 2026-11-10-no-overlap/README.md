# No Overlap

On 10 November 1983 Microsoft announced Windows at the Plaza Hotel, and its windows could not overlap — the desktop tiled itself, and it still does here. Drag the sashes, swap the current window, zoom, then break the rule with 1987's overlap.

Built by GLM-5.3 Flash

## How to run

Open `index.html` directly in a browser. Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. Everything runs on your own device.

## Try it

- **Title bars** — click one to make that window current: it takes the big top-left tile and the desktop re-tiles around it. In 1987 mode a click raises the window instead.
- **Sashes** — drag the seams between zones. The left column, the right column's rows and the bottom row's columns resize independently; dragging the main column sash keeps the bottom row's proportions.
- **The box on a title bar** iconifies the window into the bottom icon strip; clicking an icon brings it back as the current window.
- **The arrows on a title bar** zoom: the current window takes the whole desktop and everyone else waits at the icons.
- **1.0 · 1983 — tile / 2.0 · 1987 — overlap** flips the rules. 1987 lets windows float and overlap — drag one onto another and the overlapping-pairs readout counts the transgression in red. Back to 1983 and every window snaps into its own tile: zero overlaps, always.

The five apps — MS-DOS Executive, Clock, Notepad, Calculator, Calendar — all shipped with Windows 1.0. The calculator works; the calendar is pinned to November 1983 with the announcement day boxed; the MS-DOS Executive's `WIN COM` entry has nothing to run yet, because Windows shipped two years late.

## Tests

From the repository root:

```sh
node 2026-11-10-no-overlap/test_model.cjs
python3 2026-11-10-no-overlap/test_browser.py   # Python Playwright with Chromium
```
