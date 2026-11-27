(function () {
  const P = window.StarHop;
  const manualClock = Boolean(window.__ftManualClock);
  const $ = (id) => document.getElementById(id);
  const sky = $('sky'), sctx = sky.getContext('2d');
  const map = $('map'), mctx = map.getContext('2d');
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const C = { ink: css('--ink'), dim: css('--dim'), rule: css('--rule'), amber: css('--amber'), green: css('--green'), red: css('--red'), blue: css('--blue') };

  const SPEED_LOCK = 0.22;   // mission days per real second while holding a lock
  const SPEED_SEARCH = 0.03; // slower while rolling, so the sweep is visible
  const SPEEDS = [1, 4];

  let m, paused = false, speedIx = 0, logShown = 0;

  function reset() {
    m = P.createMission();
    paused = false; logShown = 0;
    $('log').innerHTML = '';
    $('pause').textContent = 'Pause';
    render();
  }

  function step(realSeconds) {
    if (!paused && !m.outcome) {
      const rate = (m.mode === 'search' || m.day < P.SEARCH_START + 0.05 ? SPEED_SEARCH : SPEED_LOCK) * SPEEDS[speedIx];
      P.step(m, realSeconds * rate);
    }
    render();
  }

  // ---- Sky dial: Sun at the centre, radius = angle from the Sun -----------------------
  const SKY_MAX = 135;
  // [dx, dy] nudges so neighbouring labels don't collide; negative dx puts the label left of the star.
  const NUDGE = { Alioth: [-1, 4], Naos: [-1, 4], Regor: [1, 15] };
  function skyXY(clock, cone) {
    const R = sky.height / 2 - 22, cx = sky.width / 2, cy = sky.height / 2;
    const r = (cone / SKY_MAX) * R, a = (clock - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  function drawSky() {
    const W = sky.width, H = sky.height, cx = W / 2, cy = H / 2, R = H / 2 - 22;
    sctx.clearRect(0, 0, W, H);
    const rIn = ((P.CONE - P.CONE_HALF) / SKY_MAX) * R, rOut = ((P.CONE + P.CONE_HALF) / SKY_MAX) * R;

    // sensor ring
    sctx.fillStyle = 'rgba(143, 184, 255, 0.07)';
    sctx.beginPath(); sctx.arc(cx, cy, rOut, 0, 7); sctx.arc(cx, cy, rIn, 0, 7, true); sctx.fill();
    sctx.strokeStyle = C.rule; sctx.lineWidth = 1;
    for (const c of [45, 90]) { sctx.beginPath(); sctx.arc(cx, cy, (c / SKY_MAX) * R, 0, 7); sctx.stroke(); }
    sctx.fillStyle = C.dim; sctx.font = '12px ui-monospace, Menlo, monospace';
    sctx.fillText('90° from Sun', cx - (90 / SKY_MAX) * R * 0.71 - 96, cy + (90 / SKY_MAX) * R * 0.71 + 14);

    // Earth-shine glow fades with distance
    const glow = P.earthGlow(m.day);
    if (glow > 0.02) {
      const [ex, ey] = skyXY(P.EARTH_CLOCK, P.CONE);
      const g = sctx.createRadialGradient(ex, ey, 0, ex, ey, 60);
      g.addColorStop(0, `rgba(143, 184, 255, ${Math.min(0.7, glow * 0.35)})`); g.addColorStop(1, 'rgba(143,184,255,0)');
      sctx.fillStyle = g; sctx.beginPath(); sctx.arc(ex, ey, 60, 0, 7); sctx.fill();
      sctx.fillStyle = C.blue; sctx.fillText('Earth-shine', ex - 34, ey + 44);
    }

    // stars
    for (const s of P.SKY) {
      if (s.cone > SKY_MAX - 2) continue;
      const [x, y] = skyXY(s.clock, s.cone);
      const inRing = P.RING.includes(s);
      const r = Math.max(1.2, 3.4 - s.mag * 1.1);
      sctx.fillStyle = s.name === 'Canopus' ? C.amber : inRing ? C.ink : 'rgba(217, 232, 220, 0.45)';
      sctx.beginPath(); sctx.arc(x, y, r, 0, 7); sctx.fill();
      if (inRing || s.mag < 0.2) {
        sctx.fillStyle = s.name === 'Canopus' ? C.amber : inRing ? C.ink : C.dim;
        const [dx, dy] = NUDGE[s.name] || [1, 4];
        sctx.fillText(s.name, dx < 0 ? x - r - 3 - sctx.measureText(s.name).width : x + r + 3, y + dy);
      }
    }

    // the Sun
    sctx.fillStyle = C.amber;
    sctx.beginPath(); sctx.arc(cx, cy, 9, 0, 7); sctx.fill();
    sctx.fillStyle = C.dim; sctx.fillText('Sun (roll axis)', cx + 13, cy + 4);

    // the sensor slit
    if (m.mode !== 'idle') {
      const a = (m.roll - 90) * Math.PI / 180, half = (P.SLIT_HALF * 1.6) * Math.PI / 180;
      sctx.fillStyle = m.mode === 'lock' ? 'rgba(127, 224, 162, 0.28)' : 'rgba(242, 184, 75, 0.25)';
      sctx.beginPath(); sctx.arc(cx, cy, rOut, a - half, a + half); sctx.arc(cx, cy, rIn, a + half, a - half, true); sctx.fill();
      sctx.strokeStyle = m.mode === 'lock' ? C.green : C.amber; sctx.lineWidth = 1.5; sctx.stroke();
      const dust = P.dustAt(m, m.day);
      if (dust > 0) {
        const [dx, dy] = skyXY(m.roll + 1, P.CONE - 4);
        sctx.fillStyle = '#fff';
        for (let i = 0; i < 7; i++) {
          sctx.globalAlpha = 0.5 + 0.5 * Math.sin(i * 2.1 + m.day * 900);
          sctx.beginPath(); sctx.arc(dx + Math.cos(i * 1.7) * 10, dy + Math.sin(i * 2.3) * 9, 1.6 + (i % 3), 0, 7); sctx.fill();
        }
        sctx.globalAlpha = 1;
        sctx.fillStyle = C.red; sctx.fillText(`dust fleck +${dust.toFixed(1)}×`, dx + 16, dy - 10);
      }
    }
  }

  // ---- Roll map ------------------------------------------------------------------------
  const LO = Math.log10(0.04), HI = Math.log10(12);
  function drawMap() {
    const W = map.width, H = map.height, L = 44, R = 12, T = 22, B = 28;
    const x = (clock) => L + (clock / 360) * (W - L - R);
    const y = (v) => T + (1 - (Math.log10(Math.max(0.04, Math.min(12, v))) - LO) / (HI - LO)) * (H - T - B);
    mctx.clearRect(0, 0, W, H);
    mctx.font = '12px ui-monospace, Menlo, monospace';

    // gate band
    const g = P.GATES[m.gate];
    mctx.fillStyle = 'rgba(127, 224, 162, 0.13)';
    if (g) mctx.fillRect(L, y(g), W - L - R, y(1 / g) - y(g));
    else mctx.fillRect(L, y(12), W - L - R, y(P.FLOOR) - y(12));

    // axes
    mctx.strokeStyle = C.rule; mctx.fillStyle = C.dim; mctx.lineWidth = 1;
    for (const v of [0.1, 1, 10]) {
      mctx.beginPath(); mctx.moveTo(L, y(v)); mctx.lineTo(W - R, y(v)); mctx.stroke();
      mctx.fillText(v === 1 ? '1×' : String(v), 6, y(v) + 4);
    }
    for (let c = 0; c <= 360; c += 90) mctx.fillText(c + '°', x(c) - 10, H - 8);
    mctx.fillText('signal (× Canopus) against roll angle', L, 14);

    // catalog prediction
    for (const s of P.RING) {
      mctx.strokeStyle = s.name === 'Canopus' ? 'rgba(242, 184, 75, 0.6)' : 'rgba(134, 163, 154, 0.6)';
      mctx.beginPath(); mctx.moveTo(x(s.clock), y(0.04)); mctx.lineTo(x(s.clock), y(s.bright)); mctx.stroke();
    }

    // measured samples
    mctx.fillStyle = C.amber;
    m.samples.forEach((v, i) => {
      if (v === null) return;
      mctx.fillRect(x(i + 0.5) - 1, y(v) - 1, 2.4, 2.4);
    });

    // current roll
    if (m.mode !== 'idle') {
      mctx.strokeStyle = C.blue; mctx.lineWidth = 1.5;
      mctx.beginPath(); mctx.moveTo(x(m.roll), T); mctx.lineTo(x(m.roll), H - B); mctx.stroke();
    }
  }

  // ---- Panel -----------------------------------------------------------------------------
  function render() {
    drawSky();
    drawMap();
    $('clock').textContent = P.utc(m.day);
    $('elapsed').textContent = `launch + ${m.day.toFixed(1)} d`;
    const modeEl = $('mode');
    if (m.mode === 'idle') { modeEl.textContent = 'Waiting'; modeEl.className = ''; $('locked').textContent = 'Sun acquisition first'; }
    else if (m.mode === 'search') { modeEl.textContent = 'Rolling'; modeEl.className = 'search'; $('locked').textContent = 'searching for a star'; }
    else {
      modeEl.textContent = 'Locked'; modeEl.className = m.locked === 'Canopus' ? 'lock' : 'wrong';
      $('locked').textContent = `on ${m.locked}`;
    }
    $('signal').textContent = m.lastReading.toFixed(2) + '×';
    $('burn').textContent = P.utc(m.burnDue);
    const held = m.mode === 'lock' && m.locked === 'Canopus' ? m.day - m.lockedSince : 0;
    $('steady').textContent = held >= P.STEADY ? `ready: steady lock ${(held * 24).toFixed(1)} h`
      : `needs ${(P.STEADY * 24).toFixed(1)} h steady Canopus lock (${(held * 24).toFixed(1)} h now)`;
    document.querySelectorAll('[data-gate]').forEach((b) => b.classList.toggle('on', b.dataset.gate === m.gate));
    const pendingGate = m.pending.filter((c) => c.type === 'gate').pop();
    $('uplink').textContent = m.pending.length
      ? `Uplink in flight: ${m.pending.map((c) => (c.type === 'gate' ? `gate ${c.value}` : 'roll override')).join(', ')}`
      : 'Commands reach the spacecraft about 30 minutes after you send them.';
    document.querySelectorAll('[data-gate]').forEach((b) => b.classList.toggle('pending', Boolean(pendingGate) && b.dataset.gate === pendingGate.value));

    const log = $('log');
    while (logShown < m.log.length) {
      const e = m.log[logShown++];
      const li = document.createElement('li');
      li.innerHTML = `<b>${P.utc(e.day)}</b>`;
      li.appendChild(document.createTextNode(e.text));
      if (/Lock: Canopus|burn fired/.test(e.text)) li.className = 'good';
      else if (/lost|slips|scrubbed|Lock: /.test(e.text)) li.className = 'bad';
      log.prepend(li);
    }

    const v = $('verdict');
    if (m.outcome) {
      v.hidden = false;
      v.className = 'verdict' + (m.outcome.ok ? '' : ' bad');
      v.innerHTML = m.outcome.ok
        ? `<p><b>Burn fired ${P.utc(m.outcome.day)}.</b> ${m.outcome.slips ? `It slipped ${m.outcome.slips} day${m.outcome.slips > 1 ? 's' : ''}; the real one slipped one, to 5 December.` : 'On the first try — the real one slipped a day, to 5 December.'} Canopus lock for ${(m.canopusDays).toFixed(1)} of ${m.day.toFixed(1)} days, ${m.losses} lock losses.</p>`
        : `<p><b>No burn.</b> Three windows went by without ${(P.STEADY * 24).toFixed(1)} h of steady Canopus lock. Dust broke the lock ${m.losses} times. Try finding Canopus with the gate on, then switching it off.</p>`;
    } else v.hidden = true;
  }

  // ---- Controls ---------------------------------------------------------------------------
  document.querySelectorAll('[data-gate]').forEach((b) => b.addEventListener('click', () => { P.command(m, 'gate', b.dataset.gate); render(); }));
  $('hop').addEventListener('click', () => { P.command(m, 'hop'); render(); });
  $('pause').addEventListener('click', () => { paused = !paused; $('pause').textContent = paused ? 'Resume' : 'Pause'; });
  $('speed').addEventListener('click', () => { speedIx = (speedIx + 1) % SPEEDS.length; $('speed').textContent = `Speed ×${SPEEDS[speedIx]}`; });
  $('reset').addEventListener('click', reset);

  let last = performance.now();
  function frame(now) {
    step(Math.min(0.1, (now - last) / 1000));
    last = now;
    requestAnimationFrame(frame);
  }

  window.__ft = {
    state: () => ({ day: m.day, mode: m.mode, locked: m.locked, gate: m.gate, roll: m.roll, losses: m.losses,
      outcome: m.outcome, pending: m.pending.length, lockedSince: m.lockedSince, burnDue: m.burnDue }),
    step,
    // Advance the mission by a number of days, ignoring the on-page speed (used by the video renderer).
    advance(days) { if (days > 0) P.step(m, days); render(); },
  };

  reset();
  if (!manualClock) requestAnimationFrame(frame);
})();
