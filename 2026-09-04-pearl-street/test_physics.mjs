// test_physics.mjs — node --test test_physics.mjs
// Validates the Pearl Street engine: the feeder chain (area → resistance →
// current → drop → copper mass) against its own step-by-step expansion, the
// 1/V² copper law that is the whole lesson, the drop-is-loss identity, the
// distributed-load factor of exactly one half, the reach formula (∝ V at
// fixed copper), the lamp laws (flux V^3.4, life V^−13), the square-mile
// radius, and every preset fitted to its documented line — Pearl Street's
// main lands on the square-mile circle, Lauffen on 175 km at η = 0.75,
// Changji on 3,293 km with the bundle it actually carries.

import test from "node:test";
import assert from "node:assert/strict";

import {
  RHO_CU, CU_DENSITY, W_PER_HP, SQ_MI,
  FLUX_EXP, LIFE_EXP,
  lampFlux, lampLife, lampPower, lampCurrent, loadCurrent,
  wireArea, wireDiameter, copperMass, feederSteps,
  lossFraction, efficiency, dropForLength, reachPoint,
  districtRadius, dropPointLoad, dropDistributed,
  PEARL_V, PEARL_dV, PEARL_L, PEARL_P, JUMBO_T, JUMBO_N,
  LAMPS_FULL, LAMPS_W, LAMP_N_FIRST, PEARL_A,
  PRESETS, LINES, EVENTS,
} from "./physics.js";

