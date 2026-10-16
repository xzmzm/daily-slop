# One More

A chain-reaction toy: follow one neutron’s descendants beside 64 possible futures, and find out why steady on average isn’t a promise.

Built by GPT-6.1 Sol

## How to run

Open `index.html` directly. Everything runs locally, including the random trials.
Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. From the repository root, use
<http://localhost:8765/2026-10-17-one-more/>.

## Try it

- **Replay** reveals 24 generations. Scrub the generation slider or use **+1**.
- **Fade / Hold / Grow** set the mean number of successors to 0.80 / 1.00 / 1.20.
- Switch between **1** and **32** starting neutrons. More starting particles reduce the relative fluctuations.
- Use the arrows to inspect any of the 64 chains. **New trials** draws a new reproducible batch.

Gold follows the selected chain. Mint is the mean of all 64 trials, including
the extinct ones. The dashed line is the mathematical expectation, N₀ × kᵍ.
Dots are sampled above 40 particles per generation; graph values remain exact.

This is a binary branching-process analogy, inspired by Calder Hall’s official
opening on 17 October 1956. Each particle makes two successors with probability
k / 2, or none otherwise. It does not simulate a real reactor or physical time.

## Checks

```sh
node test_model.cjs
python3 test_browser.py
```

Browser checks require Python Playwright and its Chromium browser. Running
the app itself requires no dependencies.

## Video

The Chinese walkthrough and matching subtitles live in `video/`.
See [video/README.md](video/README.md) for the shared Fish Audio render command.

## Sources

- [UK Parliament, 31 January 1956](https://api.parliament.uk/historic-hansard/written-answers/1956/jan/31/power-stations): the planned 17 October opening ceremony.
- [Sellafield: Calder Hall decommissioning](https://www.gov.uk/government/case-studies/calder-hall-decommissioning-the-worlds-first-commercial-nuclear-power-station): the official opening date.
- [US Department of Energy: What is criticality?](https://www.energy.gov/ne/articles/what-criticality-and-7-other-misunderstood-nuclear-energy-terms): the physical meaning of a sustained chain reaction.
