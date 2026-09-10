/**
 * George Stibitz Complex Number Calculator (Model I, 1939-1940)
 * & Dartmouth Telecomputing Network Simulation Engine
 *
 * Covers:
 * 1. Baudot / ITA-2 5-bit teletype encoding, serial frames, and 250-mile telegraph current loop.
 * 2. Excess-3 (Stibitz code) decimal arithmetic, self-complementing 9's complement, and carry correction.
 * 3. Complex Number Calculator algebraic cross-multiplier, divider, and relay execution cycles.
 * 4. 1937 Kitchen Table "Model K" 1-bit relay adder logic.
 */

// --- 1. Baudot / ITA-2 5-bit Teletype Encoding ---

export const BAUDOT_LTRS = {
  '\n': 0x02, '\r': 0x08, ' ': 0x04,
  'A': 0x18, 'B': 0x13, 'C': 0x0e, 'D': 0x12, 'E': 0x10, 'F': 0x16,
  'G': 0x0b, 'H': 0x05, 'I': 0x0c, 'J': 0x1a, 'K': 0x1e, 'L': 0x09,
  'M': 0x07, 'N': 0x06, 'O': 0x03, 'P': 0x0d, 'Q': 0x1d, 'R': 0x0a,
  'S': 0x14, 'T': 0x01, 'U': 0x1c, 'V': 0x0f, 'W': 0x19, 'X': 0x17,
  'Y': 0x15, 'Z': 0x11
};

export const BAUDOT_FIGS = {
  '\n': 0x02, '\r': 0x08, ' ': 0x04,
  '-': 0x18, '?': 0x13, ':': 0x0e, '$': 0x12, '3': 0x10, '!': 0x16,
  '&': 0x0b, '#': 0x05, '8': 0x0c, '\'': 0x1a, '(': 0x1e, ')': 0x09,
  '.': 0x07, ',': 0x06, '9': 0x03, '0': 0x0d, '1': 0x1d, '4': 0x0a,
  '\'': 0x14, '5': 0x01, '7': 0x1c, ';': 0x0f, '2': 0x19, '/': 0x17,
  '6': 0x15, '+': 0x11, '=': 0x1f
};

export const CODE_LTRS_SHIFT = 0x1f; // 11111 LTRS shift
export const CODE_FIGS_SHIFT = 0x1b; // 11011 FIGS shift

export function encodeBaudotString(str) {
  const frames = [];
  let currentMode = 'LTRS'; // or 'FIGS'

  for (let ch of str.toUpperCase()) {
    if (ch === ' ' || ch === '\r' || ch === '\n') {
      const code = BAUDOT_LTRS[ch];
      frames.push({ char: ch, code, mode: currentMode, bits: to5Bits(code) });
      continue;
    }

    if (ch in BAUDOT_LTRS && !(ch in BAUDOT_FIGS && currentMode === 'FIGS' && '0123456789+-=./'.includes(ch))) {
      if (currentMode !== 'LTRS') {
        frames.push({ char: '[LTRS]', code: CODE_LTRS_SHIFT, mode: 'LTRS', bits: to5Bits(CODE_LTRS_SHIFT) });
        currentMode = 'LTRS';
      }
      frames.push({ char: ch, code: BAUDOT_LTRS[ch], mode: 'LTRS', bits: to5Bits(BAUDOT_LTRS[ch]) });
    } else if (ch in BAUDOT_FIGS) {
      if (currentMode !== 'FIGS') {
        frames.push({ char: '[FIGS]', code: CODE_FIGS_SHIFT, mode: 'FIGS', bits: to5Bits(CODE_FIGS_SHIFT) });
        currentMode = 'FIGS';
      }
      frames.push({ char: ch, code: BAUDOT_FIGS[ch], mode: 'FIGS', bits: to5Bits(BAUDOT_FIGS[ch]) });
    }
  }
  return frames;
}

export function to5Bits(code) {
  // Returns array of 5 booleans/bits: [bit0, bit1, bit2, bit3, bit4] (LSB to MSB)
  const bits = [];
  for (let i = 0; i < 5; i++) {
    bits.push((code >> i) & 1);
  }
  return bits;
}

export function generateSerialPulseTrain(bitArray) {
  // Teletype serial transmission frame:
  // Start bit: Space (0)
  // 5 data bits (LSB to MSB)
  // Stop bit: Mark (1) (traditionally 1.42 bit intervals)
  return [0, ...bitArray, 1];
}

