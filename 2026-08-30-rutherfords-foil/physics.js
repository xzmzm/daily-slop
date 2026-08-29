// physics.js — Rutherford's Foil studio, exact closed forms.
// 30 Aug 1871: Ernest Rutherford was born at Brightwater, New Zealand. Forty
// years later, in Manchester, he put his students Geiger and Marsden onto a
// strip of gold foil with a radium alpha source — and in 1909 they found that
// about 1 in 8000 alphas came straight back. In 1911 Rutherford drew the only
// conclusion the numbers allow: the atom's charge sits in a nucleus smaller
// than a ten-thousandth of the atom itself. Everything here is a formula you
// can check by hand: the hyperbola b(θ) = (k/2E)·cot(θ/2), the cosec⁴
// counting law, its closed-form integral σ(>θ₀) = π·b(θ₀)², the single-
// scattering probability n·t·σ (the 1-in-8000), the size bookkeeping
// d = k/E vs R = r₀A^⅓, and the 1919 reaction ¹⁴N+α→¹⁷O+p.
//
// Units: energy MeV, length fm, c = 1 (so masses are MeV and a force of
// MeV/fm acting on mass m gives acceleration in 1/fm). Alpha energies here
// are ≤ 40 MeV against 3727 MeV rest mass — v/c ≤ 15%, no relativity needed.

export const KE = 1.439964; // MeV·fm — e²/4πε₀
export const M_ALPHA = 3727.379; // MeV/c²
export const R0 = 1.2; // fm — nuclear radius constant
export const U_MEV = 931.49410242; // MeV per u
export const NA = 6.02214076e23; // /mol
export const ALPHA_E = 7.69; // MeV — RaC' line, the Manchester source

export const ELEMENTS = {
  Al: { key: 'Al', z: 13, a: 27, rhoKgM3: 2700, mKgMol: 0.02698, cn: '铝' },
  Cu: { key: 'Cu', z: 29, a: 64, rhoKgM3: 8960, mKgMol: 0.06355, cn: '铜' },
  Ag: { key: 'Ag', z: 47, a: 108, rhoKgM3: 10490, mKgMol: 0.10787, cn: '银' },
  Au: { key: 'Au', z: 79, a: 197, rhoKgM3: 19300, mKgMol: 0.19697, cn: '金' },
};

// Coulomb strength k = z₁z₂e²/4πε₀ for an alpha (z=2) on a target.
export const kZZ = (z2) => 2 * z2 * KE;

// Liquid-drop size: R = r₀A^⅓; contact when surfaces touch (alpha A=4).
export const nuclearRadius = (a) => R0 * Math.cbrt(a);
export const contactRadius = (a) => nuclearRadius(a) + nuclearRadius(4);

// --- the hyperbola: impact parameter ↔ deflection angle -------------------
//   b(θ) = (k/2E)·cot(θ/2)   ⇔   θ(b) = 2·arctan(k/2Eb)
export const bFromTheta = (thetaRad, k, eMeV) =>
  (k / (2 * eMeV)) / Math.tan(thetaRad / 2);
export const thetaFromB = (bFm, k, eMeV) =>
  2 * Math.atan(k / (2 * eMeV * bFm));

// Head-on distance of closest approach d = k/E; for finite b the turning
// point solves r² = b² + (k/E)·r, so r_min = (d + √(d²+4b²))/2.
export const headOnDistance = (k, eMeV) => k / eMeV;
export const rMin = (bFm, k, eMeV) => {
  const d = headOnDistance(k, eMeV);
  return (d + Math.sqrt(d * d + 4 * bFm * bFm)) / 2;
};

// --- the cosec⁴ law and its exact integral ---------------------------------
//   dσ/dΩ = (k/4E)² / sin⁴(θ/2)      [fm²/sr]
//   σ(>θ₀) = π·b(θ₀)²                 [fm²]  (closed form of the integral)
export const dsigmaDOmega = (thetaRad, k, eMeV) => {
  const s = Math.sin(thetaRad / 2);
  return (k / (4 * eMeV)) ** 2 / (s * s * s * s);
};
export const sigmaAbove = (thetaRad, k, eMeV) =>
  Math.PI * bFromTheta(thetaRad, k, eMeV) ** 2;

