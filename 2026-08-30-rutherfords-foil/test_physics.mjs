// test_physics.mjs — node --test test_physics.mjs
// Validates the Rutherford's Foil engine: the Coulomb constant, the R = r₀A^⅓
// size law, the hyperbola b(θ) = (k/2E)·cot(θ/2) (closed form against the RK4
// propagator), the cosec⁴ counting law and its closed-form integral σ(>θ₀) =
// π·b(θ₀)² (checked by numeric quadrature), the single-scattering probability
// P = n·t·σ and the 1-in-8000 calibration, the contact bookkeeping E_crit =
// k/R_c and θ_c, the 1919 reaction Q-value and threshold, and the preset
// ledger.

import test from "node:test";
import assert from "node:assert/strict";

import {
  KE, M_ALPHA, U_MEV,
  ELEMENTS, kZZ, nuclearRadius, contactRadius,
  bFromTheta, thetaFromB, rMin, headOnDistance,
  dsigmaDOmega, sigmaAbove, numberDensity, probAbove, oneInN, foilForOneIn,
  eCritContact, contactBCrit, thetaContact, alphaBeta, alphaRangeAirCm,
  traceTrajectory, launchYForB,
  qValue1919, threshold1919, REACTION,
  PRESETS,
} from "./physics.js";

const DEG = Math.PI / 180;
const AU = ELEMENTS.Au, AL = ELEMENTS.Al;
const kAu = () => kZZ(AU.z), kAl = () => kZZ(AL.z);
const E0 = 7.69; // RaC′

test("Coulomb constant: k = 2Z·e²/4πε₀ in MeV·fm", () => {
  assert.equal(kZZ(79), 158 * KE);
  assert.ok(Math.abs(kZZ(79) - 227.514) < 0.001);
  assert.ok(Math.abs(kZZ(13) - 37.439) < 0.001);
});

test("nuclear radius R = 1.2·A^⅓; contact radius adds the alpha", () => {
  assert.ok(Math.abs(nuclearRadius(197) - 6.982) < 0.001);
  assert.ok(Math.abs(nuclearRadius(27) - 3.60) < 0.01);
  assert.ok(Math.abs(contactRadius(197) - (nuclearRadius(197) + nuclearRadius(4))) < 1e-12);
  assert.ok(Math.abs(contactRadius(197) - 8.887) < 0.001);
});

test("b(θ) ⇄ θ(b) are exact inverses", () => {
  for (const th of [5, 17, 30, 45, 60, 90, 120, 150, 170]) {
    const b = bFromTheta(th * DEG, kAu(), E0);
    assert.ok(Math.abs(thetaFromB(b, kAu(), E0) / DEG - th) < 1e-9, `roundtrip ${th}°`);
  }
});

test("the 90° threshold is b₉₀ = k/2E", () => {
  assert.ok(Math.abs(bFromTheta(90 * DEG, kAu(), E0) - kAu() / (2 * E0)) < 1e-12);
  assert.ok(Math.abs(bFromTheta(90 * DEG, kAu(), E0) - 14.7929) < 0.001);
  assert.equal(thetaFromB(kAu() / (2 * E0), kAu(), E0), 90 * DEG);
});

test("r_min: head-on is d = k/E; at b₉₀ it is (1+√2)·b₉₀", () => {
  assert.ok(Math.abs(rMin(0, kAu(), E0) - headOnDistance(kAu(), E0)) < 1e-12);
  assert.ok(Math.abs(rMin(0, kAu(), E0) - 29.5857) < 0.001);
  const b9 = bFromTheta(90 * DEG, kAu(), E0);
  assert.ok(Math.abs(rMin(b9, kAu(), E0) / b9 - (1 + Math.SQRT2)) < 1e-12);
});

test("numeric RK4 trajectory reproduces the closed-form angle (launch solved on the true asymptote)", () => {
  for (const [E, b] of [[E0, 14.7929], [5.5, 31.82], [E0, 5], [40, 5.33]]) {
    const y = launchYForB(b, kAu(), E, 620, 1.0);
    const tr = traceTrajectory({ k: kAu(), eMeV: E, bFm: y, x0Fm: 620, dTau: 1.0 });
    const closed = thetaFromB(b, kAu(), E);
    assert.ok(Math.abs(tr.theta - closed) < 1e-4 * DEG, `θ at E=${E}, b=${b}`);
  }
});

test("numeric closest approach matches r_min(b) to 0.05 fm", () => {
  for (const [E, b] of [[E0, 14.7929], [5.5, 31.82], [40, 5.33]]) {
    const y = launchYForB(b, kAu(), E, 620, 1.0);
    const tr = traceTrajectory({ k: kAu(), eMeV: E, bFm: y, x0Fm: 620, dTau: 1.0 });
    assert.ok(Math.abs(tr.rMinSeen - rMin(b, kAu(), E)) < 0.05, `r_min at E=${E}, b=${b}`);
  }
});

test("head-on numeric: exactly 180°, turning at d = k/E", () => {
  const tr = traceTrajectory({ k: kAu(), eMeV: E0, bFm: 1e-4, x0Fm: 620, dTau: 1.0 });
  assert.ok(Math.abs(tr.theta - Math.PI) < 0.01 * DEG);
  assert.ok(Math.abs(tr.rMinSeen - kAu() / E0) < 0.01);
});

test("cosec⁴ ratios: σ(150°)/σ(30°) = (sin15°/sin75°)⁴", () => {
  const k = kAu(), E = 5.5;
  const ratio = dsigmaDOmega(150 * DEG, k, E) / dsigmaDOmega(30 * DEG, k, E);
  const closed = (Math.sin(15 * DEG) / Math.sin(75 * DEG)) ** 4;
  assert.ok(Math.abs(ratio - closed) / closed < 1e-12);
  // the Manchester dynamic range: ~1:194
  assert.ok(Math.abs(1 / ratio - 194) < 1);
});