// Telegraph line attenuation and RC smoothing (250 miles of No. 19 AWG open wire)
export function simulateCurrentLoopWaveform(pulses, bitDurationMs = 22.0, sampleRate = 10) {
  // Neutral 60 mA DC current loop
  // I_steady = 60 mA
  // Line parameters: R ~= 10.5 Ohm/mile * 250 = 2625 Ohm
  // Line capacitance C ~= 0.01 uF/mile * 250 = 2.5 uF
  // Time constant tau ~= R * C / 4 ~= 1.64 ms
  const tauMs = 1.8;
  const samples = [];
  let currentMa = 0.0;
  const dt = 1.0 / sampleRate;

  for (let bit of pulses) {
    const targetMa = bit === 1 ? 60.0 : 0.0;
    const steps = Math.round(bitDurationMs * sampleRate);
    for (let s = 0; s < steps; s++) {
      currentMa += (targetMa - currentMa) * (1.0 - Math.exp(-dt / tauMs));
      samples.push(currentMa);
    }
  }
  return samples;
}

// --- 2. Excess-3 (Stibitz Code) Arithmetic Engine ---

/**
 * Excess-3 (XS-3) representation of a decimal digit (0..9):
 * digit d -> d + 3 in 4-bit binary (range 3 to 12).
 */
export function decimalToXS3(d) {
  if (d < 0 || d > 9) throw new Error(`Invalid decimal digit: ${d}`);
  return d + 3;
}

export function xs3ToDecimal(xs) {
  if (xs < 3 || xs > 12) throw new Error(`Invalid XS-3 code: ${xs}`);
  return xs - 3;
}

export function to4Bits(val) {
  return [
    (val >> 3) & 1,
    (val >> 2) & 1,
    (val >> 1) & 1,
    val & 1
  ];
}

/**
 * Stibitz's fundamental theorem of Excess-3:
 * The 9's complement of decimal digit D is the exact bitwise inversion (1's complement)
 * of its 4-bit Excess-3 representation!
 * ~XS3(D) = XS3(9 - D)
 */
export function xs3NinesComplement(xs) {
  // Invert 4 bits: 15 - xs
  return (~xs) & 0x0F;
}

/**
 * 1-Digit Excess-3 Relay Full Adder Step:
 * Adds two XS-3 digits with carry in.
 *
 * Mathematical derivation:
 * (A + 3) + (B + 3) + Cin = (A + B + Cin) + 6
 *
 * Case 1: If (A + B + Cin) >= 10, the 4-bit binary adder overflows (sum >= 16).
 * Binary carry Cout = 1.
 * In 4-bit register: rawSum = (A + B + Cin + 6) - 16 = (A + B + Cin) - 10.
 * To put this result back in Excess-3:
 * Target = (A + B + Cin - 10) + 3.
 * Correction needed: rawSum + 3 = rawSum + 0011_2!
 *
 * Case 2: If (A + B + Cin) < 10, no 4-bit binary carry (Cout = 0).
 * Binary carry Cout = 0.
 * In 4-bit register: rawSum = A + B + Cin + 6.
 * Target = (A + B + Cin) + 3.
 * Correction needed: rawSum - 3 = rawSum + 1101_2 (mod 16)!
 */
export function addXS3Digits(xsA, xsB, carryIn = 0) {
  const rawSum = xsA + xsB + carryIn;
  const carryOut = rawSum >= 16 ? 1 : 0;
  const raw4Bit = rawSum & 0x0F;

  let correction;
  let corrected4Bit;
  if (carryOut === 1) {
    correction = 3; // add 0011
    corrected4Bit = (raw4Bit + 3) & 0x0F;
  } else {
    correction = -3; // subtract 0011 (add 13 mod 16)
    corrected4Bit = (raw4Bit + 13) & 0x0F;
  }

  return {
    xsA,
    xsB,
    carryIn,
    rawSum,
    carryOut,
    raw4Bit,
    correction,
    correctedXS3: corrected4Bit,
    resultDigit: xs3ToDecimal(corrected4Bit)
  };
}

/**
 * Multi-digit Excess-3 Decimal Addition
 */
export function addXS3Numbers(digitsA, digitsB) {
  const maxLen = Math.max(digitsA.length, digitsB.length);
  const padA = Array(maxLen - digitsA.length).fill(0).concat(digitsA);
  const padB = Array(maxLen - digitsB.length).fill(0).concat(digitsB);

  let carry = 0;
  const steps = [];
  const resultDigits = [];

  for (let i = maxLen - 1; i >= 0; i--) {
    const da = padA[i];
    const db = padB[i];
    const xsA = decimalToXS3(da);
    const xsB = decimalToXS3(db);
    const step = addXS3Digits(xsA, xsB, carry);
    steps.unshift(step);
    resultDigits.unshift(step.resultDigit);
    carry = step.carryOut;
  }

  if (carry > 0) {
    resultDigits.unshift(carry);
  }

  return {
    padA,
    padB,
    steps,
    resultDigits,
    carryFinal: carry,
    numericResult: parseInt(resultDigits.join(''), 10)
  };
}

/**
 * Multi-digit Excess-3 Decimal Subtraction using 9's Complement and End-Around Carry
 * (or 10's complement with carryIn = 1)
 */
