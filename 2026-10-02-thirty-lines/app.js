(() => {
  'use strict';
  const C = window.ThirtyCore;
  const $ = id => document.getElementById(id);
  const source = $('source'), sourceCtx = source.getContext('2d', {willReadFrequently: true});
  const discCtx = $('disc').getContext('2d'), pictureCtx = $('picture').getContext('2d');
  const signalCtx = $('signal').getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const state = {lines: 30, drift: 0, phase: 0, subject: 'bill', view: 'memory', paused: reduced.matches, serial: 0, receiveSerial: 0, time: 0};
  let memory, samples, previous = null, manual = false, lastSubjectFrame = -1;
  const notices = {
    bill: 'An original stand-in for a very patient dummy.',
    orbit: 'A little moon with a lot of empty space.',
    type: 'Fine lettering pays a price for so few lines.'
  };
  function ellipse(ctx, x, y, rx, ry, fill) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  }
  function drawSubject() {
    const ctx = sourceCtx;
    const t = state.time;
    ctx.fillStyle = '#101510'; ctx.fillRect(0, 0, 240, 320);
    const halo = ctx.createRadialGradient(120, 120, 10, 120, 140, 190);
    halo.addColorStop(0, '#515849'); halo.addColorStop(1, '#111711');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, 240, 320);
    if (state.subject === 'bill') {
      ctx.save(); ctx.translate(Math.sin(t * .8) * 3, Math.sin(t) * 1.5);
      // The sitter is drawn here, not copied from a historical photograph.
      ellipse(ctx, 120, 313, 86, 70, '#35382f');
      ctx.fillStyle = '#959887'; ctx.beginPath(); ctx.moveTo(100, 237); ctx.lineTo(140, 237); ctx.lineTo(144, 291); ctx.lineTo(97, 291); ctx.fill();
      ctx.fillStyle = '#dedecd'; ctx.beginPath(); ctx.moveTo(85, 275); ctx.lineTo(115, 292); ctx.lineTo(120, 316); ctx.lineTo(72, 303); ctx.fill();
      ctx.beginPath(); ctx.moveTo(155, 275); ctx.lineTo(126, 292); ctx.lineTo(120, 316); ctx.lineTo(169, 304); ctx.fill();
      ellipse(ctx, 47, 163, 14, 27, '#a5a68e'); ellipse(ctx, 192, 163, 13, 27, '#7d806b');
      const face = ctx.createLinearGradient(54, 0, 189, 0);
      face.addColorStop(0, '#a5a991'); face.addColorStop(.35, '#e8e7cd'); face.addColorStop(.7, '#b1b49b'); face.addColorStop(1, '#6c715c');
      ellipse(ctx, 120, 160, 70, 100, face);
      ctx.fillStyle = '#262c21'; ctx.beginPath(); ctx.moveTo(51, 120); ctx.bezierCurveTo(43, 39, 96, 31, 154, 50); ctx.bezierCurveTo(203, 51, 203, 100, 187, 126); ctx.lineTo(173, 90); ctx.bezierCurveTo(143, 74, 95, 84, 71, 82); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 5; i++) {ctx.strokeStyle = '#555c47'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(67 + i * 22, 77); ctx.quadraticCurveTo(75 + i * 20, 42, 94 + i * 20, 63); ctx.stroke();}
      ctx.strokeStyle = '#414932'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(74, 125); ctx.quadraticCurveTo(87, 118, 101, 124); ctx.moveTo(139, 124); ctx.quadraticCurveTo(154, 117, 166, 124); ctx.stroke();
      const blink = Math.cos(t * 1.6 + 1) > .988;
      ellipse(ctx, 87, 145, 17, blink ? 2 : 11, '#f0efdc'); ellipse(ctx, 153, 145, 17, blink ? 2 : 11, '#e4e3cb');
      if (!blink) {ellipse(ctx, 90, 146, 6, 8, '#222a1d'); ellipse(ctx, 151, 146, 6, 8, '#222a1d'); ellipse(ctx, 92, 143, 2, 2, '#faf8e6'); ellipse(ctx, 153, 143, 2, 2, '#faf8e6');}
      ctx.fillStyle = '#989d82'; ctx.beginPath(); ctx.moveTo(119, 145); ctx.lineTo(102, 187); ctx.quadraticCurveTo(119, 202, 136, 187); ctx.lineTo(126, 179); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#edeed3'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(119, 147); ctx.lineTo(112, 181); ctx.stroke();
      ellipse(ctx, 78, 189, 15, 8, '#b7b6a0'); ellipse(ctx, 161, 190, 15, 8, '#a5aa8a');
      ctx.fillStyle = '#333c2b'; ctx.beginPath(); ctx.moveTo(84, 210); ctx.quadraticCurveTo(120, 231, 156, 210); ctx.quadraticCurveTo(121, 248, 84, 210); ctx.fill();
      ctx.fillStyle = '#efecd7'; ctx.beginPath(); ctx.moveTo(91, 216); ctx.quadraticCurveTo(122, 230, 149, 216); ctx.lineTo(144, 227); ctx.quadraticCurveTo(121, 237, 96, 227); ctx.fill();
      ctx.strokeStyle = '#737c60'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(95, 234); ctx.lineTo(94, 248); ctx.moveTo(145, 234); ctx.lineTo(145, 248); ctx.stroke();
      ctx.fillStyle = '#20281c'; ctx.beginPath(); ctx.moveTo(98, 297); ctx.lineTo(119, 301); ctx.lineTo(143, 295); ctx.lineTo(140, 312); ctx.lineTo(120, 305); ctx.lineTo(99, 315); ctx.fill();
      ctx.restore();
    } else if (state.subject === 'orbit') {
      for (let i = 0; i < 28; i++) ellipse(ctx, C.mod(i * 79 + 11, 240), C.mod(i * 113 + 23, 320), i % 4 === 0 ? 1.8 : 1, 1, '#89977b');
      ctx.save(); ctx.translate(120, 156); ctx.rotate(-.35);
      ctx.strokeStyle = '#c7cdb6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 96, 26, 0, 0, Math.PI); ctx.stroke();
      const moon = ctx.createRadialGradient(-17, -25, 5, 10, 0, 70);
      moon.addColorStop(0, '#f1efda'); moon.addColorStop(1, '#535d45'); ellipse(ctx, 0, 0, 60, 60, moon);
      ellipse(ctx, -18, -18, 12, 10, '#929e7c'); ellipse(ctx, 22, 20, 15, 11, '#798969'); ellipse(ctx, 24, -23, 5, 6, '#a0ab8e'); ellipse(ctx, -30, 22, 6, 7, '#b2bea0');
      ctx.strokeStyle = '#c7cdb6'; ctx.beginPath(); ctx.ellipse(0, 0, 96, 26, 0, Math.PI, Math.PI * 2); ctx.stroke(); ctx.restore();
      ellipse(ctx, 120 + Math.cos(t) * 101, 156 + Math.sin(t) * 35, 5, 5, '#f1efda');
    } else {
      ctx.textAlign = 'center'; ctx.fillStyle = '#e5e6d0';
      ctx.font = 'bold 180px Georgia'; ctx.fillText('A', 120, 210);
      ctx.font = '14px Georgia'; ctx.fillText('a small moving picture', 120, 255);
      ctx.strokeStyle = '#c5c8ae'; ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) {ctx.beginPath(); ctx.moveTo(27 + i * 31, 275); ctx.lineTo(27 + i * 31, 296); ctx.stroke();}
    }
    const image = ctx.getImageData(0, 0, 240, 320);
    samples = C.sampleRGBA(image.data, 240, 320, state.lines);
  }
  function resetMemory() {
    state.serial = 0; state.receiveSerial = 0; lastSubjectFrame = -1;
    drawSubject(); memory = new Float32Array(samples.length);
    C.transmit(memory, samples, 0, samples.length, state.lines, state.drift, state.phase);
  }
  function advance(dt) {
    const old = Math.floor(state.serial);
    const offset = state.receiveSerial - state.serial * (1 + state.drift / 100);
    state.time += dt;
    const increment = dt * C.VISUAL_RATE * state.lines * C.ROWS;
    state.serial += increment;
    state.receiveSerial += increment * (1 + state.drift / 100);
    const frame = Math.floor(state.serial / samples.length);
    if (frame !== lastSubjectFrame) {drawSubject(); lastSubjectFrame = frame;}
    C.transmit(memory, samples, old, Math.floor(state.serial), state.lines, state.drift, state.phase, offset);
  }
  function drawPicture() {
    const ctx = pictureCtx, n = state.lines, total = samples.length;
    ctx.fillStyle = '#160c05'; ctx.fillRect(0, 0, 240, 320);
    const cellWidth = 240 / n, cellHeight = 320 / C.ROWS;
    const head = Math.max(0, Math.floor(state.serial) - 1);
    const offset = state.receiveSerial - state.serial * (1 + state.drift / 100);
    function spot(index, value, attenuation = 1) {
      const {column, row} = C.coordinates(index);
      const light = Math.pow(value, 1.15) * attenuation;
      ctx.fillStyle = `rgb(${Math.round(23 + light * 232)},${Math.round(12 + light * 147)},${Math.round(5 + light * 68)})`;
      ctx.fillRect(column * cellWidth, row * cellHeight, cellWidth * .85, cellHeight + .2);
    }
    if (state.view === 'memory') {
      for (let i = 0; i < total; i++) spot(i, memory[i]);
      const rx = C.coordinates(C.address(head, n, state.drift, state.phase, C.ROWS, offset)).column;
      ctx.fillStyle = '#ffb97020'; ctx.fillRect(rx * cellWidth, 0, cellWidth * .85, 320);
    } else {
      // A short trail makes the single illuminated aperture visible at slow speed.
      for (let back = 25; back >= 0; back--) {
        const q = head - back;
        spot(C.address(q, n, state.drift, state.phase, C.ROWS, offset), samples[C.mod(q, total)], Math.exp(-back / 10));
      }
    }
  }
  function drawDisc() {
    const ctx = discCtx, n = state.lines, total = samples.length;
    ctx.clearRect(0, 0, 500, 430);
    const cx = 250, cy = 203, radius = 179;
    const turn = state.serial / total;
    const active = Math.floor(C.mod(state.serial, total) / C.ROWS);
    const grad = ctx.createRadialGradient(cx - 40, cy - 60, 15, cx, cy, radius);
    grad.addColorStop(0, '#616b51'); grad.addColorStop(.6, '#424d36'); grad.addColorStop(1, '#303b29');
    ellipse(ctx, cx + 4, cy + 8, radius, radius, '#11190e');
    ellipse(ctx, cx, cy, radius, radius, grad);
    ctx.strokeStyle = '#798565'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2); ctx.stroke();
    for (const r of [46, 101, 131, 166]) {ctx.strokeStyle = '#7c896027'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();}
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * Math.PI * 2; ctx.strokeStyle = i % 5 ? '#77845a65' : '#a3b28590';
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 171, cy + Math.sin(a) * 171); ctx.lineTo(cx + Math.cos(a) * (i % 5 ? 174 : 177), cy + Math.sin(a) * (i % 5 ? 174 : 177)); ctx.stroke();
    }
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-turn * Math.PI * 2);
    // Radii and angles form a Nipkow spiral. The view is a diagram, not an optical ray trace.
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 - Math.PI / 2;
      const r = 103 + k / Math.max(1, n - 1) * 56;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (k === active) {ctx.shadowColor = '#ffad63'; ctx.shadowBlur = 16;}
      ellipse(ctx, x, y, n > 30 ? 2.6 : 3.8, n > 30 ? 2.6 : 3.8, k === active ? '#ffc782' : '#111c0c');
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#a5b48b'; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText('N I P K O W', 0, -62);
    ctx.fillStyle = '#92a37a'; ctx.font = '9px ui-monospace, monospace'; ctx.fillText(`${n} APERTURES`, 0, 74);
    ctx.restore();
    ellipse(ctx, cx, cy, 23, 23, '#293121'); ellipse(ctx, cx, cy, 16, 16, '#9ba686'); ellipse(ctx, cx, cy, 7, 7, '#3b4730');
    ctx.strokeStyle = '#bdc8a7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 4, cy + 3); ctx.lineTo(cx + 4, cy - 3); ctx.stroke();
    ctx.strokeStyle = '#acb18c'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.strokeRect(237, 37, 27, 66); ctx.setLineDash([]);
    ctx.fillStyle = '#b3be9b'; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'left'; ctx.fillText('SCAN WINDOW', 290, 33);
    ctx.beginPath(); ctx.moveTo(282, 35); ctx.lineTo(266, 52); ctx.stroke();
    ctx.fillStyle = '#a2af8b'; ctx.textAlign = 'center'; ctx.fillText('ONE REVOLUTION = ONE PICTURE', 250, 416);
  }
  function drawSignal() {
    const ctx = signalCtx; ctx.clearRect(0, 0, 460, 40);
    const q = Math.floor(state.serial);
    ctx.strokeStyle = '#5d6b4820'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 34); ctx.lineTo(460, 34); ctx.stroke();
    ctx.strokeStyle = '#ce9b62'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let x = 0; x < 460; x++) {const value = samples[C.mod(q - 459 + x, samples.length)]; const y = 36 - value * 17; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);}
    ctx.stroke();
  }
  function render() {
    drawDisc(); drawPicture(); drawSignal();
    const col = Math.floor(C.mod(state.serial, samples.length) / C.ROWS);
    $('scan-guide').style.left = `${8 + col / state.lines * (source.parentElement.clientWidth - 16)}px`;
    $('column-readout').textContent = `COLUMN ${String(col + 1).padStart(2, '0')} / ${state.lines}`;
  }
  function controls() {
    const broken = state.drift !== 0 || state.phase !== 0;
    $('status').textContent = state.drift ? 'RECEIVER DRIFTING' : state.phase ? 'PHASE MISALIGNED' : 'SIGNAL IN SYNC';
    $('status-lamp').classList.toggle('broken', broken);
    $('drift').value = state.drift; $('phase').value = state.phase;
    $('drift-value').textContent = `${state.drift >= 0 ? '+' : ''}${state.drift.toFixed(1)}%`;
    $('phase-value').textContent = `${state.phase}°`;
    $('hole-readout').textContent = state.lines;
    $('sync-readout').innerHTML = `TX 300.0 RPM <b>↔</b> RX ${C.rpm(state.drift).toFixed(1)} RPM`;
    $('pause').textContent = state.paused ? '▷ Resume disc' : 'Ⅱ Pause disc';
    $('pause').setAttribute('aria-pressed', String(state.paused)); $('step').disabled = !state.paused;
    document.querySelectorAll('[data-lines]').forEach(el => el.setAttribute('aria-pressed', String(+el.dataset.lines === state.lines)));
    document.querySelectorAll('[data-subject]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.subject === state.subject)));
    source.setAttribute('aria-label', `Original ${state.subject === 'bill' ? 'puppet face' : state.subject === 'orbit' ? 'orbit illustration' : 'letter A and fine type'}, the source picture`);
    $('subject-note').textContent = notices[state.subject];
    $('memory').setAttribute('aria-pressed', String(state.view === 'memory')); $('slit').setAttribute('aria-pressed', String(state.view === 'slit'));
    $('view-note').textContent = state.view === 'memory' ? 'The scans held together, so you can see the face.' : 'One bright spot. Your eyes do the rest.';
    $('explanation').textContent = state.view === 'slit' ? 'Only one aperture is lit at a time. This view keeps a short trail to make it visible. Switch to Eye memory to hold the scans together.' : state.drift ? `The receiver is ${Math.abs(state.drift).toFixed(1)}% ${state.drift > 0 ? 'faster' : 'slower'}. Each sweep lands somewhere new: the picture walks around the screen. Lock the picture to match speed and alignment.` : state.phase ? `The discs turn at the same speed, but start ${Math.abs(state.phase)}° apart. The image is stable and split. Matching speed is only half the job; the apertures must line up, too.` : `${state.lines} columns, one wire. Each hole sweeps a vertical strip; a second disc puts the light back in the same place. Change the receiver speed to see why timing matters.`;
  }
  function set(options) {
    if (options.lines !== undefined && ![15, 30, 60].includes(options.lines)) throw new RangeError('Use 15, 30 or 60 lines');
    if (options.subject !== undefined && !Object.hasOwn(notices, options.subject)) throw new RangeError('Unknown sitter');
    if (options.drift !== undefined && (!Number.isFinite(options.drift) || Math.abs(options.drift) > 5)) throw new RangeError('Drift must be between -5 and 5');
    if (options.phase !== undefined && (!Number.isFinite(options.phase) || Math.abs(options.phase) > 180)) throw new RangeError('Phase must be between -180 and 180');
    if (options.view !== undefined && !['memory', 'slit'].includes(options.view)) throw new RangeError('Unknown receiver view');
    const reset = options.lines !== undefined || options.subject !== undefined || options.phase !== undefined;
    Object.assign(state, options);
    if (reset) resetMemory();
    controls(); render();
  }
  $('drift').addEventListener('input', event => set({drift: +event.target.value}));
  $('phase').addEventListener('input', event => set({phase: +event.target.value}));
  document.querySelectorAll('[data-lines]').forEach(el => el.addEventListener('click', () => set({lines: +el.dataset.lines})));
  document.querySelectorAll('[data-subject]').forEach(el => el.addEventListener('click', () => set({subject: el.dataset.subject})));
  $('memory').addEventListener('click', () => set({view: 'memory'})); $('slit').addEventListener('click', () => set({view: 'slit'}));
  $('break-sync').addEventListener('click', () => set({drift: 2.5}));
  $('lock').addEventListener('click', () => set({drift: 0, phase: 0}));
  $('pause').addEventListener('click', () => set({paused: !state.paused}));
  $('step').addEventListener('click', () => {if (state.paused) {advance(1 / (C.VISUAL_RATE * state.lines)); render();}});
  resetMemory(); controls(); render();
  function animate(timestamp) {
    if (previous !== null && !state.paused && !manual && !document.hidden) advance(Math.min((timestamp - previous) / 1000, .08));
    previous = timestamp;
    if (!manual && !state.paused) render();
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  // Deterministic capture shares the same sampler and transmission path as the live app.
  window.thirtyLines = {
    set, getState: () => ({...state, receiverRPM: C.rpm(state.drift)}),
    useManualClock: () => {manual = true; state.time = 0; resetMemory(); controls(); render();},
    tick: dt => {if (!Number.isFinite(dt) || dt < 0 || dt > 2) throw new RangeError('Clock step must be 0–2 seconds'); if (!state.paused) advance(dt); render();},
    getMemory: () => Array.from(memory)
  };
})();
