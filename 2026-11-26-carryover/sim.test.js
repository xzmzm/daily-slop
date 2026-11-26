// Run with: node sim.test.js
const assert = require('node:assert');
const P = require('./sim.js');

// Kill rate anchors: 7 logs take 2.7 min at 150°F and about 27 min at 140°F.
assert.ok(Math.abs(7 * P.dValue(150) - 162) < 1e-9);
assert.ok(Math.abs(7 * P.dValue(140) / 60 - 27) < 0.1);
assert.strictEqual(P.dValue(120), Infinity);

// A 14 lb bird at 325°F reaches 165°F in roughly 13 minutes a pound.
const usda = P.cook({ pullF: 165, restMin: 30 });
const minPerLb = usda.pulledAt / 60 / 14;
assert.ok(minPerLb > 11 && minPerLb < 15, minPerLb);

// Carryover: resting adds 5–12°F at the thermometer.
const rise = usda.restPeakF - 165;
assert.ok(rise > 5 && rise < 12, rise);

// Pulling early and resting meets the model's 7-log target and loses less juice than the 165°F pull.
const early = P.cook({ pullF: 150, restMin: 30 });
assert.ok(early.leastKill >= P.TARGET_LOG && early.loss < usda.loss - 0.02, early);

// Pulling early and carving at once misses the model's 7-log target.
assert.ok(P.cook({ pullF: 145, restMin: 0 }).leastKill < P.TARGET_LOG);

// Bigger birds and cooler ovens take longer.
assert.ok(P.cook({ pounds: 20 }).pulledAt > usda.pulledAt);
assert.ok(P.cook({ ovenF: 275 }).pulledAt > usda.pulledAt);

console.log('ok');
