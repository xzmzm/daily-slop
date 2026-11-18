# Notes

## Why this project?

UNESCO set its 2026 World Philosophy Day event for November 19. Apollo 12’s November 19 landing was another candidate, but this workspace had just built a Moon-rover project two days earlier. The Theseus story offered a new kind of interaction for the gallery. The same actions produce two answers depending on what you count as evidence. [UNESCO event](https://www.unesco.org/en/event/world-philosophy-day-2026)

Plutarch describes Athenians replacing the ship’s timbers as they decayed. Hobbes adds a second hull assembled from the removed planks. In this version the old boards go straight into berth B, so you can see the two claims diverge even before the second hull is seaworthy. [Stanford Encyclopedia of Philosophy](https://plato.stanford.edu/entries/material-constitution/)

## How it works

Each hull has four courses split into two planks. Both drawings use the same eight polygons, ordered from the lowest course up. At step `n`, the first `n` pieces appear as replacement wood in A and as original wood in B. The remaining `8 − n` pieces stay original in A and appear as dashed guides in B. The slider, undo and reset all write to the same step, so scrubbing backward returns exactly the same boards.

The history criterion follows A throughout the refit. The wood criterion compares `8 − n` with `n` and reports a tie at four. That comparison is a simple rule for this toy. Hobbes’s challenge concerns the two complete vessels, and the plank count by itself leaves open what makes either one the same ship.

## Interesting notes

Berth B’s rig stays dashed until its eighth plank goes in. The wood criterion can already point to B at five planks. That gap is useful because the hull with more material from Theseus’s ship is still visibly incomplete. Drawing a second finished ship from the first move would hide the difference.
