'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const model = require('./model.js');

const pairs = [[[0, 1], [2, 3]], [[0, 3], [2, 1]]];
const directions = ['N', 'E', 'S', 'W'];

// Independent oracle: union edge ports, rather than traversing arc nodes.
function verify(board, size) {
  const original = board.slice();
  const result = model.analyze(board, size);
  assert.deepEqual(board, original);
  const parent = Array.from({ length: board.length * 4 }, (_, i) => i);
  function root(a) {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  }
  function join(a, b) { parent[root(a)] = root(b); }
  for (let tile = 0; tile < board.length; tile += 1) {
    for (const [a, b] of pairs[board[tile]]) join(tile * 4 + a, tile * 4 + b);
    if (tile % size < size - 1) join(tile * 4 + 1, (tile + 1) * 4 + 3);
    if (Math.floor(tile / size) < size - 1) join(tile * 4 + 2, (tile + size) * 4);
  }
  const expected = new Map();
  const degrees = Array(board.length * 2).fill(0);
  const seen = new Set();
  for (let tile = 0; tile < board.length; tile += 1) {
    for (let arc = 0; arc < 2; arc += 1) {
      const key = root(tile * 4 + pairs[board[tile]][arc][0]);
      if (!expected.has(key)) expected.set(key, []);
      expected.get(key).push(tile * 2 + arc);
    }
  }
  assert.equal(result.components.length, expected.size);
  assert.equal(result.segmentComponent.length, board.length * 2);
  let total = 0;
  let endpointCount = 0;
  const observedRoots = new Set();
  result.components.forEach((component, id) => {
    assert.equal(component.id, id);
    assert.equal(component.length, component.segments.length);
    assert.ok(component.length > 0);
    const ids = component.segments.map(({ tile, arc }) => tile * 2 + arc);
    const first = component.segments[0];
    const key = root(first.tile * 4 + pairs[board[first.tile]][first.arc][0]);
    assert.ok(!observedRoots.has(key));
    observedRoots.add(key);
    assert.deepEqual(ids.slice().sort((a, b) => a - b), expected.get(key));
    const boundary = [];
    for (const { tile, arc } of component.segments) {
      const sid = tile * 2 + arc;
      assert.ok(!seen.has(sid));
      seen.add(sid);
      assert.equal(result.segmentComponent[sid], id);
      for (const edge of pairs[board[tile]][arc]) {
        const row = Math.floor(tile / size) + [-1, 0, 1, 0][edge];
        const col = tile % size + [0, 1, 0, -1][edge];
        if (row < 0 || row >= size || col < 0 || col >= size) {
          boundary.push(`${tile}:${directions[edge]}`);
        } else {
          const neighbor = row * size + col;
          const opposite = (edge + 2) % 4;
          const neighborArc = pairs[board[neighbor]].findIndex(edges => edges.includes(opposite));
          assert.equal(result.segmentComponent[neighbor * 2 + neighborArc], id);
        }
        degrees[sid] += 1;
      }
    }
    assert.deepEqual(component.endpoints.map(e => `${e.tile}:${e.edge}`).sort(), boundary.sort());
    assert.equal(component.closed, boundary.length === 0);
    assert.equal(boundary.length, component.closed ? 0 : 2);
    total += component.length;
    endpointCount += component.endpoints.length;
  });
  assert.equal(total, size * size * 2);
  assert.equal(seen.size, total);
  assert.ok(degrees.every(degree => degree === 2));
  assert.equal(endpointCount, size * 4);
  assert.deepEqual(result.loops, result.components.filter(component => component.closed));
  assert.equal(result.longestLoop, Math.max(0, ...result.loops.map(loop => loop.length)));
  return result;
}

test('CommonJS export and vanilla browser global have identical APIs', () => {
  assert.equal(globalThis.LoopModel, model);
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'model.js'), 'utf8'), context);
  assert.deepEqual(Object.keys(context.LoopModel), ['createBoard', 'analyze', 'rotate', 'createChallenge']);
  assert.equal(JSON.stringify(context.LoopModel.createBoard('browser')), JSON.stringify(model.createBoard('browser')));
});

