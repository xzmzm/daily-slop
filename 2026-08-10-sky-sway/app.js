// app.js — sky-sway UI layer. Renders the twilight scene, the swaying tower
// with its tuned-mass damper, and the frequency-response plot. All physics
// comes from engine.js; this file is pure visualization + input handling.
//
// The simulation runs a real RK4 integration of the 2-DOF system in engine.js,
// so what you see on screen is the actual sway of the lumped-mass model under
// harmonic wind forcing — not a canned animation.

(function () {
"use strict";

// pull engine symbols into locals (browser: engine.js defines them globally)
const E = {
  buildingPeriod: typeof buildingPeriod !== "undefined" ? buildingPeriod : require_engine().buildingPeriod,
  omegaFromPeriod: typeof omegaFromPeriod !== "undefined" ? omegaFromPeriod : require_engine().omegaFromPeriod,
  stiffness: typeof stiffness !== "undefined" ? stiffness : require_engine().stiffness,
  dampingCoeff: typeof dampingCoeff !== "undefined" ? dampingCoeff : require_engine().dampingCoeff,
  optimalFreqRatio: typeof optimalFreqRatio !== "undefined" ? optimalFreqRatio : require_engine().optimalFreqRatio,
  optimalDampingRatio: typeof optimalDampingRatio !== "undefined" ? optimalDampingRatio : require_engine().optimalDampingRatio,
  denHartog: typeof denHartog !== "undefined" ? denHartog : require_engine().denHartog,
  structureResponse: typeof structureResponse !== "undefined" ? structureResponse : require_engine().structureResponse,
  noDamperResponse: typeof noDamperResponse !== "undefined" ? noDamperResponse : require_engine().noDamperResponse,
  optimalPeakHeight: typeof optimalPeakHeight !== "undefined" ? optimalPeakHeight : require_engine().optimalPeakHeight,
  rk4Step: typeof rk4Step !== "undefined" ? rk4Step : require_engine().rk4Step,
  sampleResponse: typeof sampleResponse !== "undefined" ? sampleResponse : require_engine().sampleResponse,
  findPeaks: typeof findPeaks !== "undefined" ? findPeaks : require_engine().findPeaks,
  REFERENCE_BUILDINGS: typeof REFERENCE_BUILDINGS !== "undefined" ? REFERENCE_BUILDINGS : require_engine().REFERENCE_BUILDINGS
};
function require_engine() {
  // browser global fallback (engine.js defines these at window scope)
  return window || globalThis;
}

// ----------------------------- state ---------------------------------------
const S = {
  floors: 80,
  mu: 0.05,            // mass ratio m2/m1
  f: 0.952,            // damper tuning ω2/ω1   (f_opt = 1/(1+μ) for μ=0.05)
  xi2: 0.127,          // damper damping ratio  (ξ_opt = √(3μ/[8(1+μ)³]) for μ=0.05)
  xi1: 0.01,           // building damping ratio
  wind: 1.0,           // wind force scale
  damperOn: true,
  windOn: true,
  autoTune: true,

  // integration state [x1, v1, x2, v2]  (SI-ish, normalized units)
  state: [0, 0, 0, 0],
  t: 0,
  // display scaling: top-floor sway in meters → pixels
  pxPerMeter: 0,
  // measured peak sway (for the "cut" KPI)
  swayBuf: [],
  peakWith: 0,
  peakWithout: 0,
  cutPct: null,
  // visual: building's natural swaying mode shape
  baseOmega: 0,
  // gust impulse pending
  gustImpulse: 0
};

// ----------------------------- DOM -----------------------------------------
const $ = (id) => document.getElementById(id);
const skyC = $("sky"), bldC = $("building"), plotC = $("plot");
const skyX = skyC.getContext("2d"), bldX = bldC.getContext("2d"), plotX = plotC.getContext("2d");

// ----------------------------- canvas sizing -------------------------------
function fitCanvas(c) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = c.getBoundingClientRect();
  c.width = Math.round(r.width * dpr);
  c.height = Math.round(r.height * dpr);
  return dpr;
}
let dprSky, dprBld, dprPlot;
function resize() {
  dprSky = fitCanvas(skyC);
  dprBld = fitCanvas(bldC);
  dprPlot = fitCanvas(plotC);
  drawSky();
  drawPlot();
}
window.addEventListener("resize", resize);

// ----------------------------- physics params ------------------------------
function recompute() {
  const T1 = E.buildingPeriod(S.floors);
  const omega1 = E.omegaFromPeriod(T1);
  S.baseOmega = omega1;
  // pick a lumped top mass; absolute value only affects display scaling, not
  // the dimensionless response. Use a representative 1e6 kg per floor.
  const M1 = S.floors * 1e6;
  const m2 = S.mu * M1;
  const k1 = E.stiffness(M1, omega1);
  const c1 = E.dampingCoeff(M1, omega1, S.xi1);
  const omega2 = S.f * omega1;
  const k2 = m2 * omega2 * omega2;
  const c2 = 2 * S.xi2 * omega2 * m2;
  // forcing: push at the building's natural frequency for maximum drama
  const F0 = S.wind * k1 * 0.001;   // small fraction of stiffness → modest sway
  return { m1: M1, m2, k1, k2, c1, c2, F0, omegaF: omega1, t: S.t };
}

// ----------------------------- sky -----------------------------------------
const stars = [];
for (let i = 0; i < 90; i++) {
  stars.push({
    x: Math.random(), y: Math.random() * 0.55,
    r: Math.random() * 1.2 + 0.3, tw: Math.random() * Math.PI * 2
  });
}
function drawSky() {
  const w = skyC.width, h = skyC.height;
  // dusk gradient
  const g = skyX.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#0a0f24");
  g.addColorStop(0.45, "#1a2148");
  g.addColorStop(0.75, "#3a2d52");
  g.addColorStop(1, "#1a1228");
  skyX.fillStyle = g;
  skyX.fillRect(0, 0, w, h);
  // stars
  const now = performance.now() / 1000;
  for (const s of stars) {
    const a = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now * 1.5 + s.tw));
    skyX.fillStyle = `rgba(220,230,255,${a})`;
    skyX.beginPath();
    skyX.arc(s.x * w, s.y * h, s.r * dprSky, 0, Math.PI * 2);
    skyX.fill();
  }
  // distant city silhouette
  skyX.fillStyle = "rgba(8,10,22,0.9)";
  const baseY = h * 0.82;
  skyX.beginPath();
  skyX.moveTo(0, h);
  const seed = 12345;
  for (let x = 0; x <= w; x += 14 * dprSky) {
    const bx = x / (14 * dprSky);
    const hh = (30 + 50 * Math.abs(Math.sin(bx * 0.7 + seed) + 0.5 * Math.sin(bx * 1.3))) * dprSky;
    skyX.lineTo(x, baseY - hh);
    skyX.lineTo(x + 14 * dprSky, baseY - hh);
  }
  skyX.lineTo(w, h);
  skyX.closePath();
  skyX.fill();
}

