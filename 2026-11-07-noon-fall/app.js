(() => {
  'use strict';
  const model = window.EntryModel;
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const state = {
    material: 'stony', speed: 14, angle: 62, mass: 600,
    phase: 'idle', playing: true, recording: false,
    t: 0, result: null, playback: 1,
  };
  const X_MAX_STEPS = [20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500];

  function sliderToMass(value) { return 0.1 * 10 ** (value / 100 * 8); }
  function massToSlider(kg) { return Math.round(100 * Math.log10(kg / 0.1) / 8); }

  function invalidate() { state.phase = 'idle'; state.t = 0; state.result = null; render(); }
  function setMaterial(material) { state.material = material; invalidate(); }
  function setSpeed(kms) { state.speed = kms; invalidate(); }
  function setAngle(deg) { state.angle = deg; invalidate(); }
  function setMass(kg) { state.mass = kg; invalidate(); }
  function applyPreset(p) {
    state.material = p.material; state.speed = p.speedKms; state.angle = p.angleDeg; state.mass = p.massKg;
    invalidate();
  }

  const PRESETS = {
    taurid: {material: 'dust', massKg: 100, speedKms: 29, angleDeg: 30},
    ensisheim: {material: 'stony', massKg: 600, speedKms: 14, angleDeg: 62},
    chelyabinsk: {material: 'stony', massKg: 1.3e7, speedKms: 19, angleDeg: 18},
    iron: {material: 'iron', massKg: 500, speedKms: 20, angleDeg: 35},
  };

  function launch() {
    state.result = model.simulate({material: state.material, massKg: state.mass, speedKms: state.speed, angleDeg: state.angle});
    // Every flight gets roughly the same screen time, whatever its real duration.
    state.playback = Math.min(8, Math.max(0.5, state.result.duration / 6.5));
    state.t = 0;
    state.phase = reduced.matches ? 'done' : 'flying';
    if (state.phase === 'done') state.t = state.result.duration;
    render();
  }

  // Linear interpolation between the fixed-step samples; the video clock can
  // move several sample widths per frame, so never just snap to one sample.
  function sampleAt(time) {
    const samples = state.result.samples;
    if (time <= 0) return samples[0];
    if (time >= samples[samples.length - 1].t) return samples[samples.length - 1];
    let lo = 0, hi = samples.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid].t <= time) lo = mid; else hi = mid; }
    const a = samples[lo], b = samples[hi], f = (time - a.t) / Math.max(1e-9, b.t - a.t);
    const mix = (u, v) => u + (v - u) * f;
    return {t: time, h: mix(a.h, b.h), x: mix(a.x, b.x), v: mix(a.v, b.v), m: mix(a.m, b.m), L: mix(a.L, b.L), mag: mix(a.mag, b.mag)};
  }

  function readoutSample() {
    if (!state.result) return null;
    return sampleAt(state.phase === 'done' ? state.result.duration : state.t);
  }

  function verdictHTML() {
    const r = state.result;
    if (state.phase === 'idle' || !r) return 'Four dials, three endings.<br><span>Press <b>Drop it</b> to fly.</span>';
    if (state.phase === 'flying') return 'In flight…<br><span>The squeeze climbs as the air thickens; the glow peaks where the air bites hardest.</span>';
    const km = value => (value / 1000).toFixed(value < 10000 ? 1 : 0);
    if (r.outcome === 'shattered') {
      return `Shattered at ${km(r.burst.h)} km.<br><span>A ${model.formatTnt(r.burst.energyJ)} flash — then dust, drifting down for days.</span>`;
    }
    if (r.outcome === 'burned') {
      const last = r.samples[r.samples.length - 1];
      return `Burned up at ${km(last.h)} km.<br><span>The air ate every gram, ${km(last.x)} km out. Nothing lands.</span>`;
    }
    return `Landed, ${model.formatMass(r.impact.m)} of ${model.formatMass(r.mass0)}.<br><span>${km(r.impact.x)} km downrange at ${Math.round(r.impact.v)} m/s — a meteorite.</span>`;
  }

  function observationHTML() {
    if (state.phase === 'idle' || !state.result) return 'Strength is the quiet dial: dust shatters high, stone bursts deep, iron punches through.';
    if (state.result.outcome === 'shattered') return 'It broke where the squeeze peaked. The flash is the whole remaining kinetic energy cashed in at once.';
    if (state.result.outcome === 'burned') return 'Too small, too fast, too shallow: ablation won the race and there was nothing left to break.';
    return 'It never broke — strength stayed above the squeeze. Fly the same stone as dust and watch the ending change.';
  }

  function updateReadouts() {
    $('mass-value').textContent = model.formatMass(state.mass);
    $('speed-value').textContent = `${state.speed} km/s`;
    $('angle-value').textContent = `${state.angle}°`;
    const s = readoutSample();
    const r = state.result;
    $('verdict').innerHTML = verdictHTML();
    $('observation').textContent = observationHTML();
    if (!s || state.phase === 'idle') {
      for (const id of ['r-alt', 'r-speed', 'r-mass', 'r-mag', 'r-heat']) $(id).textContent = '—';
      $('r-peak').textContent = '';
      $('flight-status').textContent = 'Nothing flies until you drop it.';
      return;
    }
    $('r-alt').textContent = (s.h / 1000).toFixed(1);
    $('r-speed').textContent = (s.v / 1000).toFixed(1);
    $('r-mass').textContent = model.formatMass(s.m);
    $('r-mag').textContent = s.mag >= 11.5 ? '—' : (s.mag > 0 ? '+' : '−') + Math.abs(s.mag).toFixed(1);
    $('r-peak').textContent = r.peakMagnitude < 11.5 ? `· peak ${r.peakMagnitude > 0 ? '+' : '−'}${Math.abs(r.peakMagnitude).toFixed(1)}` : '';
    const squeeze = model.dynamicPressure(model.airDensity(s.h), s.v) / 1e6;
    $('r-heat').textContent = squeeze < 0.01 ? '<0.01' : squeeze.toFixed(2);
    $('flight-status').textContent = state.phase === 'done' ? 'Flight over. Change a dial and drop again.' : 'Flight under way — brightness as seen from 100 km.';
  }

  function render() {
    $('material-dust').setAttribute('aria-pressed', state.material === 'dust');
    $('material-stony').setAttribute('aria-pressed', state.material === 'stony');
    $('material-iron').setAttribute('aria-pressed', state.material === 'iron');
    $('speed').value = state.speed;
    $('angle').value = state.angle;
    $('mass').value = massToSlider(state.mass);
    $('motion').setAttribute('aria-pressed', state.playing);
    $('motion').innerHTML = (state.playing ? 'Ⅱ' : '▷') + '<span>' + (state.playing ? 'Pause flight' : 'Resume flight') + '</span>';
    updateReadouts();
    draw();
  }

  function draw() {
    const canvas = $('sky'), ctx = canvas.getContext('2d');
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
    if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
    ctx.setTransform(canvas.width / 1000, 0, 0, canvas.height / 620, 0, 0);
    ctx.clearRect(0, 0, 1000, 620);

    const padL = 64, padR = 26, padT = 26, groundTop = 556, groundBottom = 620;
    const plotW = 1000 - padL - padR, plotH = groundTop - padT;
    const r = state.result;
    // Downrange axis in km: the first round step that fits, else a round number up.
    const needKm = r ? r.maxDownrange * 1.06 / 1000 : 0;
    const xMax = r ? (X_MAX_STEPS.find(step => step >= needKm) ?? Math.ceil(needKm / 100) * 100) : 60;
    const xOf = x => padL + x / (xMax * 1000) * plotW;
    const yOf = h => padT + (1 - h / 1e5) * plotH;

    const sky = ctx.createLinearGradient(0, 0, 0, groundTop);
    sky.addColorStop(0, '#e4e6dd');
    sky.addColorStop(1, '#f6f3e8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1000, groundTop);
    // Noon sun, pale because it is high.
    ctx.fillStyle = 'rgba(243,221,163,.28)';
    ctx.beginPath(); ctx.arc(padL + 58, padT + 66, 42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(247,232,183,.95)';
    ctx.beginPath(); ctx.arc(padL + 58, padT + 66, 22, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = '#d7d6ca';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 7]);
    for (const km of [25, 50, 75, 100]) {
      const y = yOf(km * 1000);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#8b8f83';
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(km === 100 ? '100 km' : km, padL - 8, y + 3);
      ctx.setLineDash([3, 7]);
    }
    ctx.setLineDash([]);
    ctx.fillStyle = '#33302a';
    ctx.fillRect(0, groundTop, 1000, groundBottom - groundTop);
    ctx.strokeStyle = '#26241f';
    ctx.beginPath(); ctx.moveTo(0, groundTop + .5); ctx.lineTo(1000, groundTop + .5); ctx.stroke();
    const tickStep = xMax <= 100 ? 25 : 50;
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    for (let km = tickStep; km <= xMax; km += tickStep) {
      const x = xOf(km * 1000);
      ctx.strokeStyle = '#56524a';
      ctx.beginPath(); ctx.moveTo(x, groundTop); ctx.lineTo(x, groundTop + 7); ctx.stroke();
      ctx.fillStyle = '#a89f8b';
      ctx.fillText(km + ' km', x, groundTop + 21);
    }

    // The walled town of Ensisheim, 1.5 km from the fall's ground track.
    const townX = Math.min(xOf(1500), padL + plotW - 90);
    ctx.fillStyle = '#1d1b17';
    ctx.fillRect(townX, groundTop - 12, 30, 12);
    ctx.fillRect(townX + 6, groundTop - 30, 9, 30);
    ctx.beginPath(); ctx.moveTo(townX + 6, groundTop - 30); ctx.lineTo(townX + 10.5, groundTop - 42); ctx.lineTo(townX + 15, groundTop - 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b7ad97';
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ENSISHEIM', townX + 38, groundTop - 18);

    if (!r) return;
    const maxL = Math.max(r.peakLuminosity, 1e-9);
    const endIndex = state.phase === 'done' ? r.samples.length - 1 : r.samples.findIndex(s => s.t > state.t);
    const visible = state.phase === 'done' ? r.samples.length : Math.max(1, endIndex);
    const head = sampleAt(state.phase === 'done' ? r.duration : state.t);

    ctx.strokeStyle = 'rgba(90,99,114,.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < visible; i++) {
      const s = r.samples[i];
      i ? ctx.lineTo(xOf(s.x), yOf(s.h)) : ctx.moveTo(xOf(s.x), yOf(s.h));
    }
    ctx.lineTo(xOf(head.x), yOf(head.h));
    ctx.stroke();

    // The burning part of the trail glows warm on top of the cold base line.
    ctx.strokeStyle = 'rgba(196,84,36,.62)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    let burning = false;
    for (let i = 0; i < visible; i++) {
      const s = r.samples[i];
      if (s.L > maxL * 0.004) {
        burning ? ctx.lineTo(xOf(s.x), yOf(s.h)) : ctx.moveTo(xOf(s.x), yOf(s.h));
        burning = true;
      } else {
        burning = false;
      }
    }
    if (head.L > maxL * 0.004 && burning) ctx.lineTo(xOf(head.x), yOf(head.h));
    ctx.stroke();

    // Each past moment leaves an ember where the air bit hard.
    for (let i = 0; i < visible; i += 2) {
      const s = r.samples[i];
      if (s.L <= 0) continue;
      const strength = s.L / maxL;
      ctx.fillStyle = `rgba(200,90,40,${(0.09 + 0.3 * strength).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(xOf(s.x), yOf(s.h), 3 + 12 * Math.sqrt(strength), 0, Math.PI * 2); ctx.fill();
      if (strength > 0.7) {
        ctx.fillStyle = `rgba(255,244,214,${(0.16 * (strength - 0.7) / 0.3).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(xOf(s.x), yOf(s.h), 4 + 8 * strength, 0, Math.PI * 2); ctx.fill();
      }
    }

    const hx = xOf(head.x), hy = yOf(head.h);
    if (head.L > 0) {
      const strength = Math.min(1, head.L / maxL);
      const glowR = 7 + 15 * Math.sqrt(strength);
      const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, glowR);
      glow.addColorStop(0, 'rgba(255,251,238,.98)');
      glow.addColorStop(0.35, 'rgba(240,166,74,.75)');
      glow.addColorStop(1, 'rgba(200,90,40,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(hx, hy, glowR, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#33302a';
      ctx.beginPath(); ctx.arc(hx, hy, 3.4, 0, Math.PI * 2); ctx.fill();
    }

    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    const label = (text, x, y, color) => {
      x = Math.min(Math.max(x, 90), 1000 - 90);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(246,243,232,.88)';
      ctx.lineWidth = 4;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };
    if (r.outcome === 'shattered' && state.t >= r.burst.t) {
      const bx = xOf(r.burst.x), by = yOf(r.burst.h);
      ctx.strokeStyle = '#a4442a';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4 + 0.4;
        ctx.beginPath();
        ctx.moveTo(bx + Math.cos(angle) * 7, by + Math.sin(angle) * 7);
        ctx.lineTo(bx + Math.cos(angle) * 17, by + Math.sin(angle) * 17);
        ctx.stroke();
      }
      label(`AIRBURST · ${(r.burst.h / 1000).toFixed(0)} KM · ${model.formatTnt(r.burst.energyJ)}`, bx, by - 40, '#a4442a');
    }
    if (r.outcome === 'burned' && state.phase === 'done') {
      const last = r.samples[r.samples.length - 1];
      label(`VAPORIZED · ${(last.h / 1000).toFixed(0)} KM`, xOf(last.x), yOf(last.h) - 16, '#6d7168');
    }
    if (r.outcome === 'landed' && state.phase === 'done' && r.impact) {
      const ix = xOf(r.impact.x);
      ctx.fillStyle = '#1d1b17';
      ctx.beginPath(); ctx.arc(ix, groundTop - 2, 4, 0, Math.PI * 2); ctx.fill();
      label(`METEORITE · ${model.formatMass(r.impact.m)}`, ix, groundTop - 12, '#1d1b17');
    }
  }

  function advance(ms) {
    if (!state.result || state.phase !== 'flying') return;
    state.t = Math.min(state.result.duration, state.t + ms / 1000 * state.playback);
    if (state.t >= state.result.duration) state.phase = 'done';
    updateReadouts();
    draw();
  }

  $('material-dust').addEventListener('click', () => setMaterial('dust'));
  $('material-stony').addEventListener('click', () => setMaterial('stony'));
  $('material-iron').addEventListener('click', () => setMaterial('iron'));
  $('speed').addEventListener('input', e => { state.speed = Number(e.target.value); invalidate(); });
  $('angle').addEventListener('input', e => { state.angle = Number(e.target.value); invalidate(); });
  $('mass').addEventListener('input', e => { state.mass = sliderToMass(Number(e.target.value)); invalidate(); });
  for (const [key, preset] of Object.entries(PRESETS)) $(`preset-${key}`).addEventListener('click', () => applyPreset(preset));
  $('drop').addEventListener('click', launch);
  $('motion').addEventListener('click', () => { state.playing = !state.playing; render(); });
  reduced.addEventListener('change', e => { if (e.matches && state.phase === 'flying') { state.phase = 'done'; state.t = state.result.duration; render(); } });
  window.addEventListener('resize', draw);

  window.noonFall = {state, launch, setMaterial, setSpeed, setAngle, setMass, applyPreset, advance, draw,
    setRecordingClock(enabled) { state.recording = enabled; }};
  let previous = performance.now();
  function tick(now) {
    if (!state.recording && state.phase === 'flying' && state.playing && !document.hidden) {
      advance(Math.min(80, now - previous));
    }
    previous = now;
    requestAnimationFrame(tick);
  }
  render();
  requestAnimationFrame(tick);
})();
