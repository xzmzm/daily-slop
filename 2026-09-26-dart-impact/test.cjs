const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./core.js');

test('published pre-impact orbit: a = 1.19 km, T = 11.92 h, v = 17.4 cm/s', () => {
  assert.equal(C.A0, 1189);
  assert.ok(Math.abs(C.T0 / 3600 - 11.92) < 1e-9);
  assert.ok(Math.abs(C.VCIRC - 0.174) < 0.001, String(C.VCIRC));
});

test('real DART (β 3.61, head-on) reproduces the published −33 min', () => {
  const r = C.impact(3.61, 0);
  assert.ok(Math.abs(r.dT / 60 + 33.0) < 0.25, 'ΔT = ' + (r.dT / 60).toFixed(2) + ' min');
  assert.ok(Math.abs(r.T / 3600 - 11.37) < 0.02, 'T1 = ' + (r.T / 3600).toFixed(3) + ' h');
  assert.ok(Math.abs(r.a - 1152) < 2, 'a1 = ' + r.a);
  assert.ok(Math.abs(r.e - 0.032) < 0.004, 'e = ' + r.e);
  assert.ok(Math.abs(r.dv * 1000 - 2.81) < 0.06, 'Δv = ' + (r.dv * 1000).toFixed(2) + ' mm/s');
  assert.equal(r.impulseRatio.toFixed(2), '3.61');
});

test('β = 3.61 beat the 73 s goal by ~27×', () => {
  const r = C.impact(3.61, 0);
  assert.ok(r.goalRatio > 26 && r.goalRatio < 28, String(r.goalRatio));
});

test('dead-stick splat (β 1) still changes the clock by minutes', () => {
  const r = C.impact(1, 0);
  assert.ok(r.dT / 60 < -8.5 && r.dT / 60 > -10.5, 'ΔT = ' + (r.dT / 60).toFixed(1));
  assert.ok(r.goalRatio > 7, String(r.goalRatio));
});

test('a 45° glancing blow keeps most of its energy but loses over a quarter of the push', () => {
  const head = C.impact(3.61, 0);
  const glance = C.impact(3.61, 45);
  const ratio = Math.abs(glance.dT / head.dT);
  assert.ok(Math.abs(ratio - Math.cos(Math.PI / 4)) < 0.03, 'ratio ' + ratio.toFixed(3));
  assert.ok(glance.a > head.a, 'off-axis impulse shrinks the orbit less');
  assert.ok(glance.e > 0.02, 'still leaves a measurable eccentricity, e = ' + glance.e.toFixed(3));
});

test('across the whole slider range the new orbit stays clear of Didymos', () => {
  for (const beta of [1, 2, 3.61, 5]) {
    for (const theta of [0, 30, 60]) {
      const r = C.impact(beta, theta);
      assert.ok(r.periapsisClearsDidymos, `β${beta} θ${theta} rp=${Math.round(r.rp)}`);
      assert.ok(r.dT < 0 && r.T < C.T0, 'period must shrink');
    }
  }
});

test('mutual events walk out by ~4.6 h over four days (the observable)', () => {
  const r = C.impact(3.61, 0);
  const drift = C.driftHours(4, r.T);
  assert.ok(drift > 4.4 && drift < 4.9, drift.toFixed(2) + ' h');
});

test('Kepler position is continuous through the impact', () => {
  const r = C.impact(3.61, 0);
  const p0 = C.positionAt(r, 0);
  assert.ok(Math.abs(p0.radius - C.A0) < 1e-6, 'starts at the impact radius');
  const pPlus = C.positionAt(r, 0.5);
  const pMinus = C.positionAt(r, -0.5);
  assert.ok(Math.abs(pPlus.radius - pMinus.radius) < 2, 'near-symmetric around apoapsis');
  assert.ok(Math.abs(p0.angle) < 1e-9 || Math.abs(Math.abs(p0.angle) - Math.PI) < 1e-9);
});

test('seeded RNG is deterministic and offset-stable', () => {
  const a = C.seededRng(20260926), b = C.seededRng(20260926), c = C.seededRng(1);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notDeepEqual([a(), a()], [c(), c()]);
});

test('formatting helpers', () => {
  assert.equal(C.fmtHours(42912), '11 h 55.2 m');
  assert.equal(C.fmtClock(4321, true), 'T+1:12:01');
  assert.equal(C.fmtClock(59, false), 'T−0:00:59');
});
