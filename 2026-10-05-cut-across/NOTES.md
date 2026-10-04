# Cut Across — build notes

Written October 5, 2026.

## Why this project?

The date supplied a film prompt: [BFI records the London premiere of *Dr No* on October 5, 1962](https://www.bfi.org.uk/features/happy-50th-anniversary-mr-bond). Sixty-four years later, a daily build about editing felt more distinct from the workspace’s many physical apparatus and historical simulations. The small question was useful on its own: how can two stationary people appear to swap places just because an editor changed cameras?

The answer needs only two actors, an axis, and two views. It makes the relationship between a floor plan and a finished shot visible without borrowing a Bond scene, character, or image.

## The filmmaking convention

For a fixed two-person dialogue, the imaginary line through the actors divides the set into two sides. Keeping successive camera positions on one side preserves the actors’ left–right relationship. Cutting to the other side reverses that relationship and can make their spatial arrangement harder to follow. [Adobe explains both the convention and deliberate reasons to break it](https://www.adobe.com/uk/creativecloud/video/discover/what-is-the-180-degree-rule.html); [this Berkeley-hosted composition handout illustrates the axis and screen-direction change](https://casn.berkeley.edu/wp-content/uploads/resource_files/DontCrossTheLine.pdf).

The lab presents a deliberately narrow case: actors stay in place, cameras face the midpoint, and a cut switches viewpoints. A line crossing is a spatial change, not a verdict on the quality of an edit. A continuous camera move can show the audience the change of viewpoint, while an intentional hard cut can create disorientation. [StudioBinder’s author-written guide describes visible camera movement and neutral shots as ways to transition across the line](https://www.studiobinder.com/blog/what-is-the-180-degree-rule-film/). The familiar name describes a half-plane around the axis; the relevant test here is which side each camera occupies, not a maximum numerical difference between their angles.

## How the projection works

Ada stands at `(-1, 0)` and Jules at `(1, 0)`. Each camera sits on a circle of radius `4` around their midpoint. For camera angle `θ`, its ground-plane position is:

```text
camera = (4 cos θ, 4 sin θ)
```

It looks inward toward the origin. Its direction toward screen right is `(sin θ, -cos θ)`, and its forward direction is `(-cos θ, -sin θ)`. For an actor at `(x, 0)`, a dot product with those directions gives:

```text
horizontal offset = x sin θ
depth             = 4 - x cos θ
screen position   ∝ horizontal offset / depth
```

The film view maps the normalized horizontal position into its 760-unit-wide SVG as `380 + 530 × horizontal offset / depth`. Each character drawing is resized by `0.88 × 4 / depth`, so a nearer actor projects larger. Both depths stay positive because the actors are only one unit from the midpoint and the cameras are four units away. The screen coordinates come from this geometry; the app does not simply swap the actors when a warning changes.

The drawings are sorted by depth and painted from farthest to nearest. This matters at the axis, where the actors align horizontally and the nearer figure needs to cover the farther one. These are flat character drawings scaled by their center depths, rather than a complete 3D reconstruction of their bodies or the room.

At the initial angles, camera A at `55°` and camera B at `135°` are on the same side of the axis. Their sines are positive, so the actor at `x = -1` appears to the left of the actor at `x = 1` in both views. Move B to `225°`, where the sine is negative, and their projected order reverses.

The side test is the sign of the camera’s `y` coordinate, equivalently the sign of `sin θ`. Exactly on the axis, at `0°` or `180°`, the horizontal offsets vanish: one actor sits in front of the other. That boundary is a neutral, on-axis view rather than either half-plane.

## Choices that keep it small

The set and characters are original drawings. Ada keeps an olive-green coat and Jules an orange coat so their identities survive the change of screen position. Names and facing arrows make the same relationship readable without relying only on coat color.

The large monitor supplies the temporal experience of a hard cut every two seconds; the two persistent thumbnails let the viewer inspect both views at once. Clicking a thumbnail pauses on that view. The overhead plan supplies the missing geography, and the position labels connect that plan to each framed shot. Camera B supports both dragging and a slider, with two presets for the initial comparison.

A fixed actor arrangement keeps the axis stable, and the fixed camera radius makes angle changes easy to compare. The on-axis state is a geometric boundary the viewer can inspect; there is no automatic bridge-shot sequence. This is a diagram of spatial continuity rather than a full camera or editing simulator: no lens catalogue, changing actor blocking, imported clips, or claim that every line crossing confuses every viewer.

The perspective term matters even in such a simple scene. The two same-side shots need not look identical: apparent size and spacing can change while the screen relationship remains consistent. That is the distinction the paired plan and camera views are meant to expose.
