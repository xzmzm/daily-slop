/* ==========================================================================
   Random Surfer (1997) — studio app.
   Tab 1: link graph + live power iteration + seeded surfer trail.
   Tab 2: the damping knob — residual decay, spectrum, dead ends, d = 1.
   Tab 3: inverted index, AND intersection, BM25 with live k1/b.
   Tab 4: the 1998-style results page blending BM25 × PageRank.
   All drawing is a pure function of state (no wall-clock animation), so
   video capture is deterministic via the __surfer hooks.
   ========================================================================== */

import * as P from './pagerank.js';
import * as E from './engine.js';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const MONO = '"SF Mono", Monaco, "Cascadia Code", "Courier New", monospace';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmtPct = (v) => `${(v * 100).toFixed(2)}%`;

/* ---------- graph presets ---------- */

function ringPositions(n, cx, cy, r) {
  return Array.from({ length: n }, (_, i) => ({
    x: cx + r * Math.cos((i / n) * TAU - Math.PI / 2),
    y: cy + r * Math.sin((i / n) * TAU - Math.PI / 2),
  }));
}

const SNAPSHOT_POS = {
  yahoo: { x: 520, y: 62 }, altavista: { x: 295, y: 58 }, webcrawler: { x: 748, y: 92 },
  lycos: { x: 108, y: 98 }, aol: { x: 886, y: 198 }, cmu: { x: 66, y: 258 },
  dec: { x: 168, y: 218 }, stanford: { x: 258, y: 392 }, backrub: { x: 142, y: 478 },
  searchnotes: { x: 378, y: 482 }, gates360: { x: 108, y: 352 }, geocities: { x: 705, y: 292 },
  fanpage: { x: 560, y: 210 }, homework: { x: 648, y: 432 }, typing: { x: 874, y: 392 },
  googol: { x: 858, y: 506 },
};

const GRAPHS = {
  snapshot: {
    labels: E.DOCS.map((d) => d.id),
    positions: E.DOCS.map((d) => SNAPSHOT_POS[d.id]),
    edges: () => E.SNAPSHOT_EDGES.map((e) => e.slice()),
    seedNode: 0,
  },
  cycle: {
    labels: Array.from({ length: 8 }, (_, i) => `p${i}`),
    positions: ringPositions(8, 500, 272, 198),
    edges: () => P.cycleEdges(8),
    seedNode: 0,
  },
  star: {
    labels: ['hub', ...Array.from({ length: 7 }, (_, i) => `leaf${i + 1}`)],
    positions: [{ x: 500, y: 272 }, ...ringPositions(7, 500, 272, 208)],
    edges: () => P.starEdges(7),
    seedNode: 0,
  },
  pair: {
    labels: ['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4'],
    positions: [
      ...ringPositions(4, 265, 272, 118).map((p) => ({ x: p.x, y: p.y })),
      ...ringPositions(4, 735, 272, 118).map((p) => ({ x: p.x, y: p.y })),
    ],
    edges: () => P.cliquePairEdges(),
    seedNode: 0,
  },
  line: {
    labels: Array.from({ length: 6 }, (_, i) => `p${i}`),
    positions: [
      { x: 105, y: 272 }, { x: 260, y: 200 }, { x: 420, y: 272 },
      { x: 580, y: 200 }, { x: 740, y: 272 }, { x: 895, y: 335 },
    ],
    edges: () => P.lineEdges(6),
    seedNode: 0,
  },
};

/* =========================== TAB 1 — the surfer =========================== */

const S1 = {
  graph: 'snapshot', labels: [], positions: [], edges: [],
  N: 0, x: [], iters: 0, residuals: [], A: null,
  trail: [], at: 0, pending: null, rand: null,
};

function loadGraph1(name) {
  const g = GRAPHS[name];
  S1.graph = name;
  S1.labels = g.labels;
  S1.positions = g.positions;
  S1.edges = g.edges();
  S1.N = S1.labels.length;
  resetIter1();
  document.querySelectorAll('#graphPresets .btn-preset').forEach((b) =>
    b.classList.toggle('active', b.dataset.graph === name));
}

function resetIter1() {
  S1.A = P.linkMatrix(S1.edges, S1.N, true);
  S1.x = P.uniform(S1.N);
  S1.iters = 0;
  S1.residuals = [];
  S1.rand = P.mulberry32(20260915);
  S1.at = GRAPHS[S1.graph].seedNode;
  S1.trail = [S1.at];
  S1.pending = null;
  drawGraph1();
}

