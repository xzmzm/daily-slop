/* Luna 2 (1959) — studio wiring. All physics comes from luna2.js (closed form). */
import * as L from './luna2.js';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const MONO = '"SF Mono", Monaco, "Cascadia Code", "Courier New", monospace';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
const fmtHMS = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return `${h} h ${String(m).padStart(2, '0')} m`;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// deterministic PRNG so stars / bursts render identically every frame
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const state = {
  vinf: 1.65,
  timing: 0,      // seconds late (negative = early)
  vp: 11.137,
  phi: 85,
  temp: 500,
  scrub: 480,     // seconds since sodium release
  flying: false,
  burst: null,    // pentagon burst animation state (tab 3)
};

/* label with a dark backing plate so lines can pass underneath legibly */
function text(ctx, str, x, y, col = 'rgba(233,230,220,0.9)', font = `11px ${MONO}`, pad = 4) {
  ctx.font = font;
  const w = ctx.measureText(str).width;
  ctx.fillStyle = 'rgba(5,7,13,0.72)';
  ctx.fillRect(x - pad, y - 10, w + pad * 2, 14);
  ctx.fillStyle = col;
  ctx.fillText(str, x, y);
}

/* =========================== tabs =========================== */
document.querySelectorAll('.nav-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === tab.dataset.tab));
    redrawAll();
  });
});
function setTab(panelId) {
  document.querySelector(`.nav-tab[data-tab="${panelId}"]`)?.click();
}

/* =========================== TAB 1 — the shot =========================== */
const shotCanvas = $('shotCanvas');
const sctx = shotCanvas.getContext('2d');
const VIEW = { ex: 640, ey: 420, orbitPx: 452 };

const px = (r, nu) => [VIEW.ex + (r * VIEW.orbitPx / L.C.ORBIT_R) * Math.cos(nu),
                       VIEW.ey - (r * VIEW.orbitPx / L.C.ORBIT_R) * Math.sin(nu)];
const moonPx = (angle) => [VIEW.ex + VIEW.orbitPx * Math.cos(angle), VIEW.ey - VIEW.orbitPx * Math.sin(angle)];

function shotAim() {
  const A = L.arrivalState(state.vinf);
  return { ...A, theta0: A.nuArr - L.OMEGA_M * (A.tArr - state.timing) };
}

