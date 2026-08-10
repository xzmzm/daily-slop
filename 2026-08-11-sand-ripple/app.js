// app.js — sand-ripple renderer + controls.
// Drives engine.js (the pure physics) and draws a side-view dune field with
// saltating grains overhead, a live growth-rate spectrum, and live readouts.

'use strict';

const E = (typeof module !== 'undefined' && module.exports) ? module.exports : window;

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
const N = 768;
const P = { N, C: 0.35, D: 0.20, L: 4.2, cotAlpha: 5.14, reposeDeg: 33, dxMeters: 0.004 };

let bed;                 // Float64Array, the bed profile
let running = false;
let stepCount = 0;
let stepsPerFrame = 6;
let grains = [];         // saltating grains in flight (display only)
let scratchRng = 99;

function makeBed() {
  bed = new Float64Array(N);
  // tiny white-noise seed — the bed instability amplifies it
  for (let i = 0; i < N; i++) bed[i] = (hashRand() - 0.5) * 0.002;
  stepCount = 0;
}

function hashRand() {
  scratchRng = (scratchRng * 1103515245 + 12345) & 0x7fffffff;
  return scratchRng / 0x7fffffff;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas setup (DPR-aware)
// ─────────────────────────────────────────────────────────────────────────────
const skyCanvas   = document.getElementById('sky');
const bedCanvas   = document.getElementById('bed');
const grainCanvas = document.getElementById('grains');
const specCanvas  = document.getElementById('spectrum');
const skyCtx = skyCanvas.getContext('2d');
const bedCtx = bedCanvas.getContext('2d');
const gCtx   = grainCanvas.getContext('2d');
const sCtx   = specCanvas.getContext('2d');

function fitCanvas(cv) {
  const dpr = window.devicePixelRatio || 1;
  const r = cv.getBoundingClientRect();
  cv.width  = Math.max(1, Math.round(r.width  * dpr));
  cv.height = Math.max(1, Math.round(r.height * dpr));
  return dpr;
}
let skyDpr, bedDpr, gDpr, specDpr;
function resize() {
  skyDpr  = fitCanvas(skyCanvas);
  bedDpr  = fitCanvas(bedCanvas);
  gDpr    = fitCanvas(grainCanvas);
  specDpr = fitCanvas(specCanvas);
  drawSky();
  drawAll();
}
window.addEventListener('resize', resize);

// ─────────────────────────────────────────────────────────────────────────────
// Sky (static desert haze with a low sun)
// ─────────────────────────────────────────────────────────────────────────────
function drawSky() {
  const ctx = skyCtx;
  const W = skyCanvas.width, H = skyCanvas.height;
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0,    '#f4d9a6');
  g.addColorStop(0.55, '#f0c98a');
  g.addColorStop(1,    '#e8b878');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // low sun
  const sx = W * 0.78, sy = H * 0.22, sr = Math.min(W, H) * 0.08;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3);
  sg.addColorStop(0,   'rgba(255,250,220,0.95)');
  sg.addColorStop(0.3, 'rgba(255,238,190,0.55)');
  sg.addColorStop(1,   'rgba(255,238,190,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(sx, sy, sr * 3, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = 'rgba(255,253,235,0.95)';
  ctx.beginPath(); ctx.arc(sx, sy, sr * 0.8, 0, 2 * Math.PI); ctx.fill();
  // wind streaks
  ctx.strokeStyle = 'rgba(255,250,230,0.18)';
  ctx.lineWidth = 1.5;
  for (let s = 0; s < 14; s++) {
    const y = (s + 0.5) / 14 * H * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 40) {
      ctx.lineTo(x, y + Math.sin(x * 0.01 + s) * 4);
    }
    ctx.stroke();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bed renderer
// ─────────────────────────────────────────────────────────────────────────────
function bedGeometry() {
  const W = bedCanvas.width;
  const H = bedCanvas.height;
  // vertical autoscale: map the bed's relief into a comfortable band
  let hmin = +Infinity, hmax = -Infinity;
  for (let i = 0; i < N; i++) { hmin = Math.min(hmin, bed[i]); hmax = Math.max(hmax, bed[i]); }
  const relief = Math.max(hmax - hmin, 0.02);
  // keep a little headroom above the tallest crest
  const padTop = 0.55 * H;
  const bedFloor = H - 8 * bedDpr;     // 8px floor
  const amp = Math.min(padTop, H * 0.42) / Math.max(relief, 0.5) * 0.9;
  const mean = 0.5 * (hmin + hmax);
  return { W, H, amp, mean, bedFloor };
}

function drawBed() {
  const ctx = bedCtx;
  const { W, H, amp, mean, bedFloor } = bedGeometry();
  ctx.clearRect(0, 0, W, H);

  // Build the top profile path.
  const xs = new Float64Array(N);
  const ys = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    xs[i] = (i / (N - 1)) * W;
    ys[i] = bedFloor - (bed[i] - mean) * amp;
  }

  // Fill the sand body.
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let i = 0; i < N; i++) ctx.lineTo(xs[i], ys[i]);
  ctx.lineTo(W, H);
  ctx.closePath();
  const sg = ctx.createLinearGradient(0, bedFloor - amp * 2, 0, H);
  sg.addColorStop(0,   '#e8c994');
  sg.addColorStop(0.4, '#d4a85a');
  sg.addColorStop(1,   '#7d5728');
  ctx.fillStyle = sg;
  ctx.fill();

  // Subtle slip-face shading: where slope is steep & lee (downwind), darken.
  // "Downwind" = +x direction. Use short strips.
  ctx.lineWidth = 1.5 * bedDpr;
  for (let i = 1; i < N - 1; i++) {
    const sl = (bed[i + 1] - bed[i - 1]) / 2;
    if (sl < -0.15) {                                   // lee slope (heights drop toward +x)
      const alpha = Math.min(0.35, -sl * 0.8);
      ctx.strokeStyle = `rgba(94,67,31,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(xs[i - 1], ys[i - 1]);
      ctx.lineTo(xs[i + 1], ys[i + 1]);
      ctx.stroke();
    }
  }

  // Crest line — a thin warm highlight on the very top.
  ctx.strokeStyle = 'rgba(255,244,210,0.85)';
  ctx.lineWidth = 1.5 * bedDpr;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    if (i === 0) ctx.moveTo(xs[i], ys[i]);
    else ctx.lineTo(xs[i], ys[i]);
  }
  ctx.stroke();
}

// ─────────────────────────────────────────────────────────────────────────────
// Saltating grains (display only). Spawn from crests, fly in shallow arcs
// downwind, disappear into the bed. Density tracks wind strength C.
// ─────────────────────────────────────────────────────────────────────────────
function spawnGrains() {
  const rate = Math.floor(P.C * 40 + 1);
  const { W, H, amp, mean, bedFloor } = bedGeometry();
  for (let n = 0; n < rate; n++) {
    if (grains.length > 420) break;
    const i = Math.floor(hashRand() * N);
    const x = (i / (N - 1)) * W;
    const y = bedFloor - (bed[i] - mean) * amp - hashRand() * 6 * bedDpr;
    grains.push({
      x, y,
      vx: (1.6 + hashRand() * 1.4) * bedDpr,
      vy: (-1.2 - hashRand() * 0.8) * bedDpr,
      g:  (0.012 + hashRand() * 0.008) * bedDpr,
      life: 120 + Math.floor(hashRand() * 120),
    });
  }
}

function drawGrains() {
  const ctx = gCtx;
  const W = grainCanvas.width, H = grainCanvas.height;
  ctx.clearRect(0, 0, W, H);
  const { amp, mean, bedFloor } = bedGeometry();
  ctx.fillStyle = 'rgba(120, 88, 45, 0.85)';
  for (let k = grains.length - 1; k >= 0; k--) {
    const g = grains[k];
    g.x += g.vx;
    g.y += g.vy;
    g.vy += g.g;
    g.life--;
    // sample bed height at grain x
    const i = Math.max(0, Math.min(N - 1, Math.round((g.x / W) * (N - 1))));
    const by = bedFloor - (bed[i] - mean) * amp;
    const dead = g.life <= 0 || g.x > W + 10 || g.y >= by - 1;
    if (dead) { grains.splice(k, 1); continue; }
    ctx.fillRect(g.x, g.y, 1.6 * gDpr, 1.6 * gDpr);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Spectrum panel — plot Re σ(k) vs wavelength
// ─────────────────────────────────────────────────────────────────────────────
function drawSpectrum() {
  const ctx = sCtx;
  const W = specCanvas.width, H = specCanvas.height;
  ctx.clearRect(0, 0, W, H);

  // sample σ over k bins, convert to wavelength (cells) for the x axis
  const nBins = 80;
  const pts = [];
  let sigMax = 0;
  for (let b = 2; b <= nBins; b++) {
    const k = 2 * Math.PI * b / N;            // rad/cell
    const sig = E.linearGrowthRate(k, P);
    const lam = (2 * Math.PI) / k;            // cells
    pts.push({ lam, sig });
    if (sig > sigMax) sigMax = sig;
  }
  let sigMin = 0;
  for (const p of pts) sigMin = Math.min(sigMin, p.sig);
  const lamMin = pts[pts.length - 1].lam;     // largest λ at smallest k
  const lamMax = pts[0].lam;
  const mapX = lam => W - ((lam - lamMin) / (lamMax - lamMin)) * W; // invert: long λ left
  const span = Math.max(sigMax, -sigMin, 1e-6);
  const mapY = sig => H - 8 * specDpr - (sig / span) * (H - 18 * specDpr);
  const yZero = mapY(0);

  // zero axis
  ctx.strokeStyle = 'rgba(94,67,31,0.4)';
  ctx.lineWidth = 1 * specDpr;
  ctx.setLineDash([3 * specDpr, 3 * specDpr]);
  ctx.beginPath(); ctx.moveTo(0, yZero); ctx.lineTo(W, yZero); ctx.stroke();
  ctx.setLineDash([]);

  // fill positive (growing) regions red, negative (damping) green
  let poly = null;
  const flushFill = (color) => {
    if (!poly || poly.length < 3) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, yZero);
    for (const p of poly) ctx.lineTo(p.x, p.y);
    ctx.lineTo(poly[poly.length - 1].x, yZero);
    ctx.closePath(); ctx.fill();
  };
  let mode = null;
  for (const p of pts) {
    const x = mapX(p.lam), y = mapY(p.sig);
    const m = p.sig >= 0 ? '+' : '-';
    if (m !== mode) {
      flushFill(mode === '+' ? 'rgba(180,69,31,0.20)' : 'rgba(74,122,90,0.20)');
      poly = [];
      mode = m;
    }
    poly.push({ x, y });
  }
  flushFill(mode === '+' ? 'rgba(180,69,31,0.20)' : 'rgba(74,122,90,0.20)');

  // σ curve
  ctx.strokeStyle = '#5e431f';
  ctx.lineWidth = 1.8 * specDpr;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const x = mapX(pts[i].lam), y = mapY(pts[i].sig);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // λ_fast marker
  const { lambda, k: kFast } = E.fastestWavelength(P);
  const peakSig = E.linearGrowthRate(kFast, P);
  const px = mapX(lambda), py = mapY(peakSig);
  ctx.fillStyle = '#1c1c1c';
  ctx.beginPath();
  ctx.moveTo(px, py - 6 * specDpr);
  ctx.lineTo(px - 4 * specDpr, py - 12 * specDpr);
  ctx.lineTo(px + 4 * specDpr, py - 12 * specDpr);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1c1c1c';
  ctx.lineWidth = 1 * specDpr;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, yZero); ctx.stroke();

  // readouts
  document.getElementById('specLam').textContent = lambda.toFixed(1);
  document.getElementById('specLamMm').textContent = (lambda * P.dxMeters * 1000).toFixed(1);
  document.getElementById('specSig').textContent = peakSig.toExponential(2);

  return { lambda, peakSig };
}

// ─────────────────────────────────────────────────────────────────────────────
// Readouts: count crests, mean wavelength, relief, drift speed
// ─────────────────────────────────────────────────────────────────────────────
function countCrests() {
  // count local maxima above mean
  let mean = 0; for (let i = 0; i < N; i++) mean += bed[i]; mean /= N;
  let crests = 0, lastCrest = -10;
  for (let i = 0; i < N; i++) {
    const a = bed[(i - 1 + N) % N], b = bed[i], c = bed[(i + 1) % N];
    if (b > a && b >= c && b > mean + 0.002 && i - lastCrest > 4) {
      crests++;
      lastCrest = i;
    }
  }
  return crests;
}

function updateReadouts(specInfo) {
  let hmin = +Infinity, hmax = -Infinity;
  for (let i = 0; i < N; i++) { hmin = Math.min(hmin, bed[i]); hmax = Math.max(hmax, bed[i]); }
  const relief = hmax - hmin;
  const crests = countCrests();
  const lambda = crests > 0 ? N / crests : N;
  // drift speed of the fastest mode, in cells/step → convert to cm/min
  // (1 cell = dxMeters; 60 steps ≈ "a minute" of sim time, tuned for display)
  const drift = E.linearDriftSpeed(specInfo.lambda ? (2 * Math.PI / specInfo.lambda) : 0.4, P);
  const cmPerMin = drift * P.dxMeters * 100 * 60 / 60;

  document.getElementById('kRipples').textContent = crests;
  document.getElementById('kLambda').textContent = (lambda * P.dxMeters * 1000).toFixed(1);
  document.getElementById('kCrest').textContent = (relief * P.dxMeters * 1000).toFixed(1);
  document.getElementById('kSpeed').textContent = isFinite(cmPerMin) ? cmPerMin.toFixed(2) : '—';
  document.getElementById('stepLabel').textContent = stepCount;

  const instab = document.getElementById('instabHint');
  if (specInfo.peakSig > 0) {
    instab.textContent = 'bed unstable · ripples growing';
    instab.classList.remove('stable');
  } else {
    instab.textContent = 'bed stable · flat';
    instab.classList.add('stable');
  }
}

function drawAll() {
  drawBed();
  drawGrains();
  const specInfo = drawSpectrum();
  updateReadouts(specInfo);
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulation step
// ─────────────────────────────────────────────────────────────────────────────
function simStep() {
  bed = E.fluxStep(bed, Object.assign({ clamp: true }, P));
  bed = E.avalanche(bed, P);
  // re-zero mean drift so the bed doesn't slide off (numerical hygiene)
  let mean = 0; for (let i = 0; i < N; i++) mean += bed[i]; mean /= N;
  for (let i = 0; i < N; i++) bed[i] -= mean;
  stepCount++;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main loop. We drive the sim with setInterval (not requestAnimationFrame) so
// it keeps advancing even when the tab is backgrounded or the browser starves
// rAF (common in headless / embedded webviews). The draw cadence is throttled
// by a frame counter so we don't repaint more than ~20×/s.
// ─────────────────────────────────────────────────────────────────────────────
let tick = 0;
function frame() {
  if (running) {
    for (let s = 0; s < stepsPerFrame; s++) simStep();
    spawnGrains();
  }
  drawGrains();   // grains keep flying even when paused, for ambience
  // re-render bed + spectrum every few ticks (expensive)
  tick++;
  if (tick % 3 === 0) {
    drawBed();
    const specInfo = drawSpectrum();
    updateReadouts(specInfo);
  }
}
setInterval(frame, 50);   // ~20 Hz baseline; rAF would also work when visible

// ─────────────────────────────────────────────────────────────────────────────
// Controls
// ─────────────────────────────────────────────────────────────────────────────
const playBtn  = document.getElementById('playBtn');
const stepBtn  = document.getElementById('stepBtn');
const resetBtn = document.getElementById('resetBtn');
const gustBtn  = document.getElementById('gustBtn');
const speedIn  = document.getElementById('speed');

function setPlay(on) {
  running = on;
  playBtn.textContent = on ? '⏸ wind off' : '▶ wind on';
}

playBtn.addEventListener('click', () => setPlay(!running));
stepBtn.addEventListener('click', () => { simStep(); spawnGrains(); drawAll(); });
resetBtn.addEventListener('click', () => { makeBed(); grains = []; drawAll(); });
gustBtn.addEventListener('click', dropPile);
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); dropPile(); }
});

function dropPile() {
  // Drop a Gaussian pile of sand somewhere downwind-of-center, as a
  // perturbation — this is the classic "drop on the bed and watch it become
  // a ripple" demo.
  const c = Math.floor(N * (0.25 + hashRand() * 0.5));
  for (let i = 0; i < N; i++) {
    const d = i - c;
    bed[i] += 0.9 * Math.exp(-d * d / (2 * 18 * 18));
  }
  bed = E.avalanche(bed, P);
  drawAll();
}

speedIn.addEventListener('input', () => {
  stepsPerFrame = parseInt(speedIn.value, 10);
  document.getElementById('speedVal').textContent = stepsPerFrame + '×';
});

// Dials
function bindDial(id, valId, key, fmt, parse) {
  const el = document.getElementById(id), v = document.getElementById(valId);
  el.addEventListener('input', () => {
    P[key] = parse(el.value);
    v.textContent = fmt(P[key]);
    if (key === 'reposeDeg') { /* affects avalanche only */ }
    drawSpectrum();
    updateWindLabel();
  });
}
bindDial('cDial', 'cVal', 'C', x => x.toFixed(2), parseFloat);
bindDial('lDial', 'lVal', 'L', x => x.toFixed(1), parseFloat);
bindDial('dDial', 'dVal', 'D', x => x.toFixed(3), parseFloat);
bindDial('reposeDial', 'reposeVal', 'reposeDeg', x => x.toFixed(1) + '°', parseFloat);

function updateWindLabel() {
  const c = P.C;
  let label;
  if (c < 0.1)      label = 'calm';
  else if (c < 0.3) label = 'light';
  else if (c < 0.6) label = 'moderate';
  else if (c < 0.9) label = 'strong';
  else              label = 'gale';
  document.getElementById('windLabel').textContent = label;
}

// Presets
const PRESETS = {
  gentle:  { C: 0.15, D: 0.12, L: 4.2, reposeDeg: 33 },
  dune:    { C: 0.35, D: 0.20, L: 4.2, reposeDeg: 33 },
  storm:   { C: 0.95, D: 0.30, L: 5.0, reposeDeg: 33 },
  fine:    { C: 0.35, D: 0.08, L: 2.2, reposeDeg: 33 },
  gravel:  { C: 0.35, D: 0.40, L: 8.5, reposeDeg: 36 },
};
document.querySelectorAll('[data-preset]').forEach(btn => {
  btn.addEventListener('click', () => {
    const ps = PRESETS[btn.dataset.preset];
    Object.assign(P, ps);
    document.getElementById('cDial').value = P.C;      document.getElementById('cVal').textContent = P.C.toFixed(2);
    document.getElementById('lDial').value = P.L;      document.getElementById('lVal').textContent = P.L.toFixed(1);
    document.getElementById('dDial').value = P.D;      document.getElementById('dVal').textContent = P.D.toFixed(3);
    document.getElementById('reposeDial').value = P.reposeDeg;
    document.getElementById('reposeVal').textContent = P.reposeDeg.toFixed(1) + '°';
    updateWindLabel();
    drawAll();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────────────────
makeBed();
resize();
updateWindLabel();
setPlay(true);
// frame() is driven by setInterval above; kick one immediately so the first
// paint doesn't wait 50ms.
frame();
