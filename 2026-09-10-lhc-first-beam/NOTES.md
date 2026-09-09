# lhc-first-beam — notes

## Why this project?

Today is **September 10, 2026** — the 18th anniversary of **LHC First Beam Day** (10 September 2008).

On the morning of 10 September 2008, inside the CERN Control Centre (CCC) in Prévessin, France, hundreds of physicists and engineers gathered around projector screens. At 09:30 CEST, a single bunch of protons at 450 GeV was kicked out of the Super Proton Synchrotron (SPS) and steered down transfer line TI2 into Point 2 of the 26,659-meter underground LHC ring.

Rather than letting the beam fly blindly around the ring, the team threaded it sector by sector. At the end of each sector, a fluorescent screen (a cerium-doped YAG crystal) was swung into the vacuum chamber. The beam slammed into the screen, fluorescing a bright circular flash on camera monitors, allowing operators to measure the beam centroid and adjust corrector dipole steering magnets before retracting the screen and permitting the beam into the next sector.

At **10:28 CEST**, project leader Lyn Evans watched as the beam made its final leap through Sector 1-2, completing a full 26.66 km circuit and returning to Point 2. Two bright dots appeared side-by-side on the instrumentation screen: turn one and turn two. Lyn Evans announced: *"We have a beam!"*

Building an interactive studio for this moment was irresistible: it brings together closed-form special relativity ($\beta = 0.999999991$), cryogenics colder than deep space (1.9 K superfluid He-II), RF bucket longitudinal phase stability (Veksler-McMillan), and authentic CERN control room instrumentation.

## How it works

The project is built around four interlocking closed-form physical models:

### 1. Relativistic Kinematics and Bending Field

For a proton with rest mass $m_p = 0.938272 \text{ GeV}/c^2$ and total energy $E$:

$$\gamma = \frac{E}{m_p c^2}, \quad \beta = \sqrt{1 - \frac{1}{\gamma^2}}, \quad p = \sqrt{E^2 - m_p^2 c^4}$$

At 450 GeV injection: $\gamma \approx 479.61$, $\beta \approx 0.99999782$.
At 7000 GeV design top energy: $\gamma \approx 7460.52$, $\beta \approx 0.999999991$. The proton lags behind a photon by a mere:

$$c - v \approx \frac{c}{2\gamma^2} \approx 2.69 \text{ m/s}$$

The ring has 1,232 twin-aperture dipole magnets of effective magnetic length 14.3 m each ($L_{bend} = 17,617.6 \text{ m}$), giving an exact magnetic bending radius $\rho = 2803.93 \text{ m}$. The required bending field is:

$$B [T] = \frac{p [\text{GeV}/c]}{0.299792458 \times \rho [\text{m}]}$$

At 450 GeV: $B = 0.5353$ T, coil current $I = 761.8$ A.
At 7.0 TeV: $B = 8.3274$ T, coil current $I = 11,850$ A.

### 2. Superfluid Helium II at 1.9 K

Nb-Ti superconducting alloy has an upper critical field $B_{c2}(T) \approx B_{c2}(0)[1 - (T/T_c)^2]$. At the atmospheric boiling point of liquid helium (4.2 K), $B_{c2} \approx 11.5$ T, but the critical current density at 8.33 T collapses to near zero.

To sustain 11,850 Amperes in 8.33 T with an engineering safety margin, CERN pumped liquid helium down to $1.9$ K (below the lambda transition $T_\lambda = 2.17$ K). In this superfluid He-II state, thermal conductivity increases by a factor of $10^5$, and $B_{c2}$ rises to $13.88$ T, leaving a safe 5.5 T operating buffer.

### 3. Longitudinal Phase Space & Veksler-McMillan Phase Stability

The RF cavities run at $f_{RF} = 400.789$ MHz with harmonic number $h = 35,640$. The momentum compaction factor is $\alpha_c = 3.22 \times 10^{-4}$, corresponding to transition gamma $\gamma_{tr} \approx 55.7$.

Since $\gamma \ge 480 \gg \gamma_{tr}$, the phase slip factor:

$$\eta = \alpha_c - \frac{1}{\gamma^2} \approx 3.18 \times 10^{-4} > 0$$

Because $\eta > 0$ (above transition), a proton with higher energy travels on an outer trajectory with a longer revolution period—it arrives *later* at the RF cavity. Therefore, synchronous phase stability occurs on the falling slope of the RF wave: a late-arriving proton sees lower voltage and is decelerated back toward the synchronous energy.

The half-height of the stable RF bucket in relative energy deviation is:

$$\left(\frac{\Delta E}{E}\right)_{bucket} = \beta \sqrt{\frac{2 e V_{RF}}{\pi \beta^2 E h \eta}}$$

At 450 GeV with $V_{RF} = 6$ MV, the bucket half-height is $\pm 387$ MeV. At 7 TeV with $V_{RF} = 16$ MV, it reaches $\pm 2.49$ GeV. The studio runs symplectic turn-by-turn tracking for 150 particles inside the bucket, reproducing libration and phase filamentation.

### 4. Luminosity & Stored Beam Energy

The peak luminosity for $N_b = 1.15 \times 10^{11}$ protons/bunch, $n_b = 2808$ bunches, and beam size $\sigma^* = 16.6 \ \mu\text{m}$ is:

$$\mathcal{L} = \frac{n_b N_b^2 f_{rev}}{4\pi (\sigma^*)^2} \frac{1}{\sqrt{1 + \left(\frac{\theta_c \sigma_z}{2\sigma^*}\right)^2}} = 1.012 \times 10^{34} \text{ cm}^{-2}\text{s}^{-1}$$

Total stored energy in each beam:

$$E_{stored} = 2808 \times 1.15 \times 10^{11} \times 7 \times 10^{12} \times 1.602 \times 10^{-19} = 362.1 \text{ MJ}$$

Equivalent to 87 kg of TNT or a French TGV train travelling at 150 km/h, concentrated in a beam narrower than a human hair.

## Interesting notes

- **The twin dots of 10:28.** The moment that triggered global applause was not a complex graph, but two green fuzzy circles on a black-and-white video monitor. Turn 1 hit the phosphor; turn 2 hit the phosphor alongside it because the closed orbit had a tiny residual horizontal dispersion. In the studio, completing the 8th sector triggers this exact dual-spot display.
- **The Piwinski crossing angle reduction.** Standard intro textbook luminosity ignores crossing angle and assumes head-on collision ($\mathcal{L} \approx 1.2 \times 10^{34}$). But at 25 ns bunch spacing, bunches would collide parasitically 30 times in the common beam pipe unless crossed at an angle ($\theta_c = 285 \ \mu\text{rad}$). The geometric reduction factor $F \approx 0.839$ cuts luminosity by 16%, neatly pinned down in `test_physics.mjs`.
- **The 9-day tragedy of 19 September 2008.** Just nine days after the triumphant first beam, during high-current powering tests of dipole circuit 3-4 to 5.1 TeV without beam, a resistive splice with ~220 n$\Omega$ resistance overheated, melted, and formed an electrical arc that pierced the helium enclosure. 6 tonnes of liquid helium vaporized violently, displacing 53 magnets and requiring 14 months of repair. The milestone timeline includes this sobering reminder of the razor-thin margins in cryogenic superconducting engineering.
- **Harmonic factorization.** $h = 35,640 = 2^3 \times 3^4 \times 5 \times 11$. This rich prime factorization allows CERN's RF systems to interleave bunch patterns with spacings of 25 ns, 50 ns, 75 ns, or 100 ns while preserving phase synchrony across all booster rings (PSB $\to$ PS $\to$ SPS $\to$ LHC).