function drawShot(tNow = 0, trailEndNu = null) {
  const A = shotAim();
  const { e, p, tArr, nuArr } = A;
  sctx.clearRect(0, 0, 1000, 540);

  // Moon's orbit
  sctx.strokeStyle = 'rgba(154,167,181,0.28)';
  sctx.setLineDash([2, 5]);
  sctx.beginPath(); sctx.arc(VIEW.ex, VIEW.ey, VIEW.orbitPx, 0, TAU); sctx.stroke();
  sctx.setLineDash([]);

  // the sector the Moon walks during the coast
  const thLaunch = A.theta0;
  sctx.strokeStyle = 'rgba(245,158,66,0.9)';
  sctx.lineWidth = 2.5;
  sctx.beginPath();
  sctx.arc(VIEW.ex, VIEW.ey, VIEW.orbitPx, -nuArr, -thLaunch, false);
  sctx.stroke();
  sctx.lineWidth = 1;
  const [ax, ay] = moonPx(nuArr);
  text(sctx, `THE MOON WALKS ${A.leadDeg.toFixed(1)}°`, ax + 14, ay - 34, 'rgba(245,158,66,0.95)');
  text(sctx, 'WHILE THE PROBE COASTS', ax + 14, ay - 20, 'rgba(245,158,66,0.95)');

  // aim line to empty space
  const [aimX, aimY] = moonPx(nuArr);
  sctx.strokeStyle = 'rgba(106,166,216,0.75)';
  sctx.setLineDash([7, 6]);
  sctx.beginPath(); sctx.moveTo(VIEW.ex, VIEW.ey); sctx.lineTo(aimX, aimY); sctx.stroke();
  sctx.setLineDash([]);
  text(sctx, 'AIM AT EMPTY SPACE — WHERE THE MOON WILL BE', aimX + 18, aimY + 24, 'rgba(106,166,216,0.95)');
  sctx.fillStyle = 'rgba(106,166,216,0.95)';
  sctx.beginPath(); sctx.arc(aimX, aimY, 3, 0, TAU); sctx.fill();

  // trajectory conic r(nu) = p/(1+e cos nu)
  const nuMax = nuArr + 0.22;
  sctx.strokeStyle = 'rgba(233,230,220,0.95)';
  sctx.lineWidth = 1.6;
  sctx.beginPath();
  for (let i = 0; i <= 420; i++) {
    const nu = (nuMax * i) / 420;
    const [x, y] = px(p / (1 + e * Math.cos(nu)), nu);
    if (trailEndNu !== null && nu > trailEndNu) break;
    i === 0 ? sctx.moveTo(x, y) : sctx.lineTo(x, y);
  }
  sctx.stroke();
  sctx.lineWidth = 1;

  // time ticks every 6 h
  sctx.fillStyle = 'rgba(95,108,128,1)';
  sctx.font = `10px ${MONO}`;
  for (let h = 6; h <= 36; h += 6) {
    const s = L.hyperbolaState(state.vinf, h * 3600);
    const [x, y] = px(s.r, s.nu);
    const rr = Math.hypot(x - VIEW.ex, y - VIEW.ey);
    const nx = (x - VIEW.ex) / rr, ny = (y - VIEW.ey) / rr;
    sctx.strokeStyle = 'rgba(95,108,128,0.9)';
    sctx.beginPath(); sctx.moveTo(x - nx * 4, y - ny * 4); sctx.lineTo(x + nx * 4, y + ny * 4); sctx.stroke();
    if (h % 12 === 0) text(sctx, `t+${h} h`, x + nx * 12 - 12, y + ny * 12 + 3, 'rgba(95,108,128,1)', `10px ${MONO}`);
  }

  // sodium marker at t+12 h
  const naS = L.hyperbolaState(state.vinf, 12 * 3600);
  const [nx1, ny1] = px(naS.r, naS.nu);
  sctx.strokeStyle = 'rgba(245,158,66,0.8)';
  sctx.setLineDash([2, 3]);
  sctx.beginPath(); sctx.arc(nx1, ny1, 9, 0, TAU); sctx.stroke();
  sctx.setLineDash([]);
  text(sctx, 'Na CLOUD t+12 h', nx1 + 16, ny1 + 4, 'rgba(245,158,66,0.9)', `10px ${MONO}`);

  // Earth
  const eg = sctx.createRadialGradient(VIEW.ex, VIEW.ey, 1, VIEW.ex, VIEW.ey, 26);
  eg.addColorStop(0, 'rgba(106,166,216,0.9)'); eg.addColorStop(1, 'rgba(106,166,216,0)');
  sctx.fillStyle = eg; sctx.beginPath(); sctx.arc(VIEW.ex, VIEW.ey, 26, 0, TAU); sctx.fill();
  sctx.fillStyle = '#6aa6d8'; sctx.beginPath(); sctx.arc(VIEW.ex, VIEW.ey, 7.6, 0, TAU); sctx.fill();
  text(sctx, 'EARTH', VIEW.ex - 20, VIEW.ey + 30, 'rgba(233,230,220,0.85)');

  // the Moon (now)
  const thMoon = nuArr + L.OMEGA_M * (tNow - tArr);
  const [mx, my] = moonPx(state.flying || tNow > 0 ? thMoon : thLaunch);
  sctx.fillStyle = '#c9c4bb'; sctx.beginPath(); sctx.arc(mx, my, 8, 0, TAU); sctx.fill();
  sctx.fillStyle = 'rgba(90,96,106,1)';
  sctx.beginPath(); sctx.arc(mx + 2.5, my - 2, 1.7, 0, TAU); sctx.fill();
  sctx.beginPath(); sctx.arc(mx - 2, my + 3, 1.2, 0, TAU); sctx.fill();
  sctx.fillStyle = 'rgba(201,196,187,0.9)';
  text(sctx, 'MOON (×4)', mx + 14, my - 10);

  // probe
  const s = L.hyperbolaState(state.vinf, tNow);
  const [sx1, sy1] = px(s.r, s.nu);
  sctx.fillStyle = '#f4efe0';
  sctx.beginPath(); sctx.arc(sx1, sy1, 4, 0, TAU); sctx.fill();
  sctx.strokeStyle = 'rgba(244,239,224,0.35)';
  sctx.beginPath(); sctx.arc(sx1, sy1, 8, 0, TAU); sctx.stroke();

  // impact burst at the end of a hit
  if (state.burst) drawBurst(sctx, state.burst);

  // corner note
  sctx.fillStyle = 'rgba(95,108,128,1)';
  sctx.font = `10.5px ${MONO}`;
  sctx.fillText('orbit + trajectory to scale · Moon disc ×4 · conic propagated in closed form (Kepler, no integration)', 16, 522);
  sctx.fillStyle = 'rgba(106,166,216,0.85)';
  sctx.fillText('perigee 200 km · v_p = 11.14 km/s · v∞ = ' + state.vinf.toFixed(2) + ' km/s', 16, 34);
}

