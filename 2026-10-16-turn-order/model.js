(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.TurnModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const identity = () => [1, 0, 0, 0];
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const normalize = q => { const n = Math.hypot(...q); return q.map(v => v / n); };
  function multiply(a, b) {
    const [w, x, y, z] = a, [v, i, j, k] = b;
    return [w*v-x*i-y*j-z*k, w*i+x*v+y*k-z*j, w*j-x*k+y*v+z*i, w*k+x*j-y*i+z*v];
  }
  function turn(axis, degrees) {
    const half = degrees * Math.PI / 360, q = [Math.cos(half), 0, 0, 0];
    q[{x: 1, y: 2, z: 3}[axis]] = Math.sin(half);
    return q;
  }
  function rotate(q, v) {
    const p = multiply(multiply(q, [0, ...v]), [q[0], -q[1], -q[2], -q[3]]);
    return p.slice(1);
  }
  function pose(moves, angle = 90, progress = moves.length) {
    let q = identity();
    for (let i = 0; i < moves.length; i++) {
      const f = clamp(progress - i, 0, 1);
      const eased = f * f * (3 - 2 * f);
      q = multiply(turn(moves[i].axis, angle * moves[i].sign * eased), q);
    }
    return normalize(q);
  }
  function distance(a, b) {
    const na = normalize(a), nb = normalize(b);
    const dot = Math.abs(na.reduce((sum, v, i) => sum + v * nb[i], 0));
    return 2 * Math.acos(clamp(dot, 0, 1)) * 180 / Math.PI;
  }
  const move = (axis, sign = 1) => ({axis, sign});
  const presets = {
    two: () => [move('x'), move('y')],
    loop: () => [move('x'), move('y'), move('x', -1), move('y', -1)],
    one: () => [move('x'), move('x', -1)]
  };
  return {identity, normalize, multiply, turn, rotate, pose, distance, presets};
});