// ----------------------------- building ------------------------------------
function drawBuilding() {
  const w = bldC.width, h = bldC.height;
  bldX.clearRect(0, 0, w, h);
  const cx = w / 2;
  const groundY = h * 0.86;
  const topY = h * 0.10;
  const bldH = groundY - topY;
  const bldW = Math.min(w * 0.16, 120 * dprBld);

  // current top-floor sway from integration state
  const xTop = S.state[0];
  // mode shape: cantilever first mode ≈ (1 - cos(πz/2))/2 mapped 0..1 from
  // ground to top, so the sway grows toward the top.
  function swayAt(zUnit) {
    const shape = 0.5 * (1 - Math.cos(Math.PI * 0.5 * zUnit)); // 0 at ground → 1 at top
    return xTop * shape;
  }
  // visual scale: we want resonant bare sway to be a dramatic but not absurd
  // fraction of building width. Drive a display gain from the current peak.
  const peakMeters = Math.max(Math.abs(S.peakWith), Math.abs(S.peakWithout), 0.3);
  const gain = (bldW * 1.6) / peakMeters;
  const dxTop = swayAt(1) * gain;

  // ---- ground line ----
  bldX.strokeStyle = "rgba(120,130,170,0.25)";
  bldX.lineWidth = 1 * dprBld;
  bldX.beginPath();
  bldX.moveTo(0, groundY);
  bldX.lineTo(w, groundY);
  bldX.stroke();

  // ---- floors (bent building) ----
  // Draw the tower as a stack of thin floor-strips, each displaced by swayAt.
  const nStrips = Math.min(S.floors, 40);
  for (let i = 0; i < nStrips; i++) {
    const z0 = i / nStrips, z1 = (i + 1) / nStrips;
    const yBot = groundY - z0 * bldH;
    const yTop = groundY - z1 * bldH;
    const dxBot = swayAt(z0) * gain;
    const dxTop2 = swayAt(z1) * gain;
    // glass body
    const lit = i % 5 === 0;
    bldX.fillStyle = lit ? "rgba(80,120,180,0.10)" : "rgba(40,70,120,0.07)";
    bldX.beginPath();
    bldX.moveTo(cx + dxBot - bldW / 2, yBot);
    bldX.lineTo(cx + dxTop2 - bldW / 2, yTop);
    bldX.lineTo(cx + dxTop2 + bldW / 2, yTop);
    bldX.lineTo(cx + dxBot + bldW / 2, yBot);
    bldX.closePath();
    bldX.fill();
    // edge
    bldX.strokeStyle = "rgba(120,170,220,0.20)";
    bldX.lineWidth = 0.5 * dprBld;
    bldX.stroke();
    // window lights (procedural, deterministic per floor)
    const winSeed = i * 7.3;
    for (let ww = 0; ww < 4; ww++) {
      const on = ((winSeed + ww * 2.1) % 3) < 1.8;
      if (!on) continue;
      const wx = cx + dxTop2 + (ww - 1.5) * (bldW / 4);
      const wy = (yBot + yTop) / 2;
      bldX.fillStyle = `rgba(255,210,140,${0.5 + 0.3 * Math.sin(winSeed + ww)})`;
      bldX.fillRect(wx - 1.5 * dprBld, wy - 2 * dprBld, 3 * dprBld, 3 * dprBld);
    }
  }

  // ---- outline highlight ----
  bldX.strokeStyle = "rgba(150,200,240,0.5)";
  bldX.lineWidth = 1.2 * dprBld;
  bldX.beginPath();
  bldX.moveTo(cx - bldW / 2, groundY);
  bldX.lineTo(cx + dxTop - bldW / 2, topY);
  bldX.moveTo(cx + bldW / 2, groundY);
  bldX.lineTo(cx + dxTop + bldW / 2, topY);
  bldX.stroke();

  // ---- damper sphere near the top (the star) ----
  if (S.damperOn) {
    const damperZ = 0.86;           // hung near the top
    const damperY = groundY - damperZ * bldH;
    const dxDamperShell = swayAt(damperZ) * gain;
    // damper mass position relative to building's local frame:
    const x2rel = S.state[2] - swayAt(damperZ); // relative disp
    const sphereR = Math.max(bldW * 0.16, 10 * dprBld);
    const sx = cx + dxDamperShell + x2rel * gain;
    const sy = damperY;
    // tether lines (4 diagonals to a frame)
    bldX.strokeStyle = "rgba(200,160,80,0.35)";
    bldX.lineWidth = 1 * dprBld;
    const frameR = bldW * 0.42;
    for (const [ox, oy] of [[-frameR, -frameR * 0.8], [frameR, -frameR * 0.8], [-frameR, frameR * 0.8], [frameR, frameR * 0.8]]) {
      const fx = cx + dxDamperShell + ox;
      const fy = damperY + oy;
      bldX.beginPath();
      bldX.moveTo(fx, fy);
      bldX.lineTo(sx, sy);
      bldX.stroke();
    }
    // glow
    const glow = bldX.createRadialGradient(sx, sy, 0, sx, sy, sphereR * 2.4);
    glow.addColorStop(0, "rgba(255,200,110,0.55)");
    glow.addColorStop(0.5, "rgba(255,160,60,0.18)");
    glow.addColorStop(1, "rgba(255,140,40,0)");
    bldX.fillStyle = glow;
    bldX.beginPath();
    bldX.arc(sx, sy, sphereR * 2.4, 0, Math.PI * 2);
    bldX.fill();
    // sphere
    const sg = bldX.createRadialGradient(sx - sphereR * 0.3, sy - sphereR * 0.3, 0, sx, sy, sphereR);
    sg.addColorStop(0, "#fff0c0");
    sg.addColorStop(0.5, "#ffb84d");
    sg.addColorStop(1, "#a85f10");
    bldX.fillStyle = sg;
    bldX.beginPath();
    bldX.arc(sx, sy, sphereR, 0, Math.PI * 2);
    bldX.fill();
    bldX.strokeStyle = "rgba(255,230,170,0.8)";
    bldX.lineWidth = 1 * dprBld;
    bldX.stroke();
  }

  // ---- sway indicator at top ----
  bldX.fillStyle = "rgba(79,208,255,0.9)";
  bldX.font = `${10 * dprBld}px ui-monospace, monospace`;
  bldX.textAlign = "center";
  const swayCm = Math.abs(xTop) * 100; // state is in "meters"
  bldX.fillText(`${swayCm.toFixed(1)} cm`, cx + dxTop, topY - 8 * dprBld);
}

