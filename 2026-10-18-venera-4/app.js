(function () {
  'use strict';
  const M = window.VeneraModel;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const W = 760, H = 560, L = 72, R = 736, T = 18, B = 516;
  const X0 = Math.log10(.25), X1 = Math.log10(250), YMAX = 80;
  const px = p => L + (Math.log10(p) - X0) / (X1 - X0) * (R - L);
  const py = z => B - Math.max(-2, Math.min(YMAX, z)) / YMAX * (B - T);
  const state = { h: 0, alias: false, minute: 0, playing: false, lost: false };

  function el(name, attrs, parent, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    parent.appendChild(e);
    return e;
  }
  function curve(h, p0, p1, n = 80) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const p = Math.exp(Math.log(p0) + (Math.log(p1) - Math.log(p0)) * i / n);
      pts.push(px(p).toFixed(1) + ',' + py(h + M.rel(p)).toFixed(1));
    }
    return pts.join(' ');
  }

  function drawChart(a) {
    const svg = $('chart');
    svg.textContent = '';
    for (const z of [0, 10, 20, 30, 40, 50, 60, 70, 80]) {
      el('line', { x1: L, x2: R, y1: py(z), y2: py(z), class: 'gridline' }, svg);
      el('text', { x: L - 10, y: py(z) + 4, 'text-anchor': 'end' }, svg, z + ' km');
    }
    for (const p of [.5, 1, 3, 10, 30, 100]) {
      el('line', { x1: px(p), x2: px(p), y1: T, y2: B, class: 'gridline' }, svg);
      el('text', { x: px(p), y: B + 18, 'text-anchor': 'middle' }, svg, p + ' atm');
    }
    el('text', { x: (L + R) / 2, y: B + 40, 'text-anchor': 'middle' }, svg, 'PRESSURE (log scale)  →');
    // ground
    const g = el('g', {}, svg);
    el('rect', { x: L, y: B, width: R - L, height: 22, fill: '#3b2416' }, g);
    el('line', { x1: L, x2: R, y1: B, y2: B, stroke: '#e35d4a', 'stroke-width': 2 }, g);
    el('text', { x: R - 4, y: B + 15, 'text-anchor': 'end', class: 'lab' }, g, 'GROUND');
    // extension above and below the measured run
    el('polyline', { points: curve(a.h, .25, M.START.p), fill: 'none', stroke: '#f3e3c6', 'stroke-dasharray': '5 5', 'stroke-width': 2, opacity: .6 }, svg);
    if (a.h > .01) el('polyline', { points: curve(a.h, M.END.p, Math.max(M.END.p * 1.001, a.ground.p)), fill: 'none', stroke: '#f3e3c6', 'stroke-dasharray': '5 5', 'stroke-width': 2, opacity: .85 }, svg);
    el('polyline', { points: curve(a.h, M.START.p, M.END.p), fill: 'none', stroke: '#f0a23c', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
    // last reading marker
    el('circle', { cx: px(M.END.p), cy: py(a.h), r: 6, fill: '#1b100b', stroke: '#e35d4a', 'stroke-width': 3 }, svg);
    el('text', { x: px(M.END.p) + 12, y: py(a.h) - 8, class: 'lab' }, svg, 'SIGNAL LOST · 22 atm');
    // pin: altimeter
    pin(svg, a, M.START.p, a.altimeter, a.gapAltimeter, 'ALTIMETER ' + Math.round(a.altimeter) + ' km', -1);
    pin(svg, a, M.MARINER.p, M.MARINER.km, a.gapMariner, 'MARINER 5 · ' + M.MARINER.km + ' km', 1);
    // replay dot
    if (state.minute > 0 || state.playing || state.lost) {
      const p = M.pressureAtMinute(state.minute);
      el('circle', { cx: px(p), cy: py(a.h + M.rel(p)), r: 9, fill: '#e8d56a', stroke: '#1b100b', 'stroke-width': 2 }, svg);
    }
  }
  function pin(svg, a, p, km, gap, label, side) {
    const x = px(p), yPin = py(km), yCurve = py(a.h + M.rel(p));
    const ok = Math.abs(gap) <= 3, color = ok ? '#7fc8c0' : '#e35d4a';
    if (Math.abs(yPin - yCurve) > 2) el('line', { x1: x, x2: x, y1: yPin, y2: yCurve, stroke: color, 'stroke-width': 2, 'stroke-dasharray': '3 3' }, svg);
    el('line', { x1: x - 16, x2: x + 16, y1: yPin, y2: yPin, stroke: '#7fc8c0', 'stroke-width': 3 }, svg);
    el('text', { x: x + side * 22, y: yPin + 4, 'text-anchor': side < 0 ? 'end' : 'start', class: 'lab' }, svg, label);
    if (!ok) el('text', { x: x + side * 22, y: yPin + 20, 'text-anchor': side < 0 ? 'end' : 'start', fill: '#e35d4a', style: 'fill:#e35d4a' }, svg, Math.abs(Math.round(gap)) + ' km off');
  }

  function gapText(gap) {
    if (Math.abs(gap) <= 3) return 'fits (' + (gap >= 0 ? '+' : '−') + Math.abs(gap).toFixed(1) + ' km)';
    return Math.abs(gap).toFixed(0) + ' km ' + (gap > 0 ? 'too high' : 'too low');
  }
  function render() {
    const a = M.analyse(state.h, state.alias);
    drawChart(a);
    $('h-value').textContent = state.h.toFixed(state.h % 1 ? 1 : 0);
    $('c-alt').textContent = Math.round(a.altimeter) + ' km at 0.75 atm';
    $('c-mar').textContent = M.MARINER.km + ' km at 0.72 atm';
    for (const [id, gap] of [['c-alt-gap', a.gapAltimeter], ['c-mar-gap', a.gapMariner]]) {
      $(id).textContent = gapText(gap);
      $(id).className = Math.abs(gap) <= 3 ? 'ok' : 'bad';
    }
    $('r-p').textContent = a.ground.p < 100 ? a.ground.p.toFixed(0) : Math.round(a.ground.p);
    $('r-t').textContent = Math.round(a.ground.t - 273.15);
    const v = $('verdict');
    v.className = 'verdict' + (a.verdict === 'agree' ? ' good' : '');
    const fate = a.landed ? 'The capsule is on the ground at 22 atm.' : 'The capsule is ' + a.h.toFixed(0) + ' km up; the ground below would be ~' + Math.round(a.ground.p) + ' atm.';
    v.textContent = (a.verdict === 'agree' ? 'Both clues fit. ' : a.verdict === 'split' ? 'Neither clue lines up yet. ' : a.verdict === 'mariner' ? 'Mariner 5 fits, the altimeter does not. ' : 'The altimeter fits, Mariner 5 does not. ') + fate;
    $('observation').textContent = observation(a);
    document.querySelectorAll('.presets button').forEach(b => b.classList.toggle('on', +b.dataset.h === state.h && (b.dataset.alias === '1') === state.alias));
    updateGauges(a);
  }
  function observation(a) {
    if (a.verdict === 'agree') return 'Around ' + a.h.toFixed(0) + ' km above the surface the pressure gauge pinned at 22 atm, the radar was reading one fold of its ambiguity, and Mariner 5’s numbers line up.';
    if (a.landed) return 'With the ground at the last reading, the pressure gauge is happy. But Mariner 5’s occultation puts 0.72 atm roughly 27 km higher than Venera 4’s own gauges can reach.';
    return 'The gauges alone fix the shape of the curve. Only the height of the last reading changes: slide it and watch which clue breaks.';
  }
  function updateGauges(a) {
    const p = M.pressureAtMinute(state.minute);
    $('g-time').textContent = Math.round(state.minute) + ' min';
    $('g-p').textContent = p.toFixed(p < 10 ? 2 : 1) + ' atm';
    $('g-t').textContent = Math.round(M.temp(p) - 273.15) + ' °C';
    $('g-alt').textContent = (a.h + M.rel(p)).toFixed(0) + ' km';
    $('g-time').classList.toggle('lost', state.lost);
    if (state.lost) $('g-time').textContent = 'SIGNAL LOST';
  }

  function setH(h) { state.h = Math.max(0, Math.min(40, h)); $('h').value = state.h; render(); }
  function setAlias(on) { state.alias = !!on; $('alias').checked = state.alias; render(); }
  function seek(minute) {
    state.minute = Math.max(0, Math.min(M.DESCENT_MIN, minute));
    state.lost = state.minute >= M.DESCENT_MIN;
    if (state.lost) { state.playing = false; $('play').innerHTML = '<span>▶</span> Replay descent'; }
    render();
  }
  function advance(dtSeconds) { seek(state.minute + dtSeconds * M.DESCENT_MIN / 12); }
  let last = 0;
  function tick(now) {
    if (!state.playing) return;
    advance((now - last) / 1000); last = now;
    if (state.playing) requestAnimationFrame(tick);
  }
  function toggle() {
    if (state.playing) { state.playing = false; $('play').innerHTML = '<span>▶</span> Resume'; return; }
    if (state.lost || state.minute >= M.DESCENT_MIN) { state.minute = 0; state.lost = false; }
    state.playing = true; $('play').innerHTML = '<span>❚❚</span> Pause'; last = performance.now();
    requestAnimationFrame(tick);
  }

  $('h').addEventListener('input', e => setH(+e.target.value));
  $('alias').addEventListener('change', e => setAlias(e.target.checked));
  $('play').addEventListener('click', toggle);
  document.querySelectorAll('.presets button').forEach(b => b.addEventListener('click', () => {
    state.alias = b.dataset.alias === '1'; $('alias').checked = state.alias; setH(+b.dataset.h);
  }));
  render();
  window.venera = { state, setH, setAlias, seek, advance, render, getStats: () => M.analyse(state.h, state.alias) };
})();
