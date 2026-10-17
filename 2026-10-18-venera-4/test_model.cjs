const assert = require('node:assert/strict');
const M = require('./model.js');

// the 0.75→22 atm run spans ~31 km whatever the ground does
assert(Math.abs(M.SPAN - 30.7) < .2);
assert(Math.abs(M.rel(M.END.p)) < 1e-9);
assert(M.rel(.5) > M.rel(1) && M.rel(1) > M.rel(10) && M.rel(30) < 0);
// pressure and height invert each other
for (const p of [.75, 2, 10, 22, 80, 150]) assert(Math.abs(M.pressureAt(M.rel(p)) - p) / p < 1e-9);
// descent clock: monotone, 93 minutes, starts and ends at the readings
assert(Math.abs(M.pressureAtMinute(0) - .75) < 1e-6 && Math.abs(M.pressureAtMinute(93) - 22) < 1e-6);
let prev = 0;
for (let m = 0; m <= 93; m += 3) { const p = M.pressureAtMinute(m); assert(p >= prev); prev = p; }
// Moscow's ground: capsule landed, ground = last reading, clues disagree by ~30 km
const moscow = M.analyse(0, false);
assert(moscow.landed && Math.abs(moscow.ground.p - 22) < 1e-9 && moscow.verdict === 'split');
// pins demand different ground heights unless the radar aliases
const plain = M.impliedH(false), aliased = M.impliedH(true);
assert(Math.abs(plain.mariner - plain.altimeter) > 25);
assert(Math.abs(aliased.mariner - aliased.altimeter) < 1);
assert.equal(M.analyse(27, true).verdict, 'agree');
assert.equal(M.analyse(27, false).verdict, 'mariner');
assert(M.analyse(27, true).ground.p > 100 && M.analyse(27, true).crushed);
console.log('model ok');