function drawBurst(ctx, b) {
  const { x, y, t } = b;
  const k = clamp(t / 1.1, 0, 1);
  ctx.save();
  ctx.translate(x, y);
  const rng = mulberry32(7);
  for (let i = 0; i < 22; i++) {
    const ang = rng() * TAU, spd = 30 + rng() * 90, r0 = 6 + rng() * 6;
    const dist = r0 + spd * k;
    ctx.save();
    ctx.translate(Math.cos(ang) * dist, Math.sin(ang) * dist);
    ctx.rotate(ang + k * 3 * (rng() > 0.5 ? 1 : -1));
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = i % 3 === 0 ? '#f4efe0' : '#f59e42';
    ctx.beginPath();
    for (let v = 0; v < 5; v++) {
      const a = (v / 5) * TAU - Math.PI / 2, rr = 5;
      v === 0 ? ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = 'rgba(245,158,66,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 12 + 90 * k, 0, TAU); ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function updateShotReadouts() {
  const A = L.arrivalState(state.vinf);
  const miss = L.missDistance(state.vinf, state.timing);
  $('vinfReadout').textContent = `${state.vinf.toFixed(2)} km/s`;
  $('timingReadout').textContent =
    state.timing === 0 ? 'on time' :
    `${state.timing > 0 ? '+' : '−'}${fmtInt(Math.abs(state.timing))} s (${(Math.abs(state.timing) / 3600).toFixed(2)} h)`;
  $('stFlight').textContent = fmtHMS(A.tArr);
  $('stVp').textContent = `${A.vp.toFixed(2)} km/s`;
  $('stLead').textContent = `${A.leadDeg.toFixed(1)}° ahead`;
  $('stMiss').textContent = `${fmtInt(miss)} km`;
  $('stMiss').classList.toggle('hot', miss > L.C.R_M);
  const hit = miss <= L.C.R_M;
  $('verdictName').textContent = hit ? 'VERDICT: HIT' : 'VERDICT: MISS';
  $('verdictName').classList.toggle('miss', !hit);
  $('verdictVal').textContent = hit
    ? `closest approach ${fmtInt(miss)} km — inside the 1,737-km radius`
    : `closest approach ${fmtInt(miss)} km — the Moon is 1,737 km in radius`;
  $('stAvg').textContent = `${(L.C.ORBIT_R / A.tArr).toFixed(2)} km/s`;
}

let flyTimer = null;
function fly() {
  if (state.flying) return;
  state.flying = true;
  state.burst = null;
  const tArr = L.arrivalState(state.vinf).tArr;
  const t0 = performance.now(), dur = 9200;
  const step = () => {
    const wall = clamp((performance.now() - t0) / dur, 0, 1);
    const eased = wall < 0.5 ? 2 * wall * wall : 1 - ((1 - wall) ** 2) * 2;
    const t = eased * tArr * 1.04;
    const s = L.hyperbolaState(state.vinf, Math.min(t, tArr));
    if (wall >= 1) {
      state.flying = false;
      state.burst = { x: px(s.r, s.nu)[0], y: px(s.r, s.nu)[1], t: 0 };
      const b0 = performance.now();
      const burstAnim = () => {
        state.burst.t = (performance.now() - b0) / 1000;
        if (state.burst.t > 1.6) state.burst = null;
        drawShot(tArr, null);
        if (state.burst || ((performance.now() - b0) / 1000) < 2.4) requestAnimationFrame(burstAnim);
      };
      burstAnim();
      return;
    }
    drawShot(t, s.nu);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

$('vinfSlider').addEventListener('input', (ev) => {
  state.vinf = +ev.target.value;
  updateShotReadouts(); drawShot(0);
});
$('timingSlider').addEventListener('input', (ev) => {
  state.timing = +ev.target.value;
  updateShotReadouts(); drawShot(0);
});
$('flyBtn').addEventListener('click', fly);
document.querySelectorAll('#shotPresets .btn-preset').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#shotPresets .btn-preset').forEach((x) => x.classList.toggle('active', x === b));
  state.vinf = +b.dataset.vinf; state.timing = +b.dataset.timing;
  $('vinfSlider').value = state.vinf; $('timingSlider').value = state.timing;
  updateShotReadouts(); drawShot(0);
}));

/* =========================== TAB 2 — direct ascent =========================== */
const ascCanvas = $('ascentCanvas');
const actx = ascCanvas.getContext('2d');

function drawAscent() {
  const W = 1000, H = 520, left = 74, right = W - 24, top = 58, bottom = H - 56;
  const vpMin = 10.90, vpMax = 11.40, tMin = 27, tMax = 132;
  const X = (vp) => left + ((vp - vpMin) / (vpMax - vpMin)) * (right - left);
  const Y = (t) => bottom - ((Math.log(t) - Math.log(tMin)) / (Math.log(tMax) - Math.log(tMin))) * (bottom - top);
  actx.clearRect(0, 0, W, H);

  // region tints: ellipse vs hyperbola
  const vesc = L.escapeSpeed(L.C.RP);
  actx.fillStyle = 'rgba(106,166,216,0.05)';
  actx.fillRect(left, top, X(vesc) - left, bottom - top);
  actx.fillStyle = 'rgba(224,86,78,0.05)';
  actx.fillRect(X(vesc), top, right - X(vesc), bottom - top);
  actx.strokeStyle = 'rgba(224,86,78,0.6)';
  actx.setLineDash([4, 5]);
  actx.beginPath(); actx.moveTo(X(vesc), top - 6); actx.lineTo(X(vesc), bottom); actx.stroke();
  actx.setLineDash([]);

  // grid
  actx.strokeStyle = 'rgba(38,50,74,0.8)';
  actx.fillStyle = 'rgba(95,108,128,1)';
  actx.font = `10.5px ${MONO}`;
  for (const t of [30, 40, 60, 90, 120]) {
    actx.beginPath(); actx.moveTo(left, Y(t)); actx.lineTo(right, Y(t)); actx.stroke();
    actx.fillText(`${t} h`, left - 34, Y(t) + 3);
  }
  for (const vp of [10.95, 11.05, 11.15, 11.25, 11.35]) {
    actx.beginPath(); actx.moveTo(X(vp), top); actx.lineTo(X(vp), bottom); actx.stroke();
    actx.fillText(vp.toFixed(2), X(vp) - 14, bottom + 18);
  }
  actx.fillText('perigee speed at 200 km, km/s', (left + right) / 2 - 90, bottom + 36);

  // documented flight time
  actx.strokeStyle = 'rgba(245,158,66,0.55)';
  actx.setLineDash([6, 5]);
  actx.beginPath(); actx.moveTo(left, Y(38.38)); actx.lineTo(right, Y(38.38)); actx.stroke();
  actx.setLineDash([]);
  actx.fillStyle = 'rgba(245,158,66,0.9)';
  actx.fillText('documented 38 h 22 m', right - 160, Y(38.38) - 7);

  // the curve
  actx.strokeStyle = '#e9e6dc';
  actx.lineWidth = 2;
  actx.beginPath();
  let started = false;
  for (let i = 0; i <= 400; i++) {
    const vp = vpMin + ((vpMax - vpMin) * i) / 400;
    const t = L.flightTime(vp) / 3600;
    if (!isFinite(t) || t > tMax) { started = false; continue; }
    started ? actx.lineTo(X(vp), Y(t)) : actx.moveTo(X(vp), Y(t));
    started = true;
  }
  actx.stroke();
  actx.lineWidth = 1;

  // markers
  const marks = [
    [10.917, 119.47, 'HOHMANN\n5 days', 'rgba(106,166,216,0.95)'],
    [vesc, 50.68, 'PARABOLA\njust escapes', 'rgba(152,163,182,0.95)'],
    [11.137, 38.35, 'LUNA 2\n38 h', '#f59e42'],
    [11.35, L.flightTime(11.35) / 3600, 'FAST\n~30 h', 'rgba(224,86,78,0.95)'],
  ];
  actx.font = `10.5px ${MONO}`;
  for (const [vp, t, label, col] of marks) {
    actx.fillStyle = col;
    actx.beginPath(); actx.arc(X(vp), Y(t), 4, 0, TAU); actx.fill();
    const lines = label.split('\n');
    lines.forEach((ln, i) => actx.fillText(ln, X(vp) + 8, Y(t) - 6 + i * 12));
  }
  actx.fillStyle = 'rgba(106,166,216,0.9)';
  actx.fillText('ELLIPSES — apogee barely past the Moon', left + 8, top + 14);
  actx.fillStyle = 'rgba(224,86,78,0.9)';
  actx.fillText('HYPERBOLAS — Earth escape', X(vesc) + 10, top + 30);

  // current slider marker
  const tCur = L.flightTime(state.vp) / 3600;
  if (isFinite(tCur)) {
    actx.strokeStyle = 'rgba(245,158,66,0.4)';
    actx.setLineDash([3, 4]);
    actx.beginPath(); actx.moveTo(X(state.vp), top); actx.lineTo(X(state.vp), Y(tCur)); actx.lineTo(left, Y(tCur)); actx.stroke();
    actx.setLineDash([]);
    actx.fillStyle = '#f59e42';
    actx.beginPath(); actx.arc(X(state.vp), Y(tCur), 5.5, 0, TAU); actx.fill();
    actx.strokeStyle = '#05070d'; actx.lineWidth = 2; actx.stroke(); actx.lineWidth = 1;
  }
}

function updateAscentReadouts() {
  const vp = state.vp, vesc = L.escapeSpeed(L.C.RP);
  $('vpReadout').textContent = `${vp.toFixed(3)} km/s`;
  const eps = (vp * vp) / 2 - L.C.MU_E / L.C.RP;
  const a = -L.C.MU_E / (2 * eps);
  const ecc = Math.abs(1 - L.C.RP / a);
  const t = L.flightTime(vp);
  let type, apo;
  if (vp < vesc - 1e-6) { type = 'ellipse'; apo = `${fmtInt(a * (1 + ecc))} km`; }
  else if (vp > vesc + 1e-6) { type = 'hyperbola'; apo = `v∞ ${Math.sqrt(vp ** 2 - vesc ** 2).toFixed(2)} km/s`; }
  else { type = 'parabola'; apo = 'v∞ = 0'; }
  $('acType').textContent = type;
  $('acEcc').textContent = ecc.toFixed(4);
  $('acApo').textContent = apo;
  $('acTime').textContent = isFinite(t) ? fmtHMS(t) : 'never (falls back)';
  $('barIdeal').style.setProperty('--w', '100%');
  $('barIdealVal').textContent = `${vp.toFixed(2)} km/s`;
  $('barSpin').style.setProperty('--w', `${(0.3233 / vp) * 100}%`);
  $('barSpinVal').textContent = '0.32 free';
}

$('vpSlider').addEventListener('input', (ev) => {
  state.vp = +ev.target.value;
  document.querySelectorAll('#ascentPresets .btn-preset').forEach((x) => x.classList.remove('active'));
  updateAscentReadouts(); drawAscent();
});
document.querySelectorAll('#ascentPresets .btn-preset').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#ascentPresets .btn-preset').forEach((x) => x.classList.toggle('active', x === b));
  state.vp = +b.dataset.vp;
  $('vpSlider').value = state.vp;
  updateAscentReadouts(); drawAscent();
}));

