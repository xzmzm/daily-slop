/* Thirteen sampled positions with twelve equal time intervals. */
(function (root) {
  'use strict';
  const COUNT = 13, TRAVEL_MS = 1000, START_HOLD_MS = 350, END_HOLD_MS = 450;
  const CYCLE_MS = START_HOLD_MS + TRAVEL_MS + END_HOLD_MS;
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
  function preset(name) {
    const easing = {
      steady: t => t,
      launch: t => t * t,
      arrive: t => 1 - (1 - t) ** 2,
      both: t => (1 - Math.cos(Math.PI * t)) / 2,
    }[name];
    if (!easing) throw new RangeError('Unknown spacing preset');
    return Array.from({length: COUNT}, (_, i) => easing(i / (COUNT - 1)));
  }
  function move(positions, index, value) {
    if (!Number.isInteger(index) || index <= 0 || index >= COUNT - 1 || !Number.isFinite(value)) return positions.slice();
    const result = positions.slice();
    result[index] = clamp(value, result[index - 1], result[index + 1]);
    return result;
  }
  function frameAt(elapsed) {
    const phase = ((elapsed % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
    return clamp(Math.floor((phase - START_HOLD_MS) / TRAVEL_MS * (COUNT - 1) + 1e-9), 0, COUNT - 1);
  }
  function stepPercent(positions, index) {
    return index <= 0 ? 0 : (positions[index] - positions[index - 1]) * 100;
  }
  const api = {COUNT, TRAVEL_MS, START_HOLD_MS, END_HOLD_MS, CYCLE_MS, clamp, preset, move, frameAt, stepPercent};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SpacingModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
