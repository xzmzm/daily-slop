/* Perseid Vigil — simulate the 2026 Perseid shower, night by night.
 *
 * All-sky fisheye view (zenith at centre, horizon at the rim).
 * Meteors radiate from the true Perseid radiant; the rate follows the
 * IMO-style ZHR activity curve, scaled by radiant altitude and moonlight.
 * Pure client-side, no libraries.
 */

"use strict";

// ---------------------------------------------------------------- constants

const DEG = Math.PI / 180;

// season: nights of Jul 17 .. Aug 24, 2026 (39 nights, slider index 0..38)
const SEASON_START = Date.UTC(2026, 6, 17);       // Jul 17 2026
const N_NIGHTS = 39;
const PEAK_UTC = Date.UTC(2026, 7, 13, 14, 53);    // λ☉ = 140.0°
const PEAK_NIGHT = 26;                             // night of Aug 12→13

// two-component activity: a broad base + a sharp core, ZHR_max ≈ 100
const BASE_ZHR = 20, BASE_B = 0.05;   // broad component 10^(-b·|Δλ|)
const CORE_ZHR = 80, CORE_B = 0.25;   // sharp core around λ☉ = 140°
const SPORADIC_HR = 8;             // background sporadics, per hour

// Perseid radiant near maximum (J2000): RA 3h04m, Dec +57.4°
const RADIANT_RA = 46.2 * DEG;
const RADIANT_DEC = 57.4 * DEG;

const LATITUDE = 45 * DEG;         // generic mid-northern observer

// new moon 2026-08-12 17:37 UTC; synodic month
const NEW_MOON = Date.UTC(2026, 7, 12, 17, 37);
const SYNODIC = 29.530588 * 86400e3;

// the night runs 22:00 → 04:30 local, replayed in ~50 real seconds
const NIGHT_H0 = 22, NIGHT_H1 = 28.5;
const NIGHT_REAL_SECS = 50;
const RATE_TASTE = 0.55;           // global spawn damping so peak isn't soup

// ---------------------------------------------------------------- utilities

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------- astro model

// solar longitude (deg), linear approx around the Perseid peak
function solarLongitude(utcMs) {
  return 140.0 + (utcMs - PEAK_UTC) / 86400e3 * 0.98565;
}

// sun's right ascension (rad) from its ecliptic longitude
function sunRA(utcMs) {
  const lam = solarLongitude(utcMs) * DEG;
  return Math.atan2(Math.sin(lam) * Math.cos(23.44 * DEG), Math.cos(lam));
}

// local sidereal time (rad) given local *solar* hour of night `h` (22..28.5).
// LST ≈ sun RA + hour angle of sun = sunRA + (h - 12) * 15°
function lst(utcMs, hourLocal) {
  return sunRA(utcMs) + (hourLocal - 12) * 15 * DEG;
}

// altitude + azimuth of the radiant at a given LST
function radiantAltAz(theta) {
  const H = theta - RADIANT_RA;
  const sinAlt = Math.sin(LATITUDE) * Math.sin(RADIANT_DEC) +
                 Math.cos(LATITUDE) * Math.cos(RADIANT_DEC) * Math.cos(H);
  const alt = Math.asin(sinAlt);
  const az = Math.atan2(
    -Math.cos(RADIANT_DEC) * Math.sin(H),
    Math.sin(RADIANT_DEC) - Math.sin(LATITUDE) * sinAlt
  );
  return { alt, az: (az + 2 * Math.PI) % (2 * Math.PI) };
}

// moon illumination fraction 0..1 for an instant
function moonIllum(utcMs) {
  const phase = ((utcMs - NEW_MOON) % SYNODIC + SYNODIC) % SYNODIC / SYNODIC;
  return (1 - Math.cos(phase * 2 * Math.PI)) / 2;
}

// crude "is the moon up" test: the moon transits ~(elongation/15°) hours
// after the sun (12:00 local) and is up ~6.2 h either side of transit.
function moonUp(utcMs, hourLocal) {
  const phase = ((utcMs - NEW_MOON) % SYNODIC + SYNODIC) % SYNODIC / SYNODIC;
  const transit = 12 + phase * 24;              // local hour of moon transit
  let d = Math.abs(hourLocal - transit) % 24;
  if (d > 12) d = 24 - d;
  return d < 6.2;
}

// ZHR from the activity curve for an instant
function zhr(utcMs) {
  const dLam = Math.abs(solarLongitude(utcMs) - 140.0);
  return BASE_ZHR * Math.pow(10, -BASE_B * dLam) +
         CORE_ZHR * Math.pow(10, -CORE_B * dLam);
}