/* =========================== TAB 3 — the last hour =========================== */
const impCanvas = $('impactCanvas');
const ictx = impCanvas.getContext('2d');
let impactAnim = null;

function drawImpact() {
  ictx.clearRect(0, 0, 1000, 540);

  /* --- left: the vector meeting + the plunge --- */
  const ox = 118, oy = 356, k = 62; // px per km/s
  const phi = (state.phi * Math.PI) / 180;
  const vArr = L.arrivalState(1.65).vArr;
  const vM = L.V_MOON;
  // v_M along +x, v_arr at phi above it
  const ax = ox + Math.cos(phi) * vArr * k, ay = oy - Math.sin(phi) * vArr * k;
  const mx = ox + vM * k;
  const arrow = (x0, y0, x1, y1, col, label, lx, ly) => {
    ictx.strokeStyle = col; ictx.fillStyle = col; ictx.lineWidth = 2;
    ictx.beginPath(); ictx.moveTo(x0, y0); ictx.lineTo(x1, y1); ictx.stroke();
    const an = Math.atan2(y1 - y0, x1 - x0);
    ictx.beginPath();
    ictx.moveTo(x1, y1);
    ictx.lineTo(x1 - 9 * Math.cos(an - 0.4), y1 - 9 * Math.sin(an - 0.4));
    ictx.lineTo(x1 - 9 * Math.cos(an + 0.4), y1 - 9 * Math.sin(an + 0.4));
    ictx.closePath(); ictx.fill();
    ictx.lineWidth = 1;
    ictx.font = `11px ${MONO}`;
    ictx.fillText(label, lx, ly);
  };
  arrow(ox, oy, ax, ay, '#e9e6dc', '', 0, 0);
  text(ictx, `v_arr ${vArr.toFixed(2)} km/s`, ax + 10, ay - 26, '#e9e6dc');
  text(ictx, '(Earth frame)', ax + 10, ay - 12, 'rgba(152,163,182,0.95)');
  arrow(ox, oy, mx, oy, '#c9c4bb', '', 0, 0);
  text(ictx, `v_M ${vM.toFixed(2)} km/s`, mx - 52, oy + 24, '#c9c4bb');
  ictx.strokeStyle = 'rgba(245,158,66,0.9)';
  ictx.setLineDash([5, 4]);
  ictx.beginPath(); ictx.moveTo(ax, ay); ictx.lineTo(mx, oy); ictx.stroke();
  ictx.setLineDash([]);
  text(ictx, `v∞,☾ = |v_arr − v_M| = ${L.moonRelativeSpeed(state.phi, vArr).toFixed(2)} km/s`, (ax + mx) / 2 - 118, (ay + oy) / 2 + 26, 'rgba(245,158,66,0.95)');
  text(ictx, 'at lunar distance, 13 Sep 1959 ~20:00 UT', ox - 58, oy + 56, 'rgba(95,108,128,1)', `10.5px ${MONO}`);

  /* the Moon + fall */
  const MC = { x: 402, y: 250, r: 96 };
  const mg = ictx.createRadialGradient(MC.x - 30, MC.y - 34, 10, MC.x, MC.y, MC.r);
  mg.addColorStop(0, '#d8d3ca'); mg.addColorStop(1, '#8e897f');
  ictx.fillStyle = mg;
  ictx.beginPath(); ictx.arc(MC.x, MC.y, MC.r, 0, TAU); ictx.fill();
  ictx.fillStyle = 'rgba(120,114,104,0.55)';
  [[-34, -18, 13], [22, 26, 17], [40, -34, 8], [-18, 44, 9]].forEach(([dx, dy, rr]) => {
    ictx.beginPath(); ictx.arc(MC.x + dx, MC.y + dy, rr, 0, TAU); ictx.fill();
  });
  ictx.fillStyle = 'rgba(201,196,187,0.95)';
  text(ictx, 'R = 1,737 km · v_esc = 2.376 km/s', MC.x - 92, MC.y + MC.r + 20);

  // incoming plunge: nearly straight line bending slightly toward the Moon
  const vinfM = L.moonRelativeSpeed(state.phi, vArr);
  const prog = impactAnim ? clamp(impactAnim.t / 2.6, 0, 1) : 1;
  ictx.strokeStyle = 'rgba(244,239,224,0.95)';
  ictx.lineWidth = 1.8;
  ictx.beginPath();
  for (let i = 0; i <= 90; i++) {
    const u = i / 90;
    const x0 = 208 + (MC.x + 62 - 208) * u;
    const y0 = 96 + (MC.y - 58 - 96) * u;
    const bend = u * u * 26;
    i === 0 ? ictx.moveTo(x0, y0 + bend) : ictx.lineTo(x0, y0 + bend);
  }
  ictx.stroke();
  ictx.lineWidth = 1;
  if (!impactAnim) {
    ictx.fillStyle = '#f4efe0';
    ictx.beginPath(); ictx.arc(MC.x + 62, MC.y - 58 + 26, 4, 0, TAU); ictx.fill();
  } else {
    const u = prog;
    const x0 = 208 + (MC.x + 62 - 208) * u, y0 = 96 + (MC.y - 58 - 96) * u + u * u * 26;
    ictx.fillStyle = '#f4efe0';
    ictx.beginPath(); ictx.arc(x0, y0, 4, 0, TAU); ictx.fill();
    if (prog >= 1) drawBurst(ictx, { x: MC.x + 62, y: MC.y - 58, t: impactAnim.t - 2.6 });
  }
  ictx.fillStyle = 'rgba(95,108,128,1)'; ictx.font = `10.5px ${MONO}`;
  ictx.fillText('last transmission ~21:02 UT — Jodrell Bank\u2019s tape stops mid-tone', 48, 500);

  /* --- right: magnetometer chart --- */
  const cx = 560, cw = 424, top = 74, bottom = 470, R0 = 5600, R1 = 520000;
  const XR = (r) => cx + ((Math.log(r) - Math.log(R0)) / (Math.log(R1) - Math.log(R0))) * cw;
  const B0 = 0.05, B1 = 1.2e5;
  const YB = (b) => bottom - ((Math.log(b) - Math.log(B0)) / (Math.log(B1) - Math.log(B0))) * (bottom - top);
  ictx.fillStyle = 'rgba(224,86,78,0.07)';
  ictx.fillRect(cx, YB(L.magQuantum), cw, bottom - YB(L.magQuantum));
  ictx.strokeStyle = 'rgba(38,50,74,0.9)';
  ictx.fillStyle = 'rgba(95,108,128,1)'; ictx.font = `10px ${MONO}`;
  for (const b of [1e-1, 1, 10, 100, 1e3, 1e4]) {
    ictx.beginPath(); ictx.moveTo(cx, YB(b)); ictx.lineTo(cx + cw, YB(b)); ictx.stroke();
    ictx.fillText(b >= 1000 ? `${b / 1000}k γ` : `${b} γ`, cx - 34, YB(b) + 3);
  }
  for (const rr of [6371, 40, 100, 200, 384400]) {
    ictx.fillText(rr >= 1000 ? `${fmtInt(rr)}` : `${rr}k`, XR(rr) - 12, bottom + 16);
  }
  ictx.fillText('distance from Earth, km', cx + 120, bottom + 34);
  ictx.fillStyle = 'rgba(106,166,216,0.9)';
  ictx.font = `11px ${MONO}`;
  ictx.fillText('EARTH DIPOLE  B = B_eq (R/r)³ √(1+3 sin²λ)', cx + 66, top - 38);
  const curve = (lat, col) => {
    ictx.strokeStyle = col; ictx.lineWidth = 1.8; ictx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const r = R0 * Math.pow(R1 / R0, i / 200);
      const b = L.dipoleB(r, lat);
      i === 0 ? ictx.moveTo(XR(r), YB(b)) : ictx.lineTo(XR(r), YB(b));
    }
    ictx.stroke(); ictx.lineWidth = 1;
  };
  curve(0, 'rgba(106,166,216,0.95)');
  curve(45, 'rgba(106,166,216,0.45)');
  // quantum + bound
  ictx.strokeStyle = 'rgba(224,86,78,0.85)';
  ictx.setLineDash([5, 4]);
  ictx.beginPath(); ictx.moveTo(cx, YB(L.magQuantum)); ictx.lineTo(cx + cw, YB(L.magQuantum)); ictx.stroke();
  ictx.strokeStyle = 'rgba(224,86,78,0.95)';
  ictx.beginPath(); ictx.moveTo(cx, YB(25)); ictx.lineTo(cx + cw, YB(25)); ictx.stroke();
  ictx.setLineDash([]);
  text(ictx, 'telemetry quantum ±12 γ — nothing below it is readable', cx + 6, YB(L.magQuantum) + 18, 'rgba(224,86,78,0.95)', `10px ${MONO}`);
  text(ictx, 'lunar field bound 20–30 γ — nothing was there', cx + 6, YB(25) - 8, 'rgba(224,86,78,0.95)', `10px ${MONO}`);
  // marker at the Moon
  ictx.strokeStyle = 'rgba(245,158,66,0.9)';
  ictx.setLineDash([3, 4]);
  ictx.beginPath(); ictx.moveTo(XR(384400), top); ictx.lineTo(XR(384400), bottom); ictx.stroke();
  ictx.setLineDash([]);
  ictx.fillStyle = '#f59e42';
  ictx.beginPath(); ictx.arc(XR(384400), YB(L.dipoleB(384400, 0)), 4, 0, TAU); ictx.fill();
  text(ictx, 'at the Moon: 0.14 γ', XR(384400) - 128, YB(L.dipoleB(384400, 0)) + 18, 'rgba(245,158,66,0.95)', `10px ${MONO}`);
  text(ictx, 'no lunar magnetic field found — and no radiation belt either', cx + 26, 506, 'rgba(245,158,66,0.95)');
}

