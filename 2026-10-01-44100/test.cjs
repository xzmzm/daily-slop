/* Numerical tests for the CD audio workbench core. Run: node --test test.cjs */
const test = require('node:test');
const assert = require('node:assert');
require('./core.js');
const C = globalThis.cdCore;

test('both TV systems land on 44,100 samples per second', () => {
  assert.strictEqual(C.TV.NTSC.perLine * C.TV.NTSC.lines * C.TV.NTSC.fields, 44100);
  assert.strictEqual(C.TV.PAL.perLine * C.TV.PAL.lines * C.TV.PAL.fields, 44100);
  assert.strictEqual(C.TV.NTSC.fieldLines, 262);
  assert.strictEqual(C.TV.PAL.fieldLines, 313);
});

test('alias folding mirrors back under Nyquist', () => {
  assert.strictEqual(C.aliasFrequency(1000, 44100), 1000);
  assert.strictEqual(C.aliasFrequency(10000, 8000), 2000);   // 10k − 8k
  assert.strictEqual(C.aliasFrequency(12000, 8000), 4000);   // folds at 2×fs
  assert.strictEqual(C.aliasFrequency(17000, 8000), 1000);   // 17k − 16k
  assert.strictEqual(C.aliasFrequency(3000, 4000), 1000);    // 4k − 3k
  assert.strictEqual(C.aliasFrequency(15500, 16000), 500);   // 16k − 15.5k
  assert.strictEqual(C.aliasFrequency(25000, 16000), 7000);  // 32k − 25k
  assert.strictEqual(C.aliasFrequency(24000, 16000), 8000);  // exactly Nyquist
  assert.strictEqual(C.aliasFrequency(1000, 1600), 600);     // the classic mirror
  assert.strictEqual(C.aliasFrequency(3000, 1600), 200);     // nearest image is 3200
  assert.ok(!C.isAliasing(1000, 44100));
  assert.ok(C.isAliasing(3000, 4000));
});

test('two’s-complement quantization matches the CD code range', () => {
  assert.strictEqual(C.quantCode(0.6, 16), 19661);
  assert.strictEqual(C.quantCode(1, 16), 32767);
  assert.strictEqual(C.quantCode(-1, 16), -32768);
  assert.strictEqual(C.quantCode(0.6, 4), 5);
  assert.strictEqual(C.quantCode(0.3, 1), 0);      // 1-bit is mid-tread: codes −1 and 0
  assert.strictEqual(C.quantCode(-0.9, 1), -1);
  assert.strictEqual(C.quantize(0.6, 4), 5 / 8);
  assert.strictEqual(C.steps(4), 16);
  assert.strictEqual(C.steps(16), 65536);
});

test('noise floor follows 6.02N + 1.76 dB', () => {
  assert.ok(Math.abs(C.snrDb(16) - 98.08) < 0.01);
  assert.ok(Math.abs(C.snrDb(8) - 49.92) < 0.01);
  assert.ok(Math.abs(C.snrDb(4) - 25.84) < 0.01);
  assert.ok(Math.abs(C.snrDb(1) - 7.78) < 0.01);
});

test('lamp patterns, hex and the disc data rate', () => {
  assert.strictEqual(C.toTwos(-32768, 16).join(''), '1000000000000000');
  assert.strictEqual(C.toTwos(19661, 16).join(''), '0100110011001101');
  assert.strictEqual(C.toTwos(-1, 16).join(''), '1111111111111111');
  assert.strictEqual(C.toTwos(5, 16).join(''), '0000000000000101');
  assert.strictEqual(C.hexCode(19661), '0x4CCD');
  assert.strictEqual(C.hexCode(-1), '0xFFFF');
  assert.ok(Math.abs(C.dataRateMbits(44100, 16, 2) - 1.4112) < 1e-9);
  assert.ok(Math.abs(C.dataRateMbits(44100, 4, 2) - 0.3528) < 1e-9);
});

