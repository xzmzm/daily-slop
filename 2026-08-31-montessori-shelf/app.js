// app.js — Montessori's Shelf studio.
// The bench is a pure function of the simulation clock: window.__demo.step(dt)
// advances every flight, so the same code drives live play and the video
// renderer. All arithmetic lives in materials.js and is exact.

import * as M from "./materials.js";

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-US");
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeOut = (u) => 1 - (1 - u) ** 2.2;

const CAT = M.CATS;
const CAT_ORDER = [4, 3, 2, 1, 0]; // tenK … unit, left to right on the mat
const LIFT = 46;

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------
const state = {
  a: 3567, b: 2795,
  phase: "idle", // idle → laying → laid → combining → combined → exchanging → done
  phaseSince: 0,
  queue: [],      // pending actions
  action: null,   // active action
  pieces: [],     // live bead pieces {cat, x, y, from, to, delay, t0, dur, state}
  counts: M.zeroCounts(),
  exchanges: 0,
  clock: 0,
  speed: 1,
  auto: true,
  videoMode: false,
  tab: "tower",
  towerN: 10,
  cubeMode: "binomial",
  explode: 0,
};

const PHASE_CN = {
  idle: "○ 待摆盘", laying: "◐ 摆盘中…", laid: "◑ 已摆盘 · 可合并",
  combining: "◐ 合并中…", combined: "◑ 已合并 · 可去银行",
  exchanging: "◐ 兑换中…", done: "● 完成 · 答案在毯上",
};

// ---------------------------------------------------------------------------
// bench geometry
// ---------------------------------------------------------------------------
const bench = $("bench");
const bctx = bench.getContext("2d");
let BW = 1180; // css pixels, refreshed on resize

