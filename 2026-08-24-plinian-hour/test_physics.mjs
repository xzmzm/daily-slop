// test_physics.mjs — node --test suite for the Plinian Hour engine.
// Every closed-form model below is checked exactly; calibrated anchors
// are checked against their historical windows.

import test from "node:test";
import assert from "node:assert/strict";

import {
  G0, RHO_A0, SCALE_H, P_A0, RS_GAS, CHI_VOLATILE, VENT_Z,
  H_REF, MDOT_REF, UMBRELLA_FRAC,
  airDensity, airPressure, airTemp, ventAmbient,
  exitMixture, massFlux, columnHeight, umbrellaHeight, collapseMargin,
  terminalVelocity, reynolds, AIR_MU,
  FALL, fallMass, makeIsomass, depthCm, fallFraction,
  FR_BENJAMIN, H_STOP, RHO_CUR, R0_PULSE,
  currentGPrime, currentSpeed, runoutMax, arrivalSeconds, frontRadius,
  TOWNS, TOWN_BEARING, townXY, HISTORICAL_PULSES, sectorHits,
  simulate, fmtClock,
} from "./physics.js";

const close = (a, b, tol) => assert.ok(
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)),
  `expected ${a} ≈ ${b} (tol ${tol})`
);

/* ---------------- atmosphere ---------------- */

test("atmosphere: exponential density, standard temperature", () => {
  close(airDensity(0), RHO_A0, 1e-12);
  close(airDensity(SCALE_H), RHO_A0 / Math.E, 1e-9);
  close(airPressure(0), P_A0, 1e-12);
  for (let z = 0; z <= 60000; z += 5000) {
    const next = airDensity(z + 5000);
    assert.ok(next < airDensity(z), `density not monotone at ${z}`);
  }
  close(airTemp(0), 288.15, 1e-9);
  close(airTemp(11000), 216.65, 1e-9);
  close(airTemp(20000), 216.65, 1e-9);
});

test("vent ambient sits on the profile", () => {
  const amb = ventAmbient();
  close(amb.rho, airDensity(VENT_Z), 1e-12);
  close(amb.P, airPressure(VENT_Z), 1e-12);
});

/* ---------------- column ---------------- */

test("mass flux: exact ideal-gas bookkeeping", () => {
  const u0 = 260, T0 = 1000, r0 = 200;
  const rhoGas = ventAmbient().P / (RS_GAS * T0);
  const expect = Math.PI * r0 * r0 * u0 * rhoGas / CHI_VOLATILE;
  close(massFlux(r0, u0, T0), expect, 1e-12);
});

test("historical parameters give a Carey–Sigurdsson-scale column", () => {
  const mdot = massFlux(200, 260, 1000);
  // ~1.3e8 kg/s, in the published range for the grey phase
  assert.ok(mdot > 0.6e8 && mdot < 2.5e8, `mdot ${mdot.toExponential(2)} out of range`);
  const h = columnHeight(mdot);
  // literature: ~27–35 km; our window allows the calibration headroom
  assert.ok(h > 25000 && h < 42000, `column height ${(h / 1000).toFixed(1)} km out of range`);
  close(umbrellaHeight(mdot), UMBRELLA_FRAC * h, 1e-12);
});

test("quarter-power scaling: H(16 m) = 2 H(m)", () => {
  close(columnHeight(16 * MDOT_REF), 2 * H_REF, 1e-9);
  close(columnHeight(MDOT_REF), H_REF, 1e-12);
  let prev = 0;
  for (let m = 1e6; m <= 1e9; m *= 10) {
    assert.ok(columnHeight(m) > prev);
    prev = columnHeight(m);
  }
});

test("collapse criterion: exact formulas", () => {
  const amb = ventAmbient();
  const { hBall, hNeed, gLoad, rhoMix } = collapseMargin(260, 1000);
  close(rhoMix, exitMixture(1000), 1e-12);
  close(gLoad, G0 * (rhoMix - amb.rho) / rhoMix, 1e-12);
  close(hBall, 260 ** 2 / (2 * gLoad), 1e-12);
  close(hNeed, 2200 * Math.sqrt(rhoMix / amb.rho), 1e-12);
});

