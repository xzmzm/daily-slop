(function () {
  const P = window.Overboard;
  const manualClock = Boolean(window.__ftManualClock);
  const $ = (id) => document.getElementById(id);
  const cv = $('view'), ctx = cv.getContext('2d');
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const C = { ink: css('--ink'), dim: css('--dim'), rule: css('--rule'), amber: css('--amber'), green: css('--green'), red: css('--red'), ice: css('--ice'), sky: css('--sky'), paper: css('--paper') };
  const PACE = 0.6; // flight minutes per real second at ×1
  const W = cv.width, H = cv.height, PAD = { l: 58, r: 18, t: 18, b: 34 };
  const X0 = P.START_X, X1 = P.END_X, H1 = 12000;
  const FULL = { x0: X0, x1: X1, h0: 0, h1: H1, l: PAD.l, r: W - PAD.r, t: PAD.t, b: H - PAD.b };
  const INSET = { x0: 38, x1: 53, h0: 8900, h1: 10900, l: 74, r: 444, t: 232, b: 404 };
  let view = FULL;
  const sx = (x) => view.l + (x - view.x0) / (view.x1 - view.x0) * (view.r - view.l);
  const sy = (h) => view.b - (h - view.h0) / (view.h1 - view.h0) * (view.b - view.t);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const signed = (n) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n));

  let f, trail, paused, speed, last;

  // Fixed far-range silhouette so every flight sees the same mountains.
  const RANGE = Array.from({ length: 70 }, (_, i) => {
    const x = X0 + (X1 - X0) * i / 69;
    const base = P.ice(Math.min(x, P.PASS_X)) + 1600 + 900 * Math.sin(i * 1.7) * Math.sin(i * 0.53) + (x > 0 && x < P.PASS_X ? 1400 : 0);
    return [x, base];
  });

  function reset() {
    f = P.createFlight(); trail = [[f.x, f.h]]; paused = false; speed = 1;
    $('pause').textContent = 'Pause'; $('speed').textContent = 'Speed ×1';
    render();
  }

  function advance(minutes) {
    if (minutes <= 0 || f.outcome) return;
    const chunks = Math.max(1, Math.ceil(minutes / 0.2));
    for (let i = 0; i < chunks; i++) { P.step(f, minutes / chunks); trail.push([f.x, f.h]); }
  }

  function drawScene(proj, next) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0f2236'); g.addColorStop(1, C.sky);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // grid
    ctx.font = '12px ui-monospace, Menlo, monospace'; ctx.fillStyle = C.dim; ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    for (let h = 0; h <= H1; h += 2000) {
      ctx.beginPath(); ctx.moveTo(PAD.l, sy(h)); ctx.lineTo(W - PAD.r, sy(h)); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(`${h / 1000}k ft`, PAD.l - 6, sy(h) + 4);
    }
    ctx.textAlign = 'center';
    for (let x = 0; x <= 50; x += 10) ctx.fillText(x === 0 ? 'glacier mouth' : x === 50 ? 'pass' : `mi ${x}`, sx(x), H - 12);

    // far range
    ctx.fillStyle = 'rgba(180, 200, 220, 0.16)'; ctx.beginPath(); ctx.moveTo(sx(X0), sy(0));
    for (const [x, h] of RANGE) ctx.lineTo(sx(x), sy(h)); ctx.lineTo(sx(X1), sy(0)); ctx.fill();

    drawWorld(proj, next, false);

    // close-up of the pass
    const I = INSET;
    ctx.fillStyle = 'rgba(10, 22, 34, 0.92)'; ctx.fillRect(I.l, I.t, I.r - I.l, I.b - I.t);
    ctx.save(); ctx.beginPath(); ctx.rect(I.l, I.t, I.r - I.l, I.b - I.t); ctx.clip();
    view = INSET; drawWorld(proj, next, true); view = FULL;
    ctx.restore();
    ctx.strokeStyle = C.dim; ctx.lineWidth = 1; ctx.strokeRect(I.l, I.t, I.r - I.l, I.b - I.t);
    ctx.fillStyle = C.dim; ctx.textAlign = 'left'; ctx.fillText('close-up: miles 38–53', I.l + 8, I.t + 16);
    ctx.textAlign = 'right'; ctx.fillText('500 ft', I.r - 10, I.t + 16);
    ctx.strokeStyle = C.dim; ctx.beginPath(); ctx.moveTo(I.r - 60, I.t + 10); ctx.lineTo(I.r - 60, I.t + 10 + 500 / (I.h1 - I.h0) * (I.b - I.t)); ctx.stroke();
    ctx.textAlign = 'center';
  }

  function drawWorld(proj, next, close) {
    // sink zone
    ctx.fillStyle = 'rgba(143, 184, 255, 0.10)';
    if (!close) ctx.fillRect(sx(34), PAD.t, sx(P.PASS_X + 2) - sx(34), sy(0) - PAD.t);
    ctx.strokeStyle = 'rgba(143, 184, 255, 0.45)'; ctx.lineWidth = 1.5;
    for (let x = 36; x <= 50 && !close; x += 3) {
      const s = P.sink(x) / 230, y0 = sy(11200);
      ctx.beginPath(); ctx.moveTo(sx(x), y0); ctx.lineTo(sx(x), y0 + 16 + 30 * s);
      ctx.lineTo(sx(x) - 4, y0 + 10 + 30 * s); ctx.moveTo(sx(x), y0 + 16 + 30 * s); ctx.lineTo(sx(x) + 4, y0 + 10 + 30 * s); ctx.stroke();
    }

    // ice
    ctx.fillStyle = C.ice; ctx.beginPath(); ctx.moveTo(sx(X0), sy(view.h0));
    for (let x = X0; x <= X1; x += 0.25) ctx.lineTo(sx(x), sy(P.ice(x)));
    ctx.lineTo(sx(X1), sy(view.h0)); ctx.fill();
    ctx.strokeStyle = '#9fb7c9'; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(sx(P.PASS_X), sy(P.PASS_ICE)); ctx.lineTo(sx(P.PASS_X), view.t + 8); ctx.stroke(); ctx.setLineDash([]);
    if (!close) { ctx.fillStyle = C.dim; ctx.fillText(`pass · ice ${fmt(P.PASS_ICE)} ft`, sx(P.PASS_X), PAD.t + 4); }

    // things thrown out, lying on the ice
    for (const d of f.drops) {
      ctx.fillStyle = d.what === 'food' ? '#8a5a2b' : C.amber;
      const y = sy(P.ice(d.x));
      ctx.fillRect(sx(d.x) - 5, y - 8, 10, 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(sx(d.x), sy(d.h)); ctx.lineTo(sx(d.x), y - 9); ctx.stroke(); ctx.setLineDash([]);
    }

    const line = (pts, color, dash, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath();
      pts.forEach(([x, h], i) => (i ? ctx.lineTo(sx(x), sy(h)) : ctx.moveTo(sx(x), sy(h)))); ctx.stroke(); ctx.setLineDash([]);
    };
    if (!f.outcome && f.x < P.PASS_X) {
      if (next) line(next.path, C.green, [6, 5], 2);
      line(proj.path, C.amber, [8, 6], 2.5);
      if (proj.hit !== null) {
        const hx = sx(proj.hit), hy = sy(P.ice(proj.hit));
        ctx.strokeStyle = C.red; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(hx - 7, hy - 7); ctx.lineTo(hx + 7, hy + 7); ctx.moveTo(hx + 7, hy - 7); ctx.lineTo(hx - 7, hy + 7); ctx.stroke();
      }
    }
    line(trail, C.ink, [], 2.5);
    drawPlane(sx(f.x), sy(f.h), f.outcome && f.outcome.kind === 'ice');
  }

  function drawPlane(x, y, crashed) {
    ctx.save(); ctx.translate(x, y); if (crashed) ctx.rotate(0.5);
    ctx.fillStyle = crashed ? C.red : '#c9d3db'; ctx.strokeStyle = '#0f2236'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-22, -2); ctx.lineTo(14, -4); ctx.lineTo(20, 0); ctx.lineTo(14, 4); ctx.lineTo(-18, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillRect(-6, -7, 16, 3);            // high wing
    ctx.beginPath(); ctx.moveTo(-22, -2); ctx.lineTo(-26, -10); ctx.lineTo(-18, -2); ctx.fill(); // tail
    ctx.fillStyle = '#5b6b78'; ctx.fillRect(18, -3, 4, 6); // nose engine
    ctx.restore();
  }

  function render() {
    const proj = P.project(f);
    const next = f.food > 0 ? P.project(f, P.BAG) : null;
    drawScene(proj, next);
    const above = f.h - P.ice(f.x), wt = P.weight(f), rate = P.climbRate(f.h, wt, f.x), margin = P.fuelMargin(f);
    $('alt').textContent = `${fmt(f.h)} ft`;
    $('above').textContent = `${fmt(above)} ft above ice`;
    $('climb').textContent = `${signed(rate)} fpm`;
    $('climb').className = rate < 0 ? 'bad' : '';
    $('where').textContent = f.x < 0 ? `${(-f.x).toFixed(1)} mi to the glacier` : f.x < P.PASS_X ? `mile ${f.x.toFixed(1)} · ${(P.PASS_X - f.x).toFixed(1)} to the pass` : 'on the plateau';
    const pass = $('pass');
    if (f.cleared !== undefined) { pass.textContent = `${signed(f.cleared)} ft`; pass.className = 'good'; $('passSub').textContent = 'cleared'; }
    else if (proj.hit !== null) { pass.textContent = 'hits ice'; pass.className = 'bad'; $('passSub').textContent = `at mile ${proj.hit.toFixed(1)}, if nothing else goes`; }
    else { pass.textContent = `${signed(proj.clearance)} ft`; pass.className = proj.clearance < 150 ? 'bad' : 'good'; $('passSub').textContent = 'projected clearance'; }
    $('weight').textContent = `${fmt(wt)} lb`;
    $('ceil').textContent = `ceiling about ${fmt(P.ceiling(wt))} ft`;
    $('food').textContent = `${f.food} sack${f.food === 1 ? '' : 's'}`;
    $('foodSub').textContent = `${Math.round(f.food * P.BAG / P.RATION)} days for four if forced down`;
    $('fuel').textContent = `${signed(margin)} lb`;
    $('fuel').className = margin < 0 ? 'bad' : '';
    $('dropFood').disabled = !!f.outcome || f.food === 0;
    $('dropFuel').disabled = !!f.outcome;
    $('turn').disabled = !!f.outcome;
    $('log').innerHTML = f.log.slice().reverse().map((e) =>
      `<li class="${e.cls || ''}"><b>${e.x < 0 ? '−' + (-e.x).toFixed(1) : 'mi ' + e.x.toFixed(1)}</b>${e.text}</li>`).join('');
    const v = $('verdict');
    if (f.outcome) {
      v.hidden = false; v.className = 'verdict' + (f.outcome.ok ? '' : ' bad');
      const o = f.outcome;
      v.innerHTML = '<p>' + ({
        plateau: `Over the pass with ${fmt(o.clearance)} ft to spare and ${o.food} of ${P.BAGS} food sacks aboard (${Math.round(o.food * P.BAG / P.RATION)} days for four). Fuel at the depot: ${signed(o.margin)} lb. The real crew threw out about two sacks.`,
        fuel: `Over the pass with ${fmt(o.clearance)} ft to spare, but ${fmt(-o.margin)} lb short of the fuel needed to get back to the depot.`,
        ice: `The Trimotor could not out-climb the glacier and hit the ice at mile ${o.x.toFixed(1)}.`,
        turn: `Turned back at mile ${o.x.toFixed(1)}. Everyone gets home, nobody reaches the Pole.`,
      })[o.kind] + '</p>';
    } else v.hidden = true;
  }

  function frame(now) {
    if (last !== undefined && !paused) advance(Math.min(0.1, (now - last) / 1000) * PACE * speed);
    last = now; render();
    requestAnimationFrame(frame);
  }

  const act = (type) => { if (P.command(f, type)) render(); };
  $('dropFood').onclick = () => act('food');
  $('dropFuel').onclick = () => act('fuel');
  $('turn').onclick = () => act('turn');
  $('reset').onclick = reset;
  $('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? 'Resume' : 'Pause'; };
  $('speed').onclick = () => { speed = speed === 4 ? 1 : speed * 2; $('speed').textContent = `Speed ×${speed}`; };

  window.__ft = {
    state: () => ({ x: f.x, h: f.h, t: f.t, food: f.food, fuelDumps: f.fuelDumps, cleared: f.cleared, outcome: f.outcome,
      projected: P.project(f).clearance, hit: P.project(f).hit, margin: P.fuelMargin(f) }),
    // Advance the flight by a number of minutes, ignoring the on-page speed (used by the video renderer).
    advance(minutes) { advance(minutes); render(); },
  };

  reset();
  if (!manualClock) requestAnimationFrame(frame);
})();
