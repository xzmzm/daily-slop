(() => {
  'use strict';
  const M = window.SpacingModel, $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const state = {positions: M.preset('both'), preset: 'both', selected: 6, frame: 6, playing: !reduced.matches, elapsed: 0, ghosts: true};
  const names = {steady: 'STEADY', launch: 'GATHER SPEED', arrive: 'GLIDE IN', both: 'EASE BOTH', custom: 'YOUR OWN SPACING'};
  const notes = {steady: 'Every step is the same size.', launch: 'Start gently. Leave in a hurry.', arrive: 'A quick start. A soft arrival.', both: 'A gentle start. A gentle stop.', custom: 'A little personality, drawn by you.'};
  let lastTime = null, manualClock = false, dragIndex = null;
  function svg(tag, attrs, parent) {
    const e = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => e.setAttribute(key, value));
    if (parent) parent.append(e);
    return e;
  }
  const knots = [], frameCards = [], frameBalls = [], ghosts = [], referenceGhosts = [], gridColumns = [], gridLabels = [], gridRows = [];
  let chartLeft = 55, chartSpan = 800;
  const chartX = i => chartLeft + i / 12 * chartSpan;
  const stageX = progress => 70 + progress * ($('stage').viewBox.baseVal.width - 140);
  for (let i = 0; i < M.COUNT; i++) {
    const x = 55 + i / 12 * 800;
    gridColumns.push(svg('path', {d: `M${x} 25V185`, stroke: '#dedbd0', 'stroke-width': .8}, $('chart-grid')));
    const gridLabel = svg('text', {x, y: 204, 'text-anchor': 'middle', class: 'chart-label'}, $('chart-grid'));
    gridLabel.textContent = String(i + 1).padStart(2, '0'); gridLabels.push(gridLabel);
    // A larger transparent target sits behind each visible knot.
    const hit = svg('circle', {cx: x, cy: 100, r: 15, class: 'knot-hit', 'data-index': i}, $('knots'));
    const knot = svg('circle', {cx: x, cy: 100, r: 5.5, class: 'knot', 'data-index': i, tabindex: 0, role: 'slider', 'aria-label': `Drawing ${i + 1} position`, 'aria-orientation': 'vertical', 'aria-disabled': i === 0 || i === 12}, $('knots'));
    knots.push({knot, hit});
    ghosts.push(svg('circle', {cx: 0, cy: 90, r: 9, fill: 'none', stroke: '#ed5836', 'stroke-width': 1.2, opacity: .35}, $('ghosts')));
    referenceGhosts.push(svg('circle', {cx: 70 + i / 12 * 760, cy: 220, r: 8, fill: 'none', stroke: '#9293ce', 'stroke-width': 1.2, opacity: .38}, $('reference-ghosts')));
    const card = document.createElement('button');
    card.className = 'frame-card';
    card.setAttribute('aria-label', `Select drawing ${i + 1}${i === 0 ? ', start A' : i === 12 ? ', finish B' : ''}`);
    card.innerHTML = `<span class="frame-number">${String(i + 1).padStart(2, '0')}${i === 0 ? ' / A' : i === 12 ? ' / B' : ''}</span><svg viewBox="0 0 80 24" aria-hidden="true"><path d="M7 13H73" stroke="#d3d0c5"/><circle cx="40" cy="13" r="5" fill="#ed5836"/></svg>`;
    card.addEventListener('click', () => select(i));
    $('frames').append(card); frameCards.push(card); frameBalls.push(card.querySelector('circle'));
    knot.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); select(i);
      if (i === 0 || i === 12) return;
      const delta = event.shiftKey ? .05 : .01;
      const value = event.key === 'Home' ? state.positions[i - 1] : event.key === 'End' ? state.positions[i + 1] : state.positions[i] + (['ArrowUp', 'ArrowRight'].includes(event.key) ? delta : -delta);
      edit(i, value);
    });
  }
  for (const progress of [0, .25, .5, .75, 1]) gridRows.push(svg('path', {d: `M55 ${185 - progress * 160}H855`, stroke: '#dedbd0', 'stroke-width': .8}, $('chart-grid')));
  function layoutChart() {
    const compact = window.innerWidth <= 760;
    const width = compact ? 480 : Number($('chart').dataset.width) || 900;
    chartLeft = compact ? 35 : 55; chartSpan = width - chartLeft - (compact ? 25 : 45);
    $('chart').setAttribute('viewBox', `0 0 ${width} 234`);
    gridColumns.forEach((column, i) => column.setAttribute('d', `M${chartX(i)} 25V185`));
    gridLabels.forEach((label, i) => label.setAttribute('x', chartX(i)));
    gridRows.forEach((row, i) => row.setAttribute('d', `M${chartX(0)} ${185 - i * 40}H${chartX(12)}`));
    $('reference-curve').setAttribute('d', `M${chartX(0)} 185L${chartX(12)} 25`);
    $('chart-start').setAttribute('x', chartX(0)); $('chart-time').setAttribute('x', chartX(6)); $('chart-end').setAttribute('x', chartX(12));
    render();
  }

  function renderMotion() {
    const f = state.frame;
    $('your-ball').setAttribute('transform', `translate(${stageX(state.positions[f])} 90)`);
    $('steady-ball').setAttribute('transform', `translate(${stageX(f / 12)} 220)`);
    $('current-frame').textContent = String(f + 1).padStart(2, '0');
    $('playhead').setAttribute('d', `M${chartX(f)} 18V190`);
    frameCards.forEach((card, i) => card.classList.toggle('is-current', f === i));
  }
  function render() {
    $('take-name').textContent = names[state.preset];
    $('take-note').textContent = notes[state.preset];
    document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', b.dataset.preset === state.preset));
    $('play-text').textContent = state.playing ? 'Pause' : 'Play';
    $('play-icon').textContent = state.playing ? 'Ⅱ' : '▶';
    $('play').setAttribute('aria-label', state.playing ? 'Pause animation' : 'Play animation');
    $('ghosts').style.display = $('reference-ghosts').style.display = state.ghosts ? '' : 'none';
    const stageEnd = stageX(1);
    $('stage').querySelector('rect').setAttribute('width', $('stage').viewBox.baseVal.width);
    $('lanes').setAttribute('d', `M70 98H${stageEnd}M70 228H${stageEnd}`);
    $('ends').setAttribute('d', `M70 78V118M${stageEnd} 78V118M70 208V248M${stageEnd} 208V248`);
    $('endpoint-b').setAttribute('x', stageEnd);
    const path = state.positions.map((v, i) => `${i ? 'L' : 'M'}${chartX(i)} ${185 - v * 160}`).join('');
    $('curve').setAttribute('d', path);
    $('curve-area').setAttribute('d', `${path}L${chartX(12)} 185H${chartX(0)}Z`);
    state.positions.forEach((v, i) => {
      const {knot, hit} = knots[i];
      knot.setAttribute('cx', chartX(i)); hit.setAttribute('cx', chartX(i));
      knot.setAttribute('cy', 185 - v * 160); hit.setAttribute('cy', 185 - v * 160);
      knot.classList.toggle('selected', state.selected === i); knot.setAttribute('r', state.selected === i ? 7.5 : 5.5);
      knot.setAttribute('aria-valuemin', (100 * (i ? state.positions[i - 1] : 0)).toFixed(1));
      knot.setAttribute('aria-valuemax', (100 * (i < 12 ? state.positions[i + 1] : 1)).toFixed(1));
      knot.setAttribute('aria-valuenow', (v * 100).toFixed(1)); knot.setAttribute('aria-valuetext', `${(v * 100).toFixed(1)} percent of the trip`);
      ghosts[i].setAttribute('cx', stageX(v)); referenceGhosts[i].setAttribute('cx', stageX(i / 12));
      frameCards[i].setAttribute('aria-pressed', state.selected === i);
      frameBalls[i].setAttribute('cx', 7 + v * 66);
    });
    const selected = state.selected, endpoint = selected === 0 || selected === 12;
    $('selected-number').textContent = String(selected + 1).padStart(2, '0');
    $('position-value').textContent = `${(state.positions[selected] * 100).toFixed(1).replace('.0', '')}%`;
    $('position').value = state.positions[selected] * 100;
    $('position').disabled = endpoint;
    $('position').setAttribute('aria-label', `Drawing ${selected + 1} position`);
    $('edit-hint').textContent = endpoint ? 'A and B stay put. Choose a drawing in between.' : `This step travels ${M.stepPercent(state.positions, selected).toFixed(1)}% of the trip. Pick a drawing below, or pull a chart dot.`;
    renderMotion();
  }
  function select(i) {
    state.selected = state.frame = M.clamp(i, 0, 12); state.playing = false;
    state.elapsed = M.START_HOLD_MS + state.frame / 12 * M.TRAVEL_MS; lastTime = null; render();
  }
  function edit(i, value) {
    if (i <= 0 || i >= 12) return;
    state.positions = M.move(state.positions, i, value); state.preset = 'custom'; render();
  }
  function choose(name) {
    state.positions = M.preset(name); state.preset = name; state.elapsed = 0; lastTime = null;
    if (state.playing) state.frame = 0;
    render();
  }
  document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => choose(button.dataset.preset)));
  $('position').addEventListener('input', event => {
    const value = Number(event.target.value) / 100;
    select(state.selected); edit(state.selected, value);
  });
  $('play').addEventListener('click', () => {
    state.playing = !state.playing;
    if (state.playing) {state.elapsed = 0; state.frame = 0;}
    lastTime = null; render();
  });
  $('previous').addEventListener('click', () => select(state.frame - 1));
  $('next').addEventListener('click', () => select(state.frame + 1));
  $('show-ghosts').addEventListener('change', event => {state.ghosts = event.target.checked; render();});
  $('chart').addEventListener('pointerdown', event => {
    const target = event.target.closest('[data-index]');
    if (!target) return;
    const i = Number(target.dataset.index); select(i);
    if (i === 0 || i === 12) return;
    event.preventDefault(); dragIndex = i; $('chart').setPointerCapture(event.pointerId);
    knots[i].knot.focus({preventScroll: true});
  });
  $('chart').addEventListener('pointermove', event => {
    if (dragIndex === null) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform($('chart').getScreenCTM().inverse());
    edit(dragIndex, (185 - point.y) / 160);
  });
  const endDrag = () => {dragIndex = null;};
  $('chart').addEventListener('pointerup', endDrag);
  $('chart').addEventListener('pointercancel', endDrag);
  $('chart').addEventListener('lostpointercapture', endDrag);
  document.addEventListener('visibilitychange', () => {lastTime = null;});
  reduced.addEventListener('change', event => {if (event.matches) {state.playing = false; render();}});
  function tick(now) {
    if (!manualClock && state.playing && !document.hidden) {
      if (lastTime !== null) state.elapsed += Math.min(now - lastTime, 100);
      const frame = M.frameAt(state.elapsed);
      if (frame !== state.frame) {state.frame = frame; renderMotion();}
    }
    lastTime = now; requestAnimationFrame(tick);
  }
  // Deterministic recording clock; animation still uses the same model and UI state.
  window.inbetween = {state, select, render, setRecordingClock(enabled) {manualClock = enabled; lastTime = null;}, advance(ms) {if (state.playing) {state.elapsed += ms; state.frame = M.frameAt(state.elapsed); renderMotion();}}};
  window.addEventListener('resize', layoutChart);
  layoutChart(); requestAnimationFrame(tick);
})();
