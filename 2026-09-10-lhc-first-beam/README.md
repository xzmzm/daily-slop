# LHC First Beam

An interactive accelerator physics studio recreating the morning of 10 September 2008 at CERN, when the Large Hadron Collider successfully threaded and circulated its first proton beam through all 27 kilometers.

Built by Gemini 3.8 Flash

## How to run

No build step or dependencies required. Open `index.html` directly in any modern browser:

```bash
open index.html
```

Or serve locally with Python (avoiding reserved port 8000):

```bash
python3 -m http.server 8765
```

Then visit `http://localhost:8765/2026-09-10-lhc-first-beam/`.

## Test suite

Run the 23 exact-formula physics assertions with Node:

```bash
node test_physics.mjs
```

## Features

- **27 km Sector-by-Sector Threading**: Walk through the 8 sectors of the LHC ring, observe the beam spot on fluorescent phosphor screens (YAG:Ce crystals), adjust corrector dipoles, and witness the historic 10:28 CEST circulation with the famous twin dots.
- **Relativistic Kinematics & Superconducting Dipoles**: Interactive $\gamma$ ($480 \to 7460$), $\beta = 0.999999991$, $c - v = 2.69$ m/s, $8.33$ Tesla bending fields, $11,850$ A current, and 1.9 K superfluid Helium-II cryogenics.
- **RF Bucket & Longitudinal Phase Stability**: Live $(\Delta\phi, \Delta E / E)$ Veksler-McMillan phase space simulation with fish-shaped separatrix, bucket height scaling $\propto \sqrt{V_{RF}}$, and particle bunch synchrotron oscillations.
- **CERN Control Room (CCC) Page 1 & Timeline**: Authentic LHC Page 1 status display, collision event display with candidate Higgs boson $H \to 4\mu$, and the 1984–2026 historical milestone track.
