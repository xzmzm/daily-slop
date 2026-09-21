/* The symmetric, directed Braess network. All times are minutes.
   A flow is the number of drivers in the modelled commute, not cars on screen. */
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function parameters({demand = 4000, delay = 0, open = false, policy = 'selfish'} = {}) {
    if (!Number.isFinite(demand) || demand <= 0 || demand > 100000) throw new RangeError('Demand must be positive and at most 100000.');
    if (!Number.isFinite(delay) || delay < 0 || delay > 45) throw new RangeError('Shortcut delay must be between 0 and 45.');
    if (typeof open !== 'boolean' || !['selfish', 'coordinated'].includes(policy)) throw new TypeError('Invalid network setting.');
    return {demand, delay, open, policy};
  }
  function evaluate(flows, delay = 0) {
    const [upper, lower, cross] = flows;
    const first = upper + cross, last = lower + cross;
    const costs = [first / 100 + 45, 45 + last / 100, (first + last) / 100 + delay];
    const demand = upper + lower + cross;
    const total = flows.reduce((s, f, i) => s + f * costs[i], 0);
    return {flows, costs, edges: [first, upper, lower, last, cross], times: [first / 100, 45, 45, last / 100, delay], total, average: total / demand};
  }
  function solve(input) {
    const p = parameters(input), q = p.demand;
    // Let u be the load on each of the two congestion-sensitive roads.
    // Wardrop: u/100 + 45 = 2u/100 + delay.
    // Social optimum: minimize 2u²/100 + 90(q-u) + delay(2u-q).
    const threshold = (45 - p.delay) * (p.policy === 'selfish' ? 100 : 50);
    const u = p.open ? clamp(threshold, q / 2, q) : q / 2;
    const cross = p.open ? Math.max(0, 2 * u - q) : 0;
    const result = evaluate([(q - cross) / 2, (q - cross) / 2, cross], p.delay);
    const available = p.open ? result.costs : result.costs.slice(0, 2);
    const cheapest = Math.min(...available);
    const gap = Math.max(0, ...result.costs.map((c, i) => result.flows[i] > 1e-8 ? c - cheapest : 0));
    return {...p, ...result, baseline: 45 + q / 200, gap, delta: result.average - (45 + q / 200)};
  }
  const api = Object.freeze({parameters, evaluate, solve});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TrafficModel = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