// --- the 1-in-8000: single scattering in a thin foil ----------------------
//   n = ρN_A/M atoms per m³;  P(>θ₀) = n·t·σ(>θ₀), exactly linear in t.
export const numberDensity = (el) => (el.rhoKgM3 / el.mKgMol) * NA; // m⁻³
export const probAbove = (thetaRad, k, eMeV, el, tM) =>
  numberDensity(el) * tM * sigmaAbove(thetaRad, k, eMeV) * 1e-30; // fm² → m²
export const oneInN = (thetaRad, k, eMeV, el, tM) => {
  const p = probAbove(thetaRad, k, eMeV, el, tM);
  return p > 0 ? 1 / p : Infinity;
};
// Thickness that reproduces the famous 1-in-8000 reflection (θ>90°).
export const foilForOneIn = (nTarget, thetaRad, k, eMeV, el) => {
  const sigmaM2 = sigmaAbove(thetaRad, k, eMeV) * 1e-30;
  return 1 / (nTarget * numberDensity(el) * sigmaM2);
};

// --- how big is the nucleus: contact and the departure angle --------------
// The alpha touches the nucleus when r_min < R_c, possible at all only if
// the head-on approach beats the contact radius: E > k/R_c ≡ E_crit.
// The border impact parameter is b_c = √(R_c² − R_c·d); every θ beyond
// θ_c = θ(b_c) is territory where pure Rutherford physics has ended.
export const eCritContact = (k, el) => k / contactRadius(el.a);
export const contactBCrit = (eMeV, k, el) => {
  const rc = contactRadius(el.a);
  const d = headOnDistance(k, eMeV);
  if (d >= rc) return null; // no impact parameter can touch
  return Math.sqrt(rc * rc - rc * d);
};
export const thetaContact = (eMeV, k, el) => {
  const bc = contactBCrit(eMeV, k, el);
  return bc === null || bc === 0 ? null : thetaFromB(bc, k, eMeV);
};

// --- the alpha itself ------------------------------------------------------
export const alphaBeta = (eMeV) => Math.sqrt((2 * eMeV) / M_ALPHA); // v/c
export const alphaRangeAirCm = (eMeV) => 0.318 * Math.pow(eMeV, 3 / 2); // Geiger rule, ~5-10 MeV

// --- 1919: the first man-made nuclear reaction -----------------------------
//   ¹⁴N + α → ¹⁷O + p    (atomic masses, u)
export const REACTION = {
  mN14: 14.00307400443,
  mHe4: 4.00260325413,
  mO17: 16.99913175650,
  mH1: 1.00782503223,
};
export const qValue1919 = () =>
  ((REACTION.mN14 + REACTION.mHe4) - (REACTION.mO17 + REACTION.mH1)) * U_MEV;
export const threshold1919 = () =>
  -qValue1919() * (1 + REACTION.mHe4 / REACTION.mN14);

