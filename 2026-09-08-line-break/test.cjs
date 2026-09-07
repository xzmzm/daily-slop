const assert = require('node:assert/strict');
const {layout} = require('./core.js');
// Exhaustively enumerate legal layouts: independent oracle for the DP.
function oracle(w, s, max, i = 0) {
  if (i === w.length) return 0;
  let width = 0, best = Infinity;
  for (let j = i; j < w.length; j++) {
    width += w[j] + (j > i ? s : 0);
    if (j > i && width > max) break;
    best = Math.min(best, (j === w.length - 1 ? 0 : (max - width) ** 2) + oracle(w, s, max, j + 1));
  }
  return best;
}
assert.deepEqual(layout([], 1, 10, true), {lines: [], score: 0});
assert.equal(layout([3, 2, 2, 5], 1, 6, true).score, 10);
assert.equal(layout([3, 2, 2, 5], 1, 6).score, 16);
let seed = 81;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2**32);
for (let k = 0; k < 400; k++) {
  const w = Array.from({length: 1 + Math.floor(rand() * 9)}, () => 1 + Math.floor(rand() * 16));
  const max = 5 + Math.floor(rand() * 30);
  const result = layout(w, 1, max, true);
  assert.equal(result.score, oracle(w, 1, max));
  assert.ok(result.score <= layout(w, 1, max).score);
  assert.deepEqual(result.lines.flatMap(l => Array.from({length: l.end - l.start}, (_, n) => l.start + n)), w.map((_, i) => i));
  assert.ok(result.lines.every(l => l.width <= max || l.end - l.start === 1));
}
console.log('Passed: 400 exhaustive-oracle comparisons, word conservation, overflow and empty input.');