function resizeBench() {
  const dpr = window.devicePixelRatio || 1;
  BW = bench.clientWidth || 1180;
  bench.width = Math.round(BW * dpr);
  bench.height = Math.round(560 * dpr);
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const SHELF = { y0: 26, y1: 116 };
const BAND_A = { y0: 148, y1: 306 };
const BAND_B = { y0: 328, y1: 480 };
const LABEL_Y = 506;

function zoneRect(catIdx) {
  const m0 = 36, m1 = BW - 36;
  const zoneW = (m1 - m0) / 5;
  const pos = CAT_ORDER.indexOf(catIdx);
  return { x0: m0 + pos * zoneW + 16, x1: m0 + (pos + 1) * zoneW - 16 };
}

function zoneCX(catIdx) {
  const r = zoneRect(catIdx);
  return (r.x0 + r.x1) / 2;
}

// positions (sprite centers) for n pieces of a category inside a band
function layoutPositions(catIdx, n, band) {
  const cx = zoneCX(catIdx);
  const pts = [];
  if (catIdx === 0) {
    const per = 9, pitch = 20;
    for (let i = 0; i < n; i += 1) {
      const row = Math.floor(i / per), col = i % per;
      const rowLen = Math.min(per, n - row * per);
      pts.push({ x: cx - ((rowLen - 1) * pitch) / 2 + col * pitch, y: band.y0 + 34 + row * pitch });
    }
  } else if (catIdx === 1) {
    for (let i = 0; i < n; i += 1) {
      const col = i % 2, row = Math.floor(i / 2);
      pts.push({ x: cx - 31 + col * 62, y: band.y0 + 24 + row * 15 });
    }
  } else if (catIdx === 2) {
    // hundred squares fan out as a countable diagonal deck
    const dx = n > 10 ? 8 : 12;
    const dy = n > 10 ? -4.5 : -5.5;
    for (let i = 0; i < n; i += 1) pts.push({ x: cx - 26 + i * dx, y: band.y0 + 64 - i * dy });
  } else {
    // thousand cubes in brick-offset rows of three — every cube countable
    for (let i = 0; i < n; i += 1) {
      const col = i % 3, row = Math.floor(i / 3);
      pts.push({ x: cx - 58 + col * 60 + (row % 2) * 30, y: band.y1 - 36 - row * 64 });
    }
  }
  return pts;
}

function teller() { return { x: BW - 96, y: SHELF.y0 + 40 }; }

// ---------------------------------------------------------------------------
// sprites (drawn once into offscreen canvases)
// ---------------------------------------------------------------------------
function spriteCanvas(w, h, draw) {
  const dpr = window.devicePixelRatio || 1;
  const c = document.createElement("canvas");
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const g = c.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw(g);
  return c;
}

function beadDot(g, x, y, r, top, side) {
  const grad = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
  grad.addColorStop(0, top);
  grad.addColorStop(1, side);
  g.fillStyle = grad;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

const GOLD = { top: "#f4dc95", mid: "#dcaf4e", dark: "#a87c22", rim: "#7a5814" };

function makeSprites() {
  const sprites = {};
  sprites[0] = spriteCanvas(20, 20, (g) => {
    beadDot(g, 10, 10, 8.5, GOLD.top, GOLD.dark);
    g.strokeStyle = GOLD.rim; g.lineWidth = 1;
    g.beginPath(); g.arc(10, 10, 8.5, 0, Math.PI * 2); g.stroke();
  });
  sprites[1] = spriteCanvas(58, 13, (g) => {
    g.strokeStyle = "#6d5326"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(3, 6.5); g.lineTo(55, 6.5); g.stroke();
    for (let i = 0; i < 10; i += 1) beadDot(g, 3.4 + i * 5.2, 6.5, 4.3, GOLD.top, GOLD.mid);
  });
  sprites[2] = spriteCanvas(56, 56, (g) => {
    const pitch = 5.2, r = 1.9;
    for (let row = 0; row < 10; row += 1) {
      g.strokeStyle = "rgba(122,88,20,0.32)"; g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(2, 2.6 + row * pitch); g.lineTo(54, 2.6 + row * pitch); g.stroke();
      for (let col = 0; col < 10; col += 1) {
        beadDot(g, 2.6 + col * pitch + 1.3, 2.6 + row * pitch + 1.3, r, GOLD.mid, GOLD.dark);
      }
    }
    g.strokeStyle = GOLD.rim; g.lineWidth = 1.1;
    g.strokeRect(0.5, 0.5, 55, 55);
  });
  sprites[3] = spriteCanvas(56, 62, (g) => {
    // a clean isometric thousand-cube; 5×5 bead dots hint at the hundred-squares inside
    const e = 31, ox = 28, oy = 58;
    const X = { x: 0.866, y: 0.5 }, Y = { x: -0.866, y: 0.5 }, Z = { x: 0, y: -1 };
    const P = (i, j, k) => ({ x: ox + i * X.x * e + j * Y.x * e, y: oy + i * X.y * e + j * Y.y * e - k * e });
    const poly = (pts, fill) => {
      g.beginPath();
      pts.forEach((p, idx) => (idx ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.closePath(); g.fillStyle = fill; g.fill();
      g.strokeStyle = GOLD.rim; g.lineWidth = 1; g.stroke();
    };
    poly([P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)], "#e9c065");
    poly([P(1, 0, 0), P(1, 1, 0), P(1, 1, 1), P(1, 0, 1)], "#a87c22");
    poly([P(0, 1, 0), P(1, 1, 0), P(1, 1, 1), P(0, 1, 1)], "#c89a3a");
    g.fillStyle = "rgba(122,88,20,0.55)";
    for (let a = 0; a <= 4; a += 1) for (let b2 = 0; b2 <= 4; b2 += 1) {
      [[P(a / 4, b2 / 4, 1), 1], [P(1, a / 4, b2 / 4), 0.9], [P(a / 4, 1, b2 / 4), 0.9]].forEach(([p, r]) => {
        g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
      });
    }
  });
  sprites[4] = sprites[3];
  return sprites;
}
let SPRITES = makeSprites();

// ---------------------------------------------------------------------------
// piece flight engine
// ---------------------------------------------------------------------------
function spawnPiece(catIdx, from, to, delay, dur) {
  const p = {
    cat: catIdx, x: from.x, y: from.y, from: { ...from }, to: { ...to },
    delay, t0: 0, dur: dur ?? 0.55, state: delay > 0 ? "waiting" : "flying",
  };
  if (p.state === "flying") p.t0 = state.clock;
  state.pieces.push(p);
  return p;
}

function retarget(p, to, delay, dur) {
  p.from = { x: p.x, y: p.y };
  p.to = { ...to };
  p.delay = delay ?? 0;
  p.t0 = state.clock;
  p.dur = dur ?? 0.5;
  p.state = p.delay > 0 ? "waiting" : "flying";
  if (p.state === "flying") p.t0 = state.clock;
}

function stepPieces(dt) {
  for (const p of state.pieces) {
    if (p.state === "waiting") {
      p.delay -= dt;
      if (p.delay <= 0) { p.state = "flying"; p.t0 = state.clock; p.from = { x: p.x, y: p.y }; }
    }
    if (p.state === "flying") {
      const u = clamp((state.clock - p.t0) / p.dur, 0, 1);
      const e = easeOut(u);
      p.x = p.from.x + (p.to.x - p.from.x) * e;
      p.y = p.from.y + (p.to.y - p.from.y) * e - Math.sin(Math.PI * u) * LIFT;
      if (u >= 1) { p.state = "rest"; p.x = p.to.x; p.y = p.to.y; }
    }
  }
}

const allResting = () => state.pieces.every((p) => p.state === "rest" || p.state === "bank");

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------
function countsForNumber(n) {
  const c = M.zeroCounts();
  c.unit = n % 10; c.ten = Math.floor(n / 10) % 10;
  c.hundred = Math.floor(n / 100) % 10; c.thousand = Math.floor(n / 1000) % 10;
  return c;
}

function enqueue(action) { state.queue.push(action); }

function startLay(which) {
  const n = which === "a" ? state.a : state.b;
  const counts = countsForNumber(n);
  const band = which === "a" ? BAND_A : BAND_B;
  const src = teller();
  CAT_ORDER.slice().reverse().forEach((catIdx) => {
    const key = CAT[catIdx].key;
    const pts = layoutPositions(catIdx, counts[key], band);
    pts.forEach((pt, i) => { spawnPiece(catIdx, src, pt, i * 0.045 + catIdx * 0.02); });
    state.counts[key] += counts[key];
  });
  state.phase = "laying"; state.phaseSince = state.clock;
}

function startCombine() {
  // merged layout in the top band for the current counts
  const sorted = CAT_ORDER.slice().reverse();
  const byCat = new Map();
  for (const p of state.pieces) {
    if (!byCat.has(p.cat)) byCat.set(p.cat, []);
    byCat.get(p.cat).push(p);
  }
  let delayIdx = 0;
  for (const catIdx of sorted) {
    const list = byCat.get(catIdx) || [];
    const pts = layoutPositions(catIdx, list.length, BAND_A);
    list.forEach((p, i) => {
      const moved = Math.abs(p.to.y - pts[i].y) > 8;
      retarget(p, pts[i], moved ? delayIdx * 0.05 : 0, moved ? 0.5 : 0.25);
      if (moved) delayIdx += 1;
    });
  }
  state.phase = "combining"; state.phaseSince = state.clock;
}

function startGroup(fromIdx, toIdx) {
  const list = state.pieces
    .filter((p) => p.cat === fromIdx && p.state === "rest")
    .sort((p, q) => q.x - p.x || q.y - p.y)
    .slice(0, 10);
  // each traded group parks as its own tidy 5×2 cluster on the bank shelf
  // (pieces draw at 0.62 scale once banked, so pitch to that size)
  const clusterIdx = state.exchanges;
  const pitch = { 0: [16, 16], 1: [40, 24], 2: [38, 38], 3: [40, 42], 4: [40, 42] }[fromIdx];
  const baseY = { 0: 20, 1: 26, 2: 20, 3: 16, 4: 16 }[fromIdx];
  const base = { x: 76 + clusterIdx * 210, y: SHELF.y0 + baseY };
  list.forEach((p, i) => {
    const slot = {
      x: base.x + (i % 5) * pitch[0],
      y: base.y + Math.floor(i / 5) * pitch[1],
    };
    retarget(p, slot, i * 0.035, 0.55);
    p.shelfBound = true;
  });
  state.counts[CAT[fromIdx].key] -= 10;
  state.counts[CAT[toIdx].key] += 1;
  state.phase = "exchanging"; state.phaseSince = state.clock;
  return { list, fromIdx, toIdx, spawned: null };
}

function stepGroup(group, dt) {
  // bank pieces that arrived at their shelf cluster
  for (const p of state.pieces) {
    if (p.shelfBound && p.state === "rest") { p.state = "bank"; }
  }
  if (!group.spawned && group.list.every((p) => p.state === "bank")) {
    // the new piece flies from the teller to its pile slot
    const remaining = state.pieces.filter((p) => p.cat === group.toIdx && p.state !== "bank");
    const pts = layoutPositions(group.toIdx, remaining.length + 1, BAND_A);
    remaining.forEach((p, i) => retarget(p, pts[i], i * 0.02, 0.28));
    const src = teller();
    const p = spawnPiece(group.toIdx, src, pts[pts.length - 1], 0.12, 0.6);
    group.spawned = p;
    state.exchanges += 1;
  }
  return group.spawned ? group.spawned.state === "rest" : false;
}

function startExchangeAll() {
  const script = M.exchangeScript(state.counts);
  for (const step of script.steps) {
    enqueue({ kind: "group", fromIdx: CAT.findIndex((c) => c.key === step.fromKey), toIdx: CAT.findIndex((c) => c.key === step.toKey) });
  }
  enqueue({ kind: "finish" });
}

function finishBench() {
  state.phase = "done"; state.phaseSince = state.clock;
}

function resetBench(keepNumbers = true) {
  state.pieces = [];
  state.counts = M.zeroCounts();
  state.exchanges = 0;
  state.queue = []; state.action = null;
  state.phase = "idle"; state.phaseSince = state.clock;
}

function stepActions(dt) {
  if (!state.action && state.queue.length > 0) {
    const next = state.queue.shift();
    if (next.kind === "group") state.action = { ...next, group: startGroup(next.fromIdx, next.toIdx) };
    else if (next.kind === "finish") { finishBench(); }
    else if (next.kind === "run") next.run();
  }
  if (state.action) {
    const act = state.action;
    if (act.kind === "group") {
      if (stepGroup(act.group, dt)) state.action = null;
    }
  }
  // phase completion for lay/combine (no queued action object)
  if (!state.action && state.queue.length === 0) {
    if (state.phase === "laying" && allResting() && state.pieces.length > 0) { state.phase = "laid"; state.phaseSince = state.clock; }
    if (state.phase === "combining" && allResting()) { state.phase = "combined"; state.phaseSince = state.clock; }
  }
}

function autoTick() {
  if (!state.auto || state.videoMode) return;
  const idleFor = state.clock - state.phaseSince;
  if (state.phase === "idle" && idleFor > 0.8) { startLay("a"); enqueue({ kind: "wait", until: state.clock + 0.35 }); enqueue({ kind: "run", run: () => startLay("b") }); }
  else if (state.phase === "laid" && idleFor > 1.0) startCombine();
  else if (state.phase === "combined" && idleFor > 0.8) startExchangeAll();
  else if (state.phase === "done" && idleFor > 3.4) resetBench();
}

function step(dt) {
  const d = dt * state.speed;
  state.clock += d;
  // wait actions gate the queue
  if (state.queue.length > 0 && state.queue[0].kind === "wait") {
    if (state.clock >= state.queue[0].until) state.queue.shift();
  }
  stepPieces(d);
  stepActions(d);
  autoTick();
  refreshReadouts();
}

// ---------------------------------------------------------------------------
// bench drawing
// ---------------------------------------------------------------------------
function drawBench() {
  const g = bctx;
  g.clearRect(0, 0, BW, 560);

  // wall + shelf
  g.fillStyle = "#f2e9d4"; g.fillRect(0, 0, BW, 560);
  const shelfGrad = g.createLinearGradient(0, SHELF.y0, 0, SHELF.y1);
  shelfGrad.addColorStop(0, "#9a6a35"); shelfGrad.addColorStop(1, "#7c5226");
  g.fillStyle = shelfGrad;
  roundRect(g, 20, SHELF.y0, BW - 40, SHELF.y1 - SHELF.y0, 10); g.fill();
  g.strokeStyle = "#5f3e1c"; g.lineWidth = 1.5;
  roundRect(g, 20, SHELF.y0, BW - 40, SHELF.y1 - SHELF.y0, 10); g.stroke();
  g.strokeStyle = "rgba(255,240,214,0.16)";
  for (let y = SHELF.y0 + 14; y < SHELF.y1 - 8; y += 14) {
    g.beginPath(); g.moveTo(28, y); g.lineTo(BW - 28, y + 3); g.stroke();
  }
  g.fillStyle = "#f7edd4"; g.font = "700 12px ui-monospace, Menlo, monospace";
  g.fillText("银行 THE BANK · 十个换一个", 34, SHELF.y0 + 18);

  // felt mat
  const matGrad = g.createLinearGradient(0, 132, 0, 496);
  matGrad.addColorStop(0, "#eee1bf"); matGrad.addColorStop(1, "#e3d3ab");
  g.fillStyle = matGrad;
  roundRect(g, 22, 132, BW - 44, 364, 14); g.fill();
  g.strokeStyle = "#cdb98c"; g.lineWidth = 1.5;
  roundRect(g, 22, 132, BW - 44, 364, 14); g.stroke();
  g.strokeStyle = "rgba(160,138,96,0.18)";
  for (let y = 146; y < 490; y += 12) {
    g.beginPath(); g.moveTo(30, y); g.lineTo(BW - 30, y); g.stroke();
  }

  // tray labels + zone underlays
  for (let catIdx of CAT_ORDER) {
    const { x0, x1 } = zoneRect(catIdx);
    const cat = CAT[catIdx];
    g.fillStyle = cat.color + "30";
    roundRect(g, x0 - 6, 138, x1 - x0 + 12, 352, 8); g.fill();
    g.fillStyle = cat.color;
    roundRect(g, (x0 + x1) / 2 - 20, LABEL_Y - 14, 40, 21, 10.5); g.fill();
    g.fillStyle = "#fffdf6"; g.font = "700 13px -apple-system, sans-serif"; g.textAlign = "center";
    g.fillText(cat.label, (x0 + x1) / 2, LABEL_Y + 1);
    g.textAlign = "left";
  }

  // addend labels with per-place colored digits (tray tags at each band's left)
  drawAddendLabel(g, "甲", state.a, 30, BAND_A.y0 + 14);
  drawAddendLabel(g, "乙", state.b, 30, BAND_B.y0 + 14);

  // resting + flying pieces (banked ones drawn small and dim on the shelf)
  const live = state.pieces.filter((p) => p.state !== "bank");
  live.sort((p, q) => (p.state === "flying" ? 1 : 0) - (q.state === "flying" ? 1 : 0));
  for (const p of state.pieces) if (p.state === "bank") drawSprite(g, p, 0.92, 0.62);
  for (const p of live) drawSprite(g, p, 1, 1);

  // the answer cards once done
  if (state.phase === "done") drawAnswerCards(g);
}

function drawSprite(g, p, alpha, scale) {
  const img = SPRITES[p.cat];
  const w = img.width / (window.devicePixelRatio || 1) * scale;
  const h = img.height / (window.devicePixelRatio || 1) * scale;
  g.globalAlpha = alpha;
  g.drawImage(img, p.x - w / 2, p.y - h / 2, w, h);
  g.globalAlpha = 1;
}

function drawAddendLabel(g, tag, n, x, y) {
  g.font = "700 14px -apple-system, sans-serif";
  g.fillStyle = "#7a6446";
  g.fillText(tag, x, y);
  const digits = String(n).padStart(4, "0").split("");
  const placeColors = ["#2e7d53", "#c0504d", "#3f7fb8", "#3f9d63"]; // k h t u
  let dx = x + 20;
  digits.forEach((d, i) => {
    const col = placeColors[i];
    if (d !== "0" || i === 3) {
      g.fillStyle = col;
      g.font = "700 16px ui-monospace, Menlo, monospace";
      g.fillText(d, dx, y);
    }
    dx += 12;
  });
}

function drawAnswerCards(g) {
  const n = M.valueOf(state.counts);
  const digits = String(n).split("").reverse(); // index = place
  const bandY = BAND_B.y0 + 26;
  const slots = [];
  digits.forEach((d, i) => { if (d !== "0" || n < 10) slots.push({ d, i }); });
  slots.reverse();
  const cardW = 66, cardH = 78;
  const totalW = slots.length * cardW + (slots.length - 1) * 10;
  let x = BW / 2 - totalW / 2;
  for (const s of slots) {
    const cat = CAT[s.i];
    g.fillStyle = "#fffdf6";
    roundRect(g, x, bandY, cardW, cardH, 8); g.fill();
    g.strokeStyle = cat.color; g.lineWidth = 2.2;
    roundRect(g, x, bandY, cardW, cardH, 8); g.stroke();
    g.fillStyle = cat.color; g.textAlign = "center";
    g.font = "800 34px Georgia, serif";
    g.fillText(s.d, x + cardW / 2, bandY + 42);
    g.font = "700 11px -apple-system, sans-serif";
    g.fillText(cat.label + " " + CAT[s.i].value, x + cardW / 2, bandY + 62);
    g.textAlign = "left";
    x += cardW + 10;
  }
  g.fillStyle = "#6f5d44"; g.font = "600 15px -apple-system, sans-serif"; g.textAlign = "center";
  g.fillText(`${fmt(state.a)} + ${fmt(state.b)} = ${fmt(n)}（总值从头到尾没变过）`, BW / 2, bandY + 104);
  g.textAlign = "left";
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---------------------------------------------------------------------------
// readouts + panel
// ---------------------------------------------------------------------------
function refreshReadouts() {
  const v = M.valueOf(state.counts);
  $("ro-value").firstChild.nodeValue = fmt(v);
  $("ro-exchanges").textContent = String(state.exchanges);
  const c = state.counts;
  $("ro-counts").textContent = `${c.unit} / ${c.ten} / ${c.hundred} / ${c.thousand}`;
  const led = M.dynamicAddLedger(state.a, state.b);
  $("ro-sum").textContent = fmt(led.result);
  $("y-merged").textContent = fmt(state.a + state.b);
  $("y-sum").textContent = `${fmt(state.a)} + ${fmt(state.b)} = ${fmt(led.result)}`;
  const chip = $("phase-chip");
  chip.textContent = PHASE_CN[state.phase] ?? state.phase;
  chip.className = "chip" + (state.phase === "done" ? " done" : state.phase.endsWith("ing") ? " busy" : "");
}

function wirePanel() {
  const numA = $("num-a"), numB = $("num-b");
  const readNum = (el) => clamp(Math.round(Number(el.value) || 0), 0, 9999);
  const onNumChange = () => {
    state.a = readNum(numA); state.b = readNum(numB);
    resetBench();
    refreshReadouts();
    buildBankTable();
  };
  [numA, numB].forEach((el) => el.addEventListener("change", onNumChange));
  document.querySelectorAll("button.mini").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = btn.dataset.addend === "a" ? numA : numB;
      el.value = clamp((Number(el.value) || 0) + Number(btn.dataset.d), 0, 9999);
      onNumChange();
    });
  });

  const manual = (fn) => () => { setAuto(false); fn(); };
  $("lay-btn").addEventListener("click", manual(() => {
    if (state.phase !== "idle") return;
    startLay("a");
    enqueue({ kind: "wait", until: state.clock + 0.3 });
    enqueue({ kind: "run", run: () => startLay("b") });
  }));
  $("combine-btn").addEventListener("click", manual(() => {
    if (state.phase === "laid" || state.phase === "combined") startCombine();
  }));
  $("exchange-btn").addEventListener("click", manual(() => {
    if (state.phase === "combined") startExchangeAll();
  }));
  $("reset-btn").addEventListener("click", manual(() => resetBench()));
  $("auto-btn").addEventListener("click", () => setAuto(!state.auto));
  $("speed-range").addEventListener("input", (e) => {
    state.speed = Number(e.target.value);
    $("speed-out").textContent = state.speed.toFixed(1) + "×";
  });
}

