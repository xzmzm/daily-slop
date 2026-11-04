# Long Wave

Send a long wave across a continental shelf; change the depth and watch it slow, shorten, and grow.

Built by GPT-6 Astra

An interactive experiment for November 5, World Tsunami Awareness Day. Follow a marked crest across a 900 km ocean, scrub time, and compare a 200 m shelf, a 50 m shelf, or deep water all the way. Changing depth preserves the crest's position for a direct comparison.

## How to run

Open `index.html` directly, or from this folder:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765](http://localhost:8765). Everything runs locally, with no dependencies, downloads, or keys.

## Try it

1. Press **Play wave**, or move the time slider to follow the orange crest.
2. Press **Meet the shelf** to see it over the flat, shallow part.
3. Compare **200 m shelf**, **50 m shelf**, and **Deep all the way**. At 50 m, the model's crest travels at about 80 km/h and its amplitude is about three times the deep-water value.

The bottom comparison draws one local wavelength on the same horizontal scale for both depths. Its vertical amplitude is fixed to isolate spacing. All range controls support arrow keys. Nothing moves until you press Play.

## Model and limits

This is a one-way, slowly varying shallow-water approximation: `c = sqrt(g h)`, `wavelength = c × 720 s`, and amplitude `a = 0.5 × (4000/h)^(1/4) m`. Travel time is integrated across a smooth, fictional sea floor. The 12-minute wave packet starts with its marked crest at 80 km. The crest starts 0.50 m **above still water**; this is amplitude, not trough-to-crest wave height.

The model preserves ideal energy flux, not a full numerical fluid solution. It omits reflection, friction, refraction, breaking, flooding, and the source earthquake. Wave relief and sea-floor depth use separate exaggerated vertical scales. It is an illustration of shoaling, not a forecast or evacuation tool.

## Checks

```sh
node test_model.cjs
python3 test_browser.py  # requires Playwright and its Chromium browser
```

The physics checks cover constant-depth travel, inverse travel time, period and energy-flux conservation, and shelf values. Browser checks exercise the controls, offline use, and widths from 320 to 1920 px.

## Sources

- [UNDRR: World Tsunami Awareness Day 2026](https://tsunamiday.undrr.org/publication/documents-and-publications/world-tsunami-awareness-day-2026-concept-note)
- [NOAA: Tsunamis](https://www.noaa.gov/education/resource-collections/ocean-coasts/tsunamis)
- [University of Washington: tsunami transformation near land](https://earthweb.ess.washington.edu/tsunami/general/physics/transform.html)
- [University of Washington: shallow-water wave speed](https://earthweb.ess.washington.edu/tsunami/general/physics/characteristics.html)

The Chinese narrated demonstration and matching captions are in [video/](video/README.md).
