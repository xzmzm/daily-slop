// Run with: node sim.test.js
const assert = require('node:assert');
const P = require('./sim.js');

function fly(script) {
  const f = P.createFlight();
  for (const [x, type] of script) { P.step(f, (x - f.x) / P.SPEED); P.command(f, type); }
  P.step(f, 200);
  return f;
}

// The ice climbs steadily and the pass is the top.
for (let x = 0; x < P.PASS_X; x += 1) assert.ok(P.ice(x + 1) > P.ice(x));
assert.strictEqual(Math.round(P.ice(P.PASS_X)), P.PASS_ICE);

// Hands off: the loaded Trimotor cannot out-climb the glacier.
const none = fly([]);
assert.strictEqual(none.outcome.kind, 'ice');
assert.ok(P.project(P.createFlight()).hit !== null);

// One sack is not enough; two early sacks clear by a few hundred feet.
assert.strictEqual(fly([[10, 'food']]).outcome.kind, 'ice');
const two = fly([[10, 'food'], [10, 'food']]);
assert.strictEqual(two.outcome.kind, 'plateau');
assert.ok(two.outcome.clearance > 250 && two.outcome.clearance < 500, two.outcome.clearance);
assert.strictEqual(two.outcome.food, 3);

// Timing matters: the same two sacks thrown inside the sink are too late.
assert.strictEqual(fly([[44, 'food'], [44, 'food']]).outcome.kind, 'ice');

// Gasoline weighs the same as food, but two cans leave you short of the depot.
const gas = fly([[10, 'fuel'], [10, 'fuel']]);
assert.strictEqual(gas.outcome.kind, 'fuel');
assert.ok(gas.outcome.margin < 0);
const mixed = fly([[10, 'food'], [10, 'fuel']]);
assert.strictEqual(mixed.outcome.kind, 'plateau');
assert.strictEqual(mixed.outcome.food, 4);

// The projection agrees with the flown result.
const f = P.createFlight();
P.step(f, (10 - f.x) / P.SPEED); P.command(f, 'food'); P.command(f, 'food');
const proj = P.project(f).clearance;
assert.ok(Math.abs(proj - two.outcome.clearance) < 30, [proj, two.outcome.clearance]);

// Turning back ends the flight.
assert.strictEqual(fly([[20, 'turn']]).outcome.kind, 'turn');
console.log('ok');
