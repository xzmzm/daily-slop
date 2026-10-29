const assert = require('node:assert/strict');
const M = require('./model.js');
const L = M.makeListeners();
const run = (extras, belief = 8) => M.evaluate({ extras, belief, breakAt: 40 }, L);

// same seed, same crowd
assert.deepEqual(M.makeListeners(), L);
assert.equal(L.length, M.C.n);
for (const l of L) assert(l.leave > l.arrive && l.leave <= M.C.hour);

// newscast minutes: announcements are cut out, nothing counts outside 8:03–8:40
assert.equal(M.newsMinutes(0, 60, [], 40), 37);
assert.equal(M.newsMinutes(10, 20, [[15, 15.5]], 40), 9.5);
assert.equal(M.newsMinutes(41, 58, [], 40), 0);

// as aired: regulars heard the 8:00 announcement; the NBC crowd mostly did not
const aired = run([]);
assert.equal(aired.regularShare, 0);
assert(aired.dialShare > 0.7, aired.dialShare);
assert.equal(aired.longest, 37);

// one well-timed announcement beats three evenly spaced ones
const even = run([10, 20, 30]);
const one = M.best(1, { belief: 8, breakAt: 40 }, L);
assert.equal(one.extras.length, 1);
assert(one.extras[0] > 12 && one.extras[0] < 20, one.extras);
assert(one.believers < even.believers, [one.believers, even.believers]);
assert.equal(run(one.extras).dialShare, 0);

// more announcements never hurt, and the search is at least as good as any guess
const two = M.best(2, { belief: 8, breakAt: 40 }, L);
assert(two.believers <= one.believers);
assert(two.believers <= run([15, 25]).believers);

// skeptical listeners need more bulletins, so fewer cross the line
assert(run([], 12).believers < aired.believers);
assert(run([], 4).believers > aired.believers);

// a believer always crossed the threshold before any warning
for (const f of aired.fates) if (f.believedAt !== null) {
  assert(f.warnedAt === null || f.believedAt <= f.warnedAt);
  assert(f.believedAt >= f.arrive && f.believedAt <= f.leave);
}
console.log('model ok', { aired: aired.believers, even: even.believers, one, two });
