const assert = require('node:assert/strict');
const M = require('./model.js');
for (const name of ['steady', 'launch', 'arrive', 'both']) {
  const p = M.preset(name);
  assert.equal(p.length, 13);
  assert.equal(p[0], 0); assert.equal(p[12], 1);
  assert(p.every((v, i) => v >= 0 && v <= 1 && (!i || v >= p[i - 1])));
}
const both = M.preset('both');
for (let i = 0; i < 13; i++) assert(Math.abs(both[i] + both[12 - i] - 1) < 1e-12);
assert(M.stepPercent(both, 1) < M.stepPercent(both, 6));
assert(M.stepPercent(M.preset('launch'), 1) < M.stepPercent(M.preset('launch'), 12));
assert(M.stepPercent(M.preset('arrive'), 1) > M.stepPercent(M.preset('arrive'), 12));
let p = both;
for (let j = 0; j < 400; j++) {
  const i = j % 11 + 1;
  p = M.move(p, i, Math.sin(j * 53.17) * 3);
  assert.equal(p[0], 0); assert.equal(p[12], 1);
  assert(p.every((v, k) => !k || v >= p[k - 1]));
}
assert.deepEqual(M.move(both, 0, .5), both);
assert.deepEqual(M.move(both, 12, .5), both);
assert.deepEqual(M.move(both, 6, NaN), both);
assert.deepEqual(M.move(both, 6.5, .5), both);
assert.notEqual(M.move(both, 6, .8), both);
assert.equal(M.frameAt(0), 0);
for (let i = 0; i <= 12; i++) {
  const stamp = M.START_HOLD_MS + i * M.TRAVEL_MS / 12;
  assert.equal(M.frameAt(stamp), i);
  assert.equal(M.frameAt(stamp + M.CYCLE_MS * 13), i);
  if (i > 0) assert.equal(M.frameAt(stamp - .01), i - 1);
}
assert.equal(M.frameAt(M.CYCLE_MS - 1), 12);
assert.equal(M.frameAt(M.CYCLE_MS), 0);
assert.equal(M.frameAt(-1), 12);
console.log('PASS: four spacing profiles; symmetry and step sizes; 400 bounded edits; fixed endpoints; frame timestamps and looping.');