function step1(n = 1) {
  for (let k = 0; k < n; k++) {
    const y = P.googleStep(S1.A, S1.x, P.D_PAPER);
    S1.residuals.push(P.l1(y, S1.x));
    S1.x = y;
    S1.iters++;
    S1.at = P.surferHop(S1.edges, S1.N, S1.at, S1.rand, P.D_PAPER);
    S1.trail.push(S1.at);
    if (S1.trail.length > 14) S1.trail.shift();
  }
  drawGraph1();
}

function clickNode1(i) {
  if (S1.pending === null) {
    S1.pending = i;
  } else if (S1.pending === i) {
    S1.pending = null;
  } else {
    const f = S1.pending;
    const at = S1.edges.findIndex(([a, b]) => a === f && b === i);
    if (at >= 0) S1.edges.splice(at, 1);
    else S1.edges.push([f, i]);
    S1.pending = null;
    resetIter1();
    return;
  }
  drawGraph1();
}

function nodeRadius(i) {
  const rmax = Math.max(...S1.x);
  return 9 + 22 * Math.sqrt(S1.x[i] / (rmax || 1));
}

function drawGraph1() {
  const cv = $('surferCanvas');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 1000, 540);
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, 1000, 540);

  const outdeg = new Array(S1.N).fill(0);
  for (const [f] of S1.edges) outdeg[f]++;

  // edges with arrowheads
  ctx.lineWidth = 1.4;
  for (const [f, t] of S1.edges) {
    const a = S1.positions[f], b = S1.positions[t];
    const ra = nodeRadius(f) + 3, rb = nodeRadius(t) + 6;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const ax = a.x + ux * ra, ay = a.y + uy * ra;
    const bx = b.x - ux * rb, by = b.y - uy * rb;
    const isTrailEdge = S1.trail.length >= 2 &&
      S1.trail[S1.trail.length - 2] === f && S1.trail[S1.trail.length - 1] === t;
    ctx.strokeStyle = isTrailEdge ? 'rgba(87,217,163,0.95)' : 'rgba(106,166,240,0.34)';
    ctx.lineWidth = isTrailEdge ? 2.4 : 1.4;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = isTrailEdge ? 'rgba(87,217,163,0.95)' : 'rgba(106,166,240,0.5)';
    ctx.beginPath();
    ctx.moveTo(bx + ux * 2, by + uy * 2);
    ctx.lineTo(bx - uy * 4.5 - ux * 3, by + ux * 4.5 - uy * 3);
    ctx.lineTo(bx + uy * 4.5 - ux * 3, by - ux * 4.5 - uy * 3);
    ctx.closePath(); ctx.fill();
  }
  ctx.lineWidth = 1.4;

  // surfer trail
  for (let k = 0; k < S1.trail.length - 1; k++) {
    const p1 = S1.positions[S1.trail[k]];
    const p2 = S1.positions[S1.trail[k + 1]];
    ctx.strokeStyle = `rgba(87,217,163,${0.08 + 0.5 * (k / S1.trail.length)})`;
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // nodes
  const order = S1.x.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  const top3 = new Set(order.slice(0, 3).map(([, i]) => i));
  for (let i = 0; i < S1.N; i++) {
    const p = S1.positions[i];
    const r = nodeRadius(i);
    if (outdeg[i] === 0) ctx.setLineDash([4, 4]);
    const fill = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 1, p.x, p.y, r);
    fill.addColorStop(0, '#1d2c45');
    fill.addColorStop(1, '#0e141f');
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = top3.has(i) ? '#f2c14e' : '#6aa6f0';
    ctx.lineWidth = top3.has(i) ? 3 : 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1.4;
    ctx.fillStyle = top3.has(i) ? '#f2c14e' : 'rgba(233,230,220,0.92)';
    ctx.font = `11.5px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(S1.labels[i], p.x, p.y - r - 7);
    if (top3.has(i)) {
      ctx.fillStyle = 'rgba(242,193,78,0.85)';
      ctx.fillText(fmtPct(S1.x[i]), p.x, p.y + r + 14);
    } else {
      ctx.fillStyle = 'rgba(152,163,182,0.6)';
      ctx.fillText(fmtPct(S1.x[i]), p.x, p.y + r + 14);
    }
    if (S1.pending === i) {
      ctx.strokeStyle = '#e0564e';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 8, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1.4;
    }
    // rank bar
    const rmax = Math.max(...S1.x);
    const bw = 54 * (S1.x[i] / (rmax || 1));
    ctx.fillStyle = 'rgba(11,15,21,0.9)';
    ctx.fillRect(p.x - 27, p.y + r + 18, 54, 5);
    ctx.fillStyle = top3.has(i) ? '#f2c14e' : '#3b6cb8';
    ctx.fillRect(p.x - 27, p.y + r + 18, bw, 5);
  }

  // the surfer herself
  const sp = S1.positions[S1.at];
  ctx.fillStyle = 'rgba(87,217,163,0.25)';
  ctx.beginPath(); ctx.arc(sp.x, sp.y, nodeRadius(S1.at) + 7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#57d9a3';
  ctx.beginPath(); ctx.arc(sp.x, sp.y, 5, 0, TAU); ctx.fill();

  // hint
  ctx.textAlign = 'left';
  ctx.font = `11px ${MONO}`;
  ctx.fillStyle = 'rgba(95,108,128,1)';
  ctx.fillText(S1.pending !== null
    ? `link from ${S1.labels[S1.pending]} — click a target page`
    : 'click a page, then another, to add or remove a link', 16, 524);
  if (outdeg.includes(0)) {
    ctx.fillStyle = 'rgba(224,86,78,0.85)';
    ctx.fillText('dashed = no outlinks (dangling): column spread uniformly', 470, 524);
  }

  // readouts
  const last = S1.residuals[S1.residuals.length - 1];
  const ratio = P.measuredFactor(S1.residuals);
  $('iterName').textContent = `ITERATION ${S1.iters}`;
  $('residualOut').textContent = `residual ‖Δr‖₁ = ${last === undefined ? '—' : last.toExponential(2)}`;
  $('ratioOut').textContent = `decay ratio = ${ratio === null ? '—' : ratio.toFixed(4)}`;
  $('sumOut').textContent = `Σr = ${P.sum(S1.x).toFixed(9)}`;
  $('surferMeta').textContent = `iteration ${S1.iters} · d = 0.85 · surfer at ${S1.labels[S1.at]}`;

  const rows = order.slice(0, 9).map(([v, i], n) => `
    <div class="rank-item ${n === 0 ? 'top' : ''}">
      <span class="rank-pos">${n + 1}</span>
      <span class="rank-name">${S1.labels[i]}</span>
      <span class="rank-bar"><i style="width:${(v / order[0][0]) * 100}%"></i></span>
      <span class="rank-val">${fmtPct(v)}</span>
    </div>`).join('');
  $('rankList').innerHTML = rows;
}

$('surferCanvas').addEventListener('click', (ev) => {
  const rect = ev.target.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (1000 / rect.width);
  const y = (ev.clientY - rect.top) * (540 / rect.height);
  let best = -1;
  let bd = 1e9;
  for (let i = 0; i < S1.N; i++) {
    const d = Math.hypot(S1.positions[i].x - x, S1.positions[i].y - y);
    if (d < bd) { bd = d; best = i; }
  }
  if (best >= 0 && bd < nodeRadius(best) + 14) clickNode1(best);
  else if (S1.pending !== null) { S1.pending = null; drawGraph1(); }
});
$('stepBtn').addEventListener('click', () => step1(1));
$('runBtn').addEventListener('click', () => step1(60));
$('resetBtn').addEventListener('click', resetIter1);
document.querySelectorAll('#graphPresets .btn-preset').forEach((b) =>
  b.addEventListener('click', () => loadGraph1(b.dataset.graph)));

/* =========================== TAB 2 — why 0.85 =========================== */

const S2 = { graph: 'cycle', d: 0.85, repair: true, residuals: [], x: [], mass: 1 };

function loadGraph2(name) {
  S2.graph = name;
  S2.residuals = [];
  S2.x = [];
  document.querySelectorAll('#specPresets .btn-preset').forEach((b) =>
    b.classList.toggle('active', b.dataset.graph === name));
  drawConv();
  updateSpec();
}

function runPow2(n = 120) {
  const edges = GRAPHS[S2.graph].edges();
  const N = GRAPHS[S2.graph].labels.length;
  const A = P.linkMatrix(edges, N, S2.repair);
  const { x, residuals } = P.powerIterate(A, P.pointMass(N, 0), S2.d, n);
  S2.x = x;
  S2.residuals = residuals;
  S2.mass = P.sum(x);
  drawConv();
  updateSpec();
}

function drawConv() {
  const cv = $('convCanvas');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 1000, 540);
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, 1000, 540);

  const L = 68, R = 960, T = 30, B = 470;
  const ymin = -16, ymax = 0.5;
  const X = (i) => L + (i / 120) * (R - L);
  const Y = (v) => T + ((ymax - v) / (ymax - ymin)) * (B - T);

  // grid
  ctx.strokeStyle = 'rgba(38,50,74,0.8)';
  ctx.fillStyle = 'rgba(95,108,128,0.9)';
  ctx.font = `10.5px ${MONO}`;
  ctx.textAlign = 'right';
  for (let e = 0; e >= -16; e -= 4) {
    ctx.beginPath(); ctx.moveTo(L, Y(e)); ctx.lineTo(R, Y(e)); ctx.stroke();
    ctx.fillText(`1e${e}`, L - 8, Y(e) + 3);
  }
  ctx.textAlign = 'center';
  for (let i = 0; i <= 120; i += 20) {
    ctx.beginPath(); ctx.moveTo(X(i), B); ctx.lineTo(X(i), B + 6); ctx.stroke();
    ctx.fillText(String(i), X(i), B + 20);
  }
  ctx.fillText('iteration', (L + R) / 2, B + 40);

  // convergence threshold
  ctx.strokeStyle = 'rgba(242,193,78,0.5)';
  ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(L, Y(-6)); ctx.lineTo(R, Y(-6)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(242,193,78,0.75)';
  ctx.textAlign = 'left';
  ctx.fillText('ε = 1e−6', L + 8, Y(-6) - 6);

  if (!S2.residuals.length) {
    ctx.fillStyle = 'rgba(152,163,182,0.7)';
    ctx.font = `13px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('RUN 120 ITERATIONS to draw the decay', (L + R) / 2, (T + B) / 2);
  } else {
    // worst-case guide slope ln(d)
    const guide = (i) => Math.log10(Math.max(S2.residuals[0], 1e-16)) + (i / 120) * 0 + i * (Math.log10(S2.d));
    ctx.strokeStyle = 'rgba(224,86,78,0.45)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 120; i++) {
      const v = clamp(guide(i), ymin, ymax);
      if (!started) { ctx.moveTo(X(i), Y(v)); started = true; } else ctx.lineTo(X(i), Y(v));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(224,86,78,0.8)';
    ctx.font = `11px ${MONO}`;
    ctx.fillText(`worst-case slope ln(d) = ${Math.log10(S2.d).toFixed(3)} / iteration`, L + 190, Y(clamp(guide(84), ymin, ymax)) - 10);

    // empirical curve
    ctx.strokeStyle = '#6aa6f0';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    S2.residuals.forEach((r, i) => {
      const v = clamp(Math.log10(Math.max(r, 1e-16)), ymin, ymax);
      if (i === 0) ctx.moveTo(X(i), Y(v)); else ctx.lineTo(X(i), Y(v));
    });
    ctx.stroke();
    ctx.lineWidth = 1.4;
  }

  // verdict
  const tail = S2.residuals.length ? S2.residuals[S2.residuals.length - 1] : null;
  const convAt = S2.residuals.findIndex((r) => r < 1e-6);
  const meas = P.measuredFactor(S2.residuals);
  let name = 'AWAITING RUN', val = '—';
  if (tail !== null) {
    if (!S2.repair && S2.mass < 0.5) {
      name = 'DRAINING';
      val = `dead end eats the walk — mass Σr = ${S2.mass.toFixed(4)} after 120 iterations`;
    } else if (convAt >= 0) {
      name = 'CONVERGED';
      val = `residual under 1e−6 at iteration ${convAt + 1}`;
    } else if (meas !== null && meas > 0.995) {
      name = 'NO LIMIT';
      val = 'residual never decays — the iteration cycles forever';
    } else {
      name = 'STILL DECAYING';
      val = `residual ${tail.toExponential(2)} after 120 iterations`;
    }
  }
  $('convName').textContent = name;
  $('convName').classList.toggle('miss', name === 'NO LIMIT' || name === 'DRAINING');
  $('convVal').textContent = val;
  $('factorVal').textContent = meas === null ? '—' : `measured factor ${meas.toFixed(4)}`;
  $('convMeta').textContent = `${S2.graph} · d = ${S2.d.toFixed(2)} · repair ${S2.repair ? 'on' : 'off'}`;
  $('massOut').textContent = S2.x.length ? S2.mass.toFixed(6) : '—';
  $('measOut').textContent = meas === null ? '—' : meas.toFixed(4);
}