export function subtractXS3Numbers(digitsA, digitsB) {
  const maxLen = Math.max(digitsA.length, digitsB.length);
  const padA = Array(maxLen - digitsA.length).fill(0).concat(digitsA);
  const padB = Array(maxLen - digitsB.length).fill(0).concat(digitsB);

  // Invert B's XS-3 digits bitwise to get 9's complement!
  const ninesCompB = padB.map(d => {
    const xs = decimalToXS3(d);
    const compXS = xs3NinesComplement(xs);
    return xs3ToDecimal(compXS);
  });

  // Add A + 9's complement of B + 1 (10's complement)
  const addResult = addXS3Numbers(padA, ninesCompB);
  let carry = 1; // carry-in for 10's complement
  const steps = [];
  const resultDigits = [];

  for (let i = maxLen - 1; i >= 0; i--) {
    const xsA = decimalToXS3(padA[i]);
    const xsCompB = xs3NinesComplement(decimalToXS3(padB[i]));
    const step = addXS3Digits(xsA, xsCompB, carry);
    steps.unshift(step);
    resultDigits.unshift(step.resultDigit);
    carry = step.carryOut;
  }

  const isNegative = carry === 0;
  return {
    padA,
    padB,
    ninesCompB,
    steps,
    resultDigits,
    carryOut: carry,
    isNegative,
    numericResult: isNegative ? - (Math.pow(10, maxLen) - parseInt(resultDigits.join(''), 10)) : parseInt(resultDigits.join(''), 10)
  };
}

// --- 3. Complex Number Calculator (Model I, 1939-1940) Engine ---

export class ComplexNumber {
  constructor(real, imag) {
    this.real = Number(real);
    this.imag = Number(imag);
  }

  format(precision = 4) {
    const r = Number(this.real.toFixed(precision));
    const i = Number(this.imag.toFixed(precision));
    const sign = i >= 0 ? '+' : '-';
    return `${r} ${sign} ${Math.abs(i)}i`;
  }

  magnitude() {
    return Math.hypot(this.real, this.imag);
  }

  phaseRad() {
    return Math.atan2(this.imag, this.real);
  }

  phaseDeg() {
    return (this.phaseRad() * 180) / Math.PI;
  }
}

export function executeComplexOperation(z1, z2, op) {
  const x1 = z1.real;
  const y1 = z1.imag;
  const x2 = z2.real;
  const y2 = z2.imag;

  let result;
  const cycles = [];

  switch (op) {
    case '+': {
      const real = x1 + x2;
      const imag = y1 + y2;
      result = new ComplexNumber(real, imag);
      cycles.push({
        step: 1,
        desc: 'Relay Register Add: Reg A (X1) + Reg C (X2) -> Real Acc',
        detail: `${x1} + ${x2} = ${real}`
      });
      cycles.push({
        step: 2,
        desc: 'Relay Register Add: Reg B (Y1) + Reg D (Y2) -> Imag Acc',
        detail: `${y1} + ${y2} = ${imag}`
      });
      break;
    }
    case '-': {
      const real = x1 - x2;
      const imag = y1 - y2;
      result = new ComplexNumber(real, imag);
      cycles.push({
        step: 1,
        desc: 'Relay Register Subtract: Reg A (X1) - Reg C (X2) via 9\'s complement',
        detail: `${x1} - ${x2} = ${real}`
      });
      cycles.push({
        step: 2,
        desc: 'Relay Register Subtract: Reg B (Y1) - Reg D (Y2) via 9\'s complement',
        detail: `${y1} - ${y2} = ${imag}`
      });
      break;
    }
    case '*': {
      // (x1 + i y1)(x2 + i y2) = (x1 x2 - y1 y2) + i(x1 y2 + x2 y1)
      const p1 = x1 * x2;
      const p2 = y1 * y2;
      const p3 = x1 * y2;
      const p4 = x2 * y1;

      const real = p1 - p2;
      const imag = p3 + p4;
      result = new ComplexNumber(real, imag);

      cycles.push({ step: 1, desc: 'Partial Product 1: X1 * X2', detail: `${x1} * ${x2} = ${p1}` });
      cycles.push({ step: 2, desc: 'Partial Product 2: Y1 * Y2', detail: `${y1} * ${y2} = ${p2}` });
      cycles.push({ step: 3, desc: 'Real Accumulator: (X1*X2) - (Y1*Y2)', detail: `${p1} - ${p2} = ${real}` });
      cycles.push({ step: 4, desc: 'Partial Product 3: X1 * Y2', detail: `${x1} * ${y2} = ${p3}` });
      cycles.push({ step: 5, desc: 'Partial Product 4: X2 * Y1', detail: `${x2} * ${y1} = ${p4}` });
      cycles.push({ step: 6, desc: 'Imag Accumulator: (X1*Y2) + (X2*Y1)', detail: `${p3} + ${p4} = ${imag}` });
      break;
    }
    case '/': {
      // (x1 + i y1) / (x2 + i y2) = [(x1 x2 + y1 y2) + i(y1 x2 - x1 y2)] / (x2^2 + y2^2)
      const denom = x2 * x2 + y2 * y2;
      if (denom === 0) throw new Error('Division by zero in complex denominator');

      const p1 = x1 * x2;
      const p2 = y1 * y2;
      const p3 = y1 * x2;
      const p4 = x1 * y2;

      const numReal = p1 + p2;
      const numImag = p3 - p4;

      const real = numReal / denom;
      const imag = numImag / denom;
      result = new ComplexNumber(real, imag);

      cycles.push({ step: 1, desc: 'Denominator Relay Calculation: X2^2 + Y2^2', detail: `${x2}^2 + ${y2}^2 = ${denom}` });
      cycles.push({ step: 2, desc: 'Real Numerator: (X1*X2) + (Y1*Y2)', detail: `${p1} + ${p2} = ${numReal}` });
      cycles.push({ step: 3, desc: 'Imag Numerator: (Y1*X2) - (X1*Y2)', detail: `${p3} - ${p4} = ${numImag}` });
      cycles.push({ step: 4, desc: 'Relay Repeated Subtraction Division (Real): Numerator / Denom', detail: `${numReal} / ${denom} = ${real.toFixed(4)}` });
      cycles.push({ step: 5, desc: 'Relay Repeated Subtraction Division (Imag): Numerator / Denom', detail: `${numImag} / ${denom} = ${imag.toFixed(4)}` });
      break;
    }
    default:
      throw new Error(`Unknown operator: ${op}`);
  }

  return {
    z1,
    z2,
    op,
    result,
    cycles,
    estimatedRelayTimeMs: cycles.length * 15.0 + 80.0 // ~15ms per relay cycle + settling
  };
}

