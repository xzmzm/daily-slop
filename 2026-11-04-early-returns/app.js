(() => {
  const M = window.EarlyReturns;
  const $ = (id) => document.getElementById(id);
  const svgNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => {
    const node = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };
  const STEP = 5 / 60;                       // slider steps are five minutes
  const STEPS = Math.round((M.END - M.START) / STEP);
  const nation = M.buildNation();
  const state = { step: 18, view: 'proj', typo: false, playing: false };
  const nights = {};                         // cached snapshots for the chart, per typo setting

  const hourOf = (step) => M.START + step * STEP;
  function clockText(h) {
    const mins = Math.round(h * 60);
    const hh = Math.floor(mins / 60) % 24, mm = mins % 60;
    const h12 = ((hh + 11) % 12) + 1;
    return `${h12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
  }

  function night(typo) {
    const key = typo ? 1 : 0;
    if (!nights[key]) nights[key] = Array.from({ length: STEPS + 1 }, (_, i) => M.snapshot(nation, hourOf(i), typo, 300));
    return nights[key];
  }

  // Map tiles.
  const TILE = 50, GAP = 2, OX = 33, OY = 4;
  const tiles = M.STATES.map((s) => {
    const g = el('g', { class: 'tile', transform: `translate(${OX + (s.col - 1) * (TILE + GAP)} ${OY + s.row * (TILE + GAP)})` });
    const rect = el('rect', { width: TILE, height: TILE, rx: 3 });
    const name = el('text', { x: TILE / 2, y: 23 });
    name.textContent = s.abbr;
    const ev = el('text', { class: 'ev', x: TILE / 2, y: 38 });
    ev.textContent = s.ev;
    const title = el('title', {});
    g.append(rect, name, ev, title);
    $('map').append(g);
    return { g, rect, title };
  });

  function shade(share) {
    // Deeper colour for bigger margins; 50 % is the pale midpoint.
    const m = Math.min(1, Math.abs(share - 50) / 18);
    const rep = share > 50;
    const from = rep ? [226, 165, 150] : [157, 182, 207];
    const to = rep ? [181, 57, 43] : [47, 95, 138];
    const c = from.map((f, i) => Math.round(f + (to[i] - f) * (0.25 + 0.75 * m)));
    return { fill: `rgb(${c.join(',')})`, dark: m > 0.35 };
  }

  function drawMap(snap) {
    snap.states.forEach((s, i) => {
      const t = tiles[i];
      let share = state.view === 'count' ? s.count : s.proj;
      const est = state.view === 'proj' && !s.known;
      if (share === null) {
        t.rect.setAttribute('fill', 'var(--none)');
        t.g.classList.remove('dark', 'est');
      } else {
        const c = shade(share);
        t.rect.setAttribute('fill', c.fill);
        t.g.classList.toggle('dark', c.dark && !est);
        t.g.classList.toggle('est', est);
      }
      const pct = (v) => (v === null ? '—' : `${v.toFixed(1)} %`);
      t.title.textContent = `${s.abbr} · ${s.ev} EV · ${(s.frac * 100).toFixed(0)} % counted · count ${pct(s.count)} · projected ${pct(s.proj)}`;
    });
  }

  // Chart.
  const X0 = 50, X1 = 980, Y0 = 222, Y1 = 14;
  const xOf = (h) => X0 + ((h - M.START) / (M.END - M.START)) * (X1 - X0);
  const yOf = (ev) => Y0 - (ev / M.TOTAL_EV) * (Y0 - Y1);
  function drawAxes() {
    for (const ev of [0, 100, 200, 300, 400, 531]) {
      $('grid').append(el('line', { class: 'grid-line', x1: X0, x2: X1, y1: yOf(ev), y2: yOf(ev) }));
      const t = el('text', { class: 'axis-label', x: X0 - 8, y: yOf(ev) + 4, 'text-anchor': 'end' });
      t.textContent = ev;
      $('grid').append(t);
    }
    for (let h = M.START; h <= M.END; h++) {
      const t = el('text', { class: 'axis-label', x: xOf(h), y: Y0 + 20, 'text-anchor': 'middle' });
      t.textContent = clockText(h).replace(':00', '');
      $('grid').append(t);
    }
    for (const [id, ev] of [['final', 442], ['need', M.NEEDED]]) $(id).setAttribute('y1', yOf(ev)), $(id).setAttribute('y2', yOf(ev));
    const cx = xOf(M.UNIVAC_CALL);
    $('call').setAttribute('x1', cx); $('call').setAttribute('x2', cx);
    $('call-label').setAttribute('x', cx);
  }
  function drawLines() {
    const snaps = night(state.typo);
    const path = (f) => snaps.map((s, i) => `${i ? 'L' : 'M'}${xOf(s.t).toFixed(1)} ${yOf(f(s)).toFixed(1)}`).join(' ');
    $('proj-line').setAttribute('d', path((s) => s.projEvR));
    $('lead-line').setAttribute('d', path((s) => s.leadR));
  }

  function verdictText(snap) {
    if (snap.counted === 0) return 'No returns yet. With nothing to compare, the projection just replays 1948.';
    const raw = snap.countShare;
    const rawLead = raw >= 50 ? `Eisenhower leads the count with ${raw.toFixed(1)} %` : `Stevenson leads the count, Eisenhower on ${raw.toFixed(1)} %`;
    if (snap.counted > 0.995) return `All in: Eisenhower ${snap.leadR}, Stevenson ${snap.leadD}.`;
    if (state.typo && snap.sd > 12) return `${rawLead}. One bad 1948 figure turns a single precinct into a huge swing to Stevenson, and the odds collapse.`;
    if (raw < 50 && snap.projEvR >= M.NEEDED) return `${rawLead}, but those are city votes. Measured against 1948, the same places swung ${snap.natSwing.toFixed(1)} points to him.`;
    return `${rawLead}. The swing so far is ${snap.natSwing >= 0 ? '+' : ''}${snap.natSwing.toFixed(1)} points.`;
  }

  function render() {
    const h = hourOf(state.step);
    const snap = M.snapshot(nation, h, state.typo);
    $('time').value = state.step;
    $('clock').textContent = clockText(h);
    $('tt-time').textContent = clockText(h);
    const o = M.odds(snap.pIke);
    const tt = $('tt-odds');
    tt.textContent = snap.counted === 0 ? 'AWAITING RETURNS' : `CHANCES ARE ${o.a} TO ${o.b} IN FAVOR OF ${o.fav}`;
    tt.classList.toggle('ike', snap.counted > 0 && o.fav === 'EISENHOWER');
    tt.classList.toggle('adlai', snap.counted > 0 && o.fav === 'STEVENSON');
    $('p-r').textContent = snap.projEvR;
    $('p-d').textContent = snap.projEvD;
    $('r-counted').textContent = `${(snap.counted * 100).toFixed(1)} %`;
    $('r-raw').textContent = snap.countShare === null ? '—' : `${snap.countShare.toFixed(1)} %`;
    $('r-lead').innerHTML = `<em class="r">${snap.leadR}</em> · <em class="d">${snap.leadD}</em>`;
    $('r-swing').textContent = snap.counted === 0 ? '—' : `${snap.natSwing >= 0 ? '+' : ''}${snap.natSwing.toFixed(1)} pts`;
    $('verdict').textContent = verdictText(snap);
    $('map-sub').textContent = state.view === 'count' ? '/ COUNT SO FAR' : '/ UNIVAC PROJECTION';
    drawMap(snap);
    const nx = xOf(h);
    $('now').setAttribute('x1', nx); $('now').setAttribute('x2', nx);
  }

  function press(selector, attr, value) {
    document.querySelectorAll(selector).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === String(value))));
  }

  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    state.view = b.dataset.view; press('[data-view]', 'view', state.view); render();
  }));
  document.querySelectorAll('[data-typo]').forEach((b) => b.addEventListener('click', () => {
    state.typo = b.dataset.typo === '1'; press('[data-typo]', 'typo', b.dataset.typo); drawLines(); render();
  }));
  document.querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => {
    stop(); state.step = Number(b.dataset.jump); render();
  }));
  $('time').max = STEPS;
  $('time').addEventListener('input', (e) => { state.step = Number(e.target.value); render(); });

  let timer = null;
  function stop() { state.playing = false; clearInterval(timer); $('play').textContent = '▶'; }
  $('play').addEventListener('click', () => {
    if (state.playing) return stop();
    if (state.step >= STEPS) state.step = 0;
    state.playing = true; $('play').textContent = '❚❚';
    timer = setInterval(() => {
      state.step++;
      render();
      if (state.step >= STEPS) stop();
    }, 120);
  });

  drawAxes();
  drawLines();
  render();
})();
