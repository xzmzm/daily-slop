// app.js — Rubin Curve: the flat rotation-curve studio.
//
// Left: the galaxy. "Spectrograph" mode puts a long slit across M31's major
// axis and shows the Doppler-shifted Hα line the way Rubin & Ford read it;
// "Orbit view" lets the whole disk turn at Newtonian speeds (toggle the halo
// and watch the outer stars change their minds).
// Right: the measured rotation curve, the visible-mass prediction, and the
// mass ledger that turns a flat curve into invisible mass.

import {
  DEFAULTS,
  KMS_TO_KPC_PER_GYR,
  diskV,
  haloV,
  totalV,
  keplerV,
  diskMass,
  enclosedMass,
  darkFraction,
  mulberry32,
  gauss,
} from "./physics.js";

const C_KMS = 299792.458;
const LAB_LAMBDA = 656.281; // nm, Hα
const SPEC_LO = 654.9; // spectrum strip range, nm
const SPEC_HI = 658.7;
const R_LAST = 24; // the paper's outermost measured point, kpc

const state = {
  params: { ...DEFAULTS },
  haloOn: true,
  theory: false,
  ghost: false,
  kepler: false,
  mode: "spectrograph",
  slitR: 8,
  incl: 1.47, // current drawn inclination, rad (animated toward target)
  simTime: 0, // Myr
  timeScale: 55, // Myr per second
  points: [], // { r, v, born }
  sweepToken: 0,
};

/* ---------------- deterministic star population ---------------- */

const rngStars = mulberry32(1970); // ApJ 159, 379
function sampleExp(scale, max) {
  // inverse transform of the exponential profile, capped
  let r = 0;
  for (let i = 0; i < 24; i++) {
    r = -scale * Math.log(1 - rngStars());
    if (r <= max) return r;
  }
  return max * rngStars();
}
function gaussR(sig) {
  return (rngStars() + rngStars() + rngStars() + rngStars() - 2) * sig;
}

const diskStars = [];
for (let i = 0; i < 1500; i++) {
  diskStars.push({ r: sampleExp(DEFAULTS.h, 34), th: rngStars() * 2 * Math.PI,
    sz: 0.6 + rngStars() * 1.2, warm: rngStars() });
}
const bulgeStars = [];
for (let i = 0; i < 230; i++) {
  bulgeStars.push({ r: Math.abs(gaussR(0.9)), th: rngStars() * 2 * Math.PI,
    sz: 0.7 + rngStars() * 1.1 });
}
const hiiRegions = [];
for (let i = 0; i < 14; i++) {
  hiiRegions.push({ r: 3 + rngStars() * 21, th: rngStars() * 2 * Math.PI });
}
const ghostStars = [];
for (let i = 0; i < 420; i++) {
  ghostStars.push({ r: 2 + rngStars() * 38, th: rngStars() * 2 * Math.PI,
    sz: 0.8 + rngStars() * 1.4 });
}

/* ---------------- circular-speed lookup table ---------------- */

let speedTable = null;
function rebuildSpeeds() {
  const n = 480;
  const dr = 40 / n;
  speedTable = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const r = i * dr;
    speedTable[i] = state.haloOn ? totalV(r, state.params, true) : diskV(r, state.params);
  }
}
function speedAt(r) {
  if (r <= 0) return 0;
  const x = (r / 40) * 480;
  const i = Math.min(479, Math.floor(x));
  const f = x - i;
  return speedTable[i] * (1 - f) + speedTable[i + 1] * f;
}
function omegaAt(r) {
  return r > 0.05 ? (speedAt(r) * KMS_TO_KPC_PER_GYR) / r : 0; // rad per Gyr
}

/* ---------------- canvas plumbing ---------------- */

const sky = document.getElementById("sky");
const sctx = sky.getContext("2d");
const chart = document.getElementById("chart");
const cctx = chart.getContext("2d");

function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

// persistent trail buffer for the orbit view
const trail = document.createElement("canvas");
const tctx = trail.getContext("2d");

/* ---------------- sky rendering ---------------- */

const INCL_TARGET = { spectrograph: 1.475, orbits: 1.06 };

