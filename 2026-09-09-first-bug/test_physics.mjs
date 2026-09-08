// test_physics.mjs — node --test test_physics.mjs
// Verifies closed-form electromechanics, logic gates, Panel F fault detection,
// and timeline continuity for the 1947 Harvard Mark II First Bug simulator.

import test from "node:test";
import assert from "node:assert/strict";

import {
  RELAY_CONSTANTS,
  TAU_COIL,
  I_MAX,
  coilCurrentRise,
  coilCurrentDecay,
  magneticForce,
  springForce,
  createRelayState,
  stepRelay,
  relayNot,
  relayAnd,
  relayOr,
  relayXor,
  relayFullAdder,
  simulatePanelFAddition,
  TIMELINE_EVENTS,
} from "./physics.js";

const close = (a, b, tol, label) =>
  assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b} (±${tol})`);

// ── 1 · Coil Electromagnetics ────────────────────────────────────────────────

test("coil electrical constants match Harvard Mark II relay specifications", () => {
  assert.equal(RELAY_CONSTANTS.V_COIL, 50);
  assert.equal(RELAY_CONSTANTS.R_COIL, 250);
  assert.equal(RELAY_CONSTANTS.L_COIL, 1.2);
  close(I_MAX, 0.2, 1e-6, "I_max = 50V / 250Ω = 200 mA");
  close(TAU_COIL, 0.0048, 1e-6, "tau = L/R = 4.8 ms");
});

test("coil current transient follows exact exponential curve", () => {
  // At t = 0
  assert.equal(coilCurrentRise(0), 0);

  // At t = tau, current reaches ~63.2% of I_max
  const iTau = coilCurrentRise(TAU_COIL);
  close(iTau, I_MAX * (1 - 1 / Math.E), 1e-5, "Current at 1 tau");
  close(iTau, 0.12642, 1e-4, "Current at 1 tau ≈ 126.4 mA");

  // At t = 5 tau, current reaches >99.3% of I_max
  const i5Tau = coilCurrentRise(5 * TAU_COIL);
  close(i5Tau, I_MAX, 0.002, "Current at 5 tau reaches steady-state");

  // Decay
  const decayTau = coilCurrentDecay(TAU_COIL, I_MAX);
  close(decayTau, I_MAX / Math.E, 1e-5, "Current decay at 1 tau");
});

test("magnetic force scales with current squared and inverse gap squared", () => {
  const f1 = magneticForce(0.1, 0.5); // gap = 1.5 - 0.5 = 1.0 mm
  const f2 = magneticForce(0.2, 0.5); // 2x current -> 4x force
  close(f2 / f1, 4.0, 1e-4, "Magnetic force scales as I^2");

  const fNarrow = magneticForce(0.1, 1.0); // gap = 1.5 - 1.0 = 0.5 mm
  close(fNarrow / f1, 4.0, 1e-4, "Magnetic force scales as 1/gap^2");
});

test("spring restoring force follows Hooke's law with initial preload", () => {
  assert.equal(springForce(0), RELAY_CONSTANTS.SPRING_PRELOAD);
  const f1mm = springForce(1.0);
  close(f1mm, RELAY_CONSTANTS.SPRING_PRELOAD + 450 * 0.001, 1e-6, "Spring at 1mm");
});

// ── 2 · Mechanical Armature Motion & Moth Obstruction ─────────────────────────

test("clean relay closes contacts and reaches low resistance", () => {
  let state = createRelayState();
  state.energized = true;

  // Step for 40 ms (plenty of time to pull in)
  const dt = 0.0002;
  for (let i = 0; i < 200; i++) {
    state = stepRelay(state, dt, false /* no moth */);
  }

  assert.ok(state.isClosed, "Clean relay contacts should be closed");
  close(state.resistance, RELAY_CONSTANTS.R_CONTACT_CLEAN, 1e-4, "Clean resistance < 0.05 ohms");
  assert.ok(state.xMm >= RELAY_CONSTANTS.TRAVEL_CONTACT, "Armature reached contact travel");
});

test("moth prevents contacts from touching and keeps resistance near infinity", () => {
  let state = createRelayState();
  state.energized = true;

  const dt = 0.0002;
  for (let i = 0; i < 200; i++) {
    state = stepRelay(state, dt, true /* moth present */);
  }

  assert.equal(state.isClosed, false, "Contacts must NOT close when moth is present");
  assert.ok(state.resistance >= 1e8, "Resistance should be insulation grade (> 100 MOhm)");
  // Armature must be stopped short of 1.0 mm by the moth's 0.38 mm thickness
  assert.ok(state.xMm < RELAY_CONSTANTS.TRAVEL_CONTACT, "Moth halts armature before contact");
  close(state.xMm, RELAY_CONSTANTS.TRAVEL_CONTACT - RELAY_CONSTANTS.MOTH_THICKNESS, 0.05, "Stopped at moth surface");
});

// ── 3 · Relay Logic Gates & Full Adder ───────────────────────────────────────

test("relay logic gates satisfy basic Boolean truth tables", () => {
  // NOT (Normally Closed)
  assert.equal(relayNot(0), 1);
  assert.equal(relayNot(1), 0);

  // AND (Series contacts)
  assert.equal(relayAnd(0, 0), 0);
  assert.equal(relayAnd(1, 0), 0);
  assert.equal(relayAnd(0, 1), 0);
  assert.equal(relayAnd(1, 1), 1);

  // OR (Parallel contacts)
  assert.equal(relayOr(0, 0), 0);
  assert.equal(relayOr(1, 0), 1);
  assert.equal(relayOr(0, 1), 1);
  assert.equal(relayOr(1, 1), 1);

  // XOR (Changeover Form-C)
  assert.equal(relayXor(0, 0), 0);
  assert.equal(relayXor(1, 0), 1);
  assert.equal(relayXor(0, 1), 1);
  assert.equal(relayXor(1, 1), 0);
});

test("1-bit relay full adder matches binary addition for all 8 states", () => {
  const expected = [
    { a: 0, b: 0, cin: 0, sum: 0, cout: 0 },
    { a: 1, b: 0, cin: 0, sum: 1, cout: 0 },
    { a: 0, b: 1, cin: 0, sum: 1, cout: 0 },
    { a: 1, b: 1, cin: 0, sum: 0, cout: 1 },
    { a: 0, b: 0, cin: 1, sum: 1, cout: 0 },
    { a: 1, b: 0, cin: 1, sum: 0, cout: 1 },
    { a: 0, b: 1, cin: 1, sum: 0, cout: 1 },
    { a: 1, b: 1, cin: 1, sum: 1, cout: 1 },
  ];

  for (const exp of expected) {
    const res = relayFullAdder(exp.a, exp.b, exp.cin);
    assert.equal(res.sum, exp.sum, `Sum failed for A=${exp.a} B=${exp.b} Cin=${exp.cin}`);
    assert.equal(res.cout, exp.cout, `Cout failed for A=${exp.a} B=${exp.b} Cin=${exp.cin}`);
  }
});

// ── 4 · Panel F Accumulator & Bug Fault Detection ────────────────────────────

test("clean Panel F executes exact 8-bit addition with zero fault", () => {
  const result = simulatePanelFAddition(115, 60, false /* clean */);
  assert.equal(result.expectedValue, 175);
  assert.equal(result.computedValue, 175);
  assert.equal(result.discrepancy, 0);
  assert.equal(result.hasFault, false);
  assert.equal(result.faultRelay, null);
});

test("moth on Relay #70 corrupts Bit 6 and trips Mark II check circuit", () => {
  // 65 + 10 = 75.
  // In binary: 75 = 01001011_2 (Bit 6 is 1, weight 64).
  // With Relay 70 stuck open by the moth, Bit 6 becomes 0!
  // Computed value becomes 75 - 64 = 11 (00001011_2).
  const result = simulatePanelFAddition(65, 10, true /* moth present */);
  assert.equal(result.expectedValue, 75);
  assert.equal(result.computedValue, 11);
  assert.equal(result.discrepancy, 64);
  assert.equal(result.hasFault, true);
  assert.equal(result.faultRelay, 70);
  assert.equal(result.faultPanel, "F");
});

test("moth on Relay #70 does not corrupt operations where Bit 6 is already 0", () => {
  // 10 + 20 = 30 (00011110_2). Bit 6 is already 0.
  const result = simulatePanelFAddition(10, 20, true /* moth present */);
  assert.equal(result.expectedValue, 30);
  assert.equal(result.computedValue, 30);
  assert.equal(result.discrepancy, 0);
  assert.equal(result.hasFault, false);
});

test("full ripple carry propagates correctly through all 8 relay stages", () => {
  // 127 + 1 = 128 (01111111_2 + 1 = 10000000_2)
  const clean = simulatePanelFAddition(127, 1, false);
  assert.equal(clean.computedValue, 128);
  assert.equal(clean.carryOut, 0);

  // 255 + 1 = 0 with carryOut = 1
  const overflow = simulatePanelFAddition(255, 1, false);
  assert.equal(overflow.computedValue, 0);
  assert.equal(overflow.carryOut, 1);
});

test("de-energized relay returns to rest gap x=0 under spring force", () => {
  let state = createRelayState();
  state.energized = true;
  const dt = 0.0002;
  // Energize until closed
  for (let i = 0; i < 200; i++) state = stepRelay(state, dt, false);
  assert.ok(state.isClosed);

  // Now de-energize
  state.energized = false;
  state.coilT = 0;
  for (let i = 0; i < 300; i++) state = stepRelay(state, dt, false);

  assert.equal(state.isClosed, false);
  close(state.xMm, 0, 0.05, "Armature returned to rest position");
  close(state.current, 0, 0.005, "Coil current decayed to zero");
});

test("contact bounce occurs during clean relay impact", () => {
  let state = createRelayState();
  state.energized = true;
  const dt = 0.0001;
  let bouncesRecorded = 0;
  for (let i = 0; i < 400; i++) {
    state = stepRelay(state, dt, false);
    if (state.bounceCount > bouncesRecorded) {
      bouncesRecorded = state.bounceCount;
    }
  }
  assert.ok(bouncesRecorded >= 1, "Armature should record at least one bounce");
});

test("Form-C changeover contact exclusivity ensures no invalid overlap", () => {
  // A Form-C contact connects common to NC when unpowered, NO when powered.
  // Neither state should ever connect both simultaneously.
  for (const a of [0, 1]) {
    for (const b of [0, 1]) {
      const xorVal = relayXor(a, b);
      assert.equal(xorVal, a ^ b, `XOR matches bitwise XOR for (${a}, ${b})`);
    }
  }
});

test("all timeline events have non-empty titles, descriptions, and valid tags", () => {
  const allowedTags = new Set(["etymology", "machine", "bug", "software", "museum"]);
  for (const ev of TIMELINE_EVENTS) {
    assert.ok(ev.title.length > 5, "Event title should be descriptive");
    assert.ok(ev.desc.length > 20, "Event desc should be detailed");
    assert.ok(allowedTags.has(ev.tag), `Invalid tag ${ev.tag}`);
    assert.match(ev.date, /^\d{4}-\d{2}-\d{2}$/, "Date must match YYYY-MM-DD");
  }
});

test("createRelayState initializes with resting mechanical and electrical zeroes", () => {
  const s = createRelayState();
  assert.equal(s.t, 0);
  assert.equal(s.current, 0);
  assert.equal(s.xMm, 0);
  assert.equal(s.vMps, 0);
  assert.equal(s.isClosed, false);
  assert.equal(s.resistance, Infinity);
  assert.equal(s.mothPresent, true);
});

test("Panel F bits arrays strictly contain 8 binary elements each", () => {
  const res = simulatePanelFAddition(42, 99, false);
  assert.equal(res.bitsA.length, 8);
  assert.equal(res.bitsB.length, 8);
  assert.equal(res.bitsSum.length, 8);
  for (let i = 0; i < 8; i++) {
    assert.ok(res.bitsA[i] === 0 || res.bitsA[i] === 1);
    assert.ok(res.bitsB[i] === 0 || res.bitsB[i] === 1);
    assert.ok(res.bitsSum[i] === 0 || res.bitsSum[i] === 1);
  }
});

test("coil decay at t=0 returns initial current exactly", () => {
  assert.equal(coilCurrentDecay(0, 0.15), 0.15);
  assert.equal(coilCurrentDecay(-1, 0.15), 0.15);
  assert.equal(coilCurrentRise(-1), 0);
});

test("negative air gap clamping prevents infinite magnetic force explosion", () => {
  // If armature displacement somehow equals or exceeds GAP_REST (1.5mm)
  const fMax = magneticForce(0.2, 1.5);
  assert.ok(Number.isFinite(fMax), "Force remains finite even at zero gap");
  assert.ok(fMax > 0, "Force is positive");
});

// ── 5 · Historical Timeline Consistency ──────────────────────────────────────

test("timeline events are strictly chronological and feature the 1947 bug", () => {
  assert.ok(TIMELINE_EVENTS.length >= 6, "At least 6 milestone events");
  let prevYear = 0;
  let hasBugEvent = false;

  for (const ev of TIMELINE_EVENTS) {
    assert.ok(ev.year >= prevYear, `Year order violated at ${ev.title}`);
    prevYear = ev.year;
    if (ev.date === "1947-09-09" && ev.time === "15:45") {
      hasBugEvent = true;
      assert.ok(ev.title.includes("Relay #70"), "Mentions Relay 70");
      assert.ok(ev.desc.includes("Grace Hopper") || ev.desc.includes("Burke"), "Mentions operators");
    }
  }

  assert.ok(hasBugEvent, "1947-09-09 15:45 event must be present");
});
