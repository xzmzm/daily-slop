// render.js — draws the four-quadrant draft grid and the woven cloth preview.

import { ENDS, PICKS, PALETTE, isWarpUp } from './draft.js';

export const CELL = 14;
const GAP = 1;      // blank cells between quadrants
const BAR = 1;      // colour bars are one cell thick

// Geometry of the draft grid, in cell units. Everything downstream — drawing
// and hit-testing — reads these, so the two can never drift apart.
export function layout(d) {
  const threadTop = BAR;
  const drawTop = threadTop + d.shafts + GAP;
  return {
    warpBar: { x: 0, y: 0, w: ENDS, h: BAR },
    threading: { x: 0, y: threadTop, w: ENDS, h: d.shafts },
    tieup: { x: ENDS + GAP, y: threadTop, w: d.treadles, h: d.shafts },
    drawdown: { x: 0, y: drawTop, w: ENDS, h: PICKS },
    treadling: { x: ENDS + GAP, y: drawTop, w: d.treadles, h: PICKS },
    weftBar: { x: ENDS + GAP + d.treadles + GAP, y: drawTop, w: BAR, h: PICKS },
    cols: ENDS + GAP + d.treadles + GAP + BAR,
    rows: drawTop + PICKS,
  };
}

function hit(box, cx, cy) {
  return cx >= box.x && cx < box.x + box.w && cy >= box.y && cy < box.y + box.h;
}

// Which quadrant did a pixel land in, and at which index?
export function pick(d, px, py, dpr = 1) {
  const L = layout(d);
  const cx = Math.floor(px / CELL);
  const cy = Math.floor(py / CELL);
  if (hit(L.warpBar, cx, cy)) return { zone: 'warpBar', end: cx };
  if (hit(L.threading, cx, cy))
    // shaft 1 sits on the row nearest the drawdown, as on paper
    return { zone: 'threading', end: cx, shaft: L.threading.y + L.threading.h - 1 - cy };
  if (hit(L.tieup, cx, cy))
    return { zone: 'tieup', treadle: cx - L.tieup.x, shaft: L.tieup.y + L.tieup.h - 1 - cy };
  if (hit(L.treadling, cx, cy)) return { zone: 'treadling', pick: cy - L.treadling.y, treadle: cx - L.treadling.x };
  if (hit(L.weftBar, cx, cy)) return { zone: 'weftBar', pick: cy - L.weftBar.y };
  if (hit(L.drawdown, cx, cy)) return { zone: 'drawdown', end: cx, pick: cy - L.drawdown.y };
  return null;
}

const INK = '#1b2430';
const GRID = '#cfc4b4';
const GRID_STRONG = '#9c8d78';
const PAPER = '#fbf7ef';

function cellRect(ctx, x, y, inset = 0) {
  ctx.fillRect(x * CELL + inset, y * CELL + inset, CELL - inset * 2, CELL - inset * 2);
}

function gridLines(ctx, box, step = 4) {
  const x0 = box.x * CELL;
  const y0 = box.y * CELL;
  const x1 = (box.x + box.w) * CELL;
  const y1 = (box.y + box.h) * CELL;
  for (let i = 0; i <= box.w; i++) {
    const x = x0 + i * CELL;
    ctx.strokeStyle = i % step === 0 ? GRID_STRONG : GRID;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y0);
    ctx.lineTo(x + 0.5, y1);
    ctx.stroke();
  }
  for (let j = 0; j <= box.h; j++) {
    const y = y0 + j * CELL;
    ctx.strokeStyle = j % step === 0 ? GRID_STRONG : GRID;
    ctx.beginPath();
    ctx.moveTo(x0, y + 0.5);
    ctx.lineTo(x1, y + 0.5);
    ctx.stroke();
  }
}

