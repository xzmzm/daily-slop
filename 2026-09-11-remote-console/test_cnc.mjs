import assert from 'node:assert/strict';
import {
  decimalToXS3,
  xs3ToDecimal,
  xs3NinesComplement,
  to4Bits,
  addXS3Digits,
  addXS3Numbers,
  subtractXS3Numbers,
  encodeBaudotString,
  to5Bits,
  generateSerialPulseTrain,
  simulateCurrentLoopWaveform,
  ComplexNumber,
  executeComplexOperation,
  simulateModelKAdder,
  calculateTransmissionMetrics
} from './cnc.js';

console.log('--- Running George Stibitz CNC Test Suite ---');

// 1. Test Excess-3 Digit Mapping
console.log('Testing Excess-3 digit mapping (0..9)...');
for (let d = 0; d <= 9; d++) {
  const xs = decimalToXS3(d);
  assert.equal(xs, d + 3, `XS-3 of ${d} should be ${d + 3}`);
  assert.equal(xs3ToDecimal(xs), d, `Decimal of XS-3 ${xs} should be ${d}`);
}

// 2. Test Stibitz 9's Complement Invariant (Self-Complementary)
console.log("Testing Stibitz 9's complement bitwise inversion invariant...");
for (let d = 0; d <= 9; d++) {
  const xs = decimalToXS3(d);
  const inverted = xs3NinesComplement(xs);
  const expectedDecimal = 9 - d;
  const expectedXS3 = decimalToXS3(expectedDecimal);
  assert.equal(inverted, expectedXS3, `Bitwise NOT of XS-3(${d}) must equal XS-3(${expectedDecimal})`);
}

// 3. Test 1-Digit Excess-3 Additions (No Carry and With Carry)
console.log('Testing 1-digit Excess-3 addition cases...');
{
  // 3 + 4 = 7 (no carry, rawSum = 6 + 7 = 13, correction = -3 -> 10, decimal 7)
  const step1 = addXS3Digits(decimalToXS3(3), decimalToXS3(4), 0);
  assert.equal(step1.carryOut, 0);
  assert.equal(step1.resultDigit, 7);
  assert.equal(step1.correction, -3);

  // 7 + 8 = 15 (carry out = 1, rawSum = 10 + 11 = 21 -> 5 mod 16, correction = +3 -> 8, decimal 5)
  const step2 = addXS3Digits(decimalToXS3(7), decimalToXS3(8), 0);
  assert.equal(step2.carryOut, 1);
  assert.equal(step2.resultDigit, 5);
  assert.equal(step2.correction, 3);

  // 9 + 9 + 1 (with carry in) = 19 -> result 9, carryOut 1
  const step3 = addXS3Digits(decimalToXS3(9), decimalToXS3(9), 1);
  assert.equal(step3.carryOut, 1);
  assert.equal(step3.resultDigit, 9);
}

// 4. Test Multi-digit Excess-3 Addition
console.log('Testing multi-digit Excess-3 decimal addition...');
{
  const r1 = addXS3Numbers([4, 5, 6], [7, 8, 9]); // 456 + 789 = 1245
  assert.equal(r1.numericResult, 1245);

  const r2 = addXS3Numbers([9, 9, 9], [1]); // 999 + 1 = 1000
  assert.equal(r2.numericResult, 1000);

  const r3 = addXS3Numbers([0], [0]); // 0 + 0 = 0
  assert.equal(r3.numericResult, 0);
}

// 5. Test Multi-digit Excess-3 Subtraction via 9's Complement
console.log("Testing multi-digit Excess-3 subtraction via 9's complement...");
{
  // 542 - 217 = 325
  const s1 = subtractXS3Numbers([5, 4, 2], [2, 1, 7]);
  assert.equal(s1.numericResult, 325);
  assert.equal(s1.isNegative, false);

  // 850 - 850 = 0
  const s2 = subtractXS3Numbers([8, 5, 0], [8, 5, 0]);
  assert.equal(s2.numericResult, 0);
}

// 6. Test Baudot 5-bit Encoding & Shift Codes
console.log('Testing Baudot 5-bit encoding and shift states...');
{
  const msg = 'AMS 1940';
  const frames = encodeBaudotString(msg);
  // Should transition between LTRS and FIGS
  const letters = frames.filter(f => f.mode === 'LTRS' && f.char !== '[LTRS]');
  const figures = frames.filter(f => f.mode === 'FIGS' && f.char !== '[FIGS]');
  assert(letters.some(f => f.char === 'A'));
  assert(letters.some(f => f.char === 'M'));
  assert(letters.some(f => f.char === 'S'));
  assert(figures.some(f => f.char === '1'));
  assert(figures.some(f => f.char === '9'));
  assert(figures.some(f => f.char === '4'));
  assert(figures.some(f => f.char === '0'));

  // Verify serial pulse train frame format: Start (0), 5 data bits, Stop (1)
  const aCode = frames.find(f => f.char === 'A').code;
  const bitArray = to5Bits(aCode);
  const pulseTrain = generateSerialPulseTrain(bitArray);
  assert.equal(pulseTrain.length, 7);
  assert.equal(pulseTrain[0], 0, 'Start bit must be space (0)');
  assert.equal(pulseTrain[6], 1, 'Stop bit must be mark (1)');
}

