// test_physics.mjs — node --test test_physics.mjs
// Validates the spiral engine: the vacuum closed forms against each other and
// against the RK4 integrator with the drag switched off, the release-height
// optimal angle (45° exactly when h = 0), quadratic drag always costing range,
// the fitted presets landing on their documented throws (20 yd and 60 yd),
// the spheroid inertia identities, the gyro stability factor and its critical
// spin, the precession law, and the 1973 passer rating against real stat
// lines (Manning 2004, Rodgers 2011, perfect 158.3, zero) plus every clamp
// edge where a component pins at 0 or 2.375.

import test from "node:test";
import assert from "node:assert/strict";

import {
  G, MPH, YD, OZ, IN, RHO_AIR,
  BALL_M, BALL_LEN, BALL_CIRC, BALL_D, A_SEMI, B_SEMI,
  I_AXIAL, I_TRANS, REF_AREA,
  CD_SPIRAL, CD_TUMBLE, dragK,
  vacuumRange, vacuumHangtime, vacuumApex, optimalAngle, optimalRange,
  integrateFlight, optimalAngleDrag, fitSpeed,
  CM_ALPHA, overturnSlope, spinOmega, angularMomentum,
  stabilityFactor, criticalSpin, criticalSpinRps, precessionRate,
  RATING_MAX_COMPONENT, clampComponent, ratingComponents, ratingFromRates,
  RATING_BASE, RATING_CEIL,
  RELEASE_H, THROWS, FIRST_DOWN_YD, RATING_PRESETS, EVENTS,
} from "./physics.js";