// --- 4. 1937 Kitchen Table "Model K" 1-Bit Adder Logic ---

export function simulateModelKAdder(inputA, inputB, carryIn = 0) {
  // Stibitz used two Western Electric telephone relays, dry cells, flashlight bulbs, and a strip of tin can.
  // Relay A coil energizes if inputA === 1
  // Relay B coil energizes if inputB === 1
  // Contacts route current to Sum bulb and Carry bulb.
  const a = Boolean(inputA);
  const b = Boolean(inputB);
  const cin = Boolean(carryIn);

  // Sum = A XOR B XOR Cin
  const sum = (a ^ b ^ cin) ? 1 : 0;

  // Carry = (A AND B) OR (Cin AND (A XOR B))
  const carryOut = ((a && b) || (cin && (a ^ b))) ? 1 : 0;

  return {
    inputA: a ? 1 : 0,
    inputB: b ? 1 : 0,
    carryIn: cin ? 1 : 0,
    sumBulb: sum,
    carryBulb: carryOut,
    relayA_energized: a,
    relayB_energized: b
  };
}

// --- 5. 250-Mile Telegraph Propagation & Delay Model ---

export function calculateTransmissionMetrics(distanceMiles = 250, characterCount = 20) {
  // Speed of electromagnetic propagation in open copper wire: ~ 0.7c
  const cMilesPerSec = 186282; // speed of light in miles/s
  const vSignal = 0.7 * cMilesPerSec; // ~130,400 miles/s
  const propDelayOneWayMs = (distanceMiles / vSignal) * 1000; // ~ 1.92 ms

  // Mechanical telegraph repeaters every ~60 miles (Springfield, Hartford, New Haven)
  const numRepeaters = Math.floor(distanceMiles / 65);
  const repeaterDelayMs = numRepeaters * 6.0; // ~6ms per electromechanical repeater armature transit

  // Baudot Teletype line timing:
  // 60 words per minute standard:
  // 1 word = 6 characters (including space) -> 360 chars/min = 6 chars/sec.
  // Bit rate = 45.45 baud -> 22.0 ms per bit.
  // 1 frame = 1 start bit + 5 data bits + 1.42 stop bits = 7.42 bits = 163.2 ms per char.
  const bitDurationMs = 22.0;
  const frameBits = 7.42;
  const charDurationMs = bitDurationMs * frameBits; // ~ 163.2 ms
  const totalTransmissionMs = characterCount * charDurationMs;

  const totalRoundTripNetworkDelayMs = (propDelayOneWayMs + repeaterDelayMs) * 2;

  return {
    distanceMiles,
    propDelayOneWayMs,
    numRepeaters,
    repeaterDelayMs,
    bitDurationMs,
    charDurationMs,
    totalTransmissionMs,
    totalRoundTripNetworkDelayMs
  };
}
