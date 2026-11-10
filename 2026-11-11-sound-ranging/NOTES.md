# Notes on Sound Ranging

## Why this project?

Today is November 11. At the 11th hour of the 11th day of the 11th month in 1918, the Armistice took effect on the Western Front, ending the hostilities of the First World War.

In the Imperial War Museum in London hangs a fragile strip of photographic paper: the Sound Ranging recording taken by the American and British sections between 10:58 AM and 11:01 AM on 11 November 1918. Before 11:00 AM, the six galvanometer traces are filled with jagged, violent pulses of active artillery. At 11:00 AM exactly, the traces suddenly flatten into straight, peaceful horizontal lines—recording the physical moment of peace across the battlefield.

Behind this artifact lies one of the most brilliant triumphs of applied physics. In 1915, William Lawrence Bragg—who had just won the Nobel Prize in Physics with his father at age 25 for X-ray crystallography—was sent to France to solve acoustic counter-battery localization. Enemy guns were hidden behind ridges and camouflage, but their sound could not be hidden. Bragg turned acoustic ranging from erratic guesswork into an exact science using microphone arrays, hyperbolic multilateration (TDOA), and atmospheric correction charts.

## How it works

### 1. The Tucker Hot-Wire Microphone
Standard carbon microphones failed miserably on the front line: they were overwhelmed by infantry rifle fire, shell fragments, and wind buffeting. In 1916, Captain William Sansome Tucker devised an ingenious solution: a fine platinum wire (around 0.006 mm diameter) placed across an opening in an ammunition crate or rum jar and heated to dull red heat by an electric current.

Rifle fire and wind created high-frequency acoustic waves that had tiny displacement amplitudes, barely cooling the wire. But when a heavy howitzer or field gun discharged, the infrasonic muzzle blast (~10 Hz to 25 Hz) displaced a large puff of air across the wire. This cooled the platinum, instantly dropping its electrical resistance and sending an electrical signal back down the telephone line.

### 2. Bull's 5-String Shadowgraph Galvanometer
At the central recording station, five or six copper wire pairs fed into a string galvanometer invented by Lucien Bull. Five thin silvered quartz strings were suspended in a powerful magnetic field. An electric arc lamp illuminated the strings, casting their shadows through a cylindrical lens onto a motor-driven strip of photographic paper. A 100 Hz tuning fork vibrated a spoke wheel across the light beam, marking fine timing lines every 0.01 seconds (10 ms) across the film.

### 3. Hyperbolic Multilateration (TDOA)
When an enemy gun at position $\mathbf{x} = (x, y)$ fires at time $t_0$, the acoustic wave reaches microphone $\mathbf{m}_i$ at time $t_i$:
$$t_i = t_0 + \frac{\|\mathbf{x} - \mathbf{m}_i\|}{v_{eff, i}}$$

By measuring the arrival time difference between any two microphones $\mathbf{m}_i$ and $\mathbf{m}_j$:
$$\Delta t_{ij} = t_j - t_i$$
$$\Delta d_{ij} = c \cdot \Delta t_{ij} = \|\mathbf{x} - \mathbf{m}_j\| - \|\mathbf{x} - \mathbf{m}_i\|$$

The locus of all points $(x, y)$ with constant difference of distance to two fixed foci is a hyperbola. With 5 microphones, four adjacent hyperbolas are drawn. Their mutual intersection pinpoints the enemy battery with remarkable precision (often within 25 meters at ranges of 4 to 8 kilometers).

### 4. Bragg's Atmospheric Vector Correction
In still air, sound speed depends on temperature $T$ (°C):
$$c(T) = 331.3 \sqrt{1 + \frac{T}{273.15}}\text{ m/s}$$

When wind blows with velocity vector $\mathbf{w} = (w_x, w_y)$, sound waves are advected. For a sound ray traveling in direction unit vector $\hat{\mathbf{r}}$, the ground velocity is:
$$v = (\mathbf{w} \cdot \hat{\mathbf{r}}) + \sqrt{c(T)^2 - \|\mathbf{w}\|^2 + (\mathbf{w} \cdot \hat{\mathbf{r}})^2}$$

Without atmospheric correction, a crosswind of 14 m/s (approx. 50 km/h) shifts the acoustic fix by over 140 meters, completely missing the target. Bragg compiled tables and circular slide rules allowing field operators to correct for temperature lapse and wind velocity measured by meteorological kite balloons.

## Interesting notes

- **Youngest Nobel Laureate in the mud**: When the Nobel Prize for Physics was announced in November 1915, Bragg was literally in a trench near Ypres measuring the arrival of German shell blasts with a stopwatch.
- **The gun "whine" vs "thump"**: British soldiers initially tried timing the high-pitched shell scream (Mach shockwave). Bragg realized the supersonic projectile shockwave arrives *before* the true muzzle wave and has a conical shape that cannot be triangulated back to the gun position. Tucker's hot-wire filter specifically ignored the supersonic crack and responded only to the low-frequency muzzle wave.
- **Hyperbola coordinate parameterization**: Sampling a hyperbola numerically by stepping the baseline coordinate $u$ leads to asymptotic explosions when $u \approx a$. The trick is to parameterize by the orthogonal field distance $v$:
  $$\sinh(\eta) = \frac{v}{b}, \quad \cosh(\eta) = \sqrt{1 + \left(\frac{v}{b}\right)^2}, \quad u = \pm a \cosh(\eta)$$
  This yields perfectly spaced, well-behaved curves extending smoothly into the tactical grid.
- **The Armistice transition**: Recreating the transition to silence on the galvanometer tape on November 11 is a reminder of how sound, science, and history intertwined on the Western Front.
