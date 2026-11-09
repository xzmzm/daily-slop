// Node unit tests for the No Overlap layout engine.
// Run from the repository root: node 2026-11-10-no-overlap/test_model.cjs
const assert = require('assert');
const M = require('./model.js');

function fresh() { return M.initialState(); }

function checkTiles(state, label) {
  const { rects } = M.tileRects(state);
  assert.ok(M.disjoint(rects), `${label}: tiles overlap`);
  for (const [id, r] of Object.entries(rects)) {
    assert.ok(r.l >= -1e-9 && r.t >= -1e-9 && r.l + r.w <= 1 + 1e-9 && r.t + r.h <= 1 + 1e-9,
      `${label}: ${id} outside desktop ${JSON.stringify(r)}`);
    assert.ok(r.w > 0.01 && r.h > 0.01, `${label}: ${id} collapsed ${JSON.stringify(r)}`);
  }
  return rects;
}

// --- initial tiling ---
(() => {
  const s = fresh();
  const { rects, cur } = M.tileRects(s);
  assert.equal(cur, 'dos');
  assert.equal(Object.keys(rects).length, 5);
  assert.deepStrictEqual(rects.dos, { l: 0, t: 0, w: 0.62, h: 0.68 });
  // right column: two stacked windows, full height
  assert.equal(rects.clock.l, 0.62); assert.equal(rects.clock.w, 0.38);
  assert.equal(rects.notepad.l, 0.62); assert.equal(rects.notepad.t, 0.5);
  // bottom row: two windows under the current one
  assert.equal(rects.calc.t, 0.68); assert.equal(rects.calendar.t, 0.68);
  checkTiles(s, 'initial');
})();

// --- makeCurrent retiles; no overlaps for every choice and count ---
for (const target of ['clock', 'notepad', 'calc', 'calendar', 'dos']) {
  const s = fresh();
  M.makeCurrent(s, target);
  const { rects, cur } = M.tileRects(s);
  assert.equal(cur, target);
  checkTiles(s, `current=${target}`);
  // current always owns the big top-left tile
  assert.deepStrictEqual(rects[target], { l: 0, t: 0, w: s.colFrac, h: s.rowFrac });
}

// --- sash drags keep tiles disjoint and stay clamped ---
(() => {
  const s = fresh();
  const before = s.colFrac;
  M.dragSash(s, 'main-col', 0, 0.5);            // way past the limit
  assert.ok(s.colFrac <= M.LIMITS.col[1], 'col clamp high');
  M.dragSash(s, 'main-col', 0, -2);
  assert.ok(s.colFrac >= M.LIMITS.col[0], 'col clamp low');
  assert.notEqual(s.colFrac, before);
  checkTiles(s, 'after col drag');

  M.dragSash(s, 'main-row', 0, 2);
  assert.ok(s.rowFrac <= M.LIMITS.row[1], 'row clamp high');
  checkTiles(s, 'after row drag');

  M.dragSash(s, 'right', 0, 2);
  checkTiles(s, 'after right inner drag');
  M.dragSash(s, 'bottom', 0, 2);
  checkTiles(s, 'after bottom inner drag');

  // dragging the column sash scales the bottom boundaries proportionally
  const s2 = fresh();
  M.tileRects(s2);                              // initialize the inner boundaries
  const frac = s2.bottomFracs[0] / s2.colFrac;
  M.dragSash(s2, 'main-col', 0, -0.2);
  assert.ok(Math.abs(s2.bottomFracs[0] / s2.colFrac - frac) < 1e-9, 'bottom proportion kept');
  checkTiles(s2, 'after col drag with bottom');
})();

// --- iconify / restore ---
(() => {
  const s = fresh();
  assert.ok(M.iconify(s, 'clock'));
  assert.equal(M.openIds(s).length, 4);
  checkTiles(s, 'iconified 1');
  assert.ok(M.iconify(s, 'notepad'));
  assert.ok(M.iconify(s, 'calc'));
  checkTiles(s, 'iconified 3');
  assert.equal(M.openIds(s).length, 2);
  assert.ok(M.uniconify(s, 'calc'));
  assert.equal(s.currentId, 'calc');       // restored windows take the big tile
  checkTiles(s, 'restored 1');
  // iconify the current window: current moves to the first open window
  assert.ok(M.iconify(s, 'calc'));
  assert.equal(s.currentId, 'dos');
  checkTiles(s, 'iconify current');
})();

// --- zoom ---
(() => {
  const s = fresh();
  assert.ok(M.setZoom(s, true));
  assert.equal(s.zoomed, true);
  const { rects } = M.tileRects(s);
  assert.deepStrictEqual(rects.dos, { l: 0, t: 0, w: 1, h: 1 });
  assert.equal(M.openIds(s).length, 1);
  assert.ok(M.setZoom(s, false));
  assert.equal(s.zoomed, false);
  checkTiles(s, 'unzoomed');
  // zoom is a 1983 habit
  const o = fresh();
  M.setMode(o, 'overlap');
  assert.equal(M.setZoom(o, true), false);
})();

// --- 1987 overlap rules ---
(() => {
  const s = fresh();
  assert.equal(M.setMode(s, 'overlap'), 'overlap');
  const pairs = M.overlapPairs(s);
  assert.ok(pairs.count > 0, 'staggered floats should overlap');
  const floats = M.floatRects(s);
  assert.equal(floats.length, 5);
  // move one window to a free corner: pairs drop
  M.floatMove(s, 'calendar', 0.0, 0.6);
  const after = M.overlapPairs(s);
  assert.ok(after.count < pairs.count, 'moving away reduces overlaps');
  // clamped inside the desktop
  M.floatMove(s, 'dos', 2, 2);
  const f = s.wins.dos.float;
  assert.ok(f.l <= 1 - f.w + 1e-9 && f.t <= 1 - f.h + 1e-9, 'float clamped');
  // back to 1983: everything tiles, zero overlaps
  assert.equal(M.setMode(s, 'tile'), 'tile');
  assert.equal(s.wins.dos.iconified, false);
  assert.equal(M.overlapPairs(s).count, 0);
  checkTiles(s, 'back to tile');
})();

// --- one window only ---
(() => {
  const s = fresh();
  for (const id of ['clock', 'notepad', 'calc', 'calendar']) M.iconify(s, id);
  const { rects } = M.tileRects(s);
  assert.deepStrictEqual(rects.dos, { l: 0, t: 0, w: 1, h: 1 });
  assert.deepStrictEqual(M.sashes(s), [], 'no sashes with a single window');
  assert.equal(M.dragSash(s, 'main-col', 0, 0.1), null);
})();

// --- many sash drags never break the invariant ---
(() => {
  const s = fresh();
  let seed = 43;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  for (let i = 0; i < 200; i++) {
    const kinds = ['main-col', 'main-row', 'right', 'bottom'];
    const kind = kinds[Math.floor(rand() * kinds.length)];
    M.dragSash(s, kind, 0, (rand() - 0.5) * 0.3);
    checkTiles(s, `fuzz ${i}`);
  }
})();

console.log('model tests passed');
