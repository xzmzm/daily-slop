// app.js — RAMAC Disk File studio. UI layer over ramac.js.
import {
  SPECS, REV_MS, REVS_PER_SEC, TOTAL_CHARS, CAPACITY_MB, BITS_PER_TRACK, CARDS_EQUIV,
  BAND, TRACK_PITCH_IN, BIT_CELL_IN, SETTLE_MS, VERTICAL_FULL_MS, HORIZONTAL_FULL_MS,
  recordTransferMs,
  encodeMessage, TAPE_727, TAPE_FETCH_MS, RAMAC_FETCH_MS, NVME_FETCH_MS, TAPE_TO_RAMAC,
  recordsPerDay, DENSITY_ANCHORS, CAPACITY_ANCHORS, densityAt, capacityAt, costPerMbAt,
  hundredDollarsBuysMb, translateYear, MILESTONES,
} from './ramac.js';

const $ = (sel) => document.querySelector(sel);
const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
const fmtF = (n, d = 1) => n.toFixed(d);

function fmtDuration(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
  return `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`;
}
function fmtHours(ms) {
  const h = ms / 3_600_000;
  if (h < 0.01) return `${(h * 3600).toFixed(1)} s`;
  if (h < 1) return `${(h * 60).toFixed(1)} min`;
  if (h < 100) return `${h.toFixed(1)} h`;
  return `${fmtInt(h)} h`;
}
function fmtBytes(mb) {
  if (mb < 0.001) return `${(mb * 1e6).toFixed(0)} bytes`;
  if (mb < 1) return `${(mb * 1000).toFixed(0)} KB`;
  if (mb < 1000) return `${mb.toFixed(mb < 10 ? 2 : 0)} MB`;
  if (mb < 1e6) return `${(mb / 1000).toFixed(mb < 1e4 ? 1 : 0)} GB`;
  return `${(mb / 1e6).toFixed(1)} TB`;
}
function fmtCompact(n) {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)} T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
  return fmtInt(n);
}
function fmtDensity(v) {
  if (v < 1e6) return `${fmtInt(v)} bit/in²`;
  if (v < 1e9) return `${(v / 1e6).toFixed(1)} Mbit/in²`;
  return `${(v / 1e12).toFixed(2)} Tbit/in²`;
}

// ---------------------------------------------------------------- tabs
const tabs = document.querySelectorAll('.nav-tab');
tabs.forEach((btn) => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));
function activateTab(name) {
  tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === name));
  if (name === 'tab-years') drawYears();
  if (name === 'tab-race') drawRace();
}

// ============================================================ TAB 1: stack
const svg = $('#stackSvg');
const gPlatters = $('#stackPlatters'), gBoom = $('#stackBoom'), gLabels = $('#stackLabels');
const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs, parent) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  (parent || svg).appendChild(node);
  return node;
};

const STACK = {
  cx: 420, rx: 250, ry: 15,
  topY: 60, spacing: 8.8,     // 50 platters
  railX: 795,
};
let head = { surface: 19, track: 42 };            // where the boom actually is
let target = { surface: 19, track: 42, record: 1 }; // the address register
let anim = { t: 0, phase: 'idle', from: null, to: null, segments: null, spin: 0 };

