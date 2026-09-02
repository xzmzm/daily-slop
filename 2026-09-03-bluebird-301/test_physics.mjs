// test_physics.mjs — node --test test_physics.mjs
// Validates the Bluebird 301 engine: the ISA air-density curve, Cardano's
// exact terminal speed against a numeric bisection (and by plugging the root
// back into the cubic), the pure cube-law scaling that dooms piston records,
// the trap-clock and harmonic-mean record arithmetic behind the two-run rule
// (including exactly how much a steady wind still costs), the centrifugal
// load on the tyre rim at 301 mph, the historical record ladder, and every
// preset fitted to its real record speed — with the 1935 Blue Bird held to
// half a mile per hour of 301.129.

import test from "node:test";
import assert from "node:assert/strict";

import {
  W_PER_HP, MPH, MS, G, MILE, RHO0,
  airDensity, densityRatio, aeroC, rollC, wheelPower,
  terminalSpeed, cardanoDisc, requiredPower, bisectSpeed,
  mphFromSeconds, secondsFromMph, harmonicMean, windRecord,
  wheelRpm, rimG, BLUEBIRD, configSpeed, PRESETS,
  RECORDS, equivalentPowerHp,
} from "./physics.js";

const close = (a, b, tol, label) =>
  assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b} (±${tol})`);

// --- 1. the air the car pushes through -------------------------------------
test("ISA density: ρ(0) = 1.225 exactly and Bonneville sits near 1.08", () => {
  assert.equal(airDensity(0), RHO0);
  close(airDensity(1282), 1.0812, 0.003, "ρ at Bonneville 1,282 m");
  close(densityRatio(1282), 0.8826, 0.004, "density ratio at Bonneville");
});

test("ISA density is strictly decreasing over the slider range", () => {
  let prev = Infinity;
  for (let h = 0; h <= 3000; h += 37) {
    const rho = airDensity(h);
    assert.ok(rho < prev, `density must fall with altitude at h=${h}`);
    prev = rho;
  }
});

// --- 2. Cardano's root vs bisection, and by plug-back ----------------------
test("terminalSpeed matches 200-iteration bisection over a wide grid", () => {
  const powers = [1e3, 5e4, 3e5, 1.5e6, 5e6, 6e7];
  const aeros = [0.05, 0.3, 0.59, 1.2, 3.5];
  const rolls = [0, 100, 541, 710, 1600];
  for (const P of powers) for (const a of aeros) for (const b of rolls) {
    const exact = terminalSpeed(P, a, b);
    const numeric = bisectSpeed(P, a, b);
    close(exact, numeric, 2e-6 * Math.max(1, exact), `P=${P} a=${a} b=${b}`);
  }
});

test("the exact root plugs straight back into a v³ + b v = P", () => {
  for (const P of [45e3, 5.9e5, 1.5436e6]) {
    for (const b of [0, 147, 710]) {
      const a = 0.5918;
      const v = terminalSpeed(P, a, b);
      close(requiredPower(v, a, b), P, 1e-9 * P, `plug-back at P=${P}`);
    }
  }
});

test("b = 0 degenerates to the pure cube root", () => {
  close(terminalSpeed(8e5, 0.6, 0), Math.cbrt(8e5 / 0.6), 1e-12, "cube root");
});

test("the discriminant is never negative for P ≥ 0", () => {
  for (const P of [1, 1e3, 1e6, 1e8]) {
    for (const b of [0, 500, 5000]) {
      assert.ok(cardanoDisc(P, 0.6, b) >= 0);
    }
  }
});

// --- 3. the cube law -------------------------------------------------------
test("doubling speed in the pure-drag regime costs exactly 8× the power", () => {
  const a = 0.59;
  const v1 = terminalSpeed(1.5e6, a, 0);
  const v2 = terminalSpeed(8 * 1.5e6, a, 0);
  close(v2 / v1, 2, 1e-12, "2× speed from 8× power");
});

test("1898 → 1935: a 7.68× speed jump needs ~452× the drag power", () => {
  close((301.129 / 39.24) ** 3, 452.4, 0.5, "cube of the speed ratio");
});

// --- 4. the star of the day ------------------------------------------------
test("the Blue Bird defaults land the Cardano root on 301.129 mph", () => {
  const v = configSpeed(BLUEBIRD) * MPH;
  close(v, 301.129, 0.5, "Blue Bird terminal speed");
});

test("drag eats ~94% of the Blue Bird's wheel power at terminal speed", () => {
  const a = aeroC(BLUEBIRD.h, BLUEBIRD.cd, BLUEBIRD.area);
  const b = rollC(BLUEBIRD.mu, BLUEBIRD.mass);
  const v = terminalSpeed(wheelPower(BLUEBIRD), a, b);
  const share = (a * v * v * v) / requiredPower(v, a, b);
  assert.ok(share > 0.92 && share < 0.96, `drag share ${share}`);
});

// --- 5. the trap clock and the two-run rule --------------------------------
test("301.129 mph is an 11.955-second measured mile", () => {
  close(secondsFromMph(301.129), 11.955, 0.005, "seconds per mile");
  close(mphFromSeconds(secondsFromMph(301.129)), 301.129, 1e-9, "round trip");
});

test("the record is a harmonic mean, not an arithmetic one", () => {
  const v1 = 296, v2 = 306;
  close(harmonicMean(v1, v2), 2 / (1 / v1 + 1 / v2), 1e-12, "definition");
  assert.ok(harmonicMean(v1, v2) < (v1 + v2) / 2, "harmonic ≤ arithmetic");
});

test("a steady wind costs exactly w²/v of the record — first order cancels", () => {
  const v = 301.129, w = 15;
  close(harmonicMean(v - w, v + w), windRecord(v, w), 1e-12, "closed form");
  close(v - windRecord(v, w), (w * w) / v, 1e-9, "the quadratic residue");
  // slope of the record vs wind at w = 0 is zero — that's the point of
  // running both directions. (An arithmetic average would beat this: the
  // timing gear measures elapsed time, so it is not available.)
  const slope = (windRecord(v, 0.05) - windRecord(v, 0)) / 0.05;
  close(slope, 0, 1e-3, "first-order wind cancellation");
});

// --- 6. the wheel at the corner of the physics -----------------------------
test("at 301 mph the wheel spins ~2,737 rpm and the rim pulls ~3,937 g", () => {
  const v = 301.129 * MS;
  close(wheelRpm(v, 0.47), 2737, 5, "wheel rpm");
  close(rimG(v, 0.47), 3937, 10, "rim acceleration in g");
  close(0.028 * rimG(v, 0.47), 110, 0.5, "a 28 g salt grain weighs ~110 kg at the rim");
});

// --- 7. the ladder and the thrust machines ---------------------------------
test("the record ladder climbs strictly, in date order", () => {
  let prevMph = 0, prevDate = "";
  for (const r of RECORDS) {
    assert.ok(r.mph > prevMph, `${r.car} must beat ${prevMph}`);
    assert.ok(r.date > prevDate, `${r.date} must come after ${prevDate}`);
    prevMph = r.mph; prevDate = r.date;
  }
});

test("3 Sep 1935 is pinned at 301.129 mph and 1997 stays supersonic", () => {
  const star = RECORDS.find((r) => r.star);
  assert.equal(star.date, "1935-09-03");
  close(star.mph, 301.129, 1e-9, "the star");
  close(RECORDS[RECORDS.length - 1].mph, 763.035, 1e-9, "ThrustSSC");
});

test("wheel-driven records carry shaft power, thrust machines carry thrust", () => {
  for (const r of RECORDS) {
    if (r.kind === "rocket" || r.kind === "jet") {
      assert.equal(r.powerHp, null);
      assert.ok(r.thrustN > 0);
    } else {
      assert.ok(r.powerHp > 0);
      assert.equal(r.thrustN, undefined);
    }
  }
});

test("equivalent F·v power: Blue Flame ≈ 36,500 hp, ThrustSSC ≈ 102,000 hp", () => {
  const flame = RECORDS.find((r) => r.car === "Blue Flame");
  const ssc = RECORDS.find((r) => r.car === "ThrustSSC");
  close(equivalentPowerHp(flame), 36500, 1500, "Blue Flame F·v");
  close(equivalentPowerHp(ssc), 102000, 2000, "ThrustSSC F·v");
  // thrust power grows with speed itself — it is not a constant the cubic
  // can wall against
  assert.ok(equivalentPowerHp(ssc) / 4450 > 20, "vs the last wheel-driven turbine");
});

// --- 8. every preset lands on its record -----------------------------------
test("presets: the Cardano root reproduces each historical record", () => {
  for (const p of PRESETS) {
    const v = configSpeed(p.cfg) * MPH;
    const tol = p.id === "bluebird" ? 0.5 : 2.5;
    close(v, p.target, tol, `${p.label} terminal speed`);
  }
});

test("supercharging is why Bonneville works: NA loses the air it saves", () => {
  const sc = configSpeed(BLUEBIRD) * MPH;
  const na = configSpeed({ ...BLUEBIRD, supercharged: false }) * MPH;
  assert.ok(na < sc - 6, `NA must lose real speed at altitude (${sc - na} mph)`);
  // in the pure-drag limit the NA speed is exactly the SC speed times ρ^⅓ —
  // the fixed rolling resistance only drags it further below that line
  const ratio = densityRatio(BLUEBIRD.h) ** (1 / 3);
  const pureSc = configSpeed({ ...BLUEBIRD, mu: 0 });
  close(configSpeed({ ...BLUEBIRD, mu: 0, supercharged: false }), pureSc * ratio, 1e-9, "ρ^⅓ scaling without rolling");
  assert.ok(configSpeed({ ...BLUEBIRD, supercharged: false }) < pureSc * ratio, "rolling makes altitude hurt NA twice");
});

test("requiredPower is strictly increasing in v — the root is unique", () => {
  const a = 0.59, b = 710;
  let prev = -1;
  for (let v = 0; v <= 200; v += 7) {
    const P = requiredPower(v, a, b);
    assert.ok(P > prev, `monotone at v=${v}`);
    prev = P;
  }
});

test("wheel power: supercharged holds, normally-aspirated breathes with the air", () => {
  const sc = wheelPower({ ...BLUEBIRD });
  const na = wheelPower({ ...BLUEBIRD, supercharged: false });
  close(sc, BLUEBIRD.pEngine * W_PER_HP * BLUEBIRD.eta, 1e-6, "supercharged");
  close(na / sc, densityRatio(BLUEBIRD.h), 1e-12, "NA ratio");
});

test("the measured mile is exactly 1,609.344 m and one hour of miles is mph", () => {
  assert.equal(MILE, 1609.344);
  close(MILE / (301.129 * MS), 11.955, 0.005, "physical mile time");
  close(1 * MS * MPH, 1, 1e-12, "unit round trip");
});