function updateSpec() {
  const edges = GRAPHS[S2.graph].edges();
  const N = GRAPHS[S2.graph].labels.length;
  const A = P.linkMatrix(edges, N, S2.repair);
  $('itersOut').textContent = String(P.iterationsFor(1e-6, S2.d));
  try {
    const spec = P.specGoogle(A, S2.d);
    const f = P.spectralGapFactor(A, S2.d);
    $('specOut').textContent = f.toFixed(4);
    $('eigenList').innerHTML = spec
      .sort((a, b) => Math.hypot(b.re, b.im) - Math.hypot(a.re, a.im))
      .map((m) => {
        const mod = Math.hypot(m.re, m.im);
        const im = Math.abs(m.im) < 1e-7 ? '' : `${m.im >= 0 ? '+' : '−'}${Math.abs(m.im).toFixed(2)}i`;
        const lead = Math.abs(m.re - 1) < 1e-7 && im === '';
        return `<span class="eigen-chip ${lead ? 'lead' : m.im ? 'complex' : ''}">${m.re.toFixed(2)}${im} · |λ|=${mod.toFixed(2)}</span>`;
      }).join('');
  } catch {
    $('specOut').textContent = '—';
    $('eigenList').innerHTML = '<span class="eigen-chip">spectrum: bench graphs only</span>';
  }
}

