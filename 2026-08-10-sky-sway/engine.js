// engine.js — Tuned-mass-damper studio, pure (no DOM), Node-testable.
// Used by app.js in the browser and by test_engine.js in Node.
//
// THE MODEL
// ---------
// A skyscraper is a giant tuning fork. Wind shakes it near its natural
// frequency; left alone it sways enough to make occupants seasick (and, in
// extreme cases, to yield). The trick that tames the sway is a *tuned mass
// damper* (TMD): a heavy pendulum / sliding mass near the top, tuned so it
// resonates *out of phase* with the building and bleeds energy off.
//
// We model the building as a damped single-degree-of-freedom oscillator (mass
// M, stiffness K, damping C) and the damper as a second SDOF (mass m, stiffness
// k, damping c) hung off the top. That is the classic Den Hartog 2-DOF system.
//
//   M x'' + C x' + K x + c(x' - y') + k(x - y) = F(t)
//   m y'' + c(y' - x') + k(y - x) = 0
//
// All formulas here are the textbook ones (Den Hartog 1928; Soong & Dargush
// 1997), verifiable against any structural-dynamics reference.
//
// Units: SI throughout (kg, N/m, N·s/m, Hz, rad/s). Angles in radians.

if (typeof module !== "undefined" && module.exports) {
  module.exports = {};
}

// ---------------------------------------------------------------------------
// 1. Natural frequency of a building, from a delightfully simple real-world
//    rule: an elastic shear building's first mode period T1 ≈ 0.1 × N floors
//    (seconds), so ω1 = 2π / T1. Tall steel buildings run a bit lower, concrete
//    a bit higher; 0.1 s/floor is the canonical back-of-envelope estimate.
// ---------------------------------------------------------------------------

/** Period (s) of first mode for an N-floor building, ≈ 0.1 s/floor. */
function buildingPeriod(N) {
  if (!Number.isFinite(N) || N < 1) return NaN;
  return 0.1 * N;
}

/** Natural angular frequency ω₁ (rad/s) from period T (s). */
function omegaFromPeriod(T) {
  if (!Number.isFinite(T) || T <= 0) return NaN;
  return (2 * Math.PI) / T;
}

/** Effective stiffness K = M·ω² (N/m) for lumped mass M (kg) at ω (rad/s). */
function stiffness(M, omega) {
  return M * omega * omega;
}

/** Damping coefficient C = 2·ξ·M·ω (N·s/m) for damping ratio ξ. */
function dampingCoeff(M, omega, xi) {
  return 2 * xi * M * omega;
}

// ---------------------------------------------------------------------------
// 2. Den Hartog optimal tuning (1928). For a mass ratio
//
//      μ = m_damper / m_structure
//
//    the absorber that *minimizes the worst-case (H∞) response* of an
//    undamped primary structure to harmonic forcing is:
//
//      f_opt = 1 / (1 + μ)               ← frequency ratio ω_damper/ω_structure
//      ξ_opt = √( 3μ / [8 (1+μ)³] )      ← absorber damping ratio
//
//    At this tuning the structure's displacement transfer function develops
//    TWO peaks of EXACTLY EQUAL height — the famous "equal peaks" invariant.
//    That is the whole point of a TMD and the central verifiable claim here.
// ---------------------------------------------------------------------------

function massRatio(mDamper, mStructure) {
  if (!Number.isFinite(mDamper) || !Number.isFinite(mStructure) || mStructure <= 0) {
    return NaN;
  }
  return mDamper / mStructure;
}

function optimalFreqRatio(mu) {
  if (!Number.isFinite(mu) || mu <= 0) return NaN;
  return 1 / (1 + mu);
}

function optimalDampingRatio(mu) {
  if (!Number.isFinite(mu) || mu <= 0) return NaN;
  return Math.sqrt((3 * mu) / (8 * Math.pow(1 + mu, 3)));
}

