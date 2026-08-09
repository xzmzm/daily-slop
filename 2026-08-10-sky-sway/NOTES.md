# sky-sway — notes

## Why this project

Today is **Skyscraper Appreciation Day** (August 10), so a structural-
engineering build was the natural fit — and nothing in the prior 18 days
touched buildings, vibration, or any kind of dynamics-with-an-engine. The
hook that won was the tuned mass damper: it is the single most counter-
intuitive object in a tall building. You would think the way to stop a
tower swaying is to make it stiffer, or bolt on active hydraulics. Instead
you hang an enormous passive pendulum near the top and *let* it swing —
tuned so it resonates out of phase and cancels the motion. Taipei 101's is
728 tons of steel, openly visible to tourists between floors 87 and 92.

The reason this beat the other candidates (a skyscraper-height comparison
visualization, a "guess the city by skyline" quiz, a floor-plan layout toy)
is that TMDs have a clean, famous, *verifiable* math engine underneath:
Den Hartog's 1928 optimal-tuning formulas, with the beautiful "equal peaks"
invariant. An engine I can assert against is the difference between a toy
that *looks* right and one that *is* right. I scanned the existing days to
be sure: `orbit-chime` is the closest cousin (oscillators + resonance), but
it is about music, not structures, and its math is integer-ratio orbits,
not transfer functions.

## How it works

### The engine

The whole project rests on four pure pieces in `engine.js`:

1. **Den Hartog's optimal tuning**, the 1928 closed form. For mass ratio
   μ = m_damper/m_structure:

   ```
   f_opt  = 1 / (1 + μ)
   ξ_opt  = √( 3μ / [8 (1+μ)³] )
   ```

   At this tuning the structure's displacement transfer function has two
   peaks of exactly equal height, and that minimized peak is √(1 + 2/μ).

2. **The 2-DOF transfer function**. I derive it from the coupled equations
   with m₁ normalized to 1 and ω₁ normalized to 1:

   ```
   x1'' + 2 ξ1 x1' + x1 + μ·[2 ξ2 f (x1'−x2') + f²(x1−x2)] = F
   μ x2'' + μ·[2 ξ2 f (x2'−x1') + f²(x2−x1)] = 0
   ```

   Solving via Cramer's rule and cancelling a factor of μ (so the formula
   stays well-conditioned as μ → 0, where it must collapse to the bare SDOF):

   ```
   Dd(s) = s² + 2 ξ2 f s + f²            ← damper's own denominator
   Nc(s) =        2 ξ2 f s + f²          ← damper coupling numerator
   Z11   = s² + 2 ξ1 s + 1 + μ·Nc(s)
   H(s)  = Dd(s) / [ Z11(s)·Dd(s) − μ·Nc(s)² ]
   ```

   Evaluated at s = jω (ω = forcing/ω₁), |H| is the dynamic amplification.
   **This factoring was the key debugging step** — the naive impedance-matrix
   form divided by μ implicitly and blew up at μ → 0, so the first version's
   "no-damper limit" test failed by 8×. Cancelling μ analytically before
   evaluating fixed it cleanly.

3. **An RK4 integrator** for the actual time-domain sway you see on screen.
   The animation is not canned — it is a real integration of the 2-DOF system
   under harmonic wind forcing, sub-stepped so ω·dt < 0.1 for stability.

4. **The building period rule**: a code-standard back-of-envelope says a
   shear building's first-mode period is ≈ 0.1 s per floor, so an 80-floor
   tower has T₁ ≈ 8 s, ω₁ ≈ 0.79 rad/s. That feeds the lumped-mass / stiffness
   / damping coefficients.

### The visualization

The building is drawn as a stack of floor-strips, each displaced by the first
cantilever mode shape 0.5(1 − cos(πz/2)) — zero at the ground, full at the
top. The damper sphere hangs near the top, positioned at the integrated
damper-mass coordinate `x₂` (relative to the building's local frame), with
four tether lines to a frame. Toggle the damper off and the sphere, tethers,
and coupling all vanish; the building reverts to a bare SDOF and the sway
climbs to the 1/(2ξ₁) resonance.

The response plot is drawn from `sampleResponse()` over g = 0.3…1.7, showing
the bare curve H₀ (red), the with-TMD curve H (green), and a dashed line at
the Den Hartog minimized-peak height √(1 + 2/μ).

## Interesting notes

- **The equal-peaks theorem is exact only for an undamped primary.** My first
  test suite asserted the two peaks were within 3% at ξ₁ = 0.02 and they
  weren't — ratio ≈ 0.94. For a few minutes I thought the engine was wrong.
  It wasn't: Den Hartog's derivation explicitly assumes ξ₁ = 0, and *any*
  nonzero primary damping breaks the exact equality. I re-ran the test at
  ξ₁ = 1e-6 and the peaks matched √(1+2/μ) to 3 parts in a thousand. Lesson:
  read the theorem's stated conditions before writing the assertion. The
  corrected test now deliberately checks both regimes — the exact equality
  at ξ₁ → 0, and the "still cuts the peak substantially" behavior at the
  realistic ξ₁ = 0.01.

- **The peak-cut KPI had to switch from measured to theoretical.** The first
  version compared the *measured* rolling-peak sway (with vs. without damper)
  to compute "−88%". But from a cold start at resonance it takes a full period
  (~8 s) for the steady-state amplitude to build up, so for the first several
  seconds the "cut" read nonsense (−100%, then +whatever). The fix: compute
  the cut from the *transfer-function* peaks (findPeaks on the actual damped
  H, vs. the bare 1/(2ξ₁)), which is instant and independent of how long the
  integrator has been running. The measured sway is still shown as the live
  "sway (cm)" readout — the two numbers now answer different questions
  ("how much is it moving *right now*?" vs. "how much *would* it move at
  steady state?").

- **Playwright clicks timed out on the animated page; CUA clicks worked.**
  The constant `requestAnimationFrame` redraw of the canvases seems to keep
  the renderer busy enough that Playwright's actionability checks (visible,
  stable, enabled) hit the 3s budget on button clicks — even though the
  buttons are plainly visible and clickable. Falling back to coordinate-based
  CUA clicks (after a locator `evaluate` to read the bounding box) worked
  instantly. A real user with a mouse never sees this; it's purely a test-
  harness artifact.

- **Why a pendulum and not a sliding mass?** Both work; the math is the same
  2-DOF system either way. I drew a sphere on tethers because that's what
  Taipei 101 actually has and what people recognize. Shanghai Tower's damper
  is also a pendulum; some Japanese towers use liquid slosh dampers instead.

- **The "0.1 s per floor" rule is a real code-adjacent heuristic.** ASCE 7
  gives T₁ ≈ 0.1·N for steel moment frames (a bit less), ≈ 0.13·N for concrete
  (a bit more). I used 0.1 flat — the project is a toy, not a survey tool,
  and the point is that a 100-story tower has a period around 10 seconds and
  a correspondingly low natural frequency, which is *why* wind (not
  earthquakes) governs its design.

- **Ideas left out of scope.** A multi-mode (MDOF) building with a TMD tuned
  to the second mode; active mass dampers (AMDs) with a control law; a real
  El Centro / Kobe earthquake time-history forcing instead of harmonic wind.
  All would be interesting; none fit in an hour, and harmonic forcing is
  actually the *right* model for wind — it's the dominant design load for
  tall buildings and the case Den Hartog's formula directly addresses.
