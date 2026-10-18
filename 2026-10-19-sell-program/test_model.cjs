const assert = require('node:assert/strict');
const M = require('./model.js');

const pct = r => (1 - r.close) * 100;
// the 1987 preset lands near the real −22.6% and closes at its low
const day = M.simulate({ insured: 0.025, shock: 0.05 });
assert(Math.abs(pct(day) - 22.6) < 2.5, pct(day));
assert(day.close - day.low < 0.01);
assert.equal(day.path.length, M.MINUTES + 1);
// without insurers the opening gap mostly heals
const none = M.simulate({ insured: 0, shock: 0.05 });
assert(pct(none) < 3 && none.soldBn === 0);
// more insurance, deeper fall; more buyers, shallower fall
let prev = -1;
for (const i of [0, 0.01, 0.02, 0.03, 0.04, 0.05]) { const p = pct(M.simulate({ insured: i })); assert(p > prev, i); prev = p; }
assert(pct(M.simulate({ insured: 0.025, liquidity: 2 })) < pct(day) / 1.5);
assert(pct(M.simulate({ insured: 0.025, liquidity: 0.5 })) > pct(day) * 1.5);
// the formula wants far more than the floor can take
assert(day.backlogBn > 3 * day.soldBn);
assert(day.soldBn > 4 && day.soldBn < 12);
// breakers: halts happen, the −20% rule closes the day, but the orders are still there
const today = M.simulate({ insured: 0.04, breaker: true });
assert(today.closedEarly && today.haltsHit === 3);
assert(pct(today) < 21 && pct(today) >= 19.9);
assert(today.path.at(-1).halted && today.backlogBn > 20);
assert(M.simulate({ insured: 0.04 }).close < today.close);
// deterministic and formatted
assert.deepEqual(M.simulate({}).close, M.simulate({}).close);
assert.equal(M.clock(0), '9:30');
assert.equal(M.clock(390), '16:00');
console.log('model ok');
