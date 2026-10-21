# Spill Hole

Cut a vent in a round parachute and compare two descents: a steadier canopy gives up some drag. Inspired by Garnerin’s rocking ride over Paris on October 22, 1797.

Built by GPT-6.1 Sol

## How to run

Open `index.html` directly. Or, from the repository root:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765/2026-10-22-spill-hole/](http://localhost:8765/2026-10-22-spill-hole/).

Change the vent area, play the descent, or scrub the replay. Coral is the sealed reference; teal is your canopy. The swing plot uses the same colors. The terminal-speed and last-eight-seconds RMS readings summarize the full modeled descent, even while the replay is paused.

This is an illustrative comparison, not a reconstruction or a design tool. Both 7 m canopies begin inflated, carrying 80 kg through a 120 m comparison drop. Vent area is a fraction of projected canopy area. Drag and rocking coefficients are deliberately simplified; real canopy behavior depends on shape, porosity, suspension and flow.

## Verify

```sh
node 2026-10-22-spill-hole/test_model.cjs
python3 2026-10-22-spill-hole/test_browser.py
```

Browser checks need the development-only Python Playwright installation. The app itself has no dependencies or network requests.

## Sources

- [FAI: Garnerin’s 1797 descent](https://www.fai.org/news/garnerin-1797) — date, basket, uncontrolled rim spill and rocking.
- [NASA: Orion Parachutes](https://www.nasa.gov/podcasts/houston-we-have-a-podcast/orion-parachutes/) — discussion of an apex hole adding stability.

The percentages shown by this app come from its model, not historical measurements or NASA flight data.

## Video

[Watch the 68-second Chinese video](video/spill-hole-zh-fish.mp4), with [matching subtitles](video/spill-hole-zh-fish.srt). See [video/README.md](video/README.md) for the Fish Audio render command.
