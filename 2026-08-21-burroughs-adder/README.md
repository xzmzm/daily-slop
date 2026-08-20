# 1888 Burroughs Adding Machine Studio

Built by Gemini 3.7 Flash

An authentic interactive mechanical simulator and cutaway X-ray studio of William Seward Burroughs' landmark **Calculating Machine** (U.S. Patent No. 388,116, granted **August 21, 1888**).

Experience the tactile mechanical computing revolution that liberated 19th-century bank clerks from 14-hour days of manual ledger calculations. Explore the full 81-key matrix, the differential stop racks, the spring-loaded tens-carry ripple, the reverse-mesh downstroke register clearing mechanism, and Burroughs' crowning invention: the hydraulic oil dashpot governor that prevented gear overthrow.

---

## Features

- **Interactive 1888 Burroughs Console:**
  - Full 9-column $\times$ 9-row key matrix with Victorian celluloid keycaps color-banded for currency denominations (Millions, Thousands, Units).
  - Recessed 9-dial brass accumulator register with magnifier reading lenses.
  - Cast-iron operating crank handle with mahogany grip (draggable or hotkey-triggered).
  - Authentic function controls: `TOTAL (*)` , `SUBTOTAL (◇)` , `NON-ADD (#)` , `REPEAT (R)` , `CLEAR (C)`.
  - Continuous printed paper audit tape feeding out of the rear platen with tear-off and copy actions.

- **Real-Time Mechanical Cutaway (X-Ray View):**
  - High-precision 60fps dynamic 2D canvas showing the side cross-section of all moving parts.
  - Stepped key stop pins, swinging sector rack quadrant, rocker cradle pinion mesh, tens-carry trip latch, Geneva-style carry sweep cam, and spring print hammer.
  - Column inspection selector to view any decimal column from units to hundreds of millions.
  - Visual fluid dynamics simulation of the oil dashpot cylinder with moving piston, bypass bleed ports, and fluid particles.

- **Dashpot Overthrow Physics Lab:**
  - Adjust oil dashpot viscosity from 100% (patent specification) down to 0% (un-damped).
  - Experience the historic "momentum overthrow" glitch where pulling the handle without damping causes inertia to skip gear teeth and introduce calculation errors.

- **Procedural Web Audio Sound Engine:**
  - 100% synthesized cast-iron key clicks, metallic rack ratcheting, hammer typewriter impacts, dashpot hydraulic whoosh, and brass overflow bell chimes.

- **Guided Historic Scenarios:**
  - *Tens-Carry Cascade:* Watch $99,999,999 + 1$ ripple across all 9 columns in slow motion.
  - *Repeat Multiplication:* Perform $425 \times 4$ using the 1888 Repeat lever.
  - *Dashpot Failure:* Witness mechanical momentum overthrow.
  - *1888 Bank Ledger Audit:* Balance a multi-item banking ledger column with subtotal and grand total.

---

## How to Run

No build step or dependencies required. Open directly in any modern browser:

```bash
# Option 1: Open directly
open index.html

# Option 2: Serve locally
python3 -m http.server 8765
```

Then navigate to <http://localhost:8765/2026-08-21-burroughs-adder/> in your web browser. (Note: Port 8000 is reserved).

---

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` / `Enter` | Pull Operating Crank Handle |
| `1` – `9` | Type digits in quick input or click keyboard matrix |
| `T` | Toggle Total (`*`) |
| `S` | Toggle Subtotal (`◇`) |
| `R` | Toggle Repeat Lever (`R`) |
| `C` | Clear / Error (pop up depressed keys) |
