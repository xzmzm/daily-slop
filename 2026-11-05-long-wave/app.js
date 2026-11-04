(function () {
  'use strict';
  const M = LongWave, $ = id => document.getElementById(id);
  const ocean = $('ocean'), spacing = $('spacing');
  let model = M.create(200), seconds = model.travelTime(505), playing = false, last = 0;
  const fmt = (n, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const mono = 'ui-monospace, SFMono-Regular, Consolas, monospace';

  function canvasContext(canvas) {
    const box = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, box.width), h = Math.max(1, box.height);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function text(ctx, value, x, y, color, size = 10, align = 'left') {
    ctx.fillStyle = color; ctx.font = `${size}px ${mono}`; ctx.textAlign = align; ctx.fillText(value, x, y);
  }
  function line(ctx, x1, y1, x2, y2, color, width = 1, dash = []) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
  }
  function drawOcean(s) {
    const {ctx, w, h} = canvasContext(ocean);
    const left = w < 480 ? 25 : 40, right = w - (w < 480 ? 18 : 32), bottom = h - 40;
    const still = Math.round(h * .32), bedOffset = h * .27, bedScale = (bottom - still - bedOffset) / M.DEEP;
    const relief = Math.min(60, (still - 24) / M.amplitude(50), (bedOffset - 12) / M.amplitude(50));
    const X = x => left + x / M.LENGTH * (right - left);
    const B = x => still + bedOffset + model.depth(x) * bedScale;
    const Y = x => still - model.elevation(x, seconds) * relief;
    const step = w < 600 ? 1 : 2;

    // Sea floor and water share the horizontal scale; their vertical scales differ.
    const water = ctx.createLinearGradient(0, still - 90, 0, bottom);
    water.addColorStop(0, '#41796e'); water.addColorStop(.45, '#24515a'); water.addColorStop(1, '#163b48');
    ctx.beginPath(); ctx.moveTo(left, Y(0));
    for (let px = left; px <= right; px += step) ctx.lineTo(px, Y((px - left) / (right - left) * M.LENGTH));
    ctx.lineTo(right, Y(M.LENGTH));
    for (let px = right; px >= left; px -= step) ctx.lineTo(px, B((px - left) / (right - left) * M.LENGTH));
    ctx.closePath(); ctx.fillStyle = water; ctx.fill();

    for (let km = 0; km <= M.LENGTH; km += 100) {
      line(ctx, X(km), 24, X(km), bottom + 3, '#a2cbc01a');
      if (w > 550 || km % 300 === 0) text(ctx, String(km), X(km), bottom + 20, '#97b2b0', 9, 'center');
    }
    for (let offset = 0; offset <= 2; offset++) {
      ctx.beginPath(); ctx.moveTo(left, B(0) + offset * 7);
      for (let px = left; px <= right; px += 3) ctx.lineTo(px, B((px-left)/(right-left)*M.LENGTH) + offset * 7);
      ctx.strokeStyle = offset === 0 ? '#839b89' : '#66817255'; ctx.lineWidth = offset === 0 ? 1.5 : .7; ctx.stroke();
    }
    line(ctx, left, still, right, still, '#b6d5c552', 1, [3,5]);
    text(ctx, 'STILL WATER', left, still - 9, '#8eafaa', 8);
    text(ctx, '4,000 m', X(80), B(80) - 12, '#a5bdb3', 10);
    text(ctx, model.shelfDepth === M.DEEP ? '4,000 m' : `${fmt(model.shelfDepth)} m shelf`, right, B(M.LENGTH) + 30, '#c1c8ad', 10, 'right');
    text(ctx, 'DISTANCE / KM', right, h - 1, '#708f91', 8, 'right');
    if (w > 550) text(ctx, model.shelfDepth === M.DEEP ? 'UNIFORM DEPTH' : 'CONTINENTAL SLOPE', X(460), bottom - 3, '#89a59d', 8, 'center');

    ctx.beginPath(); ctx.moveTo(left, Y(0));
    for (let px = left; px <= right; px += 1) ctx.lineTo(px, Y((px-left)/(right-left)*M.LENGTH));
    ctx.strokeStyle = '#b6e4c7'; ctx.lineWidth = 2; ctx.stroke();
    const cx = X(s.x), cy = Y(s.x);
    line(ctx, cx, cy + 9, cx, Math.max(cy + 10, B(s.x) - 3), '#efaa7b88', 1, [2,4]);
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.fillStyle = '#f1a977'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2); ctx.strokeStyle = '#f1a97766'; ctx.lineWidth = 1; ctx.stroke();
    const high = cy < 55, align = high ? 'right' : 'center';
    const labelX = high ? M.clamp(cx - 18, left + 76, right) : M.clamp(cx, left + 54, right - 54);
    const labelY = high ? Math.max(16, cy - 7) : cy - 30;
    text(ctx, `${fmt(s.x)} KM →`, labelX, labelY, '#f1b88e', 10, align);
    text(ctx, 'MARKED CREST', labelX, labelY + 13, '#b7bfb0', 7, align);
  }
  function drawSpacing(s) {
    const {ctx, w, h} = canvasContext(spacing);
    const deepWave = M.speed(M.DEEP) * M.PERIOD / 1000;
    const start = w < 420 ? 72 : 102, end = w - 48, available = end - start;
    const rows = [{y:33, label:'DEEP OCEAN', length:deepWave, color:'#728d91'},
                  {y:94, label:'AT CREST', length:s.wavelength, color:'#bd5b36'}];
    rows.forEach(row => {
      const width = available * row.length / deepWave;
      text(ctx, row.label, 0, row.y + 3, row.color, w < 420 ? 7 : 8);
      line(ctx, start, row.y, end, row.y, '#bdc8bf', .7);
      ctx.beginPath();
      for (let i=0; i<=160; i++) {
        const x = start + width*i/160, y = row.y - Math.cos(2*Math.PI*i/160) * 13;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.strokeStyle = row.color; ctx.lineWidth = 1.8; ctx.stroke();
      line(ctx, start, row.y+21, start+width, row.y+21, row.color, .7);
      line(ctx, start, row.y+18, start, row.y+24, row.color, .7);
      line(ctx, start+width, row.y+18, start+width, row.y+24, row.color, .7);
      text(ctx, `${fmt(row.length,1)}`, w, row.y + 3, row.color, 10, 'right');
    });
    text(ctx, 'KM', w, h - 3, '#65767a', 7, 'right');
  }
  function render() {
    const s = model.snapshot(seconds);
    $('speed').textContent = fmt(s.speed, 0);
    $('speed-note').textContent = `${fmt(M.speed(M.DEEP)*3.6)} km/h in the deep ocean`;
    $('amplitude').textContent = fmt(s.amplitude, 2);
    $('gain').textContent = `${fmt(s.gain,2)}×`;
    $('wavelength').textContent = fmt(s.wavelength, 1);
    $('crest-depth').textContent = `${fmt(s.depth)} m`;
    $('time').max = (model.endTime / 60).toFixed(4);
    $('time').value = seconds / 60;
    $('time').setAttribute('aria-valuetext', `${fmt(seconds/60,1)} minutes`);
    $('clock').textContent = `${fmt(seconds/60,1)} min`;
    $('phase').textContent = model.shelfDepth === M.DEEP ? 'DEEP ALL THE WAY' : s.x < M.SLOPE_START ? 'IN DEEP WATER' : s.x < M.SLOPE_END ? 'CROSSING THE SLOPE' : 'OVER THE SHELF';
    drawOcean(s); drawSpacing(s);
  }
  function setPlaying(value) {
    playing = value; last = 0;
    $('play').innerHTML = playing ? '<span aria-hidden="true">Ⅱ</span> Pause wave' : '<span aria-hidden="true">▶</span> Play wave';
    $('play').setAttribute('aria-label', playing ? 'Pause wave' : 'Play wave');
  }
  function setDepth(value) {
    const x = model.position(seconds);
    model = M.create(value); seconds = model.travelTime(x);
    $('depth').value = model.shelfDepth;
    $('depth-value').innerHTML = `${fmt(model.shelfDepth)} <small>m</small>`;
    $('depth').setAttribute('aria-valuetext', `${fmt(model.shelfDepth)} metres`);
    document.querySelectorAll('[data-depth]').forEach(button => button.setAttribute('aria-pressed', +button.dataset.depth === model.shelfDepth));
    render();
  }
  $('play').addEventListener('click', () => {
    if (seconds >= model.endTime - .01) seconds = 0;
    setPlaying(!playing); render();
  });
  $('reset').addEventListener('click', () => {setPlaying(false); seconds=0; render();});
  $('time').addEventListener('input', event => {setPlaying(false); seconds=M.clamp(+event.target.value*60, 0, model.endTime); render();});
  $('depth').addEventListener('input', event => setDepth(+event.target.value));
  document.querySelectorAll('[data-depth]').forEach(button => button.addEventListener('click', () => setDepth(+button.dataset.depth)));
  $('shelf-jump').addEventListener('click', () => {setPlaying(false); seconds=model.travelTime(760); render();});
  document.addEventListener('visibilitychange', () => {last=0;});
  function tick(timestamp) {
    if (playing && !document.hidden) {
      if (last) seconds = Math.min(model.endTime, seconds + Math.min((timestamp-last)/1000,.1) * model.endTime / 30);
      last=timestamp;
      if (seconds >= model.endTime) setPlaying(false);
      render();
    }
    requestAnimationFrame(tick);
  }
  new ResizeObserver(render).observe(document.querySelector('.sea-panel'));
  window.longWaveApp = { getState: () => ({...model.snapshot(seconds), shelfDepth:model.shelfDepth, playing, endTime:model.endTime}) };
  render(); requestAnimationFrame(tick);
})();
