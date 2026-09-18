/* Pure tone-mapping and quantization; shared by the browser and node tests. */
(function (root) {
  'use strict';
  const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
  const linear = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const luminance = (r, g, b) => .2126 * linear(r) + .7152 * linear(g) + .0722 * linear(b);
  const tone = (v, exposure = 0, contrast = 1) => clamp((v * 2 ** exposure - .18) * contrast + .18);
  const BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  function validateLevels(levels) {
    if (levels.length < 2 || levels.some((x, i) => !Number.isFinite(x) || x < 0 || x > 1 || (i && x < levels[i - 1]))) {
      throw new RangeError('Use at least two finite, ascending levels between zero and one.');
    }
  }
  function nearest(v, levels) {
    let lo = 0, hi = levels.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (levels[mid] < v) lo = mid + 1; else hi = mid; }
    return lo && v - levels[lo - 1] <= levels[lo] - v ? lo - 1 : lo;
  }
  function quantize(values, width, height, levels, mode = 'none') {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || values.length !== width * height) throw new RangeError('Invalid image dimensions.');
    validateLevels(levels);
    if (!['none', 'ordered', 'diffusion'].includes(mode)) throw new RangeError('Unknown dither mode.');
    const result = new Uint16Array(values.length);
    const errors = mode === 'diffusion' ? new Float64Array(values.length) : null;
    const add = (x, y, error) => { if (x >= 0 && x < width && y < height) errors[y * width + x] += error; };
    for (let y = 0; y < height; y++) {
      const dir = mode === 'diffusion' && y % 2 ? -1 : 1;
      for (let k = 0; k < width; k++) {
        const x = dir === 1 ? k : width - 1 - k, p = y * width + x;
        if (!Number.isFinite(values[p])) throw new RangeError('Image values must be finite.');
        const value = clamp(values[p]) + (errors ? errors[p] : 0);
        let index = nearest(value, levels);
        if (mode === 'ordered' && value > levels[0] && value < levels[levels.length - 1]) {
          let hi = index;
          if (levels[hi] < value) hi++;
          const lo = Math.max(0, hi - 1), span = levels[hi] - levels[lo];
          const threshold = (BAYER[(y % 4) * 4 + x % 4] + .5) / 16;
          index = span > 0 && (value - levels[lo]) / span > threshold ? hi : lo;
        }
        result[p] = index;
        if (errors) {
          const error = value - levels[index];
          add(x + dir, y, error * 7 / 16);
          add(x - dir, y + 1, error * 3 / 16);
          add(x, y + 1, error * 5 / 16);
          add(x + dir, y + 1, error / 16);
        }
      }
    }
    return result;
  }
  function textFromIndices(indices, width, glyphs) {
    if (!Number.isInteger(width) || width < 1 || indices.length % width) throw new RangeError('Invalid text width.');
    const lines = [];
    for (let p = 0; p < indices.length; p += width) lines.push(Array.from(indices.slice(p, p + width), i => glyphs[i]).join(''));
    return lines.join('\n');
  }
  const api = { clamp, linear, luminance, tone, nearest, quantize, textFromIndices, validateLevels };
  root.TypeLightCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