$('dSlider').addEventListener('input', (ev) => {
  S2.d = +ev.target.value;
  $('dReadout').textContent = S2.d.toFixed(2);
  if (S2.residuals.length) runPow2(120); else updateSpec();
});
$('runPowBtn').addEventListener('click', () => runPow2(120));
$('showdownBtn').addEventListener('click', () => {
  document.querySelector('#specPresets .btn-preset[data-graph="cycle"]').click();
  S2.d = 1.0;
  $('dSlider').value = 1.0;
  $('dReadout').textContent = '1.00';
  S2.repair = true;
  $('repairCheck').checked = true;
  runPow2(120);
});
$('repairCheck').addEventListener('change', (ev) => {
  S2.repair = ev.target.checked;
  if (S2.residuals.length) runPow2(120); else updateSpec();
});
document.querySelectorAll('#specPresets .btn-preset').forEach((b) =>
  b.addEventListener('click', () => loadGraph2(b.dataset.graph)));

/* =========================== TAB 3 — the index =========================== */

const IDX = E.buildIndex();
const S3 = { query: 'web search', k1: 1.2, b: 0.75 };

function renderIndex() {
  const res = E.searchAND(IDX, S3.query, S3.k1, S3.b);
  const dym = E.didYouMean(IDX, S3.query);
  const liveSet = new Set(res.docs.map((d) => d.i));

  // posting rows
  const rows = res.terms.map((t) => {
    const list = IDX.postings[t];
    if (!list) {
      const hit = dym.find((x) => x.from === t);
      return `<div class="posting-row">
        <span class="posting-term dead">${t} — 0 docs</span>
        <span class="doc-chip cut">not in index${hit ? ` → did you mean <b style="color:var(--chrome-yellow)">${hit.to}</b> (lev ${hit.dist})` : ''}</span>
      </div>`;
    }
    return `<div class="posting-row">
      <span class="posting-term">${t} · df ${list.length}</span>
      <span class="posting-chips">${list.map((i) =>
        `<span class="doc-chip ${liveSet.has(i) ? 'live' : 'cut'}">${IDX.docs[i].id}</span>`).join('')}</span>
    </div>`;
  }).join('');
  $('postingsWrap').innerHTML = res.terms.length
    ? rows + (res.killedBy
      ? `<div class="posting-row"><span class="doc-chip cut">AND cut to zero at “${res.killedBy}” — 0 results</span></div>`
      : `<div class="posting-row"><span class="doc-chip live">AND survivors: ${res.docs.length} page${res.docs.length === 1 ? '' : 's'}</span></div>`)
    : '<div class="posting-row"><span class="doc-chip cut">type a query</span></div>';

  // BM25 rows
  const max = res.docs.length ? res.docs[0].score : 0;
  $('bmResults').innerHTML = res.docs.slice(0, 8).map((d) => {
    const tfs = res.terms.map((t) => `${t}×${IDX.tf[d.i][t] || 0}`).join(' ');
    return `<div class="bm-row">
      <span class="bm-name">${IDX.docs[d.i].id}</span>
      <span class="bm-bar"><i style="width:${max > 0 ? (d.score / max) * 100 : 0}%"></i></span>
      <span class="bm-tf">${tfs}</span>
      <span class="bm-score">${d.score.toFixed(3)}</span>
    </div>`;
  }).join('') || '<div class="bm-row"><span class="bm-name">— no AND survivors —</span></div>';

  // substituted formula for the top doc
  if (res.docs.length) {
    const top = res.docs[0];
    const parts = res.terms.map((t) => {
      const f = IDX.tf[top.i][t] || 0;
      const norm = S3.k1 * (1 - S3.b + (S3.b * IDX.len[top.i]) / IDX.avgdl);
      return `${t}: idf ${E.idf(IDX, t).toFixed(2)} × ${f}·${(S3.k1 + 1).toFixed(2)}/(${f} + ${norm.toFixed(2)}) = ${E.bm25Term(IDX, top.i, t, S3.k1, S3.b).toFixed(2)}`;
    });
    $('formulaLine').innerHTML =
      `score(${IDX.docs[top.i].id}) = Σ idf·tf(k₁+1)/(tf + k₁(1−b+b·L/avgdl)) — L ${IDX.len[top.i]} · avgdl ${IDX.avgdl.toFixed(1)} · k₁ ${S3.k1.toFixed(2)} · b ${S3.b.toFixed(2)}<br>${parts.join(' &nbsp;+&nbsp; ')} &nbsp;=&nbsp; <b>${top.score.toFixed(3)}</b>`;
  } else {
    $('formulaLine').innerHTML = 'no page contains every query term — the AND engine returns nothing';
  }
  $('indexMeta').textContent = `${res.docs.length} results · AND over ${res.terms.length} term${res.terms.length === 1 ? '' : 's'}`;
  $('corpusV').textContent = String(IDX.vocab.length);
  $('corpusAvg').textContent = IDX.avgdl.toFixed(1);
  $('k1Readout').textContent = S3.k1.toFixed(2);
  $('bReadout').textContent = S3.b.toFixed(2);
  drawSaturation();
}

