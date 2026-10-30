# Ghost Light — notes

## Why this project?

October 31 is Halloween, which was a good excuse to build a tiny haunted
stage. Searching for seasonal science ideas led to Pepper's Ghost: a ghost
that is neither a projection nor a performer standing on stage, but the
reflection of a person the audience cannot see. The gallery already had
experiments with light and mirrors, but not this particular trick of lighting
two spaces to put a transparent person inside a scene.

John Henry Pepper adapted Henry Dircks's idea for the Royal Polytechnic in
London, using an existing pit to conceal the performer. The stage version
appeared in 1862. The [Corning Museum of Glass account](https://blog.cmog.org/2012/ghosts-and-magicand-glass-peppers-ghost-and-glass-optics/)
describes changing the light in the room beneath the stage; the
[Linda Hall Library account](https://www.lindahall.org/about/news/scientist-of-the-day/john-henry-pepper/)
discusses Pepper's adaptation of Dircks's model.

## How it works

The audience looks at scenery through a large, angled sheet of glass. At the
same time, some light from a hidden performer reflects from that sheet into
their eyes. The brain extends that reflected ray backward in a straight line,
placing a virtual image behind the glass, superimposed on the real room. The
cutaway shows this construction: the dashed line is the apparent continuation
of the reflected light, not light travelling from a ghost.

In the side view, the glass is a 45° line, `y = x - 172`. A hidden point at
`(242, 215)` mirrors across that line to `(387, 70)`; the line from the
viewer's eye `(50, 134)` to that virtual point meets the glass at approximately
`(265.15, 93.15)`. The solid paths connect the hidden point, that intersection,
and the eye. The glass needs to be large enough to intercept the path.

The stage is a hand-drawn SVG. The actor-light slider changes the opacity of
the reflection and the ray; the stage-light slider independently changes a
dark overlay on the room. This is a deliberately qualitative illustration:
its percentages are control positions, not measured illumination or glass
reflectance. The presets simply set the two sliders to named lighting cues.

## Interesting notes

- The **wash out** cue is a contrast trick, not the ghost switching off: the
  actor is still lit, but the room is much brighter than the reflection.
- The panes are usually not magical half-silvered mirrors. Ordinary glass
  both transmits and reflects light; lighting and a dark surround keep the
  pane itself inconspicuous.
- The drawing uses a single point and a side view to show the path cleanly.
  Real productions have large panes, sight-line limits, and several possible
  backstage arrangements. The ghost's drawn posture is illustrative rather
  than a physically transformed image of the little figure in the pit.