function updateImpactReadouts() {
  const vArr = L.arrivalState(1.65).vArr;
  const vinfM = L.moonRelativeSpeed(state.phi, vArr);
  const vimp = L.impactSpeed(vinfM);
  const ke = L.impactEnergy(vimp);
  $('phiReadout').textContent = `${state.phi.toFixed(0)}°`;
  $('imVinf').textContent = `${vinfM.toFixed(2)} km/s`;
  $('imVimp').textContent = `${vimp.toFixed(2)} km/s`;
  $('imEnergy').textContent = `${(ke / 1e9).toFixed(2)} GJ = ${(ke / 4.184e9 * 1000).toFixed(0)} kg TNT`;
}

$('phiSlider').addEventListener('input', (ev) => {
  state.phi = +ev.target.value;
  updateImpactReadouts(); drawImpact();
});

$('impactBtn').addEventListener('click', () => {
  if (impactAnim) return;
  impactAnim = { t: 0 };
  const t0 = performance.now();
  const step = () => {
    impactAnim.t = (performance.now() - t0) / 1000;
    drawImpact();
    if (impactAnim.t < 4.4) requestAnimationFrame(step);
    else { impactAnim = null; drawImpact(); }
  };
  requestAnimationFrame(step);
});

/* =========================== TAB 4 — the artificial comet =========================== */
const comCanvas = $('cometCanvas');
const cctx = comCanvas.getContext('2d');
const STARS = (() => {
  const rng = mulberry32(19590914);
  return Array.from({ length: 150 }, () => ({
    x: 16 + rng() * 968, y: 14 + rng() * 500,
    r: 0.4 + rng() * 1.4, a: 0.25 + rng() * 0.65,
  }));
})();

