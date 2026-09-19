# Split Drive

A miniature cornering lab: tighten the bend, lock the axle, and see why two wheels need different speeds.

Built by GPT-6 Astra

## How to run

Open `index.html`, or serve the repository root:

```sh
python3 -m http.server 8765
```

Visit `http://localhost:8765/2026-09-20-split-drive/`.
No install, framework, backend, or external assets are needed.

## Try it

Start with a left turn, then decrease the radius. The teal left wheel is on
the shorter inside path; the orange right wheel must roll faster. **Lock the
axle**: wheel speeds become equal, while the road's demands remain unequal.
Switch to a right turn and the roles reverse. Switch to **Straight** and the
mismatch vanishes even with the axle locked.

The sliders control rear-axle-center turn radius (3.5–16 m), forward speed
(0–36 km/h), and rear track width (1–2.4 m). Wheels have a fixed 0.32 m rolling
radius and the wheelbase is 2.3 m. **Save study** exports a 1440 × 900 PNG
with the current setup, scene, and numerical readings.

**Space** pauses/resumes and **R** resets when a form control or link is not
focused. Reduced-motion preferences pause initially. Motion is displayed at
**one quarter of real speed**, while numeric RPM and mismatch values are
calculated for the selected real speed.

## Model boundaries

This is **imposed-path kinematics**, not a vehicle-dynamics or traction model.
The car follows the selected circle even with a locked axle. The orange
hatches indicate the longitudinal sliding that this constraint requires;
they do not estimate tire forces, heat, wear, grip, or a realistic driving line.

An open differential permits a speed difference; it does not infer the split
from steering. In this experiment, equal tire radii and no-slip road geometry
determine the open axle speeds. The imposed locked case fixes the carrier to
the selected center speed. No engine torque, friction, or limited-slip device
is modeled. The visible path circles belong to the **rear wheel centers**;
front wheels use separate Ackermann steering angles.

## The useful surprise

The difference between the two rear-wheel path lengths over a complete circle
is `2π × track width`, independent of turn radius. That does **not** mean the
instantaneous speed difference is independent of radius: smaller circles are
completed sooner at the same center speed. Straight travel has no circular lap;
its distance fields deliberately show a dash.

## Tests and video

```sh
node 2026-09-20-split-drive/test.cjs
python3 -m pip install playwright pillow
python3 -m playwright install chromium
python3 2026-09-20-split-drive/test_browser.py
python3 2026-09-20-split-drive/video/render_video.py
```

`BROWSER_EXECUTABLE=/path/to/chromium` selects a system browser. The tests
cover kinematic invariants, zero speed, mirrored turns, actual controls,
responsive layouts, reduced motion, and a native PNG download.

The [`video/`](./video/) folder contains the 1080p walkthrough, Chinese SRT,
audio-mode metadata, and reproducible renderer. It uses the established Fish
Audio voice when the authorized key is available; otherwise the video is
explicitly labelled **Chinese captions and original music, without narration**.

## Reference

[MIT 2.972 — How a differential works](https://web.mit.edu/2.972/www/reports/differential/differential.html),
particularly the cornering explanation and average-speed identity. The road
geometry and distance comparisons here are derived directly from circular
arcs, rather than digitized from a vehicle dataset.
