const { test } = require('node:test');
const assert = require('node:assert/strict');
const Coast = require('./coast.js');

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} differs from ${expected}`);
}

test('a pin lands inside an edge when the span circle first reaches it', () => {
  const route = Coast.walk([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 5 }], 5);
  assert.deepEqual(route.pins, [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 5 }]);
  assert.equal(route.fullSteps, 1);
  assert.equal(route.remainder, 1);
  assert.equal(route.length, 6);
});

test('one straight edge can take multiple steps, including an exact closing step', () => {
  const square = [[0, 0], [0, 0], [10, 0], [10, 10], [0, 10], [0, 0]].map(([x, y]) => ({ x, y }));
  const route = Coast.walk(square, 5);
  assert.equal(route.fullSteps, 8);
  assert.equal(route.remainder, 0);
  assert.equal(route.length, 40);
  assert.equal(route.pins.length, 9);
  assert.deepEqual(route.pins.at(-1), square[0]);
});

test('all four walks land on the same shoreline and include the closing chord once', () => {
  const { shore } = Coast.makeChart();
  assert.deepEqual(shore[0], shore.at(-1));
  const expectedKm = ['230.9', '260.2', '331.4', '389.1'];

  function onShore(p) {
    return shore.slice(1).some((b, i) => {
      const a = shore[i], dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y) < 1e-7;
    });
  }
  Coast.spans.forEach((km, index) => {
    const span = km * Coast.unitsPerKm;
    const { pins, fullSteps, remainder, length } = Coast.walk(shore, span);
    assert.deepEqual(pins[0], pins.at(-1));
    assert.ok(remainder > 0 && remainder < span);
    let total = 0;
    for (let i = 1; i < pins.length; i++) {
      assert.ok(onShore(pins[i]), 'Every planted pin must touch the charted coast.');
      const step = Math.hypot(pins[i].x - pins[i - 1].x, pins[i].y - pins[i - 1].y);
      near(step, i <= fullSteps ? span : remainder);
      total += step;
    }
    near(total, length);
    assert.equal((length / Coast.unitsPerKm).toFixed(1), expectedKm[index]);
  });
});
