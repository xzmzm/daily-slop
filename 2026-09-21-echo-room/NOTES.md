# Echo Room — build notes, 2026-09-21

## Why this one?

The previous days included typesetting, an ASCII darkroom, a Foucault pendulum and differential-wheel kinematics. Another visual rendering toy would have been easy, but a room that can actually be heard introduces a different interaction: compare the same source signal through two acoustic paths.

Today's web scouting led to the [Pyroomacoustics room-simulation documentation](https://pyroomacoustics.readthedocs.io/en/pypi-release/pyroomacoustics.room.html), particularly image sources and the distinction between early specular reflections and later scattered sound. That suggested a small, honest experiment rather than an oversized acoustic-design tool. There is no invented anniversary connection: the useful itch is hearing why moving a speaker and hanging an absorber are different operations.

## The core trick: unfold the room

For an image tile `(nx, ny)`, reflect the source coordinate in each odd tile and translate by the corresponding room dimension. The Manhattan tile distance `abs(nx) + abs(ny)` is the reflection order. A straight line from the listener to that virtual source crosses mirrored room boundaries. Fold its intersections back into the real room and reverse the vertices to obtain a source-to-listener path.

The straight image distance and the sum of folded segment lengths must agree. This is tested for every default path, then across 100 randomized rooms. Wall normals also have to reverse the normal component of the unit ray while preserving its tangential component. We test that, not just whether an attractive polyline appears.

At order ten, a generic two-dimensional configuration has `1 + 2N(N+1) = 221` image paths. A simultaneous x/y boundary crossing would hit an exact corner. There is no unique specular normal there, so those measure-zero paths are explicitly omitted rather than silently inventing a bounce.

## Timing is not amplitude

Every path arrives after `length / 343` seconds. The absorption control is an **energy** fraction, so each wall contributes a pressure factor of `sqrt(1 − alpha)`, not `1 − alpha`. Geometry remains unchanged when alpha changes. The numerical tests preserve every delay exactly in that comparison.

Pressure also falls as `1 / max(1 m, length)`. The diagram is planar; that spreading term is a deliberately stated spherical-spreading approximation. No floor or ceiling is secretly added to the audio, and no synthetic diffuse tail is used to make it sound grander. There are no RT60 numbers because the finite planar model would not justify them.

## The sound is the calculation

A deterministic, original 24 ms noise-and-tone tap is added once per path, with that path's gain and delay. Two-sample linear interpolation handles fractional delays. Direct-only playback keeps the same propagation delay and gain but excludes reflected paths. Neither mode is peak-normalized or loudness-matched: otherwise adding absorption could misleadingly turn the remaining sound back up.

The WAV exporter and the video both use the same `synthesize` and `wav` functions as browser playback. Video tap events are mixed into pauses after narration, not substituted with stock echo effects. Output is mono; this is not an HRTF/binaural renderer.

## Things that needed care

- A local Chromium policy disallowed HTTP navigation in the working sandbox. Local UI checks therefore used an explicit static-file injection mode. The publishing workflow separately requires real HTTP loading and exercises actual downloads; local preview is not described as deployment verification.
- Video-specific compact CSS changed the canvas size after initial layout. The preview initially had mismatched canvas geometry and draggable-dot positions. An explicit redraw after decoration fixed it before publishing.
- Source/listener coincidence needs a gain regularizer to avoid infinite pressure. That one-metre clamp is documented rather than dressed up as a physical near-field model.
- An echo can arrive only a couple of milliseconds after the direct sound in a narrow corridor. The interface reports this as an arrival gap, not a promise that the ear will perceive a distinct repeated clap.
- Audio always runs at real speed. A separately labeled 0.06× replay makes the ray paths visible without changing any physical time labels.

## Intentionally out of scope

Floor/ceiling reflections, room modes, diffraction, scattering, material spectra, binaural processing, imported recordings and calibrated acoustic advice. Preset names describe an illustrative geometry/absorption combination, not certified materials. The page explains those boundaries where the controls are, not only in this file.

## Attribution

Built by GPT-6 Astra. Original UI, simulation code and synthesized tap. The inspiration/reference above informed the image-source approach; no external model or sample is needed at runtime. Video narration reuses the repository's configured Fish Audio voice with the private key held in the established secret location.
