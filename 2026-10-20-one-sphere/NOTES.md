# One Sphere — notes

## Why this project?

Today is 20 October. The Sydney Opera House was opened by Elizabeth II on
20 October 1973. Utzon won the 1957 competition with sails that had no
geometry anyone could compute. Arup's engineers tried parabolas, ellipsoids
and other shapes for years before Utzon reached the "spherical solution" in
the early 1960s: cut every shell from the surface of one sphere, about 75 m
in radius. Then every rib is the same circle, and the ribs can be precast in
repeated segments.

Other candidates for the date were the "Saturday Night Massacre" (1973) and
the RMS Olympic launch (1910). The Opera House won because the idea fits one
toggle. The gallery has done orbits, optics and circuits but never a
building, and never 3D surface geometry.

## How it works

**One shell = one fan of ribs.** In each shell's local frame the pedestal
sits at the origin. Every rib leaves it horizontally and bends upward, and
the ribs fan around the vertical axis by ±`half` degrees. A rib is fully
described by its curvature *k(s)* along its arc length *s*:

- **sphere:** `k = 1/R`. The rib is then `r = R sin(s/R)`, `h = R(1 − cos s/R)`,
  and every point of every rib is exactly R from `(0, 0, R)`.
- **free-form:** `k = (m/R)(1 + bend·cos(πs/L))`, where `m = 1 + 0.3(w² − ⅓)`
  depends on where the rib sits in the fan (w ∈ [−1, 1]). The turning angle
  integrates in closed form; the position needs a numerical integral
  (Simpson, 40 steps). Rib lengths match the sphere version, so only the
  bending differs.

**Putting them back on the sphere.** The ten shells are sliced like orange
segments around the sphere's north pole. Each gets an azimuth band of width
2·`half`, with equal gaps between bands. On the sphere a shell is flipped
upside down (pedestal at the top, the pole), then spun to its band. On the
podium it is stood up so its ridge rib leaves the pedestal almost vertically,
leaning back by `lean`, and curls forward over the open mouth, then spun to
face north or south. The flight is a quaternion slerp between those two
orientations. The pedestal moves along a straight line plus a 28 m
`sin(πt)` hop, and each shell starts 0.045 later than the one before.

**Counting curves.** Each rib is cut into 4.5 m segments. Two segments count
as the same curve only if their radius of curvature matches at both ends, to
the nearest 0.5 m. On the sphere all 2,226 segments are the same curve. In
the free-form version they need 829 different curves. (Mirror-image ribs on
either side of a ridge share curves, which is why it isn't higher.)

**Rendering** is a plain canvas painter's algorithm. There are 14 × 8 quads
per shell; all 1,120 are sorted by depth every frame. A quad shows the tiled
cream face when its outward normal (away from the sphere's centre) points at
the camera, and the darker underside otherwise.

## Interesting notes

- **The first version showed the wrong side of everything.** The shells were
  cut from the sphere's *south* pole, so the default camera, above the
  equator, looked into the concave insides of a bowl. Moving the cut to the
  north pole (a 180° flip about x before the band rotation) fixed it.
- **Then the podium was upside down in a different way.** A plain tilt about
  the lateral axis made each shell rise and curl *back* over its pedestal
  like a breaking wave, with the hollow facing the viewer. The real shells
  hood forward over their glass mouths, which needs local x → up and local
  z (towards the sphere's centre) → north. That isn't a single tilt; it's a
  180° roll about x followed by −(90° + lean) about y.
- **Small shells barely lean forward.** With R fixed at 75 m, a 27° shell
  rises about 34 m and moves forward only about 8 m, so a 14° lean put its
  tip *behind* the pedestal. The test caught it, and R2 now leans 8°.
- **Fans had to be wider than they look in photos.** At first the half-angles
  were 9–17° and the shells read as ribbons. Widening them to 11–22°
  covers about 326° of the sphere's azimuth and still looks right on the
  podium.
- The real shells are pairs of mirrored half-shells meeting at a ridge, and
  their ribs run from the pedestal up to that ridge. Here one symmetric fan
  stands in for each pair. The ten shells are the ten "sails" Arup counts;
  sizes, leans and spacing are tuned by eye, not taken from drawings.
- Left out: the tile lids (over a million tiles), the glass walls, the
  post-tensioning cables, the cost overrun, and Utzon's 1966 resignation.
