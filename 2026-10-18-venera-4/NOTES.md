# Last Reading — build notes

## Why this project?

Today is 18 October 2026. On 18 October 1967 Venera 4 became the first probe to
send readings from inside another planet's atmosphere, and its last reading was
22 atm. The Soviet announcement said the capsule had reached the surface; Mariner 5
flew past the next day and its radio occultation said otherwise. That dispute is
a clean little inference problem: what exactly was known, and what was only assumed?
Other candidates were the first TR-1 transistor radio (too close to earlier radio
days) and the Mason–Dixon line.

## How it works

Treat the atmosphere as ideal CO₂ in hydrostatic balance. Then dz = −(R/μg)·T·dlnP,
so the height difference between any two readings follows from the temperature
profile alone. I fit T ∝ P^κ through the two ends of the run (0.75 atm, 325 K and
22 atm, 535 K), giving κ ≈ 0.148, and integrate: the whole run spans ≈ 30.7 km.
Only one unknown is left — `h`, the height of the last reading above the ground.

Two outside clues each fix `h` on their own:

- Altimeter: 26 km at the start of the descent → h ≈ −5 km (impossible, so the probe
  "landed").
- Mariner 5 + radar radius: 0.72 atm sits 58 km above the surface → h ≈ 27 km.

They disagree by ~32 km, which is just the size of the radar's periodic-FM
ambiguity (30–40 km). With that fold allowed, the altimeter says 58 km and both
clues land on h ≈ 27 km. Ground pressure/temperature come from continuing the same
law downward by `h`. A clock maps the replay: fall speed ∝ ρ^−½ with ρ ∝ P^(1−κ),
normalised to 93 minutes.

## Interesting notes

- The toy extrapolates to ~164 atm and ~446 °C at the ground, versus the accepted
  92 atm / 464 °C. That is the same direction as NASA's finding that Venera's gauges
  read ~28% high, so I left it visible instead of tuning it away.
- The first draft used fixed altitude bins; switching to "height relative to the
  silent point" made the whole puzzle one formula and one slider.
- Left out: the real telemetry samples, the 18–20 atm design rating as a hard crush
  rule, and Venera 5/6 follow-ups.
- Sources are secondary summaries; numbers (26 km, 58 km, 93 min) are rounded.
