# The Story Behind Schooner America

## Why this project?

On August 22, 1851 — exactly 175 years ago today — the 101-foot black schooner *America*, representing the young New York Yacht Club, lined up against 14 of the fastest cutters and schooners of the Royal Yacht Squadron for a 53-mile clockwise race around the Isle of Wight for the "£100 Cup".

The British sailing establishment was confident of an easy victory. British yacht design at the time was dogmatically wedded to the centuries-old "Cod's head and mackerel tail" doctrine: a blunt, rounded, full bow with maximum beam situated far forward, tapering gracefully to a narrow stern. Their sails were made of soft, loosely woven flax canvas, which bagged deeply in a breeze.

When *America* crossed the finish line at Cowes 18 minutes ahead of the nearest British competitor (*Aurora*), Queen Victoria, watching from the royal steam yacht *Victoria and Albert*, famously asked her signal master: *"Are the yachts in sight? Which is first?"*

The signal master replied: *"America, May it please Your Majesty."*

*"Which is second?"* asked the Queen.

*"Ah, Your Majesty, there is no second."*

August 22 is also the birthdate of Claude Debussy (1862) and the anniversary of the Lake Nyos limnic eruption (1986). But the 175th anniversary of the race that created the America's Cup — the oldest international trophy in world sport — was an irresistible opportunity to build a rich, mathematically rigorous simulator of 19th-century aero-hydrodynamic naval architecture.

---

## How it works

### 1. Kinematics: True Wind vs Apparent Wind

A sailing vessel never feels the true wind blowing across the water. Because the boat moves forward at velocity $\vec{v}_b$, the sails experience an **apparent wind** vector $\vec{v}_a$:

$$\vec{v}_a = \vec{v}_t - \vec{v}_b$$

In component form, with true wind speed $V_t$, direction $\theta_{tw}$, boat speed $V_b$, and heading $\theta_{hdg}$:

$$v_{a,x} = -V_t \sin\theta_{tw} - V_b \sin\theta_{hdg}$$
$$v_{a,y} = -V_t \cos\theta_{tw} - V_b \cos\theta_{hdg}$$
$$V_a = \sqrt{v_{a,x}^2 + v_{a,y}^2}$$
$$\text{AWA} = \text{atan2}(-v_{a,x}, -v_{a,y}) - \theta_{hdg}$$

As boat speed increases when sailing close-hauled, the apparent wind speed $V_a$ increases while its angle $\beta$ pulls forward toward the bow.

### 2. Aerodynamics: Flat Cotton Duck vs Baggy Flax Canvas

A trimmed sail functions as a thin, cambered airfoil:
- The sail is sheeted at angle $\theta_{sheet}$.
- The aerodynamic angle of attack is $\alpha = |\text{AWA}| - \theta_{sheet}$.
- Total aerodynamic force $\vec{F}_A = \vec{L} + \vec{D}$ decomposes into Lift $\vec{L}$ (perpendicular to apparent wind) and Drag $\vec{D}$ (parallel to apparent wind):

$$L = \frac{1}{2} \rho_{air} V_a^2 A_{sail} C_L(\alpha)$$
$$D = \frac{1}{2} \rho_{air} V_a^2 A_{sail} C_D(\alpha)$$

Resolving into vessel coordinates (forward drive thrust $F_T$ and lateral heeling force $F_H$):

$$F_T = L \sin|\text{AWA}| - D \cos|\text{AWA}|$$
$$F_H = L \cos|\text{AWA}| + D \sin|\text{AWA}|$$

#### Why Sail Cloth Decided the 1851 Race
*   **British Flax Canvas:** Loosely hand-loomed flax stretched unevenly under load, forming a deep bag (high parasite drag $C_{D,0} \approx 0.095$, peak lift-to-drag ratio $L/D \approx 3.8$). This generated massive lateral heeling force $F_H$ and pushed the yacht sideways, limiting close-hauled pointing to $\sim 48^\circ-50^\circ$ off true wind.
*   **American Machine-Woven Cotton Duck Canvas:** Produced in Lowell, Massachusetts, tightly woven cotton canvas held a smooth, flat airfoil shape under heavy wind tension ($C_{D,0} \approx 0.042$, max $L/D \approx 7.5$). *America* could point within $38^\circ$ of the true wind without luffing or stalling, gaining miles on every upwind tack.