const close = (a, b, tol, label) =>
  assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b} (±${tol})`);

const DEG = Math.PI / 180;

// --- 1. the ball and its constants ------------------------------------------
test("rule-book ball: dimensions, weight and derived diameter", () => {
  close(BALL_LEN, 11.125 * IN, 1e-12, "long axis 11.125 in");
  close(BALL_CIRC, 21.125 * IN, 1e-12, "short circumference 21.125 in");
  close(BALL_D, BALL_CIRC / Math.PI, 1e-12, "minor diameter from circumference");
  close(BALL_M, 14.5 * OZ, 1e-12, "weight 14.5 oz");
  assert.ok(BALL_LEN > BALL_D && BALL_D > 0, "prolate: long axis exceeds diameter");
});

test("spheroid inertias: exact uniform-density identities, prolate ratio", () => {
  close(I_AXIAL, 0.4 * BALL_M * B_SEMI * B_SEMI, 1e-15, "I_a = (2/5) m b²");
  close(I_TRANS, 0.2 * BALL_M * (A_SEMI * A_SEMI + B_SEMI * B_SEMI), 1e-15, "I_t = (1/5) m (a² + b²)");
  close(REF_AREA, Math.PI * B_SEMI * B_SEMI, 1e-15, "reference area π b²");
  const ratio = I_TRANS / I_AXIAL;
  assert.ok(ratio > 1.5 && ratio < 2.5, `I_t/I_a = ${ratio} sits in the prolate band`);
  close(ratio, (A_SEMI * A_SEMI + B_SEMI * B_SEMI) / (2 * B_SEMI * B_SEMI), 1e-12, "ratio identity");
});

// --- 2. the vacuum flight ----------------------------------------------------
test("h = 0 vacuum range collapses to the textbook v² sin2θ / g", () => {
  for (const angle of [10, 25, 45, 60, 75]) {
    const v = 24.5872;                       // exactly 55 mph
    close(vacuumRange(v, angle * DEG, 0), v * v * Math.sin(2 * angle * DEG) / G,
          1e-9, `vacuum range at ${angle}°`);
  }
});

test("RK4 with the drag switched off reproduces the closed form (sub-millimetre)", () => {
  const v = 24.5872, h = 1.9;
  for (const angle of [12, 18, 30, 42.9]) {
    const fl = integrateFlight(v, angle * DEG, h, 0);   // cd = 0
    // the residual is the linear ground-crossing interpolation: O(dt²) ≈ 1e-6 m
    close(fl.range, vacuumRange(v, angle * DEG, h), 1e-4, `RK4 vs closed form at ${angle}°`);
    close(fl.hang, vacuumHangtime(v, angle * DEG, h), 1e-4, `hang time at ${angle}°`);
    close(fl.apex, vacuumApex(v, angle * DEG, h), 1e-4, `apex at ${angle}°`);
  }
});

test("release height lowers the optimal angle: exactly 45° at h = 0", () => {
  close(optimalAngle(24.5872, 0), 45 * DEG, 1e-12, "θ* = 45° on flat ground");
  const v = 24.5872, h = 1.9;
  // numeric golden-section max of the closed form agrees with the formula
  let lo = 20 * DEG, hi = 60 * DEG;
  const phi = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 80; i += 1) {
    const c = hi - phi * (hi - lo), d = lo + phi * (hi - lo);
    if (vacuumRange(v, c, h) > vacuumRange(v, d, h)) hi = d; else lo = c;
  }
  close((lo + hi) / 2, optimalAngle(v, h), 1e-6, "numeric θ* vs arctan form");
  close(vacuumRange(v, optimalAngle(v, h), h), optimalRange(v, h), 1e-9, "R(θ*) = R*");
  assert.ok(optimalAngle(v, h) < 45 * DEG, "release height pushes θ* below 45°");
  close(optimalAngle(v, h) / DEG, 44.14, 0.02, "55 mph from 1.9 m peaks near 44.1°");
});

test("the 55 mph headline: 69.4 yd in vacuum", () => {
  close(optimalRange(55 * MPH, RELEASE_H) / YD, 69.44, 0.05, "vacuum max range at 55 mph");
});

// --- 3. drag -----------------------------------------------------------------
test("quadratic drag always costs range, and more cd costs more", () => {
  const v = 24.5872, angle = 42.9 * DEG, h = 1.9;
  const vac = vacuumRange(v, angle, h);
  const d1 = integrateFlight(v, angle, h, CD_SPIRAL).range;
  const d2 = integrateFlight(v, angle, h, CD_TUMBLE).range;
  assert.ok(d1 < vac, `spiral (${d1.toFixed(1)} m) < vacuum (${vac.toFixed(1)} m)`);
  assert.ok(d2 < d1, `tumble (${d2.toFixed(1)} m) < spiral (${d1.toFixed(1)} m)`);
  close(dragK(0), 0, 1e-15, "k(0) = 0");
  close(dragK(CD_TUMBLE) / dragK(CD_SPIRAL), CD_TUMBLE / CD_SPIRAL, 1e-12, "k ∝ cd");
});

test("55 mph at its drag-optimal angle lands almost exactly 60 yd", () => {
  const v = 55 * MPH, h = RELEASE_H;
  const ang = optimalAngleDrag(v, h, CD_SPIRAL);
  const fl = integrateFlight(v, ang, h, CD_SPIRAL);
  close(fl.range / YD, 60.0, 0.15, "drag-optimal 55 mph ≈ 60 yd");
  assert.ok(ang < optimalAngle(v, h), "drag pulls the optimal angle below vacuum's");
  close(fl.hang, 3.39, 0.05, "hang time ≈ 3.4 s");
});

test("presets land on their documented throws (20 yd, 60 yd)", () => {
  for (const t of THROWS) {
    const fl = integrateFlight(t.v, t.angleDeg * DEG, t.h, CD_SPIRAL);
    if (t.id === "first") close(fl.range / YD, FIRST_DOWN_YD, 0.02, "第一传 = 20.00 yd");
    if (t.id === "bomb") close(fl.range / YD, 60, 0.02, "炸弹 = 60.00 yd");
    if (t.id === "fiftyfive") {
      close(t.v, 55 * MPH, 1e-9, "标称弹速 55 mph");
      assert.ok(fl.range / YD > 40 && fl.range / YD < 43, "18° 平射落在 42 码上下");
    }
  }
});

test("fitSpeed inverts the integrator: round trip is exact", () => {
  for (const target of [10, 25, 45, 60]) {
    const v = fitSpeed(target * YD, 35 * DEG, RELEASE_H, CD_SPIRAL);
    close(integrateFlight(v, 35 * DEG, RELEASE_H, CD_SPIRAL).range / YD, target,
          1e-3, `fitSpeed round trip for ${target} yd`);
  }
});

// --- 4. the gyroscope --------------------------------------------------------
test("overturning slope is the documented q·A·d·C_mα chain", () => {
  const v = 55 * MPH;
  close(overturnSlope(v), 0.5 * RHO_AIR * v * v * REF_AREA * BALL_D * CM_ALPHA,
        1e-15, "M_α chain");
  assert.ok(overturnSlope(2 * v) / overturnSlope(v) - 4 < 1e-12, "M_α ∝ v²");
});

test("stability factor: s = 1 exactly at the critical spin, s(2ω) = 4 s(ω)", () => {
  const v = 55 * MPH;
  const wc = criticalSpin(v);
  close(stabilityFactor(wc / (2 * Math.PI), v), 1, 1e-9, "s = 1 at ω_c");
  close(stabilityFactor(2 * wc / (2 * Math.PI), v), 4, 1e-9, "s ∝ ω²");
  close(criticalSpinRps(v), 3.03, 0.02, "critical spin ≈ 3.0 rev/s at 55 mph");
  assert.ok(stabilityFactor(10, v) > 10, "an NFL 10 rev/s spiral has s > 10");
  assert.ok(stabilityFactor(1, v) < 1, "1 rev/s wobbles: s < 1");
});

test("angular momentum and the precession law Ω = τ/(I_a ω)", () => {
  close(angularMomentum(10), I_AXIAL * spinOmega(10), 1e-15, "L = I_a ω");
  const v = 55 * MPH, alpha = 5 * DEG;
  close(precessionRate(alpha, 10, v),
        (overturnSlope(v) * alpha) / (I_AXIAL * spinOmega(10)), 1e-15, "precession law");
  close(precessionRate(alpha, 20, v) * 2, precessionRate(alpha, 10, v), 1e-12, "Ω ∝ 1/ω");
  close(precessionRate(0, 10, v), 0, 1e-15, "no yaw, no torque, no precession");
  // at 10 rev/s the nose takes ~47 s per lazy circle; at 2 rev/s it is 7× faster
  close((2 * Math.PI) / precessionRate(alpha, 10, v), 46.8, 0.5, "slow precession at NFL spin");
  close(precessionRate(alpha, 2, v) / precessionRate(alpha, 10, v), 5, 1e-9, "5× faster at 2 rev/s");
});

// --- 5. the passer rating ----------------------------------------------------
test("Manning 2004 = 121.1 and Rodgers 2011 = 122.5, to the reported tenth", () => {
  const m = ratingComponents(RATING_PRESETS[0]);
  const r = ratingComponents(RATING_PRESETS[1]);
  close(m.value, 121.1, 0.05, "Manning 2004");
  close(r.value, 122.5, 0.05, "Rodgers 2011");
  assert.ok(m.c.every((c) => c > 0 && c < 2.375), "Manning: no component pinned");
});

test("the ceiling: every documented 2.375 edge pins exactly", () => {
  close(clampComponent(2.375), 2.375, 1e-15, "2.375 stays");
  close(clampComponent(9.9), 2.375, 1e-15, "above the ceiling pins down");
  close(clampComponent(-3), 0, 1e-15, "below the floor pins up");
  // direct, unambiguous edges:
  close(ratingFromRates({ compPct: 77.5, ypa: 7, tdPct: 5, intPct: 5.5 }).c[0], 2.375, 1e-12, "77.5% comp edge");
  close(ratingFromRates({ compPct: 30, ypa: 7, tdPct: 5, intPct: 5.5 }).c[0], 0, 1e-12, "30% comp floor");
  close(ratingFromRates({ compPct: 50, ypa: 12.5, tdPct: 5, intPct: 5.5 }).c[1], 2.375, 1e-12, "12.5 YPA edge");
  close(ratingFromRates({ compPct: 50, ypa: 3, tdPct: 5, intPct: 5.5 }).c[1], 0, 1e-12, "3 YPA floor");
  close(ratingFromRates({ compPct: 50, ypa: 7, tdPct: 11.875, intPct: 5.5 }).c[2], 2.375, 1e-12, "11.875% TD edge");
  close(ratingFromRates({ compPct: 50, ypa: 7, tdPct: 5, intPct: 0 }).c[3], 2.375, 1e-12, "0 INT edge");
  close(ratingFromRates({ compPct: 50, ypa: 7, tdPct: 5, intPct: 9.5 }).c[3], 0, 1e-12, "9.5% INT floor");
});

test("perfect 158.3 and the zero game; the ceiling is welded on", () => {
  const p = ratingComponents(RATING_PRESETS[2]);
  close(p.value, 158 + 1 / 3, 1e-9, "perfect = 158.33");
  close(p.c.reduce((a, b) => a + b, 0), 4 * RATING_MAX_COMPONENT, 1e-12, "all four pinned");
  // try to break the ceiling with absurd stats
  const absurd = ratingFromRates({ compPct: 100, ypa: 30, tdPct: 100, intPct: 0 });
  close(absurd.value, 158 + 1 / 3, 1e-9, "absurd stats cannot beat 158.3");
  close(ratingComponents(RATING_PRESETS[3]).value, 0, 1e-12, "the nightmare game is 0.0");
});

test("the four baselines each read exactly 1.0 → rating 66.7", () => {
  const b = ratingFromRates(RATING_BASE);
  for (let i = 0; i < 4; i += 1) close(b.c[i], 1, 1e-12, `baseline component ${i + 1}`);
  close(b.value, 200 / 3, 1e-9, "baseline rating 66.7");
  close(ratingFromRates(RATING_CEIL).value, 158 + 1 / 3, 1e-9, "ceiling rates are the perfect game");
});

test("monotonicity: more completions, yards, TDs help; more INTs never help", () => {
  const baseRates = { compPct: 60, ypa: 8, tdPct: 5, intPct: 2 };
  const base = ratingFromRates(baseRates).value;
  for (const bump of [{ compPct: 65 }, { ypa: 9 }, { tdPct: 6 }, { intPct: 1 }]) {
    assert.ok(ratingFromRates({ ...baseRates, ...bump }).value >= base,
              `bumping ${JSON.stringify(bump)} never hurts`);
  }
  assert.ok(ratingFromRates({ ...baseRates, intPct: 4 }).value < base,
            "more interceptions always hurts");
});

// --- 6. data integrity -------------------------------------------------------
test("timeline: sorted, one star, real years only", () => {
  assert.ok(EVENTS.length >= 10, "ten pins on the timeline");
  for (let i = 1; i < EVENTS.length; i += 1) {
    assert.ok(EVENTS[i].y >= EVENTS[i - 1].y, "chronological order");
  }
  assert.equal(EVENTS.filter((e) => e.star).length, 1, "exactly one star");
  assert.equal(EVENTS.find((e) => e.star).date, "1906-09-05", "the star is today's throw");
  assert.equal(EVENTS[0].y, 1905, "starts with the death season");
  assert.equal(EVENTS[EVENTS.length - 1].y, 2011, "ends on Rodgers");
});

test("rating presets carry their real stat lines", () => {
  const byId = Object.fromEntries(RATING_PRESETS.map((p) => [p.id, p]));
  close((byId.manning.comp / byId.manning.att) * 100, 67.6, 0.1, "Manning comp %");
  close((byId.rodgers.int / byId.rodgers.att) * 100, 1.2, 0.1, "Rodgers INT %");
  const m = ratingComponents(byId.manning);
  assert.ok(m.value > 120 && m.value < 122.5, "Manning sits between 120 and Rodgers");
});
