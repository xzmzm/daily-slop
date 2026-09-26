/* app.js — draws Locomotion No. 1, wires the controls, animates the 1825 route. */

'use strict';

(function () {
  const C = window.LOCO_CORE;
  const scene = document.getElementById('scene');
  const route = document.getElementById('route');
  const sctx = scene.getContext('2d');
  const rctx = route.getContext('2d');

  const INK = '#2b2620', SOFT = '#5a4f40', VERM = '#b23a2f', PRUSS = '#274b69',
        PAPER = '#f6efdd', IRON = '#4a423a', BRASS = '#a3873a', ROPE = '#8a6d3b',
        HORSE = '#7d5a3c';

  // ---------- state ----------
  const ui = { grade: 0, wagons: 12, rail: 'dry', sand: false };
  const run = {
    v: 0, wheelTurns: 0, slip: false, moving: false,
    smoke: [], lastChuff: 0, idleT: 0, autoplay: true,
  };
  let routeT = -1, routeHold = 0;

  const $ = (id) => document.getElementById(id);
  const fmtLb = (v) => Math.round(v).toLocaleString('en-US') + ' lb';
  function gradeText(g) {
    if (Math.abs(g) < 0.01) return 'level';
    const n = Math.round(100 / Math.abs(g));
    return g > 0 ? `1 in ${n} up` : `1 in ${n} down`;
  }

  function forces() {
    return C.computeForces({
      grade: ui.grade / 100, wagons: ui.wagons, condition: ui.rail, sand: ui.sand,
    });
  }

  // ---------- canvas plumbing ----------
  function fitCanvas(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const attrW = +cv.getAttribute('width'), attrH = +cv.getAttribute('height');
    const cssW = cv.clientWidth || attrW;
    const cssH = cv.clientHeight || Math.round(cssW * attrH / attrW); // CSS may force a height
    if (cv.width !== Math.round(cssW * dpr) || cv.height !== Math.round(cssH * dpr)) {
      cv.width = Math.round(cssW * dpr);
      cv.height = Math.round(cssH * dpr);
    }
    return [cssW, cssH, dpr];
  }

  const WHEEL_R = 25, COUPLER = 11;

  function drawWheel(ctx, x, y, r, angle, fill) {
    ctx.save(); ctx.translate(x, y);
    ctx.lineWidth = 2.2; ctx.strokeStyle = INK;
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = angle + i * Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2)); ctx.stroke();
    }
    ctx.restore();
  }

  /* The engine, rail contact at (0,0), facing right. */
  function drawLoco(ctx, wheelTurns) {
    const wheelX = [-84, -30, 32, 84];
    const angle = wheelTurns * Math.PI * 2;
    const pin = (x) => [x + Math.cos(angle + Math.PI / 2) * COUPLER,
                        Math.sin(angle + Math.PI / 2) * COUPLER];

    // coupling rod links all four drivers — every wheel a driving wheel
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath();
    const p0 = pin(wheelX[0]);
    ctx.moveTo(p0[0], p0[1]);
    for (let i = 1; i < 4; i++) { const p = pin(wheelX[i]); ctx.lineTo(p[0], p[1]); }
    ctx.stroke();

    for (const x of wheelX) drawWheel(ctx, x, 0, WHEEL_R, angle, IRON);

    // frame
    ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.rect(-112, -44, 224, 20); ctx.fill(); ctx.stroke();

    // boiler (single-flue, 1825: no fire tubes yet)
    ctx.fillStyle = IRON;
    ctx.beginPath();
    ctx.moveTo(-100, -92); ctx.lineTo(96, -92);
    ctx.quadraticCurveTo(118, -92, 118, -72);
    ctx.quadraticCurveTo(118, -52, 96, -52);
    ctx.lineTo(-100, -52); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = BRASS; ctx.lineWidth = 2;
    for (const bx of [-70, -20, 30]) {
      ctx.beginPath(); ctx.moveTo(bx, -91); ctx.lineTo(bx, -53); ctx.stroke();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4;

    // tall chimney with spark-arresting cap
    ctx.fillStyle = IRON;
    ctx.beginPath();
    ctx.moveTo(92, -92); ctx.lineTo(98, -150); ctx.lineTo(88, -150);
    ctx.lineTo(82, -92); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(84, -150); ctx.lineTo(102, -150);
    ctx.lineTo(106, -162); ctx.lineTo(80, -162); ctx.closePath(); ctx.fill(); ctx.stroke();

    // dome and safety valve
    ctx.beginPath(); ctx.ellipse(-4, -92, 13, 9, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-48, -92, 6, 5, 0, Math.PI, 0); ctx.fill(); ctx.stroke();

    // vertical cylinder, half-embedded at the front, slightly inclined
    ctx.save(); ctx.translate(64, -74); ctx.rotate(0.22);
    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.rect(-13, -34, 26, 44);
    ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip(); // hatching so it reads as machinery, not sky
    ctx.strokeStyle = 'rgba(43,38,32,.5)'; ctx.lineWidth = 1;
    for (let hx = -20; hx < 22; hx += 5) {
      ctx.beginPath(); ctx.moveTo(hx, 12); ctx.lineTo(hx + 14, -36); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.beginPath();
    const lead = pin(wheelX[3]);
    ctx.moveTo(58, -80);
    ctx.lineTo(lead[0], lead[1] - 4); ctx.stroke();
    ctx.lineWidth = 2.4;

    // rear bunker with coal
    ctx.fillStyle = VERM;
    ctx.beginPath(); ctx.rect(-148, -74, 44, 30); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(-144, -74);
    for (let i = 0; i <= 6; i++) ctx.lineTo(-144 + i * 7.2, -74 - 6 - (i % 2 ? 3 : 0));
    ctx.lineTo(-106, -74); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PAPER; ctx.font = '700 10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('No 1', -126, -54);
    ctx.textAlign = 'left';
  }

  function drawWagon(ctx, x, seated) {
    ctx.save(); ctx.translate(x, 0);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = PAPER;
    ctx.beginPath(); // the chaldron's V
    ctx.moveTo(-30, -34); ctx.lineTo(30, -34); ctx.lineTo(14, -8);
    ctx.lineTo(-14, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (seated) {
      ctx.fillStyle = SOFT;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc(-21 + i * 14, -40, 3.4, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.moveTo(-28, -34);
      for (let i = 0; i <= 6; i++) ctx.lineTo(-28 + i * 9.3, -34 - 5 - (i % 2 ? 2.5 : 0));
      ctx.lineTo(28, -34); ctx.closePath(); ctx.fill();
    }
    drawWheel(ctx, -18, 0, 10, 0, IRON);
    drawWheel(ctx, 18, 0, 10, 0, IRON);
    ctx.restore();
  }

  // ---------- smoke ----------
  function puff(x, y, strong) {
    run.smoke.push({
      x: x + Math.random() * 6, y, r: 5 + Math.random() * 3,
      a: strong ? 0.5 : 0.32, vx: -0.55 - run.v * 0.05, vy: -0.5 - Math.random() * 0.5,
    });
  }

  // ---------- scene ----------
  function drawScene(dt) {
    const [w, h, dpr] = fitCanvas(scene);
    const ctx = sctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // sky hatch + distant fells
    ctx.strokeStyle = 'rgba(43,38,32,.06)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 9) {
      ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, h); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(43,38,32,.08)';
    ctx.beginPath(); ctx.moveTo(0, 132);
    ctx.quadraticCurveTo(w * 0.22, 78, w * 0.42, 126);
    ctx.quadraticCurveTo(w * 0.62, 86, w * 0.8, 122);
    ctx.quadraticCurveTo(w * 0.9, 104, w, 118);
    ctx.lineTo(w, 150); ctx.lineTo(0, 150); ctx.closePath(); ctx.fill();

    const angle = Math.atan2(ui.grade, 100);
    const tx = w * 0.30, ty = h - 66;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(-angle);

    // stone-block sleepers — the S&DR's original paving
    ctx.fillStyle = 'rgba(43,38,32,.16)';
    for (let x = -w * 0.34; x < w * 0.75; x += 30) ctx.fillRect(x, 2, 22, 12);
    ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-w * 0.34, 0); ctx.lineTo(w * 0.75, 0); ctx.stroke();

    // grade annotation
    if (Math.abs(ui.grade) >= 0.25) {
      const c = ui.grade > 0 ? VERM : PRUSS;
      ctx.strokeStyle = c; ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(-190, 0); ctx.lineTo(60, 0); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(-190, 0); ctx.lineTo(-190, -172); ctx.stroke();
      ctx.fillStyle = c; ctx.font = '700 13px Georgia, serif';
      ctx.fillText(gradeText(ui.grade), -190, -186);
    }

    drawLoco(ctx, run.wheelTurns);
    let x = -152, hidden = 0;
    const seatedAll = ui.wagons >= 21;
    for (let i = 0; i < ui.wagons; i++) {
      x -= 92;
      if (x < -tx + 60) { hidden = ui.wagons - i; break; }
      drawWagon(ctx, x, seatedAll && i < 21);
    }
    ctx.restore();

    if (hidden > 0) {
      ctx.fillStyle = SOFT; ctx.font = '700 13.5px Georgia, serif';
      ctx.fillText(`+ ${hidden} more wagons trail off west …`, 14, h - 92);
    }

    // chimney mouth in screen space (for the puffs)
    const m = new DOMMatrix().translateSelf(tx, ty).rotateSelf(-angle * 180 / Math.PI);
    const mouth = m.transformPoint(new DOMPoint(94, -166));

    // grit when slipping
    if (run.slip) {
      ctx.fillStyle = 'rgba(178,58,47,.75)';
      for (let i = 0; i < 30; i++) {
        ctx.fillRect(mouth.x - 130 + Math.random() * 210,
                     ty - 4 - Math.random() * 30, 2.4, 2.4);
      }
      ctx.fillStyle = VERM; ctx.font = '800 20px Georgia, serif';
      ctx.fillText('WHEELSPIN — SAND IT', tx + 20, ty - 78);
    }

    // emit: 4 chuffs per wheel turn (two double-acting cylinders); idle ticks over
    const beats = Math.floor(run.wheelTurns * 4);
    if ((run.moving || run.slip) && beats > run.lastChuff) {
      puff(mouth.x, mouth.y, run.slip); run.lastChuff = beats;
    } else if (!run.moving) {
      run.idleT += dt;
      if (run.idleT > 1.1) { puff(mouth.x, mouth.y, false); run.idleT = 0; }
    }
    for (const s of run.smoke) {
      s.x += s.vx * dt * 60; s.y += s.vy * dt * 60;
      s.r += dt * 9; s.a -= dt * (run.slip ? 0.10 : 0.06);
    }
    run.smoke = run.smoke.filter(s => s.a > 0.02);
    for (const s of run.smoke) {
      ctx.fillStyle = `rgba(43,38,32,${s.a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = 'rgba(43,38,32,.45)'; ctx.font = '11.5px Georgia, serif';
    ctx.fillText('Stockton & Darlington Railway — opened 27 September 1825', 12, h - 10);
  }

  // ---------- route strip ----------
  const RM = { l: 46, r: 16, t: 20, b: 34 };

  function routeXY(mile, w, h) {
    const x = RM.l + (mile / C.ROUTE.totalMiles) * (w - RM.l - RM.r);
    const y = h - RM.b - ((C.elevAt(mile) - 10) / 440) * (h - RM.t - RM.b);
    return [x, y];
  }

  function drawRoute() {
    const [w, h, dpr] = fitCanvas(route);
    const ctx = rctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.moveTo(...routeXY(0, w, h));
    for (let m = 0; m <= C.ROUTE.totalMiles; m += 0.1) ctx.lineTo(...routeXY(m, w, h));
    ctx.lineTo(w - RM.r, h - RM.b); ctx.lineTo(RM.l, h - RM.b); ctx.closePath();
    ctx.fillStyle = 'rgba(43,38,32,.07)'; ctx.fill();

    for (const seg of C.ROUTE.segments) {
      ctx.strokeStyle = seg.mode === 'rope' ? ROPE : seg.mode === 'horse' ? HORSE : VERM;
      ctx.lineWidth = seg.mode === 'loco' ? 3.4 : 3;
      ctx.setLineDash(seg.mode === 'horse' ? [7, 4] : []);
      ctx.beginPath();
      ctx.moveTo(...routeXY(seg.from, w, h));
      ctx.lineTo(...routeXY(seg.to, w, h));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.fillStyle = SOFT; ctx.font = '10.5px Georgia, serif';
    ctx.strokeStyle = 'rgba(43,38,32,.22)'; ctx.lineWidth = 1;
    for (const e of [100, 200, 300, 400]) {
      const y = h - RM.b - ((e - 10) / 440) * (h - RM.t - RM.b);
      ctx.beginPath(); ctx.moveTo(RM.l, y); ctx.lineTo(w - RM.r, y); ctx.stroke();
      ctx.fillText(e + ' ft', 8, y + 3);
    }
    // named points, hand-placed so the left-hand cluster never collides
    const LABELS = [
      { rot: -0.55, dx: 4, dy: -12, anchor: 'left' },   // Phoenix Pit — up the bank
      { rot: 0.55, dx: 0, dy: 16, anchor: 'left' },     // Gaunless — below the valley
      { rot: -0.12, dx: -6, dy: -18, anchor: 'right' }, // Brusselton — above the summit
      { rot: 0.45, dx: 0, dy: 18, anchor: 'left' },     // Mason's Arms — below
      { rot: 0.12, dx: 4, dy: -13, anchor: 'left' },    // Darlington
      { rot: 0, dx: -4, dy: -13, anchor: 'right' },     // Stockton
    ];
    C.ROUTE.points.forEach((p, i) => {
      const [x, y] = routeXY(p.mile, w, h);
      const L = LABELS[i];
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(x + L.dx, y + L.dy);
      ctx.rotate(L.rot);
      ctx.font = '700 11px Georgia, serif';
      ctx.textAlign = L.anchor;
      ctx.fillText(p.name, 0, 0);
      ctx.restore();
      ctx.textAlign = 'left';
    });
    for (const ev of C.ROUTE.events) {
      const [x, y] = routeXY(ev.mile, w, h);
      ctx.strokeStyle = PRUSS; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x, y - 12, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x, y - 1); ctx.stroke();
    }

    if (routeT >= 0) {
      const [x, y] = routeXY(routeT, w, h);
      ctx.strokeStyle = 'rgba(178,58,47,.45)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(...routeXY(0, w, h)); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = VERM; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 26); ctx.lineTo(x + 9, y - 26); ctx.lineTo(x + 9, y - 33);
      ctx.lineTo(x + 14, y - 33); ctx.lineTo(x + 14, y - 23); ctx.lineTo(x - 9, y - 23);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      for (const dx of [-6, 6]) {
        ctx.beginPath(); ctx.arc(x + dx, y - 21, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = INK; ctx.fill();
      }
    }
  }

  // ---------- opening-day replay ----------
  const cap = $('route-cap');
  function replayTick(dt) {
    if (routeT < 0) return;
    if (routeHold > 0) { routeHold -= dt; return; }
    const seg = C.segmentAt(routeT);
    const speed = seg.mode === 'loco' ? 1.7 : seg.mode === 'rope' ? 0.85 : 0.6;
    const before = routeT;
    routeT = Math.min(C.ROUTE.totalMiles, routeT + speed * dt);
    for (const ev of C.ROUTE.events) {
      if (ev.mile > before && ev.mile <= routeT) {
        routeHold = 1.5;
        cap.innerHTML = `<b>${ev.title}.</b> ${ev.text}`;
      }
    }
    if (routeT >= C.ROUTE.totalMiles) {
      routeHold = 1.5;
      const done = routeT;
      routeT = C.ROUTE.totalMiles;
      if (done >= C.ROUTE.totalMiles - 0.001 && !replayTick.finished) {
        replayTick.finished = true;
      }
      setTimeout(() => {
        routeT = -1; replayTick.finished = false;
        cap.textContent = 'Rope · horse · locomotive — three powers, one train.';
      }, 1600);
    }
  }

  // ---------- controls ----------
  function refresh() {
    const f = forces();

    $('grade-out').textContent = gradeText(ui.grade);
    $('wagons-out').textContent = `${ui.wagons} wagon${ui.wagons === 1 ? '' : 's'}`;
    $('tons-out').textContent = `train ${f.tons.toFixed(1)} long tons`;
    $('adh-mu').textContent = `μ ${C.muWithSand(ui.rail, ui.sand).toFixed(2)} ${ui.rail}${ui.sand ? ' + sand' : ''}`;

    const scale = Math.max(4200, f.adhesion, f.demand, C.TE0);
    $('bar-adh').style.width = (f.adhesion / scale * 100) + '%';
    $('bar-te').style.width = (C.TE0 / scale * 100) + '%';
    $('bar-demand').style.width = (Math.max(0, f.demand) / scale * 100) + '%';
    $('bar-demand').parentElement.classList.toggle(
      'over', f.demand > 0 && f.demand > Math.min(f.adhesion, C.TE0));
    $('val-adh').textContent = fmtLb(f.adhesion);
    $('val-te').textContent = fmtLb(C.TE0);
    $('val-demand').textContent = fmtLb(Math.max(0, f.demand));
    $('need-split').textContent = `rolling ${fmtLb(f.rolling)} + grade ${fmtLb(f.gradeLb)}`;

    const lamp = $('lamp'), verdict = $('verdict'), note = $('regime-note');
    if (f.regime === 'runs') {
      lamp.dataset.regime = 'runs';
      verdict.textContent = 'Steam ahead';
      const spare = Math.min(f.adhesion, C.TE0) - f.demand;
      note.innerHTML = `Wheels bite with <b>${fmtLb(Math.max(0, spare))}</b> to spare — that margin is acceleration.`;
    } else if (f.regime === 'coasting') {
      lamp.dataset.regime = 'coasting';
      verdict.textContent = 'Coasting — gravity hauls';
      note.innerHTML = `The falling grade hands back <b>${fmtLb(-f.gradeLb)}</b> of pull; the cylinders can rest. Loaded coal ran downhill to the sea.`;
    } else if (f.regime === 'slips') {
      lamp.dataset.regime = 'slips';
      verdict.textContent = 'Wheelspin';
      note.innerHTML = `<b>Wheelspin.</b> The rail can only hand over μ × 14,560 lb = <b>${fmtLb(f.adhesion)}</b>. Sand it — or lighten the train.`;
    } else {
      lamp.dataset.regime = 'stalls';
      verdict.textContent = 'Stalls — pull too small';
      note.innerHTML = `<b>Grip holds</b> (up to ${fmtLb(f.adhesion)}) but the cylinders only make <b>${fmtLb(C.TE0)}</b>. Fewer wagons, gentler grade — or a stationary engine and a rope.`;
    }

    const rows = [
      [0, 'Level'], [0.5, '1 in 200 — main line'], [1, '1 in 100'], [2, '1 in 50'],
      [3.03, '1 in 33 — the inclines'], [10, '1 in 10'],
    ];
    $('ladder').innerHTML = rows.map(([g, label]) => {
      const n = C.maxWagons(g / 100);
      const cell = n === Infinity ? 'any' : n <= 0 ? "can't start" : `${n} wagon${n === 1 ? '' : 's'}`;
      return `<tr class="${n <= 0 ? 'bad' : ''}"><td>${label}</td><td>${cell}</td></tr>`;
    }).join('');
  }

  function bind() {
    $('grade').addEventListener('input', (e) => { ui.grade = +e.target.value; refresh(); });
    $('wagons').addEventListener('input', (e) => { ui.wagons = +e.target.value; refresh(); });
    document.querySelectorAll('.presets button[data-g]').forEach((b) => b.addEventListener('click', () => {
      ui.grade = +b.dataset.g; $('grade').value = ui.grade; refresh();
    }));
    document.querySelectorAll('.presets button[data-w]').forEach((b) => b.addEventListener('click', () => {
      ui.wagons = +b.dataset.w; $('wagons').value = ui.wagons; refresh();
    }));
    $('rail-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      ui.rail = b.dataset.rail;
      document.querySelectorAll('#rail-seg button').forEach((x) => x.classList.toggle('on', x === b));
      refresh();
    });
    $('sand').addEventListener('change', (e) => { ui.sand = e.target.checked; refresh(); });
    $('replay').addEventListener('click', playOpeningDay);
  }

  function playOpeningDay() {
    routeT = 0; routeHold = 0;
    cap.textContent = 'Phoenix Pit — first the coal is let down Etherley bank by rope…';
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (run.autoplay) tick(dt);
    requestAnimationFrame(frame);
  }

  function tick(dt) {
    C.step(run, forces(), dt);
    $('mph').textContent = run.v.toFixed(1);
    $('chuff-note').textContent = run.moving
      ? `chuff ${(run.v * 0.467).toFixed(1)}/s` : '';
    drawScene(dt);
    replayTick(dt);
    drawRoute();
  }

  bind(); refresh(); playOpeningDay();
  // warm start: a 50-ton train takes minutes to gather way behind 1,000 lb,
  // so open with the train already rolling a few mph and a smoke trail built.
  run.v = 4.5; run.wheelTurns = 14;
  for (let i = 0; i < 140; i++) tick(1 / 30);
  requestAnimationFrame(frame);

  // test / recording hooks
  window.sdr = {
    ui, run,
    get forces() { return forces(); },
    setAutoplay(v) { run.autoplay = !!v; },
    tick,
    playOpeningDay,
    set(p) { Object.assign(ui, p); refresh(); },
  };
})();
