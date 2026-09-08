// physics.js — Electromechanics of the 1947 Harvard Mark II Aiken Relay
// and the arithmetic check circuits of Panel F (Relay #70).

export const RELAY_CONSTANTS = {
  V_COIL: 50,           // Operating coil voltage (Volts DC)
  R_COIL: 250,          // Coil winding resistance (Ohms)
  L_COIL: 1.2,          // Coil inductance (Henries)
  GAP_REST: 1.5,        // Rest air gap (mm)
  TRAVEL_CONTACT: 1.0,  // Armature displacement where silver contacts touch (mm)
  TRAVEL_MAX: 1.2,      // Hard mechanical overtravel stop (mm)
  MOTH_THICKNESS: 0.38, // Physical thickness of crushed moth (mm)
  R_CONTACT_CLEAN: 0.02,// Clean silver contact resistance (Ohms)
  R_CONTACT_MOTH: 1e8,  // Dielectric insulation of moth tissue (Ohms)
  ARMATURE_MASS: 0.015, // Armature assembly mass (kg)
  SPRING_K: 450,        // Return spring stiffness (N/m)
  SPRING_PRELOAD: 0.35, // Return spring preload (N)
  MAG_COEFF: 6.8e-5,    // Magnetic force constant (N·m²/A²)
  DAMPING: 3.2,         // Mechanical friction/air damping (N·s/m)
  RESTITUTION: 0.38,    // Contact pad collision coefficient of restitution
};

export const TAU_COIL = RELAY_CONSTANTS.L_COIL / RELAY_CONSTANTS.R_COIL; // 4.8 ms
export const I_MAX = RELAY_CONSTANTS.V_COIL / RELAY_CONSTANTS.R_COIL;     // 0.2 A (200 mA)

/**
 * Closed-form coil current rise during energization:
 * I(t) = I_max * (1 - e^(-t / tau))
 */
export function coilCurrentRise(t) {
  if (t <= 0) return 0;
  return I_MAX * (1 - Math.exp(-t / TAU_COIL));
}

/**
 * Closed-form coil current decay during de-energization:
 * I(t) = I_0 * e^(-t / tau)
 */
export function coilCurrentDecay(t, i0 = I_MAX) {
  if (t <= 0) return i0;
  return i0 * Math.exp(-t / TAU_COIL);
}

/**
 * Electromagnetic tractive force between core and armature:
 * F_mag = K_mag * (I / gap)^2
 * where gap = gap_rest - x (in meters)
 */
export function magneticForce(current, xMm) {
  const gapM = Math.max(0.1, RELAY_CONSTANTS.GAP_REST - xMm) * 1e-3;
  return RELAY_CONSTANTS.MAG_COEFF * Math.pow(current / gapM, 2);
}

/**
 * Restoring spring force: F_spring = F_0 + k * x
 */
export function springForce(xMm) {
  const xM = Math.max(0, xMm) * 1e-3;
  return RELAY_CONSTANTS.SPRING_PRELOAD + RELAY_CONSTANTS.SPRING_K * xM;
}

/**
 * Creates initial state for a relay physics instance
 */
export function createRelayState() {
  return {
    t: 0,
    energized: false,
    coilT: 0,
    current: 0,
    xMm: 0,        // Displacement towards core (0 to TRAVEL_MAX)
    vMps: 0,       // Velocity (m/s)
    isClosed: false,
    resistance: Infinity,
    bounceCount: 0,
    mothPresent: true,
  };
}

/**
 * Step relay physics through dt seconds (sub-millisecond Euler/Verlet step).
 */
export function stepRelay(state, dt, mothPresent) {
  const s = { ...state, mothPresent };
  s.t += dt;
  s.coilT += dt;

  // 1. Electrical current
  if (s.energized) {
    s.current = coilCurrentRise(s.coilT);
  } else {
    s.current = coilCurrentDecay(s.coilT, s.current);
  }

  // 2. Forces
  const fMag = s.energized ? magneticForce(s.current, s.xMm) : 0;
  const fSpring = springForce(s.xMm);
  const fDamp = RELAY_CONSTANTS.DAMPING * s.vMps;
  const fNet = fMag - fSpring - fDamp;

  // 3. Acceleration & Velocity
  const a = fNet / RELAY_CONSTANTS.ARMATURE_MASS;
  s.vMps += a * dt;

  // 4. Position update (in mm)
  s.xMm += s.vMps * dt * 1000;

  // Mechanical limit determination
  // Without moth: contacts touch at TRAVEL_CONTACT (1.0 mm), travel can compress up to TRAVEL_MAX (1.2 mm)
  // With moth: moth stops armature early at TRAVEL_CONTACT - MOTH_THICKNESS (0.62 mm)
  const contactTouchX = RELAY_CONSTANTS.TRAVEL_CONTACT;
  const maxStopX = mothPresent
    ? contactTouchX - RELAY_CONSTANTS.MOTH_THICKNESS
    : RELAY_CONSTANTS.TRAVEL_MAX;

  // Contact collision logic
  if (s.xMm >= maxStopX) {
    s.xMm = maxStopX;
    if (s.vMps > 0.02) {
      // Rebound with restitution
      s.vMps = -s.vMps * RELAY_CONSTANTS.RESTITUTION;
      s.bounceCount++;
    } else {
      s.vMps = 0;
    }
  } else if (s.xMm <= 0) {
    // Rest stop against backplate
    s.xMm = 0;
    if (s.vMps < 0) s.vMps = 0;
  }

  // Conduction test:
  // Contacts conduct only if clean AND pressed together (xMm >= contactTouchX)
  if (!mothPresent && s.xMm >= contactTouchX - 0.01) {
    s.isClosed = true;
    s.resistance = RELAY_CONSTANTS.R_CONTACT_CLEAN;
  } else {
    s.isClosed = false;
    s.resistance = mothPresent ? RELAY_CONSTANTS.R_CONTACT_MOTH : Infinity;
  }

  return s;
}

