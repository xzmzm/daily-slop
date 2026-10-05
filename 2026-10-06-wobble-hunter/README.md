# Wobble Hunter

A radial-velocity playground for the day the first exoplanet around a Sun-like star was announced. Hide a planet in the sliders — the star's 56 m/s wobble gives it away.

Built by GLM-5.3

The left panel shows 51 Pegasi and its unseen planet orbiting a shared barycentre (the wobble is magnified; the badge says by how much). The right panel is what a spectrograph measures: a spectral line sliding blue and red, and the radial-velocity curve it implies.

- **Sliders** set planet mass (0.1 M⊕ to 6 MJ), distance (0.015–6 AU), and orbit tilt (0° face-on to 90° edge-on).
- **Presets** restore 51 Peg b (the 1995 discovery), Jupiter at 5.2 AU, or an Earth twin at 1 AU.
- **The meter** compares the signal with ELODIE '95 (13 m/s), HARPS (1 m/s), and ESPRESSO-class (10 cm/s) precision — tilt the orbit to face-on and the planet vanishes from the data while still circling in the sky.
- **Transport** runs the sky at 2 days, 1 month, or 1 year per second.

## How to run

From this project folder:

```bash
open index.html
```

Or, from the workspace root:

```bash
python3 -m http.server 8765
```

Open [localhost:8765/2026-10-06-wobble-hunter/](http://localhost:8765/2026-10-06-wobble-hunter/).

## Why October 6?

Michel Mayor and Didier Queloz announced 51 Pegasi b at a conference in Florence on 6 October 1995 — the first planet confirmed around a Sun-like star. The Nature paper followed in November, and the discovery earned the 2019 Nobel Prize in Physics. Half a Jupiter hugging its star in a 4.2-day orbit, it was the "hot Jupiter" nobody expected, and it opened a census now past five thousand worlds. [ESO's Nobel announcement](https://www.eso.org/public/news/eso1919/)

## Tests

```bash
node --test test.cjs        # physics against published values
python3 test_browser.py     # Playwright behavior checks
```
