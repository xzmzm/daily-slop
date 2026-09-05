// test_physics.mjs — node --test test_physics.mjs
// Validates the Turtle engine: the ellipsoid geometry and the exact slice
// integral, the mass budget and the air-pocket identity, the draft bisection,
// the emergency blow, the gauge pressure, the ITTC drag chain and its cube
// root (closed form vs fixed-point, the 8P → 2v law, the 3 mph claim), the
// CO₂ clock against the documented 30 minutes, the tide sinusoid's slacks,
// and the deterministic mission — the history preset landing ashore before
// the boom, the missed window failing at dawn, and two runs being identical.

import test from "node:test";
import assert from "node:assert/strict";

import {
  G, FT, LB, KN, RHO_SW, NU_SW,
  HULL_L, HULL_H, HULL_W, A_SEMI, B_SEMI, C_SEMI,
  V_ENV, M_DISPLACED, LB_DISPLACED, ellipsoidArea, WETTED_S, A_FRONT, A_PLAN,
  OAK_KG, IRON_KG, BRASS_KG, LEAD_KG, OPERATOR_KG, M_DRY,
  RHO_OAK, RHO_IRON, RHO_BRASS, RHO_LEAD, RHO_BODY, V_SOLIDS,
  BALLAST_NEUTRAL, V_AIR_M3, V_AIR_L, IRON_BUYS_L, OAK_COSTS_L,
  totalMass, netForce, CD_VERT, steadyVertSpeed, BLOW_SPEED,
  gaugePa, volumeBelow, draftForMass,
  PROP_EFF, CD_FORM, cfIttc, dragCA, dragAt, steadySpeedFrozen, steadySpeed,
  crankWattsFor, CLAIM_MPH, CLAIM_MS, CLAIM_WATTS,
  REST_W, CRANK_RATIO, RQ, metabolicW, vo2Lpm, vco2Lpm,
  CO2_START, O2_START, CO2_ABORT, CO2_DANGER, O2_FLOOR,
  co2After, o2After, timeToCo2, timeToO2,
  SPEC_CRANK_W, AIR_PRESETS,
  MISSION, tideKn, SLACKS, simulateMission, fmtClock,
  LAUNCH_PRESETS, EVENTS, kindLabel,
} from "./physics.js";

