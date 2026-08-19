# Voyager 2 Grand Tour · Gravity Assist Simulator

Built by Gemini 3.7 Flash

An interactive orbital mechanics and gravity-assist slingshot simulator celebrating the 49th anniversary of the launch of **Voyager 2** (August 20, 1977).

Simulate how Gary Flandro's 1965 discovery of a once-in-176-years planetary alignment allowed a single spacecraft to visit Jupiter (1979), Saturn (1981), Uranus (1986), and Neptune (1989), stealing orbital kinetic energy from each gas giant to escape the Sun's gravitational well into interstellar space.

![Voyager 2 Grand Tour Simulator](../gallery/shots/2026-08-20-grand-tour.png)

## Highlights

- **Heliocentric Grand Tour Map:** Full-system view tracking Voyager 2's position, velocity vector, and trajectory across 49 years (1977–2026), crossing the Heliopause at 119.7 AU into the interstellar medium.
- **Encounter Chamber:** High-resolution close-ups of all 4 planetary encounters (Jupiter's Great Red Spot & Io, Saturn's rings & Titan, Uranus's 98° tilted axis & Miranda, Neptune's Great Dark Spot & Triton), with hyperbolic asymptotes, periapsis distance, and live vector addition triangles ($\vec{v}_{helio} = \vec{v}_p + \vec{v}_\infty$).
- **Live Physics Telemetry & Analytics:** Real-time distance (AU & billion km), heliocentric speed vs. local solar escape threshold ($v_{esc}(r) = \sqrt{2\mu_\odot/r}$), one-way/round-trip light-travel time (19.2+ hours), and Plutonium-238 RTG electrical power decay (470 W $\to$ 228 W).
- **Golden Record & Interstellar Station:** Rotating 12-inch golden phonograph record with etched pulsar map and synthesized Bach Brandenburg concerto snippet.
- **Slingshot Sandbox:** Interactive flight planner allowing you to adjust Earth injection $\Delta v$ and Jupiter flyby aim point ($b/r_p$) to test solar escape, gravity braking, or unlocking the Grand Tour corridor.

## How to run

No dependencies, no build steps. Run with any local HTTP server:

```bash
# From the repository root
python3 -m http.server 8765
```

Then open `http://localhost:8765/2026-08-20-grand-tour/` in your browser. (Port 8000 is reserved on this system; use 8765 or any other available port).

Alternatively, open `index.html` directly in any modern browser.

## Tests

Run the deterministic physics unit tests with Node.js:

```bash
node 2026-08-20-grand-tour/test_engine.js
```
