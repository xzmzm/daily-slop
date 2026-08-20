# Notes: 1888 Burroughs Adding Machine Studio

## Why This Project?

On **August 21, 1888**, American inventor **William Seward Burroughs** received U.S. Patent No. **388,116** for his Calculating Machine (along with patents 388,117 through 388,119). It marks one of the most consequential milestones in the history of computing: the creation of the first reliable, commercially viable mechanical adding and printing ("listing") machine.

Before Burroughs, the world ran on manual bookkeeping. Bank clerks and accountants worked grueling 12- to 14-hour days in dim gaslight, visually summing columns of multi-digit numbers in enormous bound paper ledgers. A single arithmetic error on page 42 meant recalculating thousands of transactions from scratch. Burroughs himself was a clerk at the Cayuga County National Bank in Auburn, New York, until the physical exhaustion, chronic eye strain, and onset of tuberculosis forced him to resign in his twenties.

Moving to St. Louis to work in a machine shop, Burroughs dedicated his remaining life to inventing a machine that would compute infallible sums and print an indelible paper audit tape.

While key-driven adders like Felt's Comptometer existed, early machines suffered from a fatal mechanical flaw: **human operator variance**. When a nervous or hurried clerk yanked the operating handle violently, the kinetic energy caused gear teeth to skip past their stops ("momentum overthrow" or gear shock), silently corrupting bank accounts. Burroughs solved this with pure physics: the **hydraulic oil dashpot**.

This project celebrates the 1888 patent anniversary by building a fully interactive, mechanical cutaway simulator of the Burroughs machine, complete with the differential stop racks, the tens-carry ripple, the oil dashpot fluid dynamics, the reverse-mesh downstroke register zeroing, and procedural audio.

---

## How It Works

### 1. The Full-Keyboard Matrix & Differential Stop Pins

Unlike modern electronic calculators with a 10-key numeric keypad that feeds numbers sequentially into an electronic shift register, the Burroughs machine used a **full matrix keyboard**: 9 columns $\times$ 9 rows = 81 key positions.

Underneath each column sits a vertical bank of stop pins. When key $k \in \{1, \dots, 9\}$ is pressed:
- A steel latch plate snaps into a notch on the key stem, locking the key down.
- The bottom of the key stem protrudes downward by a precise offset into the path of that column's **sector rack** (a pivoted brass gear quadrant).
- A mechanical interlock ensures pressing any other key in the same column automatically releases the previously depressed key.

### 2. The Four-Phase Operating Cycle

When the operator pulls the crank handle forward and releases it, the machine executes a synchronized four-phase cycle:

```
[Phase 1: Downstroke]  -->  [Phase 2: Strike & Mesh]  -->  [Phase 3: Damped Return]  -->  [Phase 4: Carry Ripple]
 Sector racks drop           Hammers strike ribbon;         Dashpot governs speed;       Sequential right-to-left
 until hitting stop pins.     Accumulator swings into mesh.  Racks rotate pinions +d.     sweep pawls add +1 to
 Dials remain unmeshed.                                     Passing 9 trips carry latch. primed decades.
```

#### Phase 1: Downstroke (Pull)
- The accumulator pinion cradle is held in the **disengaged** position (out of mesh).
- As the crank is pulled forward, the 9 sector racks pivot downward under spring tension.
- Each rack travels an angle proportional to the pressed key in its column ($0 \le d \le 9$). If no key was pressed, the rack stays at zero.
- The rear tails of the sector levers raise vertical type bars carrying embossed steel numerals (0–9), positioning the exact matching digits in front of the paper platen.

#### Phase 2: Bottom Dead Center (Hammer Strike & Mesh)
- Spring-loaded print hammers are tripped by cam dogs, striking the two-color inked ribbon against the paper tape.
- A toggle cam swings the accumulator pinion cradle **into mesh** with the teeth of the sector racks.

