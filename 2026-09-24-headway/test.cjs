const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./core.js');

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('bearings and wind convention', () => {
  const east = H.vec(90, 10);
  close(east[0], 10); close(east[1], 0);
  close(H.bearingOf([-1, 0]), 270);
  const fromNorth = H.windVector(0, 5); // blows south
  close(fromNorth[0], 0); close(fromNorth[1], -5);
});

test('cube-root power law hits 9 km/h at 3 hp and halves at 3/8 hp', () => {
  close(H.airspeedFromPower(3), 9);
  close(H.airspeedFromPower(3 / 8), 4.5);
  close(H.airspeedFromPower(0), 0);
  close(H.airspeedFromPower(99), 9);
});

test('Élancourt is about 27 km west-south-west of Étoile', () => {
  const d = Math.hypot(H.PLACES.elancourt.x, H.PLACES.elancourt.y);
  assert.ok(d > 26 && d < 27.5, String(d));
  const b = H.bearingOf([H.PLACES.elancourt.x, H.PLACES.elancourt.y]);
  assert.ok(b > 240 && b < 255, String(b));
});

test('solved heading puts the ground track exactly on course', () => {
  for (const [course, va, from, w] of [[248, 9, 60, 5], [68, 9, 60, 7], [0, 9, 90, 8.9], [123, 6, 300, 3]]) {
    const wind = H.windVector(from, w);
    const s = H.solveHeading(course, va, wind);
    assert.ok(s);
    const g = H.groundVelocity(s.heading, va, wind);
    close(H.bearingOf(g), course, 1e-6);
    close(H.len(g), s.groundSpeed, 1e-9);
  }
});

test('pure headwind: ground speed is the difference, and fails when wind wins', () => {
  const wind = H.windVector(68, 5); // straight on the nose of a 68° course
  close(H.solveHeading(68, 9, wind).groundSpeed, 4);
  assert.equal(H.solveHeading(68, 9, H.windVector(68, 9)), null);
  assert.equal(H.solveHeading(68, 9, H.windVector(68, 12)), null);
  close(H.solveHeading(248, 9, H.windVector(68, 12)).groundSpeed, 21);
});

test('reachable cone half-angle is asin(Va/W)', () => {
  const c = H.reachableCone(9, H.windVector(60, 18));
  assert.equal(c.all, false);
  close(c.halfAngle, 30);
  close(c.center, 240);
  assert.equal(H.reachableCone(9, H.windVector(60, 8)).all, true);
  // Directions inside the cone are flyable, outside are not.
  assert.ok(H.canFly(240 + 29, 9, H.windVector(60, 18)));
  assert.ok(!H.canFly(240 + 31, 9, H.windVector(60, 18)));
});

test('simulated flights: out with the wind, stuck on the way home', () => {
  const { etoile, elancourt } = H.PLACES;
  const wind = H.windVector(68, 4);
  const out = H.flyTo(etoile, elancourt, { airspeed: 9, wind, auto: true });
  assert.ok(out.arrived);
  close(out.hours, 26.7 / 13, 0.05);
  const home = H.flyTo(elancourt, etoile, { airspeed: 9, wind: H.windVector(68, 12), auto: true });
  assert.ok(!home.arrived);
  assert.ok(home.closest >= 26.7 - 0.05);
});
