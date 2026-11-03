# Early Returns

On election night in 1952 a UNIVAC called Eisenhower's landslide at 8:30 pm, with only a few percent counted. Scrub the night and compare the raw count with a swing projection.

Built by Claude Opus 5.5

## How to run

Open `index.html` directly in a browser. Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. Everything runs on your own device.

## Try it

- Drag the clock from 7 pm to 4 am Eastern, or press ▶.
- **Count so far** colours each state by who leads the votes counted. **Swing projection** colours it by where the 1948-to-1952 swing says it will end up. Dashed tiles are states with no returns, estimated from other states in their region.
- The teletype prints the projected electoral votes and the odds, the way UNIVAC's printout did.
- **1948 baseline → Typo** keys one New Jersey precinct's 1948 Republican vote in with an extra zero. Watch what it does to the 8:30 call.

At 8:30 pm the count has Stevenson ahead with 48.1 % of 5.6 % of the vote, while the swing projection already gives Eisenhower 100 to 1. The count doesn't put Eisenhower past 266 until 9:30.

Electoral votes are real; state vote shares are rounded two-party figures for 1948 and 1952. The precincts, reporting times, odds formula and typo are invented. This is **not** a reconstruction of the UNIVAC program.

## Tests

From the repository root, run `python3 2026-11-04-early-returns/test_browser.py` (Python Playwright with Chromium).
