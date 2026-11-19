# Cape Measure field notes

## Why November 20

Benoît Mandelbrot was born on 20 November 1924. In 1967 he revisited Lewis Fry Richardson’s coastline measurements, describing how a surveyor could walk a pair of dividers along a map. That suggested a birthday experiment you could check by eye. Pick a bay, watch a long step cross its mouth, then try the same spot with a smaller span. [National Academy of Sciences biography](https://www.nasonline.org/directory-entry/benoit-mandelbrot-mzk3us/) · [Mandelbrot’s paper, page 636](https://venturi.soe.ucsc.edu/sites/default/files/Mandelbrot1967.pdf)

## Drawing an island

I drew the main capes and coves first. A grid records how far each point lies inside or outside that outline. Three scales of seeded noise cut smaller inlets and spits into the shore. Marching squares interpolates the crossings between neighbouring grid samples. The zero contour makes the tide line, with lower contours in the shallows and higher ones inland. The largest zero-contour loop is Wren Island. The little offshore rocks belong to the scenery.

The chart and the dividers share that exact loop. Each walk begins at the same southern point and follows the island clockwise. From the last pin, scan the coast forward until a segment reaches the circle swept by the other divider tip. Solve the line–circle intersection to place the new pin. Continue from that location, even when there is more of the same segment left. When the remaining shore fits inside the circle, add the straight distance back to Gull Point.

## What the long span misses

At a 24 km span the walk takes nine full steps and a 14.9 km closing step, for 230.9 km. The 3 km dividers reach 389.1 km. Turning on the long-span overlay leaves its dashed chords in place across the mouths of the inlets. That made the difference easier to find on the chart than a percentage would have.

The last gap matters. Counting it as another full 24 km step would turn the coarse reading into 240 km. All distances use the unrounded intersections, and the display rounds only the finished values. This particular island has a finite set of vertices, so at sufficiently small spans the reading approaches the length of the underlying polyline.
