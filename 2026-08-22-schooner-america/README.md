# Schooner America

1851 America's Cup aerodynamic sail physics, wave-line hull hydrodynamics, and polar velocity studio for the 175th anniversary of the historic Isle of Wight regatta (Aug 22, 1851).

Built by Gemini 3.7 Flash

## How to run

No dependencies or build steps required.

```bash
python3 -m http.server 8765
```

Then open <http://localhost:8765/2026-08-22-schooner-america/> in your browser (or simply open `index.html` directly).

> **Port policy:** Never bind anything to port 8000 (reserved). Use 8765 or any other free port.

## Controls

| Key / Control | Action |
| --- | --- |
| **A / D** or **◀ / ▶** | Steer Helm (Port / Starboard Rudder) |
| **W / S** or **▲ / ▼** | Sheet In / Sheet Out Sail Trim |
| **T** | Toggle Automatic Aerodynamic Optimal Sail Trim |
| **M** | Toggle Procedural Web Audio (Sea Foam & Rigging Wind) |
| **Space** | Pause / Resume Real-Time Physics Integration |
| **Mouse Drag** | Interactive Rudder, Sheet, and Wind Sliders |
| **Presets** | Load 1851 Regatta, Upwind Beat, Beam Reach, Bow Wave Duel |

## Features

- **True vs Apparent Wind Vector Kinematics:** Live animated decomposition of True Wind $\vec{v}_t$, Boat Velocity $\vec{v}_b$, and Apparent Wind $\vec{v}_a = \vec{v}_t - \vec{v}_b$.
- **Aerodynamic Sail Physics:** Cambered airfoil lift ($C_L$) and drag ($C_D$), stall limits, and telltale streamers. Direct comparison between machine-woven flat cotton canvas (*America*) and baggy flax canvas (*Aurora*).
- **Wave-Line Hydrodynamics:** George Steers hollow concave bow vs British "Cod's head and mackerel tail" convex entry. Realistic Kelvin wake expansion ($19.47^\circ$), skin friction ($R_f$), and wave-making resistance ($R_w$).
- **Live Polar Velocity & VMG Studio:** Real-time polar envelope generation ($0^\circ$ to $180^\circ$ TWA) pinpointing peak upwind VMG tangent points.
- **1851 Isle of Wight Tactical Regatta:** Interactive tactical chart with historic landmarks (Cowes, Nab Light, Dunnose, St. Catherine's Point, The Needles).
- **Procedural Web Audio:** Zero external assets — algorithmic sea spray rush, wind whistle in rigging, sail luffing snaps, and timber creaks.
