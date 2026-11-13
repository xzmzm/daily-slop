# Eighty Days

Run Nellie Bly's real 1889 timetable: pick your steamers, keep the weekly
mail-boat chain alive, and beat the fictional eighty-day clock that sent her
around the world.

Built by GLM-5.3 Flash

## What it is

On **November 14, 1889**, reporter Nellie Bly boarded the *Augusta Victoria*
at Hoboken and raced east around the globe, beating Jules Verne's fictional
80 days with an official **72d 6h 11m**. This page rebuilds her trip as a
timetable puzzle:

- A canvas world map tracks your ship eastbound — and rival Elizabeth
  Bisland, who sailed west the same day, marker by marker.
- Every sailing on the board comes from the itinerary printed in her book:
  the *Victoria* out of Brindisi on Mondays, the canal convoy on Thursdays,
  the *Oceanic* from Hong Kong on December 28, and so on.
- Miss a mail boat and the next one is a week away — usually fatal to the
  record. Match her connections exactly and you land on her official total
  to the minute.
- Crossing the 180th meridian rolls the calendar back a day, as it did for
  her ship's company.

A perfect run is possible but has exactly one shape: never miss a boat.
Verne's 80 days, Bisland's 76½, and Bly's 72d 6h 11m are marked on the pace
bar as you go.

## How to run

No build step, no dependencies:

```sh
open index.html            # or:
python3 -m http.server 8765   # then visit http://localhost:8765/2026-11-14-eighty-days/
```

## Tests

```sh
node --test test_model.cjs      # timetable + calendar + rival logic
python3 test_browser.py         # Playwright UI regressions (needs chromium)
```

## Sources

Leg dates and times follow the itinerary in Chapter XVIII of Bly's
*Around the World in Seventy-Two Days* (1890); Bisland's westbound dates are
interpolated from the published account of the race. See `NOTES.md` for the
mechanics and the honest caveats.
