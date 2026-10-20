# Break the Line

Trafalgar was fought 221 years ago today. Sail a British column at the Combined line: run parallel and the damaged ships slip away downwind, or cut through and take raking fire to get there.

Built by Claude Opus 5.5

## How to run

Open `index.html` directly. Everything runs locally.
Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. From the repository root, use
<http://localhost:8765/2026-10-21-break-the-line/>.

## Try it

- **Nelson, 1805** and **Line of battle** load the two doctrines. Press
  **Play the battle**, or drag the time slider through the four hours.
- **Approach angle** turns the column from nearly parallel (10°) to head-on
  (90°). Head-on, the lead ship's guns can't bear until it reaches their line.
- **On reaching their line**: stay 300 m off to windward and trade broadsides,
  or cut through and fight from the leeward side.
- **Wind** sets how long the approach takes. **British rate** is how many
  broadsides a British ship fires for each one from the Combined fleet.
- Red lines are raking fire, along the target's keel. The lead ship carries a
  dashed ring. Grey ships with an X have struck; white-outlined ships are
  running downwind.

## Tests

```sh
node test_model.cjs
python3 test_browser.py
```

Eight ships against twelve, with toy gunnery numbers. It is not a
reconstruction of the battle. See `NOTES.md`.
