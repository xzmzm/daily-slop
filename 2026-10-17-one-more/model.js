/* A binary Galton–Watson process. Generations are abstract, not reactor time. */
(function (root) {
  'use strict';
  const GENERATIONS = 24;
  const TRIALS = 64;
  function random(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function trialSeed(seed, index) {
    return (seed + Math.imul(index + 1, 0x9E3779B9)) >>> 0;
  }
  function simulate(k, initial, seed, withTree = false) {
    if (!Number.isFinite(k) || k < .75 || k > 1.25) throw new RangeError('k must be 0.75–1.25');
    if (![1, 32].includes(initial)) throw new RangeError('Start with 1 or 32 neutrons');
    const rng = random(seed);
    const counts = [initial];
    const layers = withTree ? [Array(initial).fill(-1)] : null;
    for (let g = 1; g <= GENERATIONS; g++) {
      let count = 0;
      const layer = withTree ? [] : null;
      for (let parent = 0; parent < counts[g - 1]; parent++) {
        if (rng() < k / 2) {
          count += 2;
          if (withTree) layer.push(parent, parent);
        }
      }
      counts.push(count);
      if (withTree) layers.push(layer);
    }
    return { counts, layers };
  }
  function ensemble(k, initial, seed) {
    const runs = Array.from({ length: TRIALS }, (_, i) => simulate(k, initial, trialSeed(seed, i)).counts);
    const expected = runs[0].map((_, g) => initial * k ** g);
    const mean = expected.map((_, g) => runs.reduce((sum, run) => sum + run[g], 0) / TRIALS);
    const surviving = expected.map((_, g) => runs.filter(run => run[g] > 0).length);
    return { runs, expected, mean, surviving };
  }
  function extinction(k, generations) {
    let q = 0;
    for (let g = 0; g < generations; g++) q = 1 - k / 2 + k / 2 * q * q;
    return q;
  }
  const api = { GENERATIONS, TRIALS, random, trialSeed, simulate, ensemble, extinction };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BranchModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