function drawSky(dtMs) {
  const { w, h } = fitCanvas(sky);
  if (trail.width !== sky.width || trail.height !== sky.height) {
    trail.width = sky.width;
    trail.height = sky.height;
    tctx.setTransform(sky.width / w, 0, 0, sky.height / h, 0, 0);
  }

  const spectro = state.mode === "spectrograph";
  const targetIncl = spectro ? INCL_TARGET.spectrograph : INCL_TARGET.orbits;
  state.incl += (targetIncl - state.incl) * Math.min(1, dtMs / 260);

  const specH = spectro ? Math.min(150, h * 0.27) : 0;
  const cx = w / 2;
  const cy = spectro ? (h - specH) / 2 : h / 2;
  const scale = Math.min(w / 76, (h - specH - 30) / 42); // kpc → px

  state.simTime += (dtMs / 1000) * state.timeScale; // Myr
  const T = state.simTime / 1000; // Gyr
  const sinI = Math.sin(state.incl);

  // background
  const bg = sctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
  bg.addColorStop(0, "#0a1024");
  bg.addColorStop(1, "#04070f");
  sctx.fillStyle = bg;
  sctx.fillRect(0, 0, w, h);

  if (spectro) {
    drawSpectroGalaxy(cx, cy, scale, sinI);
  } else {
    drawOrbitGalaxy(cx, cy, scale, sinI, dtMs, w, h);
  }

  if (spectro) {
    drawSpectrum(w, h - specH, specH);
    // live slit readout
    const v = speedAt(state.slitR);
    const lamObs = LAB_LAMBDA * (1 - v / C_KMS);
    document.getElementById("lam-obs").textContent = lamObs.toFixed(2);
    document.getElementById("slit-v").textContent = "−" + Math.round(v);
  }

  // scale bar
  sctx.fillStyle = "#5a6b8c";
  sctx.font = "10px ui-monospace, Menlo, monospace";
  sctx.textAlign = "left";
  const bar10 = 10 * scale;
  sctx.fillRect(cx - bar10 / 2, (spectro ? h - specH : h) - 18, bar10, 2);
  sctx.fillText("10 kpc", cx - bar10 / 2, (spectro ? h - specH : h) - 22);
}