function drawSaturation() {
  const cv = $('satCanvas');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 300, 170);
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, 300, 170);
  const L = 30, R = 292, T = 12, B = 140;
  const tfMax = 10, yMax = 2.6;
  const X = (tf) => L + (tf / tfMax) * (R - L);
  const Y = (s) => T + ((yMax - s) / yMax) * (B - T);
  const curve = (lenRatio, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let tf = 1; tf <= tfMax; tf += 0.25) {
      const norm = S3.k1 * (1 - S3.b + S3.b * lenRatio);
      const s = (tf * (S3.k1 + 1)) / (tf + norm);
      if (tf === 1) ctx.moveTo(X(tf), Y(s)); else ctx.lineTo(X(tf), Y(s));
    }
    ctx.stroke();
    ctx.lineWidth = 1.4;
  };
  ctx.strokeStyle = 'rgba(38,50,74,0.8)';
  ctx.font = `9px ${MONO}`;
  ctx.fillStyle = 'rgba(95,108,128,0.9)';
  [0, 1, 2].forEach((s) => {
    ctx.beginPath(); ctx.moveTo(L, Y(s)); ctx.lineTo(R, Y(s)); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(String(s), L - 4, Y(s) + 3);
  });
  [1, 5, 10].forEach((tf) => {
    ctx.textAlign = 'center'; ctx.fillText(String(tf), X(tf), B + 12);
  });
  ctx.fillText('tf', (L + R) / 2, B + 24);
  // saturation ceiling idf·(k1+1) with idf=1
  ctx.strokeStyle = 'rgba(242,193,78,0.5)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(L, Y(S3.k1 + 1)); ctx.lineTo(R, Y(S3.k1 + 1)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(224,86,78,0.5)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(L, Y(1)); ctx.lineTo(R, Y(1)); ctx.stroke();
  ctx.setLineDash([]);
  curve(0.5, '#e0564e');
  curve(1.0, '#f2c14e');
  curve(1.8, '#6aa6f0');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e0564e'; ctx.fillText('L = 0.5·avgdl', R - 118, T + 10);
  ctx.fillStyle = '#f2c14e'; ctx.fillText('L = avgdl', R - 60, T + 22);
  ctx.fillStyle = '#6aa6f0'; ctx.fillText('L = 1.8·avgdl', R - 108, T + 34);
}