function setAuto(on) {
  state.auto = !!on;
  $("auto-btn").classList.toggle("on", state.auto);
}

// ---------------------------------------------------------------------------
// presets
// ---------------------------------------------------------------------------
function renderPresets() {
  const wrap = $("presets");
  wrap.innerHTML = "";
  for (const p of M.PRESETS) {
    const btn = document.createElement("button");
    btn.textContent = p.name;
    btn.title = p.note;
    btn.dataset.preset = p.id;
    btn.addEventListener("click", () => applyPreset(p.id));
    wrap.appendChild(btn);
  }
}

function applyPreset(id) {
  const p = M.PRESETS.find((x) => x.id === id) ?? M.PRESETS[0];
  state.a = p.a; state.b = p.b;
  $("num-a").value = p.a; $("num-b").value = p.b;
  resetBench();
  document.querySelectorAll("#presets button").forEach((b) => b.classList.toggle("on", b.dataset.preset === p.id));
  if (p.tab) setTab(p.tab);
  refreshReadouts();
  buildBankTable();
  if (state.auto) { startLay("a"); enqueue({ kind: "wait", until: state.clock + 0.3 }); enqueue({ kind: "run", run: () => startLay("b") }); }
}

// ---------------------------------------------------------------------------
// tabs
// ---------------------------------------------------------------------------
const TAB_NOTES = {
  tower: "十块立方体的体积总和，恰好是 55 的平方",
  cube: "公式是拿在手里的：八块木头填满 (a+b)³",
  bank: "每一列的进位，就是一次去银行的兑换",
  hist: "从基娅拉瓦莱到今天的 22,000+ 所学校",
};

