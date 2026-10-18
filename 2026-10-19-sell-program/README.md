# Sell Program

A Black Monday lab: portfolio insurers sell because prices fall, and prices fall because they sell. Set how much money runs the rule and replay 19 October 1987.

Built by Claude Opus 5.5

## How to run

Open `index.html` directly. Everything runs locally.
Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. From the repository root, use
<http://localhost:8765/2026-10-19-sell-program/>.

## Try it

- **Money running portfolio insurance** — $0 to $150bn (0–5% of a ~$3tn market). The 1987 estimate was $60–90bn.
- **Opening gap** — how far the market opens below Friday's close.
- **Buyers on the floor** — scales book depth and bargain-hunter demand.
- **Today's circuit breakers** — 15-minute halts at −7% and −13%, trading ends at −20%.
- **Replay the day** — runs 9:30 → 16:00 in 13 seconds with a ticker tape.

The green line is this run; the dashed grey line is the same morning with no
insurers. The bottom panel stacks what insurers have sold (green) under what
their formulas want sold but the floor has not absorbed yet (red).

## Tests

```sh
node test_model.cjs
python3 test_browser.py
```

The model is a tuned toy, not a reconstruction of the Brady Commission's data.
See `NOTES.md`.
