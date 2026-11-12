# Comet Bounce — The Story Behind the Build

## Why this project?

12 November 2026 is the twelfth anniversary of Philae's landing on Comet 67P. Bouncing rather than sticking is an unusual landing hazard and a good subject for a small interactive toy. The historical inspiration is real; the displayed 2D path is not a reconstruction of it.

## How it works

### A synthetic comet

Two softened mass sources, 7 × 10¹² kg and 3 × 10¹² kg, generate acceleration using

`g = -Σ GM (r - c) / (|r - c|² + b²)^(3/2)`.

Their synthetic centers are (-650, -80) and (780, 180) metres; softening lengths are 420 and 340 metres. The total mass is approximately 67P's mass, but the split and centers are toy parameters. Blended ellipses with a neck pinch and small sinusoidal roughness produce a procedural 72-point silhouette, not measured terrain. All landmark and landing coordinates are synthetic, including the Agilkia and Abydos markers; the landing cannot be identified from these coordinates.

The rotating frame uses a 12.404-hour period, centrifugal acceleration `ω²r` and Coriolis acceleration `(2ωvy, -2ωvx)`. RK4 integrates motion in this plane. It omits 3D geometry, realistic mass distribution, tumbling/contact mechanics and external perturbations. Coriolis acceleration bends toy paths; it is not evidence that the real lander followed the illustrated route across the neck.

The escape-speed display comes from the same softened gravitational potential, `sqrt(2ΣGM/sqrt(r²+b²))`, as an inertial estimate. It varies with position and is of order 1 m/s near the surface. Relative speed is displayed in the rotating frame, so it is not directly interchangeable with that estimate. The escape flag requires outward travel beyond 3.8 km and speed above the estimate after converting velocity to the inertial frame. This remains a toy heuristic, not proof of permanent escape. Leaving the comet says nothing about leaving the Solar System.

### Contact and settling

Terrain intersections provide a normal. Velocity is split into normal and tangent components; rebound is `f * vt - e * vn * n`, where `f` is a tangential speed-retention factor, not a Coulomb friction coefficient. At e = 0.38, normal rebound speed is 38% of incident normal speed and normal energy retained is 0.38² = 0.1444. Thus 85.56% of normal kinetic energy is lost; total energy loss depends on tangential motion too. The coefficient is illustrative, not a measured historical value.

Either hardware toggle immediately stops all motion at contact. This deliberately conflates different hardware effects and does not simulate their mechanics. An unanchored lander is forcibly settled at its third contact, or sooner if rebound speed falls below 0.05 m/s. This cutoff keeps the toy short; it is synthetic, not an explanation of the real touchdown sequence. Resting status therefore does not imply Abydos. Altitude is signed nearest-segment distance to the polygon, not distance to its nearest vertex or a historical geographic altitude.

### Power and camera

A 2D ray toward a rotating Sun vector determines terrain shadow. Input is an arbitrary 32 W in light or 1.5 W in shadow, with a fixed 18 W load. The simplified rechargeable reserve is clamped to 0–100 Wh; it is not Philae's non-rechargeable primary battery or its separate real rechargeable system. At zero input it lasts about 5.6 hours; in toy shadow, about 6.1 hours. Neither matches the roughly 60-hour initial historical mission. The low-reserve caption does not claim instruments shut down, since no such behavior is implemented. Camera views are decorative sketches, not reconstructed images or terrain.

## Review notes

- Hardware unavailability and nondeployment are historical context, but this project has no evidence for a specific failed valve, wax actuator, detonator degradation or other component diagnosis. Those claims have been removed rather than presented as established causes.
- Correct microgravity units matter: 300 μm/s² = 0.3 mm/s² = 3 × 10⁻⁴ m/s², approximately 1/30,000 of Earth gravity. Gravity and escape speed vary over the real irregular surface.
- Canvas pointer positions must be scaled from CSS pixels to the internal canvas resolution for both pan and drop. Otherwise responsive layouts launch probes away from the click.
- Scrubbing replays the same initial launch with the currently selected hardware and impact parameters, including custom drops. It does not replay the timing of hardware changes made during an earlier run.

## Historical sources

These support the mission context, not the synthetic parameters or paths above:

- [ESA: Philae completes its main mission before hibernation](https://www.esa.int/Science_Exploration/Space_Science/Rosetta/Pioneering_Philae_completes_main_mission_before_hibernation)
- [ESA: Reconstructing Philae's flight across the comet](https://blogs.esa.int/rosetta/2015/11/12/reconstructing-philaes-flight-across-the-comet/)
- [ESA: Philae wake-up triggers intense planning](https://www.esa.int/Enabling_Support/Operations/Philae_wake-up_triggers_intense_planning)
