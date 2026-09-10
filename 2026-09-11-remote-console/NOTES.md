# NOTES: Stibitz Remote Console (1940)

## Why this project?

On the morning of September 11, 1940, at the joint summer meeting of the American Mathematical Society (AMS) and the Mathematical Association of America (MAA) in McNutt Hall at Dartmouth College (Hanover, New Hampshire), Dr. George Robert Stibitz did something that had never occurred in human history: he operated a computing machine from 250 miles away.

In the lecture room sat a standard Model 14 Teletype. Through an ordinary leased AT&T telegraph line stretching across New Hampshire, Massachusetts, and Connecticut down to 463 West Street in lower Manhattan, the terminal was connected to the Bell Telephone Laboratories "Complex Number Calculator" (later designated the Model I). In the audience were mathematicians whose names now define 20th-century science: Norbert Wiener, John von Neumann, and Richard Courant.

Stibitz invited members of the audience to walk up to the teletype keyboard and type arbitrary arithmetic expressions involving complex numbers $(a + bi) \times (c + di)$ or $(a + bi) / (c + di)$. The teletype keys clicked, the telegraph loop pulsed, and within seconds the carriage clattered back the exact answer. Norbert Wiener reportedly tested it with difficult AC filter impedances and was astonished by its precision and speed.

This event marks the true birth of remote computing, teleprocessing, terminal networks, and what would eventually become the Internet. Yet outside specialized computing history circles, the mechanical beauty of Stibitz's design—specifically his **Excess-3 (Stibitz code)** and his relay logic—is rarely experienced interactively. This daily project recreates that historic day across four closed-form machines.

## How it works

### 1. The 250-Mile Telegraph Loop & Baudot Serialization
The communication link between Hanover and Manhattan used a 60 mA neutral DC telegraph current loop.
- **Baudot / ITA-2 5-Bit Code**: Each keystroke is translated into a 5-bit character code. Mode shifts (`LTRS` $11111_2$ and `FIGS` $11011_2$) multiplex alphabetic letters and mathematical punctuation/digits onto a 5-bit bus.
- **Serial Pulse Train**: An asynchronous frame consists of:
  - 1 Start Bit (Space = 0 mA / open loop)
  - 5 Data Bits (LSB first)
  - 1.42 Stop Bits (Mark = 60 mA / closed loop)
- **Transmission Physics**: Over 250 miles of No. 19 AWG copper wire, signal propagation occurs at roughly $0.70c$ ($\approx 130,400\text{ miles/s}$), taking $1.92\text{ ms}$. Electromechanical telegraph repeaters at Springfield, Hartford, and New Haven each introduce $\approx 6\text{ ms}$ of armature inertia, giving a round-trip network transit time of $\approx 40\text{ ms}$, followed by character deserialization at 45.45 baud ($22\text{ ms/bit}$, $163\text{ ms/character}$).
- **Line Waveform**: The interactive oscilloscope models line capacitance ($C \approx 0.01\ \mu\text{F/mile}$) and loop resistance ($R \approx 10.5\ \Omega\text{/mile}$), yielding an RC rise/fall time constant $\tau \approx 1.8\text{ ms}$.

### 2. The Excess-3 (XS-3) Theorem
Standard 8421 Binary-Coded Decimal (BCD) had two severe problems for 1930s telephone engineers:
1. **Decimal Subtraction**: Calculating the 9's complement of a digit in standard BCD required multi-stage logic gates or lookup tables.
2. **Wire Fault Detection**: Decimal $0$ was encoded as $0000_2$. If a wire broke or a relay failed to close, the circuit registered $0000_2$, silently corrupting the calculation as a valid zero.

Stibitz devised **Excess-3 code**, where each decimal digit $d \in [0, 9]$ is represented by $d + 3$ in 4-bit binary ($0011_2$ to $1100_2$):
$$\text{XS-3}(d) = d + 3$$

