/*
 * loop-the-loop — app
 *
 * Canvas side view of the coaster, a sidebar of instruments, and the
 * interactions: drag the release handle up the lift, drag the loop around,
 * drag the bunny-hill crests, then dispatch and watch the ledger.
 *
 * Everything physics-shaped lives in engine.js (LoopEngine); this file is
 * drawing, DOM, pointer math, and the __demo hooks the video renderer uses
 * to drive the real UI deterministically (paused + stepDraw).
 */

(function () {
  'use strict';

  const E = window.LoopEngine;
  const $ = (id) => document.getElementById(id);
  const cv = $('cv');
  const ctx = cv.getContext('2d');

  // ── state ────────────────────────────────────────────────────────────────

  let presetName = 'prescott';
  const P = { ...E.PRESETS.prescott };     // live params (shape, r, loopX, H, mu, upstop, hills)
  let L = null;                            // layout: {track, sRelease, loop, needed, ...}
  let st = null;                           // engine car state (null = parked at release)
  let running = false;
  let simTime = 0;
  const trail = [];                        // [{x, y, age}]
  const gTrace = [];                       // [{t, felt}]
  const markers = [];                      // [{x, y, label, color, born}]
  let verdict = null;                      // headless analysis of current setup
  let compare = null;                      // circle vs clothoid g-bill
  let paused = false;                      // video capture mode
  let drag = null;

  const Y0 = 2;

  function rebuild() {
    L = E.buildLayout(P);
    resetRun();
    scheduleAnalysis();
  }

  function resetRun() {
    st = null;
    running = false;
    simTime = 0;
    trail.length = 0;
    gTrace.length = 0;
    markers.length = 0;
  }

  function dispatch() {
    st = E.makeState(L.track, L.sRelease, 1.5);   // the chain's final push
    running = true;
    simTime = 0;
    trail.length = 0;
    gTrace.length = 0;
    markers.length = 0;
  }

  // ── headless analysis (verdict + g-bill), throttled ─────────────────────

  let analysisTimer = 0;
  function scheduleAnalysis() {
    clearTimeout(analysisTimer);
    analysisTimer = setTimeout(runAnalysis, 30);
  }

  function runAnalysis() {
    const opts = { mu: P.mu, upstop: P.upstop, sTop: L.loop.sTop };
    verdict = E.analyzeRun(L.track, L.sRelease, opts);
    // the fair fight: same crest height, same release, both shapes
    const other = { ...P, shape: P.shape === 'circle' ? 'clothoid' : 'circle' };
    const L2 = E.buildLayout(other);
    const r2 = E.analyzeRun(L2.track, L2.sRelease, { ...opts, sTop: L2.loop.sTop });
    const own = verdict;
    compare = P.shape === 'circle'
      ? { cir: own, clo: r2 }
      : { cir: r2, clo: own };
    renderVerdict();
    renderCompare();
  }

  // ── geometry helpers ─────────────────────────────────────────────────────

  const view = { k: 4, ox: 0, oy: 0 };

  function updateView() {
    const w = cv.clientWidth, h = cv.clientHeight;
    const xMin = -9, xMax = Math.max(150, L.track.xMax + 8);
    const yMin = -2.5, yMax = 34.5;
    const k = Math.min((w - 24) / (xMax - xMin), (h - 46) / (yMax - yMin));
    view.k = k;
    view.ox = 14 - xMin * k;
    view.oy = h - 24 + yMin * k;
  }

  const sx = (x) => view.ox + x * view.k;
  const sy = (y) => view.oy - y * view.k;
  const wx = (px) => (px - view.ox) / view.k;
  const wy = (py) => (view.oy - py) / view.k;

  // stars for the dusk sky, seeded so they don't flicker between frames
  const stars = [];
  {
    let seed = 20260816;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 110; i++) {
      stars.push({ x: rnd(), y: rnd() * 0.62, r: 0.6 + rnd() * 1.3, a: 0.25 + rnd() * 0.5 });
    }
  }

  function loopRange() {
    const lo = L.loop.sEntry - 2;
    const hi = L.loop.sTop + (L.loop.sTop - L.loop.sEntry) + 2;
    return [lo, hi];
  }

  // ── drawing ──────────────────────────────────────────────────────────────

  function draw(now) {
    const w = cv.clientWidth, h = cv.clientHeight;
    updateView();

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#1b2140');
    sky.addColorStop(0.55, '#12152a');
    sky.addColorStop(1, '#0b0c16');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#cdd3f2';
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ground
    ctx.fillStyle = '#0e0f1a';
    ctx.fillRect(0, sy(0), w, h - sy(0));
    ctx.strokeStyle = '#232741';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, sy(0));
    ctx.lineTo(w, sy(0));
    ctx.stroke();

    // height grid
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#3c415f';
    for (let y = 5; y <= 30; y += 5) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(sx(-6), sy(y));
      ctx.lineTo(sx(Math.max(150, L.track.xMax + 8)), sy(y));
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillText(y + ' m', 6, sy(y) - 3);
    }

    drawRuleLines();
    drawStruts();
    drawTrack();
    drawMarkers(now);
    drawTrail();
    drawCarOrHandle(now);
    drawGStrip(w, h);
  }

  function drawRuleLines() {
    const base = L.needed.base + L.needed.muTerm;
    const x0 = sx(8), x1 = sx(P.loopX + 6);
    // the frictionless 2.5r line
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(125,220,232,.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, sy(Y0 + L.needed.base));
    ctx.lineTo(x1, sy(Y0 + L.needed.base));
    ctx.stroke();
    ctx.fillStyle = 'rgba(125,220,232,.8)';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillText(P.shape === 'circle' ? '2.5·r line' : 'top + r_top/2 line', x0 + 4, sy(Y0 + L.needed.base) - 5);
    if (L.needed.muTerm > 0.05) {
      ctx.strokeStyle = 'rgba(224,108,95,.6)';
      ctx.beginPath();
      ctx.moveTo(x0, sy(Y0 + base));
      ctx.lineTo(x1, sy(Y0 + base));
      ctx.stroke();
      ctx.fillStyle = 'rgba(224,108,95,.85)';
      ctx.fillText('+ μ·Δx', x0 + 4, sy(Y0 + base) - 5);
    }
    ctx.setLineDash([]);
    // current release level
    const relY = sy(Y0 + P.H);
    ctx.strokeStyle = 'rgba(240,180,41,.35)';
    ctx.beginPath();
    ctx.moveTo(sx(8), relY);
    ctx.lineTo(sx(48), relY);
    ctx.stroke();
  }

  function drawStruts() {
    const [loS, hiS] = loopRange();
    ctx.strokeStyle = '#20243c';
    ctx.lineWidth = 2;
    let nextX = -4;
    for (let i = 0; i < L.track.n; i += 25) {
      const s = L.track.s[i];
      const [x, y] = L.track.pts[i];
      if (s > loS && s < hiS) continue;
      if (x < nextX || y < 1.4) continue;
      nextX = x + 5.5;
      ctx.beginPath();
      ctx.moveTo(sx(x), sy(y - 0.3));
      ctx.lineTo(sx(x), sy(0));
      ctx.stroke();
    }
  }

  function drawTrack() {
    const t = L.track;
    const [loS, hiS] = loopRange();
    const step = Math.max(1, Math.round(0.14 / E.DS));

    const railPath = (sLo, sHi, off) => {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < t.n; i += step) {
        const s = t.s[i];
        if (s < sLo || s > sHi) continue;
        const [x, y] = t.pts[i];
        const th = t.th[i];
        const nx = -Math.sin(th), ny = Math.cos(th);
        const px = sx(x + nx * off), py = sy(y + ny * off);
        if (!started) { ctx.moveTo(px, py); started = true; }
        else ctx.lineTo(px, py);
      }
    };

    // main rails
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#c9c4b4';
    ctx.lineWidth = 2.4;
    railPath(0, t.length, 0.42);
    ctx.stroke();
    railPath(0, t.length, -0.42);
    ctx.stroke();

    // the loop, highlighted
    ctx.strokeStyle = '#f0b429';
    ctx.lineWidth = 2.8;
    railPath(loS, hiS, 0.42);
    ctx.stroke();
    railPath(loS, hiS, -0.42);
    ctx.stroke();

    // ties
    ctx.strokeStyle = 'rgba(201,196,180,.38)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    let nextTie = 0;
    for (let i = 0; i < t.n; i += step) {
      const s = t.s[i];
      if (s < nextTie) continue;
      nextTie = s + 1.15;
      const [x, y] = t.pts[i];
      const th = t.th[i];
      const nx = -Math.sin(th), ny = Math.cos(th);
      ctx.moveTo(sx(x + nx * 0.42), sy(y + ny * 0.42));
      ctx.lineTo(sx(x - nx * 0.42), sy(y - ny * 0.42));
    }
    ctx.stroke();

    // station platform
    ctx.fillStyle = '#1a1d2e';
    ctx.fillRect(sx(-5), sy(Y0 + 0.55), sx(11) - sx(-5), sy(0) - sy(Y0 + 0.55));
    ctx.fillStyle = '#3c415f';
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.fillText('station', sx(-5), sy(Y0 + 0.75));
  }

  function drawMarkers(now) {
    for (const m of markers) {
      const age = (now - m.born) / 1000;
      if (age > 3) continue;
      ctx.globalAlpha = Math.max(0, 1 - age / 3);
      ctx.fillStyle = m.color;
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.fillText(m.label, sx(m.x) + 10, sy(m.y) - 8);
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx(m.x) - 6, sy(m.y) - 6);
      ctx.lineTo(sx(m.x) + 6, sy(m.y) + 6);
      ctx.moveTo(sx(m.x) + 6, sy(m.y) - 6);
      ctx.lineTo(sx(m.x) - 6, sy(m.y) + 6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawTrail() {
    for (let i = 1; i < trail.length; i++) {
      const a = i / trail.length;
      ctx.strokeStyle = `rgba(125,220,232,${0.12 + 0.45 * a})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(sx(trail[i - 1].x), sy(trail[i - 1].y));
      ctx.lineTo(sx(trail[i].x), sy(trail[i].y));
      ctx.stroke();
    }
  }

  function carPose() {
    if (st) {
      if (st.mode === 'track') {
        return { x: st.x, y: st.y, th: L.track.thetaAt(st.s) };
      }
      return { x: st.x, y: st.y, th: Math.atan2(-st.vy, st.vx) };
    }
    const p = L.track.posAt(L.sRelease);
    return { x: p[0], y: p[1], th: L.track.thetaAt(L.sRelease) };
  }

  function drawCarOrHandle(now) {
    const pose = carPose();
    const k = view.k;

    if (!running) {
      // release handle: a carriage glyph parked at the release point
      ctx.save();
      ctx.translate(sx(pose.x), sy(pose.y));
      ctx.rotate(-pose.th);
      ctx.fillStyle = '#f0b429';
      ctx.strokeStyle = '#1b1608';
      ctx.lineWidth = 1.5;
      const W = 1.7 * k, H = 1.1 * k;
      ctx.beginPath();
      ctx.roundRect(-W / 2, -H / 2 - 2, W, H, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // drag arrow above it
      const bob = Math.sin(now / 300) * 3;
      ctx.fillStyle = 'rgba(240,180,41,.9)';
      ctx.beginPath();
      ctx.moveTo(sx(pose.x), sy(pose.y + 2.4) + bob);
      ctx.lineTo(sx(pose.x) - 7, sy(pose.y + 3.4) + bob);
      ctx.lineTo(sx(pose.x) + 7, sy(pose.y + 3.4) + bob);
      ctx.closePath();
      ctx.fill();
      ctx.font = '11px ui-monospace, Menlo, monospace';
      ctx.fillStyle = 'rgba(240,180,41,.75)';
      ctx.fillText(`release ${P.H.toFixed(1)} m`, sx(pose.x) + 12, sy(pose.y + 2.8));
    }

    // the car itself (also drawn parked, ghosted, when idle)
    ctx.save();
    ctx.translate(sx(pose.x), sy(pose.y));
    ctx.rotate(-pose.th);
    ctx.globalAlpha = running ? 1 : 0.35;
    const feltNow = st ? st.felt : 0;
    let body = '#e8e4d8';
    if (running && feltNow > 3.5) body = '#e06c5f';
    if (running && st && st.mode === 'air') body = '#7ddce8';
    const W = 3.3 * k, H = 1.35 * k;
    ctx.fillStyle = body;
    ctx.strokeStyle = '#10121f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-W / 2, -H / 2 - 0.18 * k, W, H, 5);
    ctx.fill();
    ctx.stroke();
    // riders
    ctx.fillStyle = '#2c3050';
    ctx.beginPath();
    ctx.arc(-0.7 * k, -0.75 * k, 0.33 * k, 0, 7);
    ctx.arc(0.7 * k, -0.75 * k, 0.33 * k, 0, 7);
    ctx.fill();
    // wheels / upstops
    ctx.fillStyle = '#10121f';
    for (const wx of [-1.05, 1.05]) {
      ctx.beginPath();
      ctx.arc(wx * k, 0.42 * k, 0.30 * k, 0, 7);
      ctx.fill();
    }
    if (P.upstop) {
      ctx.strokeStyle = '#7ddce8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-1.05 * k, 0.42 * k, 0.42 * k, 0, 7);
      ctx.arc(1.05 * k, 0.42 * k, 0.42 * k, 0, 7);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // HUD bubble
    if (running && st) {
      const v = st.mode === 'track' ? st.u : Math.hypot(st.vx, st.vy);
      const label = st.mode === 'air'
        ? 'AIRBORNE · 0 g'
        : `${Math.round(v * 3.6)} km/h · ${st.felt.toFixed(1)} g`;
      ctx.font = 'bold 12px -apple-system, sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(10,10,18,.72)';
      ctx.roundRect(sx(pose.x) - tw / 2 - 7, sy(pose.y + 4.6) - 11, tw + 14, 19, 5);
      ctx.fill();
      ctx.fillStyle = st.mode === 'air' ? '#7ddce8' : (st.felt > 3.5 ? '#e06c5f' : '#ecebf4');
      ctx.fillText(label, sx(pose.x) - tw / 2, sy(pose.y + 4.6) + 3);
    }

    drawLoopHandles();
  }

  function drawLoopHandles() {
    if (running) return;
    const cx = P.loopX, cy = Y0 + P.r;
    // move handle at the loop's heart
    ctx.strokeStyle = 'rgba(240,180,41,.85)';
    ctx.lineWidth = 1.6;
    const px = sx(cx), py = sy(cy), r = 7;
    ctx.beginPath();
    ctx.moveTo(px - r - 3, py); ctx.lineTo(px + r + 3, py);
    ctx.moveTo(px, py - r - 3); ctx.lineTo(px, py + r + 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, r, 0, 7);
    ctx.stroke();
    // radius handle on the right flank
    const rx = sx(cx + P.r), ry = sy(cy);
    ctx.fillStyle = 'rgba(240,180,41,.9)';
    ctx.beginPath();
    ctx.roundRect(rx - 5, ry - 5, 10, 10, 3);
    ctx.fill();
    // hill crest handles
    const exitX = exitOfTrack();
    ctx.fillStyle = 'rgba(125,220,232,.85)';
    for (const h of P.hills) {
      ctx.beginPath();
      ctx.arc(sx(exitX + h.dx), sy(Y0 + h.h), 5, 0, 7);
      ctx.fill();
    }
  }

  function exitOfTrack() {
    // x where the loop part ends (first sample after sTop + half-loop)
    const sExit = L.loop.sTop + (L.loop.sTop - L.loop.sEntry) + 1.5;
    const p = L.track.posAt(sExit);
    return p[0];
  }

  function drawGStrip(w, h) {
    if (!running || gTrace.length < 2) return;
    const W = Math.min(360, w - 40), H = 62, X = 16, Yb = h - 14;
    ctx.fillStyle = 'rgba(10,10,18,.66)';
    ctx.roundRect(X - 6, Yb - H - 16, W + 12, H + 22, 8);
    ctx.fill();
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#8b90ad';
    ctx.fillText('felt g — last 9 s', X, Yb - H - 3);
    const tNow = simTime;
    const yOf = (g) => Yb - ((g + 2) / 9) * H;   // −2 g … 7 g
    ctx.strokeStyle = 'rgba(139,144,173,.3)';
    for (const g of [0, 5]) {
      ctx.beginPath();
      ctx.moveTo(X, yOf(g));
      ctx.lineTo(X + W, yOf(g));
      ctx.stroke();
    }
    ctx.beginPath();
    let started = false;
    for (const p of gTrace) {
      const u = (p.t - (tNow - 9)) / 9;
      if (u < 0) continue;
      const px = X + u * W;
      if (!started) { ctx.moveTo(px, yOf(p.g)); started = true; }
      else ctx.lineTo(px, yOf(p.g));
    }
    ctx.strokeStyle = '#f0b429';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  // ── sim loop ─────────────────────────────────────────────────────────────

  let acc = 0, lastT = 0;
  const PHYS_DT = 1 / 240;

  function advance(dt) {
    if (!running || !st) return;
    acc += dt;
    while (acc >= PHYS_DT) {
      const before = st.mode;
      E.stepState(L.track, st, PHYS_DT, { mu: P.mu, upstop: P.upstop, tMax: 75 });
      acc -= PHYS_DT;
      simTime += PHYS_DT;
      if (st.mode === 'air' && before === 'track') {
        markers.push({ x: st.x, y: st.y, label: 'left the rail · N < 0', color: '#e06c5f', born: performance.now() });
      }
      if (st.mode === 'track' && before === 'air') {
        markers.push({ x: st.x, y: st.y, label: 'landed · v⊥ paid as heat', color: '#7ddce8', born: performance.now() });
      }
      if (st.result) {
        running = false;
        const m = { finished: ['made it · brakes on', '#61c554'], fell: ['off the rails', '#e06c5f'], stopped: ['stopped on the rails', '#e06c5f'], timeout: ['out of time', '#9498b6'] }[st.result] || ['', '#9498b6'];
        markers.push({ x: st.x, y: st.y, label: m[0], color: m[1], born: performance.now() });
        break;
      }
    }
    if (st) {
      trail.push({ x: st.x, y: st.y });
      if (trail.length > 150) trail.shift();
      gTrace.push({ t: simTime, g: st.felt });
      while (gTrace.length && gTrace[0].t < simTime - 9.5) gTrace.shift();
    }
  }

  function frame(now) {
    const dt = Math.min(0.06, (now - lastT) / 1000 || 0);
    lastT = now;
    if (!paused) advance(dt);
    draw(now);
    updateDom();
    requestAnimationFrame(frame);
  }

  // ── DOM panels ───────────────────────────────────────────────────────────

  let domTimer = 0;
  function updateDom() {
    const t = performance.now();
    if (t - domTimer < 90) return;
    domTimer = t;

    const pose = carPose();
    const v = st ? (st.mode === 'track' ? st.u : Math.hypot(st.vx, st.vy)) : 0;
    const felt = st ? st.felt : 0;
    $('speedVal').textContent = st ? Math.round(Math.abs(v) * 3.6) : '0';
    const gEl = $('gVal');
    gEl.textContent = st ? felt.toFixed(1) : '–';
    gEl.className = felt < -0.05 ? 'neg' : (felt > 3.5 ? 'hot' : '');
    if (st) {
      const heads = E.energyHeads(L.track, st, 0);
      const tot = Math.max(0.1, P.H + Y0);
      $('peBar').style.width = (100 * Math.max(0, heads.pe) / tot) + '%';
      $('keBar').style.width = (100 * Math.max(0, heads.ke) / tot) + '%';
      $('heatBar').style.width = (100 * Math.max(0, heads.heat) / tot) + '%';
      $('peVal').textContent = Math.max(0, heads.pe).toFixed(1);
      $('keVal').textContent = Math.max(0, heads.ke).toFixed(1);
      $('heatVal').textContent = Math.max(0, heads.heat).toFixed(1);
    } else {
      for (const id of ['peBar', 'keBar', 'heatBar']) $(id).style.width = '0%';
      for (const id of ['peVal', 'keVal', 'heatVal']) $(id).textContent = '–';
      $('peBar').style.width = (100 * (P.H + Y0) / (P.H + Y0)) + '%';
      $('peVal').textContent = (P.H + Y0).toFixed(1);
    }

    if (running) {
      $('statusVal').textContent = `running · t ${simTime.toFixed(1)} s`;
      let peak = 0;
      for (const g of gTrace) peak = Math.max(peak, g.g);
      if (peak > 0.05) $('peakG').textContent = peak.toFixed(1);
      $('topG').textContent = (verdict && verdict.feltTop != null) ? verdict.feltTop.toFixed(1) : '–';
    } else {
      $('statusVal').textContent = st
        ? ({ finished: 'finished', fell: 'fell', stopped: 'stopped', timeout: 'timed out' }[st.result] || 'done')
        : 'ready';
    }
  }

  function renderVerdict() {
    if (!verdict) return;
    const r = P.r;
    const rel = P.H / r;
    const base = L.needed.base / r;
    const muTerm = L.needed.muTerm / r;
    const total = base + muTerm;
    const margin = rel - total;
    let line, cls;
    if (verdict.completed && !verdict.detach) { line = `clears — ${margin >= 0.03 ? 'with ' + margin.toFixed(2) + ' r to spare' : 'just barely'}`; cls = 'v-ok'; }
    else if (verdict.detach && verdict.detach.s > L.loop.sEntry - 1 && verdict.detach.s < L.loop.sTop + (L.loop.sTop - L.loop.sEntry)) {
      line = `short — it leaves the rail ${P.upstop ? '(beyond the upstops!) ' : ''}on the loop`; cls = 'v-bad';
    }
    else if (verdict.detach) { line = `short — it goes airborne on the hills`; cls = 'v-bad'; }
    else if (verdict.rolledBack || verdict.result === 'stopped') { line = `the friction bill wins — it stalls and rolls back`; cls = 'v-bad'; }
    else { line = `no verdict (${verdict.result})`; cls = 'v-bad'; }
    const crest = verdict.feltTop != null ? `${verdict.feltTop >= 0 ? '+' : ''}${verdict.feltTop.toFixed(2)} g` : '–';
    $('verdictBody').innerHTML =
      `release <b>${rel.toFixed(2)} r</b> above the loop's lowest point` +
      `<span class="v-math">needs ≥ ${base.toFixed(2)} r${muTerm > 0.005 ? ` + μ·Δx = ${muTerm.toFixed(2)} r` : ''}` +
      `&nbsp;&nbsp;(Δx = ${L.needed.muDX.toFixed(0)} m)</span>` +
      `<span class="${cls}">${line}</span><br>` +
      `headless rehearsal: peak ${verdict.peak.toFixed(1)} g · crest ${crest}` +
      `${verdict.detach ? ` · <span style="color:#e06c5f">falls</span>` : ''}`;
  }

  function renderCompare() {
    if (!compare) return;
    const rows = [
      ['1898 circle', compare.cir, 'cir'],
      ['1976 clothoid', compare.clo, 'clo'],
    ];
    $('gCompare').innerHTML = rows.map(([name, run, cls]) => {
      const crest = run.feltTop != null ? `${run.feltTop >= 0 ? '+' : ''}${run.feltTop.toFixed(1)}` : '–';
      const pct = Math.min(100, 100 * run.peak / 7);
      return `<div class="g-row">
        <div class="lbl"><span>${name}${run.completed ? '' : ' · <i style="color:#e06c5f">falls</i>'}</span>
        <span>peak <b>${run.peak.toFixed(1)} g</b> · crest <b>${crest} g</b></span></div>
        <div class="g-track"><i class="${cls}" style="width:${pct}%"></i></div>
      </div>`;
    }).join('') +
      `<div class="mini dim" style="margin-top:2px">same silhouette, same release — the teardrop
      puts its tightest curvature where the speed has already been spent</div>`;
  }

  // ── controls ─────────────────────────────────────────────────────────────

  function syncControls() {
    $('hSlider').value = P.H;
    $('rSlider').value = P.r;
    $('muSlider').value = P.mu;
    $('hVal').textContent = P.H.toFixed(1) + ' m';
    $('rVal').textContent = P.r.toFixed(1) + ' m';
    $('muVal').textContent = P.mu.toFixed(3);
    $('shapeCircle').classList.toggle('sel', P.shape === 'circle');
    $('shapeClothoid').classList.toggle('sel', P.shape === 'clothoid');
    $('upstopChk').checked = !!P.upstop;
    for (const b of document.querySelectorAll('.chip')) {
      b.classList.toggle('sel', b.dataset.preset === presetName);
    }
  }

  function applyPreset(name) {
    presetName = name;
    Object.assign(P, JSON.parse(JSON.stringify(E.PRESETS[name])));
    syncControls();
    rebuild();
  }

  $('dispatchBtn').addEventListener('click', () => { if (!running) dispatch(); else resetRun(); });
  $('resetBtn').addEventListener('click', resetRun);
  $('hSlider').addEventListener('input', (e) => { P.H = +e.target.value; presetName = ''; syncControls(); rebuild(); });
  $('rSlider').addEventListener('input', (e) => { P.r = +e.target.value; presetName = ''; syncControls(); rebuild(); });
  $('muSlider').addEventListener('input', (e) => { P.mu = +e.target.value; presetName = ''; syncControls(); rebuild(); });
  $('shapeCircle').addEventListener('click', () => { P.shape = 'circle'; presetName = ''; syncControls(); rebuild(); });
  $('shapeClothoid').addEventListener('click', () => { P.shape = 'clothoid'; presetName = ''; syncControls(); rebuild(); });
  $('upstopChk').addEventListener('change', (e) => { P.upstop = e.target.checked; presetName = ''; scheduleAnalysis(); });
  for (const b of document.querySelectorAll('.chip')) {
    b.addEventListener('click', () => applyPreset(b.dataset.preset));
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!running) dispatch(); else resetRun();
    }
  });

  // ── pointer drags on the canvas ──────────────────────────────────────────

  function hitHandle(px, py) {
    const pose = carPose();
    if (Math.hypot(px - sx(pose.x), py - sy(pose.y)) < 22) return { kind: 'release' };
    const rx = sx(P.loopX + P.r), ry = sy(Y0 + P.r);
    if (Math.hypot(px - rx, py - ry) < 16) return { kind: 'radius' };
    const cx = sx(P.loopX), cy = sy(Y0 + P.r);
    if (Math.hypot(px - cx, py - cy) < 18) return { kind: 'loop' };
    const exitX = exitOfTrack();
    for (let i = 0; i < P.hills.length; i++) {
      const h = P.hills[i];
      if (Math.hypot(px - sx(exitX + h.dx), py - sy(Y0 + h.h)) < 14) return { kind: 'hill', i };
    }
    return null;
  }

  cv.addEventListener('pointerdown', (e) => {
    const rect = cv.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const hit = hitHandle(px, py);
    if (!hit) return;
    cv.setPointerCapture(e.pointerId);
    drag = { ...hit, px, py, start: { H: P.H, loopX: P.loopX, r: P.r, hills: P.hills.map(x => ({ ...x })) } };
    resetRun();
  });

  cv.addEventListener('pointermove', (e) => {
    const rect = cv.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    if (!drag) {
      cv.style.cursor = hitHandle(px, py) ? 'grab' : 'default';
      return;
    }
    cv.style.cursor = 'grabbing';
    const wy_ = wy(py), wx_ = wx(px);
    if (drag.kind === 'release') {
      P.H = Math.max(12, Math.min(30, wy_ - Y0));
    } else if (drag.kind === 'loop') {
      P.loopX = Math.max(78, Math.min(104, wx_));
    } else if (drag.kind === 'radius') {
      P.r = Math.max(6, Math.min(13, Math.abs(wx_ - P.loopX)));
    } else if (drag.kind === 'hill') {
      const exitX = exitOfTrack();
      const h = P.hills[drag.i];
      h.h = Math.max(0.2, Math.min(4, wy_ - Y0));
      h.dx = Math.max(14, Math.min(52, wx_ - exitX));
      P.hills.sort((a, b) => a.dx - b.dx);
      if (P.hills.length === 2) {
        P.hills[0].dx = Math.min(P.hills[0].dx, P.hills[1].dx - 8);
      }
    }
    presetName = '';
    syncControls();
    rebuild();
  });

  const endDrag = () => { drag = null; cv.style.cursor = 'default'; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  // ── canvas sizing ────────────────────────────────────────────────────────

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cv.clientWidth * dpr);
    cv.height = Math.round(cv.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  // ── demo hooks for the video renderer ────────────────────────────────────

  window.__demo = {
    params: () => ({ ...P, hills: P.hills.map(x => ({ ...x })) }),
    setPreset: applyPreset,
    setH(m) { P.H = m; syncControls(); rebuild(); },
    setMu(v) { P.mu = v; syncControls(); rebuild(); },
    setR(v) { P.r = v; syncControls(); rebuild(); },
    setShape(s) { P.shape = s; presetName = ''; syncControls(); rebuild(); },
    setUpstop(b) { P.upstop = b; $('upstopChk').checked = b; scheduleAnalysis(); },
    dispatch, reset: resetRun,
    setPaused(v) { paused = v; },
    stepDraw(dt) { advance(dt); draw(performance.now()); updateDom(); },
    state: () => ({
      running, result: st && st.result, felt: st ? st.felt : 0,
      speed: st ? (st.mode === 'track' ? st.u : Math.hypot(st.vx, st.vy)) : 0,
      x: st ? st.x : null, y: st ? st.y : null, t: simTime,
    }),
    releasePx() { const p = carPose(); const r = cv.getBoundingClientRect(); return { x: r.left + sx(p.x), y: r.top + sy(p.y) }; },
    loopPx() { const r = cv.getBoundingClientRect(); return { x: r.left + sx(P.loopX), y: r.top + sy(Y0 + P.r) }; },
    radiusPx() { const r = cv.getBoundingClientRect(); return { x: r.left + sx(P.loopX + P.r), y: r.top + sy(Y0 + P.r) }; },
    hillPx(i) { const e = exitOfTrack(); const r = cv.getBoundingClientRect(); return { x: r.left + sx(e + P.hills[i].dx), y: r.top + sy(Y0 + P.hills[i].h) }; },
    btnPx(id) { const r = $(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
    sliderPx(id) { const el = $(id); const r = el.getBoundingClientRect();
      const f = (+el.min + ((+el.max - +el.min) * (+el.value - +el.min) / (+el.max - +el.min)));
      return { x: r.left + f * r.width, y: r.top + r.height / 2, frac: f }; },
  };

  // ── boot ─────────────────────────────────────────────────────────────────

  resize();
  applyPreset('prescott');
  requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(frame); });
})();
