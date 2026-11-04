const assert = require('node:assert/strict');
const M = require('./model.js');
const near = (actual, expected, tolerance=1e-8) => assert.ok(Math.abs(actual-expected)<tolerance, `${actual} != ${expected}`);

// In a uniform ocean the travel-time integrator must recover distance / speed.
const flat = M.create(4000);
near(flat.travelTime(760), 680000 / Math.sqrt(9.81*4000), 1e-7);
near(flat.snapshot(0).speed, 713.1271976308364, 1e-6);
for (const x of [0, 80, 240, 505, 660, 760, 900]) near(flat.position(flat.travelTime(x)), x, 1e-8);

// Depth slows and compresses the wave without changing its period or energy flux.
for (const depth of [50, 200, 1000, 4000]) {
  const ocean = M.create(depth);
  let previous = -Infinity;
  for (let x=0; x<=900; x+=2.5) {
    const t=ocean.travelTime(x), s=ocean.snapshot(t);
    assert.ok(t>previous); previous=t;
    near(ocean.position(t), x, 1e-8);
    near(s.wavelength*1000/(s.speed/3.6), 720, 1e-8);
    near(s.fluxRatio, 1);
    near(ocean.elevation(x,t), s.amplitude);
    assert.ok(Number.isFinite(ocean.elevation(x,0)));
  }
  const shelf = ocean.snapshot(ocean.travelTime(760));
  near(shelf.depth, depth);
  near(shelf.amplitude, .5*Math.pow(4000/depth,.25));
  assert.ok(ocean.endTime>=flat.endTime);
}
const shallow = M.create(50).snapshot(M.create(50).travelTime(760));
near(shallow.speed, 79.73004452526037, 1e-6);
near(shallow.gain, 2.990697562442441, 1e-8);
assert.equal(M.create(-20).shelfDepth,50);
assert.equal(M.create(Infinity).shelfDepth,200);
assert.equal(M.create(10000).shelfDepth,4000);
console.log('Long Wave physics checks passed: uniform travel, inverse travel, period, flux, shoaling, bounds.');