#### Phase 3: Upstroke (Dashpot-Governed Return)
- A heavy return spring pulls the sector racks and crank handle back up to their zero resting positions.
- Because the accumulator pinions are now meshed with the upward-moving racks, each pinion wheel rotates forward by exactly $+d$ teeth!
- When a 10-tooth pinion passes from 9 to 0, an offset cam lug trips a spring-loaded **tens-carry latch** (`carryPrimed[col] = true`).
- The keyboard latch plate shifts, popping the depressed keys back up.

#### Phase 4: Sequential Tens-Carry Ripple
- A rotating carry sweep shaft moves sequentially from right to left (units $\to$ tens $\to$ hundreds $\dots$ $\to$ millions).
- Wherever a carry latch was tripped, a Geneva-style carry pawl nudges the adjacent higher accumulator wheel forward by $+1$ tooth.
- If that $+1$ advances a 9 to a 0, it primes the next decade's carry latch, allowing carry cascades (e.g. $99,999,999 + 1 = 100,000,000$) to ripple cleanly across all 9 columns without torque jams.

---

### 3. The Oil Dashpot Governor (Hydraulic Damping)

Burroughs' most famous patent breakthrough was the **oil dashpot**: a polished metal cylinder filled with castor oil or mineral oil containing a piston with calibrated bleed ports.

In fluid dynamics, viscous damping force resists piston motion proportionally to fluid viscosity $\eta$ and velocity $v$:
$$F_{\text{drag}} = \frac{A^2 \mu}{a} \cdot v$$
where $A$ is the piston surface area, $a$ is the bleed orifice cross-section, and $\mu$ is dynamic viscosity.

Regardless of whether an operator pulled the handle gently or jerked it with immense force, the viscous resistance prevented the gear train from exceeding a safe terminal angular velocity ($\omega \le \omega_{\text{safe}}$).

In our simulator, you can adjust the Dashpot Viscosity slider down to $0\%$. When un-damped, the violent return stroke causes simulated **momentum overthrow**, where gear inertia skips extra teeth and corrupts the register sum—illustrating why early adding machines failed before Burroughs' patent.

---

### 4. Total and Subtotal Register Zeroing Mechanism

How does a purely mechanical machine print the total and clear its memory to zero without an electronic reset wire?

Burroughs invented a brilliant **gear mesh inversion**:
- **Total (`*`):** When the `TOTAL` key is locked down, the cam timing is flipped. The accumulator pinions are meshed **on the downstroke**. As the sector racks drop, they rotate the accumulator wheels *backward* until individual zero-stop lugs hit fixed stop pawls at 0. This arrests each sector rack at the exact number previously stored in the register, driving the type bars to that total and striking the hammer with an asterisk (`*`). Before the upstroke begins, the pinions disengage, leaving the accumulator at `000,000,000`!
- **Subtotal (`◇`):** Same as Total, but the pinions *remain engaged* during the upstroke, rewinding the wheels back to their accumulated sum so the total is printed on paper without clearing the memory.

---

## Interesting Notes & Tuning

- **Procedural Mechanical Audio:** Rather than loading heavy external sound samples, all mechanical sound effects (key clicks, spring release, rack ratcheting, hammer thwack, hydraulic dashpot hiss, and brass overflow bell) are synthesized in real time using the Web Audio API with filtered square waves, noise buffers, and multi-harmonic decays.
- **Inertial Slip Threshold:** In `mechanism.js`, momentum overthrow is triggered when `dashpotViscosity < 0.15` and handle return velocity exceeds 10 rad/s. A random integer slip is applied to higher-velocity columns ($d > 3$), exactly mimicking the physics of 1880s cast-iron gear trains.
- **Paper Tape Aesthetic:** The paper audit roll uses responsive CSS flexbox column reversal with vintage typewriter rendering, allowing full keyboard inputs, subtotal tracking, and instant one-click clipboard copying.
