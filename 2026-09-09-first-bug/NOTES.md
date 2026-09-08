# Notes on First Bug (1947)

## Why this project?

Today is September 9, 2026 — the 79th anniversary of the discovery of the first physical computer bug on September 9, 1947.

Every programmer uses the words "bug" and "debugging" daily, but few know the exact engineering context. It didn't happen on a silicon microchip or inside a vacuum tube; it happened on the Harvard Mark II (the Aiken Relay Calculator), an electromechanical behemoth constructed from approximately 13,000 telephone-style relays housed in steel racks. Because the laboratory had open windows on hot summer afternoons and no air conditioning, insects were drawn inside by the warm glow of pilot lamps and magnet coils.

At 15:45, an actual 2-inch moth flew into the contacts of Relay #70 on Panel F and got squashed between the silver contact studs. When operator William Burke extracted it with tweezers, Grace Hopper taped the specimen into page 92 of the daily logbook with the entry:
> "1545 Relay #70 Panel F (moth) in relay."
> "First actual case of bug being found."

Building an interactive studio celebrating this exact anniversary lets us explore the physical bridge between mechanical switching and digital logic.

## How it works

### 1. Relay Electromechanics & Magnetic Gap Scaling
The Harvard Mark II ran on 50V DC power supplies. Each relay consists of a solenoid coil wound on an iron core, a pivoted spring-loaded armature, and pairs of silver contacts.
- **Coil Current Transient**:
  $$I(t) = \frac{V}{R} \left(1 - e^{-t / \tau}\right)$$
  With $V = 50\,\text{V}$, $R = 250\,\Omega$, and $L = 1.2\,\text{H}$, the time constant is $\tau = L/R = 4.8\,\text{ms}$, reaching a steady-state current of $I_{\max} = 200\,\text{mA}$.
- **Electromagnetic Tractive Force**:
  $$F_{\text{mag}} = K_{\text{mag}} \left(\frac{I}{g_0 - x}\right)^2$$
  As the armature moves forward ($x$ increases), the air gap narrows from $1.5\,\text{mm}$ to $0.5\,\text{mm}$, causing the tractive force to surge exponentially and snap the armature closed.
- **Return Spring Balance**:
  $$F_{\text{spring}} = F_0 + k \cdot x$$
  With preload $F_0 = 0.35\,\text{N}$ and spring constant $k = 450\,\text{N/m}$.
- **Moth Dielectric Obstruction**:
  Clean silver contacts touch at displacement $x = 1.0\,\text{mm}$, compressing with contact bounce over $\approx 1.2\,\text{ms}$ to achieve $R_{\text{contact}} \approx 0.02\,\Omega$.
  When a moth body (thickness $d_{\text{moth}} \approx 0.38\,\text{mm}$) is trapped between the contacts, mechanical travel is arrested early at $x = 0.62\,\text{mm}$. The silver pads never touch; dry chitin and insect tissue provide dielectric resistance exceeding $10^8\,\Omega$. The circuit remains strictly OPEN.

### 2. Panel F Hardware Dual Checking Circuit
Howard Aiken recognized that electromechanical relays were prone to dust, wear, and mechanical failure. Therefore, the Mark II was designed with extensive hardware verification circuits:
- Two redundant computing channels executed arithmetic simultaneously, or complement arithmetic was verified before advancing to the next cycle.
- In our simulation, Panel F houses the 8-bit accumulator register (Relays 64 to 71).
- Relay #70 controls Bit 6 (weight $2^6 = 64$).
- When calculating $65 + 10 = 75$ ($01001011_2$), bit 6 is expected to be 1. With Relay #70 jammed by the moth, Bit 6 stays 0, resulting in computed value $11$ ($00001011_2$).
- The hardware checking comparator detects discrepancy $|75 - 11| = 64 \neq 0$, tripping the master fault relay, illuminating the Panel F alarm beacon, sounding the electromechanical buzzer, and halting the calculator.

### 3. Contact Networks as Logic Gates
Before transistors or semiconductors, relays performed logic via physical switch topology:
- **AND**: Contacts in series (both coils must pull in).
- **OR**: Contacts in parallel (either coil can complete the circuit).
- **NOT**: Normally-closed (NC) contacts (powering the coil opens the connection).
- **XOR / Changeover**: Form-C transfer switches connecting common to NC at rest and NO when energized.
- **1-Bit Full Adder**: A 6-relay network calculating Sum ($A \oplus B \oplus C_{\text{in}}$) and Carry-out ($AB + C_{\text{in}}(A \oplus B)$) purely through contact continuity.

## Interesting notes

1. **Who actually found the moth?**
   Grace Hopper is universally associated with the story, but the logbook entry was written by William "Bill" Burke, an operator on Aiken's team. Hopper was in the laboratory, loved the incident, and recounted it in interviews and lectures for the next 40 years, cementing it into computing folklore.
2. **Did "bug" originate here?**
   No — Thomas Edison used "bug" in letters to Western Union in 1878 to describe annoying technical faults in quadruplex telegraphs. Theater crews and machinists also used the term in the 19th century. But September 9, 1947, was the first documented time an actual physical insect caused a digital computing failure — hence Hopper's note: *"First actual case of bug being found."*
3. **Where is the moth today?**
   The original logbook with the taped moth was kept by the Naval Surface Warfare Center Dahlgren Division for decades. In 1991, it was presented to the Smithsonian Institution and is now permanently preserved in the National Museum of American History in Washington, D.C.
4. **Tuning the contact bounce**:
   Real relay silver contacts don't just close smoothly; upon mechanical collision, elasticity causes the contacts to bounce 1 to 3 times within 1–2 milliseconds. In early telephone and computing circuits, this contact bounce caused false trigger pulses if not snubbed by RC circuits or latching circuits. We synthesized this in Web Audio API with micro-transients and plotted it on the real-time oscillograph canvas.
