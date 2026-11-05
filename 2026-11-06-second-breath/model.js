(function (root) {
  'use strict';
  const SPEED = 343;
  function validate(kind, length, mode) {
    if (!['cylinder', 'cone'].includes(kind)) throw new RangeError('Unknown bore');
    if (!Number.isFinite(length) || length <= 0) throw new RangeError('Length must be positive');
    if (!Number.isInteger(mode) || mode < 1) throw new RangeError('Mode must be a positive integer');
  }
  function ratio(kind, mode) { validate(kind, 1, mode); return kind === 'cylinder' ? 2 * mode - 1 : mode; }
  function frequency(kind, length, mode = 1) {
    validate(kind, length, mode);
    return SPEED * ratio(kind, mode) / ((kind === 'cylinder' ? 4 : 2) * length);
  }
  function pressure(kind, mode, x) {
    validate(kind, 1, mode);
    if (!Number.isFinite(x) || x < 0 || x > 1) throw new RangeError('Position must be between 0 and 1');
    if (kind === 'cylinder') return Math.cos((2 * mode - 1) * Math.PI * x / 2);
    const phase = mode * Math.PI * x;
    return phase === 0 ? 1 : Math.sin(phase) / phase;
  }
  function nodes(kind, mode) {
    validate(kind, 1, mode);
    return Array.from({length: mode - 1}, (_, i) => kind === 'cylinder' ? (2 * i + 1) / (2 * mode - 1) : (i + 1) / mode);
  }
  function note(hz) {
    if (!Number.isFinite(hz) || hz <= 0) throw new RangeError('Frequency must be positive');
    const midi = Math.round(69 + 12 * Math.log2(hz / 440));
    const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
    return {name: names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1), cents: Math.round(1200 * Math.log2(hz / (440 * 2 ** ((midi - 69) / 12))))};
  }
  const api = {SPEED, ratio, frequency, pressure, nodes, note};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BoreModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
