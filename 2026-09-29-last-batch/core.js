/* One batch, one selling period. No salvage value or carry-over. */
(function (root) {
  'use strict';
  const CAPACITY = 48;
  const PRICE = 3;
  function triangular(center, radius) {
    return Array.from({length: CAPACITY + 1}, (_, d) => Math.max(0, radius + 1 - Math.abs(d - center)) / (radius + 1) ** 2);
  }
  const mix = (a, b, share) => a.map((p, i) => share * p + (1 - share) * b[i]);
  const forecasts = {
    regular: {name: 'The regulars', description: 'A familiar crowd. Most mornings land near the middle.', pmf: triangular(24, 6)},
    split: {name: 'Office roulette', description: 'The office is either mostly remote or mostly here. Two very different queues.', pmf: mix(triangular(14, 4), triangular(34, 4), .5)},
    spike: {name: 'A rare rush', description: 'Usually quiet. One morning in four, a much bigger crowd turns up.', pmf: mix(triangular(18, 2), triangular(42, 2), .75)},
  };
  function outcome(q, demand, cost = 1) {
    const sold = Math.min(q, demand);
    return {sold, leftover: q - sold, missed: demand - sold, margin: PRICE * sold - cost * q};
  }
  function expected(q, pmf, cost = 1) {
    const result = {sold: 0, leftover: 0, missed: 0, margin: 0};
    pmf.forEach((p, d) => {
      const day = outcome(q, d, cost);
      for (const key of Object.keys(result)) result[key] += p * day[key];
    });
    return result;
  }
  function bestBatch(pmf, cost = 1) {
    let best = {q: 0, ...expected(0, pmf, cost)};
    for (let q = 1; q <= CAPACITY; q++) {
      const candidate = expected(q, pmf, cost);
      // Keep the smaller batch when expected margins tie: fewer leftovers.
      if (candidate.margin > best.margin + 1e-9) best = {q, ...candidate};
    }
    return best;
  }
  function mean(pmf) { return pmf.reduce((s, p, d) => s + p * d, 0); }
  function sellChance(q, pmf) { return pmf.reduce((s, p, d) => s + (d > q ? p : 0), 0); }
  function seeded(seed) {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }
  function month(pmf, seed, length = 30) {
    const random = seeded(seed);
    return Array.from({length}, () => {
      const u = random();
      let sum = 0;
      for (let d = 0; d < pmf.length; d++) {
        sum += pmf[d];
        if (u < sum) return d;
      }
      return pmf.length - 1;
    });
  }
  function average(q, demands, cost = 1) {
    const result = {sold: 0, leftover: 0, missed: 0, margin: 0};
    if (!demands.length) return result;
    demands.forEach(d => {
      const day = outcome(q, d, cost);
      for (const key of Object.keys(result)) result[key] += day[key] / demands.length;
    });
    return result;
  }
  const api = {CAPACITY, PRICE, forecasts, outcome, expected, bestBatch, mean, sellChance, seeded, month, average};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BatchCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