function drawComet() {
  const D = L.sodiumDiameterKm(state.scrub, state.temp);
  const arcmin = L.sodiumAngArcmin(state.scrub, state.temp);
  cctx.clearRect(0, 0, 1000, 540);
  cctx.fillStyle = '#05070d';
  cctx.fillRect(0, 0, 1000, 540);
  for (const s of STARS) {
    cctx.globalAlpha = s.a;
    cctx.fillStyle = '#e9e6dc';
    cctx.beginPath(); cctx.arc(s.x, s.y, s.r, 0, TAU); cctx.fill();
  }
  cctx.globalAlpha = 1;

  // sky scale: 2.6° across 1000 px
  const pxPerDeg = 1000 / 2.6;
  const cx = 470, cy = 292;
  const radiusPx = Math.max(1, ((D / (L.C.NA_RELEASE_KM + L.C.R_E)) * (180 / Math.PI)) * pxPerDeg) / 2;

  // full Moon reference circle (31.1')
  const moonR = ((L.C.MOON_ANG_DIAM_ARCMIN / 60) * pxPerDeg) / 2;
  cctx.strokeStyle = 'rgba(201,196,187,0.5)';
  cctx.setLineDash([6, 6]);
  cctx.beginPath(); cctx.arc(790, 330, moonR, 0, TAU); cctx.stroke();
  cctx.setLineDash([]);
  cctx.fillStyle = 'rgba(201,196,187,0.75)';
  cctx.font = `11px ${MONO}`;
  cctx.fillText('FULL MOON, TO SCALE (31′)', 790 - moonR, 330 + moonR + 18);

  // the sodium comet
  const fade = clamp(1 - state.scrub / 1650, 0.06, 1);
  const g = cctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(radiusPx, 2));
  g.addColorStop(0, `rgba(255,196,120,${0.95 * fade})`);
  g.addColorStop(0.45, `rgba(245,158,66,${0.55 * fade})`);
  g.addColorStop(1, 'rgba(217,124,43,0)');
  cctx.fillStyle = g;
  cctx.beginPath(); cctx.arc(cx, cy, Math.max(radiusPx, 2), 0, TAU); cctx.fill();
  cctx.strokeStyle = `rgba(245,158,66,${0.8 * fade})`;
  cctx.setLineDash([2, 4]);
  cctx.beginPath(); cctx.arc(cx, cy, Math.max(radiusPx, 2), 0, TAU); cctx.stroke();
  cctx.setLineDash([]);
  cctx.fillStyle = '#f4efe0';
  cctx.beginPath(); cctx.arc(cx, cy, 2, 0, TAU); cctx.fill();
  cctx.fillStyle = `rgba(245,158,66,${0.95 * fade + 0.05})`;
  cctx.font = `11px ${MONO}`;
  cctx.fillText(`Na  D-line 589.0 / 589.6 nm — ${fmtInt(D)} km across`, cx - 96, cy + Math.max(radiusPx, 8) + 22);
  cctx.fillStyle = 'rgba(95,108,128,1)';
  cctx.fillText('12 Sep 1959 · t+12 h · 156,000 km from Earth · 1 kg of sodium', 16, 522);

  // readouts
  $('tempReadout').textContent = `${state.temp} K`;
  $('scrubReadout').textContent = `${Math.floor(state.scrub / 60)}:${String(Math.round(state.scrub % 60)).padStart(2, '0')}`;
  $('soVth').textContent = `${L.sodiumVth(state.temp).toFixed(2)} km/s`;
  $('soDiam').textContent = `${fmtInt(D)} km`;
  $('soAng').textContent = `${arcmin.toFixed(1)}′`;
  $('soMoon').textContent = `${(arcmin / L.C.MOON_ANG_DIAM_ARCMIN).toFixed(2)}× the full Moon`;
}

