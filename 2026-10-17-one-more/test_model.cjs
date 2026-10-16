const assert = require('node:assert/strict');
const M = require('./model.js');

for (const k of [.75, 1, 1.25]) {
  for (const initial of [1, 32]) {
    const result = M.simulate(k, initial, 42, true);
    assert.deepEqual(result, M.simulate(k, initial, 42, true));
    assert.equal(result.counts.length, 25);
    assert.equal(result.counts[0], initial);
    for (let g = 1; g <= 24; g++) {
      assert.equal(result.counts[g], result.layers[g].length);
      assert.equal(result.counts[g] % 2, 0);
      assert(result.counts[g] <= 2 * result.counts[g - 1]);
      for (let i = 0; i < result.layers[g].length; i += 2) {
        assert.equal(result.layers[g][i], result.layers[g][i + 1]);
        assert(result.layers[g][i] >= 0 && result.layers[g][i] < result.counts[g - 1]);
      }
      if (!result.counts[g - 1]) assert.equal(result.counts[g], 0);
    }
  }
}
const sample = M.ensemble(1, 1, 20261049);
for (let g = 0; g <= 24; g++) {
  assert.equal(sample.expected[g], 1);
  assert.equal(sample.mean[g], sample.runs.reduce((sum, run) => sum + run[g], 0) / 64);
  assert.equal(sample.surviving[g], sample.runs.filter(run => run[g] > 0).length);
}
assert(sample.surviving[24] < sample.surviving[0]);
assert(new Set(sample.runs.map(run => JSON.stringify(run))).size > 8);

// Compare the random process with independent expectation and extinction formulas.
// A large ensemble checks actual probability behavior, rather than canned outputs.
for (const k of [.8, 1, 1.2]) {
  const n = 30000, generation = 10;
  let total = 0, extinct = 0;
  for (let i = 0; i < n; i++) {
    const count = M.simulate(k, 1, M.trialSeed(729, i)).counts[generation];
    total += count; extinct += Number(count === 0);
  }
  const expected = k ** generation;
  const variance = k === 1 ? generation : k * (2 - k) * k ** (generation - 1) * (k ** generation - 1) / (k - 1);
  assert(Math.abs(total / n - expected) < 6 * Math.sqrt(variance / n));
  assert(Math.abs(extinct / n - M.extinction(k, generation)) < .012);
}
assert.throws(() => M.simulate(2, 1, 1), RangeError);
assert.throws(() => M.simulate(1, 9, 1), RangeError);
console.log('Model checks passed: lineage, reproducibility, absorbing extinction, means including zeros, and Monte Carlo vs analytical formulas.');