function drawOrbitGalaxy(cx, cy, scale, sinI, dtMs, w, h) {
  // fade the trail buffer toward transparent (no color veil — the galaxy
  // glow and ghost get drawn on top of the composite below)
  tctx.globalCompositeOperation = "destination-out";
  tctx.fillStyle = "rgba(0, 0, 0, 0.05)";
  tctx.fillRect(0, 0, w, h);
  tctx.globalCompositeOperation = "source-over";

  const T = state.simTime / 1000;
  const ang = (r, th0) => th0 + omegaAt(r) * T;

  // stars stamp into the trail buffer (motion streaks)
  const stamp = (r, th, size, color, alpha) => {
    const sx = cx + r * scale * Math.cos(th);
    const sy = cy - r * scale * sinI * Math.sin(th);
    tctx.globalAlpha = alpha;
    tctx.fillStyle = color;
    tctx.beginPath();
    tctx.arc(sx, sy, size, 0, 6.2832);
    tctx.fill();
  };
  for (const s of diskStars) {
    const t = Math.min(1, s.r / 14);
    const color = s.warm > 1.7 - 0.7 * (1 - t) ? "#f4d9a6" : t > 0.65 ? "#bcd4ff" : "#e8eefc";
    stamp(s.r, ang(s.r, s.th), s.sz, color, 0.5);
  }
  for (const s of bulgeStars) {
    stamp(s.r, ang(s.r, s.th), s.sz, "#ffe3b0", 0.75);
  }
  tctx.globalAlpha = 1;

  sctx.drawImage(trail, 0, 0, w, h);

  if (state.ghost) {
    sctx.save();
    sctx.globalCompositeOperation = "lighter";
    // ghost halo: sparse violet particles on their own, slower-looking orbits
    const haloR = 40 * scale;
    const gl = sctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
    gl.addColorStop(0, "rgba(124, 92, 240, 0.10)");
    gl.addColorStop(0.55, "rgba(124, 92, 240, 0.05)");
    gl.addColorStop(1, "rgba(124, 92, 240, 0)");
    sctx.fillStyle = gl;
    sctx.beginPath();
    sctx.ellipse(cx, cy, haloR, haloR * Math.max(0.18, sinI), 0, 0, 6.2832);
    sctx.fill();
    sctx.restore();
    for (const g of ghostStars) {
      const th = ang(g.r, g.th);
      const x = cx + g.r * scale * Math.cos(th);
      const y = cy - g.r * scale * sinI * Math.sin(th);
      sctx.globalAlpha = 0.5;
      sctx.fillStyle = "#8b6cf5";
      sctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    }
    sctx.globalAlpha = 1;
    sctx.strokeStyle = "rgba(167, 139, 250, 0.35)";
    sctx.setLineDash([5, 6]);
    sctx.beginPath();
    sctx.ellipse(cx, cy, 40 * scale, 40 * scale * Math.max(0.18, sinI), 0, 0, 6.2832);
    sctx.stroke();
    sctx.setLineDash([]);
  }

  // galactic glow on top
  sctx.save();
  sctx.globalCompositeOperation = "lighter";
  const glow = sctx.createRadialGradient(cx, cy, 0, cx, cy, 8 * scale);
  glow.addColorStop(0, "rgba(255, 226, 170, 0.5)");
  glow.addColorStop(0.4, "rgba(250, 214, 150, 0.12)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  sctx.fillStyle = glow;
  sctx.beginPath();
  sctx.ellipse(cx, cy, 8 * scale, 8 * scale * Math.max(0.2, sinI), 0, 0, 6.2832);
  sctx.fill();
  sctx.restore();

  // HII regions as bright knots
  for (const g of hiiRegions) {
    const th = ang(g.r, g.th);
    const x = cx + g.r * scale * Math.cos(th);
    const y = cy - g.r * scale * sinI * Math.sin(th);
    sctx.fillStyle = "#ff9ecf";
    sctx.beginPath();
    sctx.arc(x, y, 2.1, 0, 6.2832);
    sctx.fill();
  }

  // hint: outer ring at the last measured radius
  sctx.strokeStyle = "rgba(56, 189, 248, 0.28)";
  sctx.setLineDash([3, 7]);
  sctx.beginPath();
  sctx.ellipse(cx, cy, R_LAST * scale, R_LAST * scale * Math.max(0.18, sinI), 0, 0, 6.2832);
  sctx.stroke();
  sctx.setLineDash([]);

  // caption
  sctx.fillStyle = "#8ea0c0";
  sctx.font = "11px ui-monospace, Menlo, monospace";
  sctx.textAlign = "right";
  const label = state.ghost
    ? "violet: what the halo would look like · outer stars at 24 kpc still ride at "
      + Math.round(speedAt(R_LAST)) + " km/s"
    : "disk turns at Newtonian speeds — toggle the halo and watch the rim";
  sctx.fillText(label, w - 14, h - 12);
}

function drawSpectroGalaxy(cx, cy, scale, sinI) {
  const T = state.simTime / 1000;
  const ang = (r, th0) => th0 + omegaAt(r) * T;

  // faint disk body
  sctx.save();
  sctx.globalCompositeOperation = "lighter";
  const body = sctx.createLinearGradient(cx - 34 * scale, cy, cx + 34 * scale, cy);
  body.addColorStop(0, "rgba(140,160,220,0.03)");
  body.addColorStop(0.18, "rgba(190,205,245,0.10)");
  body.addColorStop(0.5, "rgba(255,232,190,0.20)");
  body.addColorStop(0.82, "rgba(190,205,245,0.10)");
  body.addColorStop(1, "rgba(140,160,220,0.03)");
  sctx.fillStyle = body;
  sctx.beginPath();
  sctx.ellipse(cx, cy, 34 * scale, 34 * scale * 0.16, 0, 0, 6.2832);
  sctx.fill();
  sctx.restore();

  // stars, Doppler-tinted: left approaching (blue), right receding (red)
  for (const s of diskStars) {
    const th = ang(s.r, s.th);
    const x = s.r * Math.cos(th);
    const y = s.r * Math.sin(th);
    const vLos = speedAt(s.r) * Math.cos(th) * sinI;
    const t = Math.max(-1, Math.min(1, vLos / 230));
    const sx = cx + x * scale;
    const sy = cy - y * sinI * scale;
    const near = Math.abs(x) > 1.5 && Math.abs(y) < 4.5; // close to the major axis
    if (Math.abs(vLos) < 12) {
      sctx.fillStyle = "rgba(210,222,245,0.55)";
    } else {
      const cBlue = [56, 189, 248];
      const cRed = [248, 113, 113];
      const c = cBlue.map((v, i) => Math.round(v + (cRed[i] - v) * (t + 1) / 2));
      sctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${near ? 0.95 : 0.45})`;
    }
    sctx.fillRect(sx - s.sz / 2, sy - s.sz / 2, s.sz, s.sz);
  }
  for (const s of bulgeStars) {
    const th = ang(s.r, s.th);
    const sx = cx + s.r * scale * Math.cos(th);
    const sy = cy - s.r * scale * sinI * Math.sin(th);
    sctx.fillStyle = "rgba(255,227,176,0.8)";
    sctx.fillRect(sx - s.sz / 2, sy - s.sz / 2, s.sz, s.sz);
  }
  for (const g of hiiRegions) {
    const th = ang(g.r, g.th);
    const x = g.r * Math.cos(th);
    const y = g.r * Math.sin(th);
    if (Math.abs(y * sinI) > 2.2) continue; // only near-slit regions are measurable
    const sx = cx + x * scale;
    const sy = cy - y * sinI * scale;
    sctx.fillStyle = "#ff9ecf";
    sctx.beginPath();
    sctx.arc(sx, sy, 2.6, 0, 6.2832);
    sctx.fill();
  }

  // the long slit
  sctx.strokeStyle = "rgba(212, 175, 55, 0.75)";
  sctx.lineWidth = 1;
  sctx.setLineDash([10, 6]);
  sctx.beginPath();
  sctx.moveTo(cx - 35 * scale, cy);
  sctx.lineTo(cx + 35 * scale, cy);
  sctx.stroke();
  sctx.setLineDash([]);

  // side labels
  sctx.font = "10.5px ui-monospace, Menlo, monospace";
  sctx.textAlign = "left";
  sctx.fillStyle = "rgba(56,189,248,0.8)";
  sctx.fillText("← approaching (blue)", 12, cy - 8);
  sctx.fillStyle = "rgba(248,113,113,0.8)";
  sctx.textAlign = "right";
  sctx.fillText("receding (red) →", sctx.canvas.clientWidth - 12, cy - 8);

  // slit position marker (approaching side)
  const mx = cx - state.slitR * scale;
  sctx.strokeStyle = "#38bdf8";
  sctx.lineWidth = 2;
  sctx.beginPath();
  sctx.moveTo(mx, cy - 16);
  sctx.lineTo(mx, cy + 16);
  sctx.stroke();
  sctx.beginPath();
  sctx.arc(mx, cy, 7, 0, 6.2832);
  sctx.stroke();
  sctx.fillStyle = "#38bdf8";
  sctx.font = "600 11px ui-monospace, Menlo, monospace";
  sctx.textAlign = "center";
  sctx.fillText(`slit r = ${state.slitR.toFixed(1)} kpc`, mx, cy + 30);
}

function drawSpectrum(w, top, hh) {
  const pad = 42;
  const x0 = pad;
  const x1 = w - pad;
  const y0 = top + 26;
  const y1 = top + hh - 30;
  const lamToX = (lam) => x0 + ((lam - SPEC_LO) / (SPEC_HI - SPEC_LO)) * (x1 - x0);
  const v = speedAt(state.slitR);
  const lamObs = LAB_LAMBDA * (1 - v / C_KMS); // approaching → blue

  // panel
  sctx.fillStyle = "rgba(7, 11, 22, 0.85)";
  sctx.fillRect(0, top + 6, w, hh - 6);
  sctx.strokeStyle = "rgba(120,140,190,0.18)";
  sctx.beginPath();
  sctx.moveTo(0, top + 6);
  sctx.lineTo(w, top + 6);
  sctx.stroke();

  // axis
  sctx.strokeStyle = "rgba(120,140,190,0.3)";
  sctx.fillStyle = "#5a6b8c";
  sctx.font = "10px ui-monospace, Menlo, monospace";
  sctx.textAlign = "center";
  sctx.beginPath();
  sctx.moveTo(x0, y1);
  sctx.lineTo(x1, y1);
  sctx.stroke();
  for (let lam = 655; lam <= 658.5; lam += 0.5) {
    const x = lamToX(lam);
    sctx.beginPath();
    sctx.moveTo(x, y1);
    sctx.lineTo(x, y1 + 4);
    sctx.stroke();
    if (Math.abs(lam - Math.round(lam)) < 1e-6) sctx.fillText(`${lam.toFixed(0)}`, x, y1 + 15);
  }
  sctx.fillText("wavelength λ (nm)", (x0 + x1) / 2, y1 + 27);

  // faint sky lines (calibration forest)
  for (const lam of [655.28, 655.98, 657.21, 658.11]) {
    const x = lamToX(lam);
    const g = sctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "rgba(120,140,190,0.0)");
    g.addColorStop(0.7, "rgba(120,140,190,0.22)");
    g.addColorStop(1, "rgba(120,140,190,0.0)");
    sctx.fillStyle = g;
    sctx.fillRect(x - 0.7, y0, 1.4, y1 - y0);
  }

  // lab λ marker
  const xLab = lamToX(LAB_LAMBDA);
  sctx.strokeStyle = "rgba(212,175,55,0.85)";
  sctx.setLineDash([4, 4]);
  sctx.beginPath();
  sctx.moveTo(xLab, y0 - 4);
  sctx.lineTo(xLab, y1);
  sctx.stroke();
  sctx.setLineDash([]);
  sctx.fillStyle = "#d4af37";
  sctx.textAlign = "center";
  sctx.fillText("λ₀ lab Hα", xLab, y0 - 8);

  // Doppler-shifted emission line
  const xObs = lamToX(lamObs);
  const lineW = Math.max(2.4, (x1 - x0) * 0.006);
  const g2 = sctx.createLinearGradient(0, y0, 0, y1);
  g2.addColorStop(0, "rgba(255,110,150,0)");
  g2.addColorStop(0.65, "rgba(255,110,150,0.85)");
  g2.addColorStop(1, "rgba(255,120,160,0.35)");
  sctx.fillStyle = g2;
  sctx.fillRect(xObs - lineW / 2, y0, lineW, y1 - y0);
  const glow = sctx.createRadialGradient(xObs, (y0 + y1) / 2, 0, xObs, (y0 + y1) / 2, 26);
  glow.addColorStop(0, "rgba(255,120,160,0.30)");
  glow.addColorStop(1, "rgba(255,120,160,0)");
  sctx.fillStyle = glow;
  sctx.fillRect(xObs - 26, y0, 52, y1 - y0);

  // Δλ bracket
  sctx.strokeStyle = "#38bdf8";
  sctx.lineWidth = 1;
  sctx.beginPath();
  sctx.moveTo(xLab, y0 + 10);
  sctx.lineTo(xObs, y0 + 10);
  sctx.stroke();
  sctx.fillStyle = "#38bdf8";
  sctx.textAlign = "center";
  sctx.fillText(`Δλ = ${(lamObs - LAB_LAMBDA).toFixed(3)} nm`, (xLab + xObs) / 2, y0 + 22);

  sctx.fillStyle = "#f0f4fc";
  sctx.font = "600 12px ui-monospace, Menlo, monospace";
  sctx.textAlign = "left";
  sctx.fillText(
    `v = c·Δλ/λ₀ = −${Math.round(v)} km/s   →   |v| = ${Math.round(v)} km/s at r = ${state.slitR.toFixed(1)} kpc`,
    x0, top + 18,
  );
}

/* ---------------- rotation-curve chart ---------------- */

function drawChart(now) {
  const { w, h } = fitCanvas(chart);
  cctx.clearRect(0, 0, w, h);
  const padL = 52;
  const padR = 16;
  const padT = 14;
  const padB = 40;
  const x0 = padL;
  const x1 = w - padR;
  const y0 = padT;
  const y1 = h - padB;
  const VMAX = 300;
  const RMAX = 32;
  const rToX = (r) => x0 + (r / RMAX) * (x1 - x0);
  const vToY = (v) => y1 - (v / VMAX) * (y1 - y0);

  // grid
  cctx.strokeStyle = "rgba(120,140,190,0.12)";
  cctx.lineWidth = 1;
  cctx.font = "10px ui-monospace, Menlo, monospace";
  cctx.fillStyle = "#5a6b8c";
  for (let r = 0; r <= RMAX; r += 4) {
    const x = rToX(r);
    cctx.beginPath();
    cctx.moveTo(x, y0);
    cctx.lineTo(x, y1);
    cctx.stroke();
    cctx.textAlign = "center";
    cctx.fillText(String(r), x, y1 + 14);
  }
  for (let v = 0; v <= VMAX; v += 50) {
    const y = vToY(v);
    cctx.beginPath();
    cctx.moveTo(x0, y);
    cctx.lineTo(x1, y);
    cctx.stroke();
    cctx.textAlign = "right";
    cctx.fillText(String(v), x0 - 7, y + 3);
  }
  cctx.fillText("radius r (kpc)", (x0 + x1) / 2, y1 + 30);
  cctx.save();
  cctx.translate(13, (y0 + y1) / 2);
  cctx.rotate(-Math.PI / 2);
  cctx.textAlign = "center";
  cctx.fillText("v (km/s)", 0, 0);
  cctx.restore();

  // last-measured-point marker
  const xLast = rToX(R_LAST);
  cctx.strokeStyle = "rgba(148,163,184,0.25)";
  cctx.setLineDash([3, 6]);
  cctx.beginPath();
  cctx.moveTo(xLast, y0);
  cctx.lineTo(xLast, y1);
  cctx.stroke();
  cctx.setLineDash([]);
  cctx.fillStyle = "rgba(148,163,184,0.75)";
  cctx.font = "9.5px ui-monospace, Menlo, monospace";
  cctx.textAlign = "left";
  cctx.fillText("1970 last point (24 kpc)", xLast + 5, y0 + 12);

  const curve = (fn, color, widthPx, dash) => {
    cctx.strokeStyle = color;
    cctx.lineWidth = widthPx;
    cctx.setLineDash(dash || []);
    cctx.beginPath();
    for (let r = 0; r <= RMAX; r += 0.25) {
      const y = vToY(fn(r));
      if (r === 0) cctx.moveTo(rToX(r), y);
      else cctx.lineTo(rToX(r), y);
    }
    cctx.stroke();
    cctx.setLineDash([]);
  };

  if (state.theory) {
    if (state.kepler) curve((r) => keplerV(r, state.params), "rgba(90,107,140,0.7)", 1.2, [2, 4]);
    curve((r) => diskV(r, state.params), "#fbbf24", 2);
    if (state.haloOn) {
      curve((r) => haloV(r, state.params), "#7c5cf0", 1.6, [7, 5]);
      curve((r) => totalV(r, state.params, true), "#d4af37", 2.4);
    }
  }

  // measured points with error bars + pop-in animation
  for (const p of state.points) {
    const x = rToX(p.r);
    const y = vToY(p.v);
    const age = now - p.born;
    const pop = age < 450 ? 1 + 0.9 * (1 - age / 450) : 1;
    cctx.strokeStyle = "rgba(56,189,248,0.5)";
    cctx.lineWidth = 1.2;
    cctx.beginPath();
    cctx.moveTo(x, vToY(p.v - 10));
    cctx.lineTo(x, vToY(p.v + 10));
    cctx.stroke();
    cctx.fillStyle = "#38bdf8";
    cctx.beginPath();
    cctx.arc(x, y, 3.4 * pop, 0, 6.2832);
    cctx.fill();
    cctx.strokeStyle = "rgba(4,7,15,0.9)";
    cctx.lineWidth = 1;
    cctx.stroke();
  }

  // flat annotation + the gap annotation
  const outer = state.points.filter((p) => p.r > 14);
  if (outer.length >= 3 && state.theory) {
    const vFlat = outer.reduce((a, p) => a + p.v, 0) / outer.length;
    cctx.strokeStyle = "rgba(56,189,248,0.5)";
    cctx.setLineDash([6, 5]);
    cctx.beginPath();
    cctx.moveTo(rToX(14), vToY(vFlat));
    cctx.lineTo(rToX(RMAX), vToY(vFlat));
    cctx.stroke();
    cctx.setLineDash([]);
    cctx.fillStyle = "rgba(56,189,248,0.9)";
    cctx.font = "600 11px ui-monospace, Menlo, monospace";
    cctx.textAlign = "left";
    cctx.fillText(`flat ≈ ${Math.round(vFlat)} km/s`, rToX(24.6), vToY(vFlat) - 8);

    // the gap at 24 kpc between visible-mass prediction and data
    const pred = diskV(R_LAST, state.params);
    const px = rToX(R_LAST);
    cctx.strokeStyle = "#f87171";
    cctx.lineWidth = 1.6;
    cctx.beginPath();
    cctx.moveTo(px, vToY(pred));
    cctx.lineTo(px, vToY(vFlat));
    cctx.stroke();
    cctx.fillStyle = "#f87171";
    cctx.font = "600 10.5px ui-monospace, Menlo, monospace";
    cctx.textAlign = "right";
    cctx.fillText(`×${(vFlat / pred).toFixed(1)} too fast`, px - 6, vToY((pred + vFlat) / 2) + 4);
  }
}

/* ---------------- measurements ---------------- */

const noiseRng = mulberry32(42);
function recordPoint(r) {
  const truth = totalV(r, state.params, true); // reality includes the halo
  const v = Math.max(4, truth + gauss(noiseRng) * 8); // Rubin & Ford: ±~10 km/s
  state.points.push({ r, v, born: performance.now() });
  state.points.sort((a, b) => a.r - b.r);
  refresh();
  return v;
}

async function sweep() {
  const token = ++state.sweepToken;
  const radii = [];
  for (let i = 0; i < 12; i++) radii.push(3 + (21 * i) / 11);
  for (const r of radii) {
    if (token !== state.sweepToken) return;
    await glideSlit(r, 240);
    if (token !== state.sweepToken) return;
    recordPoint(state.slitR);
    await sleep(210);
  }
}

function glideSlit(target, ms) {
  return new Promise((resolve) => {
    const from = state.slitR;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      state.slitR = from + (target - from) * e;
      syncSlitUI();
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function instantPoints(n = 12) {
  state.points = [];
  for (let i = 0; i < n; i++) {
    const r = 3 + (21 * i) / (n - 1);
    const v = Math.max(4, totalV(r, state.params, true) + gauss(noiseRng) * 8);
    state.points.push({ r, v, born: performance.now() - 600 });
  }
}

/* ---------------- ledger + status ---------------- */

function refresh() {
  rebuildSpeeds();
  const R = R_LAST;
  const fd = darkFraction(R, state.params, state.haloOn);
  const mvis = diskMass(R, state.params);
  const mtot = state.haloOn ? enclosedMass(R, state.params, true) : mvis;
  document.getElementById("dark-pct").textContent = Math.round(fd * 100);
  document.getElementById("m-vis").textContent = (mvis / 1e10).toFixed(1) + "×10¹⁰";
  document.getElementById("m-tot").textContent = (mtot / 1e10).toFixed(1) + "×10¹⁰";
  const pctVis = Math.round((1 - fd) * 100);
  document.getElementById("bar-vis").style.width = pctVis + "%";
  document.getElementById("bar-dark").style.width = 100 - pctVis + "%";

  const note = document.getElementById("ledger-note");
  note.innerHTML = state.haloOn
    ? "Newton says <em>v² = GM(&lt;r)/r</em>: a flat curve forces <em>M(&lt;r) ∝ r</em> — mass keeps growing into the dark past the last star."
    : "With halo off, the starlight alone ends near 20 kpc — but the measured points still say <em>flat</em>. Something invisible is being left out.";

  // warning chip + status
  const hasOuter = state.points.some((p) => p.r > 16);
  const mismatch = !state.haloOn && hasOuter;
  document.getElementById("chip-warn").style.display = mismatch ? "" : "none";

  const status = document.getElementById("chart-status");
  status.textContent = state.points.length === 0
    ? "no data yet — put the slit on a region and record"
    : `${state.points.length} points recorded${state.theory ? " · model shown" : " · reveal the prediction ↓"}`;
  drawChart(performance.now());
}

function syncSlitUI() {
  document.getElementById("slit").value = state.slitR;
  document.getElementById("slit-r").textContent = state.slitR.toFixed(1);
}

/* ---------------- hint flashes ---------------- */

let hintTimer = null;
function hint(text, ms = 3200) {
  const el = document.getElementById("hint");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el.classList.remove("show"), ms);
}

/* ---------------- UI wiring ---------------- */

function setMode(mode) {
  state.mode = mode;
  document.getElementById("tab-orbits").classList.toggle("active", mode === "orbits");
  document.getElementById("tab-spec").classList.toggle("active", mode === "spectrograph");
  document.getElementById("sky-note").textContent =
    mode === "spectrograph" ? "M31 · long slit on the major axis" : "Newtonian disk · 62° tilt";
  document.querySelector(".sky-wrap canvas").style.cursor = mode === "spectrograph" ? "crosshair" : "default";
  const slitCtl = document.getElementById("slit");
  slitCtl.style.display = mode === "spectrograph" ? "" : "none";
}

document.getElementById("tab-orbits").addEventListener("click", () => setMode("orbits"));
document.getElementById("tab-spec").addEventListener("click", () => setMode("spectrograph"));

document.getElementById("slit").addEventListener("input", (e) => {
  state.slitR = parseFloat(e.target.value);
  syncSlitUI();
});

sky.addEventListener("pointerdown", (e) => {
  if (state.mode !== "spectrograph") return;
  const rect = sky.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const w = rect.width;
  const specH = Math.min(150, rect.height * 0.27);
  const cy = (rect.height - specH) / 2;
  const y = e.clientY - rect.top;
  if (y > rect.height - specH - 6 || Math.abs(y - cy) > 26) return; // near the major axis only
  const scale = Math.min(w / 76, (rect.height - specH - 30) / 42);
  state.slitR = Math.min(30, Math.max(1.5, Math.abs(x - w / 2) / scale));
  syncSlitUI();
});

document.getElementById("btn-measure").addEventListener("click", () => {
  const v = recordPoint(state.slitR);
  hint(`recorded: |v| = ${Math.round(v)} km/s at r = ${state.slitR.toFixed(1)} kpc`);
});

document.getElementById("btn-sweep").addEventListener("click", () => {
  setMode("spectrograph");
  sweep();
});

document.getElementById("btn-reset").addEventListener("click", () => {
  state.sweepToken++;
  state.points = [];
  refresh();
});

const chip = (id, get, set) => {
  const el = document.getElementById(id);
  el.addEventListener("click", () => {
    set(!get());
    el.classList.toggle("on", get());
    refresh();
  });
  el.classList.toggle("on", get());
};
chip("chip-halo", () => state.haloOn, (v) => {
  state.haloOn = v;
  if (!v) hint("halo removed — watch the rim of the disk slow down…");
});
chip("chip-theory", () => state.theory, (v) => {
  state.theory = v;
  if (v) hint("gold = what the starlight alone can do");
});
chip("chip-ghost", () => state.ghost, (v) => {
  state.ghost = v;
  if (v && state.mode !== "orbits") setMode("orbits");
});
chip("chip-kepler", () => state.kepler, (v) => { state.kepler = v; });

const bindSlider = (id, outId, fmt, apply) => {
  const input = document.getElementById(id);
  const output = document.getElementById(outId);
  input.addEventListener("input", () => {
    const v = parseFloat(input.value);
    output.textContent = fmt(v);
    apply(v);
    refresh();
  });
};
bindSlider("in-vinf", "o-vinf", (v) => `${v} km/s`, (v) => { state.params.vinf = v; });
bindSlider("in-rc", "o-rc", (v) => `${v.toFixed(1)} kpc`, (v) => { state.params.rc = v; });
bindSlider("in-mdisk", "o-mdisk", (v) => `${v.toFixed(1)}×10¹⁰ M☉`, (v) => { state.params.mdisk = v * 1e10; });
bindSlider("in-h", "o-h", (v) => `${v.toFixed(1)} kpc`, (v) => { state.params.h = v; });

/* quotes */
const QUOTES = [
  ['"In a spiral galaxy, the ratio of dark-to-light matter is about a factor of ten. That\'s probably a good number for the ratio of our ignorance to knowledge."', "— Vera Rubin"],
  ['"We have peered into a new world, and we have seen that it is more mysterious and more complex than we had thought."', "— Vera Rubin, Bright Galaxies, Dark Matters (1997)"],
  ['"There is no scientific problem that a man can solve that a woman cannot."', "— Vera Rubin"],
];
let quoteIdx = 0;
document.getElementById("quote").addEventListener("click", () => {
  quoteIdx = (quoteIdx + 1) % QUOTES.length;
  document.getElementById("quote-text").textContent = QUOTES[quoteIdx][0];
  document.querySelector("#quote .who").textContent = " " + QUOTES[quoteIdx][1];
});

/* ---------------- demo API (video driver) ---------------- */

window.__demo = {
  setMode,
  setHalo(v) { state.haloOn = v; document.getElementById("chip-halo").classList.toggle("on", v); refresh(); },
  setTheory(v) { state.theory = v; document.getElementById("chip-theory").classList.toggle("on", v); refresh(); },
  setGhost(v) { state.ghost = v; document.getElementById("chip-ghost").classList.toggle("on", v); if (v && state.mode !== "orbits") setMode("orbits"); },
  setKepler(v) { state.kepler = v; document.getElementById("chip-kepler").classList.toggle("on", v); },
  setParam(name, value) {
    const map = { vinf: ["in-vinf", "o-vinf", (x) => x + " km/s"],
      rc: ["in-rc", "o-rc", (x) => x.toFixed(1) + " kpc"],
      mdisk: ["in-mdisk", "o-mdisk", (x) => x.toFixed(1) + "×10¹⁰ M☉"],
      h: ["in-h", "o-h", (x) => x.toFixed(1) + " kpc"] };
    const m = map[name];
    if (!m) return;
    const raw = name === "mdisk" ? value / 1e10 : value;
    document.getElementById(m[0]).value = raw;
    document.getElementById(m[1]).textContent = m[2](raw);
    state.params[name] = value;
    refresh();
  },
  setSlit(r) { state.slitR = r; syncSlitUI(); },
  measure: () => recordPoint(state.slitR),
  sweep,
  resetData() { state.sweepToken++; state.points = []; refresh(); },
  instantPoints,
  loadScenario(name) {
    state.sweepToken++;
    switch (name) {
      case "m31-1970": // start like the paper: measure the curve yourself
        setMode("spectrograph");
        window.__demo.setTheory(false);
        window.__demo.setHalo(true);
        window.__demo.setGhost(false);
        state.points = [];
        state.slitR = 4;
        syncSlitUI();
        refresh();
        hint("Rubin & Ford, 1970: put the slit on a pink HII region and record", 5000);
        break;
      case "measure-flat": // video: measure points one by one
        setMode("spectrograph");
        window.__demo.setTheory(false);
        window.__demo.setHalo(true);
        window.__demo.setGhost(false);
        state.points = [];
        state.slitR = 3;
        syncSlitUI();
        refresh();
        break;
      case "visible-fails": // orbit view with the halo off — rim crawls, data flat
        setMode("orbits");
        instantPoints(12);
        window.__demo.setTheory(true);
        window.__demo.setHalo(false);
        window.__demo.setGhost(false);
        refresh();
        break;
      case "reveal-halo": // the full picture
        setMode("orbits");
        instantPoints(12);
        window.__demo.setTheory(true);
        window.__demo.setHalo(true);
        window.__demo.setGhost(true);
        refresh();
        hint("the violet cloud is what the flat curve demands", 5000);
        break;
      case "birthday":
        setMode("orbits");
        window.__demo.setTheory(true);
        window.__demo.setHalo(true);
        window.__demo.setGhost(true);
        refresh();
        break;
    }
  },
  state,
};

/* ---------------- main loop ---------------- */

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(60, now - lastFrame);
  lastFrame = now;
  drawSky(dt);
  // chart pops animate briefly after each record; redraw cheaply while any pop lives
  if (state.points.some((p) => now - p.born < 500)) drawChart(now);
  requestAnimationFrame(frame);
}

/* ---------------- init ---------------- */

rebuildSpeeds();
instantPoints(12);
setMode("spectrograph");
refresh();
window.addEventListener("resize", () => refresh());
requestAnimationFrame(frame);
setTimeout(() => hint("12 regions measured — the curve refuses to fall. Now reveal Newton's prediction →", 6000), 1200);