const close = (a, b, tol, label) =>
  assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b} (±${tol})`);

// --- 1. the constants -------------------------------------------------------
test("resistivity is the IACS annealed-copper value: ρ·5.8e7 = 1", () => {
  close(RHO_CU * 5.8e7, 1, 1e-4, "IACS round trip");
  assert.equal(CU_DENSITY, 8960);
  assert.equal(SQ_MI, 2589988.11);
});

// --- 2. the feeder chain: closed form vs step by step -----------------------
test("wireArea round-trips: the step-by-step chain returns the same ΔV", () => {
  const Ps = [1e4, 1e5, 6e5, 2.24e5, 6e9];
  const Ls = [100, 907.975, 50000, 3.293e6];
  const Vs = [110, 2400, 15000, 1.1e6];
  const dVfracs = [0.02, 0.09, 0.25];
  for (const P of Ps) for (const L of Ls) for (const V of Vs) for (const f of dVfracs) {
    const dV = V * f;
    const steps = feederSteps(P, L, V, dV);
    close(steps.dropCheck, dV, 1e-9 * dV, `drop round trip P=${P} L=${L} V=${V}`);
    close(steps.mass, CU_DENSITY * steps.area * 2 * L, 1e-9 * steps.mass, "mass identity");
    close(steps.current, P / V, 1e-12 * steps.current, "current = P/V");
    close(steps.lossW, steps.current * dV, 1e-9 * steps.lossW, "loss = I·ΔV");
  }
});

test("copperMass equals ρ_m·A·2L exactly, by construction and by steps", () => {
  const m1 = copperMass(1e5, 907.975, 110, 10);
  const steps = feederSteps(1e5, 907.975, 110, 10);
  close(m1, steps.mass, 1e-9 * m1, "closed vs steps");
});

// --- 3. the V² law, the whole lesson ----------------------------------------
test("doubling the voltage quarters the copper — exactly", () => {
  const m110 = copperMass(1e5, 907.975, 110, 10);
  const m220 = copperMass(1e5, 907.975, 220, 20);   // same drop ratio
  close(m220 / m110, 0.25, 1e-12, "2× V → ¼ copper");
  const m10x = copperMass(1e5, 907.975, 1100, 100);
  close(m10x / m110, 0.01, 1e-12, "10× V → 1/100 copper");
});

test("drop ratio is loss fraction, and efficiency is 1/(1+ΔV/V)", () => {
  close(lossFraction(10, 110), 10 / 110, 1e-15, "loss fraction identity");
  close(efficiency(5000, 15000), 0.75, 1e-12, "η = 0.75 needs ΔV/V = 1/3");
  close(1 - efficiency(10, 110), lossFraction(10, 110) / (1 + lossFraction(10, 110)), 1e-15, "the two bookkeepings agree");
});

// --- 4. the street: distributed load is exactly half ------------------------
test("spreading the load along the street halves the drop — exactly", () => {
  for (const P of [1e4, 1e5, 3.64e5]) for (const L of [500, 907.975, 3000]) for (const V of [110, 2400]) {
    const A = wireArea(P, L, V, V * 0.09);
    const end = dropPointLoad(P, L, V, A);
    const dist = dropDistributed(P, L, V, A);
    close(dist / end, 0.5, 1e-12, `distributed/end at P=${P} L=${L} V=${V}`);
  }
});

test("the Pearl Street main is an 11-milliohm loop; full house on one main sags 60 V", () => {
  const steps = feederSteps(PEARL_P, PEARL_L, PEARL_V, PEARL_dV);
  close(steps.resistance, 0.011, 2e-4, "Pearl main loop resistance (Ω)");
  close(dropPointLoad(LAMPS_FULL * LAMPS_W, PEARL_L, PEARL_V, PEARL_A), 60, 0.1,
    "6,600 lamps on one main = 60 V of sag");
});

// --- 5. reach: the radius of a voltage --------------------------------------
test("reach grows linearly with voltage at fixed copper — 15 kV is 136× the mile", () => {
  const A = PEARL_A;
  const r110 = reachPoint(PEARL_P, A, PEARL_dV, 110);
  const r15000 = reachPoint(PEARL_P, A, PEARL_dV, 15000);
  close(r15000 / r110, 15000 / 110, 1e-9, "reach ∝ V");
  assert.ok(Math.abs(r15000 - 123.8e3) < 2e3, `15 kV reach ${r15000 / 1000} km ≈ 124 km`);
});

test("dropForLength inverts reachPoint exactly", () => {
  const A = 2.84626e-3, V = 110, P = 1e5;
  const dV = 10;
  const L = reachPoint(P, A, dV, V);
  close(dropForLength(P, L, V, A), dV, 1e-9, "round trip");
});

test("a square mile is a circle of ~908 m radius", () => {
  close(PEARL_L, 907.975, 0.5, "First District radius (m)");
  close(districtRadius(SQ_MI), PEARL_L, 1e-12, "formula identity");
});

// --- 6. the lamps ------------------------------------------------------------
test("a Jumbo pushes 909 amps at 110 V; the full house pulls 5,455", () => {
  close(loadCurrent(PEARL_P, PEARL_V), 909.0909, 1e-3, "one Jumbo's current");
  close(loadCurrent(PEARL_P * JUMBO_N, PEARL_V), 5454.545, 1e-2, "six Jumbos at full load");
});

test("6,600 lamps at ~90.9 W is exactly the 600 kW house", () => {
  close(LAMPS_W * LAMPS_FULL, 600000, 1e-6, "lamp economics");
  close(lampPower(PEARL_V, PEARL_V * PEARL_V / LAMPS_W), LAMPS_W, 1e-9, "hot filament round trip");
});

test("a 200-ohm filament on 110 volts is the 60-watt bulb", () => {
  close(lampPower(110, 200), 60.5, 1e-9, "P = V²/R");
  close(lampCurrent(110, 200), 0.55, 1e-9, "I = V/R");
});

test("the first customer: 106 lamps ≈ 9.6 kW ≈ 88 amps", () => {
  const P = LAMP_N_FIRST * LAMPS_W;
  close(P, 9636.4, 0.5, "Drexel, Morgan & Co. load (W)");
  close(loadCurrent(P, PEARL_V), 87.6, 0.2, "switch-on current (A)");
});

test("lamp laws: dim lamps live long — flux V^3.4, life V^−13", () => {
  close(lampFlux(0.9), 0.6989, 2e-3, "flux at 0.9 V");
  close(lampLife(0.9), 3.9345, 2e-3, "life at 0.9 V");
  close(lampFlux(1.1), 1.3827, 2e-3, "flux at 1.1 V");
  close(lampLife(1.1), 0.2896, 2e-3, "life at 1.1 V");
  let prevF = 0, prevL = Infinity;
  for (let x = 0.5; x <= 1.3; x += 0.05) {
    assert.ok(lampFlux(x) > prevF, "flux increasing");
    assert.ok(lampLife(x) < prevL, "life decreasing");
    prevF = lampFlux(x); prevL = lampLife(x);
  }
  close(FLUX_EXP, 3.4, 1e-12, "flux exponent");
  close(LIFE_EXP, -13, 1e-12, "life exponent");
});

// --- 7. the street bench at opening night ------------------------------------
test("2,000 lamps at the far end: 18.2 V sag, half brightness, tenfold life", () => {
  const P = 2000 * LAMPS_W;
  const end = dropPointLoad(P, PEARL_L, PEARL_V, PEARL_A);
  const dist = dropDistributed(P, PEARL_L, PEARL_V, PEARL_A);
  close(end, 18.18, 0.1, "end-loaded drop (V)");
  close(dist, end / 2, 1e-9, "distributed is exactly half");
  const ratio = (PEARL_V - end) / PEARL_V;
  close(lampFlux(ratio), 0.5406, 3e-3, "far-lamp brightness");
  close(lampLife(ratio), 10.5, 0.2, "far-lamp life multiplier");
});

// --- 8. presets: real lines, fitted copper -----------------------------------
test("presets: the reach formula lands each line on its documented distance", () => {
  for (const p of PRESETS) {
    const L = reachPoint(p.P, p.A, p.dV, p.V);
    const rel = Math.abs(L - p.target) / p.target;
    assert.ok(rel < 5e-4, `${p.label}: reach ${L} vs ${p.target} (rel ${rel})`);
  }
});

test("the Pearl Street main weighs ~46 t — heavier than the 27 t Jumbo driving it", () => {
  const m = copperMass(PEARL_P, PEARL_L, PEARL_V, PEARL_dV) / 1000;
  close(m, 46.3, 0.5, "Pearl main copper (t)");
  const ratio = m / JUMBO_T;
  assert.ok(ratio > 1.5 && ratio < 2.0, `main/Jumbo = ${ratio}`);
  close(wireDiameter(PEARL_A), 0.0602, 5e-4, "main diameter (m)");
});

test("same order of copper, 193× the distance: Pearl → Lauffen", () => {
  const mPearl = copperMass(PRESETS[0].P, PRESETS[0].L, PRESETS[0].V, PRESETS[0].dV);
  const mLauffen = copperMass(PRESETS[1].P, PRESETS[1].L, PRESETS[1].V, PRESETS[1].dV);
  close(PRESETS[1].L / PRESETS[0].L, 192.7, 1, "distance ratio");
  close(mLauffen / mPearl, 1.22, 0.05, "copper ratio stays ~1");
  close(PRESETS[1].P, 300 * W_PER_HP, 1e-6, "Lauffen = 300 hp");
});

test("Changji: the real bundle at ±1,100 kV sags 61.9 kV in 3,293 km (η ≈ 0.947)", () => {
  const p = PRESETS[2];
  close(dropForLength(p.P, p.L, p.V, p.A), 61932, 20, "implied drop (V)");
  close(efficiency(dropForLength(p.P, p.L, p.V, p.A), p.V), 0.9467, 3e-4, "efficiency");
  close(p.A, 0.01, 1e-12, "8 × 1,250 mm² per pole");
});

// --- 9. the reach ladder and the timeline ------------------------------------
test("the reach ladder spans 110 V → 1.1 MV and 0.9 → 3,293 km", () => {
  assert.equal(LINES.length, 5);
  close(LINES[0].V, 110, 1e-9, "first point voltage");
  close(LINES[0].km, 0.9, 1e-9, "first point distance");
  close(LINES[LINES.length - 1].V, 1.1e6, 1e-9, "last point voltage");
  close(LINES[LINES.length - 1].km, 3293, 1e-9, "last point distance");
  for (let i = 1; i < LINES.length; i += 1) {
    assert.ok(LINES[i].V > 0 && LINES[i].km > 0, "every line has real numbers");
  }
  assert.ok(LINES[LINES.length - 1].V / LINES[0].V >= 1e4, "a ten-thousand-fold voltage span");
  assert.ok(LINES[LINES.length - 1].km > LINES[0].km * 1e3, "a thousand-fold distance span");
});

test("the timeline runs 1882 → 2019, star on 4 Sep 1882, last DC on 14 Nov 2007", () => {
  assert.equal(EVENTS.length, 9);
  assert.equal(EVENTS[0].date, "1882-09-04");
  assert.ok(EVENTS[0].star, "the star is the switch-on");
  let prev = "";
  for (const e of EVENTS) {
    assert.ok(e.date > prev, `${e.date} must come after ${prev}`);
    prev = e.date;
  }
  assert.ok(EVENTS.some((e) => e.date === "2007-11-14"), "the last DC snip is pinned");
  assert.equal(EVENTS[EVENTS.length - 1].y, 2019);
  const snip = EVENTS.find((e) => e.date === "2007-11-14");
  close(2007 - 1882, 125, 1e-9, "125 years of Manhattan DC");
});
