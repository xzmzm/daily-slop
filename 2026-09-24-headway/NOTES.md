# Headway — September 24, 2026

## Why this project?

On 24 September 1852, Henri Giffard flew the first powered, steerable airship from the hippodrome at Place de l'Étoile to Élancourt: about 27 km in roughly three hours. The ship was 44 m long and held 3,200 m³ of hydrogen. A 3 hp steam engine gave it about 9 km/h at most. The detail that makes this worth a project: he could steer it, but [the engine was not powerful enough to fly back against the wind](https://en.wikipedia.org/wiki/Giffard_dirigible).

That makes a clean lesson. Being able to steer is not the same as being able to go anywhere. If the wind is faster than the ship, some directions are simply closed. Pilots and sailors learn this as the wind triangle. It's a vector sum that looks trivial until you see the reachable region shrink into a cone.

Recent days here have included traffic routing, room acoustics, a Foucault pendulum and a differential. None of them are vector navigation in a moving medium, and no earlier project has an airship or wind drift. A few other 24 September candidates were weaker fits: the 1869 gold panic would need a market model, and the 1960 launch of USS *Enterprise* is a reactor story.

## How it works

Everything is in a flat local frame measured in km, with x pointing east and y north. Bearings are compass degrees. Étoile is the origin. Élancourt (48.784 N, 1.957 E) comes out at (−24.8, −10.0) km: 26.7 km away, on a bearing of 248°, which matches the recorded 27 km well.

- **Wind convention:** "wind from 68°" blows toward 248°. `windVector(from, speed) = vec(from + 180, speed)`.
- **Engine:** propeller and hull drag grow roughly with v², so power grows with v³. Airspeed is `9 × (hp/3)^(1/3)`. Doubling the speed takes eight times the power: 24 hp for 18 km/h.
- **Crab solution:** for a desired course with unit vector **u** and left normal **n**, split the wind into along-track `w∥ = w·u` and cross-track `w⊥ = w·n`. The air vector has to cancel the cross-track part exactly, so its along-track part is `√(Va² − w⊥²)`. Ground speed is that plus `w∥`. No solution means either `|w⊥| > Va` or a ground speed ≤ 0.
- **Reachable cone:** ground velocities form a circle of radius Va centred on the wind vector. If W ≤ Va, the circle contains the origin and every direction can be flown. If W > Va, the tangents from the origin bound a cone around downwind with half-angle `asin(Va/W)`. With 12 km/h of wind and 9 km/h of ship, that is ±48.6°. Home, dead upwind, is 180° away.
- **Auto steering during flight:** re-solve the crab every step (dt = 30 s of flight time). If no solution exists, point the nose straight at the target. That heading maximises the closing rate `(a + w)·u`, so it is the best you can do. It still loses ground, and the ship goes backwards facing home. That is the moment the app is built around.

The wind streaks are particles in km space that drift with the actual wind vector. The canvas backdrop (fields, woods, river, labels) is drawn once from a seeded RNG and reused.

## Interesting notes

- The first map extent cut off just west of Élancourt, so the homeward cone ran straight off the edge and its label was clipped. I shifted the frame 6 km west and 3 km south. Now the cone has somewhere to point, and the drifting ship stays visible for about four and a half hours before it's blown off the map.
- A first draft of the rudder was a red triangle behind the envelope. From above, it read as an arrowhead pointing the *wrong* way. A sail rudder seen from above is just a thin blade, so that's what it is now.
- "Homeward" at 6 km/h of wind is solvable, since 9 > 6, but it takes 8 h 54 m at 3 km/h over the ground. The verdict says it's possible on paper but runs past the 8-hour day. That catches a subtle point: "possible" and "practical" are different thresholds.
- Displayed ETA uses the along-line component of the ground velocity, not ground speed. In manual mode you can go fast in the wrong direction, and ETA correctly says "never".
- None of the presets are reconstructions of the 1852 weather. The historical sources give the distance and duration, not the wind. The outbound preset's 4 km/h tailwind is illustrative.
- For the video, the page exposes `headway.setAutoplay(false)` and `headway.tick(seconds, rate)`. Each recorded frame then advances wind and flight by exactly 1/15 s, whatever the screenshot costs. Without that, the flight's speed would depend on how fast Chromium could take screenshots.
- Left out: altitude, gas loss and ballast, gusts, Earth curvature. The lesson is purely horizontal.
- The video keeps the user's established GLM 五点二 series-host introduction and 哈基米 voice. The project's actual builder is recorded as Claude Opus 5.5.
