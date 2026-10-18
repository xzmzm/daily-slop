(function () {
  'use strict';
  const M = window.SellModel;
  const $ = id => document.getElementById(id);
  const svg = $('chart');
  const NS = 'http://www.w3.org/2000/svg';
  const X0 = 64, PY0 = 18, PY1 = 300, BY0 = 330, BY1 = 440;
  const SPEED = 30; // simulated minutes per second
  const PRESETS = {
    1987: { insured: 2.5, shock: 5, liquidity: 1, breaker: false },
    none: { insured: 0, shock: 5, liquidity: 1, breaker: false },
    today: { insured: 2.5, shock: 5, liquidity: 1, breaker: true },
  };
  const state = { minute: M.MINUTES, playing: false, run: null, base: null };

  const opts = () => ({
    insured: +$('insured').value / 100, shock: +$('shock').value / 100,
    liquidity: +$('liquidity').value, breaker: $('breaker').checked,
  });
  const fmtBn = v => `$${v < 10 ? v.toFixed(1) : Math.round(v)}bn`;
  const fmtPct = p => `${p < 1 ? '−' : '+'}${Math.abs((p - 1) * 100).toFixed(1)}%`;
  let X1 = 744;
  const x = m => X0 + (X1 - X0) * m / M.MINUTES;

  function el(name, attrs, text) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    svg.appendChild(node);
    return node;
  }

  function recompute() {
    const o = opts();
    state.run = M.simulate(o);
    state.base = M.simulate({ ...o, insured: 0, breaker: false });
    $('insured-value').textContent = fmtBn(o.insured * M.CAP_BN).replace('.0bn', 'bn');
    $('insured-share').textContent = `${+(o.insured * 100).toFixed(2)}% of the market`;
    $('shock-value').textContent = o.shock ? `−${(o.shock * 100).toFixed(1).replace('.0', '')}%` : '0%';
    $('liquidity-value').textContent = `${o.liquidity.toFixed(1)}×`;
    document.querySelectorAll('[data-preset]').forEach(b => {
      const p = PRESETS[b.dataset.preset];
      b.classList.toggle('on', p.insured === o.insured * 100 && p.shock === o.shock * 100 && p.liquidity === o.liquidity && p.breaker === o.breaker);
    });
  }

  function verdict() {
    const r = state.run, o = opts();
    const pct = ((1 - r.close) * 100).toFixed(1);
    const v = $('verdict');
    v.className = 'verdict';
    if (!o.insured) {
      v.textContent = `With no insurers the opening gap is just a bad morning. Bargain hunters buy the discount and the Dow closes −${pct}%.`;
    } else if (r.closedEarly) {
      const end = r.path.find(d => d.halted && d.m > 0 && r.path[d.m - 1] && !r.path[d.m - 1].halted && 1 - d.p >= 0.199);
      v.className = 'verdict mid';
      v.textContent = `The −20% breaker shut the market${end ? ` at ${M.clock(end.m)}` : ''}. The selling did not go away: ${fmtBn(r.backlogBn)} of formula orders are still waiting for Tuesday's open.`;
    } else if (1 - r.close > 0.15) {
      v.className = 'verdict bad';
      v.textContent = `Insurers sold ${fmtBn(r.soldBn)} and the Dow closed −${pct}%. Their formulas still wanted ${fmtBn(r.backlogBn)} more: every sale widened every other insurer's gap.`;
    } else if (1 - r.close > 0.07) {
      v.className = 'verdict mid';
      v.textContent = `A slide, not a collapse: −${pct}%. Insurers sold ${fmtBn(r.soldBn)}, and bargain hunters kept up just well enough.`;
    } else {
      v.textContent = `The loop never takes off. Insurers trim ${fmtBn(r.soldBn)} and the Dow closes −${pct}%.`;
    }
    $('r-close').textContent = M.dow(r.close).toFixed(2);
    $('r-pct').textContent = fmtPct(r.close);
    $('r-pct').className = r.close < 1 ? 'dn' : '';
    $('r-backlog').textContent = fmtBn(r.backlogBn);
  }

  function render() {
    const r = state.run, now = Math.min(M.MINUTES, Math.floor(state.minute));
    svg.textContent = '';
    // a fixed-height chart (data-fit) widens its viewBox instead of letterboxing
    const box = svg.getBoundingClientRect();
    const vw = svg.dataset.fit && box.height ? Math.max(760, Math.round(470 * box.width / box.height)) : 760;
    svg.setAttribute('viewBox', `0 0 ${vw} 470`);
    X1 = vw - 24;
    const lowDow = Math.min(M.dow(r.low), M.dow(state.base.low));
    const yMin = Math.min(1300, Math.floor((lowDow - 60) / 100) * 100), yMax = 2300;
    const y = d => PY1 - (PY1 - PY0) * (d - yMin) / (yMax - yMin);
    const maxBn = Math.max(10, r.soldBn + r.backlogBn, r.peakBacklogBn + r.soldBn);
    const by = v => BY1 - (BY1 - BY0) * v / maxBn;

    // halts
    let start = null;
    r.path.forEach((d, i) => {
      if (d.halted && start == null) start = d.m;
      if ((!d.halted || i === r.path.length - 1) && start != null) {
        const end = d.halted ? d.m : d.m - 1;
        if (start <= now) el('rect', { x: x(start - 0.5), y: PY0, width: Math.max(2, x(Math.min(end, now) + 0.5) - x(start - 0.5)), height: BY1 - PY0, fill: '#ffb547', opacity: .1 });
        if (start <= now) el('text', { x: x(start) + 4, y: PY0 + 12, fill: '#ffb547' }, 'HALT');
        start = null;
      }
    });
    // grid + axes
    for (let v = yMin; v <= yMax; v += 100) {
      el('line', { x1: X0, x2: X1, y1: y(v), y2: y(v), class: 'grid' });
      if (v % 200 === 0) el('text', { x: X0 - 8, y: y(v) + 4, 'text-anchor': 'end' }, v);
    }
    for (let h = 10; h <= 16; h++) {
      const m = (h - 9.5) * 60;
      el('line', { x1: x(m), x2: x(m), y1: PY0, y2: BY1, class: 'grid' });
      el('text', { x: x(m), y: BY1 + 16, 'text-anchor': 'middle' }, `${h}:00`);
    }
    // Friday close and the real Monday close
    el('line', { x1: X0, x2: X1, y1: y(M.FRIDAY_CLOSE), y2: y(M.FRIDAY_CLOSE), stroke: '#7fa38c', 'stroke-width': 1 });
    el('text', { x: X0 + 6, y: y(M.FRIDAY_CLOSE) + 15 }, `FRI CLOSE ${M.FRIDAY_CLOSE}`);
    el('line', { x1: X0, x2: X1, y1: y(M.REAL_CLOSE), y2: y(M.REAL_CLOSE), stroke: '#ffb547', 'stroke-width': 1.5, 'stroke-dasharray': '2 4' });
    el('text', { x: X1, y: y(M.REAL_CLOSE) + 15, 'text-anchor': 'end', fill: '#ffb547' }, `REAL CLOSE ${M.REAL_CLOSE}`);
    // counterfactual
    el('polyline', { points: state.base.path.map(d => `${x(d.m).toFixed(1)},${y(M.dow(d.p)).toFixed(1)}`).join(' '), fill: 'none', stroke: '#6b8576', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' });
    // this run
    const seen = r.path.slice(0, now + 1);
    el('polyline', { points: seen.map(d => `${x(d.m).toFixed(1)},${y(M.dow(d.p)).toFixed(1)}`).join(' '), fill: 'none', stroke: '#5dff9a', 'stroke-width': 2.5, 'stroke-linejoin': 'round', id: 'dow-line' });
    const last = seen[seen.length - 1];
    el('circle', { cx: x(last.m), cy: y(M.dow(last.p)), r: 5, fill: '#5dff9a' });
    el('text', { x: Math.min(x(last.m) + 9, X1 - 4), y: y(M.dow(last.p)) - 9, class: 'lab', 'text-anchor': x(last.m) > X1 - 80 ? 'end' : 'start' }, M.dow(last.p).toFixed(0));

    // bottom panel: cumulative sold vs unfilled formula orders
    el('text', { x: X0, y: BY0 - 8, fill: '#d9f5e3' }, 'INSURER ORDERS, $bn');
    el('text', { x: X0 + 170, y: BY0 - 8, fill: '#5dff9a' }, '■ sold so far');
    el('text', { x: X0 + 280, y: BY0 - 8, fill: '#ff5d5d' }, '■ formula wants sold, unfilled');
    el('line', { x1: X0, x2: X1, y1: BY1, y2: BY1, stroke: '#1f3a2a' });
    el('text', { x: X0 - 8, y: by(maxBn) + 4, 'text-anchor': 'end' }, Math.round(maxBn));
    let cum = 0;
    const step = 5;
    for (let m = 0; m <= now; m += step) {
      for (let k = m; k < Math.min(m + step, now + 1); k++) cum += r.path[k].sold;
      const d = r.path[Math.min(m + step - 1, now)];
      const w = (X1 - X0) / M.MINUTES * step - 1;
      el('rect', { x: x(m), y: by(cum), width: w, height: BY1 - by(cum), fill: '#5dff9a', opacity: .85 });
      if (d.backlog > 0.01) el('rect', { x: x(m), y: by(cum + d.backlog), width: w, height: by(cum) - by(cum + d.backlog), fill: '#ff5d5d', opacity: .45 });
    }

    // gauges + tape
    let sold = 0;
    for (const d of seen) sold += d.sold;
    $('g-time').textContent = last.halted ? `${M.clock(last.m)} HALT` : M.clock(last.m);
    $('g-dow').textContent = M.dow(last.p).toFixed(2);
    $('g-chg').textContent = fmtPct(last.p);
    $('g-chg').style.color = last.p < 1 ? 'var(--red)' : 'var(--green)';
    $('g-sold').textContent = fmtBn(sold);
    const diff = M.dow(last.p) - M.FRIDAY_CLOSE;
    $('tape-text').innerHTML = `DJIA ${M.dow(last.p).toFixed(2)} <span class="${diff < 0 ? 'dn' : 'up'}">${diff < 0 ? '▼' : '▲'}${Math.abs(diff).toFixed(2)} ${fmtPct(last.p)}</span> · <b>${M.clock(last.m)}</b> · INSURERS SOLD ${fmtBn(sold)} · UNFILLED ${fmtBn(last.backlog)}${last.halted ? ' · <b>TRADING HALTED</b>' : ''}`;
  }

  function update() { recompute(); verdict(); render(); }

  function advance(dt) {
    if (!state.playing) return;
    state.minute = Math.min(M.MINUTES, state.minute + dt * SPEED);
    if (state.minute >= M.MINUTES) { state.playing = false; $('play').innerHTML = '<span>▶</span> Replay the day'; }
    render();
  }
  function seek(m) { state.minute = Math.max(0, Math.min(M.MINUTES, m)); render(); }
  function play() {
    state.minute = 0; state.playing = true;
    $('play').innerHTML = '<span>■</span> Trading…';
    render();
  }

  let lastT = null;
  function frame(t) {
    if (lastT != null && state.playing && !window.__manualClock) advance(Math.min(0.1, (t - lastT) / 1000));
    lastT = t;
    requestAnimationFrame(frame);
  }

  ['insured', 'shock', 'liquidity'].forEach(id => $(id).addEventListener('input', () => { if (!state.playing) state.minute = M.MINUTES; update(); }));
  $('breaker').addEventListener('change', () => { if (!state.playing) state.minute = M.MINUTES; update(); });
  $('play').addEventListener('click', () => { if (state.playing) { state.playing = false; state.minute = M.MINUTES; $('play').innerHTML = '<span>▶</span> Replay the day'; render(); } else play(); });
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    const p = PRESETS[b.dataset.preset];
    $('insured').value = p.insured; $('shock').value = p.shock; $('liquidity').value = p.liquidity; $('breaker').checked = p.breaker;
    if (!state.playing) state.minute = M.MINUTES;
    update();
  }));

  update();
  requestAnimationFrame(frame);
  window.sellProgram = { state, advance, seek, render, play, update, getStats: () => ({ ...state.run, path: undefined }) };
})();
