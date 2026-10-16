(function () {
  'use strict';
  const M = BranchModel;
  const $ = id => document.getElementById(id);
  const state = { k: 1, initial: 1, seed: 20261049, batch: 1, selected: 0, generation: 12, playing: false, live: true };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let data, chain, elapsed = 0, previousTime = 0, fontScale = 1;
  const gold = '#ebc17c', mint = '#a2d7bd';
  function rebuild() {
    data = M.ensemble(state.k, state.initial, state.seed);
    chain = M.simulate(state.k, state.initial, M.trialSeed(state.seed, state.selected), true);
    elapsed = 0;
    render();
  }
  function canvas(id) {
    const element = $(id), rect = element.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * scale), h = Math.round(rect.height * scale);
    if (element.width !== w || element.height !== h) { element.width = w; element.height = h; }
    const ctx = element.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    return [ctx, rect.width, rect.height];
  }
  function text(ctx, label, x, y, color = '#93aa9c', align = 'center', size = 9) {
    ctx.font = `${size * fontScale}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(label, x, y);
  }
  function compact(n) { return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('en-US'); }
  function drawTree() {
    const [ctx, width, height] = canvas('tree');
    const last = state.generation, first = Math.max(0, last - 12);
    const pad = width < 500 ? 22 : 35;
    const maxDots = 40, visibleColumns = 13;
    const dx = (width - pad * 2) / (visibleColumns - 1);
    let sampled = false;
    function y(index, count) {
      const range = Math.min(height - 75, Math.max(16, count * 9));
      return 35 + (height - 75) / 2 + ((index + .5) / count - .5) * range;
    }
    function indices(count) {
      if (count <= maxDots) return Array.from({ length: count }, (_, i) => i);
      sampled = true;
      return Array.from({ length: maxDots }, (_, i) => Math.floor((i + .5) * count / maxDots));
    }
    for (let g = first; g <= first + 12; g++) {
      const x = pad + (g - first) * dx;
      ctx.strokeStyle = '#234039'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 23); ctx.lineTo(x, height - 41); ctx.stroke();
      text(ctx, String(g).padStart(2, '0'), x, 16, g <= last ? '#91ad9c' : '#47665a', 'center', 8);
      if (g > last || g > M.GENERATIONS) continue;
      const count = chain.counts[g];
      if (g > first && count) {
        const parentCount = chain.counts[g - 1];
        ctx.strokeStyle = '#9c9d62'; ctx.globalAlpha = .43; ctx.lineWidth = .85;
        for (const i of indices(count)) {
          const px = x - dx, py = y(chain.layers[g][i], parentCount), cy = y(i, count);
          ctx.beginPath(); ctx.moveTo(px, py); ctx.bezierCurveTo(px + dx * .47, py, x - dx * .47, cy, x, cy); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      const parents = g < last ? new Set(chain.layers[g + 1]) : null;
      for (const i of indices(count)) {
        const cy = y(i, count), lost = parents && !parents.has(i);
        ctx.beginPath(); ctx.arc(x, cy, width < 500 ? 2.2 : 2.8, 0, Math.PI * 2);
        ctx.fillStyle = lost ? '#ad7957' : gold; ctx.fill();
        if (lost) {
          ctx.strokeStyle = '#ad7957'; ctx.lineWidth = .8;
          ctx.beginPath(); ctx.moveTo(x - 2, cy - 2); ctx.lineTo(x + 2, cy + 2); ctx.stroke();
        }
      }
      text(ctx, compact(count), x, height - 27, count ? gold : '#648573', 'center', 8);
    }
    if (chain.counts[last] === 0) {
      const died = chain.counts.findIndex(n => n === 0);
      text(ctx, `ENDED AT GENERATION ${died}`, width * .64, height * .47, '#b99272', 'center', width < 500 ? 9 : 11);
      text(ctx, 'No new source. No restart.', width * .64, height * .47 + 22, '#7d9b87', 'center', width < 500 ? 8 : 10);
    }
    $('sampling').textContent = sampled ? 'UP TO 40 DOTS / GENERATION · COUNTS BELOW ARE EXACT' : 'EACH DOT = ONE NEUTRON · OCHRE ENDS = LOST';
    $('tree').setAttribute('aria-label', `Chain ${state.selected + 1}, generation ${last}: ${chain.counts[last]} neutrons. ${sampled ? 'Dots sampled; full counts shown.' : 'Every neutron shown.'}`);
  }
  function drawChart() {
    const [ctx, width, height] = canvas('chart');
    const left = fontScale > 1 ? 58 : 40, right = width - 22, top = 12, bottom = height - 25;
    const g = state.generation;
    const max = Math.max(2, ...data.runs.map(run => Math.max(...run.slice(0, g + 1))), ...data.expected.slice(0, g + 1));
    const ceiling = Math.ceil(max / (max > 100 ? 100 : max > 20 ? 10 : 2)) * (max > 100 ? 100 : max > 20 ? 10 : 2);
    const x = n => left + n / M.GENERATIONS * (right - left);
    const y = n => bottom - n / ceiling * (bottom - top);
    [0, .5, 1].forEach(fraction => {
      const value = ceiling * fraction;
      ctx.strokeStyle = '#2d4940'; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.moveTo(left, y(value)); ctx.lineTo(right, y(value)); ctx.stroke();
      text(ctx, compact(value), left - 8, y(value) + 3, '#819e8c', 'right', 8);
    });
    [0, 6, 12, 18, 24].forEach(value => text(ctx, value, x(value), bottom + 16, '#819e8c', 'center', 8));
    function line(values, color, thickness, dash = []) {
      ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.setLineDash(dash); ctx.beginPath();
      for (let i = 0; i <= g; i++) { if (i === 0) ctx.moveTo(x(i), y(values[i])); else ctx.lineTo(x(i), y(values[i])); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    data.runs.forEach(run => line(run, '#a2d7bd22', .7));
    line(data.expected, '#e1e4d3aa', 1.3, [5, 4]);
    line(data.mean, mint, 1.8);
    line(chain.counts, gold, 2);
    ctx.strokeStyle = '#90a99b66'; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x(g), top); ctx.lineTo(x(g), bottom); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x(g), y(chain.counts[g]), 3, 0, Math.PI * 2); ctx.fillStyle = gold; ctx.fill();
    $('chart').setAttribute('aria-label', `At generation ${g}, expected population ${data.expected[g].toFixed(2)}, average of 64 trials ${data.mean[g].toFixed(2)}. ${data.surviving[g]} chains still going. Vertical scale 0 to ${ceiling}.`);
  }
  function render() {
    fontScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--canvas-font-scale')) || 1;
    const g = state.generation;
    $('k-value').textContent = state.k.toFixed(2);
    $('k').value = state.k;
    $('regime').textContent = state.k < 1 ? 'SUBCRITICAL · FADES ON AVERAGE' : state.k > 1 ? 'SUPERCRITICAL · GROWS ON AVERAGE' : 'CRITICAL · STEADY ON AVERAGE';
    document.querySelectorAll('[data-k]').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.k) === state.k));
    document.querySelectorAll('[data-source]').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.source) === state.initial));
    $('generation').value = g;
    $('generation-value').textContent = `${String(g).padStart(2, '0')} / 24`;
    $('chain-number').textContent = `CHAIN ${String(state.selected + 1).padStart(2, '0')}`;
    $('population').textContent = compact(chain.counts[g]);
    $('surviving').textContent = data.surviving[g];
    $('batch').textContent = String(state.batch).padStart(2, '0');
    $('play').innerHTML = state.playing ? '<span>Ⅱ</span> Pause' : '<span>▶</span> Replay';
    $('play').setAttribute('aria-label', state.playing ? 'Pause generations' : 'Replay generations');
    $('step').disabled = g === M.GENERATIONS;
    let observation;
    if (state.k === 1) observation = `At k = 1, the expected population stays at ${state.initial}. ${64 - data.surviving[g]} of these 64 chains have already ended. An average is not a promise.`;
    else if (state.k < 1) observation = `Each generation replaces less than it loses. The expected population is ${data.expected[g].toFixed(2)} at generation ${g}; ${data.surviving[g]} of 64 chains are still going.`;
    else observation = `The expected population grows, but a small chain can still disappear. ${64 - data.surviving[g]} of these 64 chains have ended even at k = ${state.k.toFixed(2)}.`;
    $('observation').textContent = observation;
    drawTree(); drawChart();
  }
  function advance(seconds) {
    if (!state.playing) return;
    elapsed += seconds;
    let changed = false;
    while (elapsed >= .24 && state.playing) {
      elapsed -= .24;
      state.generation++;
      if (state.generation >= M.GENERATIONS) { state.generation = M.GENERATIONS; state.playing = false; }
      changed = true;
    }
    if (changed) render();
  }
  function setK(k) { state.k = Number(k); state.playing = false; rebuild(); }
  $('k').addEventListener('input', event => setK(event.target.value));
  document.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => setK(b.dataset.k)));
  document.querySelectorAll('[data-source]').forEach(b => b.addEventListener('click', () => { state.initial = Number(b.dataset.source); state.playing = false; rebuild(); }));
  $('generation').addEventListener('input', event => { state.generation = Number(event.target.value); state.playing = false; elapsed = 0; render(); });
  $('play').addEventListener('click', () => {
    if (state.playing) state.playing = false;
    else if (reducedMotion) { state.generation = M.GENERATIONS; }
    else { state.generation = 0; state.playing = true; elapsed = 0; }
    render();
  });
  $('step').addEventListener('click', () => { state.generation = Math.min(M.GENERATIONS, state.generation + 1); state.playing = false; render(); });
  function select(delta) {
    state.selected = (state.selected + delta + M.TRIALS) % M.TRIALS;
    chain = M.simulate(state.k, state.initial, M.trialSeed(state.seed, state.selected), true); render();
  }
  $('previous').addEventListener('click', () => select(-1));
  $('next').addEventListener('click', () => select(1));
  $('reroll').addEventListener('click', () => { state.seed = (state.seed + 104729) >>> 0; state.batch++; state.playing = false; rebuild(); });
  new ResizeObserver(render).observe(document.querySelector('.stage'));
  function tick(now) {
    if (state.live && previousTime) advance(Math.min(.1, (now - previousTime) / 1000));
    previousTime = now; requestAnimationFrame(tick);
  }
  window.oneMore = { state, render, advance, setLive(value) { state.live = value; }, getStats() { const g = state.generation; return { generation: g, population: chain.counts[g], surviving: data.surviving[g], expected: data.expected[g], mean: data.mean[g], counts: chain.counts.slice(), seed: state.seed, k: state.k, initial: state.initial }; } };
  rebuild(); requestAnimationFrame(tick);
})();
