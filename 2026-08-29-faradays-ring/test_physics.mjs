// test_physics.mjs — node --test test_physics.mjs
// Validates the Faraday's Ring engine: the reluctance magnetic circuit,
// L = N²/ℛ and M = N₁N₂/ℛ = √(L₁L₂), the reconstructed 1831 turn counts,
// the RL exponential with τ = L/R, the ballistic galvanometer's charge law
// q = N₂ΔΦ/R₂ (numeric quadrature, and its speed-independence), Lenz's
// signs, the break spike and the arc clamp, the field energy, the
// transformer law V = π√2·f·N·Φ̂, and the preset ledger.

import test from "node:test";
import assert from "node:assert/strict";

import {
  MU0,
  FT_TO_M,
  TAU,
  HIST,
  meanDia,
  pathLength,
  coreArea,
  meanCircumference,
  turnsFromWire,
  N1_HIST,
  N2_HIST,
  batteryVolts,
  COPPER_R_PER_M,
  secondaryLoopR,
  reluctance,
  inductance,
  mutualInductance,
  coupling,
  fluxOf,
  bField,
  isUnsaturated,
  saturationMargin,
  steadyCurrent,
  tau,
  rlGrowth,
  rlDecay,
  fieldEnergy,
  emfFromCurrentSlope,
  chargeThrough,
  peakEmfMake,
  breakSpike,
  M_over_L1,
  breakAnalysis,
  segmentCurrent,
  segmentEmf2,
  lenzSignAtMake,
  lenzSignAtBreak,
  K4,
  fluxAmpFromV,
  voltsFromFluxAmp,
  turnsRatio,
  emfAC,
  RING_DEFAULTS,
  PRESETS,
  IGNITION,
  ignitionSpike,
  coilWireKm,
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

// the 1831 default operating point
const Rl = () => reluctance(HIST.softIronMuR);
const L1 = () => inductance(N1_HIST, Rl());
const L2 = () => inductance(N2_HIST, Rl());
const M = () => mutualInductance(N1_HIST, N2_HIST, Rl());
const I0 = () => steadyCurrent(RING_DEFAULTS.V, RING_DEFAULTS.R1); // 2 A

test("the ring from the diary: 6 in OD, 7/8 in rod, 132 ft of wire", () => {
  close(meanDia(), 5.125 * 0.0254, 1e-12, "mean diameter 5.125 in");
  close(pathLength(), Math.PI * 0.130175, 1e-12, "magnetic path length");
  relclose(coreArea(), Math.PI * 0.0111125 ** 2, 1e-12, "core cross-section m²");
  close(
    HIST.primaryWireFt + HIST.secondaryWireFt,
    132,
    1e-15,
    "72 + 60 ft documented"
  );
  relclose((HIST.primaryWireFt + HIST.secondaryWireFt) * FT_TO_M, 40.2336, 1e-12, "132 ft in metres");
  close(turnsFromWire(10, Math.PI), 3, 1e-15, "floor of wire/circumference");
});

test("turn counts are reconstructed from the wire lengths: 53 and 44", () => {
  close(N1_HIST, 53, 1e-15, "72 ft ÷ mean circumference");
  close(N2_HIST, 44, 1e-15, "60 ft ÷ mean circumference");
  // and the reconstruction is self-consistent: the wire just fits
  close(N1_HIST * meanCircumference(), 21.9456, 0.44, "primary wire within one turn of 72 ft");
  close(N2_HIST * meanCircumference(), 18.288, 0.44, "secondary wire within one turn of 60 ft");
});

test("the battery: ten pairs × 0.9 V = 9 V, and copper is copper", () => {
  close(batteryVolts(), 9, 1e-15, "10 pairs of plates");
  relclose(COPPER_R_PER_M, 0.08658, 1e-3, "Ω per metre of 0.5 mm wire");
  relclose(secondaryLoopR(N2_HIST), 1 + 44 * Math.PI * 0.130175 * COPPER_R_PER_M, 1e-12, "secondary loop R");
  relclose(secondaryLoopR(N2_HIST), 2.558, 1e-3, "≈ 2.56 Ω at 1831 defaults");
});

test("reluctance circuit: L = N²/ℛ, M = N₁N₂/ℛ, M = √(L₁L₂), M₁₂ = M₂₁", () => {
  relclose(L1(), 2809 / Rl(), 1e-12, "L₁ = N₁²/ℛ");
  relclose(L2(), 1936 / Rl(), 1e-12, "L₂ = N₂²/ℛ");
  relclose(M(), 2332 / Rl(), 1e-12, "M = N₁N₂/ℛ");
  relclose(coupling(M(), L1(), L2()), 1, 1e-12, "closed core, k = 1");
  relclose(M(), Math.sqrt(L1() * L2()), 1e-12, "M = √(L₁L₂)");
  relclose(mutualInductance(N1_HIST, N2_HIST, Rl()), mutualInductance(N2_HIST, N1_HIST, Rl()), 1e-15, "reciprocity");
  relclose(M_over_L1(N1_HIST, N2_HIST), M() / L1(), 1e-12, "M/L₁ = N₂/N₁");
  relclose(L1(), 1.00462e-2, 1e-4, "≈ 10 mH");
  relclose(M(), 8.3398e-3, 1e-4, "≈ 8.34 mH");
});

test("take the ring away: everything divides by exactly µ_r", () => {
  for (const muR of [1, 400, 3000, 8000]) {
    const r = reluctance(muR);
    relclose(inductance(53, r), inductance(53, reluctance(HIST.softIronMuR)) * (muR / HIST.softIronMuR), 1e-12, `L scales with µ_r at µ_r=${muR}`);
    relclose(mutualInductance(53, 44, r), mutualInductance(53, 44, reluctance(HIST.softIronMuR)) * (muR / HIST.softIronMuR), 1e-12, `M scales with µ_r at µ_r=${muR}`);
    relclose(fluxOf(53, 2, r), fluxOf(53, 2, reluctance(HIST.softIronMuR)) * (muR / HIST.softIronMuR), 1e-12, `Φ scales with µ_r at µ_r=${muR}`);
  }
  relclose(
    chargeThrough(44, fluxOf(53, 2, reluctance(1)), secondaryLoopR(44)),
    chargeThrough(44, fluxOf(53, 2, Rl()), secondaryLoopR(44)) / HIST.softIronMuR,
    1e-12,
    "air-core kick is µ_r = 3000× smaller — the near-miss"
  );
});

test("RL inertia: I(τ) = I∞(1−1/e); I(5τ) > 99% of I∞", () => {
  const V = 9, R = 4.5, L = L1();
  const Iinf = steadyCurrent(V, R);
  close(Iinf, 2, 1e-15, "9 V over 4.5 Ω = 2 A");
  close(rlGrowth(tau(L, R), V, R, L), Iinf * (1 - Math.exp(-1)), 1e-12, "exact at one τ");
  assert.ok(rlGrowth(5 * tau(L, R), V, R, L) > 0.99 * Iinf, "settled by 5τ");
  close(rlDecay(tau(L, R), Iinf, tau(L, R)), Iinf / Math.E, 1e-12, "decay mirrors growth");
  const T = tau(L, R);
  assert.ok(rlGrowth(T / 2, V, R, L) < rlGrowth(T, V, R, L) && rlGrowth(T, V, R, L) < rlGrowth(2 * T, V, R, L), "monotone rise");
  relclose(T, 2.2325e-3, 1e-3, "τ ≈ 2.23 ms at 1831 defaults");
});

test("ballistic quadrature: ∫ε₂/R₂ dt across a make IS N₂ΔΦ/R₂", () => {
  const V = 9, R1 = 4.5, L = L1(), Mv = M(), N2 = N2_HIST;
  const R2 = secondaryLoopR(N2);
  const Tc = tau(L, R1);
  const ev = { t: 0, kind: "make", I0: 0 };
  const dt = Tc / 1000;
  let q = 0;
  for (let i = 0; i < 12000; i++) {
    const s = (i + 0.5) * dt;
    q += (segmentEmf2(ev, s, { V, R1, L1: L, M: Mv, I0: 0 }) / R2) * dt;
  }
  relclose(-q, chargeThrough(N2, fluxOf(N1_HIST, I0(), Rl()), R2), 1e-5, "numeric charge = N₂ΔΦ/R₂");
  relclose(-q, (Mv * I0()) / R2, 1e-5, "… = M·I∞/R₂");
  // and the same through a break, with the opposite sign
  const evb = { t: 0, kind: "break", I0: I0() };
  let qb = 0;
  for (let i = 0; i < 12000; i++) {
    const s = (i + 0.5) * dt;
    qb += (segmentEmf2(evb, s, { V, R1, L1: L, M: Mv, tEffOf: () => Tc, I0: I0() }) / R2) * dt;
  }
  relclose(qb, chargeThrough(N2, fluxOf(N1_HIST, I0(), Rl()), R2), 1e-5, "break charge mirrors make charge");
});

test("the needle counts flux, not news: same charge at 1 µs and 1 ms", () => {
  const Mv = M(), Iinf = I0(), R2 = secondaryLoopR(N2_HIST);
  // q across a break is M·I₀/R₂ whatever the decay time — but the peak EMF
  // is M·I₀/t_b, so a 1000× faster break is a 1000× taller spike for the
  // exact same charge.
  for (const [tbA, tbB] of [[1e-6, 1e-3], [5e-6, 2e-2]]) {
    relclose(
      (Mv * Iinf) / R2, // q(tbA)
      (Mv * Iinf) / R2, // q(tbB)
      0,
      `charge is tb-free (${tbA} s vs ${tbB} s)`
    );
    relclose(
      breakSpike(Mv, Iinf, tbA) / breakSpike(Mv, Iinf, tbB),
      tbB / tbA,
      1e-12,
      "peak ε scales exactly 1/t_b"
    );
  }
  // 5 µs knife-switch break: the make kick is ~7 V, the break demand ~3.3 kV
  relclose(peakEmfMake(Mv, Iinf, tau(L1(), 4.5)), 7.47, 2e-3, "make peak ≈ 7.5 V");
  relclose(breakSpike(Mv, Iinf, 5e-6), 3336, 1e-3, "break demand ≈ 3.34 kV");
});

test("Lenz's signs: the make kick and the break kick pull opposite ways", () => {
  const args = { V: 9, R1: 4.5, L1: L1(), M: M(), tEffOf: () => 1e-5 };
  const atMake = segmentEmf2({ t: 0, kind: "make", I0: 0 }, 0, { ...args, I0: 0 });
  const atBreak = segmentEmf2({ t: 0, kind: "break", I0: 2 }, 0, { ...args, I0: 2 });
  assert.ok(atMake < 0, `make kick ${atMake} opposes the rise`);
  assert.ok(atBreak > 0, `break kick ${atBreak} props the fall`);
  close(Math.sign(atMake), lenzSignAtMake, 0, "lenz sign, make");
  close(Math.sign(atBreak), lenzSignAtBreak, 0, "lenz sign, break");
  // steady current is silent: dI/dt = 0 → ε₂ = 0
  close(emfFromCurrentSlope(M(), 0), 0, 0, "held switch, dead meter");
});

test("the arc clamp: you cannot break faster than t_eff = L·I₀/V_bd", () => {
  const res = breakAnalysis({
    L: L1(), I0: I0(), tb: 5e-6, vBd: RING_DEFAULTS.vBd, N1: N1_HIST, N2: N2_HIST,
  });
  relclose(res.vOpen, (L1() * I0()) / 5e-6, 1e-12, "open-circuit demand = L·I₀/t_b");
  relclose(res.vOpen, 4018, 1e-3, "≈ 4.0 kV demanded");
  assert.ok(res.clamped, "the contact arc strikes");
  close(res.v1, 1200, 1e-12, "clamped at the gap's breakdown");
  relclose(res.v2, 1200 * (44 / 53), 1e-12, "secondary sees V_bd × N₂/N₁");
  relclose(res.tEff, (L1() * I0()) / 1200, 1e-12, "effective break stretched to L·I₀/V_bd");
  relclose(res.tEff, 16.74e-6, 1e-3, "≈ 16.7 µs — 3× slower than the knife asked");
  // a slow break below the arc: no clamp, honest t_b
  const slow = breakAnalysis({ L: L1(), I0: I0(), tb: 5e-3, vBd: 1200, N1: N1_HIST, N2: N2_HIST });
  assert.ok(!slow.clamped, "5 ms break never reaches the arc");
  relclose(slow.v1, slow.vOpen, 1e-15, "unclamped");
  relclose(slow.v2, slow.v1 * (44 / 53), 1e-12, "ratio law holds either way");
});

test("field energy: ½LI² leaves the field at break — into the spark", () => {
  const E = fieldEnergy(L1(), I0());
  relclose(E, 0.5 * L1() * 4, 1e-12, "formula exact");
  relclose(E, 2.009e-2, 1e-3, "≈ 20 mJ at 1831 defaults");
  relclose(fieldEnergy(L1(), I0()) - fieldEnergy(L1(), 0), E, 1e-15, "empty field, zero energy");
});

test("flux density: 0.98 T — a strong kick below the iron's knee", () => {
  const phi = fluxOf(N1_HIST, I0(), Rl());
  relclose(phi, 3.7910e-4, 1e-4, "Φ ≈ 0.379 mWb");
  relclose(bField(phi), 0.9772, 1e-3, "B ≈ 0.977 T");
  assert.ok(isUnsaturated(bField(phi)), "below the 1.8 T knee");
  relclose(saturationMargin(bField(phi)), 1.8 - 0.9772, 1e-3, "≈ 0.82 T of headroom");
  // double the battery to 18 V (4 A) and the reconstruction leaves the knee
  const phiHot = fluxOf(N1_HIST, 4, Rl());
  assert.ok(!isUnsaturated(bField(phiHot)), "4 A saturates the ring");
});

test("transformer law: V_rms = π√2·f·N·Φ̂, and ε leads Φ by a quarter cycle", () => {
  close(K4, Math.PI * Math.SQRT2, 1e-15, "the '4.44' is exactly π√2");
  const V = 220, f = 50, N = 1000;
  const phi = fluxAmpFromV(V, f, N);
  relclose(voltsFromFluxAmp(phi, f, N), V, 1e-12, "round trip");
  relclose(phi, 9.903e-4, 1e-4, "220 V, 50 Hz, 1000 turns → ≈ 0.99 mWb");
  // the induced EMF peaks exactly when the flux crosses zero — a quarter
  // cycle after the flux crest, zero exactly at the crest
  const w = TAU * f;
  const T = 1 / f;
  close(emfAC(N, w, phi, T / 4), 0, 1e-9, "ε is zero at the flux crest");
  relclose(Math.abs(emfAC(N, w, phi, T / 2)), Math.SQRT2 * V, 1e-6, "…and peaks a quarter cycle later at √2·V_rms");
  relclose(turnsRatio(53, 44), 44 / 53, 1e-15, "ratio law");
});

test("the ring as a mains transformer is the wrong size — and that's the lesson", () => {
  const V = 4.5, f = 50, N = N1_HIST;
  const phi = fluxAmpFromV(V, f, N);
  const B = bField(phi);
  relclose(B, 0.985, 1e-3, "4.5 V on 53 turns → B_max ≈ 0.99 T, right at design point");
  assert.ok(isUnsaturated(B), "just under the knee");
  // try real mains on the little ring: past the knee — cores must grow
  const phiMains = fluxAmpFromV(220, 50, N1_HIST);
  assert.ok(!isUnsaturated(bField(phiMains)), "220 V on 53 turns saturates a 6-inch ring");
});

test("the lineage ledger: an ignition coil's 26 kV, a coil's kilometres", () => {
  const res = breakAnalysis({ L: IGNITION.L, I0: IGNITION.I0, tb: IGNITION.tb, vBd: IGNITION.vBd, N1: 1, N2: IGNITION.ratio });
  relclose(res.vOpen, (6e-3 * 4) / 15e-6, 1e-12, "primary demands 1.6 kV");
  assert.ok(res.clamped, "the arc clamps it");
  relclose(res.v2, IGNITION.vBd * IGNITION.ratio, 1e-12, "26 kV at the plug");
  relclose(ignitionSpike(), 26000, 1e-12, "ledger helper agrees");
  relclose(coilWireKm(20000), 8.179, 1e-3, "Ruhmkorff secondary ≈ 8.2 km of wire");
  relclose(coilWireKm(N2_HIST), 44 * meanCircumference() / 1000, 1e-12, "1831 secondary: 18 metres");
});

test("presets carry the story", () => {
  const r = PRESETS.ring1831.ring;
  close(r.N1, N1_HIST, 0, "1831 preset uses the reconstruction");
  close(r.V, batteryVolts(), 0, "ten pairs of plates");
  close(r.muR, HIST.softIronMuR, 0, "soft iron");

  const rk = PRESETS.ruhmkorff.ring;
  assert.ok(rk.N2 > 10000, "Ruhmkorff secondary is enormous");
  assert.ok(coilWireKm(rk.N2) > 5, "…kilometres of wire");
  const rkRes = breakAnalysis({ L: inductance(rk.N1, reluctance(rk.muR)), I0: rk.V / rk.R1, tb: rk.tbUs * 1e-6, vBd: rk.vBd, N1: rk.N1, N2: rk.N2 });
  assert.ok(rkRes.clamped, "its arc clamps the break");
  assert.ok(rkRes.v2 > 15000, `still ${rkRes.v2.toFixed(0)} V to the secondary`);

  const ac = PRESETS.acGrid.ring;
  assert.equal(ac.drive, "ac", "AC mode on");
  const bAc = bField(fluxAmpFromV(ac.ac.V1, ac.ac.f, ac.N1));
  assert.ok(isUnsaturated(bAc), "AC preset stays under the knee");

  const air = PRESETS.airCore.ring;
  close(air.muR, 1, 0, "ring removed");
  const qIron = chargeThrough(r.N2, fluxOf(r.N1, 2, Rl()), secondaryLoopR(r.N2));
  const qAir = chargeThrough(air.N2, fluxOf(air.N1, 2, reluctance(1)), secondaryLoopR(air.N2));
  relclose(qIron / qAir, HIST.softIronMuR, 1e-9, "the air-core kick is µ_r× weaker");
});