$('searchBtn').addEventListener('click', () => {
  S3.query = $('queryInput').value;
  renderIndex();
});
$('queryInput').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') $('searchBtn').click();
});
document.querySelectorAll('#queryPresets .btn-preset').forEach((b) =>
  b.addEventListener('click', () => {
    S3.query = b.dataset.q;
    $('queryInput').value = S3.query;
    document.querySelectorAll('#queryPresets .btn-preset').forEach((x) =>
      x.classList.toggle('active', x === b));
    renderIndex();
  }));
$('k1Slider').addEventListener('input', (ev) => { S3.k1 = +ev.target.value; renderIndex(); });
$('bSlider').addEventListener('input', (ev) => { S3.b = +ev.target.value; renderIndex(); });

/* =========================== TAB 4 — the first results page =========================== */

const PR_SNAPSHOT = P.solveRank(E.SNAPSHOT_EDGES, E.DOCS.length, P.D_PAPER, true);
const S4 = { alpha: 0.35, query: 'web search' };

function renderRetro() {
  const t0 = performance.now();
  const res = E.blendResults(IDX, PR_SNAPSHOT, S4.query, S4.alpha);
  const ms = performance.now() - t0;
  const dym = E.didYouMean(IDX, S4.query);

  let inner;
  if (!res.docs.length) {
    inner = `<div class="retro-empty">
      <p>Your search - <b>${S4.query.replace(/</g, '&lt;')}</b> - did not match any documents.</p>
      ${dym.length ? `<p class="dym">Did you mean: <a data-q="${dym[0].to}">${dym[0].to}</a> ?</p>` : ''}
      <p style="margin-top:16px; font-size:12.5px; color:#444;">Suggestions: — make sure all words are spelled correctly<br>— try different keywords<br>— try more general keywords</p>
    </div>`;
  } else {
    inner = `<p class="retro-count"><b>Results 1 - ${res.docs.length}</b> of about ${res.docs.length}. &nbsp;(${(ms / 1000).toFixed(2)} seconds)</p>` +
      res.docs.slice(0, 8).map((d, n) => {
        const doc = IDX.docs[d.i];
        return `<div class="retro-result">
          <p class="retro-title"><a data-q="${doc.id}">${n + 1}. ${doc.site} — ${doc.title}</a></p>
          <p class="retro-url">${doc.url} · linked from ${E.SNAPSHOT_EDGES.filter(([, t]) => t === d.i).length} page(s)</p>
          <p class="retro-snippet">${E.snippet(doc, res.terms)}</p>
          <div class="retro-scores">
            <span class="retro-score">bm25 ${d.bm.toFixed(2)}</span>
            <span class="retro-score">rank ${fmtPct(d.pr)}</span>
            <span class="retro-score">blend ${(d.final * 100).toFixed(0)}</span>
          </div>
        </div>`;
      }).join('');
  }
  $('retroPage').innerHTML = `
    <div class="retro-top">
      <div class="retro-logo"><span class="g1">G</span><span class="o1">o</span><span class="o2">o</span><span class="g2">g</span><span class="l1">l</span><span class="e1">e</span><span class="bang">!</span><span class="retro-beta">SNAPSHOT BETA</span></div>
      <div class="retro-searchline">Search the snapshot of 14 Sep 1997 — 16 pages</div>
    </div>
    <p class="retro-count" style="margin-top:10px;"><b>Searched the snapshot for: ${res.terms.length ? res.terms.map((t) => `<span style="color:#0000ee;">${t}</span>`).join(' ') : '—'}</b> &nbsp;·&nbsp; blend α = ${S4.alpha.toFixed(2)}</p>
    ${inner}
    <div class="retro-footer">© 1997 Snapshot Engine — an AND engine over 16 pages, ranked by one eigenvector and 40 lines of arithmetic. The real one was 24 million pages.</div>`;

  $('retroPage').querySelectorAll('a[data-q]').forEach((a) =>
    a.addEventListener('click', () => {
      window.__surfer.setQuery4(a.dataset.q);
    }));

  const bmOnly = E.blendResults(IDX, PR_SNAPSHOT, S4.query, 0).docs[0];
  const prOnly = E.blendResults(IDX, PR_SNAPSHOT, S4.query, 1).docs[0];
  $('winnerBm').textContent = bmOnly ? IDX.docs[bmOnly.i].id : '—';
  $('winnerPr').textContent = prOnly ? IDX.docs[prOnly.i].id : '—';
  $('alphaReadout').textContent = `α = ${S4.alpha.toFixed(2)}`;
}

