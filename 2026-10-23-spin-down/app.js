/* All visuals and the optional melody are generated locally. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let state = SpinModel.create(), live = true, speed = 30, last = performance.now();
  let audio = null, audioGain = null, audioSource = null, sound = false;
  let message = 'Press Play, then block the reads. Both players start with their reserves full.';
  const format = t => { const n = Math.max(0, Math.floor(t + .001)); return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; };
  for (const id of ['direct', 'cached']) {
    for (let i = 0; i < (id === 'direct' ? 8 : 24); i++) $(`${id}-memory`).appendChild(document.createElement('i'));
  }
  function renderPlayer(id, p) {
    const card = $(`${id}-card`), reading = state.playing && p.phase === 'read' && !state.outageLeft;
    card.classList.toggle('reading', reading);
    card.classList.toggle('playing', state.playing && !p.stalled);
    card.classList.toggle('stalled', state.playing && p.stalled);
    $(`${id}-drive`).textContent = p.phase === 'sleep' ? 'ASLEEP' : !state.playing ? 'READY' : p.phase === 'spin' ? 'SPIN-UP' : state.outageLeft ? 'BLOCKED' : 'READING';
    $(`${id}-output`).textContent = !state.playing ? 'PAUSED' : p.stalled ? 'SILENT' : 'PLAYING';
    $(`${id}-reserve`).textContent = format(p.reserve);
    $(`${id}-duty`).textContent = state.time > .01 ? `${Math.round(p.diskSeconds / state.time * 100)}%` : '—';
    $(`${id}-silence`).textContent = format(p.silentSeconds);
    $(`${id}-fill`).style.width = `${p.reserve / p.capacity * 100}%`;
    const chips = $(`${id}-memory`).children;
    for (let i = 0; i < chips.length; i++) chips[i].classList.toggle('filled', i < Math.ceil(chips.length * p.reserve / p.capacity));
    const rotation = reduced.matches ? 0 : p.diskSeconds * 237 % 360;
    card.querySelector('.platter').style.transform = `rotate(${rotation}deg)`;
    if (audioGain && id === 'cached') audioGain.gain.setTargetAtTime(sound && state.playing && !p.stalled ? .22 : 0, audio.currentTime, .025);
  }
  function chart() {
    const canvas = $('history'), w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const left = 47, right = w - 12, top = 7, bottom = h - 43;
    const end = Math.max(2400, state.time), start = end - 2400;
    const x = t => left + (t - start) / 2400 * (right - left), y = r => bottom - r / 1200 * (bottom - top);
    ctx.font = '8px ui-monospace, monospace'; ctx.fillStyle = '#727b66'; ctx.strokeStyle = '#c9d0bd'; ctx.lineWidth = .6;
    for (const r of [0, 600, 1200]) { ctx.beginPath(); ctx.moveTo(left, y(r)); ctx.lineTo(right, y(r)); ctx.stroke(); ctx.fillText(`${r / 60}m`, 12, y(r) + 3); }
    for (let i = 0; i <= 4; i++) { const t = start + i * 600; ctx.fillText(`${Math.floor(t / 60)}m`, x(t) - 6, h - 1); }
    const samples = state.history.filter(s => s.time >= start);
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i], b = samples[i + 1], width = Math.max(.6, x(b.time) - x(a.time));
      if (a.blocked) { ctx.fillStyle = '#d6a18d66'; ctx.fillRect(x(a.time), top, width, bottom - top); }
      ctx.fillStyle = a.directStalled ? '#bc4f32' : '#b78360';
      if (a.directOn) ctx.fillRect(x(a.time), h - 32, width, 5);
      ctx.fillStyle = a.cachedStalled ? '#bc4f32' : '#638540';
      if (a.cachedOn) ctx.fillRect(x(a.time), h - 22, width, 5);
    }
    ctx.fillStyle = '#717b65'; ctx.fillText('01', 19, h - 27); ctx.fillText('02', 19, h - 17);
    if (samples.length) {
      ctx.beginPath(); ctx.moveTo(x(samples[0].time), bottom);
      for (const s of samples) ctx.lineTo(x(s.time), y(s.reserve));
      ctx.lineTo(x(samples.at(-1).time), bottom); ctx.closePath(); ctx.fillStyle = '#97bd6d36'; ctx.fill();
      ctx.beginPath(); for (const [i, s] of samples.entries()) i ? ctx.lineTo(x(s.time), y(s.reserve)) : ctx.moveTo(x(s.time), y(s.reserve));
      ctx.strokeStyle = '#5d803b'; ctx.lineWidth = 1.8; ctx.stroke();
    }
    ctx.fillStyle = '#3f5e2b'; ctx.beginPath(); ctx.arc(x(state.time), y(state.cached.reserve), 3, 0, Math.PI * 2); ctx.fill();
  }
  function render() {
    $('play').textContent = state.playing ? 'Ⅱ Pause' : '▶ Play';
    $('play').setAttribute('aria-label', state.playing ? 'Pause experiment' : 'Play experiment');
    $('elapsed').textContent = format(state.time);
    $('condition').innerHTML = `<i></i>${state.outageLeft > 0 ? `READS BLOCKED · ${format(Math.ceil(state.outageLeft))} LEFT` : 'DRIVE READS AVAILABLE'}`;
    document.querySelector('.experiment-status').classList.toggle('blocked', state.outageLeft > 0);
    $('block').disabled = state.outageLeft > 0;
    renderPlayer('direct', state.direct); renderPlayer('cached', state.cached); chart();
    let observation = !state.playing && state.time > 0 ? 'Experiment paused. Reserves and counters hold until you press Play.' : message;
    if (state.playing && state.cached.stalled) observation = 'Memory is empty. The read-ahead player needs fresh disk data before it can play again.';
    else if (state.playing && state.outageLeft && state.direct.stalled) observation = 'The continuous reader has gone silent. The read-ahead player is still playing from memory.';
    else if (state.playing && state.cached.phase === 'read' && !state.outageLeft) observation = 'A quick refill: the disk reads 40 seconds of music each second, then goes back to sleep.';
    else if (state.playing && state.cached.phase === 'spin' && !state.outageLeft) observation = 'The disk is waking up. Its reserve covers the two-second spin-up.';
    else if (state.playing && state.time > 1 && !state.outageLeft) observation = 'The read-ahead disk is resting. Its memory keeps feeding the music.';
    if ($('observation').textContent !== observation) $('observation').textContent = observation;
  }
  function advance(seconds) { SpinModel.advance(state, seconds); render(); }
  function reset() { state = SpinModel.create(Number($('capacity').value)); message = 'Both reserves are full again. Press Play to start a fresh comparison.'; render(); }
  $('play').addEventListener('click', () => { state.playing = !state.playing; last = performance.now(); render(); });
  $('reset').addEventListener('click', reset);
  $('capacity').addEventListener('change', reset);
  $('speed').addEventListener('change', () => { speed = Number($('speed').value); });
  $('block').addEventListener('click', () => { SpinModel.block(state); message = 'A five-minute read outage is queued. Press Play to let time pass.'; render(); });
  $('skip').addEventListener('click', () => { SpinModel.skip(state); message = `Track ${state.track} is outside the reserve. Both players need to fetch it from disk.`; render(); });
  $('sound').addEventListener('click', async () => {
    try {
      if (!audio) {
        audio = new (window.AudioContext || window.webkitAudioContext)();
        const length = 8.32, buffer = audio.createBuffer(1, Math.round(audio.sampleRate * length), audio.sampleRate), data = buffer.getChannelData(0);
        const notes = [220, 329.63, 440, 392, 261.63, 329.63, 493.88, 392];
        for (let i = 0; i < data.length; i++) {
          const t = i / audio.sampleRate, beat = Math.floor(t / .26), local = t % .26, f = notes[Math.floor(beat / 2) % notes.length];
          data[i] = Math.sin(2 * Math.PI * f * local) * Math.exp(-local * 17) * .52 + Math.sin(2 * Math.PI * 110 * (t % 1.04)) * Math.exp(-(t % 1.04) * 7) * .22;
        }
        audioGain = audio.createGain(); audioGain.gain.value = 0; audioGain.connect(audio.destination);
        audioSource = audio.createBufferSource(); audioSource.buffer = buffer; audioSource.loop = true; audioSource.connect(audioGain); audioSource.start();
      }
      await audio.resume(); sound = !sound;
      $('sound').textContent = sound ? '♪ Sound on' : '♪ Sound off'; $('sound').setAttribute('aria-pressed', String(sound)); render();
    } catch { $('sound').textContent = 'Sound unavailable'; $('sound').disabled = true; }
  });
  function frame(now) {
    const dt = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
    if (live && state.playing && !document.hidden) advance(dt * speed);
    requestAnimationFrame(frame);
  }
  new ResizeObserver(render).observe($('history'));
  window.spinDown = { get state() { return state; }, advance, render, reset, setLive(value) { live = value; last = performance.now(); } };
  render(); requestAnimationFrame(frame);
})();
