/* TAT-1 — ocean cross-section, seat map, and the recording hooks. */
(() => {
  'use strict';
  const T = window.TAT1;
  const $ = (s) => document.querySelector(s);

  // ---------- geometry ----------
  const OCEAN_W = 1170, OCEAN_H = 630;
  const SEA_TOP = 78, BED_BOTTOM = 552, MAX_DEPTH_M = 5200;
  const LAND_L = 56, LAND_R = 46;
  const xOfKm = (km) => LAND_L + (km / T.ROUTE_KM) * (OCEAN_W - LAND_L - LAND_R);
  const yOfDepth = (m) => SEA_TOP + (m / MAX_DEPTH_M) * (BED_BOTTOM - SEA_TOP);

  // Stylised bathymetry: Newfoundland shelf, slope, abyssal plain, Scottish shelf.
  const BATH = [
    [0, 0], [30, 80], [130, 190], [185, 230], [330, 3300], [430, 4600],
    [760, 4900], [1150, 5020], [1600, 4800], [2100, 5060], [2620, 4920],
    [3110, 4700], [3310, 3000], [3425, 880], [3525, 150], [3700, 0],
  ];
  function depthAt(km) {
    if (km <= BATH[0][0]) return BATH[0][1];
    for (let i = 1; i < BATH.length; i++) {
      if (km <= BATH[i][0]) {
        const [k0, d0] = BATH[i - 1], [k1, d1] = BATH[i];
        return d0 + (d1 - d0) * (km - k0) / (k1 - k0);
      }
    }
    return 0;
  }

  const PALETTE = ['#e8b04b', '#e2704a', '#d9c95e', '#6fd0a8', '#5db8d4',
    '#9d8fd4', '#d48fb8', '#8fb7a8', '#c9e07a'];
  const colorOf = (i) => PALETTE[i % PALETTE.length];

  // ---------- state ----------
  const state = {
    sim: new T.TasiSim({ conversations: 72, circuits: 37, activity: 0.35, tasi: true, seed: 20260925 }),
    pulses: new T.Pulses({ suppressor: false }),
    crossingS: 9,          // screen seconds for one crossing (≈ ×486 slow motion)
    suppressor: false,
    emitTimers: [],
    clipFlashes: [],       // {t} red ticks at Clarenville
    gateFlashes: [],       // {t, side} suppressor events
    lastEchoText: '',
    preset: 'tasi1960',
    autoplay: true,
    clock: 0,
    statTick: 0,
  };

  // ---------- ocean backdrop (drawn once) ----------
  const backdrop = document.createElement('canvas');
  function buildBackdrop() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    backdrop.width = OCEAN_W * dpr; backdrop.height = OCEAN_H * dpr;
    const c = backdrop.getContext('2d');
    c.scale(dpr, dpr);

    // sky
    const sky = c.createLinearGradient(0, 0, 0, SEA_TOP);
    sky.addColorStop(0, '#e9e0cc'); sky.addColorStop(1, '#d3cdb4');
    c.fillStyle = sky; c.fillRect(0, 0, OCEAN_W, SEA_TOP);

    // water
    const water = c.createLinearGradient(0, SEA_TOP, 0, BED_BOTTOM);
    water.addColorStop(0, '#1d4a63'); water.addColorStop(0.35, '#123a52'); water.addColorStop(1, '#081d2d');
    c.fillStyle = water; c.fillRect(0, SEA_TOP, OCEAN_W, BED_BOTTOM - SEA_TOP);
    // surface line
    c.strokeStyle = 'rgba(233,224,204,0.7)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, SEA_TOP);
    for (let x = 0; x <= OCEAN_W; x += 8) c.lineTo(x, SEA_TOP + Math.sin(x / 26) * 1.6);
    c.stroke();

    // depth gridlines and labels, stacked in one column over open water
    c.font = '700 11px ui-monospace, Menlo, monospace';
    for (let m = 1000; m <= 5000; m += 1000) {
      const y = yOfDepth(m);
      c.strokeStyle = 'rgba(233,224,204,0.10)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(LAND_L, y); c.lineTo(OCEAN_W - LAND_R, y); c.stroke();
      if (depthAt(620) > m + 150) { // only where the label sits in open water
        c.fillStyle = 'rgba(233,224,204,0.6)';
        c.fillText(`${m / 1000} km`, xOfKm(620), y - 6);
      }
    }

    // seabed polygon
    const bed = c.createLinearGradient(0, BED_BOTTOM - 200, 0, OCEAN_H);
    bed.addColorStop(0, '#4a3b28'); bed.addColorStop(1, '#2c2418');
    c.fillStyle = bed;
    c.beginPath();
    c.moveTo(xOfKm(0), yOfDepth(0));
    for (let km = 0; km <= T.ROUTE_KM; km += 12) c.lineTo(xOfKm(km), yOfDepth(depthAt(km)));
    c.lineTo(OCEAN_W, OCEAN_H); c.lineTo(0, OCEAN_H); c.closePath(); c.fill();
    // seabed crest line
    c.strokeStyle = 'rgba(233,224,204,0.30)'; c.lineWidth = 1.5;
    c.beginPath();
    for (let km = 0; km <= T.ROUTE_KM; km += 12) {
      const x = xOfKm(km), y = yOfDepth(depthAt(km));
      km === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();

    // land masses
    c.fillStyle = '#6b5a3e';
    c.beginPath(); c.moveTo(0, SEA_TOP - 26); c.lineTo(LAND_L + 14, SEA_TOP);
    c.lineTo(0, yOfDepth(160)); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(OCEAN_W, SEA_TOP - 30); c.lineTo(OCEAN_W - LAND_R - 10, SEA_TOP);
    c.lineTo(OCEAN_W, yOfDepth(200)); c.closePath(); c.fill();

    // cable stations
    c.fillStyle = '#e9e0cc';
    c.fillRect(30, SEA_TOP - 40, 16, 12); c.fillRect(38, SEA_TOP - 30, 6, 22); // Clarenville hut
    c.fillRect(OCEAN_W - 46, SEA_TOP - 40, 16, 12); c.fillRect(OCEAN_W - 38, SEA_TOP - 30, 6, 22);
    c.fillStyle = '#22303a'; c.font = '700 12px ui-monospace, Menlo, monospace';
    c.fillText('CLARENVILLE', 12, SEA_TOP - 48); c.fillText('NEWFOUNDLAND', 12, SEA_TOP - 34);
    const oLabel = 'OBAN · SCOTLAND';
    c.fillText(oLabel, OCEAN_W - 34 - c.measureText(oLabel).width, SEA_TOP - 48);
    const kLabel = '(landed at KERRERA)';
    c.fillStyle = 'rgba(34,48,58,0.7)';
    c.fillText(kLabel, OCEAN_W - 34 - c.measureText(kLabel).width, SEA_TOP - 34);

    // the twin cables follow the seabed
    const cable = (off, color, width) => {
      c.strokeStyle = color; c.lineWidth = width;
      c.beginPath();
      for (let km = 0; km <= T.ROUTE_KM; km += 10) {
        const x = xOfKm(km), y = yOfDepth(depthAt(km)) + off;
        km === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
    };
    cable(-3, 'rgba(233,224,204,0.55)', 2.5);   // eastbound — the one carrying our speech
    cable(4, 'rgba(147,165,180,0.35)', 2);      // westbound twin
    const twinX = xOfKm(980), twinY = yOfDepth(depthAt(980)) + 4;
    c.strokeStyle = 'rgba(200,214,224,0.4)'; c.setLineDash([2, 4]); c.lineWidth = 1;
    c.beginPath(); c.moveTo(twinX + 14, yOfDepth(1000) + 26); c.lineTo(twinX + 14, twinY - 4); c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(200,214,224,0.85)'; c.font = '700 10.5px ui-monospace, Menlo, monospace';
    c.fillText('westbound twin — the other half of every call', twinX - 130, yOfDepth(1000) + 20);

    // repeaters: 51 pods, one every spanKm()
    for (let r = 0; r < T.REPEATERS; r++) {
      const km = r * T.spanKm();
      const x = xOfKm(km), y = yOfDepth(depthAt(km)) - 3;
      c.fillStyle = '#e9e0cc';
      c.beginPath(); c.roundRect(x - 3, y - 3.5, 6, 7, 2); c.fill();
    }
    c.fillStyle = 'rgba(233,224,204,0.85)';
    c.font = '700 11px ui-monospace, Menlo, monospace';
    c.fillText(`51 vacuum-tube repeaters · one every ${Math.round(T.spanKm())} km`, xOfKm(640), yOfDepth(depthAt(640)) - 24);

    // mid-ocean splice + HMTS Monarch
    const sx = xOfKm(1850);
    c.strokeStyle = 'rgba(233,224,204,0.35)'; c.setLineDash([4, 5]); c.lineWidth = 1;
    c.beginPath(); c.moveTo(sx, SEA_TOP); c.lineTo(sx, yOfDepth(depthAt(1850))); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#e9e0cc';
    c.beginPath(); c.moveTo(sx - 7, SEA_TOP); c.lineTo(sx + 7, SEA_TOP); c.lineTo(sx, SEA_TOP - 11); c.closePath(); c.fill();
    // ship silhouette
    c.fillStyle = '#22303a';
    c.beginPath();
    c.moveTo(sx - 26, SEA_TOP - 1); c.lineTo(sx + 26, SEA_TOP - 1);
    c.lineTo(sx + 18, SEA_TOP + 7); c.lineTo(sx - 18, SEA_TOP + 7); c.closePath(); c.fill();
    c.fillRect(sx - 3, SEA_TOP - 22, 5, 21); c.fillRect(sx - 16, SEA_TOP - 15, 13, 5);
    c.fillStyle = 'rgba(233,224,204,0.85)'; c.font = '700 10.5px ui-monospace, Menlo, monospace';
    c.fillText('HMTS MONARCH · FINAL SPLICE, SUMMER 1956', sx - 118, SEA_TOP + 22);

    // distance axis
    c.fillStyle = 'rgba(233,224,204,0.5)'; c.font = '10.5px ui-monospace, Menlo, monospace';
    for (let km = 0; km <= T.ROUTE_KM; km += 500) {
      const x = xOfKm(km);
      c.fillRect(x, OCEAN_H - 26, 1, 6);
      const label = km === 0 ? '0' : km === T.ROUTE_KM ? '3,700 km' : String(km);
      c.fillText(label, Math.min(Math.max(x - 12, 4), OCEAN_W - 60), OCEAN_H - 12);
    }
  }

  function canvasSetup(canvas, w, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return ctx;
  }

  // ---------- ocean live layer ----------
  const oceanEl = $('#ocean');
  oceanEl.style.aspectRatio = `${OCEAN_W} / ${OCEAN_H}`;
  const oceanCtx = canvasSetup(oceanEl, OCEAN_W, OCEAN_H);

  function drawOcean() {
    const c = oceanCtx;
    c.clearRect(0, 0, OCEAN_W, OCEAN_H);
    c.drawImage(backdrop, 0, 0, OCEAN_W, OCEAN_H);

    // held-circuit lane stripes: a circuit with an owner shows a dim band
    const { sim } = state;
    for (let i = 0; i < sim.circuits.length; i++) {
      const owner = sim.circuits[i];
      if (owner < 0) continue;
      const jit = ((i * 37) % 7) - 3;
      c.strokeStyle = colorOf(owner);
      c.globalAlpha = sim.conversations[owner].talking ? 0.32 : 0.13;
      c.lineWidth = sim.conversations[owner].talking ? 2 : 1;
      c.beginPath();
      for (let km = 0; km <= T.ROUTE_KM; km += 25) {
        const x = xOfKm(km), y = yOfDepth(depthAt(km)) - 3 + jit * 0.8;
        km === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
      c.globalAlpha = 1;
    }

    // speech dashes (kind 'speech' rides the same pulse engine as shouts)
    for (const p of state.pulses.items) {
      if (p.kind !== 'speech') continue;
      const jit = ((p.lane * 37) % 7) - 3;
      const km = Math.max(0, Math.min(T.ROUTE_KM, p.pos * T.ROUTE_KM));
      const x = xOfKm(km), y = yOfDepth(depthAt(km)) - 3 + jit * 0.8;
      c.strokeStyle = p.color; c.lineWidth = 3; c.globalAlpha = 0.95;
      c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x + 8, y); c.stroke();
      c.globalAlpha = 0.35; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + 10, y); c.lineTo(x + 15, y); c.stroke();
      c.globalAlpha = 1;
    }

    // test pulses and echoes
    for (const p of state.pulses.items) {
      const km = Math.max(0, Math.min(T.ROUTE_KM, p.pos * T.ROUTE_KM));
      const cable = p.kind === 'echo' || p.dir < 0 ? 4 : -3;
      const x = xOfKm(km), y = yOfDepth(depthAt(km)) + cable;
      c.save();
      c.shadowColor = p.kind === 'test' ? '#fffbe8' : 'rgba(255,251,232,0.5)';
      c.shadowBlur = p.kind === 'test' ? 18 : 8;
      c.globalAlpha = p.kind === 'echo' ? 0.55 : 1;
      c.fillStyle = p.color;
      c.beginPath(); c.ellipse(x, y, p.kind === 'test' ? 9 : 6, 4, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    // repeater glints for anything passing over them
    for (let r = 0; r < T.REPEATERS; r++) {
      const km = r * T.spanKm();
      const px = km / T.ROUTE_KM;
      const busy = state.pulses.items.some((p) =>
        Math.abs(p.pos - px) < (p.kind === 'speech' ? 0.012 : 0.02));
      if (!busy) continue;
      const x = xOfKm(km), y = yOfDepth(depthAt(km)) - 3;
      c.fillStyle = 'rgba(255,244,196,0.85)';
      c.beginPath(); c.arc(x, y, 3.2, 0, Math.PI * 2); c.fill();
    }

    // clip flashes at Clarenville
    for (const f of state.clipFlashes) {
      const age = state.clock - f.t;
      if (age < 0 || age > 1.6) continue;
      c.globalAlpha = 1 - age / 1.6;
      c.fillStyle = '#ff6a4d';
      c.fillRect(LAND_L + 6 + (f.x % 3) * 5, SEA_TOP + 24 + (f.x % 5) * 9, 4, 7);
      c.globalAlpha = 1;
    }
    // suppressor gate flashes
    for (const f of state.gateFlashes) {
      const age = state.clock - f.t;
      if (age < 0 || age > 1.8) continue;
      c.globalAlpha = 1 - age / 1.8;
      c.strokeStyle = '#ff6a4d'; c.lineWidth = 3;
      const x = f.side > 0 ? OCEAN_W - LAND_R - 6 : LAND_L + 6;
      const y = yOfDepth(depthAt(f.side > 0 ? 3650 : 50));
      c.beginPath();
      c.moveTo(x - 7, y - 7); c.lineTo(x + 7, y + 7);
      c.moveTo(x + 7, y - 7); c.lineTo(x - 7, y + 7);
      c.stroke();
      c.font = '700 11px ui-monospace, Menlo, monospace';
      c.fillText('GATED', x + 12, y + 4);
      c.globalAlpha = 1;
    }
  }

  // ---------- seat map ----------
  const MATRIX_W = 372, MATRIX_H = 300;
  const matrixEl = $('#matrix');
  matrixEl.style.aspectRatio = `${MATRIX_W} / ${MATRIX_H}`;
  const matrixCtx = canvasSetup(matrixEl, MATRIX_W, MATRIX_H);

  function drawMatrix() {
    const c = matrixCtx;
    const { sim } = state;
    const n = sim.conversations.length, m = sim.circuits.length;
    c.clearRect(0, 0, MATRIX_W, MATRIX_H);
    c.fillStyle = '#0d2233'; c.fillRect(0, 0, MATRIX_W, MATRIX_H);
    const labelW = n <= 12 ? 128 : 0;
    const gw = MATRIX_W - labelW - 10, gh = MATRIX_H - 10;
    const cw = gw / m, ch = Math.min(gh / n, 15);
    const y0 = (MATRIX_H - ch * n) / 2;
    const sparse = ch >= 5.5; // draw per-cell outlines only when cells are big enough

    for (let i = 0; i < n; i++) {
      const caller = sim.conversations[i];
      const y = y0 + i * ch;
      if (labelW) {
        c.fillStyle = caller.talking ? '#e9e0cc' : 'rgba(233,224,204,0.45)';
        c.font = `${caller.talking ? '700 ' : ''}10.5px ui-monospace, Menlo, monospace`;
        const [a, b] = caller.pair;
        c.fillText(`${a} ⇄ ${b}`, 8, y + ch - 2.5);
      } else if (caller.talking) {
        c.fillStyle = 'rgba(233,224,204,0.22)';
        c.fillRect(labelW, y, gw, Math.max(1, ch - 1.5));
      }
      const blocked = !sim.tasi && caller.circuit < 0;
      for (let j = 0; j < m; j++) {
        const x = labelW + j * cw;
        if (sim.circuits[j] === i) {
          c.fillStyle = colorOf(i);
          c.globalAlpha = 0.92;
          c.fillRect(x + 1, y + 1, Math.max(2, cw - 2), Math.max(2, ch - 3));
          c.globalAlpha = 1;
        } else if (sparse) {
          c.strokeStyle = 'rgba(233,224,204,0.14)';
          c.lineWidth = 1;
          c.strokeRect(x + 1.5, y + 1.5, Math.max(1, cw - 3), Math.max(1, ch - 3));
        }
        if (blocked) { // not placed: slash the whole row once, at its right edge
          if (j === m - 1) {
            c.strokeStyle = 'rgba(255,106,77,0.65)';
            c.beginPath(); c.moveTo(labelW + 4, y + ch / 2); c.lineTo(labelW + gw, y + ch / 2); c.stroke();
          }
        }
      }
      if (caller.clipping) {
        c.fillStyle = '#ff6a4d';
        c.fillRect(labelW + gw + 2, y + 1, 4, Math.max(2, ch - 3));
      }
    }
    if (!labelW) {
      c.fillStyle = 'rgba(233,224,204,0.8)'; c.font = '700 10.5px ui-monospace, Menlo, monospace';
      c.fillText(`${n} calls × ${m} circuits`, 10, MATRIX_H - 8);
    }
  }

  // ---------- report / verdict ----------
  function verdictFor(s) {
    if (!state.sim.tasi) {
      return s.blocked > 0
        ? `Only ${s.circuits} calls fit — ${s.blocked} callers simply cannot be placed.`
        : 'Every call owns a circuit, and most of every circuit is carrying silence.';
    }
    if (s.clippedPct < 0.005) return 'Clean. Silence is doing the switching, and nobody can tell.';
    if (s.clippedPct < 0.02) return 'A word-end clipped here and there — the price of the double-up.';
    if (s.clippedPct < 0.05) return 'Noticeable clipping: the callers are outrunning the circuits.';
    return 'Rush hour: calls are fighting for circuits and losing their word-ends.';
  }

  function updateStats() {
    const s = state.sim.stats();
    $('#stActive').textContent = `${s.active} / ${s.circuits}`;
    $('#stOccupancy').innerHTML = `${Math.round(s.speechOnCircuits * 100)}% <small>of all circuit-time is speech</small>`;
    $('#stClip').innerHTML = s.clipCount
      ? `${(s.clippedPct * 100).toFixed(s.clippedPct < 0.01 ? 2 : 1)}% <small>· ${s.clipCount} clips</small>`
      : 'none';
    $('#stGain').innerHTML = `${s.gain.toFixed(2)}× <small>${s.conversations} calls / ${s.circuits} circuits</small>`;
    $('#stBlockedRow').hidden = !(s.blocked > 0);
    if (s.blocked > 0) $('#stBlocked').textContent = `${s.blocked} of ${s.conversations}`;
    $('#verdict').textContent = verdictFor(s);
    return s;
  }

  // ---------- frame loop ----------
  let lastStamp = null;
  function step(dt) {
    state.clock += dt;
    const before = state.sim.clipCount;
    state.sim.step(dt * 1000);
    if (state.sim.clipCount > before) state.clipFlashes.push({ t: state.clock, x: state.sim.clipCount });

    // emit speech dashes for talking callers that hold a circuit
    if (state.emitTimers.length !== state.sim.circuits.length) {
      state.emitTimers = Array.from({ length: state.sim.circuits.length }, (_, i) => (i % 7) * 0.07);
    }
    for (let j = 0; j < state.sim.circuits.length; j++) {
      const owner = state.sim.circuits[j];
      state.emitTimers[j] -= dt;
      if (owner >= 0 && state.sim.conversations[owner].talking && state.emitTimers[j] <= 0) {
        state.pulses.speech(1, colorOf(owner), j);
        state.emitTimers[j] = 0.42;
      }
    }

    state.pulses.step(dt * 1000, state.crossingS * 1000);
    for (const a of state.pulses.arrived) {
      if (a.kind === 'test' && a.dir > 0) {
        setEcho(state.suppressor
          ? 'Suppressor armed: the far end never launches the echo — nothing comes home.'
          : 'Echo detached at Oban — heading home, 37 ms round trip.');
        if (state.suppressor) state.gateFlashes.push({ t: state.clock, side: 1 });
      } else if (a.kind === 'echo' && a.at === 0) {
        setEcho('Echo heard back at Clarenville: +37 ms. That is what the suppressor removes.');
      } else if (a.kind === 'test' && a.dir < 0 && a.at === 0) {
        setEcho('Test pulse home at Clarenville after a full crossing.');
      }
    }

    state.clipFlashes = state.clipFlashes.filter((f) => state.clock - f.t < 1.6);
    state.gateFlashes = state.gateFlashes.filter((f) => state.clock - f.t < 1.8);
  }

  function draw() { drawOcean(); drawMatrix(); }

  function frame(ts) {
    if (state.autoplay && lastStamp !== null) {
      const dt = Math.min(0.1, (ts - lastStamp) / 1000);
      step(dt);
      draw();
      state.statTick += dt;
      if (state.statTick > 0.25) { state.statTick = 0; updateStats(); }
    } else if (state.autoplay) {
      draw();
    }
    lastStamp = ts;
    requestAnimationFrame(frame);
  }

  function setEcho(text) { state.lastEchoText = text; $('#echoStatus').textContent = text; }

  // ---------- controls ----------
  const PRESETS = {
    day1: { conversations: 35, circuits: 36, activity: 35, tasi: false },
    tasi1960: { conversations: 72, circuits: 37, activity: 35, tasi: true },
    rush: { conversations: 72, circuits: 24, activity: 45, tasi: true },
  };

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    state.sim.activity = p.activity / 100;
    state.sim.tasi = p.tasi;
    state.sim.resize(p.conversations, p.circuits);
    $('#conversations').value = p.conversations;
    $('#circuits').value = p.circuits;
    $('#activity').value = p.activity;
    $('#tasi').checked = p.tasi;
    state.preset = name;
    syncLabels();
    document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('active', b.dataset.preset === name));
    updateStats(); draw();
  }

  function syncLabels() {
    $('#conversationsOut').textContent = `${state.sim.conversations.length} calls`;
    $('#circuitsOut').textContent = `${state.sim.circuits.length} circuits`;
    $('#activityOut').textContent = `${Math.round(state.sim.activity * 100)}% talking`;
  }

  $('#conversations').addEventListener('input', (e) => {
    state.sim.resize(Number(e.target.value), state.sim.circuits.length);
    state.preset = null; clearActive(); syncLabels(); updateStats(); draw();
  });
  $('#circuits').addEventListener('input', (e) => {
    state.sim.resize(state.sim.conversations.length, Number(e.target.value));
    state.preset = null; clearActive(); syncLabels(); updateStats(); draw();
  });
  $('#activity').addEventListener('input', (e) => {
    state.sim.activity = Number(e.target.value) / 100;
    state.preset = null; clearActive(); syncLabels(); updateStats(); draw();
  });
  $('#tasi').addEventListener('change', (e) => {
    state.sim.setTasi(e.target.checked);
    state.preset = null; clearActive(); updateStats(); draw();
  });
  $('#suppressor').addEventListener('change', (e) => {
    state.suppressor = e.target.checked;
    state.pulses.suppressor = state.suppressor;
    setEcho(state.suppressor
      ? 'Suppressor armed — but arm it and remember: it also gates whoever tries to talk back.'
      : 'The far-end hybrid leaks: shout, and hear yourself again 37 ms later.');
  });
  function clearActive() { document.querySelectorAll('[data-preset]').forEach((b) => b.classList.remove('active')); }
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset)));

  $('#shoutE').addEventListener('click', () => shout(1));
  $('#shoutW').addEventListener('click', () => shout(-1));
  function shout(dir) {
    if (state.suppressor && !state.pulses.canLaunch(dir)) {
      // The gated transmitter sits at the caller's own shore: dir>0 blocked at
      // Clarenville (left), dir<0 blocked at Oban (right).
      state.gateFlashes.push({ t: state.clock, side: -dir });
      setEcho(dir < 0
        ? 'Lockout: London cannot get a word in while New York is still talking.'
        : 'Lockout: New York is gated while London still holds the line.');
      return false;
    }
    state.pulses.shout(dir);
    return true;
  }

  // ---------- boot ----------
  buildBackdrop();
  applyPreset('tasi1960');
  requestAnimationFrame(frame);

  // ---------- recorder / test hooks ----------
  window.tat1 = {
    setAutoplay(on) { state.autoplay = !!on; },
    tick(seconds) {
      step(seconds);
      draw();
      return updateStats();
    },
    fastForward(seconds) {
      let left = seconds;
      while (left > 0) { const dt = Math.min(0.05, left); step(dt); left -= dt; }
      updateStats(); draw();
    },
    set(name, value) {
      if (name === 'conversations') $('#conversations').value = value;
      if (name === 'circuits') $('#circuits').value = value;
      if (name === 'activity') $('#activity').value = value;
      if (name === 'tasi') $('#tasi').checked = value;
      if (name === 'suppressor') { $('#suppressor').checked = value; state.suppressor = value; state.pulses.suppressor = value; }
      if (name === 'crossing') state.crossingS = value;
      if (name === 'conversations' || name === 'circuits') {
        state.sim.resize(
          name === 'conversations' ? value : state.sim.conversations.length,
          name === 'circuits' ? value : state.sim.circuits.length);
      }
      if (name === 'activity') state.sim.activity = value / 100;
      if (name === 'tasi') state.sim.setTasi(value);
      state.preset = null; clearActive(); syncLabels(); updateStats(); draw();
    },
    apply: applyPreset,
    shout,
    getState: () => ({
      stats: state.sim.stats(),
      tasi: state.sim.tasi,
      suppressor: state.suppressor,
      preset: state.preset,
      pulses: state.pulses.items.length,
      echoStatus: state.lastEchoText,
      clock: state.clock,
    }),
  };
})();