test('known 2x2 loop uses correct orientations and four arc segments', () => {
  const result = verify([1, 0, 0, 1], 2);
  assert.equal(result.loops.length, 1);
  assert.equal(result.longestLoop, 4);
  assert.deepEqual(result.loops[0].segments.map(s => s.tile * 2 + s.arc).sort((a, b) => a - b), [1, 3, 4, 6]);
  assert.deepEqual(result.loops[0].endpoints, []);
  assert.equal(verify([0, 1, 1, 0], 2).loops.length, 0);
});

test('single tiles have two open arcs and four exact boundary endpoints', () => {
  for (const orientation of [0, 1]) {
    const result = verify([orientation], 1);
    assert.equal(result.components.length, 2);
    assert.equal(result.longestLoop, 0);
    assert.deepEqual(result.components[0].endpoints, pairs[orientation][0].map(edge => ({ tile: 0, edge: directions[edge] })));
  }
});

test('seed generation is repeatable, local, and returns fresh flat arrays', () => {
  for (const seed of [0, 1, -1, 4294967295, '', 'loop', '环路']) {
    const board = model.createBoard(seed);
    assert.equal(board.length, 64);
    assert.ok(board.every(value => value === 0 || value === 1));
    assert.deepEqual(model.createBoard(seed), board);
    assert.notEqual(model.createBoard(seed), board);
    assert.equal(verify(board, 8).components.reduce((n, c) => n + c.length, 0), 128);
  }
  assert.notDeepEqual(model.createBoard('a'), model.createBoard('b'));
  assert.equal(model.createBoard('general', 5).length, 25);
});

test('rotation is immutable and two rotations are the identity at every tile', () => {
  const board = Object.freeze(model.createBoard('rotate'));
  for (let index = 0; index < board.length; index += 1) {
    const rotated = model.rotate(board, index);
    assert.notEqual(rotated, board);
    assert.equal(rotated[index], 1 - board[index]);
    assert.equal(rotated.filter((value, i) => value !== board[i]).length, 1);
    assert.deepEqual(model.rotate(rotated, index), board);
  }
});

test('challenge is reproducible and rotating 27 completes exactly the center loop', () => {
  const board = model.createChallenge();
  assert.deepEqual(model.createChallenge(), board);
  assert.notEqual(model.createChallenge(), board);
  assert.deepEqual([27, 28, 35, 36].map(i => board[i]), [0, 0, 0, 1]);
  const before = verify(board, 8);
  const after = verify(model.rotate(board, 27), 8);
  const center = [55, 57, 70, 72];
  const isCenter = loop => JSON.stringify(loop.segments.map(s => s.tile * 2 + s.arc).sort((a, b) => a - b)) === JSON.stringify(center);
  assert.ok(!before.loops.some(isCenter));
  assert.ok(after.loops.some(isCenter));
});

test('exhaustive small boards have no endpoint, degree, or connectivity defects', () => {
  for (const size of [1, 2, 3]) {
    for (let mask = 0; mask < 2 ** (size * size); mask += 1) {
      verify(Array.from({ length: size * size }, (_, i) => (mask >>> i) & 1), size);
    }
  }
});

test('all regression seeds across sizes agree with independent port connectivity', () => {
  let revisitsTile = false;
  for (let seed = -128; seed <= 128; seed += 1) {
    for (const size of [1, 2, 3, 5, 8, 12]) {
      const board = model.createBoard(seed, size);
      const result = verify(board, size);
      assert.deepEqual(model.createBoard(seed, size), board);
      revisitsTile ||= result.components.some(c => new Set(c.segments.map(s => s.tile)).size < c.length);
    }
  }
  assert.ok(revisitsTile, 'exercise components that visit both arcs of a tile');
});

test('invalid sizes, orientations, shapes, and rotation indices are rejected', () => {
  for (const size of [0, -1, 1.5, NaN, Infinity, '8']) {
    assert.throws(() => model.createBoard('invalid', size), RangeError);
    assert.throws(() => model.analyze([], size), RangeError);
  }
  for (const board of [null, [], [0, 1, 0], [0, 1, 0, 2], Array(4)]) {
    assert.throws(() => model.analyze(board, 2), TypeError);
  }
  for (const index of [-1, 64, 0.5, NaN, '0']) {
    assert.throws(() => model.rotate(model.createBoard(0), index), RangeError);
  }
});