$('alphaSlider').addEventListener('input', (ev) => {
  S4.alpha = +ev.target.value;
  renderRetro();
});
document.querySelectorAll('#q4Presets .btn-preset').forEach((b) =>
  b.addEventListener('click', () => {
    window.__surfer.setQuery4(b.dataset.q);
  }));

/* =========================== timeline =========================== */

const TIMELINE = [
  { date: '1996', text: 'BackRub crawls from Stanford: a search engine that ranks pages by their back links, the way papers collect citations.' },
  { date: '15 SEP 1997 ★', text: 'In room 360 of the Gates building, Sean Anderson checks whether googol.com is free — and types google.com. Larry Page likes the misspelling and registers it within hours.' },
  { date: 'APR 1998', text: 'The Anatomy paper at WWW7 Brisbane: 24 million pages, 322 million links, rank converged in 52 iterations at d = 0.85.' },
  { date: '4 SEP 1998', text: 'Google Inc. incorporates; first office is Susan Wojcicki’s garage in Menlo Park, rent $1,700.' },
  { date: 'JUN 2000', text: 'The index passes one billion URLs — the directory era quietly ends.' },
  { date: 'JUL 2008', text: '“We knew the web was big”: the crawl finds 1 trillion unique URLs at one moment.' },
  { date: '2016', text: 'How Search Works cites 130 trillion documents in the index.' },
  { date: '15 SEP 2026', text: 'The typo turns 29. The eigenvector never stopped iterating.' },
];
$('timelineStrip').innerHTML = TIMELINE.map((m) => `
  <div class="timeline-item ${m.date.includes('★') ? 'star' : ''}">
    <div class="timeline-date">${m.date}</div>
    <div class="timeline-text">${m.text}</div>
  </div>`).join('');