// ----------------------------- plot ----------------------------------------
function drawPlot() {
  const w = plotC.width, h = plotC.height;
  plotX.clearRect(0, 0, w, h);
  const pad = { l: 38 * dprPlot, r: 12 * dprPlot, t: 12 * dprPlot, b: 26 * dprPlot };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;

  const mu = S.mu;
  const f = S.f;
  const xi1 = S.xi1, xi2 = S.xi2;

  // sample both curves
  const pts = E.sampleResponse(mu, f, xi1, xi2, { gMin: 0.3, gMax: 1.7, n: 441 });
  // y-max: take the larger of bare peak and damped peaks, with headroom
  const bareMax = 1 / (2 * xi1);
  let yMax = Math.min(bareMax, 40);     // cap absurd light-damping peaks for plot
  let dampedMax = 0;
  for (const p of pts) { if (isFinite(p.h) && p.h > dampedMax) dampedMax = p.h; }
  yMax = Math.max(yMax, dampedMax * 1.15, 6);
  yMax = Math.min(yMax, 45);

  // grid
  plotX.strokeStyle = "rgba(120,130,170,0.12)";
  plotX.lineWidth = 1 * dprPlot;
  plotX.fillStyle = "#5a6590";
  plotX.font = `${9 * dprPlot}px ui-monospace, monospace`;
  plotX.textAlign = "right";
  plotX.textBaseline = "middle";
  for (let i = 0; i <= 5; i++) {
    const yv = (i / 5) * yMax;
    const y = pad.t + ph - (yv / yMax) * ph;
    plotX.beginPath(); plotX.moveTo(pad.l, y); plotX.lineTo(pad.l + pw, y); plotX.stroke();
    plotX.fillText(yv.toFixed(0), pad.l - 4 * dprPlot, y);
  }
  plotX.textAlign = "center";
  plotX.textBaseline = "top";
  for (let i = 0; i <= 7; i++) {
    const gv = 0.3 + (1.4) * (i / 7);
    const x = pad.l + (gv - 0.3) / 1.4 * pw;
    plotX.beginPath(); plotX.moveTo(x, pad.t); plotX.lineTo(x, pad.t + ph); plotX.stroke();
    plotX.fillText(gv.toFixed(2), x, pad.t + ph + 4 * dprPlot);
  }
  // axes labels
  plotX.fillStyle = "#94a0c8";
  plotX.font = `${9 * dprPlot}px ui-monospace, monospace`;
  plotX.textAlign = "center";
  plotX.fillText("forcing frequency  g = ω / ω₁", pad.l + pw / 2, h - 8 * dprPlot);
  plotX.save();
  plotX.translate(11 * dprPlot, pad.t + ph / 2);
  plotX.rotate(-Math.PI / 2);
  plotX.fillText("|H|  amplification", 0, 0);
  plotX.restore();

  const gx = (g) => pad.l + (g - 0.3) / 1.4 * pw;
  const gy = (val) => pad.t + ph - (Math.min(val, yMax) / yMax) * ph;

  // bare curve
  plotX.strokeStyle = "#ff5d7a";
  plotX.lineWidth = 1.6 * dprPlot;
  plotX.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const x = gx(pts[i].g), y = gy(pts[i].h0);
    if (i === 0) plotX.moveTo(x, y); else plotX.lineTo(x, y);
  }
  plotX.stroke();

  // with-TMD curve
  plotX.strokeStyle = "#5dffb0";
  plotX.lineWidth = 1.8 * dprPlot;
  plotX.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const x = gx(pts[i].g), y = gy(pts[i].h);
    if (i === 0) plotX.moveTo(x, y); else plotX.lineTo(x, y);
  }
  plotX.stroke();

  // Den Hartog optimum: horizontal line at sqrt(1+2/μ) and g markers
  const optPeak = E.optimalPeakHeight(mu);
  if (optPeak < yMax) {
    plotX.strokeStyle = "rgba(255,184,77,0.5)";
    plotX.setLineDash([4 * dprPlot, 3 * dprPlot]);
    plotX.lineWidth = 1 * dprPlot;
    const y = gy(optPeak);
    plotX.beginPath();
    plotX.moveTo(pad.l, y); plotX.lineTo(pad.l + pw, y);
    plotX.stroke();
    plotX.setLineDash([]);
    plotX.fillStyle = "#ffb84d";
    plotX.font = `${9 * dprPlot}px ui-monospace, monospace`;
    plotX.textAlign = "left";
    plotX.textBaseline = "bottom";
    plotX.fillText(`√(1+2/μ)=${optPeak.toFixed(2)}`, pad.l + 4 * dprPlot, y - 2 * dprPlot);
  }

  // current damper tuning marker (vertical at f)
  const fx = gx(f);
  plotX.strokeStyle = "rgba(255,184,77,0.25)";
  plotX.lineWidth = 1 * dprPlot;
  plotX.beginPath();
  plotX.moveTo(fx, pad.t); plotX.lineTo(fx, pad.t + ph);
  plotX.stroke();

  // resonance line g=1
  const gx1 = gx(1.0);
  plotX.strokeStyle = "rgba(150,170,220,0.18)";
  plotX.setLineDash([2 * dprPlot, 3 * dprPlot]);
  plotX.beginPath();
  plotX.moveTo(gx1, pad.t); plotX.lineTo(gx1, pad.t + ph);
  plotX.stroke();
  plotX.setLineDash([]);
}

