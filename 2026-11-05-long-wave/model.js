/* One-way, slowly varying shallow-water approximation. Distances in km;
 * travel time in seconds. This is an illustrative ray model, not an SWE solver. */
(function (root) {
  'use strict';
  const G = 9.81, DEEP = 4000, LENGTH = 900, SOURCE = 80, PERIOD = 720, AMPLITUDE = .5;
  const DX = .25, SLOPE_START = 240, SLOPE_END = 660;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const speed = depth => Math.sqrt(G * depth);
  const amplitude = depth => AMPLITUDE * Math.pow(DEEP / depth, .25);

  function create(shelfDepth = 200) {
    shelfDepth = clamp(Number.isFinite(+shelfDepth) ? +shelfDepth : 200, 50, DEEP);
    function depth(x) {
      const u = clamp((x - SLOPE_START) / (SLOPE_END - SLOPE_START), 0, 1);
      return shelfDepth + (DEEP - shelfDepth) * (1 + Math.cos(Math.PI * u)) / 2;
    }
    const count = Math.round(LENGTH / DX) + 1;
    const times = new Float64Array(count);
    for (let i = 1; i < count; i++) {
      times[i] = times[i - 1] + DX * 1000 * .5 * (1 / speed(depth((i - 1) * DX)) + 1 / speed(depth(i * DX)));
    }
    const sourceTime = times[Math.round(SOURCE / DX)];
    function travelTime(x) {
      const p = clamp(x / DX, 0, count - 1), i = Math.min(count - 2, Math.floor(p));
      return times[i] + (times[i + 1] - times[i]) * (p - i) - sourceTime;
    }
    function position(seconds) {
      const target = clamp(seconds + sourceTime, times[0], times[count - 1]);
      let low = 0, high = count - 1;
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if (times[mid] < target) low = mid; else high = mid;
      }
      return DX * (low + (target - times[low]) / (times[high] - times[low]));
    }
    function elevation(x, seconds) {
      const phase = (travelTime(x) - seconds) / PERIOD;
      return amplitude(depth(x)) * Math.cos(2 * Math.PI * phase) * Math.exp(-phase * phase / (2 * .72 * .72));
    }
    function snapshot(seconds) {
      const x = position(seconds), h = depth(x), c = speed(h), a = amplitude(h);
      return { x, depth: h, speed: c * 3.6, amplitude: a, gain: a / AMPLITUDE,
        wavelength: c * PERIOD / 1000, seconds, fluxRatio: a * a * c / (AMPLITUDE * AMPLITUDE * speed(DEEP)) };
    }
    return { shelfDepth, depth, travelTime, position, elevation, snapshot, endTime: travelTime(LENGTH) };
  }
  const api = { G, DEEP, LENGTH, SOURCE, PERIOD, AMPLITUDE, SLOPE_START, SLOPE_END, speed, amplitude, create, clamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LongWave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
