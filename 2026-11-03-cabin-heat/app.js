(() => {
  const M = window.CabinModel;
  const $ = (id) => document.getElementById(id);
  const PRESETS = { flown: { stage: 1, torn: 1, fan: 1 }, designed: { stage: 0, torn: 0, fan: 1 } };
  const config = { ...PRESETS.flown };
  const design = M.simulate(PRESETS.designed);
  let run = null;
  let minute = 0;
  let playing = false;
  let last = 0;

  // Chart geometry.
  const X0 = 50, X1 = 940, Y0 = 226, Y1 = 16, TMIN = 0, TMAX = 70;
  const xOf = (m) => X0 + (m / (M.HOURS * 60)) * (X1 - X0);
  const yOf = (c) => Y0 - ((Math.min(TMAX, Math.max(TMIN, c)) - TMIN) / (TMAX - TMIN)) * (Y0 - Y1);
  const svgNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => {
    const node = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  function drawAxes() {
    for (let start = 0; start < M.HOURS * 60; start += M.PERIOD) {
      const a = start + M.PERIOD * M.SUN_FRACTION;
      const b = Math.min(start + M.PERIOD, M.HOURS * 60);
      if (a < b) $('bands').append(el('rect', { class: 'band', x: xOf(a), y: Y1, width: xOf(b) - xOf(a), height: Y0 - Y1 }));
    }
    for (let c = 0; c <= TMAX; c += 10) {
      $('grid').append(el('line', { class: 'grid-line', x1: X0, x2: X1, y1: yOf(c), y2: yOf(c) }));
      const t = el('text', { class: 'axis-label', x: X0 - 8, y: yOf(c) + 4, 'text-anchor': 'end' });
      t.textContent = `${c}°`;
      $('grid').append(t);
    }
    for (let h = 0; h <= M.HOURS; h++) {
      const t = el('text', { class: 'axis-label', x: xOf(h * 60), y: Y0 + 18, 'text-anchor': 'middle' });
      t.textContent = `${h} h`;
      $('grid').append(t);
    }
    $('limit').setAttribute('y1', yOf(M.LIMIT_C));
    $('limit').setAttribute('y2', yOf(M.LIMIT_C));
    $('limit-label').setAttribute('y', yOf(M.LIMIT_C) - 6);
    $('ghost').setAttribute('d', pathOf(design.samples));
  }

  const pathOf = (samples) => samples.map((s, i) => `${i ? 'L' : 'M'}${xOf(s.minute).toFixed(1)} ${yOf(s.celsius).toFixed(1)}`).join('');

  const clock = (m) => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  const hm = (m) => { const r = Math.round(m); return `${Math.floor(r / 60)} h ${String(r % 60).padStart(2, '0')} m`; };

  function heatColor(c) {
    // 10 °C cool blue → 25 °C pale → 40 °C+ red.
    const stops = [[10, [79, 140, 168]], [25, [214, 205, 180]], [33, [228, 154, 60]], [42, [205, 60, 36]], [60, [140, 20, 20]]];
    if (c <= stops[0][0]) return `rgb(${stops[0][1]})`;
    for (let i = 1; i < stops.length; i++) {
      if (c <= stops[i][0]) {
        const [c0, a] = stops[i - 1], [c1, b] = stops[i];
        const u = (c - c0) / (c1 - c0);
        return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * u)).join(',')})`;
      }
    }
    return `rgb(${stops.at(-1)[1]})`;
  }

  function recompute() {
    run = M.simulate(config);
    $('curve').setAttribute('d', pathOf(run.samples));
    for (const sw of document.querySelectorAll('.switch')) {
      const value = String(config[sw.dataset.key]);
      for (const b of sw.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.value === value));
      const bad = sw.dataset.key === 'fan' ? config.fan === 0 : config[sw.dataset.key] === 1;
      sw.dataset.bad = String(bad);
    }
    for (const b of document.querySelectorAll('[data-preset]')) {
      const p = PRESETS[b.dataset.preset];
      b.setAttribute('aria-pressed', String(Object.keys(p).every((k) => p[k] === config[k])));
    }
    $('core-stage').style.display = config.stage ? '' : 'none';
    $('torn').style.display = config.torn ? '' : 'none';
    $('fan').style.display = config.fan ? '' : 'none';

    const settle = M.settle(config);
    $('r-cross').textContent = run.crossed === null ? 'never' : hm(run.crossed);
    $('r-peak').textContent = `${run.peak.toFixed(1)} °C`;
    $('r-settle').textContent = settle > 99 ? '99+ °C' : `${settle.toFixed(1)} °C`;
    let verdict;
    if (run.crossed !== null) verdict = `Too hot. The cabin passes 40 °C after ${hm(run.crossed)} and is still climbing.`;
    else if (settle >= M.LIMIT_C) verdict = `Under 40 °C for nine hours, but still warming. Given long enough it would settle near ${settle > 99 ? '100' : settle.toFixed(0)} °C.`;
    else verdict = `Safe. Even after many orbits, heat in and heat out balance near ${settle.toFixed(0)} °C, below the 40 °C line.`;
    $('verdict').textContent = verdict;
    render();
  }

  function render() {
    const sample = run.samples[Math.min(run.samples.length - 1, Math.round(minute))];
    $('time').value = String(Math.round(minute));
    $('cursor').setAttribute('x1', xOf(sample.minute));
    $('cursor').setAttribute('x2', xOf(sample.minute));
    $('dot').setAttribute('cx', xOf(sample.minute));
    $('dot').setAttribute('cy', yOf(sample.celsius));
    $('cabin').style.fill = heatColor(sample.celsius);
    $('shadow').style.opacity = sample.sun ? '0' : '.72';
    $('sun-rays').style.display = sample.sun ? '' : 'none';
    $('sun-state').textContent = sample.sun ? '/ IN SUNLIGHT' : '/ IN EARTH’S SHADOW';
    $('scene-clock').textContent = `T + ${clock(sample.minute)}`;
    $('scene-orbit').textContent = `ORBIT ${Math.floor(sample.minute / M.PERIOD) + 1}`;
    $('scene-temp').textContent = `${sample.celsius.toFixed(1)} °C`;
    $('scene-temp').style.fill = sample.celsius >= M.LIMIT_C ? '#ff7a5c' : '#efe7d6';
    const scale = 200;
    $('bar-in').style.width = `${Math.min(100, sample.heatIn / scale * 100)}%`;
    $('bar-out').style.width = `${Math.min(100, sample.heatOut / scale * 100)}%`;
    $('w-in').textContent = `${Math.round(sample.heatIn)} W`;
    $('w-out').textContent = `${Math.round(sample.heatOut)} W`;
    const parts = [`dog + instruments ${sample.internal} W`];
    if (sample.solar) parts.push(`sunlight ${Math.round(sample.solar)} W`);
    if (sample.stage) parts.push(`core stage ${sample.stage} W`);
    $('parts').textContent = parts.join(' · ');
    $('play-icon').textContent = playing ? '❚❚' : '▶';
    $('play-label').textContent = playing ? 'Pause' : minute >= M.HOURS * 60 ? 'Fly again' : 'Fly nine hours';
  }

  function tick(now) {
    if (!playing) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    minute = Math.min(M.HOURS * 60, minute + dt * 45); // 45 flight minutes per second
    if (minute >= M.HOURS * 60) playing = false;
    render();
    if (playing) requestAnimationFrame(tick);
  }

  $('play').addEventListener('click', () => {
    playing = !playing;
    if (playing) {
      if (minute >= M.HOURS * 60) minute = 0;
      last = performance.now();
      requestAnimationFrame(tick);
    }
    render();
  });
  $('time').addEventListener('input', (e) => { playing = false; minute = Number(e.target.value); render(); });
  for (const sw of document.querySelectorAll('.switch')) {
    for (const b of sw.querySelectorAll('button')) {
      b.addEventListener('click', () => { config[sw.dataset.key] = Number(b.dataset.value); recompute(); });
    }
  }
  for (const b of document.querySelectorAll('[data-preset]')) {
    b.addEventListener('click', () => { Object.assign(config, PRESETS[b.dataset.preset]); recompute(); });
  }

  drawAxes();
  minute = 320; // open at 5 h 20 m, in sunlight, past the 40 °C line
  recompute();
})();