### 3. Hydrodynamics: Wave Line Theory vs Cod's Head

Total hull resistance $R_T(V_b)$ consists of three components:

$$R_T(V_b) = R_f(V_b) + R_w(V_b) + R_{ind}(F_H)$$

1.  **Skin Friction $R_f$:** Computed via the ITTC 1957 friction correlation line over wetted surface area $S_{wet}$:
    $$R_f = \frac{1}{2} \rho_{water} V_b^2 S_{wet} C_f, \quad C_f = \frac{0.075}{(\log_{10} Re - 2)^2}$$
2.  **Wave-Making Resistance $R_w$:** Governed by the Froude number $Fr = \frac{V_b}{\sqrt{g L_{wl}}}$.
    - **Cod's Head (British):** Blunt convex bow pushed water aside abruptly, building a large bow wave hump ($C_w \approx 0.0072$) and hitting a steep resistance wall at $Fr > 0.31$.
    - **George Steers' Wave Line (America):** Long, concave hollow entrance waterlines sliced water without building a high bow wave ($C_w \approx 0.0024$), with maximum beam moved aft to 55% of the waterline, postponing the wave resistance rise to $Fr \approx 0.38$.
3.  **Keel Lift & Leeway Induced Drag $R_{ind}$:**
    The hull slips sideways at leeway angle $\lambda = \frac{F_H}{\frac{1}{2} \rho_w V_b^2 A_{keel} C_{L,keel}}$, generating induced drag:
    $$R_{ind} = \frac{F_H^2}{\pi \rho_{water} V_b^2 T_{eff}^2}$$

### 4. Polar Velocity & VMG (Velocity Made Good) Solver

The polar diagram computes the equilibrium speed $V_b(\gamma)$ where thrust balances resistance ($F_T = R_T$) across all true wind angles $\gamma \in [0^\circ, 180^\circ]$.

Upwind VMG (progress directly toward the wind destination) is:

$$\text{VMG}_{upwind} = V_b(\gamma) \cos\gamma$$

The mathematical optimum tacking angle $\gamma_{opt}$ occurs where the line tangent to the polar curve is horizontal. For *America*, peak upwind VMG occurs at $\gamma_{opt} \approx 41^\circ$ (VMG $\approx 8.0$ kts in 14-kt wind), whereas *Aurora* achieves peak VMG only at $\gamma_{opt} \approx 49^\circ$ (VMG $\approx 5.1$ kts).

---

## Interesting notes

- **The Division of Zero Induced Drag at Zero Speed:** During early numerical integration testing, setting $V_b \to 0$ caused the theoretical induced drag equation $\frac{F_H^2}{\pi \rho V_b^2 T^2}$ to divide by zero and produce $99,500\text{ N}$ of resistance, preventing the boat from accelerating from rest. In physical hydrodynamics, a stalled foil at zero speed sheds no trailing vortex sheet and generates no induced drag; the vessel simply drifts sideways. Adding a smooth low-speed transition factor $(1 - e^{-V_b / 0.6})$ resolved the singularity cleanly.
- **Raked Masts ($14^\circ$ Rake):** *America*'s masts had a distinctive backward rake of over $14^\circ$. While 19th-century sailors debated the aerodynamics, modern wind tunnel studies show that mast rake on schooners promotes spanwise flow and delays tip stall on gaff rigs.
- **Queen Victoria's Steam Yacht:** When *America* passed the royal yacht, Commodore John Cox Stevens ordered the crew to lower the sails in salute and remove their hats. Queen Victoria bowed in return.
- **100% Procedural Audio:** All audio in this simulation (sea spray white noise, rigging resonance whistling, sail flutter snaps, and timber creaks) is generated via the Web Audio API without any audio sample downloads.
