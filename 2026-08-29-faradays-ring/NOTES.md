# NOTES — Faraday's Ring (2026-08-29)

## Why this project?

The recent run of anniversary studios (Drake Well, WEAF 660) had been
circling "energy infrastructure" without touching the one discovery under
all of it. Today's date settles it: **29 August 1831** is the day Faraday's
diary records the iron-ring experiment — the discovery of electromagnetic
induction, 195 years ago. It also chains perfectly onto yesterday: WEAF's
carrier was an alternator, but radio's *first* waves came from a Ruhmkorff
induction coil driving a spark gap — a direct descendant of this ring. The
story writes its own continuity line, and the physics is nothing but closed
forms, which is the house style.

## How it works

**The engine is piecewise-exact, not simulated.** The event history
(`make`/`break` with a stored `I₀` and `t_eff` per event) determines I₁(t)
in closed form on every segment:

- after a make: `I(t) = I∞ − (I∞ − I_k)·e^(−(t−t_k)/τ)`
- after a break: `I(t) = I_k·e^(−(t−t_k)/t_eff)`

and ε₂ = −M·dI₁/dt is then also closed-form per segment — there is no
numerical differentiation anywhere in the app. That's what makes the hero
test honest: numerically integrating ε₂/R₂ across a make (12000 midpoint
samples) reproduces `N₂ΔΦ/R₂` to 1e-5, and the charge is *bit-identical*
for a 1 µs and a 10 ms break while the peak EMF moves by exactly the ratio
of the break times.

**The arc clamp is the subtlety worth stealing.** The naive story is "break
fast → big spike". But an open-circuit inductor demanding V = L·I₀/t_b just
strikes an arc across the contact gap; the arc then *fixes* dΦ/dt, so the
secondary sees `V_bd·N₂/N₁` and the effective break time is stretched to
`t_eff = L·I₀/V_bd` — at the 1831 defaults the knife asks for 5 µs and the
physics hands it 16.7 µs. That's why the bench only draws a spark when the
demand actually exceeds V_bd, and why the slow-break case gets its own
"没有火花" message. `M/L₁ = N₂/N₁` (same core, k = 1) is the identity that
makes the clamp story clean, and it's pinned by a test.

**Historical calibration.** Documented: 6 in OD, 7/8 in rod, 72 ft + 60 ft
of wire, ten 4-inch plate pairs. Reconstructed (stated as such in the UI):
turn counts = wire length ÷ mean circumference → **53 and 44 turns**;
µ_r = 3000 for soft iron; battery = 10 × 0.9 V = 9 V; R₁ = 4.5 Ω. The
reconstruction lands at satisfying numbers: L₁ = 10.05 mH, M = 8.34 mH,
τ = 2.23 ms, B = 0.98 T (just under iron's knee — plausible for the real
thing), q ≈ 6.5 mC per kick. Secondary loop resistance is *derived*, not
slid: `R₂ = 1 Ω meter + N₂ × mean circumference × 0.087 Ω/m`, which is why
the Ruhmkorff preset's 20,000 turns honestly reports 8.2 km of wire.

**The ballistic needle is a pure function too.** No spring integrator:
each kick contributes `(s/a)·e^(1−s/a)` for s < a, then hold, then
exponential fall, scaled by |q|/q_ref. Deterministic under `__demo.step`,
so the video can replay any frame. AC mode switches the needle to
instantaneous i₂(t) — the visual punchline of "what changes when you stop
kicking and start sinuing".

## Interesting notes

- **The 6-inch ring is the wrong mains transformer, on purpose.** The AC
  tab lets you push 220 V through 53 turns: Φ̂ = 0.99 mWb → B_max ≈ 2.6 T,
  past the 1.8 T knee, and the gauge calls it. The default 4.5 V sits at
  B ≈ 0.99 T — right at real transformer design density. The lesson writes
  itself: cores must grow with voltage.
- **Air-core preset is the near-miss.** q divides by exactly µ_r (tested):
  6.5 mC → 2.2 µC. The galvanometer label switches to "近乎不动——这就是拿走
  铁环的代价". Henry had bigger electromagnets, which is *why* he saw it
  first and still lost the publication race.
- **Dead ends:** the first spark rendering used an rgb-string alpha hack
  that silently failed on hex CSS vars (fixed with globalAlpha); the first
  wire routing for the secondary ran straight through the iron ring
  (re-routed around x=486); the equal-area charge strip originally tried to
  shade areas under a *log* axis, which would have lied about "equal
  areas" — the fix was to plot both kicks normalized by their own charge,
  so each area is exactly 1 by construction and the equality is the
  picture, not the caption.
- **Ruhmkorff preset honesty:** driving 200 turns × 1.5 A through the little
  core puts B ≈ 3.7 T — past the knee, and the UI says so. Real coils used
  laminated bundles for exactly this reason; the linear engine flags the
  lie instead of hiding it.
- The bench "breathes" on its own (make at 1.2 s, break at 4.8 s, loop at
  8.8 s) until the first human click or the video's `setVideoMode(true)` —
  gallery screenshots catch it mid-kick without anyone driving it.

## Verification

- `node --test` — 16 tests, all exact-form (identity round trips to 1e-12,
  quadrature to 1e-5, sign laws, preset sanity).
- Headless Chrome walk-through of every tab, both switch states, air/iron
  and all four presets: zero console errors; state() values match the
  closed forms (M = 8.340 mH, τ = 2.232 ms, q = 6.521 mC, clamped v₂ =
  996.2 V).
