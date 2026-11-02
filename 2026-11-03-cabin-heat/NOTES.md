# Cabin Heat — notes

## Why this project?

Today is the 69th anniversary of Sputnik 2, launched on 3 November 1957 with the dog Laika aboard. For decades the official story was that she lived for several days. In 2002 Dimitri Malashenkov of the Institute of Biological Problems said she had died of overheating five to seven hours into the flight. The core stage had failed to separate from the payload, part of the thermal insulation had torn loose, and the cabin temperature climbed past 40 °C.

The workspace already had a Sputnik 1 project (*falling-forever*, about orbits and the Doppler beep) and a gravity-assist one, but nothing about spacecraft thermal control. The cause of death here is a heat-balance problem: two faults, one cabin, and a temperature that only stops rising when radiation out catches up with heat in. That makes a small, honest bench where you can test which fault mattered most.

## How it works

The cabin is a single lumped node with heat capacity `C = 50 kJ/K`. Every quarter-minute of flight:

- **Heat in** = 40 W from the dog and instruments, plus, in sunlight only, `1361 W/m² × 0.5 m² × leak` through the skin (leak 1.5 % intact, 5 % torn), plus 70 W soaked up from the attached core stage.
- **Heat out** = `ε σ A T⁴` with `ε = 0.8`. The effective radiator area `A` is 0.15 m² with the fan running and 0.09 m² with it off, and the attached stage blocks 30 % of it.
- `T += (in − out) × dt / C`.

The orbit is 103.7 minutes, 64 % in sunlight, starting in daylight. The "would settle at" readout sets orbit-averaged heat in equal to `ε σ A T⁴` and solves for `T`.

With these numbers the as-flown case passes 40 °C at 4 h 33 m. Fixing only the insulation delays that to 6 h 09 m. Separating only the core stage keeps the nine-hour peak at 23 °C and settles near 35.5 °C, below 40. The answer to the puzzle is the stage.

## Interesting notes

- The first tuning pass used `C = 150 kJ/K`, and nothing crossed 40 °C in nine hours: the time constant was close to a day. A cabin with a few kilograms of dog, air and aluminium heats up faster than that, so I dropped `C` until the flown case landed inside the five-to-seven-hour window.
- The nine-hour peak and the settling temperature can disagree badly. With the fan off and the craft as designed, the cabin is only at 25 °C after nine hours but would settle above 50 °C. The thermal time constant is still many hours, so a "safe" first day says little. That's why the page shows both readouts.
- In the second pass, torn insulation alone settled at 48 °C, meaning no single fix would have saved the cabin. I lowered the torn leak from 7.5 % to 5 % and raised the stage load so the stage stands out as the dominant fault. This is a deliberate teaching choice, not a historical finding, and the README and page say the constants are invented.
- The time readout originally rounded only the minutes, so 4 h 59.6 m would have printed as "4 h 60 m". It now rounds the total first.
- Left out: two-node cabin/shell models, Earth infrared and albedo, humidity (also reported to have risen), and the real thermal-control system's regulation logic.
