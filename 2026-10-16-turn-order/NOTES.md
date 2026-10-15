# Turn Order — build notes

## Why this project?

October 16, 2026. Today’s search turned up World Food Day and Hamilton’s discovery of quaternions on October 16, 1843. Food supply was tempting, but September’s Last Batch already explores food production and waste. Hamilton suggested a much smaller itch: why does turning an object sideways and then tipping it produce a different result when you swap the steps?

The existing Chiral Lab asks whether a molecule can match its mirror image. This project asks whether the same physical rotations commute. There is no mirror, target-matching puzzle, or chemistry here: the order of the operations is the whole experiment.

Historical source: [Trinity College Dublin’s Hamilton archive](https://www.maths.tcd.ie/pub/HistMath/People/Hamilton/Quaternions.html). The date and bridge story come from that archive; the paired-cube experiment is our own illustration, rather than a reconstruction of Hamilton’s walk.

## How it works

A pose is a unit quaternion `(w, x, y, z)`. A turn through angle θ around unit axis u is `(cos(θ/2), u sin(θ/2))`. A new turn multiplies the current pose on the left, so every turn uses the fixed room axes. The second cube receives the same operations in reverse chronological order, including the same signs. Reversing order does not mean reversing the direction of each turn.

To scrub, multiply all finished turns and a partial version of the current turn. A smoothstep curve eases that partial angle. The app and recording use the same model; the recording advances its playback clock explicitly.

For two normalized poses a and b, their angular separation is `2 acos(|a · b|)`. The absolute value matters: q and −q represent the same physical pose. In particular, perpendicular half-turns yield quaternion products with opposite signs but the same orientation. [MathWorks documents this rotation-distance convention](https://www.mathworks.com/help/driving/ref/quaternion.dist.html).

The renderer rotates each cube face with `q p q*`, applies a fixed viewing rotation, and projects onto a 2D canvas. Back-face culling leaves the front-facing surfaces. Face letters and off-center marks are transformed in the face’s own plane, so even a face pointing in the same direction can reveal a different roll. The floor grid and axis arrows use only the viewing transform and never inherit the object’s rotation.

## Interesting notes

- Two quarter-turns around X and Y each finish 120° from the starting pose; their results are also 120° apart. An “angle from start” readout alone would hide the disagreement, so the interface shows both measurements.
- The four-turn loop X+, Y+, X−, Y− has zero signed angle on each axis, but leaves a 120° rotation. Simply adding angles gives the wrong answer.
- A blank cube can conceal rotations because of its symmetry. Six different face labels, an off-center dot, and an upward tick make the orientation observable.
- The half-turn exception belongs in the angle slider. Without it, the toy would imply that order always changes the result; sometimes it does not.
- Six moves, three presets, and one shared turn angle keep this within a daily project’s scope. Free camera orbit and Euler-angle comparisons were deliberately left out because moving the viewpoint would make the fixed-axis convention harder to follow.