/** Full Den Hartog design: given μ, return {freqRatio, dampingRatio}. */
function denHartog(mu) {
  return { freqRatio: optimalFreqRatio(mu), dampingRatio: optimalDampingRatio(mu) };
}

// ---------------------------------------------------------------------------
// 3. The 2-DOF transfer function. For harmonic base acceleration / forcing we
//    care about how much the STRUCTURE moves relative to no damper at all.
//
//    With the building as SDOF #1 and damper as SDOF #2, for a forcing at
//    frequency ω (rad/s), the dimensionless dynamic-amplification of the
//    structure's displacement (normalized by the static displacement) is:
//
//      H(ω) = sqrt(num) / sqrt(den)
//
//    where (g = ω/ω1 frequency ratio, f = ω2/ω1 damper tuning, μ = m2/m1,
//    ξ1 primary damping ratio, ξ2 damper damping ratio):
//
//      num  = (f²·g²·μ ... actually let's use the standard complex form).
//
//    To keep it exact and inspectable we build the complex transfer function
//    directly. Define the structure response x̂/x_static under force F=F0 e^{iωt}
//    on mass #1. Normalizing frequencies by ω1 and displacement by x_static =
//    F0/K, the transfer function of |x1|/x_static is:
//
//      H(g) = | N(j g) / D(j g) |
//
//    with (writing s = j g, all in ω1-normalized units):
//      N(s) = (s² + 2 ξ2 f μ ... )
//    We use the well-known closed form (e.g. Soong & Dargush eq. 2.20):
//
//      D(s) = (1 + μ)(s²)·...  — see implementation; the algebra is verified
//      numerically in test_engine.js against (a) the no-damper limit and
//      (b) the equal-peaks property of Den Hartog tuning.
//
//    Implementation detail: we treat it as a 2-DOF mechanical network and
//    evaluate |H| by Cramer's rule on the impedance matrix at s = jω. This is
//    exact and easy to check.
// ---------------------------------------------------------------------------

/**
 * Complex helpers (tight, no allocation gymnastics — called per frequency).
 * Each complex number is {re, im}.
 */
function cmul(a, b) { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; }
function csub(a, b) { return { re: a.re - b.re, im: a.im - b.im }; }
function cscale(a, k) { return { re: a.re * k, im: a.im * k }; }
function cdiv(n, d) {
  const dd = d.re * d.re + d.im * d.im;
  return { re: (n.re * d.re + n.im * d.im) / dd, im: (n.im * d.re - n.re * d.im) / dd };
}
function cabs(a) { return Math.hypot(a.re, a.im); }

/**
 * |H(g)| — dynamic amplification of STRUCTURE displacement x1, normalized by
 * the static displacement F0/K, for harmonic forcing F0 cos(ωt) on mass #1.
 *
 *   g     forcing-frequency ratio ω/ω1
 *   mu    mass ratio m2/m1
 *   f     damper tuning ω2/ω1
 *   xi1   primary structure damping ratio
 *   xi2   damper damping ratio
 *
 * Returns the magnitude (dimensionless). Uses the exact 2-DOF complex form,
 * derived from the coupled equations (m1 normalized to 1, ω1 = 1):
 *
 *   x1'' + 2 ξ1 x1' + x1 + μ·[2 ξ2 f (x1'−x2') + f²(x1−x2)] = F
 *   μ x2'' + μ·[2 ξ2 f (x2'−x1') + f²(x2−x1)] = 0
 *
 * Solving via Cramer's rule and cancelling a factor of μ (so the formula
 * stays well-conditioned as μ → 0, where it must collapse to the bare SDOF):
 *
 *   Dd(s) = s² + 2 ξ2 f s + f²          ← damper's own denominator
 *   Nc(s) =        2 ξ2 f s + f²        ← damper coupling numerator
 *   Z11(s) = s² + 2 ξ1 s + 1 + μ·Nc(s)
 *   H(s) = Dd(s) / [ Z11(s)·Dd(s) − μ·Nc(s)² ]
 *
 * At μ = 0 this reduces to 1/Z11 = 1/(s² + 2 ξ1 s + 1) = the SDOF H0. ✓
 */