export function drawDraft(canvas, d, hover) {
  const L = layout(d);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = L.cols * CELL;
  const h = L.rows * CELL;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 1;

  // --- warp colour bar
  for (let e = 0; e < ENDS; e++) {
    ctx.fillStyle = PALETTE[d.warpColor[e]];
    cellRect(ctx, L.warpBar.x + e, L.warpBar.y);
  }
  // --- weft colour bar
  for (let p = 0; p < PICKS; p++) {
    ctx.fillStyle = PALETTE[d.weftColor[p]];
    cellRect(ctx, L.weftBar.x, L.weftBar.y + p);
  }

  // --- threading, tie-up, treadling, drawdown backgrounds
  for (const box of [L.threading, L.tieup, L.treadling, L.drawdown, L.warpBar, L.weftBar]) {
    ctx.fillStyle = PAPER;
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillRect(box.x * CELL, box.y * CELL, box.w * CELL, box.h * CELL);
    ctx.globalCompositeOperation = 'source-over';
  }

  // --- drawdown: filled square = warp end lifted over the weft
  for (let p = 0; p < PICKS; p++) {
    for (let e = 0; e < ENDS; e++) {
      const up = isWarpUp(d, e, p);
      ctx.fillStyle = up ? PALETTE[d.warpColor[e]] : PALETTE[d.weftColor[p]];
      cellRect(ctx, L.drawdown.x + e, L.drawdown.y + p);
    }
  }

  // --- threading marks
  ctx.fillStyle = INK;
  for (let e = 0; e < ENDS; e++) {
    const row = L.threading.y + L.threading.h - 1 - d.threading[e];
    cellRect(ctx, L.threading.x + e, row, 2);
  }
  // --- tie-up marks (circles, the way tie-ups are conventionally drawn)
  for (let t = 0; t < d.treadles; t++) {
    for (let s = 0; s < d.shafts; s++) {
      if (!d.tieup[t][s]) continue;
      const row = L.tieup.y + L.tieup.h - 1 - s;
      ctx.beginPath();
      ctx.arc((L.tieup.x + t + 0.5) * CELL, (row + 0.5) * CELL, CELL * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // --- treadling marks
  for (let p = 0; p < PICKS; p++) cellRect(ctx, L.treadling.x + d.treadling[p], L.treadling.y + p, 2);

  // --- grids on top
  gridLines(ctx, L.threading);
  gridLines(ctx, L.tieup, 2);
  gridLines(ctx, L.treadling, 2);
  gridLines(ctx, L.drawdown);
  gridLines(ctx, L.warpBar);
  gridLines(ctx, L.weftBar);

  // --- hover crosshair, so you can trace an end down into the cloth
  if (hover) {
    ctx.fillStyle = 'rgba(184, 68, 47, 0.16)';
    if (hover.end != null) ctx.fillRect(hover.end * CELL, 0, CELL, h);
    if (hover.pick != null) ctx.fillRect(0, (L.drawdown.y + hover.pick) * CELL, w, CELL);
    if (hover.zone === 'tieup' || hover.zone === 'treadling') {
      const t = hover.treadle;
      if (t != null) ctx.fillRect((L.tieup.x + t) * CELL, 0, CELL, h);
    }
  }
  return { w, h };
}

/* ------------------------------------------------------------------- cloth */

// Draw the interlacement as yarn: each float becomes one rounded capsule, so a
// 1/3 twill really does look like long shiny diagonals rather than checkers.
function capsule(ctx, x, y, w, h, color, vertical) {
  const r = Math.min(w, h) * 0.42;
  const g = vertical
    ? ctx.createLinearGradient(x, 0, x + w, 0)
    : ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(color, -0.3));
  g.addColorStop(0.35, shade(color, 0.14));
  g.addColorStop(0.62, color);
  g.addColorStop(1, shade(color, -0.34));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function shade(hex, amt) {
  const m = /^#(\w\w)(\w\w)(\w\w)$/.exec(hex);
  const ch = [1, 2, 3].map((i) => {
    let v = parseInt(m[i], 16);
    v = amt >= 0 ? v + (255 - v) * amt : v * (1 + amt);
    return Math.max(0, Math.min(255, Math.round(v)));
  });
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
}

// Runs of equal booleans in a cyclic sequence, expressed as [start, length].
function runs(seq, want) {
  const n = seq.length;
  const out = [];
  let i = 0;
  while (i < n) {
    if (seq[i] !== want) { i++; continue; }
    let j = i;
    while (j < n && seq[j] === want) j++;
    out.push([i, j - i]);
    i = j;
  }
  return out;
}

export function drawCloth(canvas, d, reps = 2) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = canvas.clientWidth || 420;
  const cols = ENDS * reps;
  const rows = PICKS * reps;
  const s = size / cols;
  const h = rows * s;
  canvas.width = size * dpr;
  canvas.height = h * dpr;
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = '#2a2118';
  ctx.fillRect(0, 0, size, h);

  const grid = [];
  for (let p = 0; p < rows; p++) {
    const row = [];
    for (let e = 0; e < cols; e++) row.push(isWarpUp(d, e, p));
    grid.push(row);
  }

  // weft floats first (they sit under the raised warp)
  const over = 0.22 * s;
  for (let p = 0; p < rows; p++) {
    for (const [start, len] of runs(grid[p], false)) {
      capsule(ctx, start * s - over, p * s + s * 0.06, len * s + over * 2, s * 0.88,
        PALETTE[d.weftColor[p % PICKS]], false);
    }
  }
  // then warp floats on top
  for (let e = 0; e < cols; e++) {
    const col = grid.map((row) => row[e]);
    for (const [start, len] of runs(col, true)) {
      capsule(ctx, e * s + s * 0.06, start * s - over, s * 0.88, len * s + over * 2,
        PALETTE[d.warpColor[e % ENDS]], true);
    }
  }

  // repeat boundary, faint — shows where the pattern starts over
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(ENDS * s, 0); ctx.lineTo(ENDS * s, h);
  ctx.moveTo(0, PICKS * s); ctx.lineTo(size, PICKS * s);
  ctx.stroke();
  ctx.setLineDash([]);
}
