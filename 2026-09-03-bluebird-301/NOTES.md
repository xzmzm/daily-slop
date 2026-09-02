# NOTES — Bluebird 301 · 盐上的立方定律

## Why this project?

Today is 3 September 2026 — 91 years to the day since Sir Malcolm Campbell,
aged fifty, drove the Campbell-Railton Rolls-Royce Blue Bird to 301.129 mph
on the Bonneville Salt Flats: the first 300 mph on land, by 1.1 mph. A date
hook that strong decides the project. The runner-up candidates for the date
were Dagen H (Sweden's overnight switch to right-hand driving, 3 Sep 1967)
and the Viking 2 landing (3 Sep 1976) — but a traffic-flow sim and another
spacecraft would both have been cousins of earlier days, and neither has a
cube law hiding inside it.

Nothing in the prior 42 days touched aerodynamic drag power, and this subject
is a closed-form playground: the cube law, a cubic equation with a 1545
explicit root, a harmonic-mean record rule, an ISA density power law, and a
centrifugal v²/r that lands at ~3,900 g. That's exactly the house style.

## How it works

**The cubic and Cardano.** At steady speed the wheel power equals drag plus
rolling: a·v³ + b·v = P with a = ½ρC_dA and b = μmg. With q = −P/a the
discriminant (q/2)² + (p/3)³ is non-negative for any P ≥ 0, so the equation
has exactly one real root and Cardano's formula needs no case table:

    v* = ∛(P/2a + √Δ) + ∛(P/2a − √Δ),   Δ = (P/2a)² + (b/3a)³

`terminalSpeed` computes that directly; the tests plug the root back into the
cubic (residual < 1e-9·P) and also compare it against a 200-iteration
bisection over a wide parameter grid — the app shows both numbers live in the
「极限速度」 tab. In the pure-drag limit (b = 0) the root is the plain cube
root, which gives the tab-2 headline: doubling speed costs exactly 8× the
power, and 1898→1935's 7.68× speed ratio is a 452× power ratio.

**Parameter fitting.** The historical anchors are real: 2,300 hp
supercharged 36.7-litre RR R V12, ~4.83 t (95 cwt), Bonneville at 1,282 m,
record 301.129 mph. C_d (0.534), A (2.05 m²), μ (0.015) and η (0.90) are
fitted so the Cardano root lands on the record; the test holds it to
±0.5 mph. Each preset (1899 La Jamais Contente, 1927 Sunbeam, 1947 Cobb) is
fitted the same way to its own record — the tests hold those to ±2.5 mph.
The 1947 Cobb fit ended up at C_d·A ≈ 0.49 m², which sounds impossibly
slippery next to the Blue Bird's 1.09 — but the Railton Special was a
narrow fully-enclosed teardrop with no radiator (thermal-storage cooling),
and 394 mph on ~2,600 hp simply demands it. The fit is the physics talking.

**The two-run rule.** Speeds are measured as 3600/t over a flying measured
mile; the record is total distance over total time — the harmonic mean of
the two runs. With a steady wind w along the course the ground speeds are
v∓w and the harmonic mean is exactly v(1 − w²/v²): the linear term cancels,
which is the entire point of running both ways within the hour. The trap
clock in the live sim interpolates the entry/exit crossings so the recorded
times are honest to the integration; with the default 5 mph breeze the
certificate lands at ~300.8 mph, 0.29 mph under Campbell, the deficit being
the flying-start approach (the car is still ~1% below v* when it enters the
mile — physically true; the real course was miles long).

**Altitude.** ρ(h) = 1.225(1 − 2.2558×10⁻⁵·h)^4.2559 gives Bonneville
ρ ≈ 1.081, −12% drag. A normally-aspirated engine breathes in proportion to
ρ/ρ₀ and gives the gain straight back — in the pure-drag limit the NA speed
is exactly the SC speed times ρ^⅓ (tested to 1e-9), and rolling resistance
drags it below even that. The supercharged R holds its rated output, so the
salt's thin air is pure profit. That asymmetry is why the record moved
inland from Daytona.

**The rim.** a = v²/r: at 301 mph with r = 0.47 m the rim pulls 3,937 g and
the wheel spins 2,737 rpm — faster than the engine. A 28 g salt grain
"weighs" 110 kg at the rim. The canvas shows the wheel at 0.02× slow-motion
with the rim colour keyed to g-load.

**The ladder.** Twelve absolute records 1898–1997, monotone in both date and
speed (tested). Thrust machines carry thrust, not shaft power; the chart
converts via equivalent power F·v at the record speed (Blue Flame ≈ 36,500,
ThrustSSC ≈ 102,000 hp) — the reason they beat the gearbox: their available
power grows with speed itself, while the piston car's is fixed at the shaft.

## Interesting notes

- **The launch model.** Traction-limited at 4.6 m/s² until P/v falls below
  it (~65 m/s), then power-limited. The time constant near v* is
  τ ≈ m·v*/(3av*²+b) ≈ 20 s, which is why the approach distance matters so
  much: at 3 miles the car enters the mile ~5% slow, at 6 miles ~2%, at the
  shipped 8 miles ~1%. The first draft's 3-mile approach produced a
  299.5 mph record and no 300+ stamp — the fix was history, not fudging:
  the real Bonneville courses were exactly that long.
- **A test that corrected me.** I first asserted "NA speed = SC × ρ^⅓ at
  altitude" and the engine disagreed by half an mph. The engine was right:
  ρ^⅓ holds only when b = 0; the fixed rolling term makes altitude hurt an
  NA car twice. The test now asserts the exact limit and the strict
  inequality below it.
- **Harmonic vs arithmetic.** An arithmetic average of the two measured
  speeds would cancel a constant wind *exactly* — but the timing gear
  measures elapsed times, and total-distance-over-total-time is the only
  honest physical average, so the record keeps the small w²/v penalty
  (~0.08 mph in the default breeze). The certificate prints both numbers
  and the difference.
- **The 8×-bracket label collision.** The star label "1935 蓝鸟 301" and
  the crossing label "301 mph" initially drew at nearly the same pixel and
  read as garbage ("3,565 mph"); traced every canvas fillText from page
  load to find it. Crossing labels now sit below-right of their dot.
- **Deliberately out of scope:** engine torque curves, gear ratios, salt
  crust physics, the 1935 twin-run split times (I could not source the two
  individual trap times to a standard I'd print — the sim shows its own).
