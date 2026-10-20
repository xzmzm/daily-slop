# One Sphere

The Sydney Opera House opened 53 years ago today. Lift its ten roof shells off the single 75 m sphere they were cut from, then see why the free-form sketch couldn't be built.

Built by Claude Opus 5.5

## How to run

Open `index.html` directly. Everything runs locally.
Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. From the repository root, use
<http://localhost:8765/2026-10-20-one-sphere/>.

## Try it

- **Drag** the 3D view (or use the arrow keys) to turn it.
- **Place on the podium** flies the shells one by one from their slots on the
  sphere to their pedestals; the slider scrubs the same flight by hand.
- **Shape rule** switches between the 1957 free-form sails and the 1961
  spherical solution. Free-form ribs are coloured by how far their curvature
  strays from the sphere's.
- **Shell** picks one of the ten; panel 04 overlays all of its ribs. On the
  sphere they collapse into one line.
- **Different rib curves** counts how many distinct curves the 4.5 m precast
  rib segments would need across the whole roof.

## Tests

```sh
node test_model.cjs
python3 test_browser.py
```

Shell sizes and positions are stylised, not survey data. See `NOTES.md`.
