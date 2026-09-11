# NOTES: Kilby's Germanium Bar (1958)

## Why this project?

Of all the anniversaries available for 12 September — Kennedy's Rice speech (1962), Mae Jemison on STS-47 (1992), Voyager 1's interstellar confirmation (2013) — the one with the least interactive-exploration-to-importance ratio is 12 September 1958: the day Jack Kilby, a Texas Instruments employee so new he had no accrued vacation and spent the company-wide July shutdown alone in the lab, demonstrated the first working integrated circuit. The circuit was a phase-shift oscillator built on one germanium bar measuring 7/16 × 1/16 inch; because TI could not yet fabricate interconnects, its parts were connected by hand-soldered gold flying wires. When Kilby pressed the switch, the oscilloscope showed a continuous sine wave in front of Mark Shepherd and Willis Adcock. The problem it answered was already famous as "the tyranny of numbers": every added component added solder joints, wires, board area, and failure sites, so useful complexity was drowning in assembly.

Nothing in the previous fifty daily builds touches semiconductors, and the oscillator at the heart of the story has a closed-form theory (Barkhausen, Routh–Hurwitz, describing functions) that an interactive can actually compute rather than decorate with. So: four machines — the assembly arithmetic, the bar physics, the live oscillator, and the scaling story.

## How it works

### The oscillator's exact theory
The feedback network is three cascaded RC sections (series C, shunt R). Nodal analysis of the unbuffered cascade, with x = sRC, gives

$$\beta(x) = \frac{V_3}{V_o} = \frac{x^3}{x^3 + 6x^2 + 5x + 1}$$

β is real and negative exactly when the denominator is purely imaginary: 1 − 6y² = 0 at x = jy, so ω·RC = 1/√6, and there β = −1/29. Closing the loop through an inverting amplifier of gain −K gives the cubic

$$(1+K)x^3 + 6x^2 + 5x + 1 = 0$$

and Routh–Hurwitz for a cubic (a₃s³+a₂s²+a₁s+a₀ = 0 oscillates when a₂a₁ = a₃a₀) lands exactly on 6·5 = (1+K)·1, i.e. **K = 29** with the pole pair at ±j/√6. Three independent tests confirm the same boundary: the β evaluation, the root factorization at K = 29 — the cubic factors as (30x + 6)(x² + 1/6) with the decaying root at exactly −1/5 — and the time-domain simulation's growth sign flipping between K = 28.999 and K = 29.001.

### The simulation
The live scope is not a mock-up. The three RC sections are integrated in true state space over the series-capacitor voltages; KVL around the C–R mesh gives a constant tridiagonal system whose open-loop pole polynomial is exactly x³ + 6x² + 5x + 1 (verified by hand and by the decay/growth tests). The amplifier is instantaneous: substituting vo = −K·clip(v₃) and P = p₁+p₂+p₃ into the algebraic loop makes the amplifier solvable in closed piecewise-linear form (the hard clip keeps the loop monotonic, so exactly one solution exists for every P — no Newton, no branch tracking). RK4 integrates the ladder; the scope shows the last six periods, which makes it effectively triggered: the sine looks stationary while its envelope grows at the dominant-root rate σ, which the readout compares against theory.