// UTC ms of local hour `h` on night index `n` (h may exceed 24)
function nightInstant(n, h) {
  return SEASON_START + n * 86400e3 + h * 3600e3;
}

// visible meteors/hr for night n at local hour h
function visibleRate(n, h) {
  const t = nightInstant(n, h);
  const { alt } = radiantAltAz(lst(t, h));
  const altFactor = Math.max(0, Math.sin(alt));
  // moonlight knocks limiting magnitude down up to ~3 mag when full + up;
  // each lost magnitude keeps only 1/r of meteors (r ≈ 2.2)
  let lmLoss = 0;
  if (moonUp(t, h)) lmLoss = 3 * moonIllum(t);
  const moonFactor = Math.pow(2.2, -lmLoss);
  return zhr(t) * altFactor * moonFactor + SPORADIC_HR * moonFactor * 0.6;
}

// best (max) visible rate over a night — used for the curve + readout
function nightBest(n) {
  let best = 0;
  for (let h = NIGHT_H0; h <= NIGHT_H1; h += 0.5) {
    best = Math.max(best, visibleRate(n, h));
  }
  return best;
}

// ---------------------------------------------------------------- rendering

const sky = document.getElementById("sky");
const ctx = sky.getContext("2d");
let W = 0, H = 0, CX = 0, CY = 0, R = 0;

function resize() {
  W = sky.width = innerWidth * devicePixelRatio;
  H = sky.height = innerHeight * devicePixelRatio;
  sky.style.width = innerWidth + "px";
  sky.style.height = innerHeight + "px";
  CX = W / 2; CY = H / 2;
  R = Math.min(W, H) * 0.46;
}
addEventListener("resize", resize);
resize();

// fisheye: zenith at centre, horizon at radius R; az 0=N up, 90=E right
function project(alt, az) {
  const r = R * (1 - alt / (Math.PI / 2));
  return { x: CX + r * Math.sin(az), y: CY - r * Math.cos(az), r };
}

// fixed decorative star field (seeded, in sky coordinates)
const stars = (() => {
  const rnd = mulberry32(20260731);
  const out = [];
  for (let i = 0; i < 420; i++) {
    out.push({
      alt: Math.asin(rnd()) ,          // uniform on the dome
      az: rnd() * 2 * Math.PI,
      m: rnd(),                        // brightness 0..1
      tw: rnd() * 2 * Math.PI          // twinkle phase
    });
  }
  return out;
})();

// ------------------------------------------------------------ meteor state

const meteors = [];   // {x,y,dx,dy,len,life,age,bright,sporadic}
let trailFade = 0.22;

function spawnMeteor(radiant, rnd, forced) {
  // pick a point at angular distance d from the radiant, streak away from it
  const isSpor = !forced && rnd() < SPORADIC_HR /
    (SPORADIC_HR + Math.max(1, state.rateNow));
  let x, y, dx, dy;
  if (isSpor) {
    x = CX + (rnd() * 2 - 1) * R * 0.9;
    y = CY + (rnd() * 2 - 1) * R * 0.9;
    const a = rnd() * 2 * Math.PI;
    dx = Math.cos(a); dy = Math.sin(a);
  } else {
    const p = project(radiant.alt, radiant.az);
    const a = rnd() * 2 * Math.PI;
    const d = R * (0.08 + rnd() * 0.75);      // distance from radiant
    x = p.x + Math.cos(a) * d;
    y = p.y + Math.sin(a) * d;
    dx = Math.cos(a); dy = Math.sin(a);
    // foreshortening: short streaks near the radiant, long ones far away
    var fore = Math.min(1, d / (R * 0.7));
  }
  const bright = rnd() * rnd();               // few bright, many faint
  meteors.push({
    x, y, dx, dy,
    len: (isSpor ? 40 : 30 + 170 * (fore || 0.5)) * (0.5 + bright) *
         devicePixelRatio,
    speed: (isSpor ? 500 : 900 + 700 * bright) * devicePixelRatio,
    life: 0.25 + 0.3 * bright,
    age: 0,
    bright: forced ? 1 : bright,
    sporadic: isSpor
  });
}

// ------------------------------------------------------------------- state

const state = {
  night: 14,            // slider index (Jul 31 = 14)
  hour: NIGHT_H0,       // local hour, 22..28.5, loops
  rateNow: 0,
  radiant: { alt: 0, az: 0 }
};

const rnd = mulberry32(0xBEEF ^ Date.now());

// ------------------------------------------------------------------ redraw

