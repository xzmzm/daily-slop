(function (root) {
  'use strict';

  // Arc 0 contains N; arc 1 contains S. Edges are clockwise N, E, S, W.
  const PAIRS = [
    [[0, 1], [2, 3]],
    [[0, 3], [2, 1]],
  ];
  const EDGE_NAMES = ['N', 'E', 'S', 'W'];
  const DR = [-1, 0, 1, 0];
  const DC = [0, 1, 0, -1];

  function checkSize(size) {
    if (!Number.isSafeInteger(size) || size < 1) {
      throw new RangeError('size must be a positive safe integer');
    }
  }

  function checkBoard(board, size) {
    checkSize(size);
    if (!Array.isArray(board) || board.length !== size * size) {
      throw new TypeError('board must be a flat size * size orientation array');
    }
    for (let i = 0; i < board.length; i += 1) {
      if (board[i] !== 0 && board[i] !== 1) {
        throw new TypeError('orientations must be 0 or 1');
      }
    }
  }

  // FNV-1a seed hashing followed by Mulberry32; no ambient randomness.
  function createBoard(seed, size = 8) {
    checkSize(size);
    let state = 2166136261;
    const text = String(seed);
    for (let i = 0; i < text.length; i += 1) {
      state = Math.imul(state ^ text.charCodeAt(i), 16777619) >>> 0;
    }
    return Array.from({ length: size * size }, function () {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 31);
    });
  }

  function arcAt(orientation, edge) {
    if (edge === 0) return 0;
    if (edge === 2) return 1;
    return edge === 1 ? orientation : 1 - orientation;
  }

  // segmentComponent[tile * 2 + arc] is the stable component id.
  // loops contains the closed component objects; longestLoop is an arc count.
  // Each boundary endpoint is { tile, edge }, where edge is N/E/S/W.
  function analyze(board, size = 8) {
    checkBoard(board, size);
    const segmentComponent = Array(board.length * 2).fill(-1);
    const components = [];
    const loops = [];
    let longestLoop = 0;

    for (let start = 0; start < segmentComponent.length; start += 1) {
      if (segmentComponent[start] !== -1) continue;
      const id = components.length;
      const segments = [];
      const endpoints = [];
      const pending = [start];
      segmentComponent[start] = id;
      while (pending.length) {
        const segment = pending.pop();
        const tile = Math.floor(segment / 2);
        const arc = segment % 2;
        segments.push({ tile, arc });
        const row = Math.floor(tile / size);
        const col = tile % size;
        for (const edge of PAIRS[board[tile]][arc]) {
          const nr = row + DR[edge];
          const nc = col + DC[edge];
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) {
            endpoints.push({ tile, edge: EDGE_NAMES[edge] });
            continue;
          }
          const neighbor = nr * size + nc;
          const next = neighbor * 2 + arcAt(board[neighbor], (edge + 2) % 4);
          if (segmentComponent[next] === -1) {
            segmentComponent[next] = id;
            pending.push(next);
          }
        }
      }
      const component = {
        id,
        closed: endpoints.length === 0,
        segments,
        length: segments.length,
        endpoints,
      };
      components.push(component);
      if (component.closed) {
        loops.push(component);
        longestLoop = Math.max(longestLoop, component.length);
      }
    }
    return { components, segmentComponent, loops, longestLoop };
  }

  function rotate(board, index) {
    if (!Array.isArray(board)) throw new TypeError('board must be an array');
    if (!Number.isInteger(index) || index < 0 || index >= board.length) {
      throw new RangeError('index must identify a tile');
    }
    if (board[index] !== 0 && board[index] !== 1) {
      throw new TypeError('orientations must be 0 or 1');
    }
    const result = board.slice();
    result[index] = 1 - result[index];
    return result;
  }

  // Fixed 8x8 challenge: rotate tile 27 to close the central four-arc loop.
  function createChallenge() {
    const board = createBoard('loop-tiles-center', 8);
    board[27] = 0;
    board[28] = 0;
    board[35] = 0;
    board[36] = 1;
    return board;
  }

  const api = Object.freeze({ createBoard, analyze, rotate, createChallenge });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LoopModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
