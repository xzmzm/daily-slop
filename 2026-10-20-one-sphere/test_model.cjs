const assert = require('node:assert/strict');
const M = require('./model.js');

const near = (a, b, eps) => Math.abs(a - b) < eps;
// ten shells, bands around the pole don't overlap
assert.equal(M.SHELLS.length, 10);
const bands = M.SHELLS.map(s => [s.center - s.half, s.center + s.half]);
for (let i = 1; i < bands.length; i++) assert(bands[i][0] > bands[i - 1][1]);
assert(bands.at(-1)[1] < 360);
// sphere mode: every point of every shell, placed at t=0, lies on one 75 m sphere
for (const s of M.SHELLS) {
  const pl = M.placement(s, 0);
  for (const row of M.mesh(s, 'sphere')) for (const p of row) {
    const w = M.place(p, pl);
    assert(near(Math.hypot(...w), M.R, 1e-6), s.id);
  }
  assert(M.deviation(s, 'sphere') < 1e-9);
  // free-form ribs miss that sphere by metres
  assert(M.deviation(s, 'free') > 1, s.id);
}
// both kinds of rib leave the pedestal at the same point, and have the same length
const s0 = M.SHELLS[0];
assert.deepEqual(M.profile(s0, 0.5, 0, 'free'), [0, 0]);
const len = mode => { let L = 0, prev = [0, 0]; for (let i = 1; i <= 400; i++) { const p = M.profile(s0, 0.5, s0.L * i / 400, mode); L += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; } return L; };
assert(near(len('free'), s0.L, 0.01) && near(len('sphere'), s0.L, 0.01));
// t=1: pedestals land on the podium, and every shell stands up above it
for (const s of M.SHELLS) {
  const pl = M.placement(s, 1);
  const pole = M.place([0, 0, 0], pl);
  assert(near(pole[0], s.site[0], 1e-9) && near(pole[1], s.site[1], 1e-9) && near(pole[2], 0, 1e-9));
  let top = 0;
  for (const row of M.mesh(s, 'sphere')) for (const p of row) {
    const w = M.place(p, pl);
    assert(w[2] > -1e-6, s.id);
    top = Math.max(top, w[2]);
  }
  assert(top > 20 && top < 75, s.id + ' ' + top);
  // north-facing shells reach north of their pedestal, south-facing ones south
  const tip = M.place(M.localPoint(s, 0, 1, 'sphere'), pl);
  assert(s.heading === 0 ? tip[0] > s.site[0] : tip[0] < s.site[0], s.id);
}
// staggered flight: first shell moves first, all finish at t=1
assert(M.shellT(M.SHELLS[0], 0.3) > M.shellT(M.SHELLS[9], 0.3));
assert.equal(M.shellT(M.SHELLS[9], 1), 1);
assert.equal(M.shellT(M.SHELLS[0], 0), 0);
// the punchline: one curve for the sphere, hundreds for the free-form roof
const sph = M.moulds('sphere'), free = M.moulds('free');
assert.equal(sph.curves, 1);
assert(free.curves > 300, free.curves);
assert.equal(sph.segments, free.segments);
console.log('model ok', sph, free);