function drawSky(dt, now) {
  const t = nightInstant(state.night, state.hour);
  const illum = moonIllum(t);
  const mUp = moonUp(t, state.hour);

  // background: darker when the moon is down
  const wash = mUp ? illum * 0.10 : 0;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(${4 + wash * 120}, ${6 + wash * 130}, ${12 + wash * 160}, ${trailFade})`;
  ctx.fillRect(0, 0, W, H);

  // horizon circle + cardinal points
  ctx.strokeStyle = "rgba(120,150,190,0.25)";
  ctx.lineWidth = devicePixelRatio;
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = "rgba(120,150,190,0.5)";
  ctx.font = `${11 * devicePixelRatio}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const off = 14 * devicePixelRatio;
  ctx.fillText("N", CX, CY - R - off);
  ctx.fillText("S", CX, CY + R + off);
  ctx.fillText("E", CX + R + off, CY);
  ctx.fillText("W", CX - R - off, CY);

  // stars (clip to dome)
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, 2 * Math.PI);
  ctx.clip();

  for (const s of stars) {
    const p = project(s.alt, s.az);
    const tw = 0.65 + 0.35 * Math.sin(now / 700 + s.tw);
    const a = (0.15 + 0.6 * s.m) * tw * (1 - wash * 4);
    if (a <= 0.02) continue;
    ctx.fillStyle = `rgba(210,225,255,${a})`;
    const sz = (0.6 + s.m * 1.4) * devicePixelRatio;
    ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
  }

  // moon glow
  if (mUp && illum > 0.02) {
    const mp = project(0.35, Math.PI * 1.4);   // decorative fixed spot, SW
    const g = ctx.createRadialGradient(mp.x, mp.y, 0, mp.x, mp.y, R * 0.5);
    g.addColorStop(0, `rgba(220,225,235,${0.25 * illum})`);
    g.addColorStop(1, "rgba(220,225,235,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(235,238,245,${0.5 + 0.5 * illum})`;
    ctx.beginPath();
    ctx.arc(mp.x, mp.y, 7 * devicePixelRatio * (0.5 + illum * 0.5), 0, 2 * Math.PI);
    ctx.fill();
  }

  // radiant marker (only when above horizon)
  if (state.radiant.alt > 0) {
    const p = project(state.radiant.alt, state.radiant.az);
    ctx.strokeStyle = "rgba(159,216,255,0.55)";
    ctx.lineWidth = devicePixelRatio;
    const cr = 10 * devicePixelRatio;
    ctx.beginPath();
    ctx.arc(p.x, p.y, cr, 0, 2 * Math.PI);
    ctx.moveTo(p.x - cr * 1.8, p.y); ctx.lineTo(p.x - cr * 0.6, p.y);
    ctx.moveTo(p.x + cr * 0.6, p.y); ctx.lineTo(p.x + cr * 1.8, p.y);
    ctx.moveTo(p.x, p.y - cr * 1.8); ctx.lineTo(p.x, p.y - cr * 0.6);
    ctx.moveTo(p.x, p.y + cr * 0.6); ctx.lineTo(p.x, p.y + cr * 1.8);
    ctx.stroke();
    ctx.fillStyle = "rgba(159,216,255,0.6)";
    ctx.textAlign = "left";
    ctx.fillText("PER", p.x + cr * 2.1, p.y);
  }

  // meteors
  ctx.globalCompositeOperation = "lighter";
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.age += dt;
    if (m.age > m.life) { meteors.splice(i, 1); continue; }
    m.x += m.dx * m.speed * dt;
    m.y += m.dy * m.speed * dt;
    const k = 1 - m.age / m.life;
    const a = (m.sporadic ? 0.35 : 0.5 + 0.5 * m.bright) * k;
    const grad = ctx.createLinearGradient(
      m.x - m.dx * m.len, m.y - m.dy * m.len, m.x, m.y);
    grad.addColorStop(0, "rgba(159,216,255,0)");
    grad.addColorStop(1, `rgba(${m.sporadic ? "200,210,225" : "190,230,255"},${a})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = (m.bright > 0.6 ? 2.2 : 1.2) * devicePixelRatio;
    ctx.beginPath();
    ctx.moveTo(m.x - m.dx * m.len, m.y - m.dy * m.len);
    ctx.lineTo(m.x, m.y);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// ------------------------------------------------------------------- HUD

const $ = (id) => document.getElementById(id);
const fmtDate = (n, h) => {
  const d = new Date(nightInstant(n, h >= 24 ? h - 24 + 24 : h));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

function updateHud() {
  const t = nightInstant(state.night, state.hour);
  const hh = Math.floor(state.hour % 24);
  const mm = Math.floor((state.hour % 1) * 60);
  $("ro-date").textContent =
    `${fmtDate(state.night, 12)} · ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  $("ro-zhr").textContent = Math.round(zhr(nightInstant(state.night, 26)));
  $("ro-rate").textContent = `~${Math.round(state.rateNow)}`;
  $("ro-radiant").textContent =
    state.radiant.alt > 0 ? `${Math.round(state.radiant.alt / DEG)}°` : "below horizon";
  const illum = moonIllum(t);
  $("ro-moon").textContent = moonUp(t, state.hour)
    ? `${Math.round(illum * 100)}% · up` : `${Math.round(illum * 100)}% · down`;
  $("night-label").textContent =
    `night of ${fmtDate(state.night, 12)} → ${fmtDate(state.night + 1, 12)}` +
    (state.night === PEAK_NIGHT ? "  ★ PEAK (new moon)" : "") +
    (state.night === 14 ? "  · today" : "");
}

// ------------------------------------------------------------ ZHR curve UI

const curve = $("curve");
const cctx = curve.getContext("2d");

function drawCurve() {
  const w = curve.width = curve.clientWidth * devicePixelRatio;
  const h = curve.height = 56 * devicePixelRatio;
  cctx.clearRect(0, 0, w, h);
  const vals = [];
  let max = 0;
  for (let n = 0; n < N_NIGHTS; n++) {
    const v = nightBest(n);
    vals.push(v);
    max = Math.max(max, v);
  }
  cctx.beginPath();
  for (let n = 0; n < N_NIGHTS; n++) {
    const x = (n / (N_NIGHTS - 1)) * (w - 14 * devicePixelRatio) + 7 * devicePixelRatio;
    const y = h - 6 * devicePixelRatio - (vals[n] / max) * (h - 16 * devicePixelRatio);
    n === 0 ? cctx.moveTo(x, y) : cctx.lineTo(x, y);
  }
  cctx.strokeStyle = "rgba(159,216,255,0.7)";
  cctx.lineWidth = 1.5 * devicePixelRatio;
  cctx.stroke();
  // fill under curve
  cctx.lineTo(w - 7 * devicePixelRatio, h);
  cctx.lineTo(7 * devicePixelRatio, h);
  cctx.closePath();
  cctx.fillStyle = "rgba(159,216,255,0.10)";
  cctx.fill();
  // current-night tick
  const x = (state.night / (N_NIGHTS - 1)) * (w - 14 * devicePixelRatio) + 7 * devicePixelRatio;
  cctx.strokeStyle = "rgba(255,255,255,0.5)";
  cctx.beginPath();
  cctx.moveTo(x, 0); cctx.lineTo(x, h);
  cctx.stroke();
}

// ---------------------------------------------------------------- controls

const slider = $("night");
slider.addEventListener("input", () => {
  state.night = +slider.value;
  state.hour = NIGHT_H0;
  drawCurve();
  updateHud();
});
$("btn-tonight").addEventListener("click", () => {
  slider.value = 14; slider.dispatchEvent(new Event("input"));
});
$("btn-peak").addEventListener("click", () => {
  slider.value = PEAK_NIGHT; slider.dispatchEvent(new Event("input"));
});

// click the sky → wish on a forced meteor
sky.addEventListener("pointerdown", () => {
  if (state.radiant.alt > 0) spawnMeteor(state.radiant, rnd, true);
});

// --------------------------------------------------------------- main loop

let last = performance.now();
let spawnDebt = 0;
let hudTimer = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // advance the night clock (loops 22:00 → 04:30)
  const hoursPerSec = (NIGHT_H1 - NIGHT_H0) / NIGHT_REAL_SECS;
  state.hour += hoursPerSec * dt;
  if (state.hour > NIGHT_H1) state.hour = NIGHT_H0;

  const t = nightInstant(state.night, state.hour);
  state.radiant = radiantAltAz(lst(t, state.hour));
  state.rateNow = visibleRate(state.night, state.hour);

  // Poisson-ish spawning: rateNow per *simulated* hour
  const simHoursPerRealSec = hoursPerSec;
  spawnDebt += state.rateNow * simHoursPerRealSec * RATE_TASTE * dt;
  while (spawnDebt >= 1) {
    spawnDebt -= 1;
    if (rnd() < 0.9) spawnMeteor(state.radiant, rnd, false);
  }

  drawSky(dt, now);

  hudTimer += dt;
  if (hudTimer > 0.25) { hudTimer = 0; updateHud(); }

  requestAnimationFrame(frame);
}

slider.value = state.night;
drawCurve();
updateHud();
addEventListener("resize", drawCurve);
requestAnimationFrame(frame);
