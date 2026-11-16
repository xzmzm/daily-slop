/* Drive by Stills — Lunokhod 1, driven from Earth one slow-scan picture at a time.
   Everything is local and deterministic: a seeded patch of Mare Imbrium, a
   fixed-step rover model, a 1.28 s light delay each way, and a TV camera that
   takes one whole frame period to send each picture. */
(() => {
  'use strict';

  // ---- constants -----------------------------------------------------------
  const LIGHT = 1.28;                       // one-way Earth-Moon light time, s
  const SPEED = { F1: 0.8 / 3.6, F2: 2.0 / 3.6, REV: -0.8 / 3.6 };   // m/s
  const TURN = 6 * Math.PI / 180;           // rad/s, in-place turn (assumed)
  const DT = 0.05;                          // fixed simulation step, s
  const WP = { x: 5, y: 60 }, WP_R = 2.5;   // waypoint and its arrival circle
  const BOUNDS = { x0: -24, x1: 24, y0: -7, y1: 69 };
  const FOV = 50 * Math.PI / 180, CAM_H = 1.0, RANGE = 32;
  const TVW = 640, TVH = 480, FOCAL = (TVW / 2) / Math.tan(FOV / 2), HORIZON = 172;
  const LABEL = { F1: 'FORWARD 1', F2: 'FORWARD 2', REV: 'REVERSE', LEFT: 'TURN LEFT', RIGHT: 'TURN RIGHT', STOP: 'STOP' };

  const $ = (id) => document.getElementById(id);
  const tv = $('tv'), tvx = tv.getContext('2d');
  const chart = $('chart'), cx = chart.getContext('2d');

  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- world ---------------------------------------------------------------
  let world;
  function generate(seed) {
    const rnd = mulberry32(seed);
    const craters = [], rocks = [], pebbles = [];
    // One crater always sits on the straight line from the lander to the
    // waypoint, about a third of the way out: the direct route is never free.
    craters.push({ x: WP.x * 0.3 + (rnd() - 0.5), y: WP.y * 0.3 + (rnd() - 0.5) * 2, r: 3.0 + rnd() * 0.6, seen: false });
    for (let tries = 0; craters.length < 17 && tries < 900; tries++) {
      const c = { x: -22 + rnd() * 44, y: -4 + rnd() * 71, r: 1.1 + rnd() * rnd() * 3.2, seen: false };
      if (Math.hypot(c.x, c.y) < c.r + 6) continue;
      if (Math.hypot(c.x - WP.x, c.y - WP.y) < c.r + 4.5) continue;
      if (craters.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < o.r + c.r + 2.6)) continue;
      craters.push(c);
    }
    for (let tries = 0; rocks.length < 16 && tries < 900; tries++) {
      const k = { x: -22 + rnd() * 44, y: -4 + rnd() * 71, r: 0.25 + rnd() * 0.3, seen: false, shape: [] };
      if (Math.hypot(k.x, k.y) < 5 || Math.hypot(k.x - WP.x, k.y - WP.y) < 4) continue;
      if (craters.some((o) => Math.hypot(o.x - k.x, o.y - k.y) < o.r + 1.6)) continue;
      if (rocks.some((o) => Math.hypot(o.x - k.x, o.y - k.y) < 3)) continue;
      // keep the first stretch of the direct line clear, so the crater is the surprise
      if (k.y < 22 && Math.abs(k.x - WP.x * k.y / WP.y) < 2.6) continue;
      for (let i = 0; i < 6; i++) k.shape.push(0.75 + rnd() * 0.45);
      rocks.push(k);
    }
    for (let i = 0; i < 900; i++) pebbles.push({ x: -40 + rnd() * 80, y: -20 + rnd() * 110, tone: rnd() });
    return { seed, craters, rocks, pebbles };
  }

  // Worst hazard the rover body would be touching at (x, y), or null.
  function hazardAt(x, y) {
    let worst = null;
    const note = (kind, pen) => { if (pen > 0 && (!worst || pen > worst.pen)) worst = { kind, pen }; };
    for (const c of world.craters) note('crater rim', c.r + 0.5 - Math.hypot(c.x - x, c.y - y));
    for (const k of world.rocks) note('rock', k.r + 0.9 - Math.hypot(k.x - x, k.y - y));
    note('edge of the charted ground', Math.max(BOUNDS.x0 + 1 - x, x - BOUNDS.x1 + 1, BOUNDS.y0 + 1 - y, y - BOUNDS.y1 + 1));
    return worst;
  }

  // ---- run state -----------------------------------------------------------
  const cfg = { period: 21.1, warp: 4, truth: false, manual: false, seed: 1970 };
  const runs = [];
  let S;

  function reset() {
    S = {
      phase: 'ready', t: 0, x: 0, y: 0, h: 0, odo: 0, mode: 'STOP', stops: 0, trip: null,
      queue: [], tele: [], trail: [{ x: 0, y: 0 }], wedges: [],
      frames: [], shown: null, nextExposure: 0, frameNo: 0, received: 0,
      sentCmd: null, sentAt: -99, log: [], arrivedAt: null,
    };
    for (const o of world.craters) o.seen = false;
    for (const o of world.rocks) o.seen = false;
    S.shown = expose();                     // the crew starts with one complete picture
    markSeen(S.shown.pose);
    S.tele.push(snapshot());
    say('Parked beside the Luna 17 lander. Waypoint ' + waypointCall(S).text + '.');
  }

  function snapshot() { return { t: S.t, x: S.x, y: S.y, h: S.h, odo: S.odo, mode: S.mode, stops: S.stops, trip: S.trip }; }
  // What Earth knows right now: the rover's own telemetry, one light-time old.
  function telemetry() {
    const want = S.t - LIGHT;
    let pick = S.tele[0];
    for (const e of S.tele) { if (e.t <= want + 1e-9) pick = e; else break; }
    return pick;
  }

  function clock(t) {
    const s = Math.floor(t + 1e-6);
    return 'T+' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function say(text) { S.log.unshift({ t: S.t, text }); if (S.log.length > 5) S.log.pop(); }

  function waypointCall(p) {
    const dx = WP.x - p.x, dy = WP.y - p.y;
    const dist = Math.hypot(dx, dy);
    let rel = Math.atan2(dx, dy) - p.h;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel)) * 180 / Math.PI;
    const side = Math.abs(rel) < 0.5 ? 'dead ahead' : Math.abs(rel).toFixed(0) + '° ' + (rel > 0 ? 'right' : 'left');
    return { dist, rel, text: side + ', ' + dist.toFixed(0) + ' m' };
  }

  function command(cmd) {
    if (S.phase === 'arrived' || !LABEL[cmd]) return;
    if (S.phase === 'ready') S.phase = 'driving';
    S.queue.push({ cmd, arrive: S.t + LIGHT });
    S.sentCmd = cmd; S.sentAt = S.t;
    paint();
  }

  function expose() {
    const pose = { x: S.x, y: S.y, h: S.h };
    return { k: S.frameNo++, e: S.t, pose, cv: renderTV(pose, S.frameNo) };
  }

  function markSeen(pose) {
    S.wedges.push(pose);
    const sin = Math.sin(pose.h), cos = Math.cos(pose.h);
    for (const o of world.craters.concat(world.rocks)) {
      const dx = o.x - pose.x, dy = o.y - pose.y;
      const z = dx * sin + dy * cos, xr = dx * cos - dy * sin;
      if (z > 0.5 && z < RANGE && Math.abs(Math.atan2(xr, z)) < FOV / 2 + Math.atan2(o.r, z)) o.seen = true;
    }
  }

  function stepOnce() {
    if (S.phase !== 'driving') return;
    while (S.queue.length && S.queue[0].arrive <= S.t + 1e-9) {
      S.mode = S.queue.shift().cmd; S.trip = null;
    }
    if (S.mode === 'LEFT') S.h -= TURN * DT;
    else if (S.mode === 'RIGHT') S.h += TURN * DT;
    else if (SPEED[S.mode]) {
      const v = SPEED[S.mode];
      const nx = S.x + Math.sin(S.h) * v * DT, ny = S.y + Math.cos(S.h) * v * DT;
      const before = hazardAt(S.x, S.y), after = hazardAt(nx, ny);
      if (after && after.pen > (before ? before.pen : 0) + 1e-9) {
        // The rover's own tilt and load sensors stop it; Earth hears about it later.
        S.mode = 'STOP'; S.stops++; S.trip = after.kind;
        say('Automatic stop — ' + after.kind + '.');
      } else { S.x = nx; S.y = ny; S.odo += Math.abs(v) * DT; }
    }
    S.t += DT;

    if (Math.hypot(S.x - WP.x, S.y - WP.y) < WP_R) {
      S.phase = 'arrived'; S.mode = 'STOP'; S.arrivedAt = S.t; S.queue.length = 0;
      runs.unshift({ period: cfg.period, t: S.t, odo: S.odo, stops: S.stops, frames: S.received, seed: cfg.seed });
      if (runs.length > 5) runs.pop();
      say('Waypoint reached: ' + S.odo.toFixed(1) + ' m on the odometer.');
    }

    S.tele.push(snapshot());
    if (S.phase === 'arrived') S.tele = [snapshot()];   // the clock stops here; let Earth catch up
    while (S.tele.length > 2 && S.tele[1].t < S.t - LIGHT - 0.5) S.tele.shift();
    const known = telemetry(), last = S.trail[S.trail.length - 1];
    if (Math.hypot(known.x - last.x, known.y - last.y) > 0.4) S.trail.push({ x: known.x, y: known.y });

    // Slow-scan TV: expose a frame, spend one whole period sending it down.
    if (S.t >= S.nextExposure - 1e-9) { S.frames.push(expose()); S.nextExposure += cfg.period; }
    while (S.frames.length && S.t >= S.frames[0].e + cfg.period + LIGHT - 1e-9) {
      S.shown = S.frames.shift(); S.received++; markSeen(S.shown.pose);
    }
  }

  // ---- the picture ---------------------------------------------------------
  function renderTV(pose, k) {
    const cv = document.createElement('canvas'); cv.width = TVW; cv.height = TVH;
    const g = cv.getContext('2d');
    const sin = Math.sin(pose.h), cos = Math.cos(pose.h);
    const proj = (x, y, minZ) => {
      const dx = x - pose.x, dy = y - pose.y;
      const depth = dx * sin + dy * cos, z = Math.max(minZ || 0.9, depth);
      return { depth, z, sx: TVW / 2 + FOCAL * (dx * cos - dy * sin) / z, sy: HORIZON + FOCAL * CAM_H / z };
    };
    g.fillStyle = '#040404'; g.fillRect(0, 0, TVW, TVH);
    // distant hills: a fixed panorama indexed by compass bearing, so turning shows
    g.beginPath(); g.moveTo(0, HORIZON + 1);
    for (let sx = 0; sx <= TVW; sx += 4) {
      const b = pose.h + Math.atan((sx - TVW / 2) / FOCAL);
      g.lineTo(sx, HORIZON - Math.max(0, 5 + 4 * Math.sin(b * 3 + 1) + 3 * Math.sin(b * 7 + 2) + 2 * Math.sin(b * 17)));
    }
    g.lineTo(TVW, HORIZON + 1); g.fillStyle = '#767672'; g.fill();
    const ground = g.createLinearGradient(0, HORIZON, 0, TVH);
    ground.addColorStop(0, '#8b8b87'); ground.addColorStop(0.3, '#a7a7a1'); ground.addColorStop(1, '#c6c5bd');
    g.fillStyle = ground; g.fillRect(0, HORIZON, TVW, TVH - HORIZON);

    for (const p of world.pebbles) {
      const q = proj(p.x, p.y);
      if (q.depth < 2 || q.depth > 46 || q.sx < 0 || q.sx > TVW) continue;
      const s = Math.max(1, FOCAL * 0.05 / q.z);
      g.fillStyle = p.tone > 0.5 ? 'rgba(40,40,38,.45)' : 'rgba(232,231,222,.5)';
      g.fillRect(q.sx, q.sy, s * 1.6, s * 0.7);
    }

    const things = [];
    for (const c of world.craters) things.push({ c, depth: proj(c.x, c.y).depth });
    for (const r of world.rocks) things.push({ r, depth: proj(r.x, r.y).depth });
    things.sort((a, b) => b.depth - a.depth);
    for (const o of things) {
      if (o.c) {
        const c = o.c;
        if (o.depth + c.r < 1 || o.depth - c.r > 60) continue;
        const rim = [];
        for (let i = 0; i < 56; i++) {
          const a = i / 56 * Math.PI * 2;
          rim.push(proj(c.x + c.r * Math.cos(a), c.y + c.r * Math.sin(a)));
        }
        g.beginPath(); rim.forEach((p, i) => (i ? g.lineTo(p.sx, p.sy) : g.moveTo(p.sx, p.sy))); g.closePath();
        g.fillStyle = '#34342f'; g.fill();
        // far inner wall catches the sun; the near lip is only a dark edge
        for (let i = 0; i < 56; i++) {
          const a = rim[i], b = rim[(i + 1) % 56];
          const far = (a.depth + b.depth) / 2 > o.depth;
          g.beginPath(); g.moveTo(a.sx, a.sy); g.lineTo(b.sx, b.sy);
          g.strokeStyle = far ? '#deddd4' : '#1d1d1b'; g.lineWidth = far ? 2 : 1.4; g.stroke();
        }
      } else {
        const r = o.r;
        if (o.depth < 1.2 || o.depth > 50) continue;
        const q = proj(r.x, r.y), s = FOCAL * r.r / q.z;
        g.fillStyle = 'rgba(20,20,19,.75)';
        g.beginPath(); g.ellipse(q.sx + s * 0.9, q.sy, s * 1.3, Math.max(1, s * 0.22), 0, 0, Math.PI * 2); g.fill();
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI + i / 5 * Math.PI;
          const px = q.sx + Math.cos(a) * s * r.shape[i], py = q.sy + Math.sin(a) * s * 1.25 * r.shape[i];
          i ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.closePath(); g.fillStyle = '#5d5d59'; g.fill();
        g.strokeStyle = '#e4e3da'; g.lineWidth = Math.max(1, s * 0.12);
        g.beginPath(); g.moveTo(q.sx - s * r.shape[0], q.sy); g.lineTo(q.sx - s * 0.5, q.sy - s * 1.05 * r.shape[2]); g.stroke();
      }
    }

    // vidicon grain, scan lines and a soft vignette, fixed per frame number
    const rnd = mulberry32(k * 7919 + 13);
    for (let i = 0; i < 1100; i++) {
      g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.12)';
      g.fillRect(rnd() * TVW, rnd() * TVH, 2, 1);
    }
    g.fillStyle = 'rgba(0,0,0,.07)';
    for (let y = 0; y < TVH; y += 3) g.fillRect(0, y, TVW, 1);
    const vig = g.createRadialGradient(TVW / 2, TVH / 2, TVH * 0.45, TVW / 2, TVH / 2, TVW * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = vig; g.fillRect(0, 0, TVW, TVH);
    return cv;
  }

  function incoming() {
    const f = S.frames[0];
    if (!f) return null;
    const p = (S.t - f.e - LIGHT) / cfg.period;
    return p > 0 ? { f, p: Math.min(1, p) } : null;
  }

  function drawTV() {
    tvx.drawImage(S.shown.cv, 0, 0);
    const inc = incoming();
    if (inc) {
      const h = Math.max(1, Math.round(TVH * inc.p));
      tvx.drawImage(inc.f.cv, 0, 0, TVW, h, 0, 0, TVW, h);
      tvx.fillStyle = 'rgba(240,165,58,.9)'; tvx.fillRect(0, h - 1, TVW, 2);
    }
  }

  // ---- the chart -----------------------------------------------------------
  function drawChart() {
    const cssW = chart.clientWidth || 380, dpr = window.devicePixelRatio || 1;
    const spanX = BOUNDS.x1 - BOUNDS.x0, spanY = BOUNDS.y1 - BOUNDS.y0;
    const cssH = cssW * spanY / spanX;
    if (chart.width !== Math.round(cssW * dpr)) { chart.width = Math.round(cssW * dpr); chart.height = Math.round(cssH * dpr); }
    const s = cssW / spanX;
    const X = (x) => (x - BOUNDS.x0) * s, Y = (y) => (BOUNDS.y1 - y) * s;
    const g = cx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0d1114'; g.fillRect(0, 0, cssW, cssH);

    // ground that some delivered picture has covered
    g.beginPath();
    for (const w of S.wedges) {
      g.moveTo(X(w.x), Y(w.y));
      g.arc(X(w.x), Y(w.y), RANGE * s, w.h - FOV / 2 - Math.PI / 2, w.h + FOV / 2 - Math.PI / 2);
      g.closePath();
    }
    g.fillStyle = '#1a2128'; g.fill();

    g.strokeStyle = '#232b33'; g.lineWidth = 1; g.fillStyle = '#56616b'; g.font = '9px ui-monospace, Menlo, monospace';
    for (let x = -20; x <= 20; x += 10) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), cssH); g.stroke(); }
    for (let y = 0; y <= 60; y += 10) {
      g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(cssW, Y(y)); g.stroke();
      g.fillText(y + ' m', 4, Y(y) - 3);
    }

    for (const c of world.craters) {
      if (!c.seen && !cfg.truth) continue;
      g.beginPath(); g.arc(X(c.x), Y(c.y), c.r * s, 0, Math.PI * 2);
      if (c.seen) { g.fillStyle = '#07090b'; g.fill(); g.strokeStyle = '#8b959e'; g.setLineDash([]); }
      else { g.strokeStyle = '#9a6a24'; g.setLineDash([3, 3]); }
      g.lineWidth = 1.2; g.stroke(); g.setLineDash([]);
    }
    for (const k of world.rocks) {
      if (!k.seen && !cfg.truth) continue;
      g.fillStyle = k.seen ? '#aab2b9' : '#9a6a24';
      g.beginPath(); g.moveTo(X(k.x), Y(k.y) - 3.5); g.lineTo(X(k.x) + 3.5, Y(k.y) + 3); g.lineTo(X(k.x) - 3.5, Y(k.y) + 3); g.closePath(); g.fill();
    }

    // lander and waypoint
    g.strokeStyle = '#8b959e'; g.lineWidth = 1.2; g.strokeRect(X(0) - 5, Y(-3) - 5, 10, 10);
    g.fillStyle = '#8b959e'; g.fillText('LUNA 17', X(0) + 9, Y(-3) + 3);
    g.strokeStyle = '#7fd6a0'; g.lineWidth = 1.4;
    g.beginPath(); g.arc(X(WP.x), Y(WP.y), WP_R * s, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(X(WP.x) - 5, Y(WP.y)); g.lineTo(X(WP.x) + 5, Y(WP.y)); g.moveTo(X(WP.x), Y(WP.y) - 5); g.lineTo(X(WP.x), Y(WP.y) + 5); g.stroke();
    g.fillStyle = '#7fd6a0'; g.fillText('WAYPOINT', X(WP.x) + WP_R * s + 5, Y(WP.y) + 3);

    // where the picture on the screen was taken, and what it covered
    const w = S.shown.pose;
    g.beginPath(); g.moveTo(X(w.x), Y(w.y));
    g.arc(X(w.x), Y(w.y), 13 * s, w.h - FOV / 2 - Math.PI / 2, w.h + FOV / 2 - Math.PI / 2); g.closePath();
    g.fillStyle = 'rgba(240,165,58,.13)'; g.fill();
    g.strokeStyle = '#f0a53a'; g.lineWidth = 1; g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.arc(X(w.x), Y(w.y), 3, 0, Math.PI * 2); g.fillStyle = '#f0a53a'; g.fill();

    // dead-reckoned track and the rover as telemetry reports it
    g.beginPath(); S.trail.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))));
    g.strokeStyle = '#e6e2d6'; g.lineWidth = 1.3; g.stroke();
    const rover = (p, stroke, fill) => {
      g.save(); g.translate(X(p.x), Y(p.y)); g.rotate(p.h);
      g.beginPath(); g.rect(-0.8 * s, -1.1 * s, 1.6 * s, 2.2 * s);
      if (fill) { g.fillStyle = fill; g.fill(); }
      g.strokeStyle = stroke; g.lineWidth = 1.4; g.stroke();
      g.beginPath(); g.moveTo(0, -1.1 * s); g.lineTo(0, -2.4 * s); g.stroke();
      g.restore();
    };
    if (cfg.truth) rover(S, '#f0a53a', null);
    rover(telemetry(), '#e6e2d6', '#3b454e');
  }

  // ---- DOM -----------------------------------------------------------------
  function paint() {
    drawTV(); drawChart();
    const known = telemetry(), call = waypointCall(known), inc = incoming();
    const age = S.t - S.shown.e;
    $('frame-label').textContent = 'FRAME ' + String(S.shown.k).padStart(3, '0');
    $('rx-label').textContent = inc ? 'RECEIVING ' + String(inc.f.k).padStart(3, '0') + ' · ' + Math.round(inc.p * 100) + '%' : (S.phase === 'ready' ? 'CAMERA IDLE' : 'EXPOSING');
    $('st-age').textContent = age.toFixed(1) + ' s';
    $('st-stale').textContent = Math.hypot(S.shown.pose.x - known.x, S.shown.pose.y - known.y).toFixed(1) + ' m';
    $('st-heading').textContent = String(((Math.round(known.h * 180 / Math.PI) % 360) + 360) % 360).padStart(3, '0') + '°';
    $('st-odo').textContent = known.odo.toFixed(1) + ' m';
    $('st-wp').textContent = call.text;
    $('st-clock').textContent = clock(S.t);
    $('st-frames').textContent = S.received;
    $('st-stops').textContent = known.stops;

    document.querySelectorAll('.cmd').forEach((b) => {
      const flying = S.queue.some((q) => q.cmd === b.dataset.cmd);
      b.classList.toggle('flying', flying);
      b.classList.toggle('on', S.phase !== 'ready' && known.mode === b.dataset.cmd && !flying);
      b.disabled = S.phase === 'arrived';
    });
    let up;
    if (S.phase === 'arrived') up = 'Waypoint reached in ' + clock(S.arrivedAt).slice(2) + ' — ' + S.odo.toFixed(1) + ' m driven against ' + (Math.hypot(WP.x, WP.y) - WP_R).toFixed(1) + ' m in a straight line, ' + S.stops + ' automatic stop' + (S.stops === 1 ? '' : 's') + ', ' + S.received + ' pictures.';
    else if (S.phase === 'ready') up = 'Five go commands and one stop. Each takes 1.28 s to reach the Moon; the reply takes 1.28 s to come back.';
    else if (known.trip && known.mode === 'STOP') up = 'AUTOMATIC STOP — ' + known.trip + '. Turn away or reverse out.';
    else if (S.t - S.sentAt < LIGHT) up = LABEL[S.sentCmd] + ' is on its way up — ' + (LIGHT - (S.t - S.sentAt)).toFixed(1) + ' s to the Moon.';
    else if (S.t - S.sentAt < 2 * LIGHT) up = LABEL[S.sentCmd] + ' has arrived. Confirmation is on its way down.';
    else up = 'Telemetry confirms ' + LABEL[known.mode] + '. The picture is ' + age.toFixed(0) + ' s old.';
    $('uplink').textContent = up;
    $('uplink').classList.toggle('alarm', !!(known.trip && known.mode === 'STOP' && S.phase === 'driving'));

    $('log').innerHTML = S.log.map((e) => '<li><span>' + clock(e.t) + '</span>' + e.text + '</li>').join('');
    $('runs').innerHTML = runs.length ? runs.map((r) => '<li><span>' + r.period + ' s</span>' + clock(r.t).slice(2) + ' · ' + r.odo.toFixed(0) + ' m · ' + r.stops + ' stop' + (r.stops === 1 ? '' : 's') + ' · ' + r.frames + ' pictures</li>').join('') : '<li class="none">No finished drives yet.</li>';
    $('truth').setAttribute('aria-pressed', cfg.truth);
    $('truth').textContent = cfg.truth ? 'HIDE THE GROUND TRUTH' : 'SHOW THE GROUND TRUTH';
    $('seed').textContent = 'GROUND ' + cfg.seed;
  }

  function chips(id, key, attr) {
    document.querySelectorAll('#' + id + ' .chip').forEach((b) => {
      b.classList.toggle('on', Number(b.dataset[attr]) === cfg[key]);
      b.addEventListener('click', () => {
        cfg[key] = Number(b.dataset[attr]);
        document.querySelectorAll('#' + id + ' .chip').forEach((o) => o.classList.toggle('on', o === b));
        if (key === 'period') reset();      // a new camera rate is a new drive
        paint();
      });
    });
  }

  // ---- wiring --------------------------------------------------------------
  world = generate(cfg.seed);
  reset();
  chips('periods', 'period', 'period');
  chips('warps', 'warp', 'warp');
  document.querySelectorAll('.cmd').forEach((b) => b.addEventListener('click', () => command(b.dataset.cmd)));
  $('truth').addEventListener('click', () => { cfg.truth = !cfg.truth; paint(); });
  $('restart').addEventListener('click', () => { reset(); paint(); });
  $('newground').addEventListener('click', () => { cfg.seed += 1; world = generate(cfg.seed); reset(); paint(); });
  const KEYS = { ArrowUp: 'F1', w: 'F1', W: 'F2', 2: 'F2', 1: 'F1', ArrowDown: 'REV', s: 'REV', ArrowLeft: 'LEFT', a: 'LEFT', ArrowRight: 'RIGHT', d: 'RIGHT', ' ': 'STOP' };
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !KEYS[e.key] || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    e.preventDefault();
    if (!e.repeat) command(KEYS[e.key]);
  });
  window.addEventListener('resize', paint);

  let last = performance.now(), acc = 0;
  function loop(now) {
    const wall = Math.min(0.1, (now - last) / 1000); last = now;
    if (!cfg.manual && S.phase === 'driving') {
      acc += wall * cfg.warp;
      while (acc >= DT) { stepOnce(); acc -= DT; }
      paint();
    }
    requestAnimationFrame(loop);
  }
  paint();
  requestAnimationFrame(loop);

  // Read-only state plus a manual clock, for the tests and the video capture.
  window.Stills = {
    getState() {
      const k = telemetry();
      return {
        phase: S.phase, t: +S.t.toFixed(3), x: S.x, y: S.y, heading: S.h * 180 / Math.PI, odo: S.odo, mode: S.mode,
        stops: S.stops, trip: S.trip, period: cfg.period, warp: cfg.warp, truth: cfg.truth, seed: cfg.seed,
        frame: S.shown.k, received: S.received, pictureAge: S.t - S.shown.e, picturePose: { ...S.shown.pose },
        pending: S.queue.length, teleMode: k.mode, teleOdo: k.odo, teleT: k.t,
        waypoint: waypointCall(S).dist, seen: world.craters.filter((c) => c.seen).length, runs: runs.length,
      };
    },
    manual(on) { cfg.manual = !!on; acc = 0; },
    step(seconds) { for (let i = 0, n = Math.round(seconds / DT); i < n; i++) stepOnce(); paint(); },
    _world() { return { craters: world.craters.map((c) => ({ ...c })), rocks: world.rocks.map((r) => ({ x: r.x, y: r.y, r: r.r, seen: r.seen })), waypoint: { ...WP }, light: LIGHT }; },
  };
})();