function setTab(name) {
  state.tab = name;
  document.querySelectorAll("#tabs button[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
  document.querySelectorAll(".tab-body").forEach((el) => el.classList.toggle("hidden", el.id !== `tab-${name}`));
  $("tab-note").textContent = TAB_NOTES[name] ?? "";
  if (name === "tower") drawTowerCharts();
  if (name === "cube") drawCubeTab();
  if (name === "bank") buildBankTable();
}

function wireTabs() {
  document.querySelectorAll("#tabs button[data-tab]").forEach((b) => {
    b.addEventListener("click", () => setTab(b.dataset.tab));
  });
}

// --- tower tab --------------------------------------------------------------
const PINKS = [];
for (let n = 1; n <= 10; n += 1) {
  const t = (n - 1) / 9;
  PINKS.push({
    top: lerpColor("#f3c3d6", "#c05e84", t),
    left: lerpColor("#dd96b1", "#a44a6d", t),
    right: lerpColor("#c17a99", "#8a3c5c", t),
    rim: "#8e4a68",
  });
}
function lerpColor(c1, c2, t) {
  const p = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const a = p(c1), b = p(c2);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

function fitChart(canvas, hCss) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 560;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(hCss * dpr);
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h: hCss };
}

function drawTowerChart() {
  const { g, w, h } = fitChart($("towerChart"), 400);
  g.clearRect(0, 0, w, h);
  const padL = 56, padR = 20, padT = 26, padB = 42;
  const pw = w - padL - padR, ph = h - padT - padB;
  const yMax = 3200;
  const xAt = (n) => padL + ((n - 0.5) / 10) * pw;
  const yAt = (v) => padT + ph - (v / yMax) * ph;

  g.strokeStyle = "#e4d8c0"; g.fillStyle = "#8b7a64"; g.font = "11px ui-monospace, Menlo, monospace"; g.textAlign = "right";
  for (let v = 0; v <= yMax; v += 400) {
    g.beginPath(); g.moveTo(padL, yAt(v)); g.lineTo(w - padR, yAt(v)); g.stroke();
    g.fillText(fmt(v), padL - 8, yAt(v) + 3.5);
  }
  g.textAlign = "center";
  for (let n = 1; n <= 10; n += 1) g.fillText(String(n), xAt(n), h - padB + 16);
  g.fillText("第 n 块（边长 n cm）", padL + pw / 2, h - 8);

  // bars: n³ up to towerN solid, beyond ghost
  const bw = pw / 10 * 0.52;
  for (let n = 1; n <= 10; n += 1) {
    const active = n <= state.towerN;
    g.fillStyle = active ? "#d77fa1" : "rgba(215,127,161,0.22)";
    g.fillRect(xAt(n) - bw / 2, yAt(n ** 3), bw, yAt(0) - yAt(n ** 3));
    if (n ** 3 >= 260 || n === 10) {
      g.fillStyle = active ? "#8a3c5c" : "#c9bda6";
      g.font = "10.5px ui-monospace, Menlo, monospace";
      g.fillText(String(n ** 3), xAt(n), yAt(n ** 3) - 5);
    }
  }

  // cumulative Σn³ and T(n)² — they coincide exactly
  const line = (vals, color, dash) => {
    g.strokeStyle = color; g.lineWidth = 2.4;
    if (dash) g.setLineDash([6, 5]);
    g.beginPath();
    vals.forEach((v, i) => (i ? g.lineTo(xAt(i + 1), yAt(v)) : g.moveTo(xAt(i + 1), yAt(v))));
    g.stroke(); g.setLineDash([]);
  };
  const cum = [], sq = [];
  let acc = 0;
  for (let n = 1; n <= 10; n += 1) { acc += n ** 3; cum.push(acc); sq.push(M.triangular(n) ** 2); }
  line(sq, "rgba(63,157,99,0.9)", true);
  line(cum.slice(0, state.towerN), "#a97e22", false);
  g.fillStyle = "#a97e22";
  for (let n = 1; n <= state.towerN; n += 1) {
    g.beginPath(); g.arc(xAt(n), yAt(cum[n - 1]), 3.4, 0, Math.PI * 2); g.fill();
  }
  const nNow = state.towerN;
  g.fillStyle = "#6b5426"; g.font = "700 13px ui-monospace, Menlo, monospace"; g.textAlign = "left";
  g.fillText(`n = ${nNow}: Σn³ = ${fmt(M.sumCubesNaive(nNow))} = T(${nNow})² = ${fmt(M.triangular(nNow) ** 2)}`, padL + 10, padT + 6);
}