function structureResponse(g, mu, f, xi1, xi2) {
  // Evaluate polynomials at s = j g  (so s² = −g²).
  // Dd(s) = (f² − g²) + j (2 ξ2 f g)
  const Dd = { re: f * f - g * g, im: 2 * xi2 * f * g };
  // Nc(s) = f² + j (2 ξ2 f g)
  const Nc = { re: f * f, im: 2 * xi2 * f * g };
  // Z11(s) = (1 − g² + μ f²) + j (2 ξ1 g + μ·2 ξ2 f g)
  const Z11 = { re: 1 - g * g + mu * Nc.re, im: 2 * xi1 * g + mu * Nc.im };
  // denom = Z11·Dd − μ·Nc²
  const denom = csub(cmul(Z11, Dd), cscale(cmul(Nc, Nc), mu));
  const H = cdiv(Dd, denom);
  return cabs(H);
}

/**
 * |H₀(g)| — reference response of the building with NO damper (μ = 0): the
 * plain SDOF dynamic amplification factor,
 *   H0(g) = 1 / sqrt( (1 − g²)² + (2 ξ1 g)² ).
 */
function noDamperResponse(g, xi1) {
  const denom = Math.sqrt(Math.pow(1 - g * g, 2) + Math.pow(2 * xi1 * g, 2));
  return denom === 0 ? Infinity : 1 / denom;
}

/**
 * Peak reduction factor: the ratio of the worst-case |H| WITH the optimally
 * tuned damper to the worst-case |H0| WITHOUT. Den Hartog shows this equals
 *   R = sqrt( 2 / (1 + μ) )·...  — actually the minimized peak height of the
 * damped system is sqrt( 1 + 2/μ ), so the ratio of damped-peak to the
 * UNDAMPED resonance (which would be 1/(2 ξ1)) is large; the meaningful
 * number is the damped peak height itself:
 *   H_max,opt = sqrt( 1 + 2/μ ).         ← Den Hartog's minimized peak.
 */
function optimalPeakHeight(mu) {
  if (!Number.isFinite(mu) || mu <= 0) return NaN;
  return Math.sqrt(1 + 2 / mu);
}

// ---------------------------------------------------------------------------
// 4. ODE integration of the actual time-domain sway, for the animation.
//    State [x1, v1, x2, v2], forcing F(t) = F0 sin(ω t) on mass #1.
//    Velocity-Verlet / RK4. We use RK4 — it's plenty fast for a 4-D system at
//    audio-ish step rates, and its stability makes the long decay tests honest.
// ---------------------------------------------------------------------------

/**
 * One RK4 step of the coupled 2-DOF system.
 *   state = [x1, v1, x2, v2]
 *   params = { m1, m2, k1, k2, c1, c2, F0, omegaF, t }
 * Returns new state [x1, v1, x2, v2].
 */
function rk4Step(state, p, dt) {
  const deriv = (s, t) => {
    const [x1, v1, x2, v2] = s;
    // Coupling force that the damper exerts BACK on the structure, and that
    // accelerates the damper mass. When there is no damper (m2 = 0, k2 = c2 = 0)
    // both coupling terms are exactly zero and the system degenerates to a
    // bare SDOF — we must NOT divide by m2 in that case.
    const dx = x2 - x1;
    const dv = v2 - v1;
    const fCouple = p.k2 * dx + p.c2 * dv; // force on m2 from the spring+dashpot
    const a1 = (p.F0 * Math.sin(p.omegaF * t) - p.c1 * v1 - p.k1 * x1 + fCouple) / p.m1;
    const a2 = p.m2 > 0 ? -fCouple / p.m2 : 0;
    return [v1, a1, v2, a2];
  };
  const k1 = deriv(state, p.t);
  const s2 = state.map((v, i) => v + (dt / 2) * k1[i]);
  const k2 = deriv(s2, p.t + dt / 2);
  const s3 = state.map((v, i) => v + (dt / 2) * k2[i]);
  const k3 = deriv(s3, p.t + dt / 2);
  const s4 = state.map((v, i) => v + dt * k3[i]);
  const k4 = deriv(s4, p.t + dt);
  const out = state.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  return out;
}