$('tempSlider').addEventListener('input', (ev) => { state.temp = +ev.target.value; drawComet(); });
$('scrubSlider').addEventListener('input', (ev) => { state.scrub = +ev.target.value; drawComet(); });
document.querySelectorAll('#cometPresets .btn-preset').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#cometPresets .btn-preset').forEach((x) => x.classList.toggle('active', x === b));
  state.scrub = +b.dataset.scrub;
  $('scrubSlider').value = state.scrub;
  drawComet();
}));

/* =========================== timeline =========================== */
$('timelineStrip').innerHTML = L.TIMELINE.map((m) => `
  <div class="timeline-item ${m.date.includes('LUNA 2') ? 'luna2' : ''}">
    <div class="timeline-date">${m.date}</div>
    <div class="timeline-text">${m.text}</div>
  </div>`).join('');

/* =========================== boot =========================== */
$('stSens').textContent = `±${L.speedSensitivityKmPerMs().toFixed(0)} km at the Moon`;

function redrawAll() {
  updateShotReadouts(); drawShot(0);
  updateAscentReadouts(); drawAscent();
  updateImpactReadouts(); drawImpact();
  drawComet();
}
redrawAll();

window.__luna = {
  setTab,
  setVinf: (v) => { state.vinf = v; $('vinfSlider').value = v; updateShotReadouts(); drawShot(0); },
  setTiming: (s) => { state.timing = s; $('timingSlider').value = s; updateShotReadouts(); drawShot(0); },
  fly,
  setVp: (v) => { state.vp = v; $('vpSlider').value = v; updateAscentReadouts(); drawAscent(); },
  setPhi: (d) => { state.phi = d; $('phiSlider').value = d; updateImpactReadouts(); drawImpact(); },
  setTemp: (T) => { state.temp = T; $('tempSlider').value = T; drawComet(); },
  setScrub: (s) => { state.scrub = s; $('scrubSlider').value = s; drawComet(); },
  get state() { return { ...state }; },
};
