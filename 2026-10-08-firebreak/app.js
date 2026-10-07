/* Firebreak — city renderer, wind bench and control surface.
 * Drives firebreakCore and exposes window.firebreak for tests / the video. */
(function () {
  'use strict';
  const C = window.firebreakCore;
  const W = C.GRID_W, H = C.GRID_H, S = 16;          // one cell = 16 canvas px

  const canvas = document.getElementById('city-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = W * S; canvas.height = H * S;

  const chartCanvas = document.getElementById('ember-canvas');
  const chartCtx = chartCanvas.getContext('2d');

  let sim = C.createSim({ seed: 7 });
  let manual = false;
  let blastArmed = true;
  const blastFx = [];                                // transient {cx, cy, t0, backfire}

  // ---- small helpers --------------------------------------------------------
  const hash2 = (x, y) => {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const WINDS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const compass = (bearing) => WINDS[Math.round((((bearing % 360) + 360) % 360) / 22.5) % 16];
  const bearingToScreen = (deg) => ((deg - 90) * Math.PI) / 180;   // toward-bearing → screen angle
  const screenToBearing = (a) => ((a * 180) / Math.PI + 90 + 360) % 360;
  const forceLabel = (w) =>
    w < 8 ? 'CALM' : w < 16 ? 'LIGHT AIR' : w < 25 ? 'FRESH BREEZE' :
    w < 32 ? 'STRONG WIND' : w < 41 ? 'GALE' : 'STORM FORCE';
  const windNote = (w) => {
    if (w < 8) return 'Calm. Sparks rise, cool, and die within a street or two. Any break holds.';
    if (w < 16) return 'A light breeze. Embers reach a block or two downwind — narrow breaks still work.';
    if (w < 25) return 'Fresh wind. Spot fires hop streets faster than any crew can answer.';
    if (w < 32) return 'A strong wind. Ember rain starts to ignore the gaps you cut.';
    if (w < 41) return 'Gale — the real night. Breaks only move the problem downwind.';
    return 'Storm force. The fire makes its own weather; nothing on this map holds.';
  };

  // ---- the city -------------------------------------------------------------
  function render(now) {
    const view = sim.view();
    const state = sim.state();
    const t = now / 1000;

    ctx.fillStyle = '#0c1015';                       // streets / ground
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, kind = view.cells[i];
        if (kind === C.STREET) continue;
        const v = hash2(x, y);
        if (kind === C.WATER) {
          ctx.fillStyle = '#122c42';
          ctx.fillRect(x * S, y * S, S, S);
          if (v > 0.72) {                            // faint moving glints
            const off = (Math.floor(t * 0.7 + v * 9) % 5) * 3;
            ctx.fillStyle = 'rgba(70,120,170,.16)';
            ctx.fillRect(x * S + off, y * S + 5, 5, 1);
          }
        } else if (kind === C.WOOD) {
          const l = 24 + v * 8;
          ctx.fillStyle = `hsl(30 32% ${l}%)`;
          ctx.fillRect(x * S + 0.5, y * S + 0.5, S - 1, S - 1);
        } else if (kind === C.BRICK) {
          const l = 26 + v * 7;
          ctx.fillStyle = `hsl(8 26% ${l}%)`;
          ctx.fillRect(x * S + 0.5, y * S + 0.5, S - 1, S - 1);
        } else if (kind === C.CINDER) {
          ctx.fillStyle = '#1f1b17';
          ctx.fillRect(x * S + 0.5, y * S + 0.5, S - 1, S - 1);
        } else if (kind === C.RUBBLE) {
          ctx.fillStyle = '#3b352b';
          ctx.fillRect(x * S + 0.5, y * S + 0.5, S - 1, S - 1);
        }
      }
    }

    // smoldering ember landings
    for (const [i] of view.smolder) {
      const x = i % W, y = (i / W) | 0;
      ctx.fillStyle = '#47231a';
      ctx.fillRect(x * S + 1, y * S + 1, S - 2, S - 2);
      const pulse = 0.5 + 0.5 * Math.sin(t * 5 + i);
      ctx.fillStyle = `rgba(255,90,40,${0.35 + 0.4 * pulse})`;
      ctx.fillRect(x * S + S / 2 - 1.5, y * S + S / 2 - 1.5, 3, 3);
    }

    // burning cells — brightness by burn progress, flicker by wall clock
    const flick = (i) => 0.82 + 0.36 * hash2(i, Math.floor(t * 9));
    for (const i of view.burning) {
      const x = i % W, y = (i / W) | 0;
      const kind = view.cells[i];
      const full = kind === C.WOOD ? 48 : kind === C.BRICK ? 62.4 : 17;
      const f = Math.max(0, Math.min(1, view.fire[i] / full));  // 1 = just lit
      const hue = 14 + 26 * f * flick(i);
      const light = (30 + 34 * f) * flick(i);
      ctx.fillStyle = `hsl(${hue} 100% ${light}%)`;
      ctx.fillRect(x * S + 0.5, y * S + 0.5, S - 1, S - 1);
    }

    // glow pass
    ctx.globalCompositeOperation = 'lighter';
    const step = view.burning.length > 350 ? 3 : 1;
    let n = 0;
    for (const i of view.burning) {
      if (n++ % step) continue;
      const x = i % W, y = (i / W) | 0;
      ctx.fillStyle = 'rgba(255,96,28,.05)';
      ctx.fillRect((x - 1) * S, (y - 1) * S, S * 3, S * 3);
    }
    ctx.globalCompositeOperation = 'source-over';

    // ember flights — arcs keyed to the sim clock so manual capture stays honest
    const clock = state.clockMin;
    for (const e of view.embers) {
      const age = clock - e.born;
      if (age < 0) continue;
      const u = Math.min(1, age / e.flight);
      const ease = u * u * (3 - 2 * u);
      const mx = (e.x0 + e.x1) / 2, my = (e.y0 + e.y1) / 2;
      const dist = Math.hypot(e.x1 - e.x0, e.y1 - e.y0);
      const cx = mx, cy = my - dist * 0.22;
      const bx = (1 - ease) * (1 - ease) * e.x0 + 2 * (1 - ease) * ease * cx + ease * ease * e.x1;
      const by = (1 - ease) * (1 - ease) * e.y0 + 2 * (1 - ease) * ease * cy + ease * ease * e.y1;
      const pu = Math.max(0, ease - 0.1);
      const px = (1 - pu) * (1 - pu) * e.x0 + 2 * (1 - pu) * pu * cx + pu * pu * e.x1;
      const py = (1 - pu) * (1 - pu) * e.y0 + 2 * (1 - pu) * pu * cy + pu * pu * e.y1;
      if (u < 1) {
        ctx.strokeStyle = 'rgba(255,170,80,.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(px * S, py * S); ctx.lineTo(bx * S, by * S); ctx.stroke();
        ctx.fillStyle = '#ffd08a';
        ctx.fillRect(bx * S - 1.2, by * S - 1.2, 2.4, 2.4);
      } else if (e.spot && age < e.flight + 0.7) {
        const a = 1 - (age - e.flight) / 0.7;
        ctx.fillStyle = `rgba(255,110,60,${a})`;
        ctx.beginPath(); ctx.arc(e.x1 * S, e.y1 * S, 2.5 + 3 * (1 - a), 0, 7); ctx.fill();
      }
    }

    // blast rings + backfire stamps (transient, wall clock)
    for (let k = blastFx.length - 1; k >= 0; k--) {
      const fx = blastFx[k], age = (now - fx.t0) / 600;
      if (age > 1) { blastFx.splice(k, 1); continue; }
      ctx.strokeStyle = `rgba(233,193,106,${0.9 - age})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.cx * S, fx.cy * S, (0.4 + 2.1 * age) * S, 0, 7);
      ctx.stroke();
      if (fx.backfire) {
        ctx.fillStyle = `rgba(226,80,60,${1 - age})`;
        ctx.font = '700 11px ui-monospace, Menlo, monospace';
        ctx.fillText('BACKFIRE', fx.cx * S + 14, fx.cy * S - 10);
      }
    }

    // labels
    ctx.font = '600 10px ui-monospace, Menlo, monospace';
    const LABELS = [
      { t: 'LAKE MICHIGAN', x: 59.6, y: 30, rot: 90, c: 'rgba(120,165,205,.6)' },
      { t: 'NORTH BRANCH', x: 35.6, y: 7.5, rot: -80, c: 'rgba(120,165,205,.55)' },
      { t: 'MAIN STEM', x: 42.5, y: 18.2, c: 'rgba(120,165,205,.55)' },
      { t: 'SOUTH BRANCH', x: 17.8, y: 27.5, rot: -44, c: 'rgba(120,165,205,.55)' },
      { t: 'THE LOOP', x: 41.5, y: 9.6, c: 'rgba(210,220,240,.55)' },
      { t: 'WATER WORKS ▴', x: 44.2, y: 2.3, c: 'rgba(190,200,220,.55)' },
    ];
    for (const L of LABELS) {
      ctx.save();
      ctx.translate(L.x * S, L.y * S);
      if (L.rot) ctx.rotate((L.rot * Math.PI) / 180);
      ctx.fillStyle = L.c;
      ctx.fillText(L.t, 0, 0);
      ctx.restore();
    }

    // the barn, before the match
    if (state.phase === 'ready') {
      const o = C.ORIGIN;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      ctx.strokeStyle = `rgba(233,164,107,${0.45 + 0.45 * pulse})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc((o.x + 0.5) * S, (o.y + 0.5) * S, 8 + 3 * pulse, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(233,164,107,.85)';
      ctx.fillText('DE KOVEN ST', (o.x - 1.2) * S, (o.y + 2.3) * S);
    }

    // wind instrument, top left
    ctx.fillStyle = 'rgba(10,14,19,.78)';
    ctx.strokeStyle = '#2a3542';
    ctx.lineWidth = 1;
    roundRect(ctx, 10, 10, 168, 58, 5); ctx.fill(); ctx.stroke();
    const state2 = sim.state();
    drawWindRose(ctx, 40, 39, state2.windSpeed, state2.windDir);
    ctx.fillStyle = '#e7e3d5';
    ctx.font = '700 13px ui-monospace, Menlo, monospace';
    ctx.fillText(`${state2.windSpeed} MPH`, 74, 33);
    ctx.fillStyle = '#8b93a0';
    ctx.font = '600 8.5px ui-monospace, Menlo, monospace';
    const fromB = (screenToBearing(state2.windDir) + 180) % 360;
    ctx.fillText(`${forceLabel(state2.windSpeed)} FROM THE ${compass(fromB)}`, 74, 50);

    // firestorm banner
    if (state2.firestorm) {
      ctx.fillStyle = `rgba(226,80,60,${0.65 + 0.3 * Math.sin(t * 6)})`;
      ctx.font = '700 12px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('⚑ THE FIRE MAKES ITS OWN WIND', canvas.width - 14, 26);
      ctx.textAlign = 'left';
    }

    updateHUD(state);
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function drawWindRose(c, x, y, speed, dir) {
    c.strokeStyle = '#e9c46a'; c.lineWidth = 2;
    const r = 17, len = r * Math.min(1, 0.35 + speed / 55);
    const dx = Math.cos(dir), dy = Math.sin(dir);
    c.beginPath(); c.moveTo(x - dx * len * 0.45, y - dy * len * 0.45); c.lineTo(x + dx * len, y + dy * len); c.stroke();
    // arrowhead
    const hx = x + dx * len, hy = y + dy * len;
    c.beginPath();
    c.moveTo(hx, hy);
    c.lineTo(hx - dx * 7 - dy * 4.5, hy - dy * 7 + dx * 4.5);
    c.moveTo(hx, hy);
    c.lineTo(hx - dx * 7 + dy * 4.5, hy - dy * 7 - dx * 4.5);
    c.stroke();
    c.strokeStyle = 'rgba(233,196,106,.3)'; c.lineWidth = 1;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
  }

  // ---- HUD / verdict --------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  function updateHUD(s) {
    $('clock').textContent = C.clockLabel(s.clockMin);
    const real = Math.round(s.percent * 17500);
    $('destroyed').textContent = `≈ ${real.toLocaleString('en-US')} / 17,500`;
    $('destroyed-pct').textContent = `${(s.percent * 100).toFixed(1)}%`;
    $('spot').textContent = s.spotFires;
    $('powder').textContent = `${s.blastsLeft} CHARGES`;
    $('storm-chip').classList.toggle('lit', s.firestormEver);
    $('ignite').disabled = s.phase !== 'ready';
    $('rain').disabled = s.phase !== 'burning';
    $('reset').disabled = false;
    const v = $('verdict');
    if (s.phase === 'ended') {
      v.hidden = false;
      const title = s.percent < 0.12 ? 'THE CITY LIVES.'
        : s.percent < 0.35 ? 'HALF OF CHICAGO.'
        : 'CHICAGO BURNS.';
      $('verdict-title').textContent = title;
      $('verdict-sub').textContent =
        `${C.clockLabel(s.clockMin)} — ${s.rained ? 'the rain' : 'the last fuel'} ended it. ` +
        `≈ ${Math.round(s.percent * 17500).toLocaleString('en-US')} of 17,500 buildings, ` +
        `${s.spotFires} spot fires, ${s.blasts} blasts (${s.backfires} backfired).`;
      v.classList.toggle('bad', s.percent >= 0.35);
      v.classList.toggle('mid', s.percent >= 0.12 && s.percent < 0.35);
    } else {
      v.hidden = true;
    }
  }

  // ---- ember chart ----------------------------------------------------------
  function drawChart() {
    const s = sim.state();
    const p = C.emberProfile(s.windSpeed);
    const cw = chartCanvas.width, ch = chartCanvas.height;
    chartCtx.clearRect(0, 0, cw, ch);
    const x0 = 34, x1 = cw - 10, y0 = 18, y1 = ch - 24;
    const n = p.bars.length;
    const bw = (x1 - x0) / n;
    chartCtx.fillStyle = '#e9c46a';
    for (let i = 0; i < n; i++) {
      const h = p.bars[i] * (y1 - y0);
      chartCtx.fillRect(x0 + i * bw + 1, y1 - h, bw - 2, h);
    }
    // marks: the river and a wide two-blast break
    const mark = (cells, label, col) => {
      const x = x0 + (cells / n) * (x1 - x0);
      chartCtx.strokeStyle = col; chartCtx.setLineDash([4, 3]); chartCtx.lineWidth = 1;
      chartCtx.beginPath(); chartCtx.moveTo(x, y0 - 4); chartCtx.lineTo(x, y1); chartCtx.stroke();
      chartCtx.setLineDash([]);
      chartCtx.fillStyle = col; chartCtx.font = '600 8.5px ui-monospace, Menlo, monospace';
      chartCtx.textAlign = x > x1 - 60 ? 'right' : 'left';
      chartCtx.fillText(label, x + (x > x1 - 60 ? -4 : 4), y0 + 2);
      chartCtx.textAlign = 'left';
    };
    mark(C.RIVER_CELLS, 'THE RIVER', '#7ab3e8');
    mark(5.5, 'A WIDE BREAK', '#8b93a0');
    chartCtx.strokeStyle = '#2a3542';
    chartCtx.beginPath(); chartCtx.moveTo(x0, y1); chartCtx.lineTo(x1, y1); chartCtx.stroke();
    chartCtx.fillStyle = '#5f6b79'; chartCtx.font = '600 8px ui-monospace, Menlo, monospace';
    for (let i = 0; i <= n; i += 3) {
      const x = x0 + (i / n) * (x1 - x0);
      chartCtx.fillText(String(i), x - 2, y1 + 12);
    }
    chartCtx.fillText('BLOCKS DOWNWIND →', x0, ch - 2);
    $('ember-reach').textContent = `${(p.mean / 3).toFixed(1)} BLOCKS`;
    $('ember-cross').textContent = `${Math.round(p.crossP * 100)}%`;
    $('ember-note').textContent = windNote(s.windSpeed);
  }

  // ---- controls -------------------------------------------------------------
  function applyWind() {
    const speed = Number($('wind-speed').value);
    const deg = Number($('wind-dir').value);
    sim.set({ windSpeed: speed, windDir: bearingToScreen(deg) });
    $('wind-speed-read').textContent = `${speed} MPH — ${forceLabel(speed)}`;
    $('wind-dir-read').textContent = `TOWARD ${compass(deg)} · FROM ${compass(deg + 180)}`;
    $('wind-arrow').style.transform = `rotate(${deg}deg)`;
    drawChart();
  }
  $('wind-speed').addEventListener('input', applyWind);
  $('wind-dir').addEventListener('input', applyWind);

  $('ignite').addEventListener('click', () => { sim.ignite(); blastArmed = true; syncTool(); });
  $('reset').addEventListener('click', () => {
    sim = sim.reset();
    blastFx.length = 0;
    syncTool(); updateHUD(sim.state());
  });
  $('rain').addEventListener('click', () => sim.rainNow());
  $('blast-tool').addEventListener('click', () => { blastArmed = !blastArmed; syncTool(); });
  function syncTool() {
    $('blast-tool').setAttribute('aria-pressed', String(blastArmed));
    canvas.classList.toggle('blasting', blastArmed);
  }
  for (const [id, spd] of [['speed-pause', 0], ['speed-1', 1], ['speed-3', 3]]) {
    $(id).addEventListener('click', () => {
      sim.set({ speed: spd });
      for (const [oid] of [['speed-pause'], ['speed-1'], ['speed-3']]) {
        $(oid).setAttribute('aria-pressed', String($(oid) === $(id)));
      }
    });
  }

  // blasting by pointer: one charge per building cluster entered
  let pointerDown = false, lastCell = null;
  const cellOf = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
    };
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (!blastArmed) return;
    pointerDown = true;
    canvas.setPointerCapture(e.pointerId);
    const c = cellOf(e); lastCell = `${Math.round(c.x)},${Math.round(c.y)}`;
    api.blast(c.x, c.y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointerDown || !blastArmed) return;
    const c = cellOf(e), key = `${Math.round(c.x)},${Math.round(c.y)}`;
    if (key !== lastCell) { lastCell = key; api.blast(c.x, c.y); }
  });
  canvas.addEventListener('pointerup', () => { pointerDown = false; lastCell = null; });
  canvas.addEventListener('pointercancel', () => { pointerDown = false; lastCell = null; });

  // ---- loop + public API ----------------------------------------------------
  let last = performance.now();
  function frame(now) {
    if (!manual) sim.tick(Math.min(0.1, (now - last) / 1000));
    last = now;
    render(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const api = {
    useManualClock() { manual = true; },
    set(patch = {}) {
      if (patch.windSpeed !== undefined) { $('wind-speed').value = patch.windSpeed; }
      if (patch.windDir !== undefined) { $('wind-dir').value = patch.windDir; }
      if (patch.speed !== undefined) sim.set({ speed: patch.speed });
      applyWind();
      return api.getState();
    },
    ignite: () => { const r = sim.ignite(); render(performance.now()); return r; },
    blast(cx, cy) {
      const r = sim.blast(cx, cy);
      if (r.ok) blastFx.push({ cx, cy, t0: performance.now(), backfire: !!r.backfire });
      return r;
    },
    rainNow: () => { const r = sim.rainNow(); render(performance.now()); return r; },
    reset(seed) { sim = sim.reset(seed); blastFx.length = 0; render(performance.now()); return api.getState(); },
    tick(dtSec) { const s = sim.tick(dtSec); render(performance.now()); return s; },
    getState: () => sim.state(),
    emberProfile: (speed) => C.emberProfile(speed ?? sim.state().windSpeed),
  };
  window.firebreak = api;

  // initial paint
  $('wind-speed').value = 32; $('wind-dir').value = 45;
  applyWind();
  syncTool();
  updateHUD(sim.state());
  render(performance.now());
})();
