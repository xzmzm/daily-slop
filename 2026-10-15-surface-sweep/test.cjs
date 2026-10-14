'use strict';
const assert = require('node:assert/strict');
const { Dish, tension } = require('./engine.js');
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function finite(dish) {
  for (const i of dish.cells) assert.ok(Number.isFinite(dish.c[i]) && dish.c[i] >= -1e-12);
  for (const p of dish.pepper) assert.ok(Number.isFinite(p.x + p.y) && Math.hypot(p.x, p.y) <= .97600001);
}
assert.equal(tension(0), 1);
assert.ok(tension(.5) > tension(1));
for (const coat of [0, 1.2]) {
  const d = new Dish({ coat });
  const before = d.pepper.map(p => [p.x, p.y]);
  const mass = d.stats().mass;
  d.drop(0, 0, 'water'); d.step(4);
  assert.deepEqual(d.pepper.map(p => [p.x, p.y]), before, 'Uniform tension must create no motion');
  near(d.stats().mass, mass);
  near(d.stats().contrast, 0);
}
const clean = new Dish(), soaped = new Dish({ coat: 1.2 });
for (const d of [clean, soaped]) {
  d.drop(0, 0);
  const mass = d.stats().mass;
  assert.ok(d.velocity(.12, 0).x > 0, 'Flow must head toward the cleaner region');
  near(d.velocity(-.12, 0).x, -d.velocity(.12, 0).x, 1e-8);
  const contrast = d.stats().contrast;
  d.step(4);
  near(d.stats().mass, mass, 1e-9);
  assert.ok(d.stats().contrast < contrast);
  finite(d);
}
assert.ok(clean.stats().cleared > 80, 'Soap should visibly clear clean water');
assert.ok(soaped.stats().cleared < 30, 'A coated surface should respond much less');
const stress = new Dish({ seed: 47 });
for (const [x, y] of [[.98,0],[-.8,.3],[0,-.98],[0,.98],[0,0]]) assert.ok(stress.drop(x, y, 'soap', 2));
const mass = stress.stats().mass;
stress.step(15); finite(stress); near(stress.stats().mass, mass, 1e-9);
assert.equal(stress.drop(1, 1), false);
assert.equal(stress.drop(NaN, 0), false);
assert.equal(stress.drop(0, 0, 'soap', Infinity), false);
console.log('PASS: equilibrium, water control, gradient direction, conservation, spreading, coated comparison and edge stress');
