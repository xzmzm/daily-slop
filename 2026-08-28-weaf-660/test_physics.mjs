// test_physics.mjs — node --test test_physics.mjs
// Validates the WEAF 660 engine: the AM trigonometric identity, the exact
// 1/3 sideband power split at full modulation, overmodulation sign flips,
// the square-law detector's m/4 distortion by numeric quadrature, the
// diagonal-clipping RC bound by simulation, the 232.6 pF tuning calibration,
// the −3 dB bandwidth identity, neighbour detuning, wavelength arithmetic,
// the two-ray fade and its perfect null, and the $50 ledger.

import test from "node:test";
import assert from "node:assert/strict";

import {
  TAU,
  C_LIGHT,
  WEAF_KHZ,
  RX_DEFAULTS,
  PRESETS,
  STATIONS,
  amSignal,
  amThreeCosines,
  sidebandAmp,
  sidebandPowerFrac,
  carrierPowerFrac,
  totalPower,
  envelope,
  envelopeZeroCrossings,
  sqFundamentalAmp,
  sqSecondHarmonicAmp,
  sqDistortion,
  maxLoadRC,
  rippleDroop,
  simulateDetector,
  resFreq,
  capFor,
  qSeries,
  bandwidth,
  detuneResponse,
  stagesResponse,
  toDb,
  wavelength,
  quarterWave,
  groundWaveE,
  skywavePath,
  pathDiff,
  phaseFromPath,
  twoRay,
  DOLLARS_PER_MIN,
  DOLLARS_PER_SEC,
  OCTOBER_SPOTS,
} from "./physics.js";

