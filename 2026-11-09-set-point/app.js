(function () {
  'use strict';
  const S = window.SetPoint;
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const board = $('board');
  const STEP_MS = 750;
  // manual: the video recorder steps the cascade itself via state.next().
  const state = { setPoint: 375, surge: 100, timer: null, result: null, manual: false, next: null };

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // ----- static geometry -----
  const relayIdx = S.LINES.map((l, k) => (l.relay ? k : -1)).filter(k => k >= 0);
  function geometry(k) {
    const l = S.LINES[k], a = S.BUSES[l.i], b = S.BUSES[l.j];
    let off = 0;
    if (l.relay) off = (relayIdx.indexOf(k) - 2) * 11;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const nx = -dy / len * off, ny = dx / len * off;
    return { x1: a.x + nx, y1: a.y + ny, x2: b.x + nx, y2: b.y + ny };
  }

  el('ellipse', { class: 'lake', cx: 400, cy: 190, rx: 165, ry: 48, transform: 'rotate(8 400 190)' }, board);
  el('text', { class: 'lake-name', x: 400, y: 195, 'text-anchor': 'middle' }, board).textContent = 'LAKE ONTARIO';
  [['ONTARIO', 40, 40], ['NEW YORK', 470, 430], ['NEW ENGLAND', 830, 230]].forEach(([t, x, y]) => {
    el('text', { class: 'country', x, y }, board).textContent = t;
  });

  const lineEls = S.LINES.map((l, k) => {
    const g = geometry(k);
    const d = l.bend ? `M ${g.x1} ${g.y1} Q ${l.bend[0]} ${l.bend[1]} ${g.x2} ${g.y2}` : `M ${g.x1} ${g.y1} L ${g.x2} ${g.y2}`;
    const path = el('path', { class: 'ln ok', d }, board);
    const dash = el('path', { class: 'flowdash', d }, board);
    let lx, ly;
    if (l.relay) { const r = relayIdx.indexOf(k); lx = 228; ly = 146 + r * 19; }
    else if (l.bend) {
      lx = (g.x1 + g.x2) / 4 + l.bend[0] / 2; ly = (g.y1 + g.y2) / 4 + l.bend[1] / 2 + 20;
    }
    else {
      // label sits beside the line's midpoint, on its upper (or right) side
      const dx = g.x2 - g.x1, dy = g.y2 - g.y1, len = Math.hypot(dx, dy);
      let nx = -dy / len, ny = dx / len;
      if (ny > 0 || (Math.abs(ny) < 0.2 && nx < 0)) { nx = -nx; ny = -ny; }
      lx = (g.x1 + g.x2) / 2 + nx * 16; ly = (g.y1 + g.y2) / 2 + ny * 16 + 4;
    }
    const label = el('text', { class: 'mw', x: lx, y: ly, 'text-anchor': l.relay ? 'start' : 'middle' }, board);
    return { path, dash, label };
  });
  const relayTag = el('text', { class: 'relay-tag', x: 228, y: 124 }, board);

  const LABEL_AT = {
    tor: ['start', 18, -2], beck: ['end', -18, 0], nia: ['end', -18, 4], roc: ['middle', 0, 34],
    syr: ['middle', 0, -34], alb: ['middle', 0, -36], nyc: ['end', -26, 4], bos: ['middle', 0, 44],
  };
  const busEls = S.BUSES.map(b => {
    const g = el('g', { class: 'bus', transform: `translate(${b.x} ${b.y})` }, board);
    el('circle', { class: 'halo', r: 10 + Math.sqrt(b.pop) * 5.5 }, g);
    el('circle', { class: 'core', r: 9 }, g);
    const [anchor, tx, ty] = LABEL_AT[b.id];
    el('text', { x: tx, y: ty, 'text-anchor': anchor }, g).textContent = b.short;
    el('text', { class: 'sub', x: tx, y: ty + 15, 'text-anchor': anchor }, g).textContent = `${b.pop.toFixed(1)} M people`;
    return g;
  });

  // ----- drawing -----
  function draw(frame) {
    S.LINES.forEach((l, k) => {
      const e = lineEls[k], f = frame.flows[k], up = frame.up[k];
      const lim = S.limitOf(l, state.setPoint), ratio = Math.abs(f) / lim;
      const dead = frame.dark[l.i] && frame.dark[l.j];
      const cls = !up ? 'off' : dead ? 'dead' : ratio > 1 ? 'over' : ratio > 0.8 ? 'warm' : 'ok';
      e.path.setAttribute('class', `ln ${cls}`);
      const moving = up && !dead && Math.abs(f) > 5;
      e.dash.style.display = moving ? '' : 'none';
      e.dash.setAttribute('class', `flowdash${f < 0 ? ' rev' : ''}`);
      e.dash.style.animationDuration = `${Math.max(0.35, 2.2 - ratio * 1.6)}s`;
      const tag = l.relay ? `L${relayIdx.indexOf(k) + 1} ` : '';
      e.label.textContent = !up ? `${tag}OPEN` : dead ? `${tag}DEAD` : `${tag}${Math.round(Math.abs(f))} MW`;
      e.label.setAttribute('class', `mw ${!up || dead ? 'off' : ratio > 1 ? 'over' : ''}`);
    });
    relayTag.textContent = `BECK–TORONTO · RELAYS AT ${state.setPoint} MW`;
    S.BUSES.forEach((b, i) => busEls[i].setAttribute('class', `bus${frame.dark[i] ? ' dark' : ''}`));
    const darkPop = S.BUSES.reduce((a, b, i) => a + (frame.dark[i] ? b.pop : 0), 0);
    $('r-dark').textContent = `${darkPop.toFixed(1)} M`;
    $('r-trips').textContent = frame.up.filter(x => !x).length;
  }

  function steadyFrame() {
    const up = S.LINES.map(() => true), dark = S.BUSES.map(() => false);
    return { t: -1, up, dark, flows: S.flowsFor(up, dark, S.baseLoads(0)), events: [] };
  }

  function describe(e) {
    if (e.kind === 'trip') {
      const l = S.LINES[e.line];
      return { cls: 'trip', text: `${l.name} trips at ${e.flow} MW (limit ${e.limit})` };
    }
    const names = e.buses.map(id => S.BUSES.find(b => b.id === id).name).join(', ');
    return { cls: 'dark', text: `${names} — short ${e.deficit} MW, frequency collapses. ${e.pop.toFixed(1)} M dark` };
  }

  function addLog(time, cls, text) {
    const log = $('log');
    if (log.querySelector('.quiet')) log.innerHTML = '';
    const li = document.createElement('li');
    li.innerHTML = `<time></time><span class="${cls}"></span>`;
    li.firstChild.textContent = time;
    li.lastChild.textContent = text;
    log.appendChild(li);
  }

  function updateReadouts() {
    const peak = S.rideThrough(state.surge), margin = peak - state.setPoint;
    $('r-peak').textContent = `${Math.round(peak)} MW`;
    const m = $('r-margin');
    m.textContent = margin > 0 ? `${margin.toFixed(1)} MW over` : `${(-margin).toFixed(1)} MW to spare`;
    m.className = margin > 0 ? 'bad' : 'good';
  }

  function stop() { if (state.timer) clearInterval(state.timer); state.timer = null; $('run').disabled = false; }

  function reset() {
    stop();
    state.result = null;
    draw(steadyFrame());
    $('clock').textContent = '5:16:10.0 PM';
    $('board-sub').textContent = '/ STEADY STATE, 5:16:10 PM';
    $('log').innerHTML = '<li class="quiet">Press Run to apply the swing.</li>';
    updateReadouts();
  }

  function run(instant) {
    reset();
    const r = state.result = S.cascade(state.setPoint, state.surge);
    $('run').disabled = !instant;
    $('log').innerHTML = '';
    let i = 0;
    const show = () => {
      const f = r.frames[i];
      draw(f);
      $('clock').textContent = S.clock(f.t);
      if (i === 0) addLog(S.clock(0), '', `Toronto load swings +${state.surge} MW`);
      f.events.forEach(e => { const d = describe(e); addLog(S.clock(e.t), d.cls, d.text); });
      i += 1;
      if (i >= r.frames.length) {
        stop();
        if (!r.events.length) {
          addLog(S.clock(0.4), 'held', `Line 1 peaks at ${Math.round(S.rideThrough(state.surge))} MW. The relays hold.`);
          $('board-sub').textContent = '/ HELD';
        } else {
          $('board-sub').textContent = r.darkPop > 0 ? `/ ${r.darkPop.toFixed(1)} M PEOPLE IN THE DARK` : '/ LINES OUT, LIGHTS ON';
        }
        return false;
      }
      $('board-sub').textContent = '/ CASCADE IN PROGRESS';
      return true;
    };
    if (instant) { while (show()); return; }
    if (state.manual) { state.next = () => { const more = show(); if (!more) state.next = null; return more; }; state.next(); return; }
    if (show()) state.timer = setInterval(() => { if (!show()) stop(); }, STEP_MS);
  }

  function setSetPoint(v) {
    state.setPoint = v;
    $('setpoint').value = v;
    $('setpoint-out').textContent = v;
    document.querySelectorAll('[data-set]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.set) === v)));
    reset();
  }

  $('setpoint').addEventListener('input', e => setSetPoint(Number(e.target.value)));
  $('surge').addEventListener('input', e => { state.surge = Number(e.target.value); $('surge-out').textContent = state.surge; reset(); });
  document.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => setSetPoint(Number(b.dataset.set))));
  $('run').addEventListener('click', () => run(false));
  $('reset').addEventListener('click', reset);
  $('r-total').textContent = S.TOTAL_POP.toFixed(1);

  window.SetPointApp = { run, reset, state };
  reset();
})();