test("the integral of dσ/dΩ above θ₀ is exactly π·b(θ₀)² (numeric quadrature)", () => {
  const k = kAu(), E = 5.5;
  for (const th0 of [30, 90, 120]) {
    const N = 20000;
    let s = 0;
    for (let i = 0; i < N; i++) {
      const th = (th0 + (179.999 - th0) * (i + 0.5) / N) * DEG;
      s += 2 * Math.PI * Math.sin(th) * dsigmaDOmega(th, k, E) * ((179.999 - th0) / N) * DEG;
    }
    const closed = sigmaAbove(th0 * DEG, k, E);
    assert.ok(Math.abs(s - closed) / closed < 1e-6, `σ(>${th0}°) quadrature`);
  }
  // and the closed form is π·b(θ₀)² by construction
  assert.ok(Math.abs(sigmaAbove(90 * DEG, k, E) - Math.PI * bFromTheta(90 * DEG, k, E) ** 2) < 1e-9);
});

test("number density of gold ≈ 5.90×10²⁸ /m³", () => {
  const n = numberDensity(AU);
  assert.ok(Math.abs(n - 5.9e28) / 5.9e28 < 0.01);
});

test("P = n·t·σ is linear in t, and the 1-in-8000 foil is ≈3.08 µm", () => {
  const k = kAu();
  const p1 = probAbove(90 * DEG, k, E0, AU, 1e-6);
  const p2 = probAbove(90 * DEG, k, E0, AU, 2e-6);
  assert.ok(Math.abs(p2 - 2 * p1) < 1e-18);
  const t = foilForOneIn(8000, 90 * DEG, k, E0, AU);
  assert.ok(t > 3.0e-6 && t < 3.2e-6, `t = ${t * 1e6} µm`);
  assert.equal(Math.round(oneInN(90 * DEG, k, E0, AU, t)), 8000);
  // the 0.4 µm bench foil: ~1 in 61,600
  assert.ok(Math.abs(oneInN(90 * DEG, k, E0, AU, 0.4e-6) - 61600) / 61600 < 0.01);
});

test("contact: E_crit = k/R_c; θ_c exists only above it; r_min(b_c) = R_c", () => {
  const k = kAu();
  const ec = eCritContact(k, AU);
  assert.ok(Math.abs(ec - 25.6) < 0.05);
  assert.equal(thetaContact(ec * 0.999, k, AU), null);
  assert.equal(contactBCrit(ec * 1.001, k, AU) !== null, true);
  const bc = contactBCrit(40, k, AU);
  assert.ok(Math.abs(rMin(bc, k, 40) - contactRadius(197)) < 1e-9);
  // at 40 MeV the departure angle is ≈56°: beyond it, Rutherford is a fiction
  assert.ok(Math.abs(thetaContact(40, k, AU) / DEG - 56.2) < 0.2);
  // aluminium: contact already at 6.8 MeV — the light-element anomaly
  assert.ok(Math.abs(eCritContact(kAl(), AL) - 6.80) < 0.05);
});

test("1919: Q(¹⁴N+α→¹⁷O+p) = −1.192 MeV, threshold 1.53 MeV, RaC′ clears it", () => {
  const q = qValue1919();
  assert.ok(Math.abs(q + 1.1919) < 0.001);
  assert.ok(q < 0); // endothermic — the alpha must pay
  const th = threshold1919();
  assert.ok(Math.abs(th - 1.532) < 0.002);
  assert.ok(th === -q * (1 + REACTION.mHe4 / REACTION.mN14));
  assert.ok(7.69 > th * 3); // the 7.69 MeV line had plenty to spare
});

test("alpha speed: v/c = √(2E/m), 6.4% at 7.69 MeV — no relativity needed", () => {
  assert.ok(Math.abs(alphaBeta(E0) - Math.sqrt(2 * E0 / M_ALPHA)) < 1e-12);
  assert.ok(Math.abs(alphaBeta(E0) - 0.0642) < 0.001);
  assert.ok(alphaBeta(40) < 0.15);
});

test("Geiger range rule: 7.69 MeV α stops in ~7 cm of air", () => {
  const r = alphaRangeAirCm(E0);
  assert.ok(r > 6 && r < 8, `range ${r}`);
});

test("presets: manchester bench ≈1 in 61,600; the 1-in-8000 preset lands on 8,000", () => {
  const man = PRESETS.find((p) => p.id === "manchester1909");
  const one = PRESETS.find((p) => p.id === "one-in-8000");
  const kman = kZZ(ELEMENTS[man.el].z), kone = kZZ(ELEMENTS[one.el].z);
  const nMan = oneInN(90 * DEG, kman, man.eMeV, ELEMENTS[man.el], man.tUm * 1e-6);
  assert.ok(Math.abs(nMan - 61600) / 61600 < 0.01);
  const nOne = oneInN(90 * DEG, kone, one.eMeV, ELEMENTS[one.el], one.tUm * 1e-6);
  assert.ok(Math.abs(nOne - 8000) / 8000 < 1e-3);
  // the aluminium preset sits above its contact energy
  const al = PRESETS.find((p) => p.id === "aluminium-anomaly");
  assert.ok(al.eMeV > eCritContact(kAl(), AL));
  // and the accelerator preset storms into the contact zone on gold
  const acc = PRESETS.find((p) => p.id === "accelerator-era");
  assert.ok(acc.eMeV > eCritContact(kAu(), AU));
  assert.ok(thetaContact(acc.eMeV, kAu(), AU) !== null);
});
