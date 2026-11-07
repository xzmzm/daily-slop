# Noon Fall — notes

## Why this project?

Two things lined up on 7 November. First, the anniversary: on this day in 1492, a stone fell at noon near the walled town of Ensisheim in Alsace — a fireball explosion heard 150 km away, a 127 kg LL6 chondrite that King Maximilian had chained in the church, and the oldest witnessed fall whose material is still where it landed. Second, the sky right now: the Taurids are active this exact week in 2026, famous for slow bright fireballs, and the science press is running "fireballs and a supermoon this November" pieces. A fireball simulator is the overlap: the same physics made both the medieval omen and this week's shooting stars.

The idea beat two alternatives — a Marie Curie half-life lab (also a 7 November birthday, but dice-decay sims are a genre staple) and an ESCAPADE Earth-flyby orbital sim (the workspace already has plenty of orbital mechanics). Entry physics — drag vs ablation vs strength — had not been touched, and it has the rare property that the historical outcome (a stone lands in a field, intact) is the *rare* branch, not the default.

## How it works

`model.js` integrates a single-body entry from 100 km down:

- **Atmosphere:** ρ(h) = 1.225·e^(−h/7200) kg/m³, flat ground.
- **Trajectory:** flight angle θ is constant (flat-earth approximation); dh/dt = −v·sinθ, dx/dt = v·cosθ; dv/dt = −Γρv²A/m − g·sinθ with Γ = 0.7.
- **Shape:** A/m = πr²/m with r = (3m/4πρ_m)^⅓, so a body's area-to-mass ratio improves as it ablates away — small remains decelerate *harder* per unit mass.
- **Ablation:** dm/dt = −(Λ/2Q)·ρv³·A with Λ = 0.02 and Q = 3–10 MJ/kg by material.
- **Light:** L = τ·|dm/dt|·v²/2 with τ = 0.005, converted to an apparent magnitude at 100 km against a magnitude-0 irradiance of 2.54e-8 W/m².
- **Break-up:** dynamic pressure q = ρv² vs strength S(m) = S₁·(1 m/r)^0.25. The quarter-power is a Weibull-ish size effect and it is the hinge of the whole app: S₁ is 15 MPa for stone, but a 20-m Chelyabinsk body gets S ≈ 8.5 MPa → shatters at ~28 km at ~545 kt (accepted: ~500 kt at ~30 km), while a 60-cm Ensisheim stone gets S ≈ 21 MPa → rides a 9.5 MPa peak all the way down.
- **Aftermath:** a burst draws a 1.5 s flare (luminosity ×4 decaying, cloud decelerating as v/(1+4t)); a survivor that slows below 300 m/s enters "dark flight", which the model compresses into 2 s of animation and reports at sea-level terminal velocity.

Integration is fixed-step Euler (0.01 s fast, 0.2 s during slow drift) — the physics is smooth and the test asserts monotone altitude/speed across a 36-entry sweep, so stiffness would show up as a failed invariant, not a silent wrong number.

The app pre-computes the whole trajectory on **Drop it**, then plays it back at `duration/6.5` seconds so every flight gets roughly the same screen time. Drawing interpolates between fixed samples rather than snapping, because at 15 fps the video clock can jump several sample widths per frame.

## Interesting notes

- **The first tuning round was humbling.** With textbook "tensile" strengths (2 MPa stone), *every* preset shattered, including Ensisheim. The race is brutal: q = ρv² grows exponentially as the air thickens, and v barely drops until drag suddenly bites. The fix was not fudging — it was using intact-rock dynamic strength (tens of MPa) *with* the size effect. Real meteorite survival genuinely is this marginal; most bodies fragment, and survivors are the strong tail.
- **Iron almost didn't land either.** A 10 t iron at 45° hits at ~5 km/s in this model — the exponential atmosphere's whole column (ρ₀H ≈ 8.8 t/m²) isn't enough to brake a body with that little area per kilogram. The analytic floor is v₀·e^(−Γρ₀HA/m·sinθ), and the preset had to shrink to 500 kg at 35° to land at ~170 m/s. Big irons really do arrive fast; that's why Hoba never made a classic crater.
- **A km-vs-m unit bug hid the entire fire.** The downrange axis picked the first round step ≥ `maxDownrange·1.06` — comparing kilometres against metres, so no step ever fit, the axis silently fell back to 20 km, and the whole 229-km trail rendered off-canvas. The screenshots looked "clean" (empty sky!) precisely because everything was drawn 11× too far right. Caught it by scanning the PNG for orange pixels: only the label was orange. The lesson: an empty-looking canvas deserves a pixel probe, not a squint.
- **The verdict raced the flight.** The verdict box originally keyed off `result.outcome` alone, so the ending was revealed while the rock was still at 95 km. The fix (a `flying` branch) is also why the browser test now asserts "In flight" mid-flight — a UI state machine bug is exactly the kind of thing a screenshot can't catch but a text assert can.
- **Taurid flares are honest.** Dust & ice gets a 3.4 kPa·(1 m/r)^¼ strength, so a 100 kg blob at 29 km/s shatters at ~78 km with a flash worth ~10 t of TNT and nothing else. That *is* the Taurid experience: bright flare, no meteorite. The video leans on the contrast: dust flares high, stone lands, iron punches through.
- Deliberately out of scope: fragment cascades after the first break-up, radiant showers (Ensisheim reportedly dropped a shower of stones), ablation-driven shape change, winds during dark flight, and any sound. The "air squeeze" gauge doing the storytelling is just ρv² in MPa — one number, three fates.