// ----------------------------- KPIs ----------------------------------------
function fmt(n, d) { d = d == null ? 1 : d; return n.toFixed(d); }
function updateReadout() {
  const T1 = E.buildingPeriod(S.floors);
  $("kFloors").textContent = S.floors;
  $("kT1").textContent = fmt(T1, 1);
  const swayCm = Math.abs(S.state[0]) * 100;
  $("kSway").textContent = fmt(swayCm, 1);
  if (S.cutPct != null && isFinite(S.cutPct)) {
    const cut = S.cutPct;
    $("kCut").textContent = (cut > 0 ? "−" : "+") + fmt(Math.abs(cut), 0) + "%";
  } else {
    $("kCut").textContent = "—";
  }

  // formula card
  const dh = E.denHartog(S.mu);
  $("fMu").textContent = fmt(S.mu, 3);
  $("fFopt").textContent = fmt(dh.freqRatio, 3);
  $("fXiopt").textContent = fmt(dh.dampingRatio, 3);
  $("fPeak").textContent = fmt(E.optimalPeakHeight(S.mu), 2);

  // tuning status
  const ts = $("tuneStatus");
  const fErr = Math.abs(S.f - dh.freqRatio) / dh.freqRatio;
  const xErr = Math.abs(S.xi2 - dh.dampingRatio) / Math.max(dh.dampingRatio, 1e-3);
  if (S.autoTune) {
    ts.textContent = "● auto-tuned to Den Hartog optimum";
    ts.className = "good";
  } else if (fErr < 0.02 && xErr < 0.15) {
    ts.textContent = "● near optimal — equal peaks";
    ts.className = "good";
  } else if (fErr < 0.1) {
    ts.textContent = "◐ roughly tuned (f within 10%)";
    ts.className = "";
  } else {
    ts.textContent = "○ mis-tuned — one peak dominates, sway returns";
    ts.className = "bad";
  }
}