// ---------------------------------------------------------------------------
// 5. Sample a transfer function over a frequency grid, for the plot.
//    Returns array of { g, h, h0 } sorted by g ascending.
// ---------------------------------------------------------------------------

function sampleResponse(mu, f, xi1, xi2, opts) {
  opts = opts || {};
  const gMin = opts.gMin != null ? opts.gMin : 0.2;
  const gMax = opts.gMax != null ? opts.gMax : 1.8;
  const n = opts.n || 461;
  const out = [];
  for (let i = 0; i < n; i++) {
    const g = gMin + (gMax - gMin) * (i / (n - 1));
    out.push({ g: g, h: structureResponse(g, mu, f, xi1, xi2), h0: noDamperResponse(g, xi1) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 6. Find the two resonance peaks of the damped structure response and report
//    their heights. The Den Hartog optimum makes them equal — this is the
//    numerical heart of the verification suite.
// ---------------------------------------------------------------------------

/**
 * Brute-force local maxima of |H(g)| over the grid. Returns array of
 * { g, h } for each peak (heights descending). Good enough for test purposes.
 */
function findPeaks(mu, f, xi1, xi2) {
  const pts = sampleResponse(mu, f, xi1, xi2, { gMin: 0.3, gMax: 1.7, n: 1401 });
  const peaks = [];
  for (let i = 1; i < pts.length - 1; i++) {
    if (pts[i].h > pts[i - 1].h && pts[i].h >= pts[i + 1].h) {
      peaks.push({ g: pts[i].g, h: pts[i].h });
    }
  }
  peaks.sort((a, b) => b.h - a.h);
  return peaks;
}

// ---------------------------------------------------------------------------
// 7. Real-world reference buildings (mass / period / damper data), for presets.
//    Sources cited in NOTES.md. Numbers rounded to the precision a daily build
//    needs; the point is they're in the right ballpark, not survey-grade.
// ---------------------------------------------------------------------------

const REFERENCE_BUILDINGS = [
  {
    id: "taipei101",
    name: "Taipei 101",
    floors: 101,
    // 728-ton steel pendulum, ~5.5 m swing. The canonical TMD.
    damperMass: 728000,        // kg (728 t)
    damperType: "pendulum",
    note: "World's largest tuned-mass damper: a 728-ton steel sphere pendulum, suspended between levels 87–92, visible to the public."
  },
  {
    id: "shanghai",
    name: "Shanghai Tower",
    floors: 128,
    damperMass: 1000000,       // kg (1000 t)
    damperType: "pendulum",
    note: "1,000-ton tuned damper — the heaviest of any building. Damps both wind and typhoon sway."
  },
  {
    id: "citic",
    name: "CITIC Tower (China Zun)",
    floors: 108,
    damperMass: 0,             // active/ATMD-ish, not a pure passive TMD; shown for comparison
    damperType: "none",
    note: "Uses an active mass damper system; included as the 'modern' contrast to passive TMDs."
  }
];

if (typeof module !== "undefined" && module.exports) {
  Object.assign(module.exports, {
    buildingPeriod,
    omegaFromPeriod,
    stiffness,
    dampingCoeff,
    massRatio,
    optimalFreqRatio,
    optimalDampingRatio,
    denHartog,
    cmul,
    cdiv,
    cabs,
    structureResponse,
    noDamperResponse,
    optimalPeakHeight,
    rk4Step,
    sampleResponse,
    findPeaks,
    REFERENCE_BUILDINGS
  });
}
