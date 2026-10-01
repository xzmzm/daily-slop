'use strict';
const assert = require('node:assert/strict');
const C = require('./core.js');

// A synchronized receiver must preserve every location across repeated revolutions.
for (const lines of [15, 30, 60]) {
  const total = lines * C.ROWS;
  const samples = Float32Array.from({length: total}, (_, i) => i / total);
  const memory = new Float32Array(total);
  C.transmit(memory, samples, 0, total * 3, lines, 0, 0);
  assert.deepEqual(memory, samples);
  assert.equal(C.address(total, lines), 0);
  assert.equal(C.address(-1, lines), total - 1);
  assert.deepEqual(C.coordinates(total - 1), {column: lines - 1, row: C.ROWS - 1});
  // Half a revolution moves the whole image exactly half a raster, including odd line counts.
  assert.equal(C.address(0, lines, 0, 180), total / 2);
  assert.equal(C.address(0, lines, 0, -180), total / 2);
  const shifted = new Float32Array(total);
  C.transmit(shifted, samples, 0, total, lines, 0, 180);
  assert.equal(shifted[total / 2], samples[0]);
  assert.equal(shifted[0], samples[total / 2]);
}

// Speed error accumulates with time; phase error is fixed. It can run either way.
assert.equal(C.address(2400, 30, 2.5), 60);
assert.equal(C.address(4800, 30, 2.5), 120);
assert.equal(C.address(2400, 30, -2.5), 2340);
assert.equal(C.address(4800, 30, 0, 12), C.address(2400, 30, 0, 12));
assert.equal(C.rpm(), 300);
assert.equal(C.rpm(2.5), 307.5);
assert.equal(C.rpm(-5), 285);
// The receiver keeps its position when its motor speed changes mid-sweep.
const oldTX = 1200, oldRX = 1230, ratio = .975;
const offset = oldRX - oldTX * ratio;
assert.equal(C.address(oldTX, 30, -2.5, 0, C.ROWS, offset), oldRX);
assert.equal(C.address(oldTX + 80, 30, -2.5, 0, C.ROWS, offset), oldRX + 78);

// Area sampling must average narrow details instead of picking a single bright pixel.
const rgba = new Uint8ClampedArray(4 * 4 * 4);
for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
  const i = (y * 4 + x) * 4;
  const value = x < 2 ? 255 : 0;
  rgba.set([value, value, value, 255], i);
}
assert.deepEqual(Array.from(C.sampleRGBA(rgba, 4, 4, 2, 2)), [1, 1, 0, 0]);
assert.deepEqual(Array.from(C.sampleRGBA(rgba, 4, 4, 1, 2)), [.5, .5]);
console.log('Thirty Lines: raster, phase, motor continuity, RPM, and area sampling passed.');