// ----------------------------- main loop -----------------------------------
let last = performance.now();
function frame(now) {
  const realDt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (S.windOn || S.gustImpulse > 0) {
    // sub-step the integrator for stability: ω·dt < 0.1
    const p = recompute();
    const targetDt = Math.min(realDt, 0.1 / Math.max(S.baseOmega, 0.5));
    let acc = realDt;
    // apply gust as an impulse to velocity
    if (S.gustImpulse > 0) {
      S.state[1] += S.gustImpulse;
      S.gustImpulse = 0;
    }
    let steps = 0;
    while (acc > 0 && steps < 400) {
      const h = Math.min(targetDt, acc);
      // turn damper on/off by zeroing its coupling
      const pc = Object.assign({}, p);
      if (!S.damperOn) { pc.m2 = 0; pc.k2 = 0; pc.c2 = 0; }
      if (!S.windOn) pc.F0 = 0;
      pc.t = S.t;
      S.state = E.rk4Step(S.state, pc, h);
      S.t += h;
      acc -= h;
      steps++;
    }
    // track peak sway for the display gain (rolling max over last ~6 s)
    S.swayBuf.push({ t: S.t, x: Math.abs(S.state[0]) });
    while (S.swayBuf.length && S.t - S.swayBuf[0].t > 6) S.swayBuf.shift();
    let pk = 0;
    for (const b of S.swayBuf) if (b.x > pk) pk = b.x;
    // peak cut KPI: compare the THEORETICAL transfer-function peaks (instant,
    // correct, independent of how long the sim has been building up). The bare
    // tower's resonance is 1/(2ξ1); the optimally-tuned damper caps it at
    // √(1+2/μ). For a *mis*-tuned damper the peak is higher, so use the actual
    // damped transfer-function peak from findPeaks.
    const barePk = 1 / (2 * S.xi1);
    let dampedPk;
    if (S.damperOn) {
      const peaks = E.findPeaks(S.mu, S.f, S.xi1, S.xi2);
      dampedPk = peaks.length ? peaks[0].h : barePk;
    } else {
      dampedPk = barePk;
    }
    S.peakWith = dampedPk * (S.wind * 0.001);       // for gain scaling
    S.peakWithout = barePk * (S.wind * 0.001);
    S.cutPct = (1 - dampedPk / barePk) * 100;
  } else {
    // no wind: let it settle
    S.state[0] *= 0.94; S.state[1] *= 0.94; S.state[2] *= 0.94; S.state[3] *= 0.94;
  }

  drawSky();
  drawBuilding();
  updateReadout();
  requestAnimationFrame(frame);
}