const platterEls = [];
(function buildStack() {
  // cabinet outline
  el('rect', { x: STACK.cx - STACK.rx - 26, y: STACK.topY - 26, width: (STACK.rx + 26) * 2,
    height: STACK.spacing * 49 + 62, rx: 10, fill: 'none', stroke: '#2c3a4d', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, gPlatters);
  for (let i = 0; i < 50; i++) {
    const y = STACK.topY + i * STACK.spacing;
    const top = el('ellipse', { cx: STACK.cx, cy: y, rx: STACK.rx, ry: STACK.ry, class: 'platter' }, gPlatters);
    platterEls.push(top);
  }
  el('rect', { x: STACK.cx - 7, y: STACK.topY - 16, width: 14, height: STACK.spacing * 49 + 32, rx: 5, class: 'spindle' }, gPlatters);

  // labels
  el('text', { x: STACK.cx, y: STACK.topY - 32, 'text-anchor': 'middle', class: 'dim-text' }, gLabels).textContent = '50 disks · 24 in diameter · spinning at 1,200 rpm';
  el('text', { x: STACK.railX + 16, y: STACK.topY + 8, class: 'axis-cap' }, gLabels).textContent = 'ACCESS BOOM';
  el('text', { x: STACK.cx - STACK.rx - 26, y: STACK.topY + STACK.spacing * 49 + 58, class: 'dim-text' }, gLabels)
    .textContent = 'one surface = 100 tracks × 500 characters — pick surface, track, record';
  el('text', { x: 18, y: STACK.topY + 4, class: 'axis-cap' }, gLabels).textContent = 'TOP';
  el('text', { x: 18, y: STACK.topY + STACK.spacing * 49 + 20, class: 'axis-cap' }, gLabels).textContent = 'DISK 50';
})();

const armEl = el('line', { class: 'boom-arm', x1: STACK.railX, y1: 0, x2: 0, y2: 0 }, gBoom);
const railEl = el('line', { class: 'boom-rail', x1: STACK.railX, y1: STACK.topY - 10, x2: STACK.railX, y2: STACK.topY + STACK.spacing * 49 + 16 }, gBoom);
const headEl = el('circle', { r: 7, class: 'head-glow' }, gBoom);
const headRing = el('circle', { r: 12, fill: 'none', stroke: 'var(--amber)', 'stroke-width': 1.4, opacity: 0.6 }, gBoom);
const spinDot = el('circle', { r: 4.5, class: 'spin-dot' }, gBoom);
const ghostEl = el('circle', { r: 9, fill: 'none', stroke: '#6aa6d8', 'stroke-width': 1.4, 'stroke-dasharray': '3 3' }, gBoom);
const spinTrail = el('ellipse', { fill: 'none', stroke: 'rgba(87,217,163,0.35)', 'stroke-width': 1, opacity: 0 }, gBoom);

function headGeom(s, t) {
  const y = STACK.topY + (Math.ceil(s / 2) - 1) * STACK.spacing - 2;
  const frac = (BAND.rOut - ((t - 1) / 99) * BAND.width) / (SPECS.diskDiameterIn / 2);  // track 1 = outermost
  const x = STACK.cx + STACK.rx * frac;
  return { x, y };
}

function refreshHeadVisual() {
  const { x, y } = headGeom(head.surface, head.track);
  armEl.setAttribute('x1', STACK.railX); armEl.setAttribute('y1', y);
  armEl.setAttribute('x2', x); armEl.setAttribute('y2', y);
  headEl.setAttribute('cx', x); headEl.setAttribute('cy', y);
  headRing.setAttribute('cx', x); headRing.setAttribute('cy', y);
  spinTrail.setAttribute('cx', STACK.cx); spinTrail.setAttribute('cy', STACK.topY + (Math.ceil(head.surface / 2) - 1) * STACK.spacing);
  spinTrail.setAttribute('rx', x - STACK.cx); spinTrail.setAttribute('ry', STACK.ry * ((x - STACK.cx) / STACK.rx));
  spinTrail.setAttribute('opacity', 0.8);
  platterEls.forEach((p, i) => {
    p.classList.toggle('under-head', i === Math.ceil(head.surface / 2) - 1);
  });
  $('#spinReadout').textContent = `head: surface ${Math.round(head.surface)} · track ${Math.round(head.track)}`;
}

function refreshGhost() {
  const { x, y } = headGeom(target.surface, target.track);
  ghostEl.setAttribute('cx', x); ghostEl.setAttribute('cy', y);
  ghostEl.setAttribute('opacity', (target.surface !== Math.round(head.surface) || target.track !== Math.round(head.track)) ? 0.9 : 0.25);
}

const surfaceSlider = $('#surfaceSlider'), trackSlider = $('#trackSlider'), recordSlider = $('#recordSlider');
function syncSliders() {
  $('#surfaceReadout').textContent = `${String(target.surface).padStart(3, '0')} / 100`;
  $('#trackReadout').textContent = `${String(target.track).padStart(3, '0')} / 100`;
  $('#recordReadout').textContent = `${target.record} / 5`;
  surfaceSlider.value = target.surface; trackSlider.value = target.track; recordSlider.value = target.record;
  refreshGhost();
}
function refreshAddress() {
  const addr = ((target.surface - 1) * SPECS.tracksPerSurface + (target.track - 1)) * SPECS.recordsPerTrack * SPECS.charsPerRecord
    + (target.record - 1) * SPECS.charsPerRecord + 1;
  $('#statAddress').textContent = `char ${fmtInt(addr)}`;
}
surfaceSlider.addEventListener('input', () => { target.surface = +surfaceSlider.value; syncSliders(); refreshAddress(); });
trackSlider.addEventListener('input', () => { target.track = +trackSlider.value; syncSliders(); refreshAddress(); });
recordSlider.addEventListener('input', () => { target.record = +recordSlider.value; syncSliders(); refreshAddress(); });
$('#statRpd').textContent = fmtInt(recordsPerDay(RAMAC_FETCH_MS));
$('#statFile').textContent = `${fmtInt(TOTAL_CHARS)} chars = ${CAPACITY_MB} MB`;
$('#statCards').textContent = `${fmtInt(CARDS_EQUIV)} cards`;
$('#statTape').textContent = `${(TOTAL_CHARS / TAPE_727.charsPerReel).toFixed(2)} reels`;

function startSeek(dest = { surface: target.surface, track: target.track }) {
  const from = { surface: Math.round(head.surface), track: Math.round(head.track) };
  const ds = Math.abs(dest.surface - from.surface), dt = Math.abs(dest.track - from.track);
  const settle = SETTLE_MS, vert = VERTICAL_FULL_MS * ds / 99, horiz = HORIZONTAL_FULL_MS * dt / 99;
  const latency = Math.random() * REV_MS;
  anim = {
    t: 0, phase: 'mech',
    from, to: { ...dest },
    segments: { settle, vert, horiz, latency },
    spin: anim.spin,
  };
}
function renderTiming(segs, total) {
  $('#segSettle').textContent = `${Math.round(segs.settle)} ms`;
  $('#segVert').textContent = `${segs.vert.toFixed(0)} ms`;
  $('#segHoriz').textContent = `${segs.horiz.toFixed(0)} ms`;
  $('#segLatency').textContent = `${segs.latency.toFixed(0)} ms`;
  $('#segTotal').textContent = `${Math.round(total)} ms`;
  const totalGrow = Math.max(segs.settle + segs.vert + segs.horiz + segs.latency, 1);
  const setW = (id, v) => { const node = $(id).parentElement; node.style.flexGrow = Math.max(v / totalGrow * 10, 0.6); };
  setW('#segSettle', segs.settle); setW('#segVert', segs.vert); setW('#segHoriz', segs.horiz); setW('#segLatency', segs.latency);
}

$('#seekBtn').addEventListener('click', () => startSeek({ surface: target.surface, track: target.track }));
$('#randomBtn').addEventListener('click', () => {
  target.surface = 1 + Math.floor(Math.random() * 100);
  target.track = 1 + Math.floor(Math.random() * 100);
  target.record = 1 + Math.floor(Math.random() * 5);
  syncSliders(); refreshAddress();
  startSeek({ surface: target.surface, track: target.track });
});

// --------------------------------------------------------- shared clock
let lastTs = 0;
function tick(ts) {
  const dtMs = Math.min(ts - lastTs, 100); lastTs = ts;
  const slow = $('#slowmoCheck').checked ? 10 : 1;

  // tab 1 animation
  if (anim.phase === 'mech') {
    anim.t += dtMs / slow;
    const mechTotal = anim.segments.settle + anim.segments.vert + anim.segments.horiz;
    const u = Math.min(anim.t / mechTotal, 1);
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;  // ease-in-out
    head.surface = anim.from.surface + (anim.to.surface - anim.from.surface) * e;
    head.track = anim.from.track + (anim.to.track - anim.from.track) * e;
    refreshHeadVisual();
    renderTiming(anim.segments, anim.segments.settle + anim.segments.vert + anim.segments.horiz + Math.min(anim.t, anim.segments.latency));
    if (u >= 1) { anim.phase = 'latency'; anim.t = 0; head.surface = anim.to.surface; head.track = anim.to.track; }
  } else if (anim.phase === 'latency') {
    anim.t += dtMs / slow;
    renderTiming(anim.segments, anim.segments.settle + anim.segments.vert + anim.segments.horiz + Math.min(anim.t, anim.segments.latency));
    if (anim.t >= anim.segments.latency) {
      anim.phase = 'stream';
      const total = anim.segments.settle + anim.segments.vert + anim.segments.horiz + anim.segments.latency;
      renderTiming(anim.segments, total + recordTransferMs());
      $('#segTotal').textContent = `${(total + recordTransferMs()).toFixed(0)} ms + read`;
      anim.phase = 'idle';
      syncSliders(); refreshHeadVisual(); refreshAddress(); refreshGhost();
    }
  }
  // spin dot orbits the current platter at (scaled) 1,200 rpm
  if (document.getElementById('tab-stack').classList.contains('active')) {
    anim.spin += (REVS_PER_SEC * 2 * Math.PI / slow) * (dtMs / 1000);
    const { x, y } = headGeom(head.surface, head.track);
    const p = STACK.topY + (Math.ceil(head.surface / 2) - 1) * STACK.spacing;
    spinDot.setAttribute('cx', STACK.cx + (x - STACK.cx) * Math.cos(anim.spin));
    spinDot.setAttribute('cy', p + STACK.ry * ((x - STACK.cx) / STACK.rx) * Math.sin(anim.spin) * 0.9);
  }

  if (document.getElementById('tab-track').classList.contains('active')) trackTick(dtMs);
  if (raceAnim.active) raceTick(dtMs);

  requestAnimationFrame(tick);
}

// ============================================================ TAB 2: race
const raceCanvas = $('#raceCanvas'), raceCtx = raceCanvas.getContext('2d');
const RACE_MIN_MS = 1e-4 * 1000, RACE_MAX_MS = 1e3 * 1000;   // 0.1 µs … 1000 s
const raceAnim = { active: false, t: 0 };
const TECHS = [
  { name: 'IBM 727 tape · 1953', ms: TAPE_FETCH_MS, color: '#c4785a', note: 'scan half a reel' },
  { name: 'IBM 350 RAMAC · 1956', ms: RAMAC_FETCH_MS, color: '#f2b544', note: 'seek + settle + spin' },
  { name: 'NVMe SSD · 2026', ms: NVME_FETCH_MS, color: '#6aa6d8', note: 'flash, in parallel' },
];
const UPDATES_STEPS = [100, 500, 2000, 10000, 47000, 200000];

function raceX(ms, w, h) {
  const lmin = Math.log10(RACE_MIN_MS), lmax = Math.log10(RACE_MAX_MS);
  const u = (Math.log10(ms) - lmin) / (lmax - lmin);
  return 70 + u * (w - 110);
}
function drawRace(progress = [1, 1, 1]) {
  const w = raceCanvas.width, h = raceCanvas.height;
  const ctx = raceCtx;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0b0f15'; ctx.fillRect(0, 0, w, h);
  // decade grid
  ctx.font = '10.5px "SF Mono", Monaco, monospace';
  ctx.textAlign = 'center';
  for (let l = -4; l <= 3; l++) {
    const x = raceX(Math.pow(10, l) * 1000, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.moveTo(x, 24); ctx.lineTo(x, h - 34); ctx.stroke();
    const ms = Math.pow(10, l) * 1000;
    ctx.fillStyle = '#64717f';
    ctx.fillText(ms < 1 ? `${(ms * 1000).toFixed(0)} µs` : ms < 1000 ? `${ms.toFixed(ms < 10 ? 1 : 0)} ms` : `${(ms / 1000).toFixed(0)} s`, x, h - 16);
  }
  TECHS.forEach((tech, i) => {
    const y = 70 + i * 120;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9aa7b5'; ctx.font = '600 14px "SF Mono", Monaco, monospace';
    ctx.fillText(tech.name.toUpperCase(), 70, y - 26);
    ctx.fillStyle = '#64717f'; ctx.font = '11px "SF Mono", Monaco, monospace';
    ctx.fillText(tech.note, 70, y - 10);
    const xEnd = raceX(tech.ms, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(70, y - 8, w - 110, 36);
    const grad = ctx.createLinearGradient(70, 0, xEnd, 0);
    grad.addColorStop(0, tech.color + '55'); grad.addColorStop(1, tech.color);
    ctx.fillStyle = grad;
    ctx.fillRect(70, y - 8, (xEnd - 70) * progress[i], 36);
    if (progress[i] >= 1) {
      ctx.fillStyle = tech.color;
      ctx.beginPath(); ctx.arc(xEnd, y + 10, 6, 0, Math.PI * 2); ctx.fill();
      ctx.font = '600 13px "SF Mono", Monaco, monospace';
      const label = fmtDuration(tech.ms);
      const wide = ctx.measureText(label).width;
      if (xEnd + 16 + wide > w - 34) {
        ctx.textAlign = 'right';
        ctx.fillText(label, xEnd - 12, y + 15);   // inside the bar
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(label, xEnd + 12, y + 15);
      }
    }
  });
  // spec marker: IBM documented average
  const xSpec = raceX(600, w, h);
  ctx.strokeStyle = 'rgba(87,217,163,0.5)'; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(xSpec, 24); ctx.lineTo(xSpec, h - 34); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#57d9a3'; ctx.textAlign = 'left';
  ctx.fillText('IBM spec: 600 ms average access', xSpec + 6, 34);
}
function raceTick(dtMs) {
  raceAnim.t += dtMs;
  const prog = TECHS.map((_, i) => {
    const delay = i * 260, span = 2100;
    const u = Math.max(0, Math.min((raceAnim.t - delay) / span, 1));
    return 1 - Math.pow(1 - u, 3);
  });
  drawRace(prog);
  if (prog.every((p) => p >= 1)) raceAnim.active = false;
}
$('#raceBtn').addEventListener('click', () => { raceAnim.active = true; raceAnim.t = 0; });
const updatesSlider = $('#updatesSlider');
function refreshRaceStats() {
  const n = UPDATES_STEPS[+updatesSlider.value - 1];
  $('#updatesReadout').textContent = fmtInt(n);
  $('#statUpdates').textContent = fmtInt(n);
  $('#statTapeDay').textContent = fmtHours(n * TAPE_FETCH_MS);
  $('#statRamacDay').textContent = fmtHours(n * RAMAC_FETCH_MS);
  $('#statNvmeDay').textContent = fmtHours(n * NVME_FETCH_MS);
  $('#statCeiling').textContent = `≈ ${fmtInt(recordsPerDay(RAMAC_FETCH_MS))}/day`;
  $('#roTape').textContent = fmtDuration(TAPE_FETCH_MS);
  $('#roRamac').textContent = fmtDuration(RAMAC_FETCH_MS);
  $('#roRatio').textContent = `${TAPE_TO_RAMAC.toFixed(0)}×`;
}
updatesSlider.addEventListener('input', refreshRaceStats);

// ============================================================ TAB 3: track
const trackCanvas = $('#trackCanvas'), trackCtx = trackCanvas.getContext('2d');
let trackCells = [], trackMsg = '', trackOffset = 0, readbackCount = 0;
const CELL_W = 11, SLOWMO_TRACK = 4096;
const REAL_CELLS_PER_SEC = SPECS.charRatePerSec * SPECS.recordedBitsPerChar;   // 70,400 cells/s at the head
function setMessage(text) {
  const cleaned = [...text.toUpperCase()].filter((c) => c === ' ' || /[A-Z0-9]/.test(c)).join('');
  $('#msgWarn').classList.toggle('hidden', cleaned === text.toUpperCase());
  $('#msgInput').value = cleaned;
  trackMsg = cleaned;
  const enc = encodeMessage(cleaned);
  trackCells = enc.flatMap((e) => e.cells);
  trackOffset = 0; readbackCount = 0;
  $('#readbackText').textContent = '';
  $('#msgCount').textContent = `${cleaned.length} / 100`;
  $('#dChars').textContent = fmtInt(cleaned.length);
  $('#dCells').textContent = fmtInt(trackCells.length);
  $('#dShare').textContent = `${(cleaned.length / SPECS.charsPerTrack * 100).toFixed(1)}% of 500`;
  $('#dTime').textContent = fmtDuration(recordTransferMs(cleaned.length));
}
$('#msgInput').addEventListener('input', (e) => setMessage(e.target.value));

function trackTick(dtMs) {
  const cellsPerSec = (SPECS.charRatePerSec * SPECS.recordedBitsPerChar) / SLOWMO_TRACK;   // ≈ 17 cell/s
  trackOffset += cellsPerSec * (dtMs / 1000);
  const headIdx = Math.floor(trackOffset);
  if (headIdx > readbackCount && readbackCount < trackMsg.length) {
    readbackCount = Math.min(headIdx >> 3, trackMsg.length);
    $('#readbackText').textContent = trackMsg.slice(0, readbackCount);
  }
  drawTrack();
}
function drawTrack() {
  const w = trackCanvas.width, h = trackCanvas.height, ctx = trackCtx;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0b0f15'; ctx.fillRect(0, 0, w, h);
  const headX = 190, baseline = 300, topY = 150, cellH = 90;
  // ruler
  ctx.font = '10px "SF Mono", Monaco, monospace'; ctx.fillStyle = '#64717f'; ctx.textAlign = 'center';
  for (let d = 0; d <= 5; d++) {
    const x = headX + d * 8 * CELL_W * 3;
    ctx.fillText(`${d * 24}`, x, h - 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(x, topY - 20); ctx.lineTo(x, baseline + 30); ctx.stroke();
  }
  const firstCell = Math.floor((trackOffset)) - 12;
  for (let i = firstCell; i < firstCell + Math.ceil(w / CELL_W) + 12; i++) {
    if (i < 0 || i >= trackCells.length * 3) continue;
    const ci = i % trackCells.length;
    const cell = trackCells[ci];
    const charIdx = Math.floor(ci / 8), posInChar = ci % 8;
    const x = headX + (i - trackOffset) * CELL_W;
    if (x < -CELL_W || x > w) continue;
    const isParity = posInChar === 6, isSpace = posInChar === 7;
    // magnetisation column
    if (cell === 1) {
      ctx.fillStyle = isParity ? '#c4785a' : '#f2b544';
      ctx.fillRect(x + 1.5, topY, CELL_W - 3, cellH);
      ctx.strokeStyle = cell === 1 ? '#f4efe0' : 'rgba(255,255,255,0.25)';
    } else {
      ctx.fillStyle = 'rgba(106,166,216,0.28)';
      ctx.fillRect(x + 1.5, topY + cellH * 0.38, CELL_W - 3, cellH * 0.24);
    }
    if (isSpace) {
      ctx.strokeStyle = 'rgba(244,239,224,0.18)';
      ctx.beginPath(); ctx.moveTo(x + CELL_W / 2, topY - 6); ctx.lineTo(x + CELL_W / 2, topY + cellH + 6); ctx.stroke();
    }
    // character boundary + label
    if (posInChar === 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.moveTo(x, topY - 14); ctx.lineTo(x, topY + cellH + 14); ctx.stroke();
      if (charIdx < trackMsg.length) {
        ctx.fillStyle = '#9aa7b5'; ctx.font = '11px "SF Mono", Monaco, monospace';
        ctx.fillText(trackMsg[charIdx], x + 4 * CELL_W, topY - 24);
      }
    }
  }
  // bit-position header above the head: B A 8 4 2 1 C S
  ctx.textAlign = 'center'; ctx.font = '10px "SF Mono", Monaco, monospace'; ctx.fillStyle = '#64717f';
  const bitNames = ['B', 'A', '8', '4', '2', '1', 'C', 'S'];
  const headCell = Math.floor(trackOffset);
  bitNames.forEach((name, k) => {
    const x = headX + (headCell + k - trackOffset) * CELL_W + CELL_W / 2;
    if (x > 60 && x < w - 40) ctx.fillText(name, x, topY - 40);
  });
  // the head
  ctx.fillStyle = '#6aa6d8';
  ctx.beginPath();
  ctx.moveTo(headX + CELL_W / 2, topY - 52); ctx.lineTo(headX - 8, topY - 18); ctx.lineTo(headX + CELL_W + 8, topY - 18); ctx.closePath(); ctx.fill();
  ctx.fillRect(headX - 1, topY - 20, CELL_W + 2, 6);
  ctx.strokeStyle = 'rgba(106,166,216,0.5)'; ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(headX + CELL_W / 2, topY); ctx.lineTo(headX + CELL_W / 2, topY + cellH); ctx.stroke(); ctx.setLineDash([]);
  // cell legend
  ctx.textAlign = 'left'; ctx.font = '11px "SF Mono", Monaco, monospace';
  ctx.fillStyle = '#f2b544'; ctx.fillText('▮ 1 cell', 26, 92);
  ctx.fillStyle = 'rgba(106,166,216,0.9)'; ctx.fillText('▯ 0 cell', 26, 112);
  ctx.fillStyle = '#c4785a'; ctx.fillText('▮ parity (C) bit', 26, 132);
  ctx.fillStyle = '#9aa7b5'; ctx.fillText('|  space bit', 26, 152);
  ctx.fillStyle = '#64717f';
  ctx.fillText(`track speed at the head: 25 m/s · cell passes at ${(REAL_CELLS_PER_SEC / SLOWMO_TRACK).toFixed(1)} /s shown`, 26, h - 34);
  ctx.fillText(`one revolution = ${BITS_PER_TRACK} cells = ${fmtInt(SPECS.charsPerTrack)} chars = 50 ms`, 26, h - 18);
}

// geometry card
(function fillGeometry() {
  $('#gBand').textContent = `${BAND.rIn.toFixed(2)}–${BAND.rOut.toFixed(1)} in`;
  $('#gWidth').textContent = `${BAND.width.toFixed(2)} in (${(BAND.width * 25.4).toFixed(0)} mm)`;
  $('#gPitch').textContent = `${(TRACK_PITCH_IN * 1000).toFixed(1)} mil (${(TRACK_PITCH_IN * 25.4).toFixed(2)} mm)`;
  $('#gCell').textContent = `${(BIT_CELL_IN * 1000).toFixed(1)} mil (${(BIT_CELL_IN * 25.4 * 1000).toFixed(0)} µm)`;
  $('#gModern').textContent = `${fmtCompact(2.4e12 / SPECS.arealDensityBitsPerSqIn)} modern cells`;
})();

// ============================================================ TAB 4: years
const yearsCanvas = $('#yearsCanvas'), yearsCtx = yearsCanvas.getContext('2d');
const Y_MIN = 1956, Y_MAX = 2026;
let yearNow = 1956;
function yearsX(y, w) { return 76 + ((y - Y_MIN) / (Y_MAX - Y_MIN)) * (w - 110); }
function drawYears() {
  const w = yearsCanvas.width, h = yearsCanvas.height, ctx = yearsCtx;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0b0f15'; ctx.fillRect(0, 0, w, h);
  const panes = [
    { title: 'AREAL DENSITY — bit/in²', anchors: DENSITY_ANCHORS, at: densityAt, y0: 30, y1: h / 2 - 26, color: '#6aa6d8' },
    { title: 'FLAGSHIP DRIVE CAPACITY — MB', anchors: CAPACITY_ANCHORS, at: capacityAt, y0: h / 2 + 18, y1: h - 34, color: '#f2b544' },
  ];
  ctx.font = '10.5px "SF Mono", Monaco, monospace';
  for (const pane of panes) {
    const lmin = Math.log10(pane.anchors[0].value), lmax = Math.log10(pane.anchors[pane.anchors.length - 1].value);
    const Y = (v) => pane.y1 - ((Math.log10(v) - lmin) / (lmax - lmin)) * (pane.y1 - pane.y0);
    ctx.fillStyle = '#9aa7b5'; ctx.textAlign = 'left';
    ctx.fillText(pane.title, 78, pane.y0 - 8);
    // decade ticks
    ctx.textAlign = 'center';
    for (let yy = 1960; yy <= 2020; yy += 20) {
      const x = yearsX(yy, w);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.moveTo(x, pane.y0); ctx.lineTo(x, pane.y1); ctx.stroke();
      if (pane === panes[1]) { ctx.fillStyle = '#64717f'; ctx.fillText(`${yy}`, x, pane.y1 + 16); }
    }
    // value ticks
    ctx.textAlign = 'right';
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = Math.pow(10, lmin + (lmax - lmin) * i / ticks);
      const y = Y(v);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath(); ctx.moveTo(76, y); ctx.lineTo(w - 34, y); ctx.stroke();
      ctx.fillStyle = '#64717f';
      ctx.fillText(v >= 1e12 ? `${(v / 1e12).toFixed(1)}T` : v >= 1e9 ? `${(v / 1e9).toFixed(0)}G` : v >= 1e6 ? `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : v.toFixed(v < 10 ? 1 : 0), 70, y + 3);
    }
    // curve
    ctx.strokeStyle = pane.color; ctx.lineWidth = 2.4; ctx.beginPath();
    for (let px = 76; px <= w - 34; px += 3) {
      const yy = Y_MIN + ((px - 76) / (w - 110)) * (Y_MAX - Y_MIN);
      const py = Y(pane.at(yy));
      px === 76 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke(); ctx.lineWidth = 1;
    // anchors
    for (const a of pane.anchors) {
      const x = yearsX(a.year, w), y = Y(a.value);
      ctx.fillStyle = pane.color;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#0b0f15'; ctx.stroke();
      // label alternating above/below
      ctx.fillStyle = '#9aa7b5'; ctx.textAlign = 'center';
      const up = pane.anchors.indexOf(a) % 2 === 0;
      ctx.fillText(`${a.year}`, x, up ? y - 9 : y + 16);
    }
  }
  // cursor
  const cx = yearsX(yearNow, w);
  ctx.strokeStyle = 'rgba(242,181,68,0.85)'; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(cx, 24); ctx.lineTo(cx, h - 30); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#f2b544'; ctx.textAlign = 'center'; ctx.font = '600 12px "SF Mono", Monaco, monospace';
  ctx.fillText(`${yearNow}`, cx, 16);
}
function refreshYear() {
  $('#yearReadout').textContent = yearNow;
  $('#yearSlider').value = yearNow;
  const t = translateYear(yearNow);
  $('#yDensity').textContent = fmtDensity(densityAt(yearNow));
  $('#yCapacity').textContent = fmtBytes(capacityAt(yearNow));
  const cost = costPerMbAt(yearNow);
  $('#yCost').textContent = cost >= 1 ? `$${fmtInt(cost)}/MB` : cost >= 0.01 ? `$${cost.toFixed(2)}/MB` : `$${cost.toExponential(1)}/MB`;
  const buys = hundredDollarsBuysMb(yearNow);
  $('#yHundred').textContent = fmtBytes(buys);
  $('#yTranslate').textContent = `${fmtInt(t.drives)} drives · ${fmtInt(t.tons)} t`;
  document.querySelectorAll('#yearPresets .btn-preset').forEach((b) => b.classList.toggle('active', +b.dataset.year === yearNow));
  drawYears();
}
const yearSlider = $('#yearSlider');
yearSlider.addEventListener('input', () => { yearNow = +yearSlider.value; refreshYear(); });
(function buildPresets() {
  const years = [1956, 1962, 1973, 1980, 2000, 2007, 2024];
  const box = $('#yearPresets');
  for (const y of years) {
    const b = document.createElement('button');
    b.className = 'btn-preset'; b.dataset.year = y; b.textContent = y;
    b.addEventListener('click', () => { yearNow = y; refreshYear(); });
    box.appendChild(b);
  }
})();
$('#yDoubling').textContent =
  'Density doubled every 2.25 years across 1956–2024 (1.9 yr before 1980, 2.5 yr after); flagship capacity every 3.0.';

(function buildTimeline() {
  const strip = $('#timelineStrip');
  for (const m of MILESTONES) {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    const d = document.createElement('div'); d.className = 'timeline-date';
    d.textContent = m.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1 · $2');
    const t = document.createElement('div'); t.className = 'timeline-text'; t.textContent = m.text;
    item.append(d, t); strip.appendChild(item);
  }
})();

// ============================================================ demo + boot
syncSliders(); refreshHeadVisual(); refreshAddress(); refreshRaceStats();
renderTiming({ settle: SETTLE_MS, vert: 0, horiz: 0, latency: REV_MS / 2 }, SETTLE_MS + REV_MS / 2);
setMessage('RAMAC 350 DISK FILE IBM SAN JOSE 1956');
drawRace(); drawYears(); refreshYear();
requestAnimationFrame((ts) => { lastTs = ts; requestAnimationFrame(tick); });

window.__demo = {
  setAddress({ surface, track, record } = {}) {
    if (surface) target.surface = Math.min(100, Math.max(1, Math.round(surface)));
    if (track) target.track = Math.min(100, Math.max(1, Math.round(track)));
    if (record) target.record = Math.min(5, Math.max(1, Math.round(record)));
    syncSliders(); refreshAddress();
    startSeek({ surface: target.surface, track: target.track });
  },
  seekRandom() { $('#randomBtn').click(); },
  runRace() { activateTab('tab-race'); raceAnim.active = true; raceAnim.t = 0; },
  setMessage,
  setYear(y) { yearNow = y; refreshYear(); },
};
