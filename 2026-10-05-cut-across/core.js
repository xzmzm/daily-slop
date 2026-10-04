(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CutCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const RADIUS = 4;
  const normalizeAngle = angle => ((angle % 360) + 360) % 360;
  function cameraSide(angle) {
    const y = Math.sin(normalizeAngle(angle) * Math.PI / 180);
    return Math.abs(y) < 1e-9 ? 'axis' : y > 0 ? 'upper' : 'lower';
  }
  function continuity(a, b) {
    const first = cameraSide(a), second = cameraSide(b);
    return first === 'axis' || second === 'axis' ? 'axis' : first === second ? 'holds' : 'crossed';
  }
  function projectActor(x, angle) {
    const theta = normalizeAngle(angle) * Math.PI / 180;
    const lateral = x * Math.sin(theta), depth = RADIUS - x * Math.cos(theta);
    return {screenX: lateral / depth, depth, scale: RADIUS / depth};
  }
  function cameraPoint(angle) {
    const theta = normalizeAngle(angle) * Math.PI / 180;
    return {x: RADIUS * Math.cos(theta), y: RADIUS * Math.sin(theta)};
  }
  return {RADIUS, normalizeAngle, cameraSide, continuity, projectActor, cameraPoint};
});