// ----------------------------- plot refresh --------------------------------
function refreshPlotAndLabels() {
  drawPlot();
  // slider value labels
  $("vFloors").textContent = S.floors;
  $("vMu").textContent = fmt(S.mu, 3);
  $("vF").textContent = fmt(S.f, 3);
  $("vXi2").textContent = fmt(S.xi2, 3);
  $("vXi1").textContent = fmt(S.xi1, 3);
  $("vWind").textContent = fmt(S.wind, 2);
  // HUD
  const windWord = S.wind < 0.4 ? "calm" : S.wind < 1.0 ? "breezy" : S.wind < 1.7 ? "moderate" : "gale";
  $("windLabel").textContent = S.windOn ? windWord : "off";
  $("damperLabel").textContent = S.damperOn ? (S.autoTune ? "on · optimal" : "on · manual") : "off";
  const hint = $("tuneHint");
  if (hint) {
    if (!S.damperOn) hint.textContent = "damper off — bare resonance";
    else if (S.autoTune) hint.textContent = "optimal tuning applied";
    else {
      const dh = E.denHartog(S.mu);
      const fErr = Math.abs(S.f - dh.freqRatio) / dh.freqRatio;
      hint.textContent = fErr < 0.05 ? "near optimal tuning" : "manual tuning";
    }
  }
  // button states
  $("damperToggle").textContent = "damper: " + (S.damperOn ? "on" : "off");
  $("damperToggle").classList.toggle("active", S.damperOn);
  $("autoTune").classList.toggle("active", S.autoTune);
  const pb = $("playBtn");
  pb.textContent = S.windOn ? "⏸ wind off" : "▶ wind on";
  pb.classList.toggle("off", !S.windOn);
}