const close = (actual, expected, tol, label) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: got ${actual}, want ${expected} ± ${tol}`
  );
const relclose = (actual, expected, rel, label) =>
  assert.ok(
    Math.abs(actual - expected) <= Math.abs(expected) * rel,
    `${label}: got ${actual}, want ${expected} (rel ${rel})`
  );

test("AM identity: the product form IS three cosines", () => {
  // any A, m (including overmodulated), fm, fc. Agreement is limited only by
  // double-precision cos() of ~10⁵-rad phases (~1e-6), not by the identity.
  for (const [A, m, fm, fc] of [[1, 0.85, 800, 660e3], [2, 1.0, 440, 570e3], [1, 1.35, 800, 660e3], [3, 0.3, 2500, 1130e3]]) {
    for (const t of [0, 1e-4, 3.7e-3, 0.1173]) {
      close(
        amSignal(t, A, m, fm, fc),
        amThreeCosines(t, A, m, fm, fc),
        Math.abs(amSignal(t, A, m, fm, fc)) * 2e-6 + 1e-12,
        `product ≡ sum at t=${t}, m=${m}`
      );
    }
  }
});

test("sidebands sit A·m/2 tall; at m=1 each is half the carrier", () => {
  close(sidebandAmp(1, 1), 0.5, 1e-15, "sideband amplitude");
  relclose(sidebandAmp(7, 0.85), 7 * 0.85 / 2, 1e-15, "linear in A and m");
});

test("power split: m²/(2+m²) is exactly 1/3 at full modulation", () => {
  close(sidebandPowerFrac(1), 1 / 3, 1e-15, "1/3");
  close(carrierPowerFrac(1), 2 / 3, 1e-15, "2/3");
  close(sidebandPowerFrac(0), 0, 1e-15, "no modulation, no information power");
  close(sidebandPowerFrac(0.85), 0.7225 / 2.7225, 1e-15, "m = 0.85");
  // and it is the same fraction the power ledger computes from amplitudes
  const A = 2, m = 0.7;
  const pCarrier = (A * A) / 2;
  const pSide = 2 * ((A * m) / 2) ** 2 / 2;
  relclose(pSide / (pCarrier + pSide), sidebandPowerFrac(m), 1e-12, "ledger view");
  relclose(totalPower(A, m), pCarrier + pSide, 1e-12, "total power");
  assert.ok(sidebandPowerFrac(0.9) > sidebandPowerFrac(0.5), "monotone in m");
});

test("overmodulation: the envelope crosses zero exactly twice per cycle", () => {
  assert.equal(envelopeZeroCrossings(0.85), 0);
  assert.equal(envelopeZeroCrossings(1), 0); // touching, not crossing
  assert.equal(envelopeZeroCrossings(1.35), 2);
  assert.equal(envelopeZeroCrossings(2.7), 2);
  // count the crossings numerically for m = 1.35 over one audio period
  let crossings = 0, prev = envelope(0, 1, 1.35, 800);
  for (let i = 1; i <= 4000; i++) {
    const now = envelope(i / 4000 / 800, 1, 1.35, 800);
    if ((prev < 0 && now >= 0) || (prev > 0 && now <= 0)) crossings++;
    prev = now;
  }
  assert.equal(crossings, 2, "numeric crossing count");
});

test("square-law detection: fundamental A²m, second harmonic A²m²/4 — checked by quadrature", () => {
  const A = 1, m = 0.85, fm = 800, fc = fm * 50; // integer ratio kills RF leakage
  const T = 1 / fm, N = 400000;
  let proj1 = 0, proj2 = 0;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) * (T / N);
    const v = amSignal(t, A, m, fm, fc);
    proj1 += v * v * Math.cos(TAU * fm * t);
    proj2 += v * v * Math.cos(TAU * 2 * fm * t);
  }
  proj1 *= (2 / N); // cosine-series coefficient
  proj2 *= (2 / N);
  relclose(proj1, sqFundamentalAmp(A, m), 1e-6, "audio fundamental A²m");
  relclose(proj2, sqSecondHarmonicAmp(A, m), 1e-6, "second harmonic A²m²/4");
});

test("a crystal set's distortion is exactly m/4: 25% at full modulation", () => {
  for (const m of [0.4, 0.85, 1]) {
    relclose(
      sqSecondHarmonicAmp(1, m) / sqFundamentalAmp(1, m),
      m / 4, 1e-15, `m = ${m}`
    );
  }
  close(sqDistortion(1), 0.25, 1e-15, "m = 1 → 25%");
  close(sqDistortion(0.85), 0.2125, 1e-15, "m = 0.85 → 21.25%");
});

test("diagonal clipping: RC ≤ √(1−m²)/(m·ω_m) is the exact envelope bound", () => {
  const m = 0.85, fm = 800, fc = 660e3;
  close(maxLoadRC(m, fm), Math.sqrt(1 - m * m) / (m * TAU * fm), 1e-18, "bound value");
  close(maxLoadRC(m, fm), 123.3e-6, 0.1e-6, "≈ 123 µs for WEAF's m and fm");
  // comfortably inside the bound: the follower tracks, nothing is clipped
  const ok = simulateDetector({ A: 1, m, fm, fc, RC: 0.75 * maxLoadRC(m, fm) });
  assert.equal(ok.clippedFrac, 0, "no clipping at 0.75× the bound");
  // and its output hugs the envelope
  let err = 0;
  for (let i = 0; i < ok.n; i++) err = Math.max(err, Math.abs(ok.out[i] - ok.env[i]));
  assert.ok(err < 0.03, `tracking error ${err} < 3%`);
  // beyond the bound: the output rides above the falling envelope
  const bad = simulateDetector({ A: 1, m, fm, fc, RC: 1.6 * maxLoadRC(m, fm) });
  assert.ok(bad.clippedFrac > 0.005, `clipped fraction ${bad.clippedFrac} > 0.5%`);
  const worse = simulateDetector({ A: 1, m, fm, fc, RC: 3 * maxLoadRC(m, fm) });
  assert.ok(worse.clippedFrac > bad.clippedFrac, "monotone: bigger RC, more clipping");
});

test("ripple between carrier peaks: droop is 1 − e^(−T_c/RC)", () => {
  close(rippleDroop(660e3, 60e-6), 1 - Math.exp(-1 / (660e3 * 60e-6)), 1e-15, "exact");
  close(rippleDroop(660e3, 60e-6), 0.0249, 0.0004, "2.5% at the 1922 defaults");
  // a 60 µs load drops ~2.5% per carrier cycle — ripple you can hear if the
  // load shrinks an order of magnitude
  assert.ok(rippleDroop(660e3, 6e-6) > 0.2, "6 µs → >20% ripple");
});

test("tuning calibration: 250 µH + 232.6 pF lands exactly on WEAF's 660", () => {
  const f0 = resFreq(250e-6, 232.6e-12);
  close(f0, 660e3, 400, "kHz-dead-on"); // ±0.4 kHz
  relclose(capFor(660e3, 250e-6), 232.6e-12, 2e-3, "C for 660 kHz");
  relclose(resFreq(250e-6, capFor(660e3, 250e-6)), 660e3, 1e-12, "round trip");
  // and it sits mid-travel on the standard 15–365 pF variable capacitor
  const travel = (232.6 - 15) / (365 - 15);
  assert.ok(travel > 0.5 && travel < 0.75, `dial travel ${(travel * 100).toFixed(1)}%`);
});

test("the tank: Q = ωL/R ≈ 104, BW ≈ 6.4 kHz — one station just fits", () => {
  const { LuH, coilR } = RX_DEFAULTS;
  const Q = qSeries(660e3, LuH * 1e-6, coilR);
  close(Q, 103.67, 0.02, "Q at 660 kHz");
  close(bandwidth(660e3, Q), 6366, 3, "bandwidth in Hz");
  assert.ok(bandwidth(660e3, Q) > 5000 && bandwidth(660e3, Q) < 8000, "5–8 kHz");
});

test("detuning: −3 dB exactly at Δf = BW/2; neighbours barely suppressed", () => {
  const f0 = 660e3, Q = qSeries(f0, RX_DEFAULTS.LuH * 1e-6, RX_DEFAULTS.coilR);
  const half = bandwidth(f0, Q) / 2;
  close(detuneResponse(half, f0, Q), Math.SQRT1_2, 1e-12, "half-BW is the −3 dB point");
  close(detuneResponse(0, f0, Q), 1, 1e-12, "peak at resonance");
  // 20 kHz away (the 1922-era neighbour): only −16 dB on one circuit
  close(toDb(detuneResponse(20e3, f0, Q)), -16.08, 0.05, "single stage");
  // two ganged circuits square the response — the honest fix for crosstalk
  close(toDb(stagesResponse(20e3, f0, Q, 2)), -32.16, 0.1, "two stages");
  relclose(stagesResponse(20e3, f0, Q, 2), detuneResponse(20e3, f0, Q) ** 2, 1e-12, "exact square");
});

test("wavelength arithmetic: λ = c/f and φ = 2π·ΔL/λ", () => {
  close(wavelength(660e3), 454.231, 0.01, "λ at 660 kHz");
  close(quarterWave(660e3), 113.558, 0.01, "λ/4 mast");
  relclose(wavelength(660e3) * 660e3, C_LIGHT, 1e-12, "λ·f = c");
  close(phaseFromPath(wavelength(660e3) / 2, 660e3), Math.PI, 1e-9, "λ/2 → π");
  close(phaseFromPath(wavelength(660e3), 660e3), TAU, 1e-9, "λ → 2π");
  // a half-wave of path difference is one full crest-to-null swing
});

test("ground wave spreads 1/d; the skywave's one-hop geometry is exact", () => {
  relclose(groundWaveE(100, 1, 2), 50, 1e-15, "inverse distance");
  relclose(groundWaveE(100, 10, 40), 25, 1e-15, "4× the distance → ¼ the field");
  close(skywavePath(40, 100), 2 * Math.sqrt(400 + 10000), 1e-9, "40 km, 100 km hop");
  close(pathDiff(40, 100), 163.9608, 0.001, "path difference in km");
});

test("the two-ray fade: equal amplitudes, opposite phase → zero", () => {
  close(twoRay(1, 1, Math.PI), 0, 1e-15, "perfect null");
  close(twoRay(1, 0.95, Math.PI), 0.05, 1e-15, "ρ = 0.95 → −26 dB");
  close(twoRay(1, 0.95, 0), 1.95, 1e-15, "in phase → constructive");
  // numeric phasor check
  for (const [eg, es, phi] of [[1, 0.9, 0.7], [2, 0.5, 2.9], [1, 1.2, 1.1]]) {
    const re = eg + es * Math.cos(phi), im = es * Math.sin(phi);
    close(twoRay(eg, es, phi), Math.hypot(re, im), 1e-14, "phasor equivalence");
  }
});

test("the ledger: $50 for ten minutes, $550 by October — eleven spots", () => {
  assert.equal(DOLLARS_PER_MIN, 5);
  close(DOLLARS_PER_SEC, 0.08333, 0.0001, "8.33 cents a second");
  assert.equal(OCTOBER_SPOTS, 11);
});

test("presets carry the story", () => {
  assert.ok(PRESETS.air.tx.m <= 1, "on-air: within the modulation law");
  assert.ok(PRESETS.splatter.tx.m > 1, "splatter: overmodulated");
  assert.equal(envelopeZeroCrossings(PRESETS.splatter.tx.m), 2, "and it shows");
  const mid = PRESETS.midnight.prop;
  assert.ok(mid.night && mid.skyAmp >= 0.9, "midnight: strong skywave");
  assert.ok(twoRay(1, mid.skyAmp, Math.PI) < 0.12, "with a near-perfect null available");
  const ct = PRESETS.crosstalk.rx;
  const f0 = resFreq(ct.LuH * 1e-6, ct.capPf * 1e-12);
  assert.ok(f0 > 665e3 && f0 < 675e3, `mistuned to ${(f0 / 1e3).toFixed(0)} kHz`);
  const Q = qSeries(f0, ct.LuH * 1e-6, ct.coilR);
  const db = (khz) => toDb(detuneResponse(Math.abs(khz * 1e3 - f0), f0, Q));
  assert.ok(db(WEAF_KHZ) > -11 && db(680) > -11, "both stations within 11 dB");
  assert.ok(STATIONS.filter((s) => s.id === "weaf").length === 1, "WEAF is on the band");
  assert.ok(STATIONS.every((s) => Math.abs(s.khz - WEAF_KHZ) % 20 === 0), "1922 channel plan");
});
