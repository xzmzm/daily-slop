# Every Street

A small postal puzzle: walk every street, return to the post office, and find the footsteps you can’t avoid retracing.

Built by GPT-6 Astra

Made on October 9, 2026, for World Post Day. Three fictional neighborhoods,
one empty-mailbag goal. Click adjoining junctions or streets to walk, undo a
leg, mark odd junctions, or watch an exact shortest round. Your own attempt
is preserved while you watch the solution.

## How to run

Open `index.html` directly, or from the repository root:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765/2026-10-09-every-street/](http://localhost:8765/2026-10-09-every-street/).
No installation, build step, backend, or network access is needed to play.

Live: [Every Street](https://dailyslop.pages.dev/2026-10-09-every-street/)

## Playing a round

- Start at **A**, the post office. Click a neighboring letter or connecting street.
- A green street has been delivered; gold means you walked it again.
- Cover every street **and return to A**. You can keep walking after completing a round.
- **Mark odd junctions** highlights the places where an odd number of streets meet.
- **Show the shortest round** animates a globally shortest route. Pause, resume,
  replay, or return to your own round. The route need not be unique.
- Junctions also support Tab and Enter / Space; reduced-motion settings are respected.

All streets are two-way; printed distances, not drawing lengths, determine cost.
There is no delivery time, traffic, house-side, or vehicle-turn model.

## Checks

```sh
node 2026-10-09-every-street/test.cjs
python3 2026-10-09-every-street/test_browser.py
```

The browser check uses Playwright as development tooling. Engine checks compare
the solver with an independent exhaustive search over location and delivered
streets. The three shortest rounds are 1,680 m, 840 m, and 1,560 m.

## Video

The [Chinese walkthrough](video/every-street-zh-fish.mp4) uses the user’s current
Fish Audio voice, with burned-in captions and a [matching SRT](video/every-street-zh-fish.srt).
Reproduction instructions are in [video/README.md](video/README.md).