This yields two revolutionary properties:
- **Self-Complementing 9's Complement**: The 9's complement of $d$ is $(9 - d)$. Notice that:
  $$\sim \text{XS-3}(d) = 15 - (d + 3) = (9 - d) + 3 = \text{XS-3}(9 - d)$$
  Bitwise inversion ($\text{NOT}$) of the 4 bits *is* the 9's complement! In relay hardware, Stibitz implemented 9's complement simply by routing current through the normally-closed (NC) contacts instead of the normally-open (NO) contacts—**zero additional arithmetic relays needed for subtraction**.
- **Excess Correction Rules**: Adding two Excess-3 digits yields an Excess-6 sum:
  $$(A + 3) + (B + 3) = A + B + 6$$
  - **If $A + B \ge 10$**: The 4-bit binary adder overflows ($\ge 16$), producing a binary carry out ($C_{out} = 1$). The 4-bit sum register retains $(A + B + 6) - 16 = (A + B) - 10$. To restore the $+3$ Excess-3 bias, the circuit **adds $+3$** ($0011_2$).
  - **If $A + B < 10$**: No binary carry ($C_{out} = 0$). The 4-bit register holds $A + B + 6$. To reduce the $+6$ bias back to $+3$, the circuit **subtracts $3$** (adds $1101_2$ mod 16).

### 3. Complex Number Calculator (Model I) Algebraic Core
The machine was built to evaluate alternating current (AC) network filter impedances, where voltages and currents are complex phasors $Z = R + jX$.
- **Multiplication**:
  $$(X_1 + i Y_1)(X_2 + i Y_2) = (X_1 X_2 - Y_1 Y_2) + i(X_1 Y_2 + X_2 Y_1)$$
  The CNC executed this via four cross-products and two accumulator combinations across 6 sequential relay clock steps.
- **Division**:
  $$\frac{X_1 + i Y_1}{X_2 + i Y_2} = \frac{(X_1 X_2 + Y_1 Y_2) + i(Y_1 X_2 - X_1 Y_2)}{X_2^2 + Y_2^2}$$
  Implemented via repeated subtraction in the relay registers until the accumulator underflowed, stepping the quotient digit wheel.

### 4. The 1937 Kitchen Table "Model K"
In November 1937 at his home in Boonton, New Jersey, Stibitz noticed that telephone relays could replicate George Boole's algebra:
- Sum = $A \oplus B \oplus C_{in}$
- Carry = $(A \cdot B) + (C_{in} \cdot (A \oplus B))$
He wired two Western Electric flat-spring relays with two flashlight bulbs and two strips cut from a metal tobacco tin on his kitchen table. His wife, Dorothea, dubbed it the "Model K" for "Kitchen".

## Interesting notes & engineering insights

- **Zero Overlaps in Teletype Deserialization**: In testing the Baudot deserializer, an early bug allowed multiple keystrokes to collide on the virtual current loop if the user typed faster than 45.45 baud. Real teletypes physically locked the keyboard mechanism during character transmission via a mechanical trip clutch. We simulated this in `app.js` with an async input lock `isTransmitting`.
- **The Self-Complementing Sign Bit**: In Excess-3 decimal subtraction, when $A - B < 0$, the end-around carry is $0$, meaning the result in the register is in 10's complement. The machine could detect the negative sign directly from the final carry relay!
- **Audience Skepticism in 1940**: At Dartmouth, some mathematicians initially suspected that someone was hiding under the table or that the teletype was pre-programmed with canned answers. Stibitz let Norbert Wiener invent arbitrary large complex numbers on the spot; the machine's reliable, clattering responses dispelled all doubt.
- **Why It Took 14 Years for the Next Remote Terminal**: Surprisingly, Bell Labs did not immediately commercialize remote terminals. Military secrecy during World War II redirected Stibitz and Bell Labs to specialized ballistic fire-control computers (Models II, III, and IV for the M-9 gun director). True timesharing and remote telecomputing would not re-emerge on a wide scale until Dartmouth's own John Kemeny and Thomas Kurtz created DTSS (Dartmouth Time-Sharing System) in 1964—in the very same college town where Stibitz had demonstrated it 24 years prior!
