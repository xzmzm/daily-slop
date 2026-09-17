(() => {
  'use strict';
  const physics = window.PendulumPhysics;
  const $ = id => document.getElementById(id);
  const canvas = $('dial'), ctx = canvas.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const places = {
    paris: { name: 'Paris', lat: 48.86, note: 'In Paris, the swing direction makes a full turn in almost 32 hours. Stay a little longer than a day.' },
    kl: { name: 'Kuala Lumpur', lat: 3.14, note: 'So close to the equator, a full turn takes over 18 days. This is an experiment for a very patient visitor.' },
    equator: { name: 'Equator', lat: 0, note: 'Earth still turns. Here its spin has no vertical component, so the swing direction does not precess.' },
    sydney: { name: 'Sydney', lat: -33.87, note: 'Cross the equator and the direction reverses. Looking down, the swing now turns counterclockwise.' },
    pole: { name: 'North Pole', lat: 90, note: 'The full effect: one turn in 23 hours, 56 minutes. Here the floor turns beneath a fixed swing plane.' }
  };
  const state = { latitude: 48.86, hours: 6, playing: false, swingSeconds: 0.5 };
  let width = 0, height = 0, lastTimestamp = null;
  const latitudeText = latitude => `${Math.abs(latitude).toFixed(2)}°${latitude === 0 ? '' : latitude > 0 ? ' N' : ' S'}`;
  const point = (angle, radius, cx, cy) => [cx + Math.sin(angle) * radius, cy - Math.cos(angle) * radius];
  function line(a, b, color, thickness = 1) {
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.stroke();
  }
  function circle(x, y, radius, color, thickness = 1) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.stroke();
  }
  function draw() {
    if (!width || !height) return;
    const cx = width / 2, cy = height / 2, r = Math.min(height * 0.37, width * 0.365);
    const result = physics.at(state.latitude, state.hours), angle = result.angle * Math.PI / 180;
    ctx.clearRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.6);
    glow.addColorStop(0, '#293735'); glow.addColorStop(1, '#192325');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    // Floor tiles stay fixed. All gold directions are measured against this grid.
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    for (let i = -12; i <= 12; i++) {
      line([cx + i * 27, cy - r], [cx + i * 27, cy + r], '#9faf9c0b');
      line([cx - r, cy + i * 27], [cx + r, cy + i * 27], '#9faf9c0b');
    }
    ctx.restore();
    [0.25, 0.5, 0.75, 1, 1.1].forEach((scale, i) => circle(cx, cy, r * scale, i > 2 ? '#72887955' : '#72887926'));
    for (let degree = 0; degree < 360; degree += 5) {
      const rad = degree * Math.PI / 180, major = degree % 30 === 0;
      line(point(rad, r * (major ? 1.035 : 1.075), cx, cy), point(rad, r * 1.1, cx, cy), major ? '#b1bca480' : '#a9b89f40');
    }
    ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#abbca9';
    ['N', 'E', 'S', 'W'].forEach((label, i) => ctx.fillText(label, ...point(i * Math.PI / 2, r * 1.23, cx, cy)));
    ctx.save(); ctx.setLineDash([3, 6]);
    line([cx, cy - r * .94], [cx, cy + r * .94], '#afc5b866'); ctx.restore();
    const marks = physics.hourMarks(state.latitude, state.hours);
    for (const mark of marks.slice(1)) {
      const a = mark.angle * Math.PI / 180;
      const alpha = Math.round(28 + 50 * (mark.hour / Math.max(1, state.hours))).toString(16).padStart(2, '0');
      line(point(a, -r * .88, cx, cy), point(a, r * .88, cx, cy), '#edb374' + alpha);
      const dot = point(a, r * .91, cx, cy);
      ctx.beginPath(); ctx.arc(...dot, 1.8, 0, Math.PI * 2); ctx.fillStyle = '#edb37488'; ctx.fill();
    }
    // The outer arc follows the directed angle, so north and south are distinct.
    if (Math.abs(angle) > 0.0001) {
      const sweep = Math.abs(angle) >= Math.PI * 2 ? angle % (Math.PI * 2) : angle;
      if (Math.abs(angle) >= Math.PI * 2) circle(cx, cy, r * 1.145, '#edb37450', 2);
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.145, -Math.PI / 2, -Math.PI / 2 + sweep, sweep < 0);
      ctx.strokeStyle = '#dca267'; ctx.lineWidth = 2; ctx.stroke();
      const end = point(angle, r * 1.145, cx, cy), direction = Math.sign(angle);
      ctx.save(); ctx.translate(...end); ctx.rotate(angle + (direction < 0 ? Math.PI : 0));
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-3, -3); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fillStyle = '#edb374'; ctx.fill(); ctx.restore();
    }
    const end = point(angle, r * .88, cx, cy), start = point(angle, -r * .88, cx, cy);
    line(start, end, '#efbd83', 1.8);
    for (const p of [start, end]) { ctx.beginPath(); ctx.arc(...p, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#f3c99a'; ctx.fill(); }
    const phase = reducedMotion ? .65 : Math.cos(state.swingSeconds * Math.PI * 2 / 3.8);
    const bob = point(angle, r * .82 * phase, cx, cy);
    // A stylized bob on the current swing line; its pacing is explicitly separate.
    ctx.save(); ctx.shadowColor = '#00000088'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    const metal = ctx.createRadialGradient(bob[0] - 2, bob[1] - 3, 1, ...bob, 8);
    metal.addColorStop(0, '#ffe6be'); metal.addColorStop(.5, '#d9a16a'); metal.addColorStop(1, '#855433');
    ctx.beginPath(); ctx.arc(...bob, 8, 0, Math.PI * 2); ctx.fillStyle = metal; ctx.fill(); ctx.restore();
    circle(cx, cy, 3, '#e4e1ce');
    if (width > 590) {
      ctx.textAlign = 'left'; ctx.font = '9px ui-monospace, monospace'; ctx.fillStyle = '#8d9e91'; ctx.fillText('ACCUMULATED TURN', 26, cy - 30);
      ctx.font = '25px Georgia, serif'; ctx.fillStyle = '#ddc6a1'; ctx.fillText(`${Math.abs(result.angle).toFixed(1)}°`, 26, cy);
      ctx.font = '8px ui-monospace, monospace'; ctx.fillStyle = '#8d9e91'; ctx.fillText(result.direction === 'none' ? 'NO PRECESSION' : result.rate > 0 ? 'CLOCKWISE ↻' : 'COUNTERCLOCKWISE ↺', 26, cy + 25);
      ctx.textAlign = 'right'; ctx.fillText('HOURLY', width - 28, cy - 6); ctx.fillText('DIRECTIONS', width - 28, cy + 8);
    }
  }
  function update() {
    const result = physics.at(state.latitude, state.hours);
    const selected = Object.entries(places).find(([, p]) => Math.abs(p.lat - state.latitude) < .001);
    const name = selected ? selected[1].name : 'Your latitude';
    $('place-name').textContent = name;
    $('place-name').classList.toggle('long-name', name.length > 10);
    $('latitude-value').textContent = latitudeText(state.latitude);
    $('latitude').setAttribute('aria-valuetext', latitudeText(state.latitude));
    $('location-tag').textContent = `${name.toUpperCase()} · ${latitudeText(state.latitude)}`;
    $('rate-value').textContent = Math.abs(result.rate).toFixed(result.rate !== 0 && Math.abs(result.rate) < .1 ? 4 : 2);
    $('direction-value').textContent = result.direction === 'none' ? 'No precession' : `${result.rate > 0 ? 'Clockwise' : 'Counterclockwise'}, seen from above`;
    if (result.period === Infinity) $('period-value').textContent = '∞';
    else if (result.period >= 72) $('period-value').innerHTML = `${(result.period / 24).toFixed(1)}<span>days</span>`;
    else {
      const minutes = Math.round(result.period * 60);
      $('period-value').innerHTML = `${Math.floor(minutes / 60)}<span>h</span> ${String(minutes % 60).padStart(2, '0')}<span>m</span>`;
    }
    $('period-note').textContent = result.period === Infinity ? 'No full turn at the equator' : 'A 360° precession cycle';
    $('place-note').textContent = selected ? selected[1].note : 'Closer to a pole, the swing direction turns faster. Try equal latitudes north and south: same speed, opposite directions.';
    document.querySelectorAll('[data-place]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.place === selected?.[0])));
    const y = 50 - 40 * Math.sin(state.latitude * Math.PI / 180), halfChord = 40 * Math.cos(state.latitude * Math.PI / 180);
    $('latitude-chord').setAttribute('d', `M${50 - halfChord} ${y}H${50 + halfChord}`);
    $('latitude-dot').setAttribute('cx', 50 + halfChord); $('latitude-dot').setAttribute('cy', y);
    const mins = Math.round(state.hours * 60), hour = String(Math.floor(mins / 60)).padStart(2, '0'), minute = String(mins % 60).padStart(2, '0');
    $('time-value').innerHTML = `${hour}<span>h</span> ${minute}<span>m</span>`;
    $('elapsed').value = state.hours;
    $('elapsed').setAttribute('aria-valuetext', `${hour} hours ${minute} minutes`);
    $('turn-label').textContent = `${Math.abs(result.angle).toFixed(2)}° ${result.direction === 'none' ? 'NO PRECESSION' : result.direction.toUpperCase()}`;
    $('play').textContent = state.playing ? 'Ⅱ Pause' : '▶ Run time';
    $('play').setAttribute('aria-pressed', String(state.playing));
    draw();
  }
  function pause() { state.playing = false; lastTimestamp = null; }
  $('latitude').addEventListener('input', event => { state.latitude = Number(event.target.value); update(); });
  document.querySelectorAll('[data-place]').forEach(button => button.addEventListener('click', () => {
    state.latitude = places[button.dataset.place].lat; $('latitude').value = state.latitude; update();
  }));
  $('elapsed').addEventListener('input', event => { pause(); state.hours = Number(event.target.value); update(); });
  $('play').addEventListener('click', () => {
    state.playing = !state.playing;
    if (state.playing && state.hours >= 48) state.hours = 0;
    lastTimestamp = null; update();
  });
  $('six-hours').addEventListener('click', () => { pause(); state.hours = Math.min(48, state.hours + 6); update(); });
  $('reset').addEventListener('click', () => { pause(); state.hours = 0; state.swingSeconds = 0; update(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); update(); } });
  new ResizeObserver(() => {
    const box = canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = box.width; height = box.height;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw();
  }).observe(canvas);
  function animate(timestamp) {
    if (state.playing) {
      const dt = lastTimestamp === null ? 0 : Math.min(.15, (timestamp - lastTimestamp) / 1000);
      state.hours = Math.min(48, state.hours + dt * .5);
      state.swingSeconds += dt;
      if (state.hours === 48) pause();
      update();
    }
    lastTimestamp = timestamp;
    requestAnimationFrame(animate);
  }
  update(); requestAnimationFrame(animate);
})();
