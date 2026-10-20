(function () {
  const M = window.OneSphereModel;
  const $ = id => document.getElementById(id);
  const view = $('view'), ctx = view.getContext('2d');
  const ribsCanvas = $('ribs'), rctx = ribsCanvas.getContext('2d');
  const DEG = Math.PI / 180;

  const state = { mode: 'sphere', shell: 0, t: 0, target: 0, playing: false, yaw: 38, pitch: 20, meshes: null, moulds: {} };
  const PLAY_SECONDS = 5;

  function rebuild() {
    state.meshes = M.SHELLS.map(s => M.mesh(s, state.mode));
    if (!state.moulds[state.mode]) state.moulds[state.mode] = M.moulds(state.mode);
  }

  // ----- camera -----
  const lerp = (a, b, t) => a + (b - a) * t;
  function camera(w, h) {
    const e = state.t * state.t * (3 - 2 * state.t);
    const target = [lerp(0, -8, e), lerp(0, 0, e), lerp(18, 14, e)];
    const dist = lerp(270, 330, e);
    const y = state.yaw * DEG, p = state.pitch * DEG;
    const f = [Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), -Math.sin(p)];
    const eye = target.map((v, i) => v - f[i] * dist);
    let r = [f[1], -f[0], 0]; const rn = Math.hypot(r[0], r[1]); r = [r[0] / rn, r[1] / rn, 0];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const F = Math.min(w * 1.25, h * 2.2);
    return {
      eye,
      project(pt) {
        const d = [pt[0] - eye[0], pt[1] - eye[1], pt[2] - eye[2]];
        const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
        return [w / 2 + F * (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / z, h * .54 - F * (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / z, z];
      },
    };
  }

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = a => { const n = Math.hypot(...a) || 1; return a.map(x => x / n); };
  const LIGHT = norm([0.5, -0.35, 0.8]);

  function polygon(c, pts, fill, stroke) {
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.stroke(); }
  }

  // free-form ribs are coloured by how their curvature strays from 1/R
  function ribColour(k, alpha) {
    const dev = Math.max(-1, Math.min(1, (k * M.R - 1) / 0.35));
    const hue = 200 - dev * 170;
    return `hsla(${hue},75%,${55 + 8 * Math.abs(dev)}%,${alpha})`;
  }

  function drawView() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(view.clientWidth * dpr), h = Math.round(view.clientHeight * dpr);
    if (w && h && (view.width !== w || view.height !== h)) { view.width = w; view.height = h; }
    const W = view.width, H = view.height, s = W / 900;
    const cam = camera(W, H);
    ctx.clearRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0f2131'); sky.addColorStop(1, '#0a131c');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    const site = state.t;
    if (site > 0.45) {   // harbour and podium fade in under the shells
      ctx.globalAlpha = Math.min(1, (site - 0.45) / 0.35);
      const water = [[-400, -400, -14], [400, -400, -14], [400, 400, -14], [-400, 400, -14]].map(cam.project);
      if (water.every(p => p[2] > 1)) polygon(ctx, water, '#0d2b40');
      const top = [[-92, -92, 0], [80, -92, 0], [80, 64, 0], [-92, 64, 0]];
      const base = top.map(p => [p[0], p[1], -14]);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4, side = [top[i], top[j], base[j], base[i]].map(cam.project);
        polygon(ctx, side, '#6e5a44');
      }
      polygon(ctx, top.map(cam.project), '#a68d6c', 'rgba(0,0,0,.25)');
      ctx.globalAlpha = 1;
    }

    // ghost sphere: meridians and parallels, fading as the shells leave
    const ghost = (1 - site) * 0.55;
    if (ghost > 0.02) {
      ctx.strokeStyle = `rgba(95,179,217,${ghost * 0.5})`; ctx.lineWidth = s; ctx.setLineDash([4 * s, 5 * s]);
      for (let m = 0; m < 12; m++) {
        ctx.beginPath();
        for (let a = 0; a <= 36; a++) {
          const th = a / 36 * Math.PI, ph = m / 12 * Math.PI * 2;
          const p = cam.project([M.R * Math.sin(th) * Math.cos(ph), M.R * Math.sin(th) * Math.sin(ph), M.R * Math.cos(th)]);
          a ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
        }
        ctx.stroke();
      }
      for (let l = 1; l < 6; l++) {
        ctx.beginPath();
        const th = l / 6 * Math.PI;
        for (let a = 0; a <= 48; a++) {
          const ph = a / 48 * Math.PI * 2;
          const p = cam.project([M.R * Math.sin(th) * Math.cos(ph), M.R * Math.sin(th) * Math.sin(ph), M.R * Math.cos(th)]);
          a ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // shells: collect every quad, sort far to near, paint
    const quads = [];
    M.SHELLS.forEach((shell, si) => {
      const pl = M.placement(shell, M.shellT(shell, state.t));
      const grid = state.meshes[si].map(row => row.map(p => M.place(p, pl)));
      const nu = grid.length - 1, nw = grid[0].length - 1;
      for (let i = 0; i < nu; i++) for (let j = 0; j < nw; j++) {
        const a = grid[i][j], b = grid[i + 1][j], c = grid[i + 1][j + 1], d = grid[i][j + 1];
        const outer = norm(cross(sub(d, a), sub(b, a)));   // away from the sphere's centre
        const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
        const facing = dot(outer, sub(cam.eye, mid)) > 0;
        const pa = cam.project(a), pb = cam.project(b), pc = cam.project(c), pd = cam.project(d);
        const k = M.curvature(shell, -1 + 2 * j / nw, (i + .5) / nu * shell.L, state.mode);
        quads.push({ si, i, j, nu, nw, z: (pa[2] + pb[2] + pc[2] + pd[2]) / 4, pts: [pa, pb, pc, pd], facing, light: dot(facing ? outer : outer.map(x => -x), LIGHT), k });
      }
    });
    quads.sort((p, q) => q.z - p.z);
    ctx.lineJoin = 'round';
    for (const q of quads) {
      if (q.pts.some(p => p[2] < 1)) continue;
      const sel = q.si === state.shell;
      const l = Math.max(0, q.light);
      let fill;
      if (q.facing) {
        const v = 0.45 + 0.55 * l;
        fill = sel ? `rgb(${Math.round(240 * v)},${Math.round(176 * v)},${Math.round(90 * v)})` : `rgb(${Math.round(239 * v)},${Math.round(231 * v)},${Math.round(212 * v)})`;
      } else {
        const v = 0.3 + 0.35 * l;
        fill = sel ? `rgb(${Math.round(150 * v)},${Math.round(105 * v)},${Math.round(60 * v)})` : `rgb(${Math.round(150 * v)},${Math.round(146 * v)},${Math.round(138 * v)})`;
      }
      polygon(ctx, q.pts, fill, fill);
      // rib line along the left edge of each quad (plus the last rib)
      ctx.lineWidth = (q.facing ? 0.8 : 1.4) * s;
      ctx.strokeStyle = state.mode === 'free' ? ribColour(q.k, q.facing ? 0.75 : 0.95) : (q.facing ? 'rgba(120,108,88,.45)' : 'rgba(40,36,30,.7)');
      ctx.beginPath(); ctx.moveTo(q.pts[0][0], q.pts[0][1]); ctx.lineTo(q.pts[1][0], q.pts[1][1]);
      if (q.j === q.nw - 1) { ctx.moveTo(q.pts[3][0], q.pts[3][1]); ctx.lineTo(q.pts[2][0], q.pts[2][1]); }
      ctx.stroke();
      if (sel && (q.i === q.nu - 1 || q.j === 0 || q.j === q.nw - 1)) {
        ctx.strokeStyle = 'rgba(232,163,61,.95)'; ctx.lineWidth = 1.6 * s; ctx.beginPath();
        if (q.i === q.nu - 1) { ctx.moveTo(q.pts[1][0], q.pts[1][1]); ctx.lineTo(q.pts[2][0], q.pts[2][1]); }
        if (q.j === 0) { ctx.moveTo(q.pts[0][0], q.pts[0][1]); ctx.lineTo(q.pts[1][0], q.pts[1][1]); }
        if (q.j === q.nw - 1) { ctx.moveTo(q.pts[3][0], q.pts[3][1]); ctx.lineTo(q.pts[2][0], q.pts[2][1]); }
        ctx.stroke();
      }
    }
  }

  // every rib of the selected shell, drawn in its own plane from the pedestal
  function drawRibs() {
    const W = ribsCanvas.width, H = ribsCanvas.height, shell = M.SHELLS[state.shell];
    rctx.clearRect(0, 0, W, H);
    const pad = 16, scale = (H - 2 * pad) / 62, ox = pad + 6, oy = H - pad;
    const X = r => ox + r * scale, Y = h => oy - h * scale;
    rctx.strokeStyle = '#1b2c3c'; rctx.lineWidth = 1;
    for (let g = 0; g <= 60; g += 10) { rctx.beginPath(); rctx.moveTo(ox, Y(g)); rctx.lineTo(W - pad, Y(g)); rctx.stroke(); }
    rctx.font = '10px ui-monospace,Consolas,monospace'; rctx.fillStyle = '#8ea2b3';
    rctx.fillText('60 m', W - pad - 30, Y(60) - 3);
    // the sphere's circle through the pedestal
    rctx.setLineDash([4, 4]); rctx.strokeStyle = 'rgba(95,179,217,.7)'; rctx.beginPath();
    for (let a = 0; a <= 90; a++) { const s = a / 90 * M.R * 1.25; const x = X(M.R * Math.sin(s / M.R)), y = Y(M.R * (1 - Math.cos(s / M.R))); a ? rctx.lineTo(x, y) : rctx.moveTo(x, y); }
    rctx.stroke(); rctx.setLineDash([]);
    for (let j = 0; j < shell.ribs; j++) {
      const w = -1 + 2 * j / (shell.ribs - 1);
      let prev = null;
      for (let i = 0; i <= 30; i++) {
        const s = i / 30 * shell.L, p = M.profile(shell, w, s, state.mode), pt = [X(p[0]), Y(p[1])];
        if (prev) {
          rctx.strokeStyle = state.mode === 'free' ? ribColour(M.curvature(shell, w, s, 'free'), .85) : 'rgba(232,163,61,.9)';
          rctx.lineWidth = state.mode === 'free' ? 1.2 : 2.4;
          rctx.beginPath(); rctx.moveTo(prev[0], prev[1]); rctx.lineTo(pt[0], pt[1]); rctx.stroke();
        }
        prev = pt;
      }
    }
    rctx.fillStyle = '#8ea2b3';
    rctx.fillText(`${shell.ribs} ribs · ${shell.L.toFixed(1)} m long`, ox, 14);
    rctx.fillStyle = '#e8a33d'; rctx.beginPath(); rctx.arc(ox, oy, 3.5, 0, Math.PI * 2); rctx.fill();
  }

  function updateText() {
    const shell = M.SHELLS[state.shell], m = state.moulds[state.mode];
    $('shell-name').textContent = `${shell.id} · ${shell.hall}`;
    $('r-curves').textContent = m.curves.toLocaleString('en');
    $('r-segs').textContent = `across ${m.segments.toLocaleString('en')} segments`;
    const dev = M.deviation(shell, state.mode);
    $('r-dev').textContent = `${dev.toFixed(dev < 0.005 ? 2 : 1)} m`;
    const v = $('verdict');
    if (state.mode === 'sphere') {
      v.className = 'verdict';
      v.textContent = `Every rib on all ten shells is an arc of the same 75 m circle. Any 4.5 m segment fits anywhere on the roof, so the ${m.segments.toLocaleString('en')} pieces come from one curved mould shape.`;
    } else {
      v.className = 'verdict bad';
      v.textContent = `Each rib turns at its own rate, so the same ${m.segments.toLocaleString('en')} segments need ${m.curves.toLocaleString('en')} different curves. ${shell.id} strays ${dev.toFixed(1)} m from any sphere through its pedestal.`;
    }
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === state.mode));
    document.querySelectorAll('#chips button').forEach((b, i) => b.classList.toggle('on', i === state.shell));
  }

  function syncTransport() {
    $('assemble').value = Math.round(state.t * 1000);
    const up = state.playing ? state.target === 1 : state.t < 0.5;
    $('play-label').textContent = state.playing ? 'Pause' : up ? 'Place on the podium' : 'Put them back on the sphere';
    $('play').querySelector('span').textContent = state.playing ? '❚❚' : '▶';
    $('where').textContent = state.t < 0.02 ? '/ ON THE SPHERE' : state.t > 0.98 ? '/ ON THE PODIUM' : '/ IN TRANSIT';
  }

  function render() { drawView(); drawRibs(); updateText(); syncTransport(); }

  function advance(dt) {
    if (state.playing) {
      const step = dt / PLAY_SECONDS;
      state.t = state.target > state.t ? Math.min(state.target, state.t + step) : Math.max(state.target, state.t - step);
      if (state.t === state.target) state.playing = false;
    }
    render();
  }

  // ----- wiring -----
  M.SHELLS.forEach((s, i) => {
    const b = document.createElement('button');
    b.textContent = s.id; b.title = s.hall;
    b.addEventListener('click', () => { state.shell = i; render(); });
    $('chips').appendChild(b);
  });
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { state.mode = b.dataset.mode; rebuild(); render(); }));
  $('play').addEventListener('click', () => {
    if (state.playing) state.playing = false;
    else { state.target = state.t < 0.5 ? 1 : 0; state.playing = true; }
    render();
  });
  $('assemble').addEventListener('input', e => { state.playing = false; state.t = e.target.value / 1000; render(); });

  let drag = null;
  view.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; view.setPointerCapture(e.pointerId); view.classList.add('drag'); });
  view.addEventListener('pointermove', e => {
    if (!drag) return;
    state.yaw -= (e.clientX - drag[0]) * 0.35;
    state.pitch = Math.max(4, Math.min(70, state.pitch + (e.clientY - drag[1]) * 0.25));
    drag = [e.clientX, e.clientY];
    render();
  });
  const end = () => { drag = null; view.classList.remove('drag'); };
  view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
  view.tabIndex = 0;
  view.addEventListener('keydown', e => {
    const turn = { ArrowLeft: 5, ArrowRight: -5 }[e.key], tip = { ArrowUp: 3, ArrowDown: -3 }[e.key];
    if (turn) state.yaw += turn; else if (tip) state.pitch = Math.max(4, Math.min(70, state.pitch + tip)); else return;
    e.preventDefault(); render();
  });
  window.addEventListener('resize', render);

  let last = null;
  function frame(now) {
    if (!window.__manualClock && state.playing) advance(last == null ? 0 : Math.min(0.05, (now - last) / 1000));
    last = now;
    requestAnimationFrame(frame);
  }

  rebuild(); render();
  requestAnimationFrame(frame);
  window.oneSphere = { state, render, advance, rebuild };
})();
