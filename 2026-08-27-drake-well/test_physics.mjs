// test_physics.mjs — node --test test_physics.mjs
// Validates the Drake Well engine: free-fall stroke energy, the historical
// 3 ft/day calibration, layer-contrast ROP, the Darcy inflow constant and
// its log-linchpin, the hydrostatic rise, closed-form Arps cumulative
// against numeric integration, the price-crash interpolation, and API
// gravity round-trips.

import test from "node:test";
import assert from "node:assert/strict";

import {
  G,
  FT_PER_M,
  DRAKE_RIG,
  DRAKE_DARCY,
  LAYERS,
  PRESETS,
  fallTimeM,
  effectiveDropM,
  holeAreaM2,
  strokeEnergyJ,
  penetrationPerStrokeM,
  ropFtPerDay,
  ropAtFt,
  layerAtFt,
  oilRiseFt,
  darcyInflowBblDay,
  pressureAtRkPa,
  halfDrawdownRadiusM,
  arpsRate,
  arpsCum,
  oilPrice,
  PRICE_1859,
  PRICE_1861,
  CRASH_MONTHS,
  apiFromSG,
  sgFromAPI,
  CRUDES,
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

test("free fall: t = √(2h/g); 0.9 m takes 0.428 s", () => {
  close(fallTimeM(0.9), Math.sqrt(1.8 / G), 1e-12, "fall time");
  close(fallTimeM(0.9), 0.4285, 1e-3, "0.9 m fall");
});

test("you cannot rush gravity: effective drop saturates at ½g(T/2)²", () => {
  // slow engine — the bit gets its full programmed drop
  close(effectiveDropM(0.9, 22), 0.9, 1e-12, "22 strokes/min is slow enough");
  // frantic engine — the cable snatches the bit mid-air at T/2
  const T = 60 / 120;
  close(effectiveDropM(0.9, 120), 0.5 * G * (T / 2) ** 2, 1e-12, "saturated drop");
  assert.ok(effectiveDropM(0.9, 120) < 0.9, "saturation bites");
  // so past the saturation stroke rate, ROP stops improving — in fact an
  // 11× faster engine is slightly *worse* than Drake's sedate 22/min
  const slow = ropFtPerDay({ ...DRAKE_RIG, strokesPerMin: 22, SE_Pa: 2.5e9 });
  const fast = ropFtPerDay({ ...DRAKE_RIG, strokesPerMin: 240, SE_Pa: 2.5e9 });
  relclose(fast, slow, 0.1, "11× the stroke rate buys ≈ nothing");
  assert.ok(fast <= slow, "hurry the engine and gravity bills you for it");
});

test("stroke energy is m·g·h: 250 kg × 0.9 m = 2206.5 J", () => {
  close(strokeEnergyJ({ ...DRAKE_RIG }), 250 * G * 0.9, 1e-9, "E per stroke");
});

test("historical calibration: Drake's string makes ≈ 3.0 ft/day in shale", () => {
  const rop = ropFtPerDay({ ...DRAKE_RIG, SE_Pa: 2.5e9 });
  close(rop, 3.0, 0.1, "shale ROP");
  const per = penetrationPerStrokeM({ ...DRAKE_RIG, SE_Pa: 2.5e9 });
  close(per * 22 * 1440 * FT_PER_M, rop, 1e-12, "ROP = δ × strokes/day");
});

test("ROP is linear in m, h and 1/S, inverse-square in bit diameter", () => {
  const base = ropFtPerDay({ ...DRAKE_RIG, SE_Pa: 2.5e9 });
  relclose(
    ropFtPerDay({ ...DRAKE_RIG, SE_Pa: 2.5e9, massKg: 500 }),
    2 * base, 1e-9, "double mass"
  );
  relclose(
    ropFtPerDay({ ...DRAKE_RIG, SE_Pa: 1.25e9 }),
    2 * base, 1e-9, "half the specific energy"
  );
  relclose(
    ropFtPerDay({ ...DRAKE_RIG, SE_Pa: 2.5e9, diaM: 0.3048 }),
    base / 4, 1e-9, "double diameter quarters ROP"
  );
});

test("the oil sand announces itself: 59 ft down, ROP jumps by S ratio", () => {
  const shale = ropAtFt(50, DRAKE_RIG);
  const sand = ropAtFt(65, DRAKE_RIG);
  relclose(sand / shale, 2.5e9 / 0.8e9, 1e-9, "sand : shale ROP");
  assert.ok(layerAtFt(65).id === "oilsand");
  assert.ok(layerAtFt(10).needsCasing || layerAtFt(10).id === "gravel",
    "wet gravel must be cased first");
});

test("Darcy inflow at Drake's defaults ≈ 23.9 bbl/day (~1,000 gal/day)", () => {
  const q = darcyInflowBblDay(DRAKE_DARCY);
  close(q, 23.85, 0.05, "q");
  assert.ok(q > 20 && q < 28, "matches the historical yield");
});

test("Darcy scales: linear in k and ΔP, logarithmic in r_e", () => {
  const q0 = darcyInflowBblDay(DRAKE_DARCY);
  relclose(
    darcyInflowBblDay({ ...DRAKE_DARCY, kD: 0.24 }),
    2 * q0, 1e-9, "double permeability"
  );
  relclose(
    darcyInflowBblDay({ ...DRAKE_DARCY, dPkPa: 760 }),
    2 * q0, 1e-9, "double drawdown"
  );
  // doubling the drainage radius only pays the ln-ratio — and it *costs* you
  relclose(
    darcyInflowBblDay({ ...DRAKE_DARCY, reM: 240 }) / q0,
    Math.log(120 / 0.0762) / Math.log(240 / 0.0762), 1e-9, "ln(r_e) penalty"
  );
});

test("pressure profile: P(r_w)=0, P(r_e)=ΔP, log-midpoint = arithmetic mean", () => {
  const dP = DRAKE_DARCY.dPkPa;
  close(pressureAtRkPa(0.0762, DRAKE_DARCY), 0, 1e-9, "at the wellbore");
  close(pressureAtRkPa(120, DRAKE_DARCY), dP, 1e-9, "at the boundary");
  const rMid = halfDrawdownRadiusM(DRAKE_DARCY);
  close(rMid, Math.sqrt(0.0762 * 120), 1e-12, "half-drawdown radius");
  close(pressureAtRkPa(rMid, DRAKE_DARCY), dP / 2, 1e-9, "half the drawdown");
  assert.ok(rMid < 3.1 && rMid > 2.9, "≈3 m of 120 m carries half the loss");
});

test("hydrostatic rise: 160 kPa surplus lifts 0.82-SG oil 65.3 ft", () => {
  close(oilRiseFt(160, 0.82), (160000 / (0.82 * 1000 * G)) * FT_PER_M, 1e-9, "exact");
  close(oilRiseFt(160, 0.82), 65.28, 0.05, "feet");
  assert.ok(oilRiseFt(160, 0.82) < 69.5, "Drake still needed a pump for the last metres");
  assert.ok(oilRiseFt(300, 0.84) > 69.5, "a gusher surplus lifts it out of the ground");
});

test("Arps b=0: exponential — q(1/D_i) = q_i/e, N(∞) = q_i/D_i", () => {
  const qi = 250, Di = 0.16;
  relclose(arpsRate(qi, Di, 0, 1 / Di), qi / Math.E, 1e-9, "q at t = 1/D");
  relclose(arpsCum(qi, Di, 0, 1e6), qi / Di, 1e-6, "ultimate recovery");
});

test("Arps b=1: harmonic — closed form matches numeric integration", () => {
  const qi = 24, Di = 0.004; // Drake's flat water-drive well
  const steps = 200000, tMax = 36;
  let sum = 0;
  const h = tMax / steps;
  for (let i = 0; i < steps; i++) {
    sum += (arpsRate(qi, Di, 1, i * h) + arpsRate(qi, Di, 1, (i + 1) * h)) * 0.5 * h;
  }
  relclose(arpsCum(qi, Di, 1, tMax), sum, 1e-6, "harmonic N(36 months)");
  // after three years the well still makes ~87% of day one
  relclose(arpsRate(qi, Di, 1, 36) / qi, 1 / 1.144, 1e-9, "barely declining");
});

test("Arps b=0.5: hyperbolic closed form matches numeric integration", () => {
  const qi = 250, Di = 0.16, b = 0.5;
  const steps = 200000, tMax = 18;
  let sum = 0;
  const h = tMax / steps;
  for (let i = 0; i < steps; i++) {
    sum += (arpsRate(qi, Di, b, i * h) + arpsRate(qi, Di, b, (i + 1) * h)) * 0.5 * h;
  }
  relclose(arpsCum(qi, Di, b, tMax), sum, 1e-6, "hyperbolic N(18 months)");
});

test("N'(t) = q(t): derivative of the cumulative is the rate", () => {
  const qi = 250, Di = 0.16, b = 0.25, t = 6;
  const eps = 1e-4;
  const slope = (arpsCum(qi, Di, b, t + eps) - arpsCum(qi, Di, b, t - eps)) / (2 * eps);
  relclose(slope, arpsRate(qi, Di, b, t), 1e-4, "dN/dt at t=6");
});

test("price crash: $20 → $0.49, geometric path between", () => {
  close(oilPrice(0), PRICE_1859, 1e-12, "day one");
  close(oilPrice(CRASH_MONTHS), PRICE_1861, 1e-9, "1861");
  close(oilPrice(CRASH_MONTHS / 2), PRICE_1859 * Math.sqrt(PRICE_1861 / PRICE_1859), 1e-9,
    "geometric midpoint");
  for (let t = 1; t < CRASH_MONTHS; t++) {
    assert.ok(oilPrice(t) > oilPrice(t + 0.5), `monotone at ${t}`);
  }
  close(oilPrice(60), 0.49, 1e-12, "and it stayed there");
});

test("API gravity: water is exactly 10°; round-trips are exact", () => {
  close(apiFromSG(1), 10, 1e-12, "SG 1 → 10° API");
  for (const c of CRUDES) {
    close(sgFromAPI(apiFromSG(sgFromAPI(c.api))), sgFromAPI(c.api), 1e-12,
      `${c.name} round-trip`);
  }
  assert.ok(apiFromSG(0.8156) > 41.9 && apiFromSG(0.8156) < 42.1,
    "PA crude SG 0.8156 ↔ 42°");
  assert.ok(apiFromSG(0.82) > apiFromSG(0.9), "lighter crude, higher degrees");
});

test("presets carry the story: Drake flat, boom steep, giant flat-rich", () => {
  const d = PRESETS.drake.prod, b = PRESETS.boom.prod, g = PRESETS.giant.prod;
  assert.ok(arpsRate(d.qi, d.Di, d.b, 12) > 0.9 * d.qi, "Drake holds a year");
  assert.ok(arpsRate(b.qi, b.Di, b.b, 12) < 0.35 * b.qi, "boom halves fast");
  assert.ok(arpsCum(g.qi, g.Di, g.b, 36) > arpsCum(b.qi, b.Di, b.b, 36) * 5,
    "the giant dwarfs the boom");
});

test("every layer keeps ROP finite and positive", () => {
  for (const l of LAYERS) {
    const rop = ropFtPerDay({ ...DRAKE_RIG, SE_Pa: l.SE });
    assert.ok(Number.isFinite(rop) && rop > 0, `${l.id}: ${rop}`);
  }
});
