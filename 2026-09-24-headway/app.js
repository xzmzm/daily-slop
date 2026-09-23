(function () {
  const H = window.HeadwayCore;
  const { PLACES } = H;
  const $ = (s) => document.querySelector(s);
  const canvas = $('#map');
  const ctx = canvas.getContext('2d');

  // Map frame in kilometres, 5 km squares, with room west of Élancourt for drift.
  const VIEW = { x0: -38, x1: 5, y0: -17, px: 1170 / 43 };
  VIEW.y1 = VIEW.y0 + 630 / VIEW.px;
  VIEW.w = VIEW.x1 - VIEW.x0; VIEW.h = VIEW.y1 - VIEW.y0;
  const toPx = (x, y) => [(x - VIEW.x0) * VIEW.px, (VIEW.y1 - y) * VIEW.px];
  const SIM_HOURS_PER_SECOND = 0.2; // twelve flight minutes per real second
  const DAYLIGHT_HOURS = 8;
  const ARRIVE_KM = 0.25;

  const PRESETS = {
    out: { leg: 'out', windSpeed: 4, windFrom: 68, power: 3, steer: 'auto' },
    home: { leg: 'home', windSpeed: 12, windFrom: 68, power: 3, steer: 'auto' },
    cross: { leg: 'out', windSpeed: 7, windFrom: 340, power: 3, steer: 'auto' },
    calm: { leg: 'out', windSpeed: 0, windFrom: 68, power: 3, steer: 'auto' },
  };

  const state = {
    preset: 'out', leg: 'out', windSpeed: 4, windFrom: 68, power: 3, steer: 'auto', manualHeading: 248,
    ship: null, trail: [], flying: false, result: null,
  };

  const legPlaces = () => state.leg === 'out'
    ? { start: PLACES.etoile, target: PLACES.elancourt }
    : { start: PLACES.elancourt, target: PLACES.etoile };
  const wind = () => H.windVector(state.windFrom, state.windSpeed);
  const airspeed = () => H.airspeedFromPower(state.power);
  const compass = (deg) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(H.norm360(deg) / 22.5) % 16];

  function resetShip() {
    const { start, target } = legPlaces();
    const course = H.bearingOf([target.x - start.x, target.y - start.y]);
    state.ship = { x: start.x, y: start.y, t: 0, heading: course, track: course, groundSpeed: 0 };
    state.trail = [[start.x, start.y]];
    state.flying = false;
    state.result = null;
  }

  // ---------- current analysis (used by the triangle, readouts and verdict)
  function analyse() {
    const { target } = legPlaces();
    const s = state.ship;
    const course = H.bearingOf([target.x - s.x, target.y - s.y]);
    const distance = Math.hypot(target.x - s.x, target.y - s.y);
    const va = airspeed();
    const w = wind();
    const solved = va > 0 ? H.solveHeading(course, va, w) : null;
    const heading = state.steer === 'auto' ? (solved ? solved.heading : course) : state.manualHeading;
    const g = H.groundVelocity(heading, va, w);
    const cone = H.reachableCone(va, w);
    return { course, distance, va, w, solved, heading, g, cone, target };
  }

  // ---------- drawing helpers
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function seeded(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const SEINE = [[9, -4.5], [3.7, -2.2], [1.2, -1.3], [-0.4, -2.4], [-2.5, -4.2], [-4.3, -4.0], [-5.5, -2.5], [-5.2, 0.2], [-3.9, 1.3], [-2.8, 1.9], [-1.5, 3.5], [0, 4.8], [-1.3, 6.2], [-3.4, 7.6], [-5.2, 8.2],
    [-6.8, 7.4], [-8.4, 4.8], [-9.5, 2.5], [-11.2, 0.8], [-13.2, 1.6], [-14.2, 3.4], [-15.4, 6], [-16.5, 8]];
  const WOODS = [[-5.4, -6.4, 1.9], [-15.2, -1.8, 2.6], [-10.2, -10.2, 2.2], [-33, -14.6, 2.4], [-27.5, -6.5, 1.5], [-20.5, -3.2, 1.6], [-8.8, -5.4, 1.1]];

  let backdrop = null;
  function buildBackdrop() {
    backdrop = document.createElement('canvas');
    backdrop.width = canvas.width; backdrop.height = canvas.height;
    const b = backdrop.getContext('2d');
    const ink = css('--ink'), soft = css('--ink-soft'), rule = css('--rule'), wet = css('--wind');
    b.fillStyle = css('--paper'); b.fillRect(0, 0, backdrop.width, backdrop.height);
    // Field hatching: little seeded parcels with a direction each.
    const rnd = seeded(1852);
    b.strokeStyle = rule; b.lineWidth = 0.8;
    for (let i = 0; i < 90; i++) {
      const cx = rnd() * backdrop.width, cy = rnd() * backdrop.height;
      const w = 40 + rnd() * 70, h = 26 + rnd() * 44, ang = rnd() * Math.PI;
      b.save(); b.translate(cx, cy); b.rotate(ang); b.beginPath(); b.rect(-w / 2, -h / 2, w, h); b.clip();
      b.globalAlpha = 0.55;
      for (let k = -w; k < w; k += 7) { b.beginPath(); b.moveTo(k, -h); b.lineTo(k + 6, h); b.stroke(); }
      b.restore();
    }
    b.globalAlpha = 1;
    // Woods: stippled tree marks.
    b.fillStyle = soft;
    for (const [x, y, r] of WOODS) {
      const [px, py] = toPx(x, y);
      for (let i = 0; i < r * r * 40; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * VIEW.px;
        b.beginPath(); b.arc(px + Math.cos(a) * d, py + Math.sin(a) * d * 0.8, 1.6, 0, Math.PI * 2); b.fill();
      }
    }
    // 5 km grid.
    b.strokeStyle = rule; b.lineWidth = 1; b.setLineDash([2, 5]);
    for (let x = -35; x <= 5; x += 5) { const [px] = toPx(x, 0); b.beginPath(); b.moveTo(px, 0); b.lineTo(px, backdrop.height); b.stroke(); }
    for (let y = -15; y <= 5; y += 5) { const [, py] = toPx(0, y); b.beginPath(); b.moveTo(0, py); b.lineTo(backdrop.width, py); b.stroke(); }
    b.setLineDash([]);
    // Seine as a smoothed double line.
    const river = () => {
      b.beginPath();
      SEINE.forEach(([x, y], i) => {
        const [px, py] = toPx(x, y);
        if (i === 0) b.moveTo(px, py);
        else { const [qx, qy] = toPx(...SEINE[i - 1]); b.quadraticCurveTo(qx, qy, (qx + px) / 2, (qy + py) / 2); }
      });
    };
    b.lineCap = 'round'; b.lineJoin = 'round';
    river(); b.strokeStyle = wet; b.globalAlpha = 0.5; b.lineWidth = 9; b.stroke();
    river(); b.strokeStyle = css('--paper'); b.globalAlpha = 1; b.lineWidth = 5; b.stroke();
    b.fillStyle = wet; b.font = 'italic 15px ' + css('--serif');
    const [sx, sy] = toPx(-10.6, 2.6); b.fillText('Seine', sx, sy);
    // Places.
    b.fillStyle = ink; b.font = '600 13px ' + css('--sans');
    for (const p of Object.values(PLACES)) {
      const [px, py] = toPx(p.x, p.y);
      const main = p !== PLACES.versailles;
      b.beginPath(); b.arc(px, py, main ? 6 : 4, 0, Math.PI * 2);
      b.fillStyle = main ? ink : soft; b.fill();
      if (main) { b.strokeStyle = css('--paper'); b.lineWidth = 2; b.stroke(); }
      b.fillStyle = main ? ink : soft;
      b.font = (main ? '600 14px ' : 'italic 14px ') + (main ? css('--sans') : css('--serif'));
      const right = p === PLACES.etoile;
      b.textAlign = right ? 'right' : 'left';
      b.fillText(p.name, px + (right ? -12 : 12), py + (p === PLACES.elancourt ? 22 : -10));
    }
    b.textAlign = 'left';
    // Direct line between the two ends.
    const [ax, ay] = toPx(PLACES.etoile.x, PLACES.etoile.y), [ex, ey] = toPx(PLACES.elancourt.x, PLACES.elancourt.y);
    b.strokeStyle = ink; b.globalAlpha = 0.45; b.lineWidth = 1.2; b.setLineDash([8, 6]);
    b.beginPath(); b.moveTo(ax, ay); b.lineTo(ex, ey); b.stroke(); b.setLineDash([]); b.globalAlpha = 1;
    // Scale bar and north arrow.
    b.fillStyle = ink; b.strokeStyle = ink; b.lineWidth = 2;
    const sbx = backdrop.width - 5 * VIEW.px - 70, sby = backdrop.height - 26;
    b.beginPath(); b.moveTo(sbx, sby); b.lineTo(sbx + 5 * VIEW.px, sby); b.stroke();
    for (let k = 0; k <= 5; k += 5) { b.beginPath(); b.moveTo(sbx + k * VIEW.px, sby - 5); b.lineTo(sbx + k * VIEW.px, sby + 5); b.stroke(); }
    b.font = '12px ' + css('--mono'); b.fillText('5 km', sbx + 5 * VIEW.px + 8, sby + 4);
    const nx = backdrop.width - 36, ny = 46;
    b.beginPath(); b.moveTo(nx, ny - 22); b.lineTo(nx + 8, ny + 6); b.lineTo(nx, ny); b.lineTo(nx - 8, ny + 6); b.closePath(); b.fill();
    b.font = '600 13px ' + css('--sans'); b.textAlign = 'center'; b.fillText('N', nx, ny + 24); b.textAlign = 'left';
  }

  // Wind streaks live in km space and drift with the actual wind vector.
  const streakRnd = seeded(924);
  const streaks = Array.from({ length: 110 }, () => ({ x: VIEW.x0 + streakRnd() * VIEW.w, y: VIEW.y0 + streakRnd() * VIEW.h, age: streakRnd() * 3 }));
  function moveStreaks(dt) {
    const w = wind();
    for (const s of streaks) {
      s.x += w[0] * 0.28 * dt; s.y += w[1] * 0.28 * dt; s.age += dt;
      if (s.age > 3 || s.x < VIEW.x0 - 2 || s.x > VIEW.x1 + 2 || s.y < VIEW.y0 - 2 || s.y > VIEW.y1 + 2) {
        s.x = VIEW.x0 + streakRnd() * VIEW.w; s.y = VIEW.y0 + streakRnd() * VIEW.h; s.age = 0;
      }
    }
  }

  function drawShip(x, y, heading) {
    const [px, py] = toPx(x, y);
    ctx.save(); ctx.translate(px, py); ctx.rotate(heading * Math.PI / 180);
    // Local frame: nose points to -y.
    ctx.fillStyle = css('--ink'); ctx.strokeStyle = css('--paper'); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -34); ctx.quadraticCurveTo(14, -4, 0, 28); ctx.quadraticCurveTo(-14, -4, 0, -34); ctx.fill(); ctx.stroke();
    // Seen from above, the sail rudder is a thin blade trailing the keel beam.
    ctx.strokeStyle = css('--red'); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 24); ctx.lineTo(0, 38); ctx.stroke();
    ctx.strokeStyle = css('--paper'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 20); ctx.stroke();
    ctx.fillStyle = css('--paper'); ctx.beginPath(); ctx.arc(0, -20, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw() {
    if (!backdrop) buildBackdrop();
    ctx.drawImage(backdrop, 0, 0);
    // Wind.
    const w = wind(), wl = H.len(w);
    if (wl > 0) {
      ctx.strokeStyle = css('--wind'); ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      const tail = Math.min(1.6, 0.2 + wl * 0.08);
      for (const s of streaks) {
        const fade = Math.min(1, s.age * 2, (3 - s.age) * 2);
        ctx.globalAlpha = 0.55 * Math.max(0, fade);
        const [ax, ay] = toPx(s.x, s.y), [bx, by] = toPx(s.x - w[0] / wl * tail, s.y - w[1] / wl * tail);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ax, ay); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // Trail.
    if (state.trail.length > 1) {
      ctx.strokeStyle = css('--red'); ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath();
      state.trail.forEach(([x, y], i) => { const [px, py] = toPx(x, y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke();
    }
    const a = analyse(), s = state.ship;
    // Reachable cone from the ship: only drawn when the wind outruns the ship.
    if (!a.cone.all && wl > 0) {
      const [cx, cy] = toPx(s.x, s.y);
      ctx.fillStyle = css('--wind'); ctx.globalAlpha = 0.2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      for (let i = 0; i <= 30; i++) {
        const b = a.cone.center - a.cone.halfAngle + (2 * a.cone.halfAngle * i) / 30;
        const v = H.vec(b, 60);
        ctx.lineTo(...toPx(s.x + v[0], s.y + v[1]));
      }
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      const lab = H.vec(a.cone.center, 6);
      const [lx, ly] = toPx(s.x + lab[0], s.y + lab[1]);
      ctx.fillStyle = css('--wind'); ctx.font = 'italic 15px ' + css('--serif'); ctx.textAlign = 'center';
      ctx.fillText('everywhere this ship can go', lx, ly); ctx.textAlign = 'left';
    }
    // Heading line: where the nose points, which differs from where the ship goes.
    const nose = state.flying || state.result ? s.heading : a.heading;
    const [sx, sy] = toPx(s.x, s.y), [hx, hy] = toPx(s.x + H.vec(nose, 3)[0], s.y + H.vec(nose, 3)[1]);
    ctx.strokeStyle = css('--ink'); ctx.globalAlpha = 0.6; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    drawShip(s.x, s.y, nose);
    // Wind badge.
    ctx.fillStyle = css('--wind'); ctx.font = '600 13px ' + css('--sans');
    ctx.fillText(state.windSpeed ? `WIND ${state.windSpeed} km/h FROM ${compass(state.windFrom)}` : 'NO WIND', 22, 30);
  }

  // ---------- the wind triangle
  const svgNS = 'http://www.w3.org/2000/svg';
  const K = 5; // px per km/h
  const P = (v) => [v[0] * K, -v[1] * K];
  function setLine(el, a, b) { el.setAttribute('x1', a[0]); el.setAttribute('y1', a[1]); el.setAttribute('x2', b[0]); el.setAttribute('y2', b[1]); }
  function buildGrid() {
    const g = $('#hodoGrid');
    for (let r = 5; r <= 25; r += 5) {
      const c = document.createElementNS(svgNS, 'circle'); c.setAttribute('r', r * K); c.setAttribute('class', 'hodo-ring'); g.appendChild(c);
      if (r % 10 === 0) { const t = document.createElementNS(svgNS, 'text'); t.setAttribute('x', 3); t.setAttribute('y', -r * K - 3); t.setAttribute('class', 'hodo-label'); t.textContent = `${r} km/h`; g.appendChild(t); }
    }
    for (const [x1, y1, x2, y2] of [[-140, 0, 140, 0], [0, -140, 0, 140]]) {
      const l = document.createElementNS(svgNS, 'line'); setLine(l, [x1, y1], [x2, y2]); l.setAttribute('class', 'hodo-axis'); g.appendChild(l);
    }
    const n = document.createElementNS(svgNS, 'text'); n.setAttribute('x', 4); n.setAttribute('y', -140); n.setAttribute('class', 'hodo-label'); n.textContent = 'N'; g.appendChild(n);
  }

  function drawTriangle(a) {
    const W = P(a.w), G = P(a.g);
    setLine($('#windArrow'), [0, 0], W);
    $('#windArrow').style.display = H.len(a.w) > 0.05 ? '' : 'none';
    setLine($('#airArrow'), W, G);
    $('#airArrow').style.display = a.va > 0.05 ? '' : 'none';
    setLine($('#groundArrow'), [0, 0], G);
    $('#groundArrow').style.display = H.len(a.g) > 0.05 ? '' : 'none';
    const reach = $('#reach'); reach.setAttribute('cx', W[0]); reach.setAttribute('cy', W[1]); reach.setAttribute('r', a.va * K);
    setLine($('#courseRay'), [0, 0], P(H.vec(a.course, 29)));
    let d = '';
    if (!a.cone.all && H.len(a.w) > 0) {
      const pts = [];
      for (let i = 0; i <= 24; i++) pts.push(P(H.vec(a.cone.center - a.cone.halfAngle + (2 * a.cone.halfAngle * i) / 24, 29)));
      d = 'M0 0 ' + pts.map((p) => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + 'Z';
    }
    $('#cone').setAttribute('d', d);
  }

  // ---------- readouts & verdict
  function describe(a) {
    const name = a.target.name.replace('Hippodrome, ', '');
    if (a.va <= 0) return { text: `The fire is out. The ship is a balloon now, drifting ${compass(a.cone.center)} with the wind.`, tone: 'bad' };
    if (state.steer === 'manual') {
      const gl = H.len(a.g);
      return { text: `Nose on ${Math.round(a.heading)}°, but the ship tracks ${Math.round(H.bearingOf(a.g))}° at ${gl.toFixed(1)} km/h. ${name} lies at ${Math.round(a.course)}°.`, tone: '' };
    }
    if (!a.solved) {
      const off = Math.abs(H.signedAngle(a.course - a.cone.center));
      return { text: `Can't be done. A ${state.windSpeed} km/h wind beats a ${a.va.toFixed(1)} km/h ship: only courses within ${a.cone.halfAngle.toFixed(0)}° of downwind are open, and ${name} is ${off.toFixed(0)}° away.`, tone: 'bad' };
    }
    const hours = a.distance / a.solved.groundSpeed;
    const crab = Math.abs(a.solved.crab);
    const side = a.solved.crab > 0 ? 'right' : 'left';
    const crabText = crab < 0.5 ? 'Nose straight down the line' : `Nose ${crab.toFixed(0)}° ${side} of the line`;
    if (hours > DAYLIGHT_HOURS) return { text: `Possible on paper: ${crabText.toLowerCase()}, ${a.solved.groundSpeed.toFixed(1)} km/h over the ground. That's ${H.formatHours(hours)} — past the ${DAYLIGHT_HOURS}-hour day.`, tone: 'bad' };
    return { text: `${crabText}, ${a.solved.groundSpeed.toFixed(1)} km/h over the ground: ${name} in ${H.formatHours(hours)}.`, tone: 'good' };
  }

  function updateUI() {
    const a = analyse();
    $('#windSpeedOut').textContent = `${state.windSpeed} km/h`;
    $('#windFromOut').textContent = `${state.windFrom}° ${compass(state.windFrom)}`;
    $('#powerOut').textContent = `${state.power.toFixed(1)} hp → ${a.va.toFixed(1)} km/h`;
    $('#headingOut').textContent = `${state.manualHeading}°`;
    $('#heading').disabled = state.steer !== 'manual';
    document.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === state.preset)));
    document.querySelectorAll('[data-leg]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.leg === state.leg)));
    document.querySelectorAll('[data-steer]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.steer === state.steer)));
    for (const id of ['windSpeed', 'windFrom', 'power']) $('#' + id).value = state[id];
    $('#heading').value = state.manualHeading;

    // Along-line ground speed is what actually closes the distance.
    const u = H.vec(a.course, 1);
    const closing = a.g[0] * u[0] + a.g[1] * u[1];
    $('#gs').textContent = `${H.len(a.g).toFixed(1)} km/h`;
    $('#crab').textContent = state.steer === 'auto' ? (a.solved ? `${Math.abs(a.solved.crab).toFixed(0)}°` : '—') : `${Math.abs(H.signedAngle(a.heading - a.course)).toFixed(0)}°`;
    $('#eta').textContent = state.result && state.result.tone === 'good' ? 'arrived' : closing > 0.05 ? H.formatHours(a.distance / closing) : 'never';
    drawTriangle(a);

    const v = $('#verdict');
    let msg = describe(a);
    if (state.result) msg = state.result;
    else if (state.flying) msg = { text: `${msg.text} ${a.distance.toFixed(1)} km to go.`, tone: msg.tone };
    v.textContent = msg.text;
    v.className = 'verdict ' + (msg.tone || '');
    $('#clock').textContent = H.formatHours(state.ship.t);
    $('#fly').textContent = state.flying ? 'Drop anchor' : state.result ? 'Fly it again' : state.ship.t > 0 ? 'Keep flying' : 'Cast off';
  }

  // ---------- simulation
  function advance(hours) {
    const { target } = legPlaces();
    const dt = 1 / 120;
    let left = hours;
    while (left > 1e-9 && state.flying) {
      const h = Math.min(dt, left);
      left -= h;
      state.ship = H.step(state.ship, h, { airspeed: airspeed(), wind: wind(), target, auto: state.steer === 'auto', manualHeading: state.manualHeading });
      const last = state.trail[state.trail.length - 1];
      if (Math.hypot(last[0] - state.ship.x, last[1] - state.ship.y) > 0.08) state.trail.push([state.ship.x, state.ship.y]);
      const d = Math.hypot(target.x - state.ship.x, target.y - state.ship.y);
      const name = target.name.replace('Hippodrome, ', '');
      if (d < ARRIVE_KM) {
        state.flying = false;
        state.result = { text: `Landed at ${name} after ${H.formatHours(state.ship.t)}.`, tone: 'good' };
      } else if (state.ship.t >= DAYLIGHT_HOURS) {
        state.flying = false;
        state.result = { text: `Sunset after ${DAYLIGHT_HOURS} hours, still ${d.toFixed(1)} km from ${name}. Time to vent the gas and land in a field.`, tone: 'bad' };
      } else if (state.ship.x < VIEW.x0 || state.ship.x > VIEW.x1 || state.ship.y < VIEW.y0 || state.ship.y > VIEW.y1) {
        state.flying = false;
        state.result = { text: `Blown off the map after ${H.formatHours(state.ship.t)}, ${d.toFixed(1)} km from ${name}.`, tone: 'bad' };
      }
    }
  }

  let last = performance.now();
  let autoplay = true;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!autoplay) { requestAnimationFrame(frame); return; }
    moveStreaks(dt);
    if (state.flying) { advance(dt * SIM_HOURS_PER_SECOND); updateUI(); }
    draw();
    requestAnimationFrame(frame);
  }

  // ---------- controls
  function applyPreset(name) {
    Object.assign(state, PRESETS[name], { preset: name });
    resetShip();
    const a = analyse(); state.manualHeading = Math.round(a.course);
    updateUI();
  }
  const touched = () => { state.preset = null; };
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset)));
  document.querySelectorAll('[data-leg]').forEach((b) => b.addEventListener('click', () => {
    state.leg = b.dataset.leg; touched(); resetShip(); state.manualHeading = Math.round(analyse().course); updateUI();
  }));
  document.querySelectorAll('[data-steer]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.steer === 'manual' && state.steer !== 'manual') state.manualHeading = Math.round(analyse().heading) % 360;
    state.steer = b.dataset.steer; touched(); updateUI();
  }));
  for (const id of ['windSpeed', 'windFrom', 'power']) {
    $('#' + id).addEventListener('input', (e) => { state[id] = Number(e.target.value); touched(); updateUI(); });
  }
  $('#heading').addEventListener('input', (e) => { state.manualHeading = Number(e.target.value); updateUI(); });
  $('#fly').addEventListener('click', () => {
    if (state.result) resetShip();
    state.flying = !state.flying;
    updateUI();
  });
  $('#reset').addEventListener('click', () => { resetShip(); updateUI(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { backdrop = null; });

  buildGrid();
  applyPreset('out');
  requestAnimationFrame(frame);

  window.headway = {
    getState: () => ({ ...state, ship: { ...state.ship }, analysis: analyse() }),
    // Deterministic jump used by the tests and the video renderer.
    // Frame-by-frame clock for recordings: wall seconds, and flight hours per second.
    setAutoplay(on) { autoplay = !!on; },
    tick(seconds, rate = SIM_HOURS_PER_SECOND) { moveStreaks(seconds); if (state.flying) advance(seconds * rate); updateUI(); draw(); },
    fastForward(hours) { const was = state.flying; state.flying = true; advance(hours); if (!state.result) state.flying = was; updateUI(); draw(); },
  };
})();
