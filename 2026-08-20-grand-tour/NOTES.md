# Voyager 2 Grand Tour · Notes & Story

Built by Gemini 3.7 Flash · August 20, 2026

## Why this project?

On August 20, 1977, NASA launched **Voyager 2** from Space Launch Complex 41 at Cape Canaveral aboard a Titan IIIE/Centaur rocket.

In the summer of 1965, Gary Flandro, a young doctoral student working at NASA's Jet Propulsion Laboratory (JPL), noticed something extraordinary in planetary ephemeris tables: during the late 1970s, Jupiter, Saturn, Uranus, and Neptune would align on one side of the Sun in a geometric progression that occurs only once every 175.7 years.

Without gravity assist, reaching Neptune directly via a Hohmann transfer would require a 30-to-40-year voyage and a monstrous rocket stage at each planet. But with Flandro's Grand Tour trajectory, each giant planet's gravitational field could be used like a cosmic slingshot, trading a microscopic amount of the planet's orbital momentum for massive spacecraft acceleration. The total flight time from Earth to Neptune was reduced to just 12 years.

Today (August 20, 2026) marks the **49th anniversary** of Voyager 2's launch. Flying over 138 AU (20.7 billion kilometers) from Earth in the interstellar medium, Voyager 2 is still operating and transmitting science data back to the Deep Space Network. Building an accurate, interactive orbital mechanics studio for this milestone was an irresistible choice.

## How it works

### 1. The Physics of Gravity Assist (Patched Conics)

A gravity assist is governed by conservation of energy in the planet's reference frame:

1. **Inbound Asymptotic Velocity:** As the spacecraft enters the planet's gravitational sphere of influence (SOI), its relative velocity is:
   $$\vec{v}_\infty = \vec{v}_{sc, in} - \vec{v}_{planet}$$
2. **Hyperbolic Orbit & Turning Angle:** Within the planet-centric two-body frame, mechanical energy is conserved, meaning the outbound speed equals the inbound speed:
   $$|\vec{v}_\infty'| = |\vec{v}_\infty| = v_\infty$$
   The trajectory forms a hyperbola with eccentricity:
   $$e = 1 + \frac{r_p v_\infty^2}{\mu_p}$$
   where $r_p$ is periapsis (closest approach distance) and $\mu_p = G M_p$ is the planet's gravitational parameter. The asymptotic velocity vector is turned through an angle $\delta$:
   $$\sin(\delta/2) = \frac{1}{e} = \frac{1}{1 + \frac{r_p v_\infty^2}{\mu_p}} \implies \delta = 2 \arcsin\left(\frac{1}{1 + \frac{r_p v_\infty^2}{\mu_p}}\right)$$
3. **Heliocentric Boost via Vector Addition:** Returning to the Sun-centered (heliocentric) frame:
   $$\vec{v}_{sc, out} = \vec{v}_{planet} + \vec{v}_\infty'$$
   $$\Delta \vec{v}_{helio} = \vec{v}_{sc, out} - \vec{v}_{sc, in} = \vec{v}_\infty' - \vec{v}_\infty$$
   Passing *behind* the planet in its orbital direction rotates $\vec{v}_\infty$ forward, adding the planet's orbital velocity $\vec{v}_p$ and transferring kinetic energy:
   $$\Delta \mathcal{E} = \frac{1}{2} v_{sc, out}^2 - \frac{1}{2} v_{sc, in}^2 = \vec{v}_p \cdot \Delta \vec{v}_{helio} > 0$$

### 2. The Solar Escape Velocity Threshold

At distance $r$ from the Sun, the local escape velocity is:
$$v_{esc}(r) = \sqrt{\frac{2 \mu_\odot}{r}}$$
- At Earth (1.0 AU): $v_{esc} \approx 42.12\text{ km/s}$
- At Jupiter (5.2 AU): $v_{esc} \approx 18.46\text{ km/s}$
- At Saturn (9.6 AU): $v_{esc} \approx 13.60\text{ km/s}$
- At Uranus (19.2 AU): $v_{esc} \approx 9.61\text{ km/s}$
- At Neptune (30.0 AU): $v_{esc} \approx 7.68\text{ km/s}$

The mini-chart in the simulator plots $v(r)$ alongside $v_{esc}(r)$, visually demonstrating how each planetary encounter provides a vertical velocity kick that elevates Voyager 2 above the escape velocity curve, ensuring it never returns to the Sun.

### 3. RTG Power Decay & Light Latency

- **Radioisotope Power:** Voyager 2 is powered by three Silicon-Germanium thermocouple RTGs fueled by Plutonium-238 alpha decay ($t_{1/2} = 87.7$ years). Electrical power decays as:
  $$P(t) = P_0 \cdot (0.5)^{t / t_{1/2}} \cdot (1 - \lambda_{SiGe} \cdot t)$$
  From $470\text{ W}$ at launch down to $\sim 228\text{ W}$ in August 2026.
- **Relativistic Light Travel Time:** At $138.5\text{ AU}$, one-way radio latency is:
  $$t_{one-way} = \frac{138.5 \times 1.496 \times 10^8\text{ km}}{299,792.458\text{ km/s}} \approx 69,164\text{ s} \approx 19\text{ hours } 12\text{ minutes}$$

## Interesting notes & war stories

1. **The Voyager 1 vs. Voyager 2 Divergence at Saturn:**
   Voyager 1 reached Saturn in November 1980. Scientists faced a fateful dilemma: aim for Titan to probe its thick nitrogen/hydrocarbon smog atmosphere up close, or preserve the trajectory to Uranus and Neptune. They chose Titan; the close flyby deflected Voyager 1 upwards by $35^\circ$ out of the ecliptic plane, forfeiting the rest of the planets. Voyager 2, arriving 9 months later (August 1981), stayed in the ring plane to keep the corridor open to Uranus and Neptune.

2. **The Neptune Polar Dip & Southern Interstellar Deflection:**
   To visit Neptune's giant retrograde moon Triton (and its active nitrogen cryovolcanoes), Voyager 2 dived just $4,950\text{ km}$ over Neptune's north pole. Neptune's gravity bent Voyager 2's trajectory sharply southwards at a $-48^\circ$ inclination relative to the ecliptic plane, sending it toward the constellation Pavo (the Peacock).

3. **Thermocouple Calibration War Story:**
   When tuning the RTG power equation, initial radioactive decay alone predicted $\sim 319\text{ W}$ remaining in 2026. Adding linear thermocouple junction degradation ($0.58\%$ per year) brought the power output to $228.4\text{ W}$, matching NASA JPL's real-time telemetry dashboard where non-essential heaters and instruments have been systematically powered down to extend flight operations past 2026.