test("collapse: history sustains, cold and weak jets fall back", () => {
  assert.equal(collapseMargin(260, 1000).sustained, true, "the 79 AD jet must sustain");
  assert.equal(collapseMargin(150, 1000).sustained, false, "slow jet must collapse");
  assert.equal(collapseMargin(260, 650).sustained, false, "cold jet at same speed must collapse");
});

test("collapse margin is monotone: faster/hotter helps", () => {
  for (const [u0, T0] of [[180, 900], [220, 950], [260, 1000], [300, 1050]]) {
    const lo = collapseMargin(u0 - 20, T0 - 30);
    const hi = collapseMargin(u0 + 20, T0 + 30);
    assert.ok(hi.margin > lo.margin, `margin not increasing through (${u0}, ${T0})`);
  }
});

/* ---------------- fallout ---------------- */

test("terminal velocity: Stokes limit is exact", () => {
  const d = 3e-5; // 30 µm
  const v = terminalVelocity(d, 500, 1.1, 1);
  const expect = (500 * G0 * d * d) / (18 * AIR_MU);
  close(v, expect, 1e-9);
  assert.ok(reynolds(d, v) < 1, "30 µm clast should be in Stokes flow");
});

test("terminal velocity: Newton limit is exact", () => {
  const d = 0.03; // 3 cm
  const v = terminalVelocity(d, 500, 1.1, 1);
  const expect = Math.sqrt((4 * G0 * d * (500 - 1.1)) / (3 * 1.1));
  close(v, expect, 1e-9);
  assert.ok(reynolds(d, v) > 1000, "3 cm clast should be in Newton drag");
});

test("terminal velocity is monotone in size across all regimes", () => {
  let prev = 0;
  for (let d = 1e-5; d <= 0.06; d *= 1.5) {
    const v = terminalVelocity(d);
    assert.ok(v > prev, `not monotone at d=${d}`);
    prev = v;
  }
  // fine ash really does hang: sub-mm/s for 20 µm
  assert.ok(terminalVelocity(2e-5) < 0.05);
});

test("isomass: Pyle exponential thinning downwind is exact", () => {
  const iso = makeIsomass({ mdot: 1.3e8, wind: 6 });
  const vtMed = terminalVelocity(FALL.VT_MED_D);
  const zRel = UMBRELLA_FRAC * columnHeight(1.3e8) + VENT_Z;
  const shift = FALL.SHIFT_K * 6 * (zRel / vtMed);
  const bDown = FALL.B0 * (1 + 6 / FALL.UW_REF);
  const xa = 8000 + shift, xb = 16000 + shift;
  close(iso(xb, 0) / iso(xa, 0), Math.exp(-(xb - xa) / bDown), 1e-9);
  // upwind branch decays with the steeper b_up
  const xu = -4000 + shift;
  assert.ok(iso(xu - 1000, 0) < iso(xu, 0));
  close(iso(xu - 1000, 0) / iso(xu, 0), Math.exp(-1000 / (0.35 * bDown)), 1e-9);
  // crosswind Gaussian
  const w = 1200 + 0.28 * Math.abs(xa - shift);
  close(iso(xa, w) / iso(xa, 0), Math.exp(-0.5), 1e-9);
});

test("isomass: more wind stretches the lobe downwind", () => {
  const near = 9334; // Pompeii's along-axis distance
  const calm = makeIsomass({ mdot: 1.3e8, wind: 3 });
  const windy = makeIsomass({ mdot: 1.3e8, wind: 14 });
  assert.ok(windy(near + 15000, 0) > calm(near + 15000, 0),
    "far field must gain under strong wind");
});

/* ---------------- surges ---------------- */

test("box current: exact speed, runout, arrival algebra", () => {
  const gp = G0 * (RHO_CUR - 1.2) / RHO_CUR;
  close(currentSpeed(100), FR_BENJAMIN * Math.sqrt(gp * 100), 1e-12);
  const V = 1.4e9;
  close(runoutMax(V), Math.sqrt(V / (Math.PI * H_STOP)), 1e-12);
  const C = FR_BENJAMIN * Math.sqrt((gp * V) / Math.PI);
  close(arrivalSeconds(7000, V), (49e6 - R0_PULSE ** 2) / (2 * C), 1e-9);
  close(arrivalSeconds(R0_PULSE, V), 0, 0);
});

