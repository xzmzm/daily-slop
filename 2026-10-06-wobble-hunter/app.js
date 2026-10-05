(() => {
  'use strict';
  const C = window.WobbleCore, $ = id => document.getElementById(id);
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {massMJ: C.PRESETS.discovery.massMJ, distAU: C.PRESETS.discovery.distAU,
    inclDeg: 90, playing: !calm, speed: 2, time: 0};
  let manual = false, previous = 0, lastPreset = 'discovery';

  const CX = 220, CY = 190, ORBIT_PX = 132, WOBBLE_PX = 44;
  const SPEEDS = {day: 2, month: 30, year: 365.25};
  const ME = 317.83;

  function derived() {
    const period = C.periodDays(state.distAU, state.massMJ);
    const kEdge = C.semiAmplitude(state.massMJ, state.distAU);
    const kObs = C.observedAmplitude(kEdge, state.inclDeg);
    const wobble = C.wobbleRadiusKm(state.massMJ, state.distAU);
    const share = state.massMJ * C.MJ_PER_SUN / (C.STAR_MASS + state.massMJ * C.MJ_PER_SUN);
    const exagg = WOBBLE_PX / (ORBIT_PX * share);
    const v = C.radialVelocity(kObs, state.time, period);
    return {period, kEdge, kObs, wobble, exagg, v};
  }

  function fmtMass(mass) {
    if (mass >= 0.01) return mass.toFixed(2) + ' MJ';
    const earths = mass * ME;
    return (earths >= 10 ? earths.toFixed(0) : earths >= 1 ? earths.toFixed(1) : earths.toFixed(2)) + ' ME';
  }
  function fmtK(k) {
    if (k >= 0.995) return k.toFixed(1) + ' m/s';
    return (k * 100).toFixed(k * 100 >= 9.95 ? 0 : 1) + ' cm/s';
  }
  function fmtPeriod(days) {
    if (days >= 800) return (days / C.DAYS_PER_YEAR).toFixed(1) + ' yr';
    return days.toFixed(2) + ' d';
  }
  function fmtClock(days) {
    if (days >= 800) return (days / C.DAYS_PER_YEAR).toFixed(2) + ' yr';
    return days.toFixed(1) + ' d';
  }
  function fmtKm(km) { return Math.round(km).toLocaleString('en-US') + ' km'; }

  // Log meter: 0.01 → 1000 m/s across five decades.
  function meterX(mps) {
    const clamped = C.clamp(mps, 0.01, 1000);
    return 40 + Math.log10(clamped / 0.01) / 5 * 680;
  }
  const INSTRUMENTS = [
    {value: 0.1, label: 'ESPRESSO 10 cm/s', y: 58},
    {value: 1, label: 'HARPS 1 m/s', y: 58},
    {value: 13, label: 'ELODIE ’95 13 m/s', y: 58}
  ];
  const VERDICTS = [
    {min: 13, status: 'LOUD ENOUGH FOR 1995', icon: '∿',
      hint: 'Several times the 13 m/s precision of the instrument that found 51 Peg b.',
      note: 'The 1995 ELODIE spectrograph hears this clearly — as it heard the real 51 Peg b at 55.6 m/s. A handful of nights closes the case.'},
    {min: 1, status: 'A MODERN INSTRUMENT’S JOB', icon: '∿',
      hint: 'Too faint for 1995, routine for a modern spectrograph.',
      note: 'Below the noise of 1995, but routine for HARPS-class spectrographs (1 m/s). Much of the exoplanet census after 2003 lives in this band.'},
    {min: 0.1, status: 'AT THE 2026 FRONTIER', icon: '∿',
      hint: 'Only the newest spectrographs, pushing toward 10 cm/s, can register this.',
      note: 'Only ESPRESSO-class spectrographs, pushing toward 10 cm/s, can register this. Earth twins sit exactly here — the hardest targets in the sky.'},
    {min: 0, status: 'BELOW EVERY SPECTROGRAPH', icon: '·',
      hint: 'No radial-velocity instrument alive can measure this wobble.',
      note: 'No radial-velocity instrument can measure this today: stars themselves jitter by more. You would need a next-generation spectrograph — or the transit method.'}
  ];

  function buildMeter() {
    const ticks = $('meter-ticks');
    let svg = '';
    for (let decade = 0; decade <= 5; decade++) {
      const x = meterX(0.01 * Math.pow(10, decade));
      svg += `<line x1="${x}" y1="74" x2="${x}" y2="80" stroke="#8b93a0"/><text x="${x}" y="92" text-anchor="middle">${decade === 5 ? '1000' : (0.01 * Math.pow(10, decade)).toString()}</text>`;
    }
    svg += '<text x="748" y="66" text-anchor="end" font-size="8" fill="#8b93a0">m/s</text>';
    ticks.innerHTML = svg;
    $('meter-marks').innerHTML = INSTRUMENTS.map(m => {
      const x = meterX(m.value);
      return `<path d="M${x - 4} 74 L${x + 4} 74 L${x} 66 Z"/><text x="${x}" y="${m.y}" text-anchor="middle">${m.label}</text>`;
    }).join('');
  }

  function buildSpectrum() {
    const group = $('spec-lines');
    let svg = '';
    for (let i = 0; i < 15; i++) {
      const x = 30 + (i * 173 + 47) % 700;
      svg += `<line x1="${x}" y1="20" x2="${x}" y2="66" opacity="${0.25 + (i % 4) * 0.12}"/>`;
    }
    group.innerHTML = svg;
  }

  const chart = $('chart'), ctx = chart.getContext('2d');
  function drawChart(d) {
    const cssWidth = chart.clientWidth || 600, cssHeight = chart.clientHeight || 230;
    const dpr = window.devicePixelRatio || 1;
    if (chart.width !== Math.round(cssWidth * dpr) || chart.height !== Math.round(cssHeight * dpr)) {
      chart.width = Math.round(cssWidth * dpr);
      chart.height = Math.round(cssHeight * dpr);
    }
    const w = chart.width, h = chart.height;
    ctx.clearRect(0, 0, w, h);
    const padL = 64 * dpr, padR = 14 * dpr, padT = 14 * dpr, padB = 24 * dpr;
    const plotW = w - padL - padR, plotH = h - padT - padB, y0 = padT + plotH / 2;
    const window3P = 3 * d.period;
    const tNow = state.time, tStart = tNow - window3P;
    const yScale = d.kEdge > 0 ? plotH / 2 * 0.86 / d.kEdge : 0;
    const xOf = t => padL + (t - tStart) / window3P * plotW;
    const yOf = v => y0 - v * yScale;

    // Phase-aligned period gridlines (one per orbital period).
    ctx.strokeStyle = '#232e3a'; ctx.lineWidth = dpr;
    ctx.fillStyle = '#7f8b99'; ctx.font = `${10 * dpr}px monospace`; ctx.textAlign = 'center';
    for (let k = Math.ceil(tStart / d.period); k * d.period <= tNow + 1e-9; k++) {
      const x = xOf(k * d.period);
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
      if (k > Math.ceil(tStart / d.period)) ctx.fillText(`${(k * d.period - tNow) >= 0 ? 0 : Math.round(k * d.period - tNow)} d`, x, padT + plotH + 15 * dpr);
    }
    ctx.strokeStyle = '#3a4754'; ctx.setLineDash([4 * dpr, 5 * dpr]);
    for (const sign of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(padL, yOf(sign * d.kEdge)); ctx.lineTo(padL + plotW, yOf(sign * d.kEdge)); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = '#8b93a0'; ctx.beginPath(); ctx.moveTo(padL, y0); ctx.lineTo(padL + plotW, y0); ctx.stroke();

    // The trace, with Doppler-coloured area fills.
    const samples = [];
    for (let px = 0; px <= plotW; px += 2 * dpr) {
      const t = tStart + px / plotW * window3P;
      samples.push([padL + px, yOf(C.radialVelocity(d.kObs, t, d.period))]);
    }
    for (const [color, above] of [['rgba(226,117,95,.16)', true], ['rgba(122,179,232,.16)', false]]) {
      ctx.fillStyle = color; ctx.beginPath();
      ctx.moveTo(samples[0][0], y0);
      for (const [x, y] of samples) ctx.lineTo(x, above ? Math.min(y, y0) : Math.max(y, y0));
      ctx.lineTo(samples[samples.length - 1][0], y0); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#e9c46a'; ctx.lineWidth = 2 * dpr; ctx.beginPath();
    samples.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();

    ctx.textAlign = 'right'; ctx.fillStyle = '#b7bdad'; ctx.font = `${10 * dpr}px monospace`;
    ctx.fillText('+' + fmtK(d.kEdge), padL - 8 * dpr, yOf(d.kEdge) + 3 * dpr);
    ctx.fillText('0', padL - 8 * dpr, y0 + 3 * dpr);
    ctx.fillText('−' + fmtK(d.kEdge), padL - 8 * dpr, yOf(-d.kEdge) + 3 * dpr);
    ctx.textAlign = 'left'; ctx.fillStyle = '#5f6b79';
    ctx.fillText('RADIAL VELOCITY · WINDOW = 3 PERIODS', padL, padT + 2 * dpr);
    ctx.textAlign = 'right';
    ctx.fillText('now', padL + plotW, padT + plotH + 15 * dpr);
  }

  function verdictFor(kObs) {
    for (const v of VERDICTS) if (kObs >= v.min) return v;
    return VERDICTS[VERDICTS.length - 1];
  }

  function render() {
    const d = derived();
    const squash = Math.cos(state.inclDeg * Math.PI / 180);

    $('mass').value = C.massToSlider(state.massMJ);
    $('dist').value = C.distToSlider(state.distAU);
    $('incl').value = C.inclToSlider(state.inclDeg);
    $('mass-value').innerHTML = fmtMass(state.massMJ).replace('MJ', 'M<sub>J</sub>').replace('ME', 'M<sub>⊕</sub>');
    $('dist-value').textContent = state.distAU >= 0.995 ? state.distAU.toFixed(2) + ' AU' : state.distAU.toFixed(3) + ' AU';
    $('incl-value').textContent = Math.round(state.inclDeg) + '°';

    const off = C.starOffset(state.time, d.period);
    $('star-disc').setAttribute('transform', `translate(${CX + off.x * WOBBLE_PX} ${CY - off.y * WOBBLE_PX * squash})`);
    $('star-halo').setAttribute('cx', CX + off.x * WOBBLE_PX);
    $('star-halo').setAttribute('cy', CY - off.y * WOBBLE_PX * squash);
    $('star-halo').setAttribute('fill', d.v > 0 ? '#e2755f' : '#7ab3e8');
    $('planet').setAttribute('transform', `translate(${CX - off.x * ORBIT_PX} ${CY - off.y * ORBIT_PX * squash})`);
    $('orbit-path').setAttribute('cx', CX); $('orbit-path').setAttribute('cy', CY);
    $('orbit-path').setAttribute('rx', ORBIT_PX); $('orbit-path').setAttribute('ry', Math.max(ORBIT_PX * squash, 0.4));
    $('wobble-path').setAttribute('cx', CX); $('wobble-path').setAttribute('cy', CY);
    $('wobble-path').setAttribute('rx', WOBBLE_PX); $('wobble-path').setAttribute('ry', Math.max(WOBBLE_PX * squash, 0.4));
    $('barycentre').setAttribute('transform', `translate(${CX} ${CY})`);
    $('exagg-badge').textContent = 'WOBBLE × ' + Math.round(d.exagg).toLocaleString('en-US');

    const shift = 46 * (d.kEdge ? d.v / d.kEdge : 0);
    const lineColor = Math.abs(shift) < 1 ? '#e9c46a' : d.v > 0 ? '#e2755f' : '#7ab3e8';
    for (const attr of ['x1', 'x2']) $('spec-line').setAttribute(attr, 380 + shift);
    $('spec-line').setAttribute('stroke', lineColor);
    $('spec-state').setAttribute('fill', lineColor);
    $('spec-state').textContent = Math.abs(shift) < 1 ? 'REST λ₀'
      : (d.v > 0 ? 'RECEDING +' : 'APPROACHING −') + Math.abs(d.v).toFixed(1) + ' m/s';

    $('period-value').textContent = fmtPeriod(d.period);
    $('k-value').textContent = fmtK(d.kObs);
    $('msini-value').innerHTML = fmtMass(C.massSinI(state.massMJ, state.inclDeg)).replace('MJ', 'M<sub>J</sub>').replace('ME', 'M<sub>⊕</sub>');
    $('wobble-value').textContent = fmtKm(d.wobble);
    $('clock').textContent = fmtClock(state.time);

    const nx = meterX(d.kObs);
    $('meter-needle').setAttribute('x1', nx); $('meter-needle').setAttribute('x2', nx);
    $('meter-knob').setAttribute('cx', nx);
    $('meter-value').setAttribute('x', nx);
    $('meter-value').textContent = d.kObs < 0.01 ? '‹ 0.01 m/s' : fmtK(d.kObs);
    const verdict = verdictFor(d.kObs);
    $('status').textContent = verdict.status;
    $('status-hint').textContent = verdict.hint;
    $('verdict-icon').textContent = verdict.icon;
    $('detect-note').textContent = verdict.note;
    document.body.classList.toggle('faint', d.kObs < 1);

    $('play').innerHTML = state.playing ? '<span aria-hidden="true">Ⅱ</span> Pause the sky' : '<span aria-hidden="true">▶</span> Run the sky';
    $('play').setAttribute('aria-pressed', state.playing);
    for (const [key, id] of [['day', 'speed-day'], ['month', 'speed-month'], ['year', 'speed-year']])
      $(id).setAttribute('aria-pressed', String(state.speed === SPEEDS[key]));
    const match = key => Math.abs(state.massMJ - C.PRESETS[key].massMJ) / C.PRESETS[key].massMJ < 0.005 &&
      Math.abs(state.distAU - C.PRESETS[key].distAU) / C.PRESETS[key].distAU < 0.005;
    for (const key of ['discovery', 'jupiter', 'earth'])
      $('preset-' + key).setAttribute('aria-pressed', String(lastPreset === key && match(key)));

    drawChart(d);
  }

  function set(options = {}) {
    if (Number.isFinite(options.massMJ)) { state.massMJ = C.clamp(options.massMJ, C.MASS_MIN, C.MASS_MAX); lastPreset = null; }
    if (Number.isFinite(options.distAU)) { state.distAU = C.clamp(options.distAU, C.DIST_MIN, C.DIST_MAX); lastPreset = null; }
    if (Number.isFinite(options.inclDeg)) state.inclDeg = C.clamp(options.inclDeg, C.INCL_MIN, C.INCL_MAX);
    if (typeof options.playing === 'boolean') state.playing = options.playing;
    if (Number.isFinite(options.speed) && options.speed > 0) state.speed = options.speed;
    if (Number.isFinite(options.time)) state.time = Math.max(0, options.time);
    if (options.preset && C.PRESETS[options.preset]) {
      state.massMJ = C.PRESETS[options.preset].massMJ;
      state.distAU = C.PRESETS[options.preset].distAU;
      lastPreset = options.preset;
    }
    render();
  }
  function tick(dt) {
    if (!state.playing || !Number.isFinite(dt) || dt <= 0) return;
    state.time += state.speed * dt;
    render();
  }

  $('mass').addEventListener('input', e => set({massMJ: C.sliderToMass(Number(e.target.value))}));
  $('dist').addEventListener('input', e => set({distAU: C.sliderToDist(Number(e.target.value))}));
  $('incl').addEventListener('input', e => set({inclDeg: C.sliderToIncl(Number(e.target.value))}));
  for (const key of ['discovery', 'jupiter', 'earth'])
    $('preset-' + key).addEventListener('click', () => set({preset: key}));
  $('play').addEventListener('click', () => set({playing: !state.playing}));
  for (const [key, id] of [['day', 'speed-day'], ['month', 'speed-month'], ['year', 'speed-year']])
    $(id).addEventListener('click', () => set({speed: SPEEDS[key]}));

  buildMeter();
  buildSpectrum();
  function animate(timestamp) {
    if (!manual && previous) tick(Math.min((timestamp - previous) / 1000, .1));
    previous = timestamp;
    requestAnimationFrame(animate);
  }
  document.addEventListener('visibilitychange', () => { previous = 0; });
  window.wobbleHunter = {getState: () => ({...state}), set, useManualClock: () => { manual = true; }, tick};
  render();
  requestAnimationFrame(animate);
})();