/* =========================== tabs / boot / demo =========================== */

function setTab(id) {
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === id));
  document.querySelectorAll('.nav-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === id));
}
document.querySelectorAll('.nav-tab').forEach((t) =>
  t.addEventListener('click', () => setTab(t.dataset.tab)));

loadGraph1('snapshot');
loadGraph2('cycle');
renderIndex();
renderRetro();

window.__surfer = {
  setTab,
  loadGraph: loadGraph1,
  step: step1,
  run: (n = 60) => step1(n),
  reset: resetIter1,
  clickNode: (id) => {
    const i = S1.labels.indexOf(id);
    if (i >= 0) clickNode1(i);
  },
  nodePos: (id) => {
    const i = S1.labels.indexOf(id);
    const rect = $('surferCanvas').getBoundingClientRect();
    return i >= 0 ? { x: S1.positions[i].x * (rect.width / 1000), y: S1.positions[i].y * (rect.height / 540) } : null;
  },
  setD: (v) => { S2.d = v; $('dSlider').value = v; $('dReadout').textContent = v.toFixed(2); runPow2(120); },
  setRepair: (v) => { S2.repair = v; $('repairCheck').checked = v; runPow2(120); },
  runPow: runPow2,
  setGraph2: loadGraph2,
  setK1: (v) => { S3.k1 = v; $('k1Slider').value = v; renderIndex(); },
  setB: (v) => { S3.b = v; $('bSlider').value = v; renderIndex(); },
  setQuery: (q) => { S3.query = q; $('queryInput').value = q; renderIndex(); },
  setAlpha: (v) => { S4.alpha = v; $('alphaSlider').value = v; renderRetro(); },
  setQuery4: (q) => {
    S4.query = q;
    document.querySelectorAll('#q4Presets .btn-preset').forEach((x) =>
      x.classList.toggle('active', x.dataset.q === q));
    renderRetro();
  },
  get state() {
    return { s1: { ...S1 }, s2: { ...S2 }, s3: { ...S3 }, s4: { ...S4 } };
  },
};
