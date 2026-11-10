# Sound Ranging

William Lawrence Bragg's acoustic multilateration, November 11, 1918: read the galvanometer tape, plot the arrival hyperbolas, and locate the hidden guns before the armistice silence.

Built by Gemini-3.8 Flash

[Open the experiment](https://dailyslop.pages.dev/2026-11-11-sound-ranging/)

## How to run

Open `index.html`, or serve from the repository root:

```sh
python3 -m http.server 8765
```

Then visit `http://localhost:8765/2026-11-11-sound-ranging/`. Port 8000 is reserved on this machine; use 8765 or any other free port. No installation, build step, or external network requests are needed.

## Try this

1. **Fire the battery**: Click **Fire Battery** to trigger an acoustic muzzle blast from the German gun position. Watch the spherical acoustic wavefront expand across No Man's Land and strike each surveyed microphone in sequence.
2. **Read the galvanometer tape**: Inspect the photographic shadowgraph tape below the map. The five horizontal ink traces show the damped electrical oscillations generated as Tucker's heated platinum wire is cooled by the infrasonic shockwave. Vertical red timing ticks mark every 0.01s and 0.1s from a 100 Hz tuning fork.
3. **Inspect the hyperbolas**: Each pair of adjacent microphones produces a hyperbolic line of position ($\Delta d = c \cdot \Delta t$). With three or more microphones, the hyperbola branches intersect at a single pinpoint crosshair.
4. **Compare uncorrected vs. corrected atmospheric drift**:
   - Switch to the **Arras Crosswind** preset (14 m/s easterly gale).
   - With **Bragg Atmospheric Correction** switched OFF, notice how the uncorrected sound speed causes the calculated fix to drift over 140 meters off-target.
   - Flip the **Bragg Atmospheric Correction** switch ON: the solver incorporates temperature and wind vectors, pulling the hyperbolas back into a sub-meter pinpoint fix.
5. **The 11th Hour (Armistice Day)**: Click **Armistice 11:00 AM**. Experience the historic moment on 11 November 1918 when the artillery fire ceased, and the galvanometer traces flattened into unbroken silence.

## Model boundaries

This simulation implements 2D ray acoustics in uniform atmospheric layers:
- Speed of sound is computed via $c(T) = 331.3 \sqrt{1 + T/273.15}\text{ m/s}$.
- Wind advection uses the exact ray velocity vector $\mathbf{v} = (\mathbf{w} \cdot \hat{\mathbf{r}}) + \sqrt{c^2 - w^2 + (\mathbf{w} \cdot \hat{\mathbf{r}})^2}$.
- Hyperbolas are sampled analytically via focal axis transformations.
- Nonlinear least squares (Gauss-Newton) solves the system $r_i(\mathbf{x}, t_0) = \|\mathbf{x} - \mathbf{m}_i\| - c_{calc}(t_i - t_0) = 0$.
- Atmospheric micro-turbulence, vertical temperature lapse rates (inversions), 3D ground topography reflections, and supersonic projectile ballistic "crack" (Mach wave) preceding the subsonic muzzle "thump" are simplified to highlight the core geometric multilateration physics.
