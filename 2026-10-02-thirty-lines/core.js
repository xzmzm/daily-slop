/* A line-major serial raster: each column is sent from top to bottom. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ThirtyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ROWS = 80;
  const FRAME_RATE = 5;
  const VISUAL_RATE = FRAME_RATE / 10;
  const mod = (x, n) => ((x % n) + n) % n;

  function address(serial, lines, drift = 0, phase = 0, rows = ROWS, offset = 0) {
    const total = lines * rows;
    return mod(Math.floor(serial * (1 + drift / 100) + phase / 360 * total + offset), total);
  }
  function coordinates(index, rows = ROWS) {
    return {column: Math.floor(index / rows), row: index % rows};
  }
  function sampleRGBA(rgba, width, height, lines, rows = ROWS) {
    // Area averages preserve grey tones when a hole covers more than one pixel.
    const samples = new Float32Array(lines * rows);
    for (let column = 0; column < lines; column++) {
      const x0 = Math.floor(column * width / lines);
      const x1 = Math.max(x0 + 1, Math.floor((column + 1) * width / lines));
      for (let row = 0; row < rows; row++) {
        const y0 = Math.floor(row * height / rows);
        const y1 = Math.max(y0 + 1, Math.floor((row + 1) * height / rows));
        let sum = 0, count = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          sum += .2126 * rgba[i] + .7152 * rgba[i + 1] + .0722 * rgba[i + 2];
          count++;
        }
        samples[column * rows + row] = sum / count / 255;
      }
    }
    return samples;
  }
  function transmit(memory, samples, start, end, lines, drift, phase, offset = 0) {
    for (let serial = start; serial < end; serial++) {
      memory[address(serial, lines, drift, phase, ROWS, offset)] = samples[mod(serial, samples.length)];
    }
    return memory;
  }
  function rpm(drift = 0) { return FRAME_RATE * 60 * (1 + drift / 100); }
  return {ROWS, FRAME_RATE, VISUAL_RATE, mod, address, coordinates, sampleRGBA, transmit, rpm};
});
