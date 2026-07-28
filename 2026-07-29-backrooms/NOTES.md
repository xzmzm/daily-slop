# NOTES — backrooms (2026-07-29)

## Why this project?

Three days ago (2026-07-26) ScienceDaily published an explainer on the
Backrooms — how one eerie 2019 photo of empty yellow office rooms became a
vast crowd-built fictional world that "feels disturbingly real." Peak
liminal-space zeitgeist, and *inherently procedural*: the whole fiction is
built on "600 million square miles of randomly segmented empty rooms."

Other candidates from the morning's scout: the Aug 12–13 Perseids peak
(moonless this year, big in the skywatching press) and the Lake Malawi
fly larvae that commute 200 m vertically every day on internal air sacs.
The Perseids felt too close to shade-seeker's astronomy-geometry territory,
and the larvae sim was harder to make *readable* in an hour. The Backrooms
won on: zeitgeist, a renderer I'd never built in this series (first-person
raycasting), and the first use of audio in the whole collection.

## How it works

**Renderer — Wolfenstein-style raycasting, plain canvas 2D, no WebGL.**
Internal resolution 320×180, upscaled with `image-rendering: pixelated`
(the chunky pixels are an aesthetic feature, not a limitation). Per column,
a DDA walk through the grid finds the first wall; wall height = `H /
perpendicular distance`. Walls are drawn as 1-px-wide `drawImage` slices
from a 64×64 wallpaper texture, then shaded with a black rect whose alpha
grows with distance (the fog).

**Floor & ceiling — per-pixel casting.** For each screen row, compute the
row's world distance, then step across the row sampling a 64×64 texture
(carpet speckle below, ceiling tile above). Ceiling cells are per-cell
random: ~45% have no light panel, a few percent are *dead* panels (very
eerie at distance), the rest glow. That one hash — `cellLight(cx, cy)` —
does more for the mood than anything else in the file.

**Infinite floorplan — hashed value noise.** `hash2(x, y)` is an
integer-mix hash (Math.imul, no trig — deterministic across machines and
across visits). Smooth value noise at 1/3-cell scale, thresholded at 0.60,
gives blobby wall clusters: big open areas broken by wall chunks and
pillar runs, exactly the open-plan-office feel. The map is never stored;
any cell's wall-ness is recomputed on demand, so the world is infinite and
every visit sees the same rooms. Each level adds a large constant offset
to the noise coordinates, so descending generates a fresh (but equally
endless) floor.

**Doors** are rare cells (`hash < 0.0016`, ≈1 in 625) that rays treat as
solid black but walking treats as floor. Entering one fades to black,
increments the level, shifts the palette (yellow → sickly olive, fog
closes in), drops the hum a semitone-ish (×0.93 per level), and respawns
you in an open cell.

**The hum** is Web Audio: 110 Hz sine + a quieter octave + a 55 Hz
sawtooth through a 240 Hz lowpass (the "ballast buzz"), plus looped
filtered noise as room tone. A flicker state machine (idle 2–7 s, then a
0.15–0.75 s burst of random brightness) drives both the light-panel
brightness *and* the hum gain, so the buzz audibly stutters with the
lights. Deeper levels flicker more often.

## Interesting notes

- **The rAF red herring.** Half the browser verification session was spent
  "fixing" keyboard input that turned out to be fine: opencli's background
  Chrome window is positioned off-screen, so macOS Chrome occludes it and
  throttles `requestAnimationFrame` to ~1 fps. Mouse-drag turning *did*
  work (it mutates the angle in the event handler, and CDP screenshots
  force a compositor frame), which made the failure look exactly like
  "keydown listener broken." Moving the window on-screen instantly gave
  61 fps and everything worked. Lesson: when input seems dead in an
  automated browser, measure `raf_per_sec` before touching the code.
- **Spawning nose-first into a wall.** First screenshots had the player
  staring at wallpaper 40 cm away. Fix: `mostOpenAngle()` casts 8 rays at
  spawn and faces the longest one. Cheap, big first-impression win.
- Wallpaper texture is 100% procedural: base yellow, 8 px stripes at low
  alpha, a diamond motif grid, 260 random grime speckles, and a dark
  baseboard strip. The baseboard matters more than expected — without it
  walls and carpet smear into one mass at distance.
- `meters` counts *intended* distance, not actual — walking into a wall
  still racks up meters. Left in: the backrooms lying to you about how far
  you've walked feels on-theme.
- Deliberately out of scope: entities (obviously), sprint/stamina, minimap
  (a map is the opposite of liminal), pointer-lock FPS controls (drag-turn
  is enough for a stroll).

Source of the idea: ScienceDaily, "How the Backrooms became the internet's
eeriest shared world" (2026-07-26), via the morning's web scout.
