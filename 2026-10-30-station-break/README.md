# Station Break

War of the Worlds aired 88 years ago tonight. Listeners who switched over from NBC at 8:12 missed the opening disclaimer. Place station-break announcements and see who still comes to believe the fake newscast.

Built by Claude Opus 5.5

## How to run

Open `index.html` directly. Everything runs locally.
Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. From the repository root, use
<http://localhost:8765/2026-10-30-station-break/>.

## Try it

- Each thin line is one of 480 simulated listeners, sorted by when they tuned
  in. Amber: listening, not yet sure. Red: has heard enough bulletins to
  believe it. Green: heard an announcement that it is a play.
- **As aired, 1938** has only the real announcements: 8:00, the 8:40 station
  break, and Welles's goodnight.
- Click the **fake live newscast** strip to add up to three announcements.
  Drag a marker to move it; click it to remove it.
- **Best spot for N** searches every half-minute slot for the placement that
  leaves the fewest believers.
- **Bulletins it takes to believe** is how many minutes of unwarned newscast
  turn a listener into a believer.
- **Play the hour** runs 8:00 to 9:00 in 30 seconds, with a paraphrase of what
  was on the air.

## Tests

```sh
node test_model.cjs
python3 test_browser.py
```

The browser test needs Python Playwright with Chromium.