Two honest deviations from idealized textbook behavior are visible and asserted: while growing, the oscillation runs a few percent below f₀ (the dominant root's imaginary part pulls down as K rises — 58 Hz measured vs 63 Hz theory at K = 35 mid-growth, converging to ~61–62 Hz as the amplitude settles), and the settled amplitude obeys the classic hard-clip describing function N = (2/π)(arcsin v + v√(1−v²)), which carries its textbook ~10–20 % error because the ladder passes the third harmonic at |β| ≈ 0.2.

### The tyranny arithmetic
One RTL-style gate costs 3 transistors + 4 resistors + 1 capacitor = 8 parts, 2 joints per part, 1 wire per part; series reliability gives MTBF = 1/(N·λ + J·λ_joint). The ENIAC anchor (17,468 tubes, roughly one failure every two days → λ ≈ 1.19 × 10⁻⁶/h per tube) calibrates the failure rates to period-plausible values. Monolithic mode sizes packages from a log-linear interpolation of real chip-complexity landmarks; the Apollo preset (5,600 gates ≈ 2,800 dual-NOR chips) shows the honest scale of the win rather than a marketing one: ~33× fewer solder joints in 1966, and every internal connection moved into a process step.

### The bar physics
Resistors are the bar itself: R = ρL/A with the neck geometry live. The capacitor is a reverse-biased abrupt junction: W = √(2ε(V_bi+V_R)/qN_d), C = εA/W, with germanium's ε_r = 16. The derived R and C feed f₀ = 1/(2πRC√6) directly, and the button ships them into the oscillator (clamped to its slider ranges).

## Interesting notes — dead ends included

- **The simulator was rewritten three times.** Version 1 integrated the closed-loop cubic directly with a gain that folded with amplitude — it oscillated, but the "amplitude prediction" was a guess, not a derivable law. Version 2 used a true nodal state space with an amplifier pole — and exploded: the pole state sees the loop gain multiplier, so its fast eigenvalue is ~(1+K)/τ_a and explicit RK4 goes unstable (the waveform hit 10⁴⁸ within 24 samples). The fix was to delete the pole and solve the amplifier algebraically. Lesson: the DAE was index-1 all along, and the "physical bandwidth" I added for realism was the one unphysical thing in the system.
- **A non-monotonic soft clip turns the algebraic loop bistable.** Version 2's f(x) = x/(1+(x/V)²) folds back for |x| > V, so the instantaneous loop equation has three real roots; tracking "nearest to previous" jumped branches and the circuit went chaotic (v₃ swinging ±69 V on a ±5 V clip). A hard clip is monotonic — unique solution, closed-form describing function, and the classic textbook formulas fall out. Sometimes the textbook chose the nonlinearity for good reasons.
- **The describing function's error is honest and worth showing.** At K = 45 the predicted fundamental is 9.4 V and the simulation settles at 6.8 V (−28 %). The filter hypothesis behind DF assumes the loop kills harmonics; this ladder passes the third at 20 %. The tests pin the exact identities (gain 29, β = −1/29, ω₀ = 1/√6, growth rate) at 10⁻⁹ and only the amplitude law at DF-realistic tolerance, and the UI shows measured-vs-theory side by side rather than hiding the difference.
- **Routh–Hurwitz as a three-line proof of "29"** was the moment the project felt worth building: the minimum-gain number every electronics student memorizes falls out of 6·5 = (1+K)·1, and the cubic's decaying root at exactly −1/5 at the boundary is a lovely free fact the factorization hands you.
- **Fact discipline.** Wikipedia confirms the date, the germanium, the oscilloscope sine wave, gold-wire interconnects, "tyranny of numbers," Shepherd's presence, and the patent dates (Kilby filed 6 Feb 1959, US 3,138,743; Noyce's Fairchild patent issued 25 Apr 1961 on Hoerni's planar oxide). The phase-shift-oscillator identification and the 7/16 × 1/16 in dimensions are the standard account in IC histories but weren't on the pages I could fetch today, so the app presents them without inventing precision — notably, no oscillation frequency is claimed anywhere, because the sources I could reach don't state one. The Moore anchors are real chip counts (4004: 2,300; M3 Max: 92 B; Cerebras-class: 4 T) and the doubling-time arithmetic is exact on top of them.
- **One number I got wrong first:** I claimed the monolithic Apollo-equivalent would kill "two orders of magnitude" of solder joints; the model says 33×. In 1966 a chip held ~116 transistors by the curve, so 14-pin packages still needed plenty of pins. The test now asserts the honest ratio — the tyranny wasn't killed by packaging density alone, but by moving connections *inside* the process, which is exactly Kilby's idea.
