/* Independent geometry checks. Run: node --test test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./core.js');

function close(actual, expected, label, epsilon = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= epsilon,
    `${label}: ${actual} != ${expected}`);
}

test('camera locations remain on the four-unit orbit, with wrapped angles', () => {
  for (const [angle, normalized] of [[-45, 315], [360, 0], [725, 5], [-720, 0]]) {
    assert.equal(C.normalizeAngle(angle), normalized);
    assert.deepEqual(C.cameraPoint(angle), C.cameraPoint(normalized));
  }
  close(C.cameraPoint(0).x, 4, 'east camera');
  close(C.cameraPoint(90).y, 4, 'north camera');
  for (let angle = 0; angle < 360; angle += 7) {
    const {x, y} = C.cameraPoint(angle);
    close(Math.hypot(x, y), 4, `orbit at ${angle} degrees`);
  }
});

test('known views agree with analytic pinhole projection', () => {
  for (const x of [-1, 1]) {
    close(C.projectActor(x, 90).screenX, x / 4, 'north screen position');
    close(C.projectActor(x, 270).screenX, -x / 4, 'south screen position');
    close(C.projectActor(x, 90).scale, 1, 'equal distance at north');
    close(C.projectActor(x, 0).screenX, 0, 'east on-axis overlap');
    close(C.projectActor(x, 180).screenX, 0, 'west on-axis overlap');
  }
  close(C.projectActor(1, 0).depth, 3, 'near actor depth');
  close(C.projectActor(-1, 0).depth, 5, 'far actor depth');
  close(C.projectActor(1, 0).scale, 4 / 3, 'near actor enlargement');
  close(C.projectActor(-1, 0).scale, 4 / 5, 'far actor shrinkage');
  close(C.projectActor(1, 135).screenX, Math.SQRT1_2 / (4 + Math.SQRT1_2), 'oblique projection');
});

test('projection agrees with a separate camera basis calculation at every degree', () => {
  for (let angle = 0; angle < 360; angle++) {
    const theta = angle * Math.PI / 180;
    const camera = {x: 4 * Math.cos(theta), y: 4 * Math.sin(theta)};
    for (const x of [-1, 1]) {
      const dx = x - camera.x, dy = -camera.y;
      const right = dx * Math.sin(theta) - dy * Math.cos(theta);
      const depth = -dx * Math.cos(theta) - dy * Math.sin(theta);
      const actual = C.projectActor(x, angle);
      close(actual.screenX, right / depth, `screen x=${x}, angle=${angle}`);
      close(actual.depth, depth, `depth x=${x}, angle=${angle}`);
      assert.ok(actual.depth >= 3 && actual.depth <= 5);
      assert.ok(actual.scale > 0 && Number.isFinite(actual.screenX));
    }
  }
});

test('screen ordering flips across the actors’ axis, while their world positions stay fixed', () => {
  for (let angle = 1; angle < 180; angle++) {
    assert.ok(C.projectActor(-1, angle).screenX < C.projectActor(1, angle).screenX);
    assert.ok(C.projectActor(-1, angle + 180).screenX > C.projectActor(1, angle + 180).screenX);
  }
  assert.equal(C.continuity(55, 135), 'holds');
  assert.equal(C.continuity(55, 225), 'crossed');
});

test('the side of the axis determines continuity, rather than angular separation', () => {
  assert.equal(C.continuity(10, 170), 'holds');
  assert.equal(C.continuity(1, 359), 'crossed');
  assert.equal(C.continuity(-135, 225), 'holds');
  for (const a of [1, 55, 179, 181, 225, 359]) {
    for (const b of [1, 55, 179, 181, 225, 359]) {
      assert.equal(C.continuity(a, b), C.continuity(b, a));
    }
  }
});

test('axis views are neutral, with the near actor obscuring the far actor', () => {
  for (const angle of [0, 180, 360, -180]) {
    assert.equal(C.cameraSide(angle), 'axis');
    assert.equal(C.continuity(55, angle), 'axis');
    assert.equal(C.continuity(angle, 225), 'axis');
    close(C.projectActor(-1, angle).screenX, C.projectActor(1, angle).screenX, 'axis overlap');
  }
  assert.equal(C.cameraSide(0.001), 'upper');
  assert.equal(C.cameraSide(179.999), 'upper');
  assert.equal(C.cameraSide(180.001), 'lower');
  assert.equal(C.cameraSide(359.999), 'lower');
});
