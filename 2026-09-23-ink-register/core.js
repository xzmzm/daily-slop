/* Shared geometry and color model; usable in both a browser and Node. */
(function (root) {
  'use strict';
  const palettes = [
    { name: 'Persimmon', a: '#28675c', b: '#ed6944' },
    { name: 'After hours', a: '#3f51b5', b: '#f26996' },
    { name: 'Marigold', a: '#227887', b: '#efb62d' },
  ];
  const paper = '#f5f0df';
  const clamp = (v, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : 0));
  function normalize(input = {}) {
    return {
      design: ['sun', 'bloom', 'tide'].includes(input.design) ? input.design : 'sun',
      palette: Math.round(clamp(input.palette ?? 0, 0, palettes.length - 1)),
      x: clamp(input.x ?? 1.6, -24, 24), y: clamp(input.y ?? -1, -24, 24),
      rotation: clamp(input.rotation ?? .6, -8, 8),
      view: ['both', 'a', 'b'].includes(input.view) ? input.view : 'both',
      grain: input.grain !== false, marks: input.marks !== false,
    };
  }
  function rgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
  function multiply(...colors) {
    const channels = colors.map(rgb).reduce((a, b) => a.map((v, i) => v * b[i] / 255), [255, 255, 255]);
    return '#' + channels.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }
  // All plate geometry uses a 900 × 1100 page: 5 drawing units per mm.
  function transformPoint(x, y, state) {
    const rad = state.rotation * Math.PI / 180, dx = x - 450, dy = y - 550;
    return { x: 450 + dx * Math.cos(rad) - dy * Math.sin(rad) + state.x * 5,
      y: 550 + dx * Math.sin(rad) + dy * Math.cos(rad) + state.y * 5 };
  }
  function offsetFromDrag(start, dx, dy, width, height) {
    return { x: clamp(start.x + dx / width * 180, -24, 24), y: clamp(start.y + dy / height * 220, -24, 24) };
  }
  function randomOffset(random = Math.random) {
    return { x: Math.round((random() * 22 - 11) * 5) / 5,
      y: Math.round((random() * 18 - 9) * 5) / 5, rotation: Math.round((random() * 8 - 4) * 10) / 10 };
  }
  function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
  }
  const api = { palettes, paper, clamp, normalize, multiply, transformPoint, offsetFromDrag, randomOffset, seeded };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.InkCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
