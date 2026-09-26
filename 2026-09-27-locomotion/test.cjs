'use strict';
const test = require('node:test');
const assert = require('node:assert');
const C = require('./core.js');

const LB = C.LB_PER_LONG_TON;

test('cylinder tractive effort lands near the cited ~1,000 lbf', () => {
  assert.ok(C.TE0 > 950 && C.TE0 < 1060, `TE0 = ${C.TE0}`);
  assert.strictEqual(Math.round(C.TE0), 1010);
});

test('adhesion ceiling: all 6½ tons adhesive because the rods couple every wheel', () => {
  const f = C.computeForces({ grade: 0, wagons: 0 });
  assert.strictEqual(Math.round(f.adhesion), Math.round(0.25 * 6.5 * LB)); // 3,640 lb
  assert.strictEqual(f.regime, 'runs');
});

test('the level ladder: ~1,000 lb hauls dozens of tons because rolling is ~10 lb/ton', () => {
  assert.strictEqual(C.maxWagons(0), 25); // (1010/10 - 6.5) / 3.7 → 25 loaded chaldrons
  assert.strictEqual(C.maxWagons(0.005), 11); // 1 in 200
  assert.strictEqual(C.maxWagons(0.01), 6); // 1 in 100
  assert.strictEqual(C.maxWagons(0.0303), 1); // 1 in 33: engine itself plus one wagon
  assert.strictEqual(C.maxWagons(0.10), 0); // 1 in 10: not even light engine
});

test('1 in 33 was never going to work for a coal train', () => {
  // A 33-wagon train on the real incline grade:
  const f = C.computeForces({ grade: 1 / 33, wagons: 33 });
  assert.ok(f.demand > 4 * C.TE0, `demand ${f.demand} vs ${C.TE0}`);
  assert.strictEqual(f.regime, 'stalls'); // adhesion 3,640 > TE 1,009: pull-limited
});

test('two different failures: stall vs wheelspin', () => {
  // Dry rail, steep: grip holds, pull doesn't
  const dry = C.computeForces({ grade: 0.01, wagons: 20, condition: 'dry' });
  assert.strictEqual(dry.regime, 'stalls');
  assert.ok(dry.adhesion >= C.TE0);
  // Leaves on the same job: grip runs out first
  const leaves = C.computeForces({ grade: 0.01, wagons: 20, condition: 'leaves' });
  assert.strictEqual(leaves.regime, 'slips');
  assert.ok(leaves.adhesion < C.TE0);
  // Sand restores grip but cannot add horsepower
  const sanded = C.computeForces({ grade: 0.01, wagons: 20, condition: 'leaves', sand: true });
  assert.strictEqual(sanded.regime, 'stalls');
});

test('falling grades give the cylinders a rest', () => {
  const f = C.computeForces({ grade: -0.005, wagons: 21 }); // the surveyed fall
  assert.strictEqual(f.regime, 'coasting');
  assert.ok(f.gradeLb < 0);
});

test('dynamics: starts, accelerates, and stays under the era cap', () => {
  const f = C.computeForces({ grade: 0, wagons: 12 });
  const s = { v: 0, wheelTurns: 0, slip: false, moving: false };
  for (let i = 0; i < 60 * 60; i++) C.step(s, f, 1 / 60);
  assert.ok(s.v > 2.5, `v = ${s.v}`); // 50 tons behind 1,000 lb: slow to gather, as it should be
  for (let i = 0; i < 60 * 180; i++) C.step(s, f, 1 / 60); // another 3 minutes
  assert.ok(s.v > 5.5, `v late = ${s.v}`);
  assert.ok(s.v <= C.V_MAX_MPH + 1e-6);
  assert.ok(s.wheelTurns > 0);
  assert.ok(s.moving);
});

test('dynamics: a slipping train stops but its wheels keep turning', () => {
  const f = C.computeForces({ grade: 0.01, wagons: 24, condition: 'leaves' });
  assert.strictEqual(f.regime, 'slips');
  const s = { v: 4, wheelTurns: 1, slip: false, moving: true };
  for (let i = 0; i < 60 * 10; i++) C.step(s, f, 1 / 60);
  assert.strictEqual(s.v, 0);
  assert.ok(s.wheelTurns > 1);
  assert.strictEqual(s.slip, true);
  assert.strictEqual(s.moving, false);
});

test('opening-day train is honest: ~84 tons crawls on the level, glides on the fall', () => {
  const tons = C.trainTons(21, { coach: true, passengers: 550 });
  assert.ok(tons > 95 && tons < 130, `tons = ${tons}`);
  const level = C.computeForces({ grade: 0, wagons: 21, coach: true, passengers: 550 });
  assert.strictEqual(level.regime, 'stalls'); // on the dead level it can barely start
  const fall = C.computeForces({ grade: -0.0045, wagons: 21, coach: true, passengers: 550 });
  assert.strictEqual(fall.regime, 'coasting'); // Stephenson's survey at work
});

test('route: three powers, in the right order, over the right miles', () => {
  assert.strictEqual(C.segmentAt(0.5).mode, 'rope');   // Etherley banks
  assert.strictEqual(C.segmentAt(1.4).mode, 'horse');  // the Gaunless crossing
  assert.strictEqual(C.segmentAt(3.0).mode, 'rope');   // Brusselton banks
  assert.strictEqual(C.segmentAt(5).mode, 'loco');     // Mason's Arms east
  assert.strictEqual(C.segmentAt(20).mode, 'loco');
  assert.ok(C.elevAt(0) > C.elevAt(23.5)); // coal runs downhill to the sea
  const summit = Math.max(...C.ROUTE.points.map(p => p.elev));
  assert.ok(C.elevAt(3.0) === summit);
});

test('speed sags as the cutoff works against it', () => {
  assert.ok(C.tractiveAtSpeed(0) === C.TE0);
  assert.ok(C.tractiveAtSpeed(8) < C.TE0);
  assert.ok(C.tractiveAtSpeed(15) < C.tractiveAtSpeed(8));
});
