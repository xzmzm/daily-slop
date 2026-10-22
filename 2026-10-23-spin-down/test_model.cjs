const assert = require('node:assert/strict');
const M = require('./model.js');
const near = (actual, expected, tolerance = .06) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const run = (capacity, seconds, blocked = false) => { const s = M.create(capacity); s.playing = true; if (blocked) M.block(s); M.advance(s, seconds); return s; };

const paused = M.create(); M.advance(paused, 300); assert.equal(paused.time, 0);
const outage = run(1200, 300, true);
near(outage.direct.silentSeconds, 298); near(outage.cached.silentSeconds, 0);
near(outage.cached.reserve, 900); near(outage.cached.diskSeconds, 0);
near(outage.direct.diskSeconds, 300);
M.advance(outage, 1); assert.equal(outage.direct.stalled, false); assert.equal(outage.cached.stalled, false);

const small = run(120, 300, true);
near(small.cached.silentSeconds, 180); near(small.cached.reserve, 0);
M.advance(small, 10); assert.ok(small.cached.reserve > 100); assert.equal(small.cached.stalled, false);

const normal = run(1200, 3600);
assert.ok(normal.cached.diskSeconds / normal.time < .04);
near(normal.direct.diskSeconds / normal.time, 1);
assert.equal(normal.cached.starts, 3); near(normal.cached.silentSeconds, 0);

M.skip(normal); assert.equal(normal.cached.reserve, 0); assert.equal(normal.direct.reserve, 0);
M.advance(normal, 3); near(normal.cached.silentSeconds, 2); assert.ok(normal.cached.reserve > 30);
const seekOutage = run(1200, 3, true); M.skip(seekOutage); M.advance(seekOutage, 8);
near(seekOutage.cached.silentSeconds, 8); near(seekOutage.cached.reserve, 0);

for (const capacity of [120, 1200]) {
  const s = run(capacity, 43200);
  for (const p of [s.direct, s.cached]) {
    assert.ok(p.reserve >= 0 && p.reserve <= p.capacity);
    near(p.playedSeconds + p.silentSeconds, s.time, 1e-5);
    assert.ok(p.diskSeconds <= s.time + .001);
  }
  assert.ok(s.history.length <= 2401);
}
const one = run(1200, 300, true), many = M.create(); many.playing = true; M.block(many);
for (let i = 0; i < 3000; i++) M.advance(many, .1);
near(one.cached.reserve, many.cached.reserve, 1e-5); near(one.direct.silentSeconds, many.direct.silentSeconds, 1e-5);
assert.throws(() => M.create(0), RangeError);
for (const bad of [-1, NaN, Infinity, 86401]) assert.throws(() => M.advance(many, bad), RangeError);
console.log('Model passed: outage survival, depletion, refill, disk duty, uncached seek, 12-hour conservation, timestep consistency.');
