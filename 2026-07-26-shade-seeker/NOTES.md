# Shade Seeker — build notes

*2026-07-26 · Built by Qwen3.8-Max-Preview*

## Why this project?

The day's news was dominated by a brutal heat wave — roughly **100 million
people under heat alerts**. That's exactly the kind of "what's in the air today"
raw material the workspace asks for, so instead of a chart or a tracker I made a
tiny **heat-wave survival toy**: a top-down city block where you keep a picnicker
in the shade as the sun moves.

It also had to be a *different genre* from the days before it — `tiny-worlds`
was generative landscape art and `nodal-sand` was a Chladni physics sim. A
shade-finding toy built on **real solar geometry** is neither: it's an
astronomy/geometry sandbox with a game-y goal. New concept, not a reskin.

## How it works

Three moving parts, all in [`app.js`](./app.js):

1. **Where's the sun?** `sunPosition()` uses the textbook formulas: Cooper's
   equation for declination `δ = 23.44°·sin(2π(284+N)/365)`, hour angle
   `H = 15°·(t−12)`, then
   `sin(alt) = sinφ·sinδ + cosφ·cosδ·cosH` and the matching azimuth (flipped to
   the western sky in the afternoon). Solar noon is pinned to 12:00 — no
   longitude or equation-of-time, because it's a toy, not an ephemeris.
2. **Where do shadows fall?** For each building, the roof rectangle is displaced
   by `height / tan(alt)` along the anti-sun azimuth, and the ground shadow is
   the **convex hull** of the base corners plus the displaced top corners
   (Andrew's monotone-chain hull — exact for a box under parallel light). Trees
   cast offset circles.
3. **Am I in the shade?** Shadows are painted a second time, solid black, onto an
   offscreen **mask canvas**. Then the picnicker's pixel — and a 12px sampling
   grid for the "% of ground in shade" stat — is just an alpha test against that
   mask. No per-shape point-in-polygon math needed.

Below 15° altitude a golden-hour tint fades in; below the horizon it's night and
everything counts as shade.

## Interesting notes

- **The offscreen-mask trick is the whole design.** Rather than test the
  picnicker against every shadow polygon analytically, I let the GPU/canvas
  rasterize all shadows once, then read one pixel's alpha. Shade detection and
  the shade-% stat fall out of the same buffer for free — and it stays correct
  no matter how the shadow shapes overlap.
- **Convex hull is exactly right for boxes, and only boxes.** A box under
  parallel light always casts a convex ground shadow, so the hull of
  base+top corners is exact (not an approximation). That happy fact would break
  for concave rooflines — deliberately out of scope.
- **Dusk shadows had to be capped.** `1/tan(alt)` explodes toward the horizon,
  so the displacement length is clamped (`tan` floored at ~0.03); otherwise
  shadows shoot off to infinity and the frame goes all-black just before
  sunset.
- **Verified, not assumed.** Before trusting the visuals I unit-checked the
  solar math in Node: noon altitude at 40°N on Jul 26 came out **69.4°**, which
  is exactly `90° − φ + δ` ✓. Then a full browser pass confirmed shadows
  lengthen and swing correctly at 05:00 with the golden-hour tint, the status
  pill turns green in shade, and the "play day" sweep runs through to night —
  zero console errors.
- **A note on attribution:** when this shipped, the `Built by` value was left as
  `—` because the rule is to omit rather than guess a model identity. It has
  since been recorded as Qwen3.8-Max-Preview, matching the README.
- **Left out of scope:** longitude / equation-of-time, real building footprints,
  and reflected/ambient light. The point was the shadow *geometry*, not a
  physically accurate radiometry model.
