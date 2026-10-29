// Station Break — UI: the hour as a strip, listeners as lines, draggable announcements.
(function () {
  const M = window.StationBreakModel;
  const { C } = M;
  const $ = (id) => document.getElementById(id);
  const canvas = $('view');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const LEFT = 92, RIGHT = 18, RIB_TOP = 34, RIB_BOT = 86, ROWS_TOP = 108, ROWS_BOT = H - 18;
  const MIN_PER_SEC = 2; // play speed: the hour in 30 seconds
  const listeners = M.makeListeners();
  const bestCache = new Map();

  const state = { extras: [], belief: 8, breakAt: 40, t: 0, playing: false, preset: 'aired', result: null, drag: null };
  const X = (t) => LEFT + (t / C.hour) * (W - LEFT - RIGHT);
  const T = (x) => ((x - LEFT) / (W - LEFT - RIGHT)) * C.hour;
  const newsEnd = () => Math.min(C.newsEnd, state.breakAt);
  const snap = (t) => Math.min(newsEnd() - C.announceLen, Math.max(C.newsStart, Math.round(t * 2) / 2));
  const cfg = () => ({ extras: state.extras.slice(), belief: state.belief, breakAt: state.breakAt });
  const pct = (x) => `${Math.round(x * 100)}%`;

  function recompute() {
    state.result = M.evaluate(cfg(), listeners);
  }

  function rowY(i) {
    return ROWS_TOP + (i + 0.5) * (ROWS_BOT - ROWS_TOP) / listeners.length;
  }

  function drawRibbon() {
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ab957a';
    for (let m = 0; m <= 60; m += 10) {
      ctx.fillText(m === 60 ? '9:00' : `8:${String(m).padStart(2, '0')}`, X(m), 20);
      ctx.fillStyle = 'rgba(171,149,122,.12)';
      ctx.fillRect(X(m), RIB_TOP, 1, ROWS_BOT - RIB_TOP);
      ctx.fillStyle = '#ab957a';
    }
    const bands = [
      [0, C.newsStart, '#3a2a1c', 'PLAY'],
      [C.newsStart, newsEnd(), '#5a3a1e', 'FAKE LIVE NEWSCAST'],
      [newsEnd(), C.signoff, '#3a2a1c', 'NARRATED SECOND HALF'],
      [C.signoff, C.hour, '#3a2a1c', ''],
    ];
    for (const [a, b, col, label] of bands) {
      ctx.fillStyle = col;
      ctx.fillRect(X(a) + 1, RIB_TOP, X(b) - X(a) - 2, RIB_BOT - RIB_TOP);
      if (label) {
        ctx.fillStyle = '#f3e6cf';
        ctx.font = '600 12px ui-monospace, Menlo, monospace';
        ctx.fillText(label, (X(a) + X(b)) / 2, RIB_BOT - 10);
      }
    }
    // the moment NBC's audience went looking
    ctx.fillStyle = '#e2563a';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('↓ 8:12 NBC sketch ends', X(12.1), RIB_TOP + 14);
    // announcements
    state.result.spans.forEach(([s]) => {
      const extra = state.extras.includes(s);
      const x = X(s);
      ctx.fillStyle = extra ? '#8fc9a0' : 'rgba(143,201,160,.7)';
      ctx.fillRect(x - 1.5, RIB_TOP - 4, Math.max(3, X(s + C.announceLen) - x), ROWS_BOT - RIB_TOP + 4);
      if (extra) {
        ctx.beginPath();
        ctx.arc(x, RIB_TOP - 4, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a110b';
        ctx.font = '600 10px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('i', x, RIB_TOP - 0.5);
      }
    });
  }

  function seg(i, a, b, color) {
    const lo = Math.max(a, 0), hi = Math.min(b, state.t);
    if (hi <= lo) return;
    const y = rowY(i);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(X(lo), y);
    ctx.lineTo(X(hi), y);
    ctx.stroke();
  }

  function drawRows() {
    ctx.lineWidth = Math.max(1, (ROWS_BOT - ROWS_TOP) / listeners.length);
    state.result.fates.forEach((f, i) => {
      // faint ghost of the whole stay, so the shape of the crowd shows before play
      ctx.strokeStyle = 'rgba(171,149,122,.13)';
      ctx.beginPath(); ctx.moveTo(X(f.arrive), rowY(i)); ctx.lineTo(X(f.leave), rowY(i)); ctx.stroke();
      if (f.believedAt !== null && (f.warnedAt === null || f.believedAt < f.warnedAt)) {
        seg(i, f.arrive, f.believedAt, '#f0c36a');
        seg(i, f.believedAt, f.leave, '#e2563a');
      } else if (f.warnedAt !== null) {
        seg(i, f.arrive, f.warnedAt, '#f0c36a');
        seg(i, f.warnedAt, f.leave, '#8fc9a0');
      } else {
        seg(i, f.arrive, f.leave, '#f0c36a');
      }
    });
    // group labels
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'right';
    const groups = { regular: 'FROM 8:00', dial: 'FROM NBC', drift: 'DRIFT-INS' };
    for (const kind of Object.keys(groups)) {
      const idx = state.result.fates.map((f, i) => f.kind === kind ? i : -1).filter(i => i >= 0);
      if (!idx.length) continue;
      if (kind === 'drift') continue;
      const mid = rowY(idx[Math.floor(idx.length / 2)]);
      ctx.fillStyle = kind === 'dial' ? '#e2563a' : '#ab957a';
      ctx.fillText(groups[kind], LEFT - 10, mid + 4);
    }
    ctx.fillStyle = '#ab957a';
    ctx.fillText('LATER', LEFT - 10, ROWS_BOT - 30);
    ctx.fillText('ARRIVALS', LEFT - 10, ROWS_BOT - 16);
  }

  function drawPlayhead() {
    if (state.t <= 0 || state.t >= C.hour) return;
    const x = X(state.t);
    ctx.fillStyle = '#f3e6cf';
    ctx.fillRect(x - 1, RIB_TOP - 6, 2, ROWS_BOT - RIB_TOP + 8);
  }

  function render() {
    if (!state.result) recompute();
    const r = state.result;
    ctx.clearRect(0, 0, W, H);
    drawRibbon();
    drawRows();
    drawPlayhead();
    $('clock').textContent = M.clock(state.t);
    $('beat').textContent = M.beatAt(state.t);
    $('time').value = state.t;
    const inAnnounce = r.spans.some(([s, e]) => state.t >= s && state.t < e + 0.3);
    const inNews = state.t >= C.newsStart && state.t < newsEnd();
    $('lamp').className = 'lamp ' + (inAnnounce ? 'warn' : inNews ? 'on' : '');
    $('phase').textContent = '/ ' + (state.t < C.newsStart ? 'THE PLAY BEGINS' : state.t < newsEnd() ? 'FAKE NEWSCAST' : state.t < C.signoff ? 'AFTER THE BREAK' : 'GOODNIGHT');
    $('play-label').textContent = state.playing ? 'Pause' : state.t >= C.hour ? 'Replay' : 'Play the hour';
    $('play-icon').textContent = state.playing ? '❚❚' : '▶';
    $('belief-out').textContent = `${state.belief} min`;
    $('r-share').textContent = pct(r.share);
    $('r-count').textContent = `${r.believers} of ${r.fates.length} listeners`;
    $('r-dial').textContent = pct(r.dialShare);
    $('r-longest').textContent = `${r.longest.toFixed(1).replace(/\.0$/, '')} min`;
    const k = Math.min(C.maxExtra, Math.max(1, state.extras.length));
    $('best-k').textContent = k;
    $('best').lastChild.textContent = k === 1 ? ' announcement' : ' announcements';
    document.querySelectorAll('[data-preset]').forEach(b => { b.className = b.dataset.preset === state.preset ? 'on' : ''; });
    $('verdict').textContent = verdict(r);
  }

  function verdict(r) {
    const n = state.extras.length;
    if (n === 0) return `As aired, the 8:00 warning reached only the people already listening. ${pct(r.dialShare)} of the listeners who came over from NBC heard ${state.belief} minutes of bulletins before CBS said it was a play.`;
    if (state.preset === 'every10') return `Three breaks, evenly spaced: ${pct(r.share)} still believe. The 8:10 break comes just before the NBC crowd arrives, and the next is ten minutes later. Try “Best spot for 1”.`;
    const times = state.extras.map(t => M.clock(t).slice(0, 4)).join(', ');
    if (r.dialShare < 0.02) return `Announcing at ${times} catches the NBC listeners within ${state.belief} minutes of arriving: ${pct(r.share)} believe overall. The timing does the work, not the count.`;
    return `Announcing at ${times}: ${pct(r.share)} believe, including ${pct(r.dialShare)} of the NBC listeners. An announcement only reaches people already tuned in.`;
  }

  function setPreset(name) {
    const p = M.PRESETS[name];
    state.extras = p.extras.slice();
    state.breakAt = p.breakAt;
    state.preset = name;
    recompute();
    render();
  }

  function changed() {
    state.preset = state.extras.length === 0 ? 'aired' : null;
    recompute();
    render();
  }

  function findBest() {
    const k = Math.min(C.maxExtra, Math.max(1, state.extras.length));
    const key = `${k}/${state.belief}/${state.breakAt}`;
    if (!bestCache.has(key)) bestCache.set(key, M.best(k, cfg(), listeners).extras);
    state.extras = bestCache.get(key).slice();
    changed();
  }

  // pointer: add, drag, remove announcements
  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * W / rect.width, y: (e.clientY - rect.top) * H / rect.height };
  }
  canvas.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    if (p.y > ROWS_TOP) return;
    const hit = state.extras.findIndex(t => Math.abs(X(t) - p.x) < 12);
    if (hit >= 0) {
      state.drag = { index: hit, startX: p.x, moved: false };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    const t = T(p.x);
    if (t >= C.newsStart && t < newsEnd() && state.extras.length < C.maxExtra) {
      state.extras.push(snap(t));
      changed();
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state.drag) return;
    const p = toCanvas(e);
    if (Math.abs(p.x - state.drag.startX) > 4) state.drag.moved = true;
    if (!state.drag.moved) return;
    state.extras[state.drag.index] = snap(T(p.x));
    changed();
  });
  canvas.addEventListener('pointerup', () => {
    if (state.drag && !state.drag.moved) {
      state.extras.splice(state.drag.index, 1);
      changed();
    }
    state.drag = null;
  });

  // playback
  let last = null;
  function advance(seconds) {
    if (!state.playing) return;
    state.t = Math.min(C.hour, state.t + seconds * MIN_PER_SEC);
    if (state.t >= C.hour) state.playing = false;
    render();
  }
  function frame(now) {
    if (!state.playing) { last = null; return; }
    if (!window.__manualClock && last !== null) advance((now - last) / 1000);
    last = now;
    requestAnimationFrame(frame);
  }
  $('play').addEventListener('click', () => {
    if (state.playing) { state.playing = false; render(); return; }
    if (state.t >= C.hour) state.t = 0;
    state.playing = true;
    render();
    requestAnimationFrame(frame);
  });
  $('time').addEventListener('input', (e) => { state.t = +e.target.value; state.playing = false; render(); });
  $('belief').addEventListener('input', (e) => { state.belief = +e.target.value; recompute(); render(); });
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => setPreset(b.dataset.preset)));
  $('best').addEventListener('click', findBest);

  // open with the hour fully drawn, as aired
  state.t = C.hour;
  setPreset('aired');
  window.stationBreak = { state, render, recompute, advance, setPreset, findBest, setExtras(list) { state.extras = list.slice(); changed(); } };
})();
