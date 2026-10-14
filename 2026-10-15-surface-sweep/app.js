/* Rendering and controls. The model also runs without a DOM in engine.js. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), canvas = $('dish'), ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dish = new Surface.Dish(), kind = 'soap', dose = 1, playing = !reduced, live = true;
  let target = { x: 0, y: 0 }, keyboard = false, last = 0;
  const W = 900, H = 760, CX = 450, CY = 363, R = 294;
  const fieldCanvas = document.createElement('canvas');
  fieldCanvas.width = fieldCanvas.height = Surface.N;
  const fc = fieldCanvas.getContext('2d'), pixels = fc.createImageData(Surface.N, Surface.N);
  function circle(x, y, r, fill, stroke, width = 1) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // A faint notebook grid, a porcelain lip and the water's meniscus.
    ctx.strokeStyle = '#96b59c12'; ctx.lineWidth = 1;
    for (let x = 12; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.save(); ctx.shadowColor = '#29483b26'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 14;
    circle(CX, CY, R + 29, '#fafbf3'); ctx.restore();
    circle(CX, CY, R + 29, null, '#bccaba');
    circle(CX, CY, R + 21, null, '#e0e6d8', 2);
    const water = ctx.createRadialGradient(CX - 90, CY - 100, 0, CX, CY, R);
    water.addColorStop(0, '#f3f4df'); water.addColorStop(.8, '#eaf0da'); water.addColorStop(1, '#d7e5cd');
    circle(CX, CY, R, water, '#a8bd9e', 1.5);
    ctx.save(); ctx.beginPath(); ctx.arc(CX, CY, R - 1, 0, Math.PI * 2); ctx.clip();
    if ($('field').checked) {
      for (let i = 0; i < dish.mask.length; i++) {
        const t = dish.sigma[i], j = i * 4;
        pixels.data[j] = 79 + t * 163; pixels.data[j + 1] = 157 + t * 80;
        pixels.data[j + 2] = 148 + t * 63; pixels.data[j + 3] = dish.mask[i] ? 225 : 0;
      }
      fc.putImageData(pixels, 0, 0);
      ctx.drawImage(fieldCanvas, CX - R, CY - R, R * 2, R * 2);
    }
    if ($('arrows').checked) {
      for (let y = -.8; y <= .8; y += .16) for (let x = -.8; x <= .8; x += .16) {
        if (Math.hypot(x, y) > .88) continue;
        const v = dish.velocity(x, y), speed = Math.hypot(v.x, v.y);
        if (speed < .001) continue;
        const len = Math.min(25, 5 + speed * 120), angle = Math.atan2(v.y, v.x);
        ctx.save(); ctx.translate(CX + x * R, CY + y * R); ctx.rotate(angle);
        ctx.strokeStyle = '#27695db0'; ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.lineTo(len / 2 - 4, -3);
        ctx.moveTo(len / 2, 0); ctx.lineTo(len / 2 - 4, 3); ctx.stroke(); ctx.restore();
      }
    }
    for (const p of dish.pepper) {
      ctx.save(); ctx.translate(CX + p.x * R, CY + p.y * R); ctx.rotate(p.angle);
      ctx.fillStyle = p.tone > .7 ? '#6b6345' : '#363c2d';
      ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * .65, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (const e of dish.events) {
      const age = dish.time - e.time;
      ctx.globalAlpha = Math.max(0, 1 - age / 2);
      circle(CX + e.x * R, CY + e.y * R, 8 + age * 42, null, e.kind === 'soap' ? '#348578' : '#8aafa3', 1.5);
      circle(CX + e.x * R, CY + e.y * R, 2.5, e.kind === 'soap' ? '#226d64' : '#86a99f');
    }
    ctx.globalAlpha = 1;
    if (keyboard || dish.time < .1 || (!dish.drops && dish.events.length === 0)) {
      const x = CX + target.x * R, y = CY + target.y * R;
      ctx.strokeStyle = '#5173678c'; ctx.lineWidth = 1;
      ctx.beginPath();ctx.moveTo(x - 9,y);ctx.lineTo(x + 9,y);ctx.moveTo(x,y - 9);ctx.lineTo(x,y + 9);ctx.stroke();
      circle(x, y, 19, null, '#6b897252');
    }
    ctx.restore();
    // Short instrument marks stay outside the dish.
    ctx.strokeStyle = '#91a48d';ctx.lineWidth=1;
    for(let a=0;a<Math.PI*2;a+=Math.PI/12){
      const inner=R+38,outer=R+(Math.round(a/(Math.PI/12))%3===0?49:43);
      ctx.beginPath();ctx.moveTo(CX+Math.cos(a)*inner,CY+Math.sin(a)*inner);ctx.lineTo(CX+Math.cos(a)*outer,CY+Math.sin(a)*outer);ctx.stroke();
    }
    const s = dish.stats();
    $('cleared').innerHTML = `${s.cleared}<small>%</small>`;
    $('contrast').innerHTML = `${Math.round(s.contrast)}<small>%</small>`;
    $('clock').textContent = `${s.time.toFixed(1).padStart(4, '0')} s`;
    $('drop-count').textContent = `${s.drops} SOAP DROP${s.drops === 1 ? '' : 'S'}`;
  }
  function announce(text) { $('observation').textContent = text; }
  function refreshPause() {
    $('pause').textContent = playing ? 'Ⅱ Pause' : '▷ Resume';
    $('pause').setAttribute('aria-label', playing ? 'Pause experiment' : 'Resume experiment');
  }
  function drop(x, y) {
    if (!dish.drop(x, y, kind, dose)) return;
    keyboard = false;
    if (kind === 'water') announce('Plain water adds no soap gradient here. The brief ring marks your touch.');
    else if (dish.coat) announce('Already soaped: another drop changes the pull much less. Compare it with fresh water.');
    else announce('The soap lowers the pull here. The surrounding surface pulls the pepper outward.');
    if (!playing) announce($('observation').textContent + ' Paused — press Resume or +1s.');
    draw();
  }
  function reset(coat = 0) {
    dish = new Surface.Dish({ coat }); target = { x: 0, y: 0 }; keyboard = false;
    $('coat').classList.toggle('active', !!coat);
    $('fresh').classList.toggle('active', !coat);
    $('surface-note').textContent = coat ? 'Soap everywhere, the same pull everywhere. Try another drop.' : 'A clean surface. The first drop has room to work.';
    announce(coat ? 'An even coating lowers surface tension, but creates no sideways flow by itself.' : 'Fresh water, fresh pepper. Try plain water first, then switch to soap.');
    draw();
  }
  for (const type of ['soap', 'water']) $(type).addEventListener('click', () => {
    kind = type;
    for (const t of ['soap', 'water']) { $(t).classList.toggle('selected', t === kind); $(t).setAttribute('aria-pressed', String(t === kind)); }
    $('dose').disabled = kind === 'water';
  });
  $('dose').addEventListener('input', () => { dose = +$('dose').value; $('dose-value').textContent = `${dose.toFixed(1)}×`; });
  $('drop-center').addEventListener('click', () => drop(0, 0));
  $('fresh').addEventListener('click', () => reset());
  $('coat').addEventListener('click', () => reset(1.2));
  $('pause').addEventListener('click', () => { playing = !playing; refreshPause(); });
  $('step').addEventListener('click', () => { playing = false; refreshPause(); dish.step(1); draw(); });
  for (const id of ['field', 'arrows']) $(id).addEventListener('change', draw);
  function point(event) {
    const b = canvas.getBoundingClientRect();
    // object-fit contains the fixed drawing even in the wide desktop layout.
    const scale = Math.min(b.width / W, b.height / H);
    return { x: ((event.clientX - b.left - (b.width - W * scale) / 2) / scale - CX) / R,
      y: ((event.clientY - b.top - (b.height - H * scale) / 2) / scale - CY) / R };
  }
  canvas.addEventListener('click', e => { const p = point(e); drop(p.x, p.y); });
  canvas.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault(); keyboard = true;
      target.x += e.key === 'ArrowLeft' ? -.1 : e.key === 'ArrowRight' ? .1 : 0;
      target.y += e.key === 'ArrowUp' ? -.1 : e.key === 'ArrowDown' ? .1 : 0;
      const r = Math.hypot(target.x, target.y);
      if (r > .9) { target.x *= .9 / r; target.y *= .9 / r; }
      draw();
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(target.x, target.y); }
  });
  function tick(t) {
    if (live && playing && !document.hidden && last) dish.step(Math.min((t - last) / 1000, .05));
    last = t;
    if (live) draw();
    requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', () => { last = 0; });
  window.sweep = { get state() { return dish; }, reset, draw,
    setLive(value) { live = value; last = 0; },
    advance(seconds) { dish.step(seconds); draw(); },
    get playing() { return playing; }, geometry: { W, H, CX, CY, R } };
  refreshPause(); draw(); requestAnimationFrame(tick);
  if (reduced) announce('Motion is paused for your reduced-motion preference. Add a drop, then use +1s or Resume.');
})();