// --- numeric trajectory (RK4, c = 1) ---------------------------------------
// Propagates the alpha through the Coulomb field of a fixed nucleus at the
// origin, repulsive. Returns the sampled path, the numeric deflection angle
// and numeric closest approach — the tests check these against the closed
// forms above, the canvas draws the points.
export function traceTrajectory({ k, eMeV, bFm, x0Fm = 620, dTau = 1.4, maxSteps = 60000 }) {
  const m = M_ALPHA;
  // Launch on the incoming asymptote with the potential at the start point
  // subtracted, so the total energy is exactly E — otherwise the k/r₀ offset
  // (0.4 MeV at 620 fm) inflates the trajectory's energy and shrinks θ.
  const v0 = Math.sqrt(Math.max(0, (2 * (eMeV - k / Math.hypot(x0Fm, bFm))) / m));
  let x = -x0Fm, y = bFm, vx = v0, vy = 0;

  // a⃗ = (k/r²)·r̂/m — force MeV/fm on mass MeV gives 1/fm (c = 1)
  const acc = (px, py) => {
    const r2 = px * px + py * py;
    const r = Math.sqrt(r2);
    const s = k / (m * r2 * r);
    return [s * px, s * py];
  };

  const pts = [];
  let rMinSeen = Math.hypot(x, y);
  let step = 0;
  const h = dTau, h2 = dTau / 2;
  for (;;) {
    if (step % 12 === 0) pts.push([x, y]);
    step += 1;
    // velocity-Verlet-style RK4 for x⃗'' = a⃗(x⃗):
    //   k1: a₁ = a(x),        x-drift vx
    //   k2: a₂ = a(x+½h·vx),  drift vx+½h·a₁
    //   k3: a₃ = a(x+½h·k2x), drift vx+½h·a₂
    //   k4: a₄ = a(x+h·k3x)
    const [ax1, ay1] = acc(x, y);
    const [ax2, ay2] = acc(x + h2 * vx, y + h2 * vy);
    const [ax3, ay3] = acc(x + h2 * (vx + h2 * ax1), y + h2 * (vy + h2 * ay1));
    const [ax4, ay4] = acc(x + h * (vx + h2 * ax2), y + h * (vy + h2 * ay2));
    const kx4 = vx + h * ax3, ky4 = vy + h * ay3;
    x += (h / 6) * (vx + 2 * (vx + h2 * ax1) + 2 * (vx + h2 * ax2) + kx4);
    y += (h / 6) * (vy + 2 * (vy + h2 * ay1) + 2 * (vy + h2 * ay2) + ky4);
    vx += (h / 6) * (ax1 + 2 * ax2 + 2 * ax3 + ax4);
    vy += (h / 6) * (ay1 + 2 * ay2 + 2 * ay3 + ay4);
    const r = Math.hypot(x, y);
    if (r < rMinSeen) rMinSeen = r;
    if (step >= maxSteps || x > x0Fm || x < -x0Fm - 1) break; // exits either side (head-on comes back)
  }
  const theta = Math.atan2(vy, vx);
  return { pts, theta, rMinSeen };
}

// Launching exactly ON the asymptote (y = b, vy = 0) at a finite x₀ sits a
// fraction of a fm off the true hyperbola, so the propagated trajectory's own
// impact parameter is b_eff = b·v₀/v∞ ± δ(x₀). For the canvas that is
// invisible; for the tests we want the closed form checked without that
// artifact, so this solves for the launch y whose trajectory really has
// asymptote impact parameter bTarget (bisection on the exit angle).
export function launchYForB(bTarget, k, eMeV, x0Fm = 620, dTau = 1.0) {
  let lo = bTarget * 0.9, hi = bTarget * 1.1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const tr = traceTrajectory({ k, eMeV, bFm: mid, x0Fm, dTau });
    const want = thetaFromB(bTarget, k, eMeV);
    if (tr.theta < want) hi = mid; else lo = mid; // big b → small θ
  }
  return (lo + hi) / 2;
}

// --- presets ----------------------------------------------------------------
export const PRESETS = [
  {
    id: 'manchester1909', label: '曼彻斯特 1909',
    note: 'RaC′ α 7.69 MeV · 金箔 0.4 µm — Geiger–Marsden 的台子',
    el: 'Au', eMeV: 7.69, tUm: 0.4, rate: 65,
  },
  {
    id: 'one-in-8000', label: '1/8000 薄纸惊魂',
    note: '金箔拖到 ≈3.08 µm：θ>90° 恰好 8000 次里 1 次',
    el: 'Au', eMeV: 7.69, tUm: 3.0819, rate: 75,
  },
  {
    id: 'aluminium-anomaly', label: '铝的异常散射',
    note: 'α 8.6 MeV 打铝：θ≳82° 开始碰到核 —— 库仑定律到头了',
    el: 'Al', eMeV: 8.6, tUm: 6.0, rate: 70,
  },
  {
    id: 'accelerator-era', label: '加速器时代 40 MeV',
    note: '头对头最近距离缩进接触半径 —— 大角全是「碰核」区',
    el: 'Au', eMeV: 40, tUm: 0.4, rate: 70,
  },
];

export const DEFAULTS = {
  el: 'Au', eMeV: 7.69, tUm: 0.4, rate: 65,
};

// --- formatting helpers (shared by app + tests) -----------------------------
export const fmt = (x, digits = 1) => (isFinite(x) ? x.toFixed(digits) : '∞');
