# loop-the-loop — notes

## Why this project?

August 16 is National Roller Coaster Day, commemorating the 1898 date on
which Edwin Prescott patented the vertical loop (his "centrifugal railway"
became Coney Island's *Loop-the-Loop* in 1901). Searching the day's
observances, this one had the best physics-per-word: the loop-the-loop is a
one-formula wonder — **a rail can only push** — and everything else (the
2.5 r drop rule, 6 g entries, why loops vanished until 1976, why upstop
wheels exist) unpacks from it. It also had the best failure modes to build:
stall, rollback, and the car genuinely falling off the track.

Candidate ideas rejected: roller-coaster-*design* sandboxes exist by the
hundred; the interesting slice wasn't "draw a coaster" but "why does this
one shape have exactly one legal height", plus the 1898-circle vs
1976-clothoid natural A/B.

## How it works

**The one-line rule.** At a loop's crest the required inward force is
m·v²/r while gravity can supply at most m·g pointing inward. The rail's
normal force N = m(v²/r − g) must stay ≥ 0, so v² ≥ g·r. From energy,
v_top² = 2g(H − 2r); setting them equal gives **H ≥ 2.5 r** measured above
the loop's *lowest point* (equivalently, release half a radius above the
crest). At exactly 2.5 r the rider is weightless at the crest and feels
v²/(g·r) + 1 = 6 g at the entry — the textbook numbers, reproduced by the
simulator to within integration error (tests: crest felt +0.02 g, peak
6.0 g, and a bisection over the real integrator puts the simulated minimum
within centimetres of 22.5 m).

**The μ·Δx theorem.** Coulomb friction on a slope pays μ·m·g·cosθ per metre
of path, and ∫cosθ·ds over a monotone run is just the horizontal
displacement. So the friction bill is **μ·g·Δx, independent of the path's
shape** — a straight ramp and a madcap profile with the same run-in cost
the same. The verdict panel adds this line to 2.5 r live. (Caveat the tests
pin down: on fast curves the normal force carries the v²κ centripetal term
too, so real dissipation runs a few percent above the straight-rail bill —
the "curvature surcharge".)

**Why the clothoid wins.** Prescott's circle spends its maximum curvature
(1/r) everywhere, including the fast entry: 6 g. Stengel's 1976 teardrop
(the `Corkscrew` at Knott's Berry Farm) spends curvature where there is no
speed — gentle at the bottom, tight at the slow crest. The generator here
parametrises the loop by tangent angle φ with κ(φ) ramping from κ_hi/4 at
entry to κ_hi at the crest, marched with midpoint steps so the shape scales
exactly with r_top (a bisection then matches its crest height to the
circle's for a fair fight). Same silhouette, same release: peak felt g
drops from 6.0 to ~3.4 (with the crest now at a comfortable +0.9 g instead
of a coin-flip 0 g).

**The engine** (pure, node-testable) is 1-D dynamics along arc length:
the track is a resampled polyline with an arc-length table giving (x, y, θ,
κ) at any s; the car integrates s with an exact per-substep Coulomb
solution (friction can stop it but never reverse it, which kills stiction
chatter). Detachment is honest: when N < 0 (side-friction era) or
N < −1.5 g (upstop wheels) the car goes ballistic as a point mass and
re-attains the rail inelastically when it falls back through from the
riding side — the normal component is paid into the heat ledger, so the
ledger balances through crashes (tested). Every dispatch starts with a
1.5 m/s chain push, because a car released from rest on the near-flat
crest with μ = 0.05 just sits there — correct physics, no ride.

## Interesting notes (the debugging was the story)

- **Splines are a speed problem.** Catmull-Rom dips ~12 cm below grade
  before every rise (the cubic's t² term) and overshoots wherever adjacent
  segment lengths differ. Harmless at 5 m/s; at 20 m/s a κ = −0.03 wiggle
  means v²κ ≈ −4 m/s² against g = 9.8 — the car leaves the rail. Three
  separate phantom-launch sites (drop, loop exit, runout) each got killed
  the same final way: the drop is now a single analytic cosine ease (flat
  at both ends, convex only where the car is slow, κ → 0 at the fast
  valley), and the runout hills are analytic cosine bumps that cannot dip
  below grade by construction. Lesson: at coaster speeds, generate track
  analytically or not at all.
- **Curvature is computed from a blurred tangent field, but the geometry is
  never re-marched.** The first fix (smooth θ, then re-integrate positions)
  dug a phantom dip after the loop exit — a smoothed heading that
  approaches 0 from below integrates to a few centimetres below grade,
  precisely at maximum speed. Keeping exact positions and deriving only
  κ from the smoothed θ kills joint kinks without inventing topology.
- **The station overlapped the lift** for one glorious bug: the polyline
  doubled back at heading π, the tangent unwrapped to 4π, and the "loop"
  turned twice. The 2π-turning test caught it immediately.
- **The leap.** Release just below 2.5 r and the car detaches on the
  ascent, flies a parabola that clears the loop's interior, and lands on
  the far rail. Real physics — a marble does this — and it kept defeating
  my "falls short" demos until I moved the preset to 2.05 r, where the
  apex can't clear the crest. Even then the fallen car usually crash-lands
  in the bowl, loses its normal component as heat, and limps out through
  the loop's bottom opening to finish the course. μ = 0 can't trap a
  marble; the 2.5 r lesson is the detachment, not the DNF.
- **Almost every crest floats.** At 20 m/s, v²κ > g for any crest tighter
  than ~45 m radius — which is why real trains need upstop wheels
  (Miller, 1912) and why the default presets ship with them on. The
  `airtime` preset ships without and genuinely hops.
- Numbers that mattered: felt g at loop entry = v²/(g·r) + 1; κ of a
  cosine bump h over half-width w is h·π²/(2w²) (I first used 2π²/… and
  sized hills 4× too wild); the headless verdict panel re-runs the whole
  coaster on every drag for ~3 ms.

## Ideas deliberately left out

Air drag (quadratic, would muddy the μ·Δx theorem), multi-car trains with
articulation, clothoid-jerk limits (the real modern design constraint),
sound, and a track editor. The physics studio is the point; the coaster is
the prop.
