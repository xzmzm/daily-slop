(function () {
  const P = window.Carryover;
  const manualClock = Boolean(window.__ftManualClock);
  const $ = (id) => document.getElementById(id);
  const birdCanvas = $('bird'), bctx = birdCanvas.getContext('2d');
  const chart = $('chart'), cctx = chart.getContext('2d');
  const CELL = 10;
  const ROAST_SPEED = 40 * 60; // simulated seconds per real second
  const REST_SPEED = 15 * 60;

  const TEMP_STOPS = [[40, '#5b7fd1'], [100, '#cf86a6'], [130, '#ee9a98'], [150, '#f4c9b2'], [165, '#f6ead6'], [185, '#e2b27a'], [200, '#a86532']];
  const DONE_BANDS = [[130, '#e07386', 'raw'], [150, '#f0b2a2', 'pink'], [162, '#f6e8d4', 'juicy'], [175, '#e0c08e', 'firm'], [Infinity, '#b4844f', 'dry']];

  const state = {
    phase: 'fridge', bird: null, t: 0, pulledAt: null, pullProbeF: null, restPeakF: -Infinity,
    history: [], debt: 0, probe: null,
  };
  const plan = () => ({
    pounds: +$('pounds').value, ovenF: +$('oven').value, pullF: +$('pull').value, restMin: +$('rest').value,
  });

  function newBird() {
    state.bird = P.createBird(plan().pounds);
    state.phase = 'fridge'; state.t = 0; state.pulledAt = null; state.pullProbeF = null;
    state.restPeakF = -Infinity; state.history = []; state.debt = 0;
    record();
    render();
  }

  function record() {
    const s = P.stats(state.bird);
    state.history.push({ t: state.t, probe: s.probeF, slow: s.slowF });
  }

  function advance(simSeconds) {
    const p = plan();
    state.debt += simSeconds;
    while (state.debt >= P.DT && (state.phase === 'oven' || state.phase === 'rest')) {
      state.debt -= P.DT;
      if (state.phase === 'oven') {
        P.step(state.bird, P.fToC(p.ovenF), P.H_OVEN);
        state.t += P.DT;
        const probeF = P.stats(state.bird).probeF;
        if (probeF >= p.pullF || state.t > 8 * 3600) {
          state.phase = 'rest'; state.pulledAt = state.t; state.pullProbeF = probeF;
        }
      } else {
        P.step(state.bird, P.fToC(P.ROOM_F), P.H_REST);
        state.t += P.DT;
        state.restPeakF = Math.max(state.restPeakF, P.stats(state.bird).probeF);
        if (state.t - state.pulledAt >= p.restMin * 60) state.phase = 'carved';
      }
      if (state.t % 60 === 0 || state.phase === 'carved') record();
    }
  }

  // ---- Drawing -------------------------------------------------------------------
  function mix(stops, v) {
    if (v <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (v <= stops[i][0]) {
        const [a, ca] = stops[i - 1], [b, cb] = stops[i];
        const f = (v - a) / (b - a);
        const pa = parseInt(ca.slice(1), 16), pb = parseInt(cb.slice(1), 16);
        const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - f) + ((pb >> sh) & 255) * f);
        return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
      }
    }
    return stops[stops.length - 1][1];
  }
  const doneColor = (f) => DONE_BANDS.find((b) => f < b[0])[1];

  function origin(b) {
    return [(birdCanvas.width - b.nx * CELL) / 2, (birdCanvas.height - b.ny * CELL) / 2 + 20];
  }
  function cellCenter(b, k) {
    const [ox, oy] = origin(b);
    return [ox + (k % b.nx + 0.5) * CELL, oy + (Math.floor(k / b.nx) + 0.5) * CELL];
  }

  function drawBird() {
    const b = state.bird, carved = state.phase === 'carved';
    const [ox, oy] = origin(b);
    bctx.fillStyle = '#1c120c';
    bctx.fillRect(0, 0, birdCanvas.width, birdCanvas.height);
    for (let k = 0; k < b.mask.length; k++) {
      if (!b.mask[k]) continue;
      const x = ox + (k % b.nx) * CELL, y = oy + Math.floor(k / b.nx) * CELL;
      if (b.mask[k] === 2) bctx.fillStyle = '#3a2a20';
      else bctx.fillStyle = carved ? doneColor(P.cToF(b.peak[k])) : mix(TEMP_STOPS, P.cToF(b.T[k]));
      bctx.fillRect(x, y, CELL + 0.5, CELL + 0.5);
    }
    const s = P.stats(b);
    // The slowest spot: least Salmonella kill so far.
    if (state.phase !== 'fridge') {
      const [cx, cy] = cellCenter(b, s.leastK);
      bctx.setLineDash([4, 3]); bctx.lineWidth = 2.5; bctx.strokeStyle = '#b36ad8';
      bctx.beginPath(); bctx.arc(cx, cy, 9, 0, Math.PI * 2); bctx.stroke();
      bctx.setLineDash([]);
    }
    // Thermometer stem from above the bird to the tip.
    const [px, py] = cellCenter(b, b.probe);
    const topY = oy - 34;
    bctx.strokeStyle = '#cfd8e3'; bctx.lineWidth = 4;
    bctx.beginPath(); bctx.moveTo(px, topY); bctx.lineTo(px, py); bctx.stroke();
    bctx.fillStyle = '#2f86d4';
    bctx.beginPath(); bctx.arc(px, py, 4.5, 0, Math.PI * 2); bctx.fill();
    bctx.fillStyle = '#f3f6fa'; bctx.strokeStyle = '#2f86d4'; bctx.lineWidth = 3;
    bctx.beginPath(); bctx.roundRect(px - 38, topY - 30, 76, 30, 8); bctx.fill(); bctx.stroke();
    bctx.fillStyle = '#163a5c'; bctx.font = '600 17px system-ui, sans-serif'; bctx.textAlign = 'center';
    bctx.fillText(`${Math.round(s.probeF)}°F`, px, topY - 9);
    bctx.fillStyle = '#b9a593'; bctx.font = '14px system-ui, sans-serif'; bctx.textAlign = 'center';
    const [, cavY] = cellCenter(b, b.mask.indexOf(2));
    bctx.fillText('cavity', ox + b.nx * CELL / 2, cavY + 40);
    // Phase label.
    bctx.textAlign = 'right'; bctx.font = '14px system-ui, sans-serif'; bctx.fillStyle = '#f3e3cf';
    const label = { fridge: 'raw, from the fridge', oven: `in the oven · ${plan().ovenF}°F`, rest: 'resting on the counter', carved: 'carved · colour = hottest it ever got' }[state.phase];
    bctx.fillText(label, birdCanvas.width - 14, 22);
  }

  function drawScale() {
    const carved = state.phase === 'carved';
    const items = carved
      ? DONE_BANDS.map(([, c, name]) => `<i style="background:${c}"></i>${name}`)
      : [40, 100, 130, 150, 165, 185].map((f) => `<i style="background:${mix(TEMP_STOPS, f)}"></i>${f}`);
    $('scale').innerHTML = items.join(' ') + (carved ? '' : ' °F');
  }

  function drawChart() {
    const W = chart.width, H = chart.height, L = 44, R = 12, T = 12, B = 26;
    const tMax = Math.max(4.5 * 3600, state.t * 1.05);
    const X = (t) => L + (W - L - R) * t / tMax;
    const Y = (f) => T + (H - T - B) * (1 - (f - 30) / (200 - 30));
    cctx.clearRect(0, 0, W, H);
    cctx.font = '12px system-ui, sans-serif'; cctx.fillStyle = '#7a6656'; cctx.strokeStyle = '#eee2d2'; cctx.lineWidth = 1;
    cctx.textAlign = 'right';
    for (let f = 40; f <= 200; f += 40) {
      cctx.beginPath(); cctx.moveTo(L, Y(f)); cctx.lineTo(W - R, Y(f)); cctx.stroke();
      cctx.fillText(`${f}°`, L - 6, Y(f) + 4);
    }
    cctx.textAlign = 'center';
    for (let h = 0; h * 3600 <= tMax; h++) cctx.fillText(`${h} h`, X(h * 3600), H - 8);
    cctx.setLineDash([2, 4]); cctx.strokeStyle = '#c2541f'; cctx.lineWidth = 2;
    cctx.beginPath(); cctx.moveTo(L, Y(165)); cctx.lineTo(W - R, Y(165)); cctx.stroke();
    if (state.pulledAt != null) {
      cctx.setLineDash([]); cctx.strokeStyle = '#c9b49b'; cctx.lineWidth = 1.5;
      cctx.beginPath(); cctx.moveTo(X(state.pulledAt), T); cctx.lineTo(X(state.pulledAt), H - B); cctx.stroke();
      cctx.fillStyle = '#7a6656'; cctx.textAlign = 'left';
      cctx.fillText('out of the oven', X(state.pulledAt) + 5, T + 12);
    }
    const line = (key, color, dash) => {
      cctx.setLineDash(dash); cctx.strokeStyle = color; cctx.lineWidth = 2.5; cctx.beginPath();
      state.history.forEach((p, i) => (i ? cctx.lineTo(X(p.t), Y(p[key])) : cctx.moveTo(X(p.t), Y(p[key]))));
      cctx.stroke();
    };
    line('slow', '#7b3fa0', [6, 4]);
    line('probe', '#1f6fb2', []);
    cctx.setLineDash([]);
  }

  const fmtClock = (t) => `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}`;
  const deg = (f) => `${Math.round(f)}°F`;

  function verdict() {
    const s = P.stats(state.bird), p = plan();
    const safe = s.leastKill >= P.TARGET_LOG;
    const loss = s.loss * 100;
    // Neutral on purpose: a model result is not a food-safety verdict.
    $('v-safe').className = '';
    $('v-safe').textContent = safe
      ? `Model target met. In this simulation the least-cooked spot got a ${fmtLog(s.leastKill)} Salmonella kill (target 7).`
      : `Model target missed. In this simulation the least-cooked spot only got a ${fmtLog(s.leastKill)} kill (target 7).`;
    const below = state.pullProbeF < 165 && state.restPeakF < 165 ? 'and never reached' : state.pullProbeF < 165 ? 'which is below' : '';
    $('v-usda').hidden = !below;
    $('v-usda').textContent = below
      ? `Not a real-world check: the thermometer read ${deg(state.pullProbeF)} at the pull, ${below} the USDA's 165°F. A model result doesn't make a real turkey safe.`
      : '';
    const juicy = loss <= 24, fine = loss <= 25.5;
    $('v-juicy').className = juicy ? 'good' : fine ? '' : 'bad';
    $('v-juicy').textContent = `${juicy ? 'Juicy' : fine ? 'Fine' : 'Dry'}. It lost ${loss.toFixed(1)}% of its juice.`;
    const rise = state.restPeakF - state.pullProbeF;
    $('v-carry').textContent = p.restMin
      ? `Out at ${fmtClock(state.pulledAt)} reading ${deg(state.pullProbeF)}. On the counter it kept climbing to ${deg(state.restPeakF)} (+${Math.max(0, rise).toFixed(0)}°F).`
      : `Out at ${fmtClock(state.pulledAt)} reading ${deg(state.pullProbeF)}, carved straight away with no rest.`;
  }
  const fmtLog = (v) => (v >= 100 ? '100+ log' : `${v.toFixed(1)} log`);

  function render() {
    const s = P.stats(state.bird);
    drawBird(); drawScale(); drawChart();
    $('clock').textContent = fmtClock(state.t);
    $('phase').textContent = { fridge: 'In the fridge', oven: 'Roasting', rest: 'Resting', carved: 'Carved' }[state.phase];
    $('probe').textContent = deg(s.probeF);
    $('cold').textContent = deg(s.slowF);
    $('kill').textContent = fmtLog(s.leastKill);
    $('kill').style.color = '';
    $('loss').textContent = `${(s.loss * 100).toFixed(1)}%`;
    const busy = state.phase === 'oven' || state.phase === 'rest';
    $('settings').disabled = state.phase !== 'fridge';
    $('go').disabled = state.phase !== 'fridge';
    $('reset').disabled = busy;
    $('verdict').hidden = state.phase !== 'carved';
    if (state.phase === 'carved') verdict();
    $('hint').textContent = state.phase === 'carved' ? 'Purple ring: the least-cooked spot.' : 'Click the meat to move the thermometer. Purple ring: the slowest spot.';
  }

  // ---- Input ---------------------------------------------------------------------
  for (const [id, fmt] of [['pounds', (v) => `${v} lb`], ['oven', (v) => `${v}°F`], ['pull', (v) => `${v}°F`], ['rest', (v) => `${v} min`]]) {
    const input = $(id);
    const sync = () => { $(`${id}-out`).textContent = fmt(input.value); };
    input.addEventListener('input', () => { sync(); if (id === 'pounds') newBird(); else render(); });
    sync();
  }
  $('go').addEventListener('click', () => { if (state.phase === 'fridge') { state.phase = 'oven'; render(); } });
  $('reset').addEventListener('click', () => { const probe = state.bird.probe; newBird(); if (state.bird.mask[probe] === 1) state.bird.probe = probe; render(); });
  birdCanvas.addEventListener('click', (event) => {
    if (state.phase === 'carved') return;
    const rect = birdCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * birdCanvas.width / rect.width;
    const y = (event.clientY - rect.top) * birdCanvas.height / rect.height;
    const b = state.bird, [ox, oy] = origin(b);
    const i = Math.floor((x - ox) / CELL), j = Math.floor((y - oy) / CELL);
    if (i < 0 || j < 0 || i >= b.nx || j >= b.ny || b.mask[j * b.nx + i] !== 1) return;
    b.probe = j * b.nx + i;
    render();
  });

  function step(realSeconds) {
    if (state.phase === 'oven' || state.phase === 'rest') {
      advance(realSeconds * (state.phase === 'oven' ? ROAST_SPEED : REST_SPEED));
      render();
    }
  }

  let last = performance.now();
  function frame(now) {
    step(Math.min(0.1, (now - last) / 1000));
    last = now;
    requestAnimationFrame(frame);
  }

  window.__ft = {
    state: () => ({ phase: state.phase, t: state.t, pulledAt: state.pulledAt, restPeakF: state.restPeakF, ...P.stats(state.bird) }),
    step,
    probeCell: () => state.bird.probe,
    cellPoint(k) {
      const [x, y] = cellCenter(state.bird, k);
      const rect = birdCanvas.getBoundingClientRect();
      return [rect.left + x * rect.width / birdCanvas.width, rect.top + y * rect.height / birdCanvas.height];
    },
  };

  newBird();
  if (!manualClock) requestAnimationFrame(frame);
})();
