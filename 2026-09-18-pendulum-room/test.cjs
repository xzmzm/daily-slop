const assert = require('node:assert/strict');
const { SIDEREAL_HOURS, rate, at, hourMarks } = require('./core.js');
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);

// Known physical limits, sign conventions, and an independent Paris benchmark.
close(at(90, SIDEREAL_HOURS).angle, 360);
close(at(-90, SIDEREAL_HOURS).angle, -360);
close(at(30, SIDEREAL_HOURS).angle, 180);
close(at(-30, SIDEREAL_HOURS).angle, -180);
assert.deepEqual(at(0, 48), {rate: 0, angle: 0, period: Infinity, direction: 'none'});
close(at(48.86, 1).rate, 11.328, .005);
close(at(48.86, 0).period, 31.78, .03);
assert.equal(at(48.86, 6).direction, 'clockwise');
assert.equal(at(-33.87, 6).direction, 'counterclockwise');
assert.ok(at(3.14, 6).period > 18 * 24);
for (let lat = 1; lat <= 90; lat++) {
  close(rate(lat), -rate(-lat));
  close(at(lat, 1).period, at(-lat, 1).period);
  if (lat > 1) assert.ok(rate(lat) > rate(lat - 1));
}
// A swing line is undirected, but accumulated turn remains directed and unwrapped.
assert.ok(at(90, 48).angle > 720);
close(at(90, SIDEREAL_HOURS / 4).angle, 90);
close(at(90, SIDEREAL_HOURS / 2).angle, 180);
assert.equal(hourMarks(48.86, 6.4).length, 7);
assert.equal(hourMarks(48.86, 48).length, 49);
assert.deepEqual(hourMarks(0, 3).map(m => m.angle), [0, 0, 0, 0]);
assert.deepEqual(hourMarks(90, 0), [{hour: 0, angle: 0}]);
close(hourMarks(-30, 6)[6].angle, at(-30, 6).angle);
for (const invalid of [-91, 91, NaN, Infinity, '45']) assert.throws(() => rate(invalid), RangeError);
for (const invalid of [-1, NaN, Infinity]) assert.throws(() => at(0, invalid), RangeError);
console.log('Pendulum physics verified: poles, equator, hemisphere symmetry, Paris, hourly marks and input limits.');