const close = (a, b, tol, label) =>
  assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b} (±${tol})`);

// --- 1. the hull geometry ----------------------------------------------------
test("hull: documented feet, ellipsoid volume and displacement", () => {
  close(HULL_L, 10 * FT, 1e-12, "10 ft long");
  close(HULL_H, 6 * FT, 1e-12, "6 ft tall");
  close(HULL_W, 3 * FT, 1e-12, "3 ft wide");
  close(V_ENV, (Math.PI / 6) * HULL_L * HULL_W * HULL_H, 1e-12, "V = π/6·L·W·H");
  close(V_ENV, 2.6688, 5e-4, "≈ 2.67 m³");
  close(M_DISPLACED, RHO_SW * V_ENV, 1e-9, "displaced mass = ρV");
  close(M_DISPLACED, 2735.5, 0.5, "≈ 2 3/4 tonnes of water");
  close(LB_DISPLACED, 6030, 2, "≈ 6 030 lb");
});

test("wetted surface: Knud Thomsen is exact for a sphere, sane for the hull", () => {
  close(ellipsoidArea(2, 2, 2), 4 * Math.PI * 4, 1e-9, "sphere → 4πr²");
  assert.ok(WETTED_S > 10.5 && WETTED_S < 12, `S = ${WETTED_S.toFixed(2)} m² in band`);
  close(A_FRONT, (Math.PI / 4) * HULL_W * HULL_H, 1e-12, "frontal ellipse");
  close(A_PLAN, (Math.PI / 4) * HULL_L * HULL_W, 1e-12, "planform ellipse");
});

test("the slice integral: volumeBelow runs 0 → V_ENV exactly", () => {
  close(volumeBelow(0), 0, 1e-12, "nothing below the keel");
  close(volumeBelow(HULL_H), V_ENV, 1e-9, "everything below the turret top");
  close(volumeBelow(HULL_H / 2), V_ENV / 2, 1e-9, "the mid-height slice bisects the volume");
  // thin slabs against the live elliptical slice area πab(1 − u²/c²)
  for (const z of [0.3, 0.9, 1.5]) {
    const dz = 1e-6;
    const slab = volumeBelow(z + dz) - volumeBelow(z);
    const u = z + dz / 2 - C_SEMI;
    const area = Math.PI * A_SEMI * B_SEMI * (1 - (u * u) / (C_SEMI * C_SEMI));
    close(slab, area * dz, 1e-9, `slice area at z = ${z} m`);
  }
});

// --- 2. the mass budget and the air pocket -----------------------------------
test("mass budget: dry mass, neutral ballast, and the documented lead", () => {
  close(LEAD_KG, 200 * LB, 1e-9, "200 lb of releasable lead");
  close(M_DRY, OAK_KG + IRON_KG + BRASS_KG + LEAD_KG + OPERATOR_KG, 1e-12, "dry sum");
  close(BALLAST_NEUTRAL, M_DISPLACED - M_DRY, 1e-9, "water needed to hover");
  close(BALLAST_NEUTRAL, 1149.8, 0.5, "≈ 1 150 kg ≈ 300 gal");
  assert.ok(BALLAST_NEUTRAL > 0 && BALLAST_NEUTRAL / RHO_SW < V_ENV - V_SOLIDS,
    "the tank fits inside the hull");
});

test("the air-pocket identity: V_air = M_dry/ρ − V_solids = Σ mᵢ(ρᵢ−ρ)/(ρρᵢ)", () => {
  close(V_AIR_M3, M_DRY / RHO_SW - V_SOLIDS, 1e-12, "identity, first form");
  const sum = OAK_KG / RHO_SW + IRON_KG / RHO_SW + BRASS_KG / RHO_SW
    + LEAD_KG / RHO_SW + OPERATOR_KG / RHO_SW - V_SOLIDS;
  close(V_AIR_M3, sum, 1e-9, "identity, per-material form");
  close(V_AIR_M3, V_AIR_L / 1000, 1e-12, "litres agree");
  close(V_AIR_L, 802.3, 1.0, "≈ 802 L at neutral trim");
  // exchange rates: iron buys air, oak spends it
  close(IRON_BUYS_L, 1000 * (1 / RHO_SW - 1 / RHO_IRON), 1e-9, "per-kg iron rate");
  close(OAK_COSTS_L, 1000 * (1 / RHO_SW - 1 / RHO_OAK), 1e-9, "per-kg oak rate");
  assert.ok(IRON_BUYS_L > 0 && OAK_COSTS_L < 0, "iron buys, oak costs");
});

test("no iron keel, no air: a light oak-only budget suffocates", () => {
  const oakOnly = 400 + 890 + 130 + 200 * LB + 75;   // same mass, all at oak density
  const solids = oakOnly / RHO_OAK + OPERATOR_KG / RHO_BODY - OPERATOR_KG / RHO_OAK;
  const vAir = oakOnly / RHO_SW - solids;
  assert.ok(vAir < 0.2, `an oak-density budget leaves ${vAir.toFixed(0)} L — barely a breath`);
});

// --- 3. trim, draft, blow, pressure ------------------------------------------
test("net force: zero exactly at neutral ballast, signed either side", () => {
  close(netForce(BALLAST_NEUTRAL), 0, 1e-9, "hover");
  assert.ok(netForce(BALLAST_NEUTRAL - 100) < 0, "lighter floats");
  assert.ok(netForce(BALLAST_NEUTRAL + 100) > 0, "heavier sinks");
  close(netForce(0), G * (M_DRY - M_DISPLACED), 1e-9, "closed form chain");
});

test("draft solver: empty tank floats ~1.01 m, round trip exact, heavy is null", () => {
  const d0 = draftForMass(M_DRY);
  close(d0, 1.012, 0.005, "empty-ballast draft");
  assert.ok(d0 < HULL_H && d0 > HULL_H / 2, "sits low in the water");
  for (const m of [M_DRY, 1800, 2400, M_DISPLACED - 1]) {
    const d = draftForMass(m);
    close(RHO_SW * volumeBelow(d), m, 1e-6, `draft round trip at ${m.toFixed(0)} kg`);
  }
  assert.equal(draftForMass(M_DISPLACED + 1), null, "too heavy to float");
  assert.equal(draftForMass(0), 0, "massless sits on the surface");
});

test("emergency blow: 0.89 m/s from releasing 200 lb of lead", () => {
  close(BLOW_SPEED, steadyVertSpeed(LEAD_KG * G), 1e-12, "definition");
  close(BLOW_SPEED, Math.sqrt((2 * LEAD_KG * G) / (RHO_SW * CD_VERT * A_PLAN)), 1e-12, "closed form");
  close(BLOW_SPEED, 0.891, 0.005, "≈ 0.89 m/s");
  close(BLOW_SPEED / KN, 1.73, 0.02, "≈ 1.7 kn ascent");
  close(steadyVertSpeed(0), 0, 1e-12, "no force, no speed");
});

test("gauge pressure: ρgh chain, 2 m ≈ 0.2 atm, linear in depth", () => {
  close(gaugePa(0), 0, 1e-12, "surface gauge reads zero");
  close(gaugePa(2), RHO_SW * G * 2, 1e-9, "chain");
  close(gaugePa(2) / 101325, 0.1986, 1e-3, "≈ 0.20 atm at 2 m");
  close(gaugePa(4) / gaugePa(2), 2, 1e-12, "linear");
});

// --- 4. the crank ------------------------------------------------------------
test("ITTC line: formula chain, monotone down in Re, ≈ 0.00365 at cruise", () => {
  const re = (0.55 * HULL_L) / NU_SW;
  close(cfIttc(re), 0.075 / (Math.log10(re) - 2) ** 2, 1e-15, "chain");
  assert.ok(cfIttc(2e6) > cfIttc(4e6), "faster is slicker");
  close(cfIttc(3.4e6), 0.00365, 2e-5, "≈ 0.00365 at 3 mph scale");
  close(dragCA(1), CD_FORM * A_FRONT + cfIttc(HULL_L / NU_SW) * WETTED_S, 1e-12, "drag area chain");
});

test("cube root: closed form vs fixed point, 8P → 2v, power inverts", () => {
  for (const p of [56, 90, 110, 250]) {
    const v = steadySpeed(p);
    const cf = cfIttc((v * HULL_L) / NU_SW);
    close(steadySpeedFrozen(p, cf), v, 1e-9, `closed form at the live Cf, ${p} W`);
    close(crankWattsFor(v), p, 1e-6, `inverse round trip at ${p} W`);
  }
  const v1 = steadySpeedFrozen(100, cfIttc((0.55 * HULL_L) / NU_SW));
  close(steadySpeedFrozen(800, cfIttc((0.55 * HULL_L) / NU_SW)), 2 * v1, 1e-12,
    "frozen-Cf cube law: 8× power is 2× speed");
});

test("the honest speeds: ~1.2 mph at 100 W; the 3 mph claim costs 1.45 kW", () => {
  const v100 = steadySpeed(100);
  close(v100 / 0.44704, 1.23, 0.06, "100 W sustained ≈ 1.2 mph");
  close(CLAIM_MS, 3 * 0.44704, 1e-12, "claim in m/s");
  close(CLAIM_WATTS, crankWattsFor(CLAIM_MS), 1e-9, "claim watts chain");
  assert.ok(CLAIM_WATTS > 1400, `3 mph needs ${CLAIM_WATTS.toFixed(0)} W — a sprint`);
  assert.ok(steadySpeed(250) / 0.44704 > 1.6 && steadySpeed(250) / 0.44704 < 1.8,
    "a 250 W burst still tops out under 1.8 mph");
});

// --- 5. the air clock --------------------------------------------------------
test("metabolic chain: V̇O₂ = E/348.3, V̇CO₂ = 0.85·V̇O₂, monotone in watts", () => {
  for (const p of [0, 56, 130, 250]) {
    close(metabolicW(p), REST_W + CRANK_RATIO * p, 1e-12, "metabolic watts");
    close(vo2Lpm(p), metabolicW(p) / 348.333, 1e-12, "V̇O₂ chain");
    close(vco2Lpm(p), RQ * vo2Lpm(p), 1e-15, "V̇CO₂ chain");
  }
  assert.ok(vco2Lpm(130) > vco2Lpm(56), "harder work, faster clock");
});

test("the documented spec: 56 W reaches 3% CO₂ in thirty minutes", () => {
  close(timeToCo2(SPEC_CRANK_W), 30.0, 0.1, "the 30-minute spec");
  close(co2After(timeToCo2(SPEC_CRANK_W), SPEC_CRANK_W), CO2_ABORT, 1e-12,
    "co2After and timeToCo2 invert each other");
  close(timeToCo2(130), 15.7, 0.2, "drilling hard: ~16 minutes");
  assert.ok(timeToCo2(0) > 90, `resting still only ${timeToCo2(0).toFixed(0)} min`);
});

test("CO₂ always binds before O₂ — at every work rate", () => {
  for (const p of [0, 56, 90, 130, 250]) {
    assert.ok(timeToCo2(p) < timeToO2(p), `CO₂ first at ${p} W`);
  }
  close(timeToCo2(56) / timeToO2(56), ((CO2_ABORT - CO2_START) / (O2_START - O2_FLOOR)) / RQ,
    1e-9, "the ratio is the threshold ratio over RQ");
  // at the 30-minute mark the O₂ is still fine
  close(o2After(30, SPEC_CRANK_W), O2_START - (vo2Lpm(SPEC_CRANK_W) * 30) / V_AIR_L, 1e-12, "O₂ chain");
  assert.ok(o2After(30, SPEC_CRANK_W) > 0.17, "O₂ comfortably above the 15% floor at 30 min");
});

// --- 6. the tide and the mission ---------------------------------------------
test("tide sinusoid: slacks every 6.21 h, extremes at ±2.1 kn", () => {
  for (const s of SLACKS) close(tideKn(s), 0, 1e-9, `slack at ${fmtClock(s)}`);
  close(tideKn(MISSION.advMaxHour), -MISSION.tideAmpKn, 1e-9, "adverse max at the peak hour");
  close(tideKn(MISSION.advMaxHour + MISSION.tidePeriodH / 2), +MISSION.tideAmpKn, 1e-9,
    "helpful max half a period later");
  assert.ok(tideKn(23) < 0 && tideKn(20) > 0 && tideKn(1) < -2,
    "the night: helpful at 20:00, adverse building at 23:00, peak at 01:00");
});

test("the history preset: fights in, drill aborts at 3%, ashore before the boom", () => {
  const r = simulateMission({ launchHour: LAUNCH_PRESETS[0].h });
  assert.equal(r.outcome, "boom");
  assert.ok(r.arrived, "reaches the Eagle");
  assert.ok(r.arrivalHours > 0.5 && r.arrivalHours < 1.5,
    `the grind takes ${r.arrivalHours.toFixed(2)} h`);
  close(r.abortCO2, CO2_ABORT, 0.0005, "the clock, not the strap, ends the drilling");
  assert.ok(r.ashoreBeforeBoom, "Lee is on the steps before the charge goes off");
  assert.ok(r.detonationKm > 1 && r.detonationKm < 3, `${r.detonationKm.toFixed(1)} km standoff`);
  assert.ok(r.crankMinutes / 60 < MISSION.fatigueMin / 60, "arms intact");
});

test("launch windows: early tide strands him offshore, 01:00 never arrives", () => {
  const early = simulateMission({ launchHour: LAUNCH_PRESETS[1].h });
  assert.equal(early.outcome, "boom");
  assert.ok(!early.ashoreBeforeBoom, "the un-turned tide pins him on the water");
  assert.ok(early.detonationKm < 1, `boom only ${early.detonationKm.toFixed(1)} km away — too close`);
  const missed = simulateMission({ launchHour: LAUNCH_PRESETS[2].h });
  assert.equal(missed.outcome, "dawn", "daylight ends it");
  assert.ok(missed.crankMinutes >= MISSION.fatigueMin - 1e-6, "the arms gave out first");
});

test("the tide gate: 23:00 is the last launch that makes it", () => {
  assert.equal(simulateMission({ launchHour: 23 }).outcome, "boom");
  assert.equal(simulateMission({ launchHour: 23.5 }).outcome, "dawn");
  assert.equal(simulateMission({ launchHour: 22 }).outcome, "boom");
});

test("determinism: two runs are bit-identical", () => {
  const a = simulateMission({ launchHour: 23 });
  const b = simulateMission({ launchHour: 23 });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// --- 7. data integrity -------------------------------------------------------
test("timeline: sorted, one star on the Eagle night, eight pins", () => {
  assert.ok(EVENTS.length >= 8, "eight pins");
  for (let i = 1; i < EVENTS.length; i += 1) {
    assert.ok(EVENTS[i].y >= EVENTS[i - 1].y, "chronological order");
  }
  const stars = EVENTS.filter((e) => e.star);
  assert.equal(stars.length, 1, "exactly one star");
  assert.equal(stars[0].y, 1776, "the star is the Eagle night");
  assert.equal(stars[0].date, "1776-09-06 夜", "dated tonight, 250 years ago");
  assert.equal(EVENTS[0].y, 1775, "starts with the build");
  assert.equal(EVENTS[EVENTS.length - 1].y, 1864, "ends on the Hunley");
  for (const k of ["build", "trial", "attack", "mine", "death", "after"]) {
    assert.ok(kindLabel(k), `label for ${k}`);
  }
});

test("presets: three launch hours, three air lines, all labelled", () => {
  assert.deepEqual(LAUNCH_PRESETS.map((p) => p.h), [23, 20, 1]);
  assert.deepEqual(AIR_PRESETS.map((p) => p.id), ["spec", "drill", "rest"]);
  close(AIR_PRESETS[0].w, SPEC_CRANK_W, 1e-12, "the spec preset is the 30-minute line");
});
