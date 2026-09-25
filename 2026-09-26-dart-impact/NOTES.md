# NOTES — why and how

## Why this project?

Today is 26 September 2026 — exactly four years to the day since DART hit
Dimorphos at 23:14 UTC in 2022, humanity's first (and so far only) deliberate
change of another world's orbit. The anniversary lands with a live hook: ESA's
Hera spacecraft arrives at Didymos **this December** to weigh the moonlet and
survey the crater, so the numbers this toy lets you poke at are about to get
re-measured for real.

I scanned the previous sixty-odd days for overlap: plenty of space history
(Luna 2, Voyager grand tour, LHC), but nothing about orbital deflection or
impulse physics. The β factor is also a genuinely good toy mechanic — one
slider whose meaning is "how much did the splash help", with a real measured
value to anchor it.

## How it works

**The orbit is exact.** Constants: a₀ = 1189 m, T₀ = 11.92 h (both
published), from which μ = 4π²a³/T² ≈ 36.04 m³/s² — a system mass of
≈ 5.4 × 10¹¹ kg, matching the radar-derived value. Dimorphos mass
4.5 × 10⁹ kg (ρ ≈ 2400 kg/m³ over D ≈ 160 m — the same density hypothesis
behind the published β = 3.61). The impact is a retrograde impulse
J = β · m·v projected cos θ along-track and sin θ radial; vis-viva and the
eccentricity vector turn that into the new a, e, T. At β = 3.61, θ = 0 this
reproduces the published result to the minute: T 11.92 h → 11.37 h,
**−33.0 min**, e = 0.032, Δv = 2.81 mm/s. Post-impact motion integrates
Kepler's equation (Newton, 6 iterations — e < 0.06 so it converges
instantly), and the handoff at the impact instant is continuous to machine
precision.

**The lightcurve is the honest measurement story.** Nobody saw the period
change directly; telescopes watched mutual eclipses/transits — dips in
Didymos's light each orbit. The strip plots dip trains for the no-impact
prediction (11.92 h) against the post-impact period; since each orbit is
33 min shorter, the ticks land early by n × 33 min — **4.6 h by day 4**.
One dip pair per orbit is a simplification (the real synodic lightcurve has
primary and secondary events at slightly offset spacing), but the arithmetic
of the drift is exact.

**Choreography.** The scene clock runs ×1800 (1 s ≈ 30 min, one orbit per
24 s). The terminal approach is slowed to 4.2 s of presentation time (the
real final 4 hours were autonomous — hence the SMART Nav lock brackets
converging on the moonlet). Ejecta particles are closed-form with linear
drag — position is a pure function of the presentation clock, so the
recording pipeline's frame-by-frame `tick(1/15)` stays deterministic.
Everything random (stars, rock outlines, ejecta) is mulberry32-seeded.

## Interesting notes

- **The scale surprise.** Didymos's radius is 33% of the orbital radius —
  the moonlet skims ~800 m above the primary. I started with bodies
  exaggerated ×1.6 and it looked like a mistake; true scale looks like the
  exaggeration. Everything on screen is true scale except the orbit *change*
  (×4, labeled) and the DART probe itself (a 570 kg box would be sub-pixel).
- **My eccentricity intuition was wrong.** I assumed a glancing blow raises
  e. It doesn't: e grows as ~2·Δv_t/v from the tangential miss and
  Δv_r/v from the radial part, so halving the tangential component (cos 45°)
  *lowers* e even though you add radial velocity. At 45° you keep cos 45° of
  the period change and e drops from 0.032 to 0.025. The test encodes what's
  actually true (a shrinks less), not my first guess.
- **The mass fit is pleasing.** With μ pinned by (a₀, T₀) and m_Dimorphos
  from the published density hypothesis, β = 3.61 lands on −33.0 min —
  no fudge factors anywhere in the chain.
- **β = 1 already smashes the goal.** The mission's success bar was
  detecting a 73 s change; even a perfectly dead-stick splat (no ejecta
  recoil, nothing but spacecraft momentum) gives 9½ minutes. The 33-minute
  result being 27× goal says less about ejecta magic and more about how
  light a 160 m rubble pile is.
- **What I left out:** n-body tides, Didymos's rotation lightcurve, the real
  synodic period subtleties, ejecta size sorting (the double tail Hubble
  saw), and the DSN Doppler measurement. Hera will tighten β by weighing
  Dimorphos directly; the density hypothesis (and the 2.2–4.9 β range it
  spans) is exactly the uncertainty it goes to resolve.
