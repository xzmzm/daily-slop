# Iron Lung

On October 12, 1928 a child paralysed by polio was put in Philip Drinker's
iron box in Boston and started breathing again. Run the pump, then keep the
child alive by hand when the power goes.

Built by Claude Opus 5.5

The Drinker respirator seals the body in a tank with the head outside. When
the pump lowers the air pressure in the tank, the chest expands and room air
flows in through the nose and mouth; when the pressure comes back, the lungs
spring back and breathe out. The lab runs that loop on a model eight-year-old
and shows what it does to the blood.

## How to run

Open `index.html` directly, or from the repository root:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765/2026-10-12-iron-lung/](http://localhost:8765/2026-10-12-iron-lung/).
No installation, build step, backend, or network access is needed.

## Using the lab

- The page opens with the motor off. The child's own muscles are at 10%,
  too weak for a breath bigger than the 50 mL of dead space, so CO₂ climbs
  and the face turns blue.
- **Motor on** pulls the tank to −12 cmH₂O twenty times a minute: about
  170 mL a breath, and within a minute the blood gases are back to normal.
- **Pull** (0–30 cmH₂O) sets how far below room pressure each pull goes.
  Pull too hard and CO₂ drops below 30: over-breathed.
- **Pump rate** (8–40 /min). Try 40 /min at −8 cmH₂O: it moves the same
  air per minute as 20 at −12, but each breath is so shallow that most of it
  never gets past the windpipe, and CO₂ climbs.
- **Power cut · by hand**: hold the button or Space for about a second,
  let go, repeat. Stop and the child starts to fail again.
- **The child's own breathing muscles** (0–100%): at full strength the child
  breathes alone at normal CO₂, without the tank.

## Checks

```sh
cd 2026-10-12-iron-lung && node tests.js
```

23 checks: the R·C time constant, the dead-space ventilation formula, the
CO₂ and oxygen curves, the motor and hand-pump rescues, the fast-shallow
trap, over-breathing, and a power cut.

## Model notes

One elastic lung (15 mL/cmH₂O) behind one airway (20 cmH₂O·s/L); the tank
pressure acts on the chest wall, the mouth is at room pressure. Blood CO₂
follows 0.863 × CO₂ production ÷ alveolar ventilation, oxygen follows the
alveolar gas equation and the Severinghaus curve. The blood-gas response is
compressed to a 6 s time constant. Details and dead ends are in [`NOTES.md`](./NOTES.md).