// ── 2 · Relay Logic Gates & Adder ────────────────────────────────────────────

/**
 * Inverter (NOT) using Normally Closed (NC) contacts:
 * If coil energized, contact opens -> output 0.
 */
export function relayNot(a) {
  return a ? 0 : 1;
}

/**
 * AND gate: two Normally Open (NO) contacts in series.
 * Current passes only if both coils are energized.
 */
export function relayAnd(a, b) {
  return (a && b) ? 1 : 0;
}

/**
 * OR gate: two NO contacts in parallel.
 * Current passes if either coil is energized.
 */
export function relayOr(a, b) {
  return (a || b) ? 1 : 0;
}

/**
 * XOR gate using Form-C changeover relay contacts:
 * A * !B + !A * B
 */
export function relayXor(a, b) {
  return ((a && !b) || (!a && b)) ? 1 : 0;
}

/**
 * 1-bit Full Adder built with relay switch contacts.
 * Sum = A ⊕ B ⊕ Cin
 * Cout = (A · B) + Cin · (A ⊕ B)
 */
export function relayFullAdder(a, b, cin) {
  const aXorB = relayXor(a, b);
  const sum = relayXor(aXorB, cin);
  const cout = relayOr(relayAnd(a, b), relayAnd(cin, aXorB));
  return { sum, cout };
}

// ── 3 · Panel F 8-Bit Accumulator & Check Circuit ─────────────────────────────

/**
 * Harvard Mark II Panel F Register & Arithmetic Unit.
 * Holds an 8-bit accumulator register (bits 0..7).
 * Relay #70 corresponds to Bit 6 (weight 2^6 = 64).
 *
 * In the Mark II, automatic checking compared redundant computational channels
 * or performed complement residue checks. If the computed result differed from
 * the expected arithmetic, a fault relay tripped and halted the sequence.
 */
export function simulatePanelFAddition(operandA, operandB, mothOnRelay70 = true) {
  const bitsA = [];
  const bitsB = [];
  const bitsSum = [];
  let carry = 0;

  for (let i = 0; i < 8; i++) {
    const bitA = (operandA >> i) & 1;
    const bitB = (operandB >> i) & 1;
    bitsA.push(bitA);
    bitsB.push(bitB);

    let { sum, cout } = relayFullAdder(bitA, bitB, carry);

    // Relay 70 specifically controls Bit 6 of Panel F
    if (i === 6 && mothOnRelay70) {
      // Moth physically insulates the silver contact!
      // The bit line floats to open-circuit (0 logic level).
      sum = 0;
    }

    bitsSum.push(sum);
    carry = cout;
  }

  const computedValue = bitsSum.reduce((acc, bit, idx) => acc + (bit << idx), 0);
  const expectedValue = (operandA + operandB) & 0xFF;
  const discrepancy = expectedValue - computedValue;
  const hasFault = discrepancy !== 0;

  return {
    operandA,
    operandB,
    expectedValue,
    computedValue,
    discrepancy,
    hasFault,
    faultRelay: hasFault ? 70 : null,
    faultPanel: hasFault ? "F" : null,
    bitsA,
    bitsB,
    bitsSum,
    carryOut: carry,
  };
}

// ── 4 · Historical Timeline Events ───────────────────────────────────────────

export const TIMELINE_EVENTS = [
  {
    year: 1878,
    date: "1878-03-03",
    title: "Edison's 'Bugs' in Telegraphy",
    desc: "Thomas Edison writes to Western Union describing technical glitches in multiplex telegraph circuits as 'bugs' that take time to find.",
    tag: "etymology",
  },
  {
    year: 1944,
    date: "1944-08-07",
    title: "Harvard Mark I Dedicated",
    desc: "Aiken and IBM unveil the ASCC (Mark I) at Harvard — mechanical rotating shafts, counters, and relays calculating ballistics.",
    tag: "machine",
  },
  {
    year: 1947,
    date: "1947-07-01",
    title: "Mark II Aiken Relay Calculator Built",
    desc: "Constructed at Gordon McKay Lab with 13,000 high-speed telephone-type relays, 10-digit floating-point precision, and dual checking circuits.",
    tag: "machine",
  },
  {
    year: 1947,
    date: "1947-09-09",
    time: "15:45",
    title: "Relay #70 Panel F (Moth) Found ★",
    desc: "Operator William Burke extracts a 2-inch moth trapped in Relay #70 with tweezers. Grace Hopper pastes it into the logbook: 'First actual case of bug being found.'",
    tag: "bug",
  },
  {
    year: 1952,
    date: "1952-05-01",
    title: "Grace Hopper's A-0 Compiler",
    desc: "Hopper pioneers automated translation of human-readable code to machine language, establishing modern software debugging routines.",
    tag: "software",
  },
  {
    year: 1959,
    date: "1959-04-08",
    title: "Creation of COBOL",
    desc: "Grace Hopper and the CODASYL committee design COBOL, bringing structured English syntax and rigorous diagnostics to computing.",
    tag: "software",
  },
  {
    year: 1991,
    date: "1991-09-16",
    title: "Smithsonian Exhibition",
    desc: "The original 1947-09-09 Harvard Mark II logbook sheet with the preserved moth is permanently housed at the Smithsonian National Museum of American History.",
    tag: "museum",
  },
];
