// No Overlap — layout engine for the Windows 1.0 tiling rule (10 Nov 1983).
// Pure model: no DOM. All rectangles are fractions of the tiling area (0..1).
// Adjacent tiles share exact edges, so "no overlap" can be asserted with
// strict comparisons.
//
// Layout (1983 rules): the current window takes the big top-left tile; the
// remaining open windows fill a full-height column on the right (k rows) and
// a row along the bottom-left (m columns), k = ceil(n/2).
// rightFracs  — inner boundaries of the right column, relative to its height (0..1).
// bottomFracs — inner boundaries of the bottom row, absolute desktop x (0..colFrac).
const NoOverlapModel = (() => {
  'use strict';

  const APPS = [
    { id: 'dos', name: 'MS-DOS Executive' },
    { id: 'clock', name: 'Clock' },
    { id: 'notepad', name: 'Notepad' },
    { id: 'calc', name: 'Calculator' },
    { id: 'calendar', name: 'Calendar' },
  ];

  const DEFAULTS = { colFrac: 0.62, rowFrac: 0.68 };
  const LIMITS = {
    col: [0.30, 0.82],      // left column width
    row: [0.30, 0.86],      // current window height inside the left column
    rightMin: 0.12,         // minimum right-column row height (relative)
    bottomMin: 0.18,        // minimum bottom-row column width (absolute)
    floatMin: 0.20,         // floating window minimum width/height (1987 rules)
  };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function initialState() {
    return {
      mode: 'tile',            // 'tile' = 1.0 rules (1983) | 'overlap' = 2.0 rules (1987)
      currentId: 'dos',
      zoomed: false,
      wins: Object.fromEntries(APPS.map(a => [a.id, { iconified: false, float: null }])),
      colFrac: DEFAULTS.colFrac,
      rowFrac: DEFAULTS.rowFrac,
      rightFracs: [],
      bottomFracs: [],
      zTop: 10,
      zOrder: {},              // id -> z in overlap mode
    };
  }

  function openIds(state) {
    return APPS.map(a => a.id).filter(id => !state.wins[id].iconified);
  }

  function equalRight(count) {
    return Array.from({ length: Math.max(0, count - 1) }, (_, i) => (i + 1) / count);
  }

  function equalBottom(count, colFrac) {
    return Array.from({ length: Math.max(0, count - 1) }, (_, i) => ((i + 1) / count) * colFrac);
  }

  // Keep stored inner boundaries consistent with the current pane counts.
  // A mismatch (different number of panes) resets them to equal splits.
  function ensureFracs(state, rightRows, bottomCols) {
    if (state.rightFracs.length !== Math.max(0, rightRows - 1)) state.rightFracs = equalRight(rightRows);
    if (state.bottomFracs.length !== Math.max(0, bottomCols - 1)) state.bottomFracs = equalBottom(bottomCols, state.colFrac);
  }

  function openSplit(state) {
    const open = openIds(state);
    const cur = open.includes(state.currentId) ? state.currentId : open[0];
    const others = open.filter(id => id !== cur);
    const k = Math.ceil(others.length / 2);
    return { open, cur, others, k, m: others.length - k };
  }

  function tileRects(state) {
    const { cur, others, k, m } = openSplit(state);
    const rects = {};
    if (!cur) return { rects, cur: null };
    if (state.zoomed || others.length === 0) {
      rects[cur] = { l: 0, t: 0, w: 1, h: 1 };
      return { rects, cur };
    }
    ensureFracs(state, k, m);
    rects[cur] = { l: 0, t: 0, w: state.colFrac, h: state.rowFrac };
    const rowStarts = [0, ...state.rightFracs.slice(0, k - 1), 1];
    rowStarts.slice(0, -1).forEach((top, i) => {
      rects[others[i]] = { l: state.colFrac, t: top, w: 1 - state.colFrac, h: rowStarts[i + 1] - top };
    });
    const colStarts = [0, ...state.bottomFracs.slice(0, m - 1), state.colFrac];
    colStarts.slice(0, -1).forEach((left, i) => {
      rects[others[k + i]] = { l: left, t: state.rowFrac, w: colStarts[i + 1] - left, h: 1 - state.rowFrac };
    });
    return { rects, cur };
  }

  // Sash geometry, same units as the rects.
  function sashes(state) {
    if (state.mode !== 'tile' || state.zoomed) return [];
    const { cur, others, k, m } = openSplit(state);
    if (!cur || others.length === 0) return [];
    ensureFracs(state, k, m);
    const list = [
      { id: 'col', kind: 'main-col', index: 0, orient: 'v', x: state.colFrac, y: 0, len: 1 },
      { id: 'row', kind: 'main-row', index: 0, orient: 'h', x: 0, y: state.rowFrac, len: state.colFrac },
    ];
    state.rightFracs.slice(0, k - 1).forEach((b, i) => {
      list.push({ id: `right-${i}`, kind: 'right', index: i, orient: 'h', x: state.colFrac, y: b, len: 1 - state.colFrac });
    });
    state.bottomFracs.slice(0, m - 1).forEach((b, i) => {
      list.push({ id: `bottom-${i}`, kind: 'bottom', index: i, orient: 'v', x: b, y: state.rowFrac, len: 1 - state.rowFrac });
    });
    return list;
  }

  // Drag a sash by `d` (fraction of the desktop, same scale for both axes).
  function dragSash(state, kind, index, d) {
    const { cur, others, k, m } = openSplit(state);
    if (!cur || others.length === 0) return null;
    ensureFracs(state, k, m);
    if (kind === 'main-col') {
      const before = state.colFrac;
      state.colFrac = clamp(state.colFrac + d, LIMITS.col[0], LIMITS.col[1]);
      const scale = state.colFrac / before;   // keep the bottom row's proportions
      state.bottomFracs = state.bottomFracs.map(b => b * scale);
      return state.colFrac;
    }
    if (kind === 'main-row') {
      state.rowFrac = clamp(state.rowFrac + d, LIMITS.row[0], LIMITS.row[1]);
      return state.rowFrac;
    }
    if (kind === 'right') {
      const fracs = state.rightFracs;
      if (index >= fracs.length) return null;
      const min = LIMITS.rightMin;
      const lo = index > 0 ? fracs[index - 1] : min;
      const hi = index < fracs.length - 1 ? fracs[index + 1] : 1 - min;
      fracs[index] = clamp(fracs[index] + d, lo, hi);
      return fracs[index];
    }
    if (kind === 'bottom') {
      const fracs = state.bottomFracs;
      if (index >= fracs.length) return null;
      const min = LIMITS.bottomMin;
      const lo = index > 0 ? fracs[index - 1] : min;
      const hi = index < fracs.length - 1 ? fracs[index + 1] : state.colFrac - min;
      fracs[index] = clamp(fracs[index] + d, lo, hi);
      return fracs[index];
    }
    return null;
  }

  function resetSashes(state) {
    state.colFrac = DEFAULTS.colFrac;
    state.rowFrac = DEFAULTS.rowFrac;
    const { cur, others, k, m } = openSplit(state);
    state.rightFracs = equalRight(k);
    state.bottomFracs = equalBottom(m, state.colFrac);
  }

  function makeCurrent(state, id) {
    if (!state.wins[id]) return null;
    state.zoomed = false;
    state.wins[id].iconified = false;
    state.currentId = id;
    if (state.mode === 'overlap') state.zOrder[id] = ++state.zTop;
    return id;
  }

  function iconify(state, id) {
    if (state.mode !== 'tile' || !state.wins[id] || state.wins[id].iconified) return false;
    state.wins[id].iconified = true;
    if (state.currentId === id) {
      const open = openIds(state);
      if (open.length) state.currentId = open[0];
    }
    return true;
  }

  function uniconify(state, id) {
    if (!state.wins[id] || !state.wins[id].iconified) return false;
    state.wins[id].iconified = false;
    return makeCurrent(state, id) !== null;
  }

  function setZoom(state, on) {
    if (state.mode !== 'tile') return false;
    if (on) {
      const open = openIds(state);
      if (open.length < 2) return false;
      open.forEach(id => { if (id !== state.currentId) state.wins[id].iconified = true; });
    }
    state.zoomed = on;
    return true;
  }

  function setMode(state, mode) {
    if (mode !== 'tile' && mode !== 'overlap') return null;
    state.mode = mode;
    state.zoomed = false;
    Object.values(state.wins).forEach(w => { w.iconified = false; });
    if (mode === 'overlap') {
      const open = openIds(state);
      open.forEach((id, i) => {
        state.wins[id].float = { l: 0.02 + 0.17 * i, t: 0.03 + 0.15 * i, w: 0.30, h: 0.36 };
        state.zOrder[id] = ++state.zTop;
      });
    }
    resetSashes(state);
    return state.mode;
  }

  // 1987 rules: free floating rectangles, clamped inside the desktop.
  function floatRects(state) {
    return openIds(state).map(id => ({ id, rect: { ...state.wins[id].float } }));
  }

  function floatMove(state, id, l, t) {
    const f = state.wins[id] && state.wins[id].float;
    if (!f || state.mode !== 'overlap') return false;
    f.l = clamp(l, 0, 1 - f.w);
    f.t = clamp(t, 0, 1 - f.h);
    return true;
  }

  function raise(state, id) {
    state.zOrder[id] = ++state.zTop;
    return state.zOrder[id];
  }

  function zOf(state, id) {
    return state.zOrder[id] || 10;
  }

  // Overlapping open-window pairs (0 pairs whenever tiles are used).
  function overlapPairs(state) {
    if (state.mode !== 'overlap') return { count: 0, clashing: [] };
    const items = floatRects(state);
    let count = 0;
    const clashing = new Set();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i].rect, b = items[j].rect;
        if (a.l < b.l + b.w && b.l < a.l + a.w && a.t < b.t + b.h && b.t < a.t + a.h) {
          count++;
          clashing.add(items[i].id); clashing.add(items[j].id);
        }
      }
    }
    return { count, clashing: [...clashing] };
  }

  // Pairwise-disjoint check used by the tests: true = nothing overlaps.
  function disjoint(rects) {
    const ids = Object.keys(rects);
    const EPS = 1e-9;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = rects[ids[i]], b = rects[ids[j]];
        if (a.l < b.l + b.w - EPS && b.l < a.l + a.w - EPS &&
            a.t < b.t + b.h - EPS && b.t < a.t + a.h - EPS) return false;
      }
    }
    return true;
  }

  return {
    APPS, DEFAULTS, LIMITS, initialState, openIds, tileRects, sashes, dragSash,
    resetSashes, makeCurrent, iconify, uniconify, setZoom, setMode,
    floatRects, floatMove, raise, zOf, overlapPairs, disjoint, clamp,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NoOverlapModel;