test("front radius grows like sqrt(t) then caps at runout", () => {
  const V = 1.4e9;
  const C = FR_BENJAMIN * Math.sqrt((currentGPrime() * V) / Math.PI);
  close(frontRadius(100, V), Math.min(Math.sqrt(R0_PULSE ** 2 + 2 * C * 100), runoutMax(V)), 1e-9);
  close(frontRadius(1e9, V), runoutMax(V), 1e-12);
  assert.ok(frontRadius(60, V) > frontRadius(30, V));
});

test("sector mask handles the north seam", () => {
  assert.equal(sectorHits(5, 355, 15), true);
  assert.equal(sectorHits(30, 355, 15), false);
  assert.equal(sectorHits(147, 147, 0), true);
  assert.equal(sectorHits(262, 253, 26), true, "Misenum bearing sits inside S1's sector");
});

/* ---------------- geography & full simulation ---------------- */

test("town geometry matches the hand projection", () => {
  const pompeii = TOWNS.find((t) => t.key === "pompeii");
  const herc = TOWNS.find((t) => t.key === "herculaneum");
  const pxy = townXY(pompeii);
  const hxy = townXY(herc);
  close(pxy.x, 9334, 0.01);
  close(hxy.x, -2757, 0.01);
  assert.ok(Math.abs(TOWN_BEARING.pompeii - 147) < 1.5);
  assert.ok(Math.abs(TOWN_BEARING.herculaneum - 253) < 1.5);
});

test("historical simulation: the real story comes out", () => {
  const sim = simulate({});
  assert.equal(sim.sustained, true);
  const byKey = Object.fromEntries(sim.towns.map((t) => [t.key, t]));

  // Pompeii: buried in pumice (~2 m), surge only at dawn
  assert.ok(byKey.pompeii.depthTotal > 120 && byKey.pompeii.depthTotal < 330,
    `Pompeii depth ${byKey.pompeii.depthTotal.toFixed(0)} cm out of window`);
  assert.ok(byKey.pompeii.surge, "Pompeii must be surged");
  assert.ok(byKey.pompeii.surge.arrive > 18.4 && byKey.pompeii.surge.arrive < 19.0,
    `Pompeii surge at t=${byKey.pompeii.surge.arrive.toFixed(2)} h`);

  // Herculaneum: thin ash (upwind), first surge just after 01:00
  assert.ok(byKey.herculaneum.depthTotal < 20,
    `Herculaneum depth ${byKey.herculaneum.depthTotal.toFixed(1)} cm too deep`);
  assert.ok(byKey.herculaneum.surge.arrive > 12.0 && byKey.herculaneum.surge.arrive < 12.3,
    `Herculaneum surge at t=${byKey.herculaneum.surge.arrive.toFixed(2)} h`);
  assert.ok(byKey.herculaneum.surge.arrive < byKey.pompeii.surge.arrive);

  // Stabiae dies before Pompeii does (S4, down the Sarno)
  assert.ok(byKey.stabiae.surge, "Stabiae must be surged");
  assert.ok(byKey.stabiae.surge.arrive < byKey.pompeii.surge.arrive);

  // Misenum: never reached by any current
  assert.equal(byKey.misenum.surge, null);
  assert.ok(byKey.misenum.depthTotal < 1, "Misenum stays essentially clean of fall");
});

test("collapsed fountain replaces the schedule and hits everything early", () => {
  const sim = simulate({ u0: 140, T0: 700 });
  assert.equal(sim.sustained, false);
  assert.equal(sim.pulses.length, 1);
  const herc = sim.towns.find((t) => t.key === "herculaneum");
  assert.ok(herc.surge && herc.surge.arrive < 14.5, "total collapse strikes before dawn");
});

test("clock formatting", () => {
  assert.equal(fmtClock(0), "1:00 PM · Aug 24, 79 AD");
  assert.match(fmtClock(12.08), /^1:0[45] AM · Aug 25, 79 AD$/);
  assert.equal(fmtClock(19.57), "8:34 AM · Aug 25, 79 AD");
});

test("fall fraction brackets", () => {
  assert.equal(fallFraction(0), 0);
  assert.equal(fallFraction(FALL.FALL_START - 0.1), 0);
  assert.equal(fallFraction(FALL.FALL_END + 0.1), 1);
  const mid = fallFraction((FALL.FALL_START + FALL.FALL_END) / 2);
  assert.ok(mid > 0.45 && mid < 0.55);
});
