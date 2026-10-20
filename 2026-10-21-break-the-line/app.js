(function () {
  const M = window.BreakTheLineModel;
  const $ = id => document.getElementById(id);
  const view = $('view'), ctx = view.getContext('2d');
  const chart = $('chart'), cctx = chart.getContext('2d');
  const DEG = Math.PI / 180;
  const FRAMES_PER_SECOND = 20; // playback: 10 battle-minutes per second
  const COLOURS = { B: '#e8a33d', E: '#7fb6d6', struck: '#56636e', rake: '#e35b3c', fire: '#f2ecdf', sea: '#0e2433', grid: 'rgba(127,182,214,.08)' };

  const state = { params: Object.assign({}, M.PRESETS.nelson), result: null, f: 0, playing: false };

  function recompute() {
    state.result = M.simulate(state.params);
    state.f = 0;
    state.playing = false;
    $('time').max = state.result.frames.length - 1;
    syncControls();
    renderReadout();
    render();
  }

  // ----- controls -----
  function syncControls() {
    const p = state.params;
    $('angle').value = p.angle; $('wind').value = p.wind; $('rate').value = p.rate;
    $('angle-out').textContent = `${p.angle}°`;
    $('wind-out').textContent = `${p.wind} kn`;
    $('rate-out').textContent = `${p.rate}×`;
    document.querySelectorAll('[data-doctrine]').forEach(b => b.classList.toggle('on', b.dataset.doctrine === p.doctrine));
    document.querySelectorAll('[data-preset]').forEach(b => {
      const q = M.PRESETS[b.dataset.preset];
      b.classList.toggle('on', Object.keys(q).every(k => q[k] === p[k]));
    });
  }
  function set(changes) { Object.assign(state.params, changes); recompute(); }
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => set(Object.assign({}, M.PRESETS[b.dataset.preset]))));
  document.querySelectorAll('[data-doctrine]').forEach(b => b.addEventListener('click', () => set({ doctrine: b.dataset.doctrine })));
  for (const id of ['angle', 'wind', 'rate']) $(id).addEventListener('input', e => set({ [id]: Number(e.target.value) }));
  $('time').addEventListener('input', e => { state.f = Number(e.target.value); state.playing = false; render(); });
  $('play').addEventListener('click', () => {
    const last = state.result.frames.length - 1;
    if (state.playing) state.playing = false;
    else { if (state.f >= last) state.f = 0; state.playing = true; }
    render();
  });

  function advance(seconds) {
    if (!state.playing) return;
    const last = state.result.frames.length - 1;
    state.f = Math.min(last, state.f + seconds * FRAMES_PER_SECOND);
    if (state.f >= last) state.playing = false;
    render();
  }

  // ----- readouts -----
  function renderReadout() {
    const s = state.result.summary;
    $('r-silent').textContent = `${Math.round(s.leadSilent)} min`;
    $('r-lead').textContent = `lead hull ${Math.round(s.leadHull)} / ${M.C.leadHull}`;
    $('r-taken').textContent = `${s.taken} / ${M.C.nEnemy}`;
    $('r-escaped').textContent = `escaped ${s.escaped} · British lost ${s.britishLost}`;
    const v = $('verdict');
    let text, bad = false;
    if (s.escaped >= 6) {
      bad = true;
      text = `Indecisive. Every damaged Combined ship bore away downwind, and nothing stood in its way: ${s.escaped} of ${M.C.nEnemy} got clear, ${s.taken} taken. Most 18th-century fleet actions ended like this.`;
    } else if (s.taken >= 8 && s.britishLost === 0) {
      text = `Decisive: ${s.taken} of ${M.C.nEnemy} taken, ${s.escaped} escaped. British ships sat to leeward, so the damaged had nowhere to run. The price came first: the lead ship spent ${Math.round(s.leadSilent)} min under fire with no gun bearing.`;
    } else {
      text = `${s.taken} taken, ${s.escaped} escaped, ${s.britishLost} British ${s.britishLost === 1 ? 'ship' : 'ships'} struck. ${state.params.rate < 2 ? 'Without faster gunnery, the close fight is an even trade.' : 'Close quarters, but not a clean sweep.'}`;
    }
    v.textContent = text;
    v.classList.toggle('bad', bad);
  }

  // ----- drawing -----
  const lerp = (a, b, t) => a + (b - a) * t;
  function frameAt(f) {
    const frames = state.result.frames;
    const i = Math.min(frames.length - 1, Math.floor(f)), j = Math.min(frames.length - 1, i + 1), u = f - i;
    const a = frames[i], b = frames[j];
    return {
      t: lerp(a.t, b.t, u), fire: a.fire, src: a,
      view: { cx: lerp(a.view.cx, b.view.cx, u), cy: lerp(a.view.cy, b.view.cy, u), span: lerp(a.view.span, b.view.span, u) },
      ships: a.ships.map((s, k) => {
        const n = b.ships[k];
        const turn = Math.abs(n.heading - s.heading) > 1;
        return Object.assign({}, s, { x: lerp(s.x, n.x, u), y: lerp(s.y, n.y, u), heading: turn && u > .5 ? n.heading : s.heading });
      }),
    };
  }

  function fit(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (w && h && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
    return dpr;
  }

  function drawShip(c, X, Y, heading, len, fill, stroke) {
    c.save(); c.translate(X, Y); c.rotate(heading * DEG);
    const w = len * .3;
    c.beginPath();
    c.moveTo(0, -len / 2); c.quadraticCurveTo(w / 2, -len / 4, w / 2, len / 6); c.lineTo(w * .4, len / 2);
    c.lineTo(-w * .4, len / 2); c.lineTo(-w / 2, len / 6); c.quadraticCurveTo(-w / 2, -len / 4, 0, -len / 2);
    c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
    c.restore();
  }

  function drawView() {
    const dpr = fit(view);
    const w = view.width, h = view.height;
    const fr = frameAt(state.f);
    const { cx, cy, span } = fr.view;
    const scale = Math.min(w / (span * 1.3), h / span);
    const X = x => w / 2 + (x - cx) * scale, Y = y => h / 2 - (y - cy) * scale;
    ctx.fillStyle = COLOURS.sea; ctx.fillRect(0, 0, w, h);
    // 500 m grid, anchored to the sea
    ctx.strokeStyle = COLOURS.grid; ctx.lineWidth = 1;
    const step = 500;
    for (let gx = Math.floor((cx - w / 2 / scale) / step) * step; X(gx) < w; gx += step) { ctx.beginPath(); ctx.moveTo(X(gx), 0); ctx.lineTo(X(gx), h); ctx.stroke(); }
    for (let gy = Math.floor((cy - h / 2 / scale) / step) * step; Y(gy) > 0; gy += step) { ctx.beginPath(); ctx.moveTo(0, Y(gy)); ctx.lineTo(w, Y(gy)); ctx.stroke(); }
    // wakes: where each ship has been over the last 20 minutes
    const frames = state.result.frames, i0 = Math.max(0, Math.floor(state.f) - 40);
    ctx.lineWidth = 1.5 * dpr;
    fr.ships.forEach((s, k) => {
      if (s.status === 'escaped') return;
      ctx.strokeStyle = s.side === 'B' ? 'rgba(232,163,61,.22)' : 'rgba(127,182,214,.18)';
      ctx.beginPath();
      for (let i = i0; i <= Math.floor(state.f); i++) { const p = frames[i].ships[k]; i === i0 ? ctx.moveTo(X(p.x), Y(p.y)) : ctx.lineTo(X(p.x), Y(p.y)); }
      ctx.lineTo(X(s.x), Y(s.y));
      ctx.stroke();
    });
    // gunfire
    const flick = Math.floor(state.f * 3);
    fr.fire.forEach(([a, b, rake], n) => {
      const s = fr.ships[a], t = fr.ships[b];
      if (!s || !t || (flick + n) % 3 === 0) return;
      ctx.strokeStyle = rake ? COLOURS.rake : 'rgba(242,236,223,.45)';
      ctx.lineWidth = (rake ? 2 : 1) * dpr;
      ctx.beginPath(); ctx.moveTo(X(s.x), Y(s.y)); ctx.lineTo(X(t.x), Y(t.y)); ctx.stroke();
      ctx.fillStyle = rake ? COLOURS.rake : '#fff3d6';
      ctx.beginPath(); ctx.arc(X(s.x), Y(s.y), 2.5 * dpr, 0, Math.PI * 2); ctx.fill();
    });
    // ships
    const len = Math.max(26 * dpr, 60 * scale);
    fr.ships.forEach((s, k) => {
      if (s.status === 'escaped') return;
      const full = s.side === 'B' && k === 0 ? M.C.leadHull : 100;
      let fill;
      if (s.status === 'struck') fill = COLOURS.struck;
      else {
        ctx.globalAlpha = .35 + .65 * s.hull / full;
        fill = COLOURS[s.side];
      }
      drawShip(ctx, X(s.x), Y(s.y), s.heading, len, fill, s.status === 'flee' ? '#ffffff' : null);
      ctx.globalAlpha = 1;
      if (s.status === 'struck') {
        ctx.strokeStyle = '#c9d3db'; ctx.lineWidth = 1.5 * dpr; const r = 4 * dpr;
        ctx.beginPath(); ctx.moveTo(X(s.x) - r, Y(s.y) - r); ctx.lineTo(X(s.x) + r, Y(s.y) + r); ctx.moveTo(X(s.x) + r, Y(s.y) - r); ctx.lineTo(X(s.x) - r, Y(s.y) + r); ctx.stroke();
      }
      if (s.side === 'B' && k === 0) {
        ctx.strokeStyle = COLOURS.B; ctx.lineWidth = 1 * dpr; ctx.setLineDash([3 * dpr, 3 * dpr]);
        ctx.beginPath(); ctx.arc(X(s.x), Y(s.y), len * .75, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = COLOURS.B; ctx.font = `${11 * dpr}px ui-monospace, Menlo, monospace`;
        ctx.fillText('LEAD', X(s.x) + len * .8, Y(s.y) - len * .5);
      }
    });
    // wind arrow and scale bar
    ctx.fillStyle = 'rgba(11,24,34,.75)'; ctx.fillRect(12 * dpr, 12 * dpr, 132 * dpr, 34 * dpr);
    ctx.strokeStyle = '#c9d3db'; ctx.fillStyle = '#c9d3db'; ctx.lineWidth = 2 * dpr;
    const ax = 22 * dpr, ay = 36 * dpr;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + 40 * dpr, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax + 46 * dpr, ay); ctx.lineTo(ax + 38 * dpr, ay - 5 * dpr); ctx.lineTo(ax + 38 * dpr, ay + 5 * dpr); ctx.fill();
    ctx.font = `${11 * dpr}px ui-monospace, Menlo, monospace`;
    ctx.fillText(`WIND ${state.params.wind} kn`, ax + 54 * dpr, ay + 4 * dpr);
    ctx.fillText('FROM W', ax, ay - 10 * dpr);
    const bar = 500 * scale;
    ctx.fillRect(16 * dpr, h - 20 * dpr, bar, 2 * dpr);
    ctx.fillText('500 m', 16 * dpr + bar + 8 * dpr, h - 15 * dpr);
  }

  function drawChart() {
    const dpr = fit(chart);
    const w = chart.width, h = chart.height, pad = 8 * dpr;
    cctx.fillStyle = '#0b1822'; cctx.fillRect(0, 0, w, h);
    const frames = state.result.frames, n = frames.length - 1;
    const full = { B: (M.C.nBritish - 1) * 100 + M.C.leadHull, E: M.C.nEnemy * 100 };
    const X = i => pad + (w - 2 * pad) * i / n, Y = v => h - pad - (h - 2 * pad - 14 * dpr) * v;
    for (const side of ['E', 'B']) {
      cctx.strokeStyle = COLOURS[side]; cctx.lineWidth = 2 * dpr; cctx.beginPath();
      frames.forEach((f, i) => { const y = Y(f.strength[side] / full[side]); i ? cctx.lineTo(X(i), y) : cctx.moveTo(X(i), y); });
      cctx.stroke();
    }
    cctx.strokeStyle = 'rgba(242,236,223,.6)'; cctx.lineWidth = 1 * dpr;
    cctx.beginPath(); cctx.moveTo(X(state.f), pad); cctx.lineTo(X(state.f), h - pad); cctx.stroke();
    cctx.font = `${10 * dpr}px ui-monospace, Menlo, monospace`;
    cctx.fillStyle = COLOURS.B; cctx.fillText('BRITISH STRENGTH', pad, pad + 6 * dpr);
    cctx.fillStyle = COLOURS.E; cctx.fillText('COMBINED, STILL IN THE FIGHT', pad + 120 * dpr, pad + 6 * dpr);
  }

  function phase(fr) {
    const lead = fr.ships[0];
    const inLine = fr.ships.filter(s => s.side === 'E' && (s.status === 'line' || s.status === 'flee')).length;
    if (!inLine) return '/ OVER';
    if (lead.status === 'approach') return Math.abs(lead.x) < 120 ? '/ BREAKING THROUGH' : '/ APPROACH';
    return state.params.doctrine === 'cut' ? '/ MÊLÉE, TO LEEWARD' : '/ LINE AGAINST LINE';
  }

  function render() {
    const fr = frameAt(state.f);
    drawView();
    drawChart();
    const minutes = Math.round(fr.t / 60);
    $('clock').textContent = `+${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
    $('time').value = Math.round(state.f);
    $('phase').textContent = phase(fr.src);
    const last = state.result.frames.length - 1;
    $('play-icon').textContent = state.playing ? '❚❚' : '▶';
    $('play-label').textContent = state.playing ? 'Pause' : state.f >= last ? 'Replay' : state.f > 0 ? 'Resume' : 'Play the battle';
  }

  let lastTime = null;
  function loop(now) {
    if (!window.__manualClock && lastTime !== null) advance(Math.min(.1, (now - lastTime) / 1000));
    lastTime = now;
    requestAnimationFrame(loop);
  }
  window.addEventListener('resize', render);
  recompute();
  requestAnimationFrame(loop);
  window.breakTheLine = { state, advance, render, set };
})();
