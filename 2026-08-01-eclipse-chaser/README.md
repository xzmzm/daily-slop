# Eclipse Chaser

The Aug 12, 2026 total solar eclipse — from anywhere in Europe.

Click the map (or a city chip) and see exactly what the sky will do at that
spot on August 12: the phase animation of the sun being eaten, totality
duration if you're inside the band, maximum magnitude, local contact times,
and the sun's altitude at maximum. The shadow's path is real — built from
NASA's TRACK.GOO path data plus the published city table — so Reykjavík
gets its 1:01 of totality, A Coruña its 1:17, Palma its 1:36, and Madrid
agonizingly misses totality by a few kilometres (99.98%).

Built by DeepSeek-V4-Flash.

## How to run

```
python3 -m http.server      # from this folder
```

then open <http://localhost:8000>. No build step, no dependencies — plain
HTML/CSS/JS plus two generated data files (`path.js`, `coast.js`).

## Controls

- **Click the map** anywhere to see the eclipse from that point.
- **City chips** below the map jump to the headline cities.
- **Play** runs the eclipse timeline for the selected spot; **max** jumps to
  maximum; scrub to any moment between first and last contact.
- The readout shows local times (city chips carry exact UTC offsets; map
  clicks get an approximate timezone).

## Notes on accuracy

Geometry is deliberately approximate — enough to know where to stand, not
for eclipse navigation. Durations and magnitudes reproduce the published
city values within a few seconds / ~2% for the flagship cities; the Wikipedia
city table is internally inconsistent around Iceland (Keflavík 1:39 vs
Reykjavík 1:01 cannot both be right), so treat those as indicative. See
`NOTES.md` for the full story.