// ----------------------------- input wiring --------------------------------
function bindSlider(id, key, parser, after) {
  const el = $(id);
  el.addEventListener("input", () => {
    S[key] = parser(el.value);
    if (after) after();
    refreshPlotAndLabels();
  });
}
bindSlider("sFloors", "floors", parseFloat, () => { S.state = [S.state[0] * 0.3, S.state[1] * 0.3, S.state[2] * 0.3, S.state[3] * 0.3]; });
bindSlider("sMu", "mu", parseFloat);
bindSlider("sF", "f", parseFloat);
bindSlider("sXi2", "xi2", parseFloat);
bindSlider("sXi1", "xi1", parseFloat);
bindSlider("sWind", "wind", parseFloat);

$("playBtn").addEventListener("click", () => {
  S.windOn = !S.windOn;
  refreshPlotAndLabels();
});
$("damperToggle").addEventListener("click", () => {
  S.damperOn = !S.damperOn;
  refreshPlotAndLabels();
});
$("autoTune").addEventListener("click", () => {
  S.autoTune = !S.autoTune;
  if (S.autoTune) applyDenHartog();
  refreshPlotAndLabels();
});
$("resetBtn").addEventListener("click", () => {
  S.state = [0, 0, 0, 0]; S.t = 0; S.swayBuf = []; S.peakWith = 0; S.peakWithout = 0;
});
$("gustBtn").addEventListener("click", () => { S.gustImpulse += 0.6; });
window.addEventListener("keydown", (ev) => {
  if (ev.code === "Space") { ev.preventDefault(); S.gustImpulse += 0.6; }
});

function applyDenHartog() {
  const dh = E.denHartog(S.mu);
  S.f = dh.freqRatio;
  S.xi2 = dh.dampingRatio;
  $("sF").value = S.f;
  $("sXi2").value = S.xi2;
}

// presets
const PRESETS = {
  taipei101: { floors: 101, mu: 0.05, xi1: 0.01, wind: 1.2 },
  shanghai:  { floors: 128, mu: 0.04, xi1: 0.012, wind: 1.4 },
  thin:      { floors: 110, mu: 0.03, xi1: 0.008, wind: 1.0 },
  stubby:    { floors: 40,  mu: 0.08, xi1: 0.03, wind: 0.8 }
};
document.querySelectorAll(".chip").forEach(btn => {
  btn.addEventListener("click", () => {
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;
    document.querySelectorAll(".chip").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    Object.assign(S, p);
    S.autoTune = true; applyDenHartog();
    $("sFloors").value = S.floors;
    $("sMu").value = S.mu;
    $("sXi1").value = S.xi1;
    $("sWind").value = S.wind;
    S.state = [0, 0, 0, 0]; S.t = 0; S.swayBuf = [];
    refreshPlotAndLabels();
  });
});

// go
resize();
refreshPlotAndLabels();
// seed a startup gust so the building visibly sways from the first frames
// (a cold start at resonance takes ~one full period — ~8 s — to build up).
S.gustImpulse = 0.8;
requestAnimationFrame(frame);

})();
