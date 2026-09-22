const assert = require('node:assert/strict');
const { test } = require('node:test');
const C = require('./core.js');

test('overprint respects white, black, and commutative ink order', () => {
  assert.equal(C.multiply('#ffffff', '#28675c'), '#28675c');
  assert.equal(C.multiply('#000000', '#ed6944'), '#000000');
  assert.equal(C.multiply('#ff0000', '#00ffff'), '#000000');
  assert.equal(C.multiply('#808080', '#808080'), '#404040');
  for (const p of C.palettes) assert.equal(C.multiply(C.paper, p.a, p.b), C.multiply(C.paper, p.b, p.a));
});
test('millimeters and center rotation use the same physical page geometry', () => {
  assert.deepEqual(C.transformPoint(100, 200, { x: 2, y: -3, rotation: 0 }), { x: 110, y: 185 });
  assert.deepEqual(C.transformPoint(450, 550, { x: 0, y: 0, rotation: 90 }), { x: 450, y: 550 });
  const p = C.transformPoint(550, 550, { x: 0, y: 0, rotation: 90 });
  assert.ok(Math.abs(p.x - 450) < 1e-10 && Math.abs(p.y - 650) < 1e-10);
});
test('dragging is independent of display size and clamps at paper limits', () => {
  const origin = { x: 0, y: 0 };
  assert.deepEqual(C.offsetFromDrag(origin, 25, 50, 450, 550), { x: 10, y: 20 });
  assert.deepEqual(C.offsetFromDrag(origin, 50, 100, 900, 1100), { x: 10, y: 20 });
  assert.deepEqual(C.offsetFromDrag(origin, 1000, -1000, 450, 550), { x: 24, y: -24 });
});
test('invalid states cannot escape supported controls', () => {
  const s = C.normalize({ design: 'missing', palette: 99, x: Infinity, y: -300, rotation: 300, view: 'nope' });
  assert.equal(s.design, 'sun');assert.equal(s.palette, 2);assert.equal(s.x, 0);assert.equal(s.y, -24);assert.equal(s.rotation, 8);assert.equal(s.view, 'both');
});
test('happy accidents stay in range and grain is reproducible', () => {
  const r = C.seeded(22), again = C.seeded(22);
  for (let i = 0; i < 100; i++) assert.equal(r(), again());
  for (let i = 0; i < 1000; i++) {
    const s = C.randomOffset(r);
    assert.ok(Math.abs(s.x) <= 11 && Math.abs(s.y) <= 9 && Math.abs(s.rotation) <= 4);
  }
});
