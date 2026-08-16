/*
 * jupiter-mail — app
 *
 * All the drawing, DOM, pointer handling, and the __demo hooks the video
 * renderer uses. The physics lives in engine.js (pure, node-testable).
 */

(function () {
  'use strict';

  const E = window.JupiterEngine;

  // ── palette (mirrors style.css) ─────────────────────────────────────────

  const INK = '#33291d', FADED = '#8a7a5f', LINE = '#d9cbaa', OXIDE = '#b0472a',
    OLIVE = '#5f6f4e', WATER = '#a9bfae', PAPER = '#f4ecd9';
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  const SERIF = '"Iowan Old Style", "Palatino Linotype", Georgia, serif';

  // ── dom ─────────────────────────────────────────────────────────────────

  const $ = (id) => document.getElementById(id);
  const mapCv = $('map'), ladderCv = $('ladder'), compassCv = $('compass');

  // ── map projection ──────────────────────────────────────────────────────
  // metres → pixels. Extent chosen to frame Lafayette → Crawfordsville with
  // the eastern rail towns in frame (Indianapolis lies off the sheet).

  const MAP = { xMin: -12000, xMax: 38000, yMin: -53000, yMax: 20000 };
  const MAPW = 370, MAPH = 524;                    // CSS pixels
  const MS = Math.min(MAPW / (MAP.xMax - MAP.xMin), MAPH / (MAP.yMax - MAP.yMin));
  function mx(x) { return 10 + (x - MAP.xMin) * MS; }
  function my(y) { return 8 + (MAP.yMax - y) * MS; }

  // ── state ───────────────────────────────────────────────────────────────

  let scenarioKey = '1859';
  let st = E.makeState(scenarioKey);
  let speed = 6, paused = false, verdictShown = false;
  let ropeWasOut = false;

  // ── canvas setup ────────────────────────────────────────────────────────

  function setupCanvas(cv, w, h) {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  let mctx, lctx, cctx;
  const LADW = 320, LADH = 222;
  const COMW = 158, COMH = 158;
  function resize() {
    const asideW = Math.max(330, Math.min(430, document.querySelector('aside').clientWidth || 340));
    mctx = setupCanvas(mapCv, MAPW, MAPH);
    const ladderW = Math.max(180, (document.querySelector('.ladder').clientWidth || LADW) - 22);
    lctx = setupCanvas(ladderCv, ladderW, LADH);
    cctx = setupCanvas(compassCv, COMW, COMH);
  }

  // ── scenario handling ───────────────────────────────────────────────────

  function applyScenario(key) {
    scenarioKey = key;
    st = E.makeState(key);
    verdictShown = false; ropeWasOut = false;
    $('overlay').hidden = true;
    paused = false;
    document.querySelectorAll('#presets .chip').forEach(c =>
      c.classList.toggle('sel', c.dataset.scenario === key));
    $('ropeBtn').classList.remove('on');
    $('stageNote').textContent = E.SCENARIOS[key].brief;
  }

  // ── controls ────────────────────────────────────────────────────────────

  function setValve(v) {
    if (!st.launched || st.landed) v = false;
    st.valveOpen = v;
    $('valveBtn').classList.toggle('on', v);
  }
  function dropBag() {
    if (!st.launched || st.landed) return;
    E.dropBallast(st, 1);
  }
  function toggleRope() {
    if (st.landed) return;
    st.ropeOut = !st.ropeOut;
    $('ropeBtn').classList.toggle('on', st.ropeOut);
  }

  const valveBtn = $('valveBtn');
  valveBtn.addEventListener('pointerdown', () => setValve(true));
  window.addEventListener('pointerup', () => setValve(false));
  valveBtn.addEventListener('pointerleave', () => setValve(false));
  $('ballastBtn').addEventListener('click', dropBag);
  $('ropeBtn').addEventListener('click', toggleRope);
  $('launchBtn').addEventListener('click', () => {
    if (!st.launched) { st.launched = true; }
    else applyScenario(scenarioKey);
    $('launchBtn').textContent = st.launched ? 'reset' : 'cast off';
  });
  document.querySelectorAll('#presets .chip').forEach(c =>
    c.addEventListener('click', () => applyScenario(c.dataset.scenario)));
  document.querySelectorAll('#speeds .chip').forEach(c =>
    c.addEventListener('click', () => {
      speed = +c.dataset.speed;
      document.querySelectorAll('#speeds .chip').forEach(x => x.classList.toggle('sel', x === c));
    }));
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'v' || e.key === 'V') setValve(true);
    if (e.key === 'b' || e.key === 'B') dropBag();
    if (e.key === 'r' || e.key === 'R') toggleRope();
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'v' || e.key === 'V') setValve(false);
  });

  // ── drawing: the map ────────────────────────────────────────────────────

  function townInView(t) {
    return t.x > MAP.xMin - 3000 && t.x < MAP.xMax + 3000 && t.y > MAP.yMin - 3000 && t.y < MAP.yMax + 3000;
  }

  function drawMap() {
    const g = mctx, sc = E.SCENARIOS[scenarioKey];
    g.clearRect(0, 0, MAPW, MAPH);

    // graticule every 10 km from Lafayette
    g.strokeStyle = LINE; g.lineWidth = 0.6; g.globalAlpha = 0.8;
    for (let x = -10000; x <= 30000; x += 10000) {
      g.beginPath(); g.moveTo(mx(x), my(MAP.yMax)); g.lineTo(mx(x), my(MAP.yMin)); g.stroke();
    }
    for (let y = -50000; y <= 20000; y += 10000) {
      if (y < MAP.yMin || y > MAP.yMax) continue;
      g.beginPath(); g.moveTo(mx(MAP.xMin), my(y)); g.lineTo(mx(MAP.xMax), my(y)); g.stroke();
    }
    g.globalAlpha = 1;

    // the Wabash
    g.strokeStyle = WATER; g.lineWidth = 3.5; g.lineJoin = 'round'; g.globalAlpha = 0.9;
    g.beginPath();
    E.WABASH.forEach((p, i) => { if (i === 0) g.moveTo(mx(p.x), my(p.y)); else g.lineTo(mx(p.x), my(p.y)); });
    g.stroke(); g.globalAlpha = 1;
    g.fillStyle = WATER; g.font = 'italic 11px ' + SERIF;
    g.fillText('Wabash', mx(E.WABASH[3].x) + 8, my(E.WABASH[3].y) - 6);

    // course line Lafayette → target
    const T = E.TOWNS[sc.target];
    g.strokeStyle = OXIDE; g.globalAlpha = 0.45; g.setLineDash([4, 6]); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(mx(0), my(0)); g.lineTo(mx(T.x), my(T.y)); g.stroke();
    g.setLineDash([]); g.globalAlpha = 1;

    // towns
    for (const key of Object.keys(E.TOWNS)) {
      const t = E.TOWNS[key];
      if (!townInView(t)) continue;
      const isTarget = key === sc.target, isHome = key === 'lafayette';
      g.fillStyle = INK;
      g.beginPath(); g.arc(mx(t.x), my(t.y), isTarget ? 5 : 3.2, 0, 7); g.fill();
      if (t.rail) {                                    // little station square
        g.strokeStyle = INK; g.lineWidth = 1.4;
        g.strokeRect(mx(t.x) + 6, my(t.y) - 9, 8, 8);
      }
      if (isTarget) {
        g.strokeStyle = OXIDE; g.lineWidth = 1.6;
        g.beginPath(); g.arc(mx(t.x), my(t.y), 10, 0, 7); g.stroke();
        g.beginPath(); g.arc(mx(t.x), my(t.y), 14, 0, 7); g.globalAlpha = 0.4; g.stroke(); g.globalAlpha = 1;
      }
      if (isHome) {                                    // launch flag
        g.strokeStyle = INK; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(mx(t.x), my(t.y)); g.lineTo(mx(t.x), my(t.y) - 18); g.stroke();
        g.fillStyle = OXIDE;
        g.beginPath(); g.moveTo(mx(t.x), my(t.y) - 18); g.lineTo(mx(t.x) + 12, my(t.y) - 14.5);
        g.lineTo(mx(t.x), my(t.y) - 11); g.closePath(); g.fill();
      }
      g.fillStyle = isTarget ? OXIDE : INK;
      g.font = (isTarget ? 'italic 12px ' : '11px ') + SERIF;
      g.fillText(t.name + (isTarget ? ' · post office' : '') + (t.rail ? ' ⌗' : ''),
        mx(t.x) + 6, my(t.y) + 13);
    }

    // flight track
    if (st.track.length > 1) {
      for (let i = 0; i < st.track.length; i++) {
        const p = st.track[i];
        g.fillStyle = OXIDE;
        g.globalAlpha = 0.25 + 0.65 * (i / st.track.length);
        g.beginPath(); g.arc(mx(p.x), my(p.y), 1.8, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
    }

    // the balloon
    const bx = mx(st.x), by = my(st.y);
    const airborne = st.launched && !st.landed;
    // envelope
    const rg = g.createRadialGradient(bx - 4, by - 5, 2, bx, by, 13);
    rg.addColorStop(0, '#fbf5e6'); rg.addColorStop(1, '#d8c49a');
    g.fillStyle = rg; g.strokeStyle = INK; g.lineWidth = 1.4;
    g.beginPath(); g.arc(bx, by, airborne ? 11 : 9, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(51,41,29,.4)'; g.lineWidth = 0.8;   // net seams
    g.beginPath(); g.ellipse(bx, by, 11, 4.2, 0, 0, 7); g.stroke();
    g.beginPath(); g.ellipse(bx, by, 4.2, 11, 0, 0, 7); g.stroke();
    if (st.landed) {                                    // the hand-over X
      g.strokeStyle = OLIVE; g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(bx - 12, by - 12); g.lineTo(bx + 12, by + 12);
      g.moveTo(bx + 12, by - 12); g.lineTo(bx - 12, by + 12);
      g.stroke();
    }
    // velocity arrow
    if (airborne) {
      const vg = Math.hypot(st.vgx, st.vgy);
      const len = Math.min(46, 10 + vg * 2.6);
      const ax = st.vgx / (vg || 1), ay = -st.vgy / (vg || 1);
      g.strokeStyle = OLIVE; g.lineWidth = 2;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + ax * len, by + ay * len); g.stroke();
      g.fillStyle = OLIVE;
      g.beginPath();
      g.moveTo(bx + ax * len, by + ay * len);
      g.lineTo(bx + ax * (len - 7) - ay * 4, by + ay * (len - 7) + ax * 4);
      g.lineTo(bx + ax * (len - 7) + ay * 4, by + ay * (len - 7) - ax * 4);
      g.closePath(); g.fill();
      g.fillStyle = FADED; g.font = '10px ' + MONO;
      g.fillText(Math.round(st.z) + ' m', bx + 12, by - 10);
      // trail rope
      if (st.ropeOut && st.z < E.ROPE.len) {
        g.strokeStyle = '#7a6444'; g.lineWidth = 1.2; g.setLineDash([2, 3]);
        g.beginPath(); g.moveTo(bx, by + 12); g.lineTo(bx, by + 12 + Math.min(60, (E.ROPE.len - st.z) * 1.2 + 14));
        g.stroke(); g.setLineDash([]);
      }
    }

    // scale bar + north
    g.strokeStyle = INK; g.lineWidth = 1.4;
    const sx = 16, sy = MAPH - 16;
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 10000 * MS, sy);
    g.moveTo(sx, sy - 4); g.lineTo(sx, sy + 4);
    g.moveTo(sx + 10000 * MS, sy - 4); g.lineTo(sx + 10000 * MS, sy + 4);
    g.stroke();
    g.fillStyle = FADED; g.font = '10px ' + MONO;
    g.fillText('10 km', sx + 10000 * MS / 2 - 14, sy - 7);
    g.fillText('N ↑', MAPW - 36, 20);
  }

  // ── drawing: the wind ladder ────────────────────────────────────────────

  function drawLadder() {
    const g = lctx, sc = E.SCENARIOS[scenarioKey];
    const cw = ladderCv.clientWidth || LADW;
    g.clearRect(0, 0, cw, LADH);

    const top = 10, bottom = LADH - 16;
    const zToY = (z) => bottom - (z / 3000) * (bottom - top);
    const arrowX = cw * 0.62;

    // rope band
    g.fillStyle = 'rgba(122,100,68,.18)';
    g.fillRect(30, zToY(E.ROPE.len), cw - 40, bottom - zToY(E.ROPE.len));
    g.fillStyle = '#7a6444'; g.font = 'italic 9px ' + SERIF;
    g.fillText('rope', 34, zToY(E.ROPE.len) + 9);

    // axis
    g.strokeStyle = LINE; g.lineWidth = 1;
    g.beginPath(); g.moveTo(30, top); g.lineTo(30, bottom); g.stroke();
    g.fillStyle = FADED; g.font = '9px ' + MONO; g.textAlign = 'right';
    for (let z = 0; z <= 3000; z += 500) {
      const y = zToY(z);
      g.strokeStyle = LINE;
      g.beginPath(); g.moveTo(26, y); g.lineTo(30, y); g.stroke();
      g.fillText(z ? (z / 1000) + 'k' : '0', 22, y + 3);
    }
    g.textAlign = 'left';

    // wind arrows every 250 m (true-north up)
    for (let z = 0; z <= 3000; z += 250) {
      const w = E.windAt(z, sc);
      const y = zToY(z);
      const len = 7 + w.speed * 3.4;
      const dx = Math.sin(w.bearing * Math.PI / 180), dy = -Math.cos(w.bearing * Math.PI / 180);
      const x0 = arrowX - dx * len / 2, y0 = y - dy * len / 2;
      g.strokeStyle = OLIVE; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + dx * len, y0 + dy * len); g.stroke();
      g.fillStyle = OLIVE;
      g.beginPath();
      g.moveTo(x0 + dx * len, y0 + dy * len);
      g.lineTo(x0 + dx * (len - 5) - dy * 2.6, y0 + dy * (len - 5) + dx * 2.6);
      g.lineTo(x0 + dx * (len - 5) + dy * 2.6, y0 + dy * (len - 5) - dx * 2.6);
      g.closePath(); g.fill();
      if (z % 500 === 0) {
        g.fillStyle = FADED; g.font = '9px ' + MONO;
        g.fillText(Math.round(w.bearing) + '°', arrowX + 22, y + 3);
      }
    }

    // current altitude marker
    const cy = zToY(Math.max(0, Math.min(3000, st.z)));
    g.strokeStyle = OXIDE; g.lineWidth = 2;
    g.beginPath(); g.moveTo(30, cy); g.lineTo(cw - 8, cy); g.stroke();
    g.fillStyle = OXIDE;
    g.beginPath(); g.arc(arrowX + 10, cy, 3.4, 0, 7); g.fill();
    if (st.launched && !st.landed) {
      g.font = 'bold 9px ' + MONO;
      g.fillText(Math.round(st.z) + ' m · ' + st.vz.toFixed(1) + ' m/s', 34, cy - 4);
    }
  }

  // ── drawing: the steerable-arc compass ──────────────────────────────────

  function drawCompass() {
    const g = cctx, sc = E.SCENARIOS[scenarioKey];
    const R = COMW / 2;
    g.clearRect(0, 0, COMW, COMH);
    g.save(); g.translate(R, R);

    g.strokeStyle = LINE; g.lineWidth = 1.2;
    g.beginPath(); g.arc(0, 0, R - 14, 0, 7); g.stroke();
    for (let b = 0; b < 360; b += 15) {
      const a = b * Math.PI / 180;
      const r1 = R - 14, r2 = b % 90 === 0 ? R - 24 : R - 19;
      g.beginPath();
      g.moveTo(Math.sin(a) * r1, -Math.cos(a) * r1);
      g.lineTo(Math.sin(a) * r2, -Math.cos(a) * r2);
      g.stroke();
    }
    g.fillStyle = FADED; g.font = '10px ' + MONO; g.textAlign = 'center';
    g.fillText('N', 0, -(R - 30)); g.fillText('S', 0, R - 22);
    g.fillText('E', R - 26, 3); g.fillText('W', -(R - 28), 3);

    // the steerable arc — every course the ladder can hold today
    const arc = E.steerArc(sc);
    g.strokeStyle = OLIVE; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, R - 34, (arc.lo - 90) * Math.PI / 180, (arc.hi - 90) * Math.PI / 180);
    g.stroke(); g.lineCap = 'butt';
    g.fillStyle = OLIVE; g.font = '9px ' + MONO;
    const loA = (arc.lo - 90) * Math.PI / 180, hiA = (arc.hi - 90) * Math.PI / 180;
    g.fillText(Math.round(arc.lo) + '°', Math.cos(loA) * -(R - 44), Math.sin(loA) * (R - 44) + 3);
    g.textAlign = 'center';
    g.fillText(Math.round(arc.hi) + '°', -Math.cos(hiA) * -(R - 46), Math.sin(hiA) * (R - 46) + 3);
    g.textAlign = 'center';

    // target bearing needle
    const T = E.TOWNS[sc.target];
    const tb = E.bearingDeg(T.x - st.x, T.y - st.y);
    const ta = (tb - 90) * Math.PI / 180;
    g.strokeStyle = OXIDE; g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(Math.cos(ta) * 8, Math.sin(ta) * 8);
    g.lineTo(Math.cos(ta) * (R - 40), Math.sin(ta) * (R - 40));
    g.stroke();
    g.fillStyle = OXIDE; g.font = 'bold 9px ' + MONO;
    g.fillText('target', Math.cos(ta) * (R - 55), Math.sin(ta) * (R - 55) + 3);

    // current drift needle
    const vg = Math.hypot(st.vgx, st.vgy);
    if (vg > 0.3 && st.launched && !st.landed) {
      const da = (E.bearingDeg(st.vgx, st.vgy) - 90) * Math.PI / 180;
      g.strokeStyle = INK; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(Math.cos(da) * 14, Math.sin(da) * 14);
      g.lineTo(Math.cos(da) * (R - 30), Math.sin(da) * (R - 30));
      g.stroke();
      g.fillStyle = INK;
      g.beginPath(); g.arc(Math.cos(da) * (R - 30), Math.sin(da) * (R - 30), 2.6, 0, 7); g.fill();
    }
    g.restore();
  }

  // ── HUD ─────────────────────────────────────────────────────────────────

  function fmtClock(s) {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  }

  function updateHud() {
    const sc = E.SCENARIOS[scenarioKey];
    $('gAlt').innerHTML = Math.round(st.z) + '<i>m</i>';
    const v = st.vz;
    $('gVario').innerHTML = (v >= 0 ? '+' : '') + v.toFixed(1) + '<i>m/s</i>';
    $('gVario').style.color = v < -2.6 ? OXIDE : INK;
    const vg = Math.hypot(st.vgx, st.vgy);
    $('gGs').innerHTML = (st.launched ? vg.toFixed(1) : '0.0') + '<i>m/s</i>';
    $('gBrg').innerHTML = (vg > 0.3 && st.launched ? Math.round(E.bearingDeg(st.vgx, st.vgy)) : '—') + '<i>°</i>';
    $('gGas').innerHTML = st.gasKg.toFixed(1) + '<i>kg</i>';
    const gasBar = $('gasBar');
    gasBar.style.width = (100 * st.gasKg / E.SHIP.gasKg0).toFixed(1) + '%';
    gasBar.classList.toggle('low', st.gasKg < E.SHIP.gasKg0 * 0.35);
    $('gBags').innerHTML = st.ballastBags + '<i>bags</i>';
    $('bagBar').style.width = (100 * st.ballastBags / E.SHIP.ballastBags).toFixed(1) + '%';
    $('bagBar').classList.toggle('low', st.ballastBags <= 3);
    $('gClock').textContent = 'T+' + fmtClock(st.t);
    const train = $('gTrain');
    if (st.landed) {
      train.textContent = st.t <= E.TRAIN_S ? 'made ✓' : 'missed ✗';
      train.style.color = st.t <= E.TRAIN_S ? OLIVE : OXIDE;
    } else {
      train.textContent = fmtClock(E.TRAIN_S - st.t);
      train.style.color = st.t > E.TRAIN_S ? OXIDE : INK;
    }
    const T = E.TOWNS[sc.target];
    $('gDist').innerHTML = (Math.hypot(T.x - st.x, T.y - st.y) / 1000).toFixed(1) + '<i>km</i>';
    if (st.launched !== undefined) $('launchBtn').textContent = st.launched && !st.landed ? 'reset' : (st.landed ? 'reset' : 'cast off');
  }

  // ── verdict overlay ─────────────────────────────────────────────────────

  function showVerdict() {
    const v = E.verdict(st);
    if (!v) return;
    verdictShown = true;
    const sc = E.SCENARIOS[scenarioKey];
    const rows = [
      ['flight time', Math.floor(v.flightMin) + ' min ' + Math.round((v.flightMin % 1) * 60) + ' s'],
      ['touchdown', v.tdVz.toFixed(1) + ' m/s · ' + (v.wreck ? 'wrecked' : v.soft ? 'soft' : 'firm')],
      ['the bag goes to', v.deliveredTown],
      ['miss distance', (v.targetMissM / 1000).toFixed(2) + ' km from ' + E.TOWNS[sc.target].name],
      ['hydrogen left', v.gasLeftKg.toFixed(1) + ' kg'],
      ['ballast left', v.bagsLeft + ' bags'],
      ['highest altitude', Math.round(v.maxZm) + ' m'],
      ['≈ arrival in New York', v.nycHours.toFixed(0) + ' h (balloon + rail)'],
    ];
    const history = scenarioKey === '1859'
      ? '<p class="foot">History: Wise was aloft about an hour and put <em>Jupiter</em> down near '
        + 'Crawfordsville, 26 miles from Lafayette. The postmaster forwarded the bag by rail, and the '
        + 'first US airmail finished its journey to New York the ordinary way.</p>'
      : '';
    $('verdictCard').innerHTML =
      '<div class="stamp">balloon post · Aug 17, 1859 · verdict</div>' +
      '<h2>' + (v.wreck ? 'The bag split on landing' : v.onTarget
        ? 'The bag is delivered' + (v.soft ? ' — soft as a ledger closing' : '')
        : 'Down, but off the mark') + '</h2>' +
      '<table>' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>' +
      '<ul>' + v.notes.map(n => '<li>' + n + '</li>').join('') + '</ul>' + history +
      '<div class="actions"><button class="chip" id="againBtn">fly the same sky</button>' +
      '<button class="chip" id="closeBtn">read the instruments</button></div>';
    $('overlay').hidden = false;
    $('againBtn').addEventListener('click', () => applyScenario(scenarioKey));
    $('closeBtn').addEventListener('click', () => { $('overlay').hidden = true; });
  }

  // ── main loop ───────────────────────────────────────────────────────────

  let lastT = 0;
  function frame(t) {
    const dtReal = Math.min(0.1, (t - lastT) / 1000 || 0);
    lastT = t;
    if (!paused && st.launched && !st.landed) {
      E.step(st, dtReal * speed);
      if (st.landed) setValve(false);
    }
    if (st.ropeOut !== ropeWasOut) { ropeWasOut = st.ropeOut; $('ropeBtn').classList.toggle('on', st.ropeOut); }
    $('valveBtn').classList.toggle('on', st.valveOpen);
    if (st.landed && !verdictShown) showVerdict();
    drawMap(); drawLadder(); drawCompass(); updateHud();
    requestAnimationFrame(frame);
  }

  // ── demo hooks for the video renderer ───────────────────────────────────

  function navStep(seconds, opts) {
    // The test-suite navigator, live in the app: every 30 s pick the altitude
    // whose wind best points at the target, servo there with bursts and bags;
    // arrive at 2.6 km with a rate-governed, rope-assisted touchdown.
    // dtStep < 1 s is for the video renderer's smooth sub-frame stepping.
    const o = Object.assign({ triggerM: 2600, dtStep: 1 }, opts || {});
    const sc = E.SCENARIOS[scenarioKey];
    const T = E.TOWNS[sc.target];
    let valveUntil = -1e9, valveCool = 0, nextBag = 0, wantZ = 1400, lastPlan = -1e9;
    let done = 0;
    while (done < seconds - 1e-9 && !st.landed) {
      const h = Math.min(o.dtStep, seconds - done);
      const d = Math.hypot(T.x - st.x, T.y - st.y);
      if (d < o.triggerM) {
        st.ropeOut = true;
        st.valveOpen = st.z > 60 ? st.vz > -3.4 : st.vz > -0.8;
        if (st.vz < -4.2 && st.t >= nextBag && st.ballastBags > 0) { E.dropBallast(st, 1); nextBag = st.t + 15; }
      } else {
        if (st.t - lastPlan >= 30) {
          lastPlan = st.t;
          const wantB = E.bearingDeg(T.x - st.x, T.y - st.y);
          let best = null;
          for (let a = 500; a <= 2600; a += 50) {
            const err = Math.abs(((E.windAt(a, sc).bearing - wantB + 540) % 360) - 180);
            if (!best || err < best.err) best = { z: a, err };
          }
          wantZ = best.z;
        }
        if (st.z > wantZ + 150 && st.vz > -0.5 && st.t >= valveCool) { valveUntil = st.t + 3; valveCool = st.t + 30; }
        if (st.z < wantZ - 150 && st.vz < 0.5 && st.t >= nextBag && st.ballastBags > 2) { E.dropBallast(st, 1); nextBag = st.t + 40; }
        st.valveOpen = st.t < valveUntil;
      }
      E.step(st, h);
      done += h;
    }
  }

  window.__demo = {
    scenario: applyScenario,
    launch() { st.launched = true; },
    relaunch() { applyScenario(scenarioKey); },
    setValve, dropBag, toggleRope,
    setRope(b) { if (st.landed) return; st.ropeOut = !!b; $('ropeBtn').classList.toggle('on', st.ropeOut); },
    setPaused(v) { paused = v; },
    navStep(seconds, opts) { navStep(seconds, opts); drawMap(); drawLadder(); drawCompass(); updateHud(); },
    stepDraw(dt) { E.step(st, dt); drawMap(); drawLadder(); drawCompass(); updateHud(); },
    state: () => ({
      t: st.t, z: st.z, vz: st.vz, x: st.x, y: st.y, gas: st.gasKg, bags: st.ballastBags,
      launched: st.launched, landed: st.landed && JSON.parse(JSON.stringify(st.landed)),
    }),
    btnPx(id) { const r = $(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
    overlayShown: () => verdictShown && !$('overlay').hidden,
    hideOverlay() { $('overlay').hidden = true; },
  };

  // ── boot ────────────────────────────────────────────────────────────────

  resize();
  window.addEventListener('resize', resize);
  applyScenario('1859');
  requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(frame); });
})();