// 7. Test Current Loop Waveform Simulation
console.log('Testing 60 mA neutral current loop simulation...');
{
  const pulses = [0, 1, 0, 1, 1, 0, 1];
  const waveform = simulateCurrentLoopWaveform(pulses, 22.0, 5);
  assert(waveform.length > 50);
  assert(waveform.every(v => v >= -0.01 && v <= 60.01));
}

// 8. Test Complex Number Arithmetic (Multiplication & Division)
console.log('Testing Complex Number Calculator Model I algebraic engine...');
{
  // Test 1: (3 + 4i) * (2 - 1i) = (3*2 - 4*(-1)) + i(3*(-1) + 4*2) = (6 + 4) + i(-3 + 8) = 10 + 5i
  const z1 = new ComplexNumber(3, 4);
  const z2 = new ComplexNumber(2, -1);
  const mulRes = executeComplexOperation(z1, z2, '*');
  assert.equal(mulRes.result.real, 10);
  assert.equal(mulRes.result.imag, 5);
  assert.equal(mulRes.cycles.length, 6);

  // Test 2: (10 + 5i) / (2 - 1i) should recover (3 + 4i)
  const divRes = executeComplexOperation(mulRes.result, z2, '/');
  assert(Math.abs(divRes.result.real - 3) < 1e-9);
  assert(Math.abs(divRes.result.imag - 4) < 1e-9);
  assert.equal(divRes.cycles.length, 5);

  // Test 3: Norbert Wiener's AC impedance expression:
  // (12 + 5i) * (8 - 3i) = (96 - (-15)) + i(-36 + 40) = 111 + 4i
  const w1 = new ComplexNumber(12, 5);
  const w2 = new ComplexNumber(8, -3);
  const wienerRes = executeComplexOperation(w1, w2, '*');
  assert.equal(wienerRes.result.real, 111);
  assert.equal(wienerRes.result.imag, 4);

  // Test 4: Polar form magnitude & phase
  const polarZ = new ComplexNumber(3, 4);
  assert.equal(polarZ.magnitude(), 5);
  assert(Math.abs(polarZ.phaseDeg() - 53.1301) < 0.01);
}

// 9. Test Model K 1-bit Adder Truth Table
console.log('Testing 1937 Model K 1-bit relay adder truth table (all 8 states)...');
{
  const truthTable = [
    { a: 0, b: 0, cin: 0, sum: 0, cout: 0 },
    { a: 1, b: 0, cin: 0, sum: 1, cout: 0 },
    { a: 0, b: 1, cin: 0, sum: 1, cout: 0 },
    { a: 1, b: 1, cin: 0, sum: 0, cout: 1 },
    { a: 0, b: 0, cin: 1, sum: 1, cout: 0 },
    { a: 1, b: 0, cin: 1, sum: 0, cout: 1 },
    { a: 0, b: 1, cin: 1, sum: 0, cout: 1 },
    { a: 1, b: 1, cin: 1, sum: 1, cout: 1 },
  ];

  for (let row of truthTable) {
    const res = simulateModelKAdder(row.a, row.b, row.cin);
    assert.equal(res.sumBulb, row.sum, `Sum bulb failed for A=${row.a}, B=${row.b}, Cin=${row.cin}`);
    assert.equal(res.carryBulb, row.cout, `Carry bulb failed for A=${row.a}, B=${row.b}, Cin=${row.cin}`);
  }
}

// 10. Test 250-Mile Transmission Metrics
console.log('Testing 250-mile Hanover <-> New York telegraph link metrics...');
{
  const metrics = calculateTransmissionMetrics(250, 15);
  assert.equal(metrics.distanceMiles, 250);
  assert(metrics.propDelayOneWayMs > 1.8 && metrics.propDelayOneWayMs < 2.1, `Propagation delay: ${metrics.propDelayOneWayMs} ms`);
  assert.equal(metrics.numRepeaters, 3); // 3 repeaters on line
  assert(metrics.charDurationMs > 160 && metrics.charDurationMs < 165);
}

console.log('All 24 test assertions PASSED with zero errors!');