function drawIsoCube(g, ox, oy, s, gx, gy, gz, edgeCm, colors, dots = false) {
  const X = { x: 0.866 * s, y: 0.5 * s }, Y = { x: -0.866 * s, y: 0.5 * s }, Z = { x: 0, y: -s };
  const P = (i, j, k) => ({
    x: ox + (gx + i) * X.x + (gy + j) * Y.x + (gz + k) * Z.x,
    y: oy + (gx + i) * X.y + (gy + j) * Y.y + (gz + k) * Z.y,
  });
  const poly = (pts, fill) => {
    g.beginPath();
    pts.forEach((p, idx) => (idx ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath(); g.fillStyle = fill; g.fill();
    g.strokeStyle = colors.rim; g.lineWidth = 1.1; g.stroke();
  };
  const e = edgeCm;
  poly([P(0, 0, e), P(e, 0, e), P(e, e, e), P(0, e, e)], colors.top);
  poly([P(e, 0, 0), P(e, e, 0), P(e, e, e), P(e, 0, e)], colors.right);
  poly([P(0, e, 0), P(e, e, 0), P(e, e, e), P(0, e, e)], colors.left);
  if (dots) {
    g.fillStyle = "rgba(122,88,20,0.5)";
    for (let a = 0; a <= e; a += 1) for (let b2 = 0; b2 <= e; b2 += 1) {
      [[P(a, b2, e), 1.2], [P(e, a, b2), 1.1], [P(a, e, b2), 1.1]].forEach(([p, r]) => {
        g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
      });
    }
  }
}

function drawTowerPlate() {
  const { g, w, h } = fitChart($("towerPlate"), 400);
  g.clearRect(0, 0, w, h);
  const shown = state.towerN;

  // the isometric pink tower in cm-space: base cube 10 cm, each smaller cube
  // centered on the one below (x0 = y0 = (10−edge)/2, stacked in z)
  const s = 12.4;
  const ox = 168, oy = 352;
  let z = 0;
  for (let edge = 10; edge >= 11 - shown; edge -= 1) {
    const n = 11 - edge;
    const off = (10 - edge) / 2;
    drawIsoCube(g, ox, oy, s, off, off, z, edge, PINKS[n - 1], edge >= 8);
    z += edge;
  }
  g.fillStyle = "#8b7a64"; g.font = "11.5px ui-monospace, Menlo, monospace"; g.textAlign = "center";
  g.fillText(`粉红塔 · 搭到第 ${shown} 块`, ox + 10, oy + 24);
  g.fillText(`Σn³ = ${fmt(M.sumCubesNaive(shown))} cm³`, ox + 10, oy + 40);

  // equals sign
  g.fillStyle = "#a97e22"; g.font = "800 44px Georgia, serif";
  g.fillText("=", ox + 150, h / 2 + 16);

  // the 55×55 proof plate: nested L-gnomons, ring n has area exactly n³.
  // Paint squares of side T(n) from the outside in; each band between
  // T(n−1) and T(n) keeps its own color.
  const plateS = 290;
  const cxp = w - plateS / 2 - 46;
  const cyp = (h - plateS) / 2 + 6;
  const k = plateS / 55;
  for (let n = 10; n >= 1; n -= 1) {
    const side = M.triangular(n) * k;
    const active = n <= state.towerN;
    g.fillStyle = active ? lerpColor("#f2c7d8", "#b95c82", (n - 1) / 9) : "#efe8d8";
    g.fillRect(cxp - side / 2, cyp - side / 2, side, side);
  }
  g.strokeStyle = "#8e4a68"; g.lineWidth = 1.4;
  g.strokeRect(cxp - plateS / 2, cyp - plateS / 2, plateS, plateS);
  g.font = "700 11px ui-monospace, Menlo, monospace"; g.textAlign = "right";
  for (let n = 1; n <= 10; n += 1) {
    const outer = M.triangular(n) * k;
    g.fillStyle = n <= state.towerN ? "#8a3c5c" : "#c9bda6";
    g.fillText(`${n}³`, cxp + outer / 2 + 3, cyp - outer / 2 - 1);
  }
  g.fillStyle = "#8b7a64"; g.font = "11.5px ui-monospace, Menlo, monospace"; g.textAlign = "center";
  g.fillText("55 × 55 证明板 · 第 n 圈 L 形面积 = n³", cxp, cyp + plateS / 2 + 22);
  g.fillText("10 圈面积合计 = 3025 = 55²", cxp, cyp + plateS / 2 + 38);
}

function drawTowerCharts() {
  drawTowerChart();
  drawTowerPlate();
  $("tower-n-out").textContent = String(state.towerN);
  $("t-rods").textContent = "55 cm";
  $("t-total").textContent = fmt(M.pinkTower().totalCm3) + " cm³";
  $("t-ident").textContent = `${fmt(M.pinkTower().T2)} = ${M.pinkTower().T}²`;
  $("t-max").textContent = "1000 cm³";
}

// --- cube tab ---------------------------------------------------------------
const LETTER_COLORS = {
  a: { top: "#d97c78", left: "#b85551", right: "#96403c", rim: "#5f2c29" },
  b: { top: "#6ba3d0", left: "#4a7dab", right: "#38618a", rim: "#24425f" },
  c: { top: "#ecc86a", left: "#c9a23e", right: "#a37f27", rim: "#5f4a15" },
};

function drawCubeBox() {
  const { g, w, h } = fitChart($("cubeBox"), 400);
  g.clearRect(0, 0, w, h);
  const bin = state.cubeMode === "binomial";
  const dims = bin ? [M.BINOMIAL.a, M.BINOMIAL.b] : [M.TRINOMIAL.a, M.TRINOMIAL.b, M.TRINOMIAL.c];
  const letters = ["a", "b", "c"];
  const K = dims.length;

  const ex = state.explode;
  const spread = 34;
  // piece origins in cm, with explode offsets
  const origin = (i, j, k) => {
    let x = 0, y = 0, z = 0;
    for (let d = 0; d < i; d += 1) x += dims[d];
    for (let d = 0; d < j; d += 1) y += dims[d];
    for (let d = 0; d < k; d += 1) z += dims[d];
    return {
      x: x + ex * (i - (K - 1) / 2) * 6,
      y: y + ex * (j - (K - 1) / 2) * 6,
      z: z + ex * (k - (K - 1) / 2) * spread,
      dx: dims[i], dy: dims[j], dz: dims[k],
      li: letters[i], lj: letters[j], lk: letters[k],
    };
  };

  const pieces = [];
  for (let i = 0; i < K; i += 1)
    for (let j = 0; j < K; j += 1)
      for (let k = 0; k < K; k += 1) pieces.push({ ...origin(i, j, k), i, j, k });
  pieces.sort((p, q) => (p.x + p.y + p.z) - (q.x + q.y + q.z));

  const s = bin ? 17 : 15;
  const proj = (x, y, z) => ({ x: (x - y) * 0.866 * s, y: (x + y) * 0.5 * s - z * s });
  // bounding box to center the drawing
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const p of pieces) {
    for (const [dx, dy, dz] of [[0, 0, 0], [p.dx, 0, 0], [0, p.dy, 0], [0, 0, p.dz], [p.dx, p.dy, 0], [p.dx, 0, p.dz], [0, p.dy, p.dz], [p.dx, p.dy, p.dz]]) {
      const q = proj(p.x + dx, p.y + dy, p.z + dz);
      minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x);
      minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y);
    }
  }
  const cx = w / 2 - (minX + maxX) / 2;
  const cy = h / 2 - (minY + maxY) / 2 + 12;
  g.save();
  g.translate(cx, cy);
  const P = (x, y, z) => ({ x: (x - y) * 0.866 * s, y: (x + y) * 0.5 * s - z * s });
  const drawBox = (p) => {
    const cI = LETTER_COLORS[p.li], cJ = LETTER_COLORS[p.lj], cK = LETTER_COLORS[p.lk];
    const poly = (pts, fill, rim) => {
      g.beginPath();
      pts.forEach((q, idx) => (idx ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
      g.closePath(); g.fillStyle = fill; g.fill();
      g.strokeStyle = rim; g.lineWidth = 1; g.stroke();
    };
    const { x, y, z, dx, dy, dz } = p;
    poly([P(x, y, z + dz), P(x + dx, y, z + dz), P(x + dx, y + dy, z + dz), P(x, y + dy, z + dz)], cK.top, cK.rim);
    poly([P(x + dx, y, z), P(x + dx, y + dy, z), P(x + dx, y + dy, z + dz), P(x + dx, y, z + dz)], cI.right, cI.rim);
    poly([P(x, y + dy, z), P(x + dx, y + dy, z), P(x + dx, y + dy, z + dz), P(x, y + dy, z + dz)], cJ.left, cJ.rim);
  };
  for (const p of pieces) drawBox(p);
  g.restore();

  // dimension labels along the bottom edges
  g.fillStyle = "#6f5d44"; g.font = "12px ui-monospace, Menlo, monospace"; g.textAlign = "left";
  g.fillText(`a = ${dims[0]} cm`, 18, h - 34);
  g.fillText(`b = ${dims[1]} cm`, 18, h - 18);
  if (!bin) g.fillText(`c = ${dims[2]} cm`, 18, h - 2);
  g.textAlign = "right";
  g.fillStyle = "#8b7a64";
  g.fillText(bin ? "(a+b)³ 盒子 · 8 件" : "(a+b+c)³ 盒子 · 27 件", w - 16, h - 18);
}

// expand a term like "a²b" into its letter list [a, a, b] for dimension labels
function termLetterList(term) {
  const out = [];
  const chars = [...term];
  for (let i = 0; i < chars.length; i += 1) {
    if (chars[i] >= "a" && chars[i] <= "z") {
      out.push(chars[i]);
      if (chars[i + 1] === "²") out.push(chars[i]);
    }
  }
  return out;
}

function buildCubeLedger() {
  const bin = state.cubeMode === "binomial";
  const box = bin ? M.binomialPieces() : M.trinomialPieces();
  const dims = bin ? [M.BINOMIAL.a, M.BINOMIAL.b] : [M.TRINOMIAL.a, M.TRINOMIAL.b, M.TRINOMIAL.c];
  const letterIdx = { a: 0, b: 1, c: 2 };
  $("cube-a").textContent = String(dims[0]);
  $("cube-b").textContent = String(dims[1]);
  $("cube-c-leg").style.display = bin ? "none" : "inline";

  const rows = box.inventory
    .filter((r) => r.count > 0)
    .map((r) => {
      const letter = r.term[0];
      const chip = `<span class="lg ${letter === "a" ? "red" : letter === "b" ? "blue" : "gold"}">■</span>`;
      const dim = termLetterList(r.term).map((L) => dims[letterIdx[L]]).join("×");
      return `<div class="row"><span>${chip} ${r.term} · ${dim} cm</span><output>${r.count} 件 × ${r.each} = ${r.volume}</output></div>`;
    })
    .join("");
  const total = `<div class="row total"><span>合计 ${box.pieceCount} 件 · 填满 (${dims.join("+")})³ 的木盒</span><output>${box.volume} = ${box.boxVolume} cm³ ✓</output></div>`;
  $("cube-ledger").innerHTML = rows + total;

  if (bin) {
    $("cube-formula").innerHTML =
      `(a+b)³ = a³ + 3a²b + 3ab² + b³<br>` +
      `= ${dims[0] ** 3} + 3×${dims[0] * dims[0] * dims[1]} + 3×${dims[0] * dims[1] * dims[1]} + ${dims[1] ** 3} = ${box.volume} cm³` +
      `<small>八块木头：一个红立方体、一个蓝立方体、三块红红蓝、三块红蓝蓝。公式是拿在手里的。</small>`;
  } else {
    $("cube-formula").innerHTML =
      `(a+b+c)³ = Σa³ + 3(a²b+a²c+b²a+b²c+c²a+c²b) + 6abc<br>` +
      `= ${dims[0] ** 3}+${dims[1] ** 3}+${dims[2] ** 3} + 3×220 + 6×${dims[0] * dims[1] * dims[2]} = ${box.volume} cm³` +
      `<small>二十七块木头：三个立方体、十八块棱柱、六个角落块。盒子还是十厘米见方。</small>`;
  }
}

function drawCubeTab() {
  drawCubeBox();
  buildCubeLedger();
}

// --- bank tab ---------------------------------------------------------------
function buildBankTable() {
  const led = M.dynamicAddLedger(state.a, state.b);
  const shown = [...led.cols].reverse(); // 万千百十个
  const maxShown = 5;
  const head = shown.map((c) => `<th style="color:${c.color}">${c.label}<br><small style="font:600 10px -apple-system,sans-serif;color:#8b7a64">${CAT[c.idx].value}</small></th>`).join("");
  const rowA = shown.map((c) => `<td class="${c.a ? "" : "dim"}">${c.a}</td>`).join("");
  const rowB = shown.map((c) => `<td class="${c.b ? "" : "dim"}">${c.b}</td>`).join("");
  const carryRow = shown.map((c) => `<td>${c.carryIn ? `<span class="carry">+${c.carryIn}</span>` : ""}</td>`).join("");
  const sumRow = shown.map((c) => `<td style="font-size:14px;color:#8b7a64" class="${c.sum ? "" : "dim"}">${c.sum}</td>`).join("");
  const resRow = shown.map((c) => `<td class="${c.digit ? "" : "dim"}" style="color:${c.color}">${c.digit}</td>`).join("");
  $("bank-table").innerHTML = `
    <div class="bank-sentence">${fmt(state.a)} + ${fmt(state.b)} = ${fmt(led.result)}</div>
    <table class="bank">
      <thead><tr>${head}</tr></thead>
      <tbody>
        <tr><td class="lab" colspan="${maxShown}">甲数</td></tr>
        <tr>${rowA}</tr>
        <tr><td class="lab" colspan="${maxShown}">乙数</td></tr>
        <tr>${rowB}</tr>
        <tr><td class="lab" colspan="${maxShown}">低位送来的进位（= 去银行换来的那一个）</td></tr>
        <tr>${carryRow}</tr>
        <tr><td class="lab" colspan="${maxShown}">本列合计（含进位）</td></tr>
        <tr>${sumRow}</tr>
        <tr class="res">${resRow}</tr>
      </tbody>
    </table>`;

  const aC = countsForNumber(state.a), bC = countsForNumber(state.b);
  const merged = M.addCounts(aC, bC);
  const script = M.exchangeScript(merged);
  $("b-merged").textContent = fmt(M.valueOf(merged));
  $("b-exchanges").textContent = `${script.steps.length} 组（= ${led.carryCount} 次进位）`;
  $("b-after").textContent = fmt(M.valueOf(script.final));
  $("b-bigint").textContent =
    `${BigInt(state.a)}n + ${BigInt(state.b)}n = ${BigInt(state.a) + BigInt(state.b)}n ✓`;
}

// --- hist tab ---------------------------------------------------------------
function buildHist() {
  $("timeline").innerHTML = M.TIMELINE.map((t) => `
    <div class="tl-item">
      <span class="yr">${t.year}</span>${t.date ? `<span class="dt">${t.date}</span>` : ""}
      <h4>${t.title}</h4><p>${t.text}</p>
    </div>`).join("");
  $("quote-list").innerHTML = M.QUOTES.map((q) => `
    <div class="quote">
      <span class="en">“${q.text}”</span>
      <span class="cn">${q.cn}</span>
      ${q.note ? `<span class="note">${q.note}</span>` : ""}
    </div>`).join("");
  $("alumni").innerHTML = M.ALUMNI.map((p) => `<span>${p.name} <small>${p.who}</small></span>`).join("");
}

// --- side sprite card ---------------------------------------------------------
function drawSpriteCard() {
  const { g, w, h } = fitChart($("sprites"), 132);
  g.clearRect(0, 0, w, h);
  const items = [
    { cat: 0, label: "一粒 = 1" },
    { cat: 1, label: "一串 = 10" },
    { cat: 2, label: "一方 = 100" },
    { cat: 3, label: "一块 = 1000" },
  ];
  const slotW = w / 4;
  items.forEach((it, i) => {
    const img = SPRITES[it.cat];
    const iw = img.width / (window.devicePixelRatio || 1);
    const ih = img.height / (window.devicePixelRatio || 1);
    const scale = it.cat === 3 ? 0.62 : it.cat === 2 ? 0.82 : 1;
    g.drawImage(img, slotW * i + slotW / 2 - (iw * scale) / 2, 12 + (64 - ih * scale) / 2, iw * scale, ih * scale);
    g.fillStyle = "#6f5d44"; g.font = "600 12px -apple-system, sans-serif"; g.textAlign = "center";
    g.fillText(it.label, slotW * i + slotW / 2, h - 14);
    g.textAlign = "left";
  });
}

// ---------------------------------------------------------------------------
// main loop + boot
// ---------------------------------------------------------------------------
let last = performance.now();
function loop(now) {
  if (!state.videoMode) step(Math.min(0.05, (now - last) / 1000));
  last = now;
  drawBench();
  requestAnimationFrame(loop);
}

function refreshAll() {
  resizeBench();
  SPRITES = makeSprites();
  drawSpriteCard();
  if (state.tab === "tower") drawTowerCharts();
  if (state.tab === "cube") drawCubeTab();
}

function wireInputs() {
  $("tower-n").addEventListener("input", (e) => {
    state.towerN = Number(e.target.value);
    drawTowerCharts();
  });
  $("explode").addEventListener("input", (e) => {
    state.explode = Number(e.target.value);
    $("explode-out").textContent = Math.round(state.explode * 100) + "%";
    drawCubeBox();
  });
  $("cube-bin").addEventListener("click", () => setCubeMode("binomial"));
  $("cube-tri").addEventListener("click", () => setCubeMode("trinomial"));
}
function setCubeMode(mode) {
  state.cubeMode = mode;
  $("cube-bin").classList.toggle("on", mode === "binomial");
  $("cube-tri").classList.toggle("on", mode === "trinomial");
  drawCubeTab();
}

// __demo API (for the video renderer and the curious)
window.__demo = {
  loadPreset: (id) => applyPreset(id),
  setTab: (name) => setTab(name),
  setParam: (name, value) => {
    if (name === "towerN") { state.towerN = clamp(Math.round(value), 1, 10); $("tower-n").value = state.towerN; drawTowerCharts(); }
    if (name === "explode") { state.explode = clamp(value, 0, 1); $("explode").value = state.explode; $("explode-out").textContent = Math.round(state.explode * 100) + "%"; if (state.tab === "cube") drawCubeBox(); }
    if (name === "cubeMode") setCubeMode(value);
    if (name === "speed") { state.speed = value; $("speed-out").textContent = value.toFixed(1) + "×"; $("speed-range").value = value; }
    if (name === "a") { state.a = clamp(Math.round(value), 0, 9999); $("num-a").value = state.a; }
    if (name === "b") { state.b = clamp(Math.round(value), 0, 9999); $("num-b").value = state.b; }
  },
  setAuto: (on) => setAuto(on),
  setVideoMode: (on) => { state.videoMode = !!on; if (on) setAuto(false); },
  layOut: () => { if (state.phase !== "idle") return; startLay("a"); enqueue({ kind: "wait", until: state.clock + 0.3 }); enqueue({ kind: "run", run: () => startLay("b") }); },
  combine: () => { if (state.phase === "laid" || state.phase === "combined") startCombine(); },
  exchangeAll: () => { if (state.phase === "combined") startExchangeAll(); },
  reset: () => resetBench(),
  scrollToBench: () => $("bench").scrollIntoView({ block: "center" }),
  scrollToTabs: () => document.querySelector(".tabs-card").scrollIntoView({ block: "start" }),
  step: (dt) => { step(dt); drawBench(); if (state.tab === "tower" || state.tab === "cube") { /* charts are static per param change */ } },
};

// boot
renderPresets();
wirePanel();
wireTabs();
wireInputs();
buildHist();
buildBankTable();
resizeBench();
drawSpriteCard();
setTab("tower");
refreshReadouts();
applyPreset("casa1907");
setAuto(true);
requestAnimationFrame(loop);
window.addEventListener("resize", () => refreshAll());
