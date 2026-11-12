# Comet Bounce

An illustrative 2D toy inspired by Philae's comet landing: compare anchoring, bouncing and escaping a tiny gravity well. Not an exact trajectory or historical reconstruction.

Built by Gemini-3.8 Flash

On 12 November 2014, ESA's Philae landed on Comet 67P after separation from Rosetta. Its hold-down system was unavailable and its harpoons did not deploy; it bounced before resting at the poorly illuminated Abydos site. Its initial science sequence lasted roughly 60 hours before primary-battery exhaustion.

67P's surface gravity varies: an illustrative scale is 300 μm/s² = 0.3 mm/s² = 0.0003 m/s², about 1/30,000 of Earth's gravity. Escape speed varies with location and is of order 1 m/s, not a universal walking-speed threshold. Escaping the comet does not mean escaping the Solar System.

## What the toy does (and does not do)

- Integrates motion in a rotating 2D frame with Coriolis and centrifugal terms, using two softened mass sources and a procedural silhouette. Mass split, terrain, landmark/landing coordinates and launch conditions are synthetic; named sites are illustrative markers, not a geographic map.
- Applies normal restitution and a tangential speed-retention factor (not a Coulomb friction coefficient). At e = 0.38, normal kinetic energy retained is e² = 0.1444 (14.44%); 85.56% is lost. This is a toy choice, not a measured Philae coefficient or a claim about total impact-energy loss.
- Forces settling by the third contact, or earlier below a rebound-speed cutoff. Neither this rule nor the resulting path reconstructs the real landing history.
- Either enabled hardware switch stops all motion at contact. Real hold-down thrusters and harpoons are not interchangeable; their mechanics and failure causes are not simulated.
- Offers four toy scenarios, custom drops, pan/zoom and time scrubbing. The escape flag uses a distance/outward-motion and inertial-energy heuristic, not a rigorous escape prediction. The displayed escape estimate is inertial; displayed relative speed is comet-fixed.
- Raycasts 2D terrain shadows and shows a stylized camera scene, not CIVA/ROLIS imagery or telemetry.
- Models a **simplified rechargeable 100 Wh reserve**, not Philae's non-rechargeable primary battery. Solar input is fixed at 32 W in sunlight or 1.5 W in shadow against an 18 W load. At zero input the full toy reserve lasts about 5.6 hours, not 60 hours. Temperature, panel geometry, real battery capacities and instrument scheduling are omitted; no instrument hibernation is modeled.

## How to run

From the workspace root, run:

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765/2026-11-12-comet-bounce/`, or directly open this project's `index.html`. No build tools or external dependencies are required.

## Tests

From the workspace root:

```bash
node 2026-11-12-comet-bounce/test_model.cjs
python3 2026-11-12-comet-bounce/test_browser.py
```

The Node suite covers model regressions; the browser suite covers controller interactions. The optional browser suite requires Playwright. See `NOTES.md` for mechanisms, limitations and historical sources.
