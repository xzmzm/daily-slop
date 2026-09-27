/* app.js — draws the plate, runs the clock, and exposes window.plate. */

'use strict';

(() => {
  const N = GRID;
  const sim = createSim({ seed: 11, script: SCRIPT_1928, mutations: true });

  const dish = document.getElementById('dish');
  const dctx = dish.getContext('2d');
  const cellCanvas = document.createElement('canvas');
  cellCanvas.width = N; cellCanvas.height = N;
  const cctx = cellCanvas.getContext('2d');
  const img = cctx.createImageData(N, N);
  const px = img.data;

  const els = {
    date: document.getElementById('ro-date'),
    tempOut: document.getElementById('ro-temp'),
    verdict: document.getElementById('ro-verdict'),
    event: document.getElementById('event-line'),
    mold: document.getElementById('ro-mold'),
    zone: document.getElementById('ro-zone'),
    cov: document.getElementById('ro-cov'),
    res: document.getElementById('ro-res'),
    slider: document.getElementById('temp'),
    mutate: document.getElementById('mutate'),
    pause: document.getElementById('btn-pause'),
    luck: Array.from(document.querySelectorAll('#luck li')),
  };

  const state = {
    playing: false,          // wall-clock autoplay
    speed: 3,                // sim-days per wall second
    dayPerSec: 3,
    manual: false,           // temperature taken over by the slider
  };

  // --- painting the plate ----------------------------------------------------
  const AGAR = [233, 220, 188], STAPH = [193, 168, 101], STAPH_HI = [170, 141, 73];
  const MOLD_EDGE = [240, 236, 219], MOLD_BODY = [128, 158, 122], MOLD_DEEP = [92, 126, 95];
  const RESIST = [176, 118, 45];

  function paint() {
    const { b, tol, m, p } = sim.fields;
    const sp = sim.spore;
    const gr = sim.grain;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i, o = k * 4;
        if (!sim.inDish[k]) { px[o + 3] = 0; continue; }
        const g = gr[k] - 0.5;
        let r = AGAR[0] + g * 9, gg = AGAR[1] + g * 9, bl = AGAR[2] + g * 9;

        const bk = b[k];
        if (bk > 0) {
          // creamy golden lawn, denser where thicker, faint grain through it
          const t = Math.min(1, bk);
          const hi = t * t;
          r += (STAPH[0] + hi * (STAPH_HI[0] - STAPH[0]) - AGAR[0] + g * 8) * t;
          gg += (STAPH[1] + hi * (STAPH_HI[1] - STAPH[1]) - AGAR[1] + g * 8) * t;
          bl += (STAPH[2] + hi * (STAPH_HI[2] - STAPH[2]) - AGAR[2] + g * 8) * t;
          if (tol[k] >= 1.8 && bk >= 0.3) {
            // resistant survivors stand out against the clear halo
            r += (RESIST[0] - r) * 0.55; gg += (RESIST[1] - gg) * 0.55; bl += (RESIST[2] - bl) * 0.55;
          }
        }

        const mk = m[k];
        if (mk > 0) {
          // velvety colony: white fringe, blue-green body, radial bands
          let cr, cg, cb;
          if (mk < 0.35) {
            const t = mk / 0.35;
            cr = MOLD_EDGE[0] + (MOLD_BODY[0] - MOLD_EDGE[0]) * t;
            cg = MOLD_EDGE[1] + (MOLD_BODY[1] - MOLD_EDGE[1]) * t;
            cb = MOLD_EDGE[2] + (MOLD_BODY[2] - MOLD_EDGE[2]) * t;
          } else {
            const t = (mk - 0.35) / 0.65;
            cr = MOLD_BODY[0] + (MOLD_DEEP[0] - MOLD_BODY[0]) * t;
            cg = MOLD_BODY[1] + (MOLD_DEEP[1] - MOLD_BODY[1]) * t;
            cb = MOLD_BODY[2] + (MOLD_DEEP[2] - MOLD_BODY[2]) * t;
          }
          let band = 1;
          if (sp) {
            const ang = Math.atan2(j - sp.j, i - sp.i);
            band = 0.90 + 0.10 * Math.sin(ang * 14 + gr[k] * 3.1);
          }
          const fuzz = 0.92 + 0.08 * (gr[k] * 2);
          const w = Math.min(1, mk * 1.4);
          r += (cr * band * fuzz - r) * w;
          gg += (cg * band * fuzz - gg) * w;
          bl += (cb * band * fuzz - bl) * w;
        }

        px[o] = Math.max(0, Math.min(255, r));
        px[o + 1] = Math.max(0, Math.min(255, gg));
        px[o + 2] = Math.max(0, Math.min(255, bl));
        px[o + 3] = 255;
      }
    }
    cctx.putImageData(img, 0, 0);

    const W = dish.width;
    dctx.clearRect(0, 0, W, W);
    // agar disc with a soft shadow inside the glass
    dctx.save();
    dctx.beginPath();
    dctx.arc(W / 2, W / 2, W / 2 * 0.985, 0, Math.PI * 2);
    dctx.clip();
    dctx.imageSmoothingEnabled = true;
    dctx.imageSmoothingQuality = 'high';
    dctx.drawImage(cellCanvas, 0, 0, W, W);
    const sh = dctx.createRadialGradient(W / 2, W / 2, W * 0.30, W / 2, W / 2, W * 0.5);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(30,22,8,0.14)');
    dctx.fillStyle = sh;
    dctx.fillRect(0, 0, W, W);
    dctx.restore();

    // glass rim and a glare arc
    dctx.lineWidth = W * 0.010;
    dctx.strokeStyle = 'rgba(226,216,188,0.6)';
    dctx.beginPath();
    dctx.arc(W / 2, W / 2, W / 2 * 0.985, 0, Math.PI * 2);
    dctx.stroke();
    dctx.lineWidth = W * 0.012;
    dctx.strokeStyle = 'rgba(20,14,6,0.28)';
    dctx.beginPath();
    dctx.arc(W / 2, W / 2, W / 2 * 0.965, 0, Math.PI * 2);
    dctx.stroke();
    dctx.lineWidth = W * 0.020;
    dctx.strokeStyle = 'rgba(255,248,224,0.18)';
    dctx.beginPath();
    dctx.arc(W / 2, W / 2, W / 2 * 0.90, Math.PI * 1.06, Math.PI * 1.38);
    dctx.stroke();
  }

  // --- the growth-curve chart -------------------------------------------------
  const chart = document.getElementById('chart');
  const ch = chart.getContext('2d');
  const CROSS = crossoverTemp();
  function paintChart() {
    const W = chart.width, H = chart.height;
    ch.clearRect(0, 0, W, H);
    const T0 = 14, T1 = 40, x = (t) => ((t - T0) / (T1 - T0)) * (W - 46) + 38;
    const yMax = 3.6, y = (v) => H - 26 - (v / yMax) * (H - 46);

    ch.strokeStyle = '#d9cba4'; ch.lineWidth = 1;
    ch.beginPath(); ch.moveTo(38, 14); ch.lineTo(38, H - 26); ch.lineTo(W - 8, H - 26); ch.stroke();
    ch.fillStyle = '#8a7a58'; ch.font = '24px Georgia, serif'; ch.textAlign = 'center';
    for (const t of [15, 20, 25, 30, 35, 40]) {
      ch.fillText(t + '°', x(t), H - 6);
      ch.strokeStyle = 'rgba(217,203,164,0.5)';
      ch.beginPath(); ch.moveTo(x(t), 14); ch.lineTo(x(t), H - 26); ch.stroke();
    }

    // the crossover: below it the mold wins, above it the staph wins
    ch.fillStyle = 'rgba(94,127,99,0.10)';
    ch.fillRect(38, 14, x(CROSS) - 38, H - 40);
    ch.fillStyle = 'rgba(196,172,106,0.16)';
    ch.fillRect(x(CROSS), 14, W - 8 - x(CROSS), H - 40);

    const curves = [
      [moldRate, '#4c7057', '青霉'],
      [staphRate, '#a3823c', '葡萄球菌'],
    ];
    for (const [f, color] of curves) {
      ch.strokeStyle = color; ch.lineWidth = 3.5;
      ch.beginPath();
      for (let px_ = 0; px_ <= W - 46; px_++) {
        const t = T0 + (px_ / (W - 46)) * (T1 - T0);
        const py = y(f(t));
        if (px_ === 0) ch.moveTo(38 + px_, py); else ch.lineTo(38 + px_, py);
      }
      ch.stroke();
    }
    ch.fillStyle = '#4c7057'; ch.textAlign = 'left'; ch.font = '27px Georgia, serif';
    ch.fillText('青霉', x(15.2), y(moldRate(15.2)) - 16);
    ch.fillStyle = '#a3823c';
    ch.fillText('葡萄球菌', x(31.2), y(staphRate(31.2)) - 16);

    ch.strokeStyle = '#7d3c14'; ch.lineWidth = 2.5; ch.setLineDash([6, 5]);
    ch.beginPath(); ch.moveTo(x(CROSS), 14); ch.lineTo(x(CROSS), H - 26); ch.stroke();
    ch.setLineDash([]);
    ch.fillStyle = '#7d3c14'; ch.textAlign = 'center'; ch.font = '23px Georgia, serif';
    ch.fillText('交叉 ' + CROSS.toFixed(1) + ' °C', x(CROSS), 34);

    const T = sim.temp;
    ch.fillStyle = '#33291d';
    ch.beginPath(); ch.arc(x(T), H - 26, 6, 0, Math.PI * 2); ch.fill();
    ch.beginPath(); ch.arc(x(T), H - 26, 11, 0, Math.PI * 2);
    ch.strokeStyle = 'rgba(51,41,29,0.4)'; ch.lineWidth = 2; ch.stroke();
  }

  // --- readouts ---------------------------------------------------------------
  function fmt(n, unit) { return n == null ? '—' : n.toFixed(0) + unit; }

  function verdictFor(s) {
    if (!s.spore) return ['培养皿在长凳上等着', ''];
    if (!s.germinated) return ['孢子还在休眠', ''];
    if (sim.temp > 30 && s.moldMm < 6) return ['太热了：青霉不长，青霉素也停了——机会窗口关上了', 'bad'];
    if (s.haloMm > 3.5) return ['抑菌圈 ⌀ ' + s.zoneMm.toFixed(0) + ' mm——弗莱明凑近看到的，就是这一圈', 'good'];
    if (s.coverage > 0.9) return ['细菌铺满全皿，没有奇迹', 'bad'];
    return ['培养中……', ''];
  }

  function currentEvent(day) {
    let ev = null;
    for (const e of SCRIPT_1928.events) if (day >= e.day) ev = e;
    return ev;
  }

  function refresh() {
    const s = sim.stats();
    sim.noteHeadStart(s);
    els.date.value = s.dateLabel;
    els.tempOut.textContent = s.temp.toFixed(1) + ' °C';
    els.slider.value = sim.temp;
    const [text, cls] = verdictFor(s);
    els.verdict.textContent = text;
    els.verdict.className = 'ro ro-verdict' + (cls ? ' ' + cls : '');
    els.mold.value = s.germinated ? s.moldMm.toFixed(0) + ' mm' : '—';
    els.zone.value = s.haloMm > 1 ? s.zoneMm.toFixed(0) + ' mm（圈宽 ' + s.haloMm.toFixed(0) + '）' : '—';
    els.cov.value = (s.coverage * 100).toFixed(0) + ' %';
    els.res.value = s.resistantCells > 0 ? s.resistantCells + ' 个' : '尚无';

    const ev = sim.script ? currentEvent(sim.day) : null;
    if (sim.script && sim.day > SCRIPT_1928.observeDay + 2) {
      els.event.textContent = '剧本演完了：皿还留在长凳上，青霉素继续往外渗。拖温度滑块接着做实验。';
      els.event.className = 'event-line';
    } else if (ev) { els.event.textContent = ev.label; els.event.className = 'event-line pinned'; }
    else { els.event.textContent = '手动模式：温度由滑块决定。'; els.event.className = 'event-line'; }

    const bench = !sim.script ? sim.temp < 31 : true;
    const luck = { bench, spore: !!s.spore, snap: s.headStart };
    for (const li of els.luck) li.classList.toggle('on', !!luck[li.dataset.k]);
    paintChart();
  }

  // --- clock ------------------------------------------------------------------
  function tick(days) {
    sim.step(days);
    sim.noteHeadStart(sim.stats());
    paint(); refresh();
    return sim.stats();
  }

  let last = null;
  function frame(now) {
    if (state.playing && last != null) {
      const dt = Math.min(0.1, (now - last) / 1000);
      sim.step(dt * state.dayPerSec);
    }
    last = now;
    paint();
    refresh();
    requestAnimationFrame(frame);
  }

  // --- controls ----------------------------------------------------------------
  function replay() {
    sim.inoculate();
    sim.script = SCRIPT_1928;
    sim.dropSpore(N * 0.40, N * 0.58, SCRIPT_1928.sporeDay);
    state.manual = false;
    state.playing = true;
    els.pause.textContent = '⏸ 暂停';
  }

  function skipTo(target) {
    const end = typeof target === 'number' ? target : SCRIPT_1928.observeDay;
    while (sim.day < end) {
      sim.step(Math.min(0.25, end - sim.day));
      sim.noteHeadStart(sim.stats()); // the cold-snap window must be caught in passing
    }
    paint(); refresh();
  }

  document.getElementById('btn-replay').addEventListener('click', replay);
  els.pause.addEventListener('click', () => {
    state.playing = !state.playing;
    els.pause.textContent = state.playing ? '⏸ 暂停' : '▶ 继续';
  });
  document.getElementById('btn-skip').addEventListener('click', () => {
    if (sim.day >= SCRIPT_1928.observeDay) replay();
    state.playing = false; els.pause.textContent = '▶ 继续';
    skipTo(SCRIPT_1928.observeDay);
  });
  document.getElementById('btn-restreak').addEventListener('click', () => {
    sim.inoculate();
    sim.script = null;
    sim.temp = parseFloat(els.slider.value);
    state.manual = true; state.playing = true;
    els.pause.textContent = '⏸ 暂停';
  });
  for (const b of document.querySelectorAll('#speed-seg button')) {
    b.addEventListener('click', () => {
      state.dayPerSec = parseFloat(b.dataset.speed);
      document.querySelectorAll('#speed-seg button').forEach((x) => x.classList.toggle('on', x === b));
    });
  }
  els.slider.addEventListener('input', () => {
    sim.script = null;
    sim.temp = parseFloat(els.slider.value);
    state.manual = true;
    if (!sim.spore) sim.dropSpore(N * 0.44, N * 0.52);
    state.playing = true;
    els.pause.textContent = '⏸ 暂停';
  });
  els.mutate.addEventListener('change', () => { sim.mutations = els.mutate.checked; });

  dish.addEventListener('click', (e) => {
    const r = dish.getBoundingClientRect();
    const i = ((e.clientX - r.left) / r.width) * N;
    const j = ((e.clientY - r.top) / r.height) * N;
    if (sim.dropSpore(i, j)) { sim.script = null; state.manual = true; }
    paint(); refresh();
  });

  // --- boot: open on what Fleming saw, then let the user replay it --------------
  sim.dropSpore(N * 0.40, N * 0.58, SCRIPT_1928.sporeDay);
  skipTo(SCRIPT_1928.observeDay);
  state.playing = false;
  els.pause.textContent = '▶ 继续';
  requestAnimationFrame(frame);

  // video / test hook: tick(days) steps AND renders synchronously
  window.plate = {
    sim, state, replay, skipTo, tick,
    setAutoplay(v) { state.playing = v; els.pause.textContent = v ? '⏸ 暂停' : '▶ 继续'; },
    setDayPerSec(v) { state.dayPerSec = v; },
    setMutations(v) { sim.mutations = v; els.mutate.checked = v; },
    setTemp(T) { sim.script = null; sim.temp = T; els.slider.value = T; state.manual = true; },
    paint, refresh,
  };
})();
