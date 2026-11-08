(function (root) {
  'use strict';
  const model = root.XrayModel;
  const $ = (id) => document.getElementById(id);

  const bench = $('bench'), benchCtx = bench.getContext('2d');
  const plate = $('plate'), plateCtx = plate.getContext('2d');

  const state = {
    mode: 'idle',            // idle | exposing | fixed
    object: 'book', kvp: 40, ma: 4, cover: true,
    mAs: 0, grade: null, data: model.buildMaps('book'),
  };

  // ---- deterministic-ish grain: one stream, re-seeded per plate -----------
  let seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  function rng() {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  let spare = null;
  function randn() {
    if (spare !== null) { const v = spare; spare = null; return v; }
    const u = Math.max(rng(), 1e-12), v = rng();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }
  function sampleCount(lam) {
    if (lam <= 0) return 0;
    if (lam < 20) {
      let L = Math.exp(-lam), k = 0, p = 1;
      do { k++; p *= rng(); } while (p > L);
      return k - 1;
    }
    return Math.max(0, Math.round(lam + Math.sqrt(lam) * randn()));
  }

  // Transmission of every plate pixel for the current object at current kVp.
  const tCache = new Map();
  function transmissionField() {
    const key = state.object + '@' + state.kvp;
    let field = tCache.get(key);
    if (field) return field;
    if (tCache.size > 12) tCache.clear();
    const {maps} = state.data;
    const keys = Object.keys(maps);
    field = new Float32Array(model.PLATE_W * model.PLATE_H);
    for (let i = 0; i < field.length; i++) {
      let tau = 0;
      for (const k of keys) tau += model.muAt(k, state.kvp) * maps[k].map[i];
      field[i] = Math.exp(-tau);
    }
    tCache.set(key, field);
    return field;
  }

  const subject = () => state.data.pair ? state.data.major.concat(state.data.minor) : state.data.solid;
  const FILM_SATURATION = 140, DMAX = 0.96, BASE_FOG = 0.045;

  function renderPlate() {
    const w = model.PLATE_W, h = model.PLATE_H;
    const field = transmissionField();
    const flux = model.fluxAt(state.kvp);
    const image = plateCtx.createImageData(w, h);
    const px = image.data;
    for (let i = 0; i < field.length; i++) {
      const n = sampleCount(flux * state.mAs * field[i]);
      const dark = DMAX * (1 - Math.exp(-n / FILM_SATURATION)) + BASE_FOG;
      const v = Math.max(0, Math.min(255, Math.round(255 * (1 - dark))));
      const o = i * 4;
      px[o] = v; px[o + 1] = Math.round(v * 0.985); px[o + 2] = Math.round(v * 0.94); px[o + 3] = 255;
    }
    plateCtx.putImageData(image, 0, 0);
  }

  // ---- the bench scene -----------------------------------------------------
  const TUBE = {x: 148, y: 392}, STAGE = {x: 470, y: 300}, SCREEN = {x: 806, y: 286, w: 150, h: 170};

  const silhouettes = new Map();
  function silhouette(objectKey) {
    let cnv = silhouettes.get(objectKey);
    if (cnv) return cnv;
    const {maps} = model.buildMaps(objectKey);
    cnv = document.createElement('canvas');
    cnv.width = model.PLATE_W; cnv.height = model.PLATE_H;
    const c = cnv.getContext('2d');
    const img = c.createImageData(model.PLATE_W, model.PLATE_H);
    for (let i = 0; i < model.PLATE_W * model.PLATE_H; i++) {
      let any = false;
      for (const k of Object.keys(maps)) if (maps[k].map[i] > 0) { any = true; break; }
      if (!any) continue;
      img.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    silhouettes.set(objectKey, cnv);
    return cnv;
  }

  function glowLevel() {
    // Brightness of the barium screen: tube output × tube current, and the
    // room is dark, so even a faint glow reads clearly against black.
    const g = 0.0018 * model.fluxAt(state.kvp) * state.ma;
    return Math.max(0, Math.min(1, g));
  }

  function glowWord(g) {
    return g < 0.06 ? 'none' : g < 0.22 ? 'faint' : g < 0.5 ? 'steady' : g < 0.8 ? 'bright' : 'blazing';
  }

  function renderBench(now) {
    const ctx = benchCtx;
    ctx.clearRect(0, 0, bench.width, bench.height);
    // room
    ctx.fillStyle = '#101215'; ctx.fillRect(0, 0, bench.width, bench.height);
    const ambient = state.cover ? 0 : 1;
    if (ambient) {
      const lamp = ctx.createRadialGradient(500, 60, 10, 500, 60, 620);
      lamp.addColorStop(0, 'rgba(120,110,80,0.10)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lamp; ctx.fillRect(0, 0, bench.width, bench.height);
    }
    // bench top
    ctx.fillStyle = ambient ? '#241f19' : '#1a1713';
    ctx.fillRect(60, 468, bench.width - 120, 26);
    ctx.strokeStyle = 'rgba(233,228,212,0.12)'; ctx.strokeRect(60.5, 468.5, bench.width - 121, 25);

    // dashed beam axis: a diagram affordance, the rays themselves are invisible
    ctx.save();
    ctx.setLineDash([2, 7]);
    ctx.strokeStyle = 'rgba(233,228,212,0.16)';
    ctx.beginPath(); ctx.moveTo(TUBE.x + 66, TUBE.y); ctx.lineTo(SCREEN.x, TUBE.y); ctx.stroke();
    ctx.restore();

    // tube (or its cardboard box)
    ctx.save();
    if (state.cover) {
      ctx.fillStyle = '#3b3023';
      roundRect(ctx, TUBE.x - 62, TUBE.y - 66, 128, 132, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(201,162,39,0.5)'; ctx.stroke();
      ctx.fillStyle = 'rgba(201,162,39,0.75)';
      ctx.font = '10px ui-monospace,monospace'; ctx.textAlign = 'center';
      ctx.fillText('BLACK CARDBOARD', TUBE.x, TUBE.y + 4);
    } else {
      const glass = ctx.createRadialGradient(TUBE.x, TUBE.y, 6, TUBE.x, TUBE.y, 62);
      glass.addColorStop(0, 'rgba(143,208,124,0.55)');
      glass.addColorStop(0.45, 'rgba(90,140,160,0.22)');
      glass.addColorStop(1, 'rgba(90,140,160,0.05)');
      ctx.fillStyle = glass;
      ctx.beginPath(); ctx.ellipse(TUBE.x, TUBE.y, 62, 58, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(233,228,212,0.3)'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,244,180,0.8)';
      ctx.beginPath(); ctx.arc(TUBE.x - 34, TUBE.y, 7, 0, Math.PI * 2); ctx.fill(); // cathode glow
      ctx.fillStyle = 'rgba(233,228,212,0.55)'; ctx.textAlign = 'center';
      ctx.font = '10px ui-monospace,monospace';
      ctx.fillText('CROOKES TUBE', TUBE.x, TUBE.y + 84);
    }
    ctx.restore();

    // stage with the object (silhouette taken from its thickness maps)
    const alpha = ambient ? 0.9 : 0.55;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(silhouette(state.object), STAGE.x - 144, 468 - 216, 288, 216);
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.fillStyle = 'rgba(139,143,150,0.9)';
    ctx.font = '10px ui-monospace,monospace'; ctx.textAlign = 'center';
    ctx.fillText('STAGE', STAGE.x, STAGE.y + 96);

    // the barium screen: glow + the live shadow picture
    const g = glowLevel() * (0.94 + 0.06 * Math.sin(now * 0.02 + rng()));
    ctx.save();
    ctx.fillStyle = '#0d120c';
    ctx.fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
    // live shadow at 48x36 samples, green phosphor
    const field = transmissionField();
    const flux = model.fluxAt(state.kvp) * state.ma;
    for (let sy = 0; sy < 36; sy++) {
      for (let sx = 0; sx < 48; sx++) {
        const px_ = Math.floor(sx * model.PLATE_W / 48), py_ = Math.floor(sy * model.PLATE_H / 36);
        const t = field[py_ * model.PLATE_W + px_];
        const n = sampleCount(flux * 0.35 * t + 0.4 * rng());
        const lum = Math.min(1, g * (0.18 + 0.82 * Math.sqrt(n / 30)));
        ctx.fillStyle = `rgba(${Math.round(150 * lum + 30)},${Math.round(235 * lum + 35)},${Math.round(120 * lum + 30)},1)`;
        ctx.fillRect(SCREEN.x + sx * SCREEN.w / 48, SCREEN.y + sy * SCREEN.h / 36, SCREEN.w / 48 + 1, SCREEN.h / 36 + 1);
      }
    }
    ctx.strokeStyle = 'rgba(233,228,212,0.25)';
    ctx.strokeRect(SCREEN.x + 0.5, SCREEN.y + 0.5, SCREEN.w, SCREEN.h);
    ctx.fillStyle = 'rgba(139,143,150,0.9)';
    ctx.font = '10px ui-monospace,monospace'; ctx.textAlign = 'center';
    ctx.fillText('BARIUM SCREEN', SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h + 16);
    ctx.restore();

    // settings stamp
    ctx.fillStyle = 'rgba(233,228,212,0.75)';
    ctx.font = '12px ui-monospace,monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${state.kvp} kVp · ${state.ma} mA`, 24, 30);
    ctx.fillStyle = 'rgba(139,143,150,0.85)';
    ctx.font = '10px ui-monospace,monospace';
    ctx.fillText(state.cover ? 'COVER ON — dark room' : 'COVER OFF — tube light in the room', 24, 48);
    ctx.textAlign = 'right';
    ctx.fillText(state.mode === 'exposing' ? 'BEAM ON' : 'BEAM OFF', bench.width - 24, 30);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- verdict / readouts ---------------------------------------------------
  const IDLE_HINTS = {
    book: 'Paper is nearly transparent to X-rays; the brass clip is not. Low voltage makes the clip pop — if you can afford the photons.',
    wood: 'The nail hides inside the plank from every visible angle. Weight, not hardness, decides the shadow.',
    hand: 'Bone is mineral: heavy enough to shadow flesh. The ring, at atomic weight 65, barely lets anything through.',
    lead: 'Lead is Z 82 — the photoelectric effect eats this beam at any voltage the tube can make.',
  };
  const EXPOSE_HINT = 'Grain first, picture later: the plate counts photons one by one, and noise fades as the count grows.';

  function verdictHTML(title, detail) {
    return `${title}<br><span>${detail}</span>`;
  }

  function render() {
    const now = performance.now();
    renderBench(now);
    if (state.mode !== 'fixed') renderPlate();
    $('r-mas').textContent = model.formatMas(state.mAs).replace(' mA·s', '');
    $('r-glow').textContent = glowWord(glowLevel());
    $('plate-label').textContent = state.mode === 'fixed' ? `PLATE · ${model.formatMas(state.mAs)}` : state.mode === 'exposing' ? 'EXPOSING…' : 'UNEXPOSED PLATE';
    const expose = $('expose');
    expose.textContent = state.mode === 'exposing' ? 'Fix the plate ■' : 'Expose ▸';
    expose.setAttribute('aria-pressed', state.mode === 'exposing' ? 'true' : 'false');
    expose.classList.toggle('armed', state.mode === 'fixed');
    expose.disabled = state.mode === 'fixed';
    const v = $('verdict'), status = $('bench-status'), obs = $('observation');
    if (state.mode === 'idle') {
      v.innerHTML = verdictHTML('Choose the technique.', 'Then press <b>Expose</b> to open the beam.');
      status.textContent = 'Tube idle.';
      obs.textContent = IDLE_HINTS[state.object];
    } else if (state.mode === 'exposing') {
      v.innerHTML = verdictHTML('The plate is counting…', EXPOSE_HINT);
      status.textContent = `Beam on · ${model.formatMas(state.mAs)} so far.`;
      obs.textContent = EXPOSE_HINT;
    } else {
      const g = state.grade;
      v.innerHTML = verdictHTML(`${'★'.repeat(g.stars)}${'☆'.repeat(3 - g.stars)} ${g.title}`, g.detail);
      status.textContent = `Plate fixed at ${model.formatMas(g.mAs)}. Change anything to try again.`;
      obs.textContent = g.detail;
    }
  }

  function invalidate() {
    state.mode = 'idle'; state.mAs = 0; state.grade = null;
    render();
  }

  // ---- clock ----------------------------------------------------------------
  let recordingClock = false;

  function advance(ms) {
    let left = Math.min(ms, 10000);
    while (left > 0) {
      const step = Math.min(left, 250) / 1000;
      if (state.mode === 'exposing') {
        state.mAs = Math.min(model.MAS_MAX, state.mAs + state.ma * step);
        if (state.mAs >= model.MAS_MAX) { fix(); break; }
      }
      left -= step * 1000;
    }
    render();
  }

  function fix() {
    state.mode = 'fixed';
    state.grade = model.grade(state.object, state.kvp, Math.max(0.01, state.mAs), state.data);
  }

  function loop() {
    if (!recordingClock) advance(16.7);
    requestAnimationFrame(loop);
  }

  // ---- public API -----------------------------------------------------------
  root.bariumGlow = {
    state,
    setRecordingClock(on) {
      recordingClock = !!on;
    },
    advance,
    setObject(key) {
      if (!model.OBJECTS[key]) throw new RangeError('Unknown object');
      state.object = key;
      state.data = model.buildMaps(key);
      for (const k of Object.keys(model.OBJECTS)) {
        $(`object-${k}`).setAttribute('aria-pressed', String(k === key));
      }
      invalidate();
    },
    setKvp(v) {
      const n = Math.round(Number(v));
      if (!Number.isFinite(n) || n < 20 || n > 120) throw new RangeError('kVp must lie between 20 and 120');
      state.kvp = n; $('kvp').value = String(n); $('kvp-value').textContent = `${n} kVp`;
      invalidate();
    },
    setMa(v) {
      const n = Math.round(Number(v));
      if (!Number.isFinite(n) || n < 1 || n > 10) throw new RangeError('mA must lie between 1 and 10');
      state.ma = n; $('ma').value = String(n); $('ma-value').textContent = `${n} mA`;
      invalidate();
    },
    setCover(on) {
      state.cover = !!on;
      $('cover').setAttribute('aria-pressed', String(!!on));
      $('cover').textContent = on ? 'Cover on — no light gets out' : 'Cover off — the tube lights the room';
      render();
    },
    expose() {
      if (state.mode === 'idle') { state.mode = 'exposing'; render(); }
      else if (state.mode === 'exposing') { fix(); render(); }
    },
    newPlate() {
      seed = (seed ^ 0x9e3779b9) >>> 0;
      invalidate();
    },
  };

  // ---- events ----------------------------------------------------------------
  for (const key of Object.keys(model.OBJECTS)) {
    $(`object-${key}`).addEventListener('click', () => root.bariumGlow.setObject(key));
  }
  $('kvp').addEventListener('input', (e) => root.bariumGlow.setKvp(e.target.value));
  $('ma').addEventListener('input', (e) => root.bariumGlow.setMa(e.target.value));
  $('cover').addEventListener('click', () => root.bariumGlow.setCover(!state.cover));
  $('expose').addEventListener('click', () => root.bariumGlow.expose());
  $('newplate').addEventListener('click', () => root.bariumGlow.newPlate());

  render();
  requestAnimationFrame(loop);
})(typeof globalThis !== 'undefined' ? globalThis : this);
