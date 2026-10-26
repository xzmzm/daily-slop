const assert = require('node:assert/strict');
const { Lock, LIFT, AREA } = require('./model.js');
const close = (actual, expected, eps = 1e-7) => assert.ok(Math.abs(actual - expected) < eps, `${actual} ≠ ${expected}`);
const ok = result => assert.equal(result.ok, true, result.reason);

// Water head should fall quadratically and conserve volume, regardless of
// frame partitioning. Values derive from the analytic seven-second drain.
const half = new Lock();
ok(half.toggleSluice('lower'));
half.tick(3.5);
close(half.level, LIFT / 4);
close(half.released, AREA * LIFT * 3 / 4);
assert.equal(half.admitted, 0);
const smallSteps = new Lock();
ok(smallSteps.toggleSluice('lower'));
for (let i = 0; i < 35; i++) smallSteps.tick(.1);
close(smallSteps.level, half.level);
half.tick(100);
assert.equal(half.level, 0);
close(half.released, AREA * LIFT);
half.tick(100);
close(half.released, AREA * LIFT);
ok(half.toggleSluice('lower'));
ok(half.toggleSluice('upper'));
half.tick(3.5);
close(half.level, LIFT * 3 / 4);
half.tick(100);
assert.equal(half.level, LIFT);
close(half.admitted, AREA * LIFT);

// Pressure, gate, sluice, and boat interlocks leave state untouched on refusal.
const blocked = new Lock();
assert.equal(blocked.toggleGate('lower').ok, false);
assert.equal(blocked.moves, 0);
assert.equal(blocked.moveBoat().ok, false);
ok(blocked.toggleSluice('lower'));
assert.equal(blocked.toggleSluice('upper').ok, false);
assert.equal(blocked.toggleGate('upper').ok, false);
ok(blocked.toggleSluice('lower'));
ok(blocked.toggleGate('upper'));
assert.equal(blocked.toggleSluice('lower').ok, false);
assert.equal(blocked.toggleSluice('upper').ok, false);
assert.equal(blocked.toggleGate('lower').ok, false);
for (const value of [NaN, Infinity, -1, 0]) blocked.tick(value);
assert.equal(blocked.level, LIFT);

// Independently perform full uphill and downhill passages, not guidance output.
for (const direction of ['up', 'down']) {
  const lock = new Lock(direction);
  const start = direction === 'up' ? 'lower' : 'upper';
  const end = direction === 'up' ? 'upper' : 'lower';
  ok(lock.toggleSluice(start));
  lock.tick(7);
  close(lock.level, direction === 'up' ? 0 : LIFT);
  ok(lock.toggleSluice(start));
  ok(lock.toggleGate(start));
  ok(lock.moveBoat());
  assert.equal(lock.toggleGate(start).ok, false);
  assert.equal(lock.toggleSluice(end).ok, false);
  lock.tick(3);
  assert.equal(lock.boat, 'chamber');
  assert.equal(lock.complete, false);
  ok(lock.toggleGate(start));
  ok(lock.toggleSluice(end));
  lock.tick(7);
  close(lock.level, direction === 'up' ? LIFT : 0);
  ok(lock.toggleSluice(end));
  ok(lock.toggleGate(end));
  ok(lock.moveBoat());
  lock.tick(3);
  assert.equal(lock.boat, end);
  assert.equal(lock.complete, true);
  assert.equal(lock.moveBoat().ok, false);
  close(lock.admitted, AREA * LIFT);
  close(lock.released, AREA * LIFT);
  lock.reset();
  assert.equal(lock.direction, direction);
  assert.equal(lock.complete, false);
  assert.equal(lock.moves, 0);
}
console.log('PASS: analytic flow, volume conservation, frame independence, no overshoot, interlocks, uphill/downhill, reset.');
