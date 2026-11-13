/* Eighty Days — UI: canvas map, timetable sidebar, clocks, log. */
(function () {
  'use strict';
  const M = window.EightyDays;
  const $ = (sel) => document.querySelector(sel);

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    time: M.START,
    port: 'hoboken',
    mode: 'idle', // idle | traveling | finished | stranded
    misses: 0,
    newsIdx: 0,
    traveled: [], // legs completed
    current: null, // {leg, dep, arr, t}
    log: [],
  };

  /* ---------- logging ---------- */

  function dayLabel(h) {
    return `DAY ${Math.floor((h - M.START) / 24) + 1}`;
  }

  function log(text, cls) {
    state.log.push({ day: dayLabel(state.time), text, cls });
    renderLog();
  }

  function renderLog() {
    const el = $('#log');
    el.innerHTML = state.log.slice(-40).map((e) =>
      `<p class="${e.cls || ''}"><span>${e.day}</span>${e.text}</p>`).join('');
    el.scrollTop = el.scrollHeight;
  }

  function fireNews() {
    while (state.newsIdx < M.NEWS.length && M.NEWS[state.newsIdx].h <= state.time) {
      const item = M.NEWS[state.newsIdx];
      log(item.text, 'news');
      state.newsIdx += 1;
    }
  }

  /* ---------- map ---------- */

  const LAND = [
    [[-168, 66], [-152, 70], [-130, 70], [-120, 60], [-95, 66], [-82, 70], [-62, 60], [-55, 50], [-66, 44], [-70, 41], [-75, 35], [-80, 31], [-81, 25], [-89, 29], [-97, 26], [-97, 22], [-95, 17], [-88, 16], [-83, 9], [-79, 8], [-82, 10], [-87, 14], [-95, 17], [-105, 21], [-110, 24], [-114, 29], [-117, 33], [-122, 38], [-124, 44], [-124, 48], [-130, 55], [-135, 58], [-152, 60], [-165, 60]],
    [[-79, 8], [-70, 10], [-60, 9], [-50, 0], [-35, -6], [-38, -13], [-48, -25], [-57, -35], [-62, -40], [-66, -47], [-70, -53], [-74, -48], [-72, -37], [-70, -18], [-76, -10], [-79, -2]],
    [[-58, 76], [-40, 84], [-25, 80], [-22, 70], [-40, 60], [-53, 65]],
    [[-9, 51], [1, 51], [8, 54], [10, 57], [5, 58], [10, 64], [18, 70], [30, 70], [40, 68], [55, 70], [70, 73], [90, 75], [110, 74], [130, 72], [150, 70], [170, 68], [179, 66], [179, 62], [162, 60], [145, 48], [135, 44], [126, 40], [121, 32], [110, 20], [108, 12], [103, 2], [100, 8], [97, 15], [92, 22], [88, 22], [80, 15], [77, 8], [72, 20], [67, 24], [60, 25], [57, 17], [52, 14], [48, 12], [43, 12], [38, 18], [35, 28], [34, 30], [28, 41], [19, 42], [13, 45], [6, 43], [0, 39], [-8, 37], [-9, 43]],
    [[-6, 35], [10, 37], [20, 33], [32, 31], [34, 28], [38, 18], [43, 12], [48, 11], [51, 11], [45, 2], [41, -3], [37, -10], [35, -20], [32, -29], [25, -34], [19, -35], [15, -28], [12, -18], [13, -8], [9, -1], [9, 4], [-4, 5], [-8, 4], [-13, 9], [-17, 15], [-17, 21], [-10, 28]],
    [[114, -22], [113, -34], [129, -32], [137, -35], [141, -38], [146, -39], [150, -37], [153, -28], [146, -19], [142, -11], [136, -12], [131, -11], [126, -14]],
    [[130, 31], [132, 34], [136, 35], [140, 37], [141, 41], [143, 44], [145, 44], [141, 40], [139, 35], [135, 33]],
    [[-5, 50], [1, 51], [2, 53], [-2, 56], [-4, 58], [-7, 57], [-6, 54]],
    [[-10, 52], [-6, 52], [-6, 55], [-10, 55]],
    [[109, 2], [114, 4], [117, 7], [119, 1], [116, -3], [110, -2]],
    [[95, 5], [98, 3], [103, -1], [106, -5], [102, -5], [96, 2]],
    [[172, -35], [178, -38], [174, -42], [170, -46], [167, -46], [171, -41]],
  ];

  const LABELS = {
    hoboken: { dx: 7, dy: 4, align: 'left' },
    southampton: { dx: -7, dy: 5, align: 'right' },
    london: { dx: 7, dy: -4, align: 'left' },
    brindisi: { dx: 7, dy: 5, align: 'left' },
    portsaid: { dx: 6, dy: -5, align: 'left' },
    aden: { dx: 7, dy: 5, align: 'left' },
    colombo: { dx: -7, dy: 8, align: 'right' },
    penang: { dx: -7, dy: -5, align: 'right' },
    singapore: { dx: 6, dy: 12, align: 'left' },
    hongkong: { dx: 7, dy: -5, align: 'left' },
    yokohama: { dx: -8, dy: -6, align: 'right' },
    sanfran: { dx: -8, dy: 10, align: 'right' },
    chicago: { dx: 7, dy: -6, align: 'left' },
  };

  const W = 780, H = 440;
  const LAT_TOP = 78, LAT_BOTTOM = -58;
  const canvas = $('#map');

  function proj(lon, lat) {
    return [(lon + 180) / 360 * W, (LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM) * H];
  }

  function norm(lon) {
    return ((lon % 360) + 540) % 360 - 180;
  }

  function drawPath(ctx, pts, color, width, dash) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    let prev = null; // unwrapped {lon, lat}
    let started = false;
    for (const [lon, lat] of pts) {
      if (!prev) { prev = { lon, lat }; continue; }
      let l = lon;
      while (l - prev.lon > 180) l -= 360;
      while (prev.lon - l > 180) l += 360;
      const kA = Math.floor((prev.lon + 180) / 360);
      const kB = Math.floor((l + 180) / 360);
      if (kA === kB) {
        const [x, y] = proj(norm(prev.lon), prev.lat);
        if (!started) { ctx.moveTo(x, y); started = true; }
        const [x2, y2] = proj(norm(l), lat);
        ctx.lineTo(x2, y2);
      } else {
        // One antimeridian crossing: split the segment at the ±180 screen edge.
        const cross = kB > kA ? kB * 360 - 180 : kA * 360 - 180;
        const f = (cross - prev.lon) / (l - prev.lon);
        if (f > 0 && f < 1) {
          const ym = prev.lat + (lat - prev.lat) * f;
          const [x1, y1] = proj(norm(prev.lon), prev.lat);
          if (!started) { ctx.moveTo(x1, y1); started = true; }
          ctx.lineTo(cross > 0 ? W : 0, ym);
          const [xr, yr] = proj(cross > 0 ? -180 : 180, ym);
          ctx.moveTo(xr, yr);
          const [x2, y2] = proj(norm(l), lat);
          ctx.lineTo(x2, y2);
        } else {
          // Touches ±180 without crossing (e.g. a point exactly on the line).
          const [x, y] = proj(norm(prev.lon), prev.lat);
          if (!started) { ctx.moveTo(x, y); started = true; }
          const [x2, y2] = proj(norm(l), lat);
          ctx.lineTo(x2, y2);
        }
      }
      prev = { lon: l, lat };
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawMap() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // water
    ctx.fillStyle = '#dbe4e6';
    ctx.fillRect(0, 0, W, H);

    // graticule
    ctx.strokeStyle = '#c6d3d5';
    ctx.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 30) {
      const [x] = proj(lon, 0);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let lat = -40; lat <= 60; lat += 20) {
      const [, y] = proj(0, lat);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // antimeridian
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#b3c2c5';
    const [xm] = proj(180, 0);
    ctx.beginPath(); ctx.moveTo(xm, 0); ctx.lineTo(xm, H); ctx.stroke();
    ctx.setLineDash([]);

    // land
    ctx.fillStyle = '#f6f3e6';
    ctx.strokeStyle = '#b9b19a';
    for (const poly of LAND) {
      ctx.beginPath();
      poly.forEach(([lon, lat], i) => {
        const [x, y] = proj(lon, lat);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // full historical route, faint
    for (const leg of M.LEGS) drawPath(ctx, leg.via, '#9db0ab', 1.2, [3, 4]);

    // traveled route, solid
    ctx.lineWidth = 2.4;
    for (const legId of state.traveled) {
      const leg = M.LEGS.find((l) => l.id === legId);
      drawPath(ctx, leg.via, '#e8793a', 2.4, []);
    }

    // ports
    ctx.font = '9px Arial, Helvetica, sans-serif';
    for (const id of Object.keys(M.PORTS)) {
      const p = M.PORTS[id];
      const [x, y] = proj(p.lon, p.lat);
      ctx.fillStyle = id === state.port && state.mode === 'idle' ? '#e8793a' : '#4a5654';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      const lab = LABELS[id];
      if (lab && p.onRoute) {
        ctx.fillStyle = '#5a6859';
        ctx.textAlign = lab.align;
        ctx.fillText(p.short, x + lab.dx, y + lab.dy);
      }
    }

    // Bisland marker
    const b = M.bislandPosition(state.time);
    const [bx, by] = proj(b.lon, b.lat);
    ctx.fillStyle = '#7d5aa0';
    ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7d5aa0';
    ctx.font = 'bold 8px Arial, Helvetica, sans-serif';
    ctx.fillText('B', bx + 5, by - 4);

    // player marker
    const pos = playerPosition();
    const [px2, py2] = proj(pos.lon, pos.lat);
    ctx.fillStyle = '#e8793a';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px2, py2, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // Current player position (port, or interpolation along the active leg).
  function playerPosition() {
    if (state.current) {
      const { leg, t } = state.current;
      const pts = leg.via;
      // index-based interpolation; unwrap longitudes per segment
      const total = pts.length - 1;
      const f = Math.min(0.9999, Math.max(0, t)) * total;
      const i = Math.floor(f);
      const local = f - i;
      const a = pts[i];
      const b = pts[Math.min(i + 1, total)];
      let blon = b[0];
      while (blon - a[0] > 180) blon -= 360;
      while (a[0] - blon > 180) blon += 360;
      const lon = a[0] + (blon - a[0]) * local;
      return { lon: ((lon + 540) % 360) - 180, lat: a[1] + (b[1] - a[1]) * local };
    }
    const p = M.PORTS[state.port];
    return { lon: p.lon, lat: p.lat };
  }

  /* ---------- clocks / hud ---------- */

  function renderHud() {
    const elapsed = state.time - M.START;
    const d = Math.floor(elapsed / 24);
    const rem = elapsed - d * 24;
    const hh = Math.floor(rem);
    const mm = Math.round((rem - hh) * 60);
    $('#elapsed-day').textContent = `DAY ${d + 1}`;
    $('#elapsed-clock').textContent = `${d}d ${hh}h ${String(mm).padStart(2, '0')}m elapsed`;

    $('#home-clock').textContent = M.formatShort(state.time, -5);
    const localTz = state.current ? M.PORTS[state.current.leg.to].tz : M.PORTS[state.port].tz;
    $('#local-clock').textContent = state.current
      ? '— underway —'
      : M.formatShort(state.time, localTz);
    $('#local-label').textContent = state.current
      ? `UNDERWAY → ${M.PORTS[state.current.leg.to].short.toUpperCase()}`
      : `LOCAL — ${M.PORTS[state.port].short.toUpperCase()}`;

    // pace bar (0 → 90 days)
    const pct = Math.min(100, (elapsed / (90 * 24)) * 100);
    $('#pace-fill').style.width = `${pct}%`;
    const nowDot = $('#pace-dot');
    nowDot.style.left = `${pct}%`;

    // pace vs Nellie at the current port
    const pace = $('#pace-note');
    if (state.current) {
      pace.textContent = 'underway — the clocks keep spinning';
    } else {
      const finished = state.mode === 'finished' || state.mode === 'stranded';
      // At Hoboken the reference is her departure (start) — or, once the race
      // is done, her official total. Elsewhere it is her real arrival there.
      const refAbs = state.port === 'hoboken' && state.traveled.length
        ? M.START + M.NELLIE_TOTAL
        : M.NELLIE_ARRIVALS[state.port];
      if (refAbs === undefined) {
        pace.textContent = '';
      } else {
        const diff = state.time - refAbs;
        const ref = finished ? 'Nellie Bly\'s 72d 6h 11m' : 'Nellie\'s pace';
        if (Math.abs(diff) < 1 / 60) pace.textContent = finished ? 'even with Nellie Bly\'s record' : 'even with Nellie\'s pace';
        else if (diff < 0) pace.textContent = `${M.formatElapsed(-diff)} ahead of ${ref}`;
        else pace.textContent = `${M.formatElapsed(diff)} behind ${ref}`;
      }
    }

    const b = M.bislandPosition(state.time);
    const bDay = Math.floor(state.time / 24);
    $('#rival-status').textContent = `Bisland (westbound): ${b.label} · day ${bDay + 1}`;
  }

  /* ---------- timetable panel ---------- */

  function renderPort() {
    const p = M.PORTS[state.port];
    $('#port-name').textContent = p.name;
    $('#port-flavor').textContent = p.flavor;
    $('#arrived-info').textContent = `Arrived ${M.formatLocal(state.time, p.tz)}`;
  }

  function renderOptions() {
    const el = $('#options');
    if (state.mode !== 'idle') { el.innerHTML = '<p class="hint">Timetable locked while underway.</p>'; return; }
    const opts = M.optionsAt(state.port, state.time);
    if (!opts.length) { el.innerHTML = '<p class="hint">No further sailings on this line.</p>'; return; }
    el.innerHTML = opts.map(({ leg, departures }) => {
      const tz = M.PORTS[leg.from].tz;
      const kind = leg.kind === 'rail' ? 'TRAIN' : leg.kind === 'charter' ? 'SPECIAL' : 'STEAMER';
      const deps = departures.map((abs, i) => {
        const wait = abs - state.time;
        const waitTxt = wait > 1e-6 ? ` · wait ${M.formatElapsed(wait)}` : ' · board now';
        return `<button class="dep" data-leg="${leg.id}" data-index="${i}">${M.formatShort(abs, tz)}${waitTxt}</button>`;
      }).join('');
      const note = leg.note ? `<p class="note">${leg.note}</p>` : '';
      const dur = `<span class="dur">→ ${M.PORTS[leg.to].short} · ${M.formatElapsed(leg.duration)}</span>`;
      return `<div class="option"><div class="option-head"><span class="kind ${leg.kind}">${kind}</span><strong>${leg.carrier}</strong></div>${dur}${deps}${note}</div>`;
    }).join('');
    el.querySelectorAll('.dep').forEach((btn) => {
      btn.addEventListener('click', () => depart(btn.dataset.leg, Number(btn.dataset.index)));
    });
  }

  /* ---------- travel ---------- */

  function crossDateLine(leg) {
    const pts = leg.via;
    for (let i = 1; i < pts.length; i++) {
      if (Math.abs(pts[i][0] - pts[i - 1][0]) > 180) return true;
    }
    return false;
  }

  function depart(legId, depIndex) {
    if (state.mode !== 'idle') return;
    const leg = M.LEGS.find((l) => l.id === legId);
    const deps = M.nextDepartures(leg, state.time, leg.kind === 'rail' ? 2 : 3);
    const dep = deps[depIndex];
    state.misses += M.missedSailings(state.port, state.time, dep);
    const arr = dep + leg.duration;
    state.current = { leg, dep, arr, t: 0 };
    state.mode = 'traveling';
    log(`Departed ${M.PORTS[leg.from].short} on the ${leg.carrier}. ${M.formatElapsed(dep - state.time)} in port.`);
    renderHud();
    renderOptions();
    renderPort();

    const span = REDUCED ? 0 : Math.min(2.8, Math.max(1.2, leg.duration / 60));
    if (span <= 0) { arrive(); return; }
    const t0 = performance.now();
    requestAnimationFrame(function step(nowMs) {
      if (!state.current) return; // finishTravel() already committed the leg
      const t = Math.min(1, (nowMs - t0) / (span * 1000));
      state.current.t = t;
      state.time = state.current.dep + leg.duration * t;
      drawMap();
      renderHud();
      if (t < 1) requestAnimationFrame(step);
      else arrive();
    });
  }

  function arrive() {
    const { leg, arr } = state.current;
    state.current = null;
    state.time = arr;
    state.port = leg.to;
    state.traveled.push(leg.id);
    if (crossDateLine(leg)) {
      log('180th meridian crossed — the calendar set itself back a day.', 'event');
    }
    log(`Arrived ${M.PORTS[leg.to].short} · ${M.formatLocal(arr, M.PORTS[leg.to].tz)}`);
    fireNews();
    finishCheck();
  }

  function finishCheck() {
    if (state.port === 'hoboken') {
      state.mode = 'finished';
      drawMap();
      renderHud();
      renderLog();
      const v = M.verdict(state.time - M.START, state.misses, false);
      $('#modal-kicker').textContent = `VOYAGE COMPLETE · ${M.formatLocal(state.time, -5)}`;
      $('#modal-title').textContent = v.title;
      $('#modal-big').textContent = M.formatElapsed(state.time - M.START);
      $('#modal-text').textContent = v.text;
      $('#modal').classList.add('open');
      return;
    }
    if (!M.optionsAt(state.port, state.time).length) {
      state.mode = 'stranded';
      drawMap();
      renderHud();
      renderLog();
      const v = M.verdict(state.time - M.START, state.misses, true);
      $('#modal-kicker').textContent = `STRANDED · ${M.formatLocal(state.time, M.PORTS[state.port].tz)}`;
      $('#modal-title').textContent = v.title;
      $('#modal-big').textContent = M.formatElapsed(state.time - M.START);
      $('#modal-text').textContent = v.text;
      $('#modal').classList.add('open');
      return;
    }
    state.mode = 'idle';
    drawMap();
    renderHud();
    renderPort();
    renderOptions();
  }

  /* ---------- test hooks ---------- */

  window.EightyApp = {
    getState() {
      return {
        time: state.time, port: state.port, mode: state.mode, misses: state.misses,
        elapsed: state.time - M.START,
        options: state.mode === 'idle' ? M.optionsAt(state.port, state.time)
          .map(({ leg, departures }) => ({ leg: leg.id, departures })) : [],
        log: state.log.length,
        finished: state.mode === 'finished', stranded: state.mode === 'stranded',
      };
    },
    depart(legId, depIndex) { depart(legId, depIndex); },
    finishTravel() {
      if (state.current) {
        state.current.t = 1;
        state.time = state.current.arr;
        arrive();
      }
    },
  };

  /* ---------- boot ---------- */

  $('#restart').addEventListener('click', () => location.reload());
  $('#modal-close').addEventListener('click', () => $('#modal').classList.remove('open'));

  log('You board at Hoboken with one carpet bag and a World assignment: circle the globe in eighty days.');
  fireNews();
  drawMap();
  renderHud();
  renderPort();
  renderOptions();
})();