test('constant linear velocity and the spiral geometry', () => {
  assert.ok(Math.abs(C.rpmAt(25) - 458.37) < 0.05);
  assert.ok(Math.abs(C.rpmAt(58) - 197.57) < 0.05);
  assert.ok(C.rpmAt(58) < C.rpmAt(41) && C.rpmAt(41) < C.rpmAt(25));
  assert.strictEqual(C.spiralTurns(), 20625);
  assert.ok(Math.abs(C.spiralKm() - 5.38) < 0.02);
  assert.ok(Math.abs(C.spotUm() - 1.733) < 0.01);
});

test('frames are deterministic and parity is XOR', () => {
  const a = C.frameBytes(8, 9, 20261001);
  const b = C.frameBytes(8, 9, 20261001);
  assert.deepStrictEqual(a, b);
  a.forEach((row) => row.forEach((v) => assert.ok(Number.isInteger(v) && v >= 0 && v <= 255)));
  const row = [0x0F, 0xF0, 0x3C, 0x55, 0xAA, 0x96, 0x69, 0x01, 0x80];
  assert.strictEqual(C.parityOf(row), row.reduce((x, y) => x ^ y, 0));
  assert.strictEqual(C.parityOf(row), C.parityOf([...row].reverse()));
});

test('interleaved wounds land one hit per logical row', () => {
  const w = C.scratchPhysical(0, 8, 8, 9, true);
  assert.strictEqual(w.length, 8);
  const cells = C.woundToLogical(w, 8, 9, true);
  const rowsHit = new Set(cells.map(([r]) => r));
  assert.strictEqual(rowsHit.size, 8);
  cells.forEach(([, c]) => assert.strictEqual(c, 0));
});

test('sequential wounds stay inside one logical row', () => {
  const cells = C.woundToLogical(C.scratchPhysical(0, 8, 8, 9, false), 8, 9, false);
  assert.strictEqual(new Set(cells.map(([r]) => r)).size, 1);
  assert.deepStrictEqual(cells, [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7]]);
});

test('parity repairs one erasure per row, no more', () => {
  const frame = C.frameBytes(8, 9, 20261001);
  const spread = C.repairFrame(frame, C.scratchPhysical(0, 8, 8, 9, true), true);
  assert.strictEqual(spread.wounded, 8);
  assert.strictEqual(spread.recovered, 8);
  assert.strictEqual(spread.lost, 0);

  const bunched = C.repairFrame(frame, C.scratchPhysical(0, 8, 8, 9, false), false);
  assert.strictEqual(bunched.recovered, 0);
  assert.strictEqual(bunched.lost, 8);

  // a 10-cell interleaved burst: rows 0-4 and 7 lose one, rows 5-6 lose two
  const burst = C.repairFrame(frame, C.scratchPhysical(5, 10, 8, 9, true), true);
  assert.strictEqual(burst.wounded, 10);
  assert.strictEqual(burst.recovered, 6);
  assert.strictEqual(burst.lost, 4);

  // parity-only damage costs nothing in this toy
  const parityOnly = C.repairFrame(frame, C.scratchPhysical(72, 4, 8, 9, true), true);
  assert.strictEqual(parityOnly.recovered, 0);
  assert.strictEqual(parityOnly.lost, 0);
  assert.strictEqual(parityOnly.wounded, 4);
  assert.ok(parityOnly.parity.slice(0, 4).every((s) => s === 'damaged'));

  // single data hit + dead parity in the same row is unrecoverable
  const mixed = C.repairFrame(frame, [0, 72], true);
  assert.strictEqual(mixed.lost, 1);
  assert.strictEqual(mixed.recovered, 0);
});

test('scratchPhysical respects the disc boundary', () => {
  assert.strictEqual(8 * 10, 80);           // rows × (cols + parity)
  assert.deepStrictEqual(C.scratchPhysical(77, 8, 8, 9, false), [77, 78, 79]);
  assert.deepStrictEqual(C.scratchPhysical(-1, 2, 8, 9, false), [0]);
  assert.deepStrictEqual(C.scratchPhysical(0, 0, 8, 9, false), []);
});
