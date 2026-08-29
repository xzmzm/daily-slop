// app.js — Rutherford's Foil studio.
// The bench is a pure function of the simulation clock: window.__demo.step(dt)
// advances the integrator, the counters and the flash ages, so every frame is
// reproducible (video mode freezes rAF and drives only through __demo).
// Visible tracks and flashes are a sampled demo beam; the odometers integrate
// the exact closed forms (n·t·σ) — the label on the canvas says so.

import {
  ELEMENTS, kZZ, bFromTheta, thetaFromB, rMin, headOnDistance,
  dsigmaDOmega, sigmaAbove, numberDensity, probAbove, foilForOneIn,
  eCritContact, contactRadius, thetaContact, alphaBeta, traceTrajectory,
  PRESETS, qValue1919, threshold1919, nuclearRadius,
} from "./physics.js";

const DEG = Math.PI / 180;
const RADIUS_PM = { Al: 143, Cu: 128, Ag: 144, Au: 144 }; // metallic radii, pm

// --- deterministic RNG -------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(20260830);

// --- state -------------------------------------------------------------------
const state = {
  el: "Au", eMeV: 7.69, tUm: 0.4, rateS: 65,
  auto: true, t: 0, fired: 0, backCount: 0,
  beamAlpha: 0, emitTimer: 0, quoteShown: false, videoMode: false,
};

const el = () => ELEMENTS[state.el];
const kOf = () => kZZ(el().z);
const tM = () => state.tUm * 1e-6;
const b90 = () => bFromTheta(90 * DEG, kOf(), state.eMeV);
const dOf = () => headOnDistance(kOf(), state.eMeV);
const rcOf = () => contactRadius(el().a);
const pAbove90 = () => probAbove(90 * DEG, kOf(), state.eMeV, el(), tM());

// --- formatting --------------------------------------------------------------
const fmtFm = (x, d = 1) => (isFinite(x) ? x.toFixed(d) : "∞");
const fmtBig = (x) =>
  x >= 1e5 ? (x / 1e3).toFixed(0) + "×10³" : Math.round(x).toLocaleString("en-US");
const fmtOneIn = (n) => (n >= 1e5 ? "1 in " + n.toExponential(1) : "1 in " + Math.round(n).toLocaleString("en-US"));

// --- canvas plumbing ---------------------------------------------------------
function fit(canvas, w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

const COLORS = {
  cyan: "#5fc6d8", cyan2: "#8ce0ec", gold: "#d9a93f", gold2: "#f0c75e",
  phosphor: "#9ee0a0", red: "#e0685c", ember: "#e8963a",
  ink: "#e4eef2", dim: "#8aa3b2", faint: "#5d7484", line: "#223444",
};

// =============================================================================
// THE BENCH
// =============================================================================
const bench = document.getElementById("bench");
const BW = 960, BH = 430;
const bctx = fit(bench, BW, BH);
const CX = 560, CY = 205, CH_R = 186, MAG_R = 138;

// view half-width of the magnifier, fm — keeps d, R_c and ~2.5·b₉₀ in frame
function viewW() {
  return Math.max(2.6 * b90(), 2.3 * Math.max(dOf(), rcOf()), 24);
}

// trace cache keyed by quantised impact parameter (same el/E ⇒ same hyperbola)
let traceCache = new Map();
function traceFor(bFm) {
  const key = Math.round(bFm / (0.05 * b90()));
  if (traceCache.has(key)) return traceCache.get(key);
  const tr = traceTrajectory({ k: kOf(), eMeV: state.eMeV, bFm: Math.abs(key) * 0.05 * b90(), x0Fm: 640, dTau: 1.3 });
  const rec = { ...tr, thetaAbs: Math.abs(tr.theta), bFm: Math.abs(key) * 0.05 * b90() };
  traceCache.set(key, rec);
  return rec;
}

const particles = [];  // live tracks in the magnifier
const flashes = [];    // { ang, age, big }
let backFlashNum = 0;

function spawnBurst() {
  state.beamAlpha = 1;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const u = rng();
    let ratio; // b / b₉₀ — sampled to show all fates honestly, not in proportion
    if (u < 0.14) ratio = 0.01 + 0.05 * rng();        // near head-on (the drama)
    else if (u < 0.45) ratio = 0.15 + 0.85 * rng();   // strong deflection
    else ratio = 1.0 + 1.3 * rng();                   // the pass-through crowd
    const sign = rng() < 0.5 ? 1 : -1;
    const rec = traceFor(ratio * b90());
    const rc = rcOf();
    let contactIdx = -1;
    for (let j = 0; j < rec.pts.length; j++) {
      const [x, y] = rec.pts[j];
      if (Math.hypot(x, y) < rc) { contactIdx = j; break; }
    }
    particles.push({
      rec, sign, idx: -rng() * 60, speed: 620 + 260 * rng(), born: state.t,
      fade: 1, contactIdx, done: false,
    });
    if (particles.length > 26) particles.shift();
  }
  // rim flashes sampled from the exact inverse-CDF of the cosec⁴ law
  const nFlash = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < nFlash; i++) {
    flashes.push({ ang: sampleAngle(), age: 0, big: false });
  }
  if (flashes.length > 90) flashes.splice(0, flashes.length - 90);
}

// P(θ) ∝ sinθ/sin⁴(θ/2) ⇒ s = sin(θ/2) = s_min/√u exactly
const S_MIN = Math.sin(3 * DEG);
function sampleAngle() {
  const u = Math.max(1e-9, rng());
  return 2 * Math.asin(Math.min(1, S_MIN / Math.sqrt(u))) / DEG;
}
// θ | θ>90° — inverse CDF on s ∈ [√2/2, 1]
function sampleBackAngle() {
  const s0 = Math.SQRT1_2;
  const u = rng();
  const s = 1 / Math.sqrt(1 / (s0 * s0) - u * (1 / (s0 * s0) - 1));
  return 2 * Math.asin(Math.min(1, s)) / DEG;
}

function drawBench() {
  const c = bctx;
  c.clearRect(0, 0, BW, BH);
  const k = kOf(), E = state.eMeV, rc = rcOf(), d = dOf(), b9 = b90();
  const W = viewW(), s = MAG_R / W;

  // --- chamber ---
  c.save();
  const grad = c.createRadialGradient(CX, CY, 40, CX, CY, CH_R);
  grad.addColorStop(0, "#0c141c"); grad.addColorStop(1, "#070c12");
  c.beginPath(); c.arc(CX, CY, CH_R, 0, 7); c.fillStyle = grad; c.fill();
  c.lineWidth = 7; c.strokeStyle = "#2c3f52"; c.stroke();
  c.lineWidth = 1.4; c.strokeStyle = "#48627d";
  c.beginPath(); c.arc(CX, CY, CH_R - 6, 0, 7); c.stroke();
  c.beginPath(); c.arc(CX, CY, CH_R - 11, 0, 7); c.stroke();

  // --- histogram of the counting law (exact, inward from the rim) ---
  const smax = dsigmaDOmega(10 * DEG, k, E);
  const smin = dsigmaDOmega(170 * DEG, k, E);
  const lg = Math.log10(smax / smin);
  for (let a = 10; a <= 170; a += 10) {
    const rel = Math.log10(dsigmaDOmega(a * DEG, k, E) / smax);
    const L = 14 + (-rel / lg) * 46;
    for (const sign of [1, -1]) {
      const rad = a * DEG * sign;
      const x1 = CX + (CH_R - 14) * Math.cos(rad), y1 = CY - (CH_R - 14) * Math.sin(rad);
      const x2 = CX + (CH_R - 14 - L) * Math.cos(rad), y2 = CY - (CH_R - 14 - L) * Math.sin(rad);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
      c.lineWidth = 3.5; c.strokeStyle = a >= 90 ? "rgba(158,224,160,.75)" : "rgba(95,198,216,.5)";
      c.stroke();
    }
  }
  // angle labels
  c.font = "10px ui-monospace, Menlo, monospace"; c.fillStyle = COLORS.faint;
  c.textAlign = "center"; c.textBaseline = "middle";
  for (const a of [30, 60, 90, 120, 150]) {
    const rad = a * DEG;
    c.fillText(a + "°", CX + (CH_R - 78) * Math.cos(rad), CY - (CH_R - 78) * Math.sin(rad));
  }

  // --- rim flashes (ZnS scintillations) ---
  for (const f of flashes) {
    const rad = f.ang * DEG;
    const rr = CH_R - 9;
    const x = CX + rr * Math.cos(rad), y = CY - rr * Math.sin(rad);
    const a = Math.max(0, 1 - f.age / 1.15);
    if (a <= 0) continue;
    if (f.big) {
      c.save();
      c.globalAlpha = a;
      c.strokeStyle = COLORS.gold2; c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, 6 + (1 - a) * 26, 0, 7); c.stroke();
      c.fillStyle = "#fff";
      c.beginPath(); c.arc(x, y, 4.2, 0, 7); c.fill();
      c.fillStyle = COLORS.gold2; c.font = "700 11px ui-monospace, Menlo, monospace";
      c.textAlign = "center";
      c.fillText("↩ " + Math.round(Math.abs(f.ang)) + "°", x, y - 22 - (1 - a) * 8);
      c.restore();
    } else {
      c.globalAlpha = a * 0.95;
      c.fillStyle = COLORS.phosphor;
      c.beginPath(); c.arc(x, y, 2.1, 0, 7); c.fill();
      c.globalAlpha = 1;
    }
  }

  // --- source + collimator + beam ---
  c.save();
  const leadG = c.createLinearGradient(18, 0, 118, 0);
  leadG.addColorStop(0, "#39434c"); leadG.addColorStop(1, "#232b33");
  c.fillStyle = leadG;
  c.beginPath(); c.roundRect(18, 163, 100, 84, 6); c.fill();
  c.strokeStyle = "#52616e"; c.lineWidth = 1.2; c.stroke();
  c.fillStyle = COLORS.phosphor;
  c.beginPath(); c.arc(94, 205, 5, 0, 7); c.fill();
  c.fillStyle = COLORS.dim; c.font = "10px ui-monospace, Menlo, monospace";
  c.textAlign = "center";
  c.fillText("RaC′ 镭源", 68, 180);
  c.fillText("铅块", 68, 236);
  for (const bx of [132, 156]) {
    c.fillStyle = "#4a5866";
    c.fillRect(bx, 171, 8, 26); c.fillRect(bx, 213, 8, 26);
  }
  c.fillStyle = COLORS.faint; c.font = "9.5px ui-monospace, Menlo, monospace";
  c.fillText("准直缝", 148, 252);
  c.restore();

  // beam dots (cosmetic feed toward the foil)
  if (state.beamAlpha > 0.02) {
    c.save(); c.globalAlpha = state.beamAlpha;
    c.fillStyle = COLORS.cyan2;
    for (let i = 0; i < 9; i++) {
      const x = 150 + ((state.t * 150 + i * 30.5) % (CX - MAG_R - 150));
      c.beginPath(); c.arc(x, 205, 1.9, 0, 7); c.fill();
    }
    c.restore();
  }

  // --- magnifier: the nuclear scale ---
  c.save();
  c.beginPath(); c.arc(CX, CY, MAG_R, 0, 7);
  c.fillStyle = "#0a0f16"; c.fill();
  c.lineWidth = 1.6; c.setLineDash([7, 5]);
  c.strokeStyle = COLORS.line2; c.stroke(); c.setLineDash([]);
  c.clip();

  // reference circles: R_c (contact) and d = k/E (head-on turning point)
  c.setLineDash([4, 4]); c.lineWidth = 1.1;
  c.strokeStyle = COLORS.gold;
  c.beginPath(); c.arc(CX, CY, d * s, 0, 7); c.stroke();
  c.setLineDash([]);
  c.strokeStyle = COLORS.red; c.lineWidth = 1.6;
  c.beginPath(); c.arc(CX, CY, Math.max(2.5, rc * s), 0, 7); c.stroke();

  // the nucleus
  const nR = Math.max(3, rc * s * 0.55);
  const nGrad = c.createRadialGradient(CX, CY, 1, CX, CY, nR * 1.7);
  nGrad.addColorStop(0, "#ffd9a0"); nGrad.addColorStop(0.45, COLORS.ember);
  nGrad.addColorStop(1, "rgba(224,104,92,0)");
  c.fillStyle = nGrad;
  c.beginPath(); c.arc(CX, CY, nR * 1.7, 0, 7); c.fill();

  // ±b₉₀ ticks on the incoming edge
  c.strokeStyle = COLORS.gold2; c.lineWidth = 1.4;
  for (const sg of [1, -1]) {
    const y = CY - sg * b9 * s;
    c.beginPath(); c.moveTo(CX - MAG_R, y - 4); c.lineTo(CX - MAG_R + 10, y); c.lineTo(CX - MAG_R, y + 4); c.stroke();
  }

  // live tracks (mirrored top/bottom by the particle's sign)
  for (const p of particles) {
    const rec = p.rec;
    const n = Math.max(0, Math.min(rec.pts.length - 1, Math.floor(p.idx)));
    const yFlip = (pt) => [CX + pt[0] * s, CY - pt[1] * p.sign * s];
    // full path ghost
    c.beginPath();
    rec.pts.forEach((pt, i) => { const [px, py] = yFlip(pt); i ? c.lineTo(px, py) : c.moveTo(px, py); });
    c.lineWidth = 1; c.strokeStyle = "rgba(95,198,216,.14)"; c.stroke();

    // travelled portion — dashed after contact (Rutherford's law has ended)
    const solidEnd = p.contactIdx >= 0 ? Math.min(n, p.contactIdx) : n;
    c.beginPath();
    for (let i = 0; i <= solidEnd; i++) { const [px, py] = yFlip(rec.pts[i]); i ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.lineWidth = 2; c.strokeStyle = "rgba(140,224,236,.9)"; c.stroke();
    if (p.contactIdx >= 0 && n > p.contactIdx) {
      c.setLineDash([5, 5]);
      c.beginPath();
      for (let i = p.contactIdx; i <= n; i++) { const [px, py] = yFlip(rec.pts[i]); i === p.contactIdx ? c.moveTo(px, py) : c.lineTo(px, py); }
      c.lineWidth = 2; c.strokeStyle = "rgba(224,104,92,.8)"; c.stroke();
      c.setLineDash([]);
      const [cx2, cy2] = yFlip(rec.pts[p.contactIdx]);
      c.strokeStyle = COLORS.red; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(cx2 - 5, cy2 - 5); c.lineTo(cx2 + 5, cy2 + 5);
      c.moveTo(cx2 + 5, cy2 - 5); c.lineTo(cx2 - 5, cy2 + 5); c.stroke();
    }

    // head
    if (n < rec.pts.length - 1) {
      const [px, py] = yFlip(rec.pts[n]);
      c.fillStyle = "#e8fbff";
      c.beginPath(); c.arc(px, py, 2.6, 0, 7); c.fill();
      c.fillStyle = "rgba(140,224,236,.35)";
      c.beginPath(); c.arc(px, py, 5.5, 0, 7); c.fill();
    }
    p.fade = p.done ? Math.max(0, p.fade - 0.02) : 1;
  }

  // exit rays: magnifier edge → rim at the deflection angle
  for (const p of particles) {
    if (!p.done || p.fade <= 0) continue;
    const a = p.rec.theta * p.sign * DEG;
    c.globalAlpha = 0.5 * p.fade;
    c.strokeStyle = p.rec.thetaAbs > 90 * DEG ? COLORS.gold2 : COLORS.cyan;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(CX + MAG_R * Math.cos(a), CY - MAG_R * Math.sin(a));
    c.lineTo(CX + (CH_R - 13) * Math.cos(a), CY - (CH_R - 13) * Math.sin(a));
    c.stroke();
    c.globalAlpha = 1;
  }
  c.restore(); // magnifier clip

  // magnifier labels
  c.fillStyle = COLORS.gold2; c.font = "10.5px ui-monospace, Menlo, monospace";
  c.textAlign = "left";
  c.fillText("d = k/E", CX + d * s + 5, CY - 4);
  c.fillStyle = COLORS.red;
  c.fillText("R_c", CX + Math.max(2.5, rc * s) + 5, CY + 12);
  c.fillStyle = COLORS.faint; c.textAlign = "center";
  c.fillText("×10⁷ 核尺度", CX, CY - MAG_R + 15);
  // scale bar
  const barFm = W / 5;
  c.strokeStyle = COLORS.dim; c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(CX - MAG_R + 16, CY + MAG_R - 18); c.lineTo(CX - MAG_R + 16 + barFm * s, CY + MAG_R - 18);
  c.moveTo(CX - MAG_R + 16, CY + MAG_R - 23); c.lineTo(CX - MAG_R + 16, CY + MAG_R - 13);
  c.moveTo(CX - MAG_R + 16 + barFm * s, CY + MAG_R - 23); c.lineTo(CX - MAG_R + 16 + barFm * s, CY + MAG_R - 13);
  c.stroke();
  c.fillStyle = COLORS.dim; c.textAlign = "left";
  c.fillText(fmtFm(barFm, 0) + " fm", CX - MAG_R + 16, CY + MAG_R - 28);

  // --- counters ---
  c.save();
  c.fillStyle = "rgba(4,8,12,.72)";
  c.beginPath(); c.roundRect(20, 12, 280, 58, 8); c.fill();
  c.strokeStyle = COLORS.line; c.lineWidth = 1; c.stroke();
  c.fillStyle = COLORS.faint; c.font = "10px ui-monospace, Menlo, monospace"; c.textAlign = "left";
  c.fillText("α 已发射（按束流强度积分）", 32, 28);
  c.fillStyle = COLORS.cyan2; c.font = "600 15px ui-monospace, Menlo, monospace";
  c.fillText(fmtBig(state.fired), 32, 47);
  c.fillStyle = COLORS.faint; c.font = "10px ui-monospace, Menlo, monospace";
  c.fillText("θ>90°回弹", 196, 28);
  c.fillStyle = COLORS.gold2; c.font = "600 15px ui-monospace, Menlo, monospace";
  c.fillText(fmtBig(state.backCount), 196, 47);
  c.restore();

  // honesty label
  c.fillStyle = COLORS.faint; c.font = "10px ui-monospace, Menlo, monospace"; c.textAlign = "left";
  c.fillText("轨迹与闪烁为演示取样 · 计数按闭式 P = n·t·π·b₉₀² 积分", 20, BH - 12);

  // quote toast on first backscatter
  const qt = quoteToast;
  if (qt.age < 4.4) {
    const aIn = Math.min(1, qt.age / 0.3), aOut = Math.max(0, Math.min(1, (4.4 - qt.age) / 0.4));
    c.save(); c.globalAlpha = Math.min(aIn, aOut);
    const w = 560;
    c.fillStyle = "rgba(6,10,14,.9)";
    c.beginPath(); c.roundRect(CX - w / 2, BH - 58, w, 42, 9); c.fill();
    c.strokeStyle = "rgba(240,199,94,.5)"; c.lineWidth = 1; c.stroke();
    c.fillStyle = COLORS.gold2; c.font = "13px -apple-system, PingFang SC, sans-serif";
    c.textAlign = "center";
    c.fillText("「就像对一张薄纸开了一发 15 英寸的炮弹，它却弹回来打中了你。」", CX, BH - 41);
    c.fillStyle = COLORS.faint; c.font = "10.5px ui-monospace, Menlo, monospace";
    c.fillText("—— 卢瑟福晚年回忆 1909（转述）· 回弹 #" + backFlashNum, CX, BH - 23);
    c.restore();
  }
}
const quoteToast = { age: 99 };

// =============================================================================
// THE SCREEN (panel) — the counting law + live flashes
// =============================================================================
const screenCv = document.getElementById("screen");
const SW = 324, SH = 238;
const sctx = fit(screenCv, SW, SH);

function drawScreen() {
  const c = sctx;
  c.clearRect(0, 0, SW, SH);
  const k = kOf(), E = state.eMeV;
  const x0 = 38, x1 = SW - 10, y0 = 16, y1 = SH - 26;
  const th2x = (th) => x0 + (th - 5) / 170 * (x1 - x0);
  const relMin = dsigmaDOmega(175 * DEG, k, E) / dsigmaDOmega(10 * DEG, k, E);
  const lgSpan = Math.log10(1 / relMin);
  const rel2y = (th) => y1 - (Math.log10(dsigmaDOmega(th * DEG, k, E) / dsigmaDOmega(10 * DEG, k, E)) / lgSpan) * (y1 - y0);

  c.fillStyle = "#080d13"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  c.strokeStyle = COLORS.line; c.lineWidth = 1; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
  // decades
  c.font = "9px ui-monospace, Menlo, monospace"; c.fillStyle = COLORS.faint;
  c.textAlign = "right";
  for (let dd = 0; dd <= lgSpan; dd += 2) {
    const y = y1 - (dd / lgSpan) * (y1 - y0);
    c.strokeStyle = "rgba(34,52,68,.8)";
    c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
    c.fillText("1e-" + dd, x0 - 4, y + 3);
  }
  // θ axis
  c.textAlign = "center";
  for (const th of [30, 60, 90, 120, 150]) {
    const x = th2x(th);
    c.strokeStyle = th === 90 ? "rgba(240,199,94,.4)" : "rgba(34,52,68,.8)";
    c.setLineDash(th === 90 ? [4, 4] : []);
    c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke();
    c.fillStyle = th === 90 ? COLORS.gold2 : COLORS.faint;
    c.fillText(th + "°", x, y1 + 12);
  }
  c.setLineDash([]);
  // the law
  c.beginPath();
  for (let th = 10; th <= 175; th += 1.5) {
    const x = th2x(th), y = rel2y(th);
    th === 10 ? c.moveTo(x, y) : c.lineTo(x, y);
  }
  c.lineWidth = 2; c.strokeStyle = COLORS.cyan; c.stroke();
  // flashes (clamped into the plot; θ<10° piles past the top of the log axis)
  for (const f of flashes) {
    const a = Math.max(0, 1 - f.age / 1.15);
    if (a <= 0 || f.ang < 10) continue;
    const fx = th2x(Math.min(175, Math.abs(f.ang)));
    const fy = Math.max(y0 + 3, rel2y(Math.min(175, Math.abs(f.ang))) - 4 * a);
    c.globalAlpha = a;
    c.fillStyle = f.big ? COLORS.gold2 : COLORS.phosphor;
    c.beginPath();
    c.arc(fx, fy, f.big ? 3.4 : 2.2, 0, 7);
    c.fill();
    c.globalAlpha = 1;
  }
  c.fillStyle = COLORS.faint; c.textAlign = "left"; c.font = "9.5px ui-monospace, Menlo, monospace";
  c.fillText("相对计数 log", x0, y0 - 4);
}

// =============================================================================
// CHARTS
// =============================================================================
function chartCtx(id, w = 560, h = 300) {
  const cv = document.getElementById(id);
  const ctx = fit(cv, w, h);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function frame(ctx, box, xticks, yticks, xlab, ylab) {
  const { x0, x1, y0, y1 } = box;
  ctx.fillStyle = "#080d13"; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.font = "10px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const [v, lab] of xticks) {
    const x = v;
    ctx.strokeStyle = "rgba(34,52,68,.9)";
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.fillStyle = COLORS.faint; ctx.fillText(lab, x, y1 + 13);
  }
  ctx.textAlign = "right";
  for (const [v, lab] of yticks) {
    const y = v;
    ctx.strokeStyle = "rgba(34,52,68,.9)";
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.fillStyle = COLORS.faint; ctx.fillText(lab, x0 - 6, y);
  }
  ctx.strokeStyle = COLORS.line2; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.fillStyle = COLORS.dim; ctx.font = "10.5px ui-monospace, Menlo, monospace";
  ctx.textAlign = "right"; ctx.fillText(xlab, x1, y1 + 26);
  ctx.textAlign = "left"; ctx.fillText(ylab, 8, y0 - 10);
}

function drawGeomB() {
  const { ctx, w, h } = chartCtx("geomB");
  const box = { x0: 52, x1: w - 18, y0: 20, y1: h - 34 };
  const tx = (th) => box.x0 + (th - 5) / 173 * (box.x1 - box.x0);
  const yMax = Math.tan(87.5 * DEG) / 1; // cot(2.5°)
  const ty = (ratio) => box.y1 - (ratio / yMax) * (box.y1 - box.y0);
  frame(ctx, box,
    [[tx(30), "30°"], [tx(60), "60°"], [tx(90), "90°"], [tx(120), "120°"], [tx(150), "150°"]],
    [[ty(1), "1"], [ty(5), "5"], [ty(10), "10"], [ty(20), "20"]],
    "散射角 θ", "b / b₉₀（通用曲线，与能量无关）");

  ctx.beginPath();
  for (let th = 5; th <= 178; th += 1) {
    const r = 1 / Math.tan(th / 2 * DEG);
    const x = tx(th), y = ty(Math.min(r, yMax));
    th === 5 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.lineWidth = 2.2; ctx.strokeStyle = COLORS.cyan; ctx.stroke();

  // markers at 30 / 90 / 150 with live fm values
  const k = kOf(), E = state.eMeV, b9 = b90();
  for (const [th, col] of [[30, COLORS.cyan2], [90, COLORS.gold2], [150, COLORS.ember]]) {
    const r = 1 / Math.tan(th / 2 * DEG);
    const x = tx(th), y = ty(r);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
    ctx.fillStyle = col; ctx.font = "10.5px ui-monospace, Menlo, monospace";
    ctx.textAlign = th < 100 ? "left" : "right";
    ctx.fillText(fmtFm(r * b9, 1) + " fm", x + (th < 100 ? 8 : -8), y - 8);
  }
  ctx.fillStyle = COLORS.faint; ctx.font = "10px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.fillText("b(θ) = b₉₀·cot(θ/2)   — 角度只认一半", box.x0 + 8, box.y0 + 12);
}

function drawGeomRmin() {
  const { ctx, w, h } = chartCtx("geomRmin");
  const box = { x0: 52, x1: w - 18, y0: 20, y1: h - 34 };
  const xMax = 3, yMax = 4.3;
  const tx = (x) => box.x0 + x / xMax * (box.x1 - box.x0);
  const ty = (v) => box.y1 - v / yMax * (box.y1 - box.y0);
  frame(ctx, box,
    [[tx(0), "0"], [tx(1), "b₉₀"], [tx(2), "2"], [tx(3), "3"]],
    [[ty(2), "2"], [ty(3), "3"], [ty(4), "4"]],
    "瞄准距离 b / b₉₀", "r_min / b₉₀ = 1+√(1+x²)");

  const rcRatio = rcOf() / b90();
  // contact zone shading
  if (rcRatio < yMax) {
    ctx.fillStyle = "rgba(224,104,92,.10)";
    ctx.fillRect(box.x0, ty(Math.min(rcRatio, yMax)), box.x1 - box.x0, box.y1 - ty(Math.min(rcRatio, yMax)));
    ctx.strokeStyle = COLORS.red; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(box.x0, ty(rcRatio)); ctx.lineTo(box.x1, ty(rcRatio)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.red; ctx.font = "10.5px ui-monospace, Menlo, monospace";
    ctx.textAlign = "right";
    ctx.fillText("R_c/b₉₀ = " + fmtFm(rcRatio, 2) + (rcRatio <= 2 ? "  ← 接触可能" : ""), box.x1 - 8, ty(rcRatio) - 7);
  }
  ctx.beginPath();
  for (let x = 0; x <= xMax; x += 0.02) {
    const v = 1 + Math.sqrt(1 + x * x);
    const px = tx(x), py = ty(v);
    x === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.lineWidth = 2.2; ctx.strokeStyle = COLORS.cyan; ctx.stroke();
  // markers: b=0 (head-on, = 2b₉₀ = d) and b=b₉₀
  for (const [x, lab] of [[0, "b=0: r_min = d = 2b₉₀"], [1, "b=b₉₀: 90° 却离核 √2 倍远"]]) {
    const v = 1 + Math.sqrt(1 + x * x);
    ctx.fillStyle = COLORS.gold2;
    ctx.beginPath(); ctx.arc(tx(x), ty(v), 4, 0, 7); ctx.fill();
    ctx.font = "10.5px ui-monospace, Menlo, monospace";
    ctx.textAlign = x === 0 ? "left" : "right";
    ctx.fillText(lab, tx(x) + (x === 0 ? 8 : -8), ty(v) - 8);
  }
}

function drawLawXsec() {
  const { ctx, w, h } = chartCtx("lawXsec");
  const box = { x0: 52, x1: w - 18, y0: 20, y1: h - 34 };
  const k = kOf(), E = state.eMeV;
  const rel = (th) => dsigmaDOmega(th * DEG, k, E) / dsigmaDOmega(30 * DEG, k, E);
  const yTop = Math.log10(rel(7)), yBot = Math.log10(rel(175));
  const tx = (th) => box.x0 + (th - 5) / 172 * (box.x1 - box.x0);
  const ty = (lv) => box.y1 - (lv - yBot) / (yTop - yBot) * (box.y1 - box.y0);

  // shaded θ>90 integral region
  ctx.fillStyle = "rgba(158,224,160,.10)";
  ctx.fillRect(tx(90), box.y0, box.x1 - tx(90), box.y1 - box.y0);
  frame(ctx, box,
    [[tx(30), "30°"], [tx(60), "60°"], [tx(90), "90°"], [tx(120), "120°"], [tx(150), "150°"]],
    [[ty(0), "1"], [ty(-2), "1/100"], [ty(-4), "1/10⁴"]],
    "散射角 θ", "dσ/dΩ（以 30° 处为 1，对数）");

  ctx.beginPath();
  for (let th = 7; th <= 175; th += 1) {
    const x = tx(th), y = ty(Math.log10(rel(th)));
    th === 7 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.lineWidth = 2.2; ctx.strokeStyle = COLORS.cyan; ctx.stroke();

  for (const th of [30, 90, 150]) {
    const y = ty(Math.log10(rel(th)));
    ctx.fillStyle = th === 150 ? COLORS.ember : th === 90 ? COLORS.gold2 : COLORS.cyan2;
    ctx.beginPath(); ctx.arc(tx(th), y, 4, 0, 7); ctx.fill();
    ctx.font = "10.5px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    const lab = th === 150 ? "×" + rel(th).toExponential(1) : "×" + rel(th).toFixed(3);
    ctx.fillText(lab, tx(th), y - 10);
  }
  ctx.fillStyle = COLORS.phosphor; ctx.font = "10.5px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText("θ>90° 整块积分 = π·b₉₀²（闭式）", (tx(90) + tx(150)) / 2, box.y0 + 14);
}

function drawLawOnein() {
  const { ctx, w, h } = chartCtx("lawOnein");
  const box = { x0: 56, x1: w - 18, y0: 20, y1: h - 34 };
  const p = pAbove90();
  const oneInAt = (tUm_) => 1 / probAbove(90 * DEG, kOf(), state.eMeV, el(), tUm_ * 1e-6);
  const t8000 = foilForOneIn(8000, 90 * DEG, kOf(), state.eMeV, el()) * 1e6;
  const lg = (v) => Math.log10(v);
  const lMin = lg(oneInAt(10)), lMax = lg(oneInAt(0.1));
  const tx = (t) => box.x0 + (t - 0.1) / 9.9 * (box.x1 - box.x0);
  const ty = (N) => box.y1 - (lg(N) - lMin) / (lMax - lMin) * (box.y1 - box.y0);

  frame(ctx, box,
    [[tx(0.5), "0.5"], [tx(1), "1"], [tx(2), "2"], [tx(3.08), "3.08"], [tx(5), "5"], [tx(10), "10 µm"]],
    [[ty(10), "10"], [ty(1e2), "10²"], [ty(1e3), "10³"], [ty(1e4), "10⁴"], [ty(1e6), "10⁶"]],
    "箔厚 t (µm)", "1 in N（θ>90°，对数）");

  // 8000 line (label on the right so it never fights the current-t marker)
  ctx.strokeStyle = COLORS.gold2; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(box.x0, ty(8000)); ctx.lineTo(box.x1, ty(8000)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.gold2; ctx.font = "10.5px ui-monospace, Menlo, monospace";
  ctx.textAlign = "right";
  ctx.fillText("1 in 8000 → t = " + fmtFm(t8000, 2) + " µm", box.x1 - 8, ty(8000) - 8);

  // the exact 1/t line
  ctx.beginPath();
  for (let t = 0.1; t <= 10; t += 0.05) {
    const x = tx(t), y = ty(oneInAt(t));
    t === 0.1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.lineWidth = 2.2; ctx.strokeStyle = COLORS.cyan; ctx.stroke();

  // intersection marker
  ctx.fillStyle = COLORS.gold2;
  ctx.beginPath(); ctx.arc(tx(t8000), ty(8000), 4.5, 0, 7); ctx.fill();
  // current t
  ctx.strokeStyle = "rgba(240,199,94,.5)";
  ctx.beginPath(); ctx.moveTo(tx(state.tUm), box.y0); ctx.lineTo(tx(state.tUm), box.y1); ctx.stroke();
  ctx.fillStyle = COLORS.dim; ctx.font = "10px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  ctx.fillText("现在 " + state.tUm.toFixed(2) + " µm", tx(state.tUm), box.y0 + 10);
}

function drawSizeD() {
  const { ctx, w, h } = chartCtx("sizeD");
  const box = { x0: 52, x1: w - 18, y0: 20, y1: h - 34 };
  const eMax = 40, dMax = 80;
  const tx = (E) => box.x0 + (E - 3) / (eMax - 3) * (box.x1 - box.x0);
  const ty = (v) => box.y1 - v / dMax * (box.y1 - box.y0);
  frame(ctx, box,
    [[tx(5), "5"], [tx(10), "10"], [tx(20), "20"], [tx(30), "30"], [tx(40), "40 MeV"]],
    [[ty(10), "10"], [ty(20), "20"], [ty(40), "40"], [ty(60), "60 fm"]],
    "α 能量 E", "最近距离 d = k/E 与接触半径");

  for (const key of ["Al", "Cu", "Ag", "Au"]) {
    const e2 = ELEMENTS[key], k2 = kZZ(e2.z), rc2 = contactRadius(e2.a);
    const col = key === state.el ? COLORS.cyan : "rgba(95,198,216,.34)";
    ctx.lineWidth = key === state.el ? 2.4 : 1.4;
    ctx.strokeStyle = col;
    ctx.beginPath();
    for (let E = 3; E <= eMax; E += 0.25) {
      const x = tx(E), y = ty(k2 / E);
      E === 3 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (k2 / 3 <= dMax) {
      ctx.fillStyle = col; ctx.font = "10.5px ui-monospace, Menlo, monospace";
      ctx.textAlign = "left";
      ctx.fillText(key + " d", tx(3) + 4, ty(k2 / 3) - 6);
    }
    // contact line + E_crit
    if (rc2 <= dMax) {
      ctx.strokeStyle = key === state.el ? COLORS.red : "rgba(224,104,92,.35)";
      ctx.setLineDash([5, 4]); ctx.lineWidth = key === state.el ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(box.x0, ty(rc2)); ctx.lineTo(box.x1, ty(rc2)); ctx.stroke();
      ctx.setLineDash([]);
      const eC = eCritContact(k2, e2);
      if (eC <= eMax) {
        ctx.fillStyle = key === state.el ? COLORS.gold2 : "rgba(240,199,94,.5)";
        const sx = tx(eC), sy = ty(rc2);
        ctx.beginPath();
        ctx.moveTo(sx - 5, sy - 5); ctx.lineTo(sx + 5, sy + 5);
        ctx.moveTo(sx + 5, sy - 5); ctx.lineTo(sx - 5, sy + 5);
        ctx.lineWidth = key === state.el ? 2.4 : 1.4;
        ctx.strokeStyle = key === state.el ? COLORS.gold2 : "rgba(240,199,94,.5)";
        ctx.stroke();
        if (key === state.el) {
          ctx.font = "10.5px ui-monospace, Menlo, monospace"; ctx.textAlign = "left";
          ctx.fillText("E_crit = " + fmtFm(eC, 1) + " MeV", sx + 8, sy - 8);
        }
      }
    }
  }
  // current energy
  ctx.strokeStyle = "rgba(140,224,236,.55)";
  ctx.beginPath(); ctx.moveTo(tx(state.eMeV), box.y0); ctx.lineTo(tx(state.eMeV), box.y1); ctx.stroke();
  ctx.fillStyle = COLORS.cyan2; ctx.font = "10px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  ctx.fillText("E = " + state.eMeV.toFixed(1), tx(state.eMeV), box.y0 + 10);
}

function drawSizeTc() {
  const { ctx, w, h } = chartCtx("sizeTc");
  const box = { x0: 52, x1: w - 18, y0: 20, y1: h - 34 };
  const k = kOf(), e2 = el();
  const eC = eCritContact(k, e2);
  const tx = (E) => box.x0 + (E - 3) / 37 * (box.x1 - box.x0);
  const ty = (th) => box.y1 - th / 180 * (box.y1 - box.y0);
  frame(ctx, box,
    [[tx(5), "5"], [tx(10), "10"], [tx(20), "20"], [tx(30), "30"], [tx(40), "40 MeV"]],
    [[ty(30), "30°"], [ty(60), "60°"], [ty(90), "90°"], [ty(120), "120°"], [ty(150), "150°"]],
    "α 能量 E", "θ_c：碰核起始角");

  ctx.fillStyle = "rgba(224,104,92,.08)";
  ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);

  if (state.eMeV > eC && eC <= 40) {
    ctx.beginPath();
    let first = true;
    for (let E = Math.max(eC + 1e-6, 3.2); E <= 40; E += 0.2) {
      const th = thetaContact(E, k, e2);
      if (th === null) continue;
      const x = tx(E), y = ty(th / DEG);
      first ? (ctx.moveTo(x, y), first = false) : ctx.lineTo(x, y);
    }
    ctx.lineWidth = 2.2; ctx.strokeStyle = COLORS.red; ctx.stroke();
    ctx.strokeStyle = "rgba(224,104,92,.5)"; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(tx(eC), box.y0); ctx.lineTo(tx(eC), box.y1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.gold2; ctx.font = "10.5px ui-monospace, Menlo, monospace";
    ctx.textAlign = "left";
    ctx.fillText("E_crit = " + fmtFm(eC, 1) + " MeV，超过它 θ_c 才存在", tx(eC) + 6, box.y0 + 12);
    const thNow = thetaContact(state.eMeV, k, e2);
    if (thNow !== null) {
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(tx(state.eMeV), ty(thNow / DEG), 4, 0, 7); ctx.fill();
      ctx.textAlign = "center";
      ctx.fillText("现在 θ_c = " + fmtFm(thNow / DEG, 1) + "°", tx(state.eMeV), ty(thNow / DEG) - 12);
    }
  } else {
    ctx.fillStyle = COLORS.dim; ctx.font = "12px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText("E = " + state.eMeV.toFixed(1) + " MeV < E_crit = " + fmtFm(eC, 1) + " MeV", (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2 - 10);
    ctx.fillText("碰不到核 —— 纯库仑，卢瑟福公式精确", (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2 + 12);
  }
}

// =============================================================================
// TIMELINE (hist tab)
// =============================================================================
const TIMELINE = [
  ["1871", "8月30日，生于新西兰纳尔逊附近的泉溪村（Brightwater），苏格兰移民农场之子，家里十一个孩子", false],
  ["1895", "24岁，拿“1851 大展览奖学金”入剑桥卡文迪许实验室，成为 J.J.汤姆孙的学生", false],
  ["1898", "蒙特利尔麦吉尔大学：放射性定量化学；与索迪提出<b>嬗变理论</b>（1900–03）", false],
  ["1908", "<b>诺贝尔化学奖</b>（元素蜕变与放射性化学）——他自己嘀咕这该是物理奖", true],
  ["1909", "盖革–马斯登实验：α 被金箔“漫反射”，<b>约 1/8000 直接弹回</b>", true],
  ["1911", "《α 与 β 粒子被物质散射与原子结构》：<b>原子核</b>登场", true],
  ["1914", "封爵士；一战期间转入声呐水下探测", false],
  ["1919", "接任剑桥卡文迪许教授；发表《氮的一种人工核蜕变》：<b>¹⁴N+α→¹⁷O+p</b>", true],
  ["1925", "布拉凯特云室：23,000 条 α 径迹中 8 条分叉——1919 的反应上了照片", false],
  ["1932", "卡文迪许的奇迹年：考克饶夫–沃尔顿加速器、查德威克发现中子——都是他播的种子", false],
  ["1937", "10月19日逝世，葬于威斯敏斯特教堂，牛顿近旁", false],
  ["1997", "IUPAC 将 104 号元素定名 <b>rutherfordium（𬬻）</b>；新西兰 100 元纸币上是他的头像", false],
];
const tl = document.getElementById("timeline");
tl.innerHTML = TIMELINE.map(([when, what, big]) =>
  `<div class="tl-item${big ? " big" : ""}"><span class="when">${when}</span><span class="what">${what}</span></div>`
).join("");

// =============================================================================
// READOUTS + REFRESH
// =============================================================================
const $ = (id) => document.getElementById(id);
const refreshers = [];

function updateReadouts() {
  const k = kOf(), E = state.eMeV, b9 = b90(), d = dOf(), rc = rcOf();
  const p = pAbove90();
  $("ro-onein").firstChild.textContent = fmtOneIn(1 / Math.max(p, 1e-12));
  $("ro-b90").textContent = fmtFm(b9, 2) + " fm";
  $("ro-d").textContent = fmtFm(d, 1) + " / " + fmtFm(nuclearRadius(el().a), 1) + " = " + fmtFm(d / nuclearRadius(el().a), 1) + "×";
  const ec = eCritContact(k, el());
  $("ro-ecrit").textContent = E >= ec
    ? "✕ 已越过（" + fmtFm(ec, 1) + "）"
    : fmtFm(ec, 1) + " MeV";

  $("y-k").textContent = fmtFm(k, 1) + " MeV·fm";
  $("y-r").textContent = fmtFm(nuclearRadius(el().a), 1) + " · " + fmtFm(rc, 1) + " fm";
  $("y-n").textContent = numberDensity(el()).toExponential(2) + " /m³";
  const rat = dsigmaDOmega(150 * DEG, k, E) / dsigmaDOmega(30 * DEG, k, E);
  $("y-ratio").textContent = "1 : " + Math.round(1 / rat).toLocaleString("en-US");
  $("y-v").textContent = (alphaBeta(E) * 100).toFixed(1) + " %c";

  $("g-bs").textContent = fmtFm(b9, 2) + " · " + fmtFm(bFromTheta(30 * DEG, k, E), 1) + " · " + fmtFm(bFromTheta(150 * DEG, k, E), 2) + " fm";
  $("g-d").textContent = fmtFm(d, 1) + " fm";
  $("g-rm").textContent = fmtFm(rMin(b9, k, E), 1) + " fm";

  $("l-ratio").textContent = "1 : " + Math.round(1 / rat).toLocaleString("en-US");
  $("l-sigma").textContent = fmtFm(sigmaAbove(90 * DEG, k, E), 0) + " fm²";
  $("l-onein").textContent = fmtOneIn(1 / p);
  $("l-t8000").textContent = fmtFm(foilForOneIn(8000, 90 * DEG, k, E, el()) * 1e6, 2) + " µm";

  $("s-frac").textContent = fmtFm(d / rc, 2) + (d >= rc ? " —— 已经碰到" : "（还差 " + fmtFm(rc / d, 2) + "× 能量）");
  $("s-ecrit").textContent = fmtFm(ec, 1) + " MeV";
  const tc = thetaContact(E, k, el());
  $("s-tc").textContent = tc === null ? "不存在（纯库仑区）" : fmtFm(tc / DEG, 1) + "°";

  $("h-q").textContent = qValue1919().toFixed(3) + " MeV（吸能）";
  $("h-th").textContent = threshold1919().toFixed(2) + " MeV";
  $("h-alpha").textContent = "7.69 MeV（射程 " + fmtFm(7.69 ** 1.5 * 0.318, 1) + " cm）";
}

function drawCharts() {
  drawGeomB(); drawGeomRmin(); drawLawXsec(); drawLawOnein(); drawSizeD(); drawSizeTc();
}

function refresh() {
  updateReadouts();
  drawCharts();
  drawScreen();
}
refreshers.push(refresh);

// =============================================================================
// CONTROLS
// =============================================================================
const sliderSync = [];
function bindSlider(id, outId, get, set, fmt) {
  const range = $(id), out = $(outId);
  const update = () => { range.value = get(); out.textContent = fmt(get()); };
  range.addEventListener("input", () => { set(parseFloat(range.value)); out.textContent = fmt(get()); onParamChange(); });
  update();
  sliderSync.push(update);
  return update;
}

function onParamChange() {
  traceCache = new Map();
  particles.length = 0;
  refresh();
}

const alphasPerSec = () => Math.pow(10, state.rateS / 25);

bindSlider("e-range", "e-out",
  () => state.eMeV, (v) => { state.eMeV = v; },
  (v) => v.toFixed(1) + " MeV");
bindSlider("t-range", "t-out",
  () => state.tUm, (v) => { state.tUm = v; },
  (v) => v.toFixed(2) + " µm");
bindSlider("rate-range", "rate-out",
  () => state.rateS, (v) => { state.rateS = v; },
  (v) => Math.round(alphasPerSec()).toLocaleString("en-US") + " α/s");

// target buttons
const targetRow = $("target-row");
for (const key of Object.keys(ELEMENTS)) {
  const b = document.createElement("button");
  b.textContent = ELEMENTS[key].cn + " " + key + " (Z=" + ELEMENTS[key].z + ")";
  b.dataset.el = key;
  b.addEventListener("click", () => { state.el = key; syncTargets(); onParamChange(); });
  targetRow.appendChild(b);
}
function syncTargets() {
  targetRow.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.el === state.el));
}
syncTargets();

$("fire-btn").addEventListener("click", () => { spawnBurst(); });
const autoBtn = $("auto-btn");
function syncAuto() {
  autoBtn.classList.toggle("armed", state.auto);
  $("beam-chip").classList.toggle("on", state.auto);
  $("beam-chip").textContent = state.auto ? "● 束流注入中" : "○ 束流停止";
}
autoBtn.addEventListener("click", () => { state.auto = !state.auto; syncAuto(); });
syncAuto();

// presets
const presetsBox = $("presets");
for (const p of PRESETS) {
  const b = document.createElement("button");
  b.textContent = p.label;
  b.title = p.note;
  b.dataset.preset = p.id;
  b.addEventListener("click", () => applyPreset(p.id));
  presetsBox.appendChild(b);
}
function applyPreset(id) {
  const p = PRESETS.find((q) => q.id === id);
  if (!p) return;
  state.el = p.el; state.eMeV = p.eMeV; state.tUm = p.tUm; state.rateS = p.rate ?? 65;
  state.fired = 0; state.backCount = 0; state.quoteShown = false; backFlashNum = 0;
  particles.length = 0; flashes.length = 0;
  rng = mulberry32(20260830);
  presetsBox.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.preset === id));
  syncTargets(); onParamChange();
  sliderSync.forEach((u) => u());
}

// tabs
function setTab(name) {
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
  document.querySelectorAll(".tab-body").forEach((b) => b.classList.toggle("hidden", b.id !== "tab-" + name));
  const notes = {
    geom: "角度只认瞄准距离的一半：cot(θ/2)",
    law: "sin⁻⁴：越靠边越稀有，闭式积分 π·b(θ₀)²",
    size: "d = k/E 一路缩，碰到 R_c 就出戏",
    hist: "1919：人类第一次把原子核打开",
  };
  $("tab-note").textContent = notes[name] ?? "";
}
document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

// =============================================================================
// SIMULATION STEP
// =============================================================================
function step(dt) {
  state.t += dt;
  state.beamAlpha = Math.max(0, state.beamAlpha - dt * 0.4);

  if (state.auto) {
    state.emitTimer += dt;
    if (state.emitTimer > 0.55) { state.emitTimer = 0; spawnBurst(); }
    state.fired += alphasPerSec() * dt;
  }

  // odometer: big flashes are EARNED by the closed form crossing an integer
  const expected = state.fired * pAbove90();
  while (state.backCount < expected) {
    state.backCount += 1;
    backFlashNum += 1;
    const ang = sampleBackAngle() * (rng() < 0.5 ? 1 : -1);
    flashes.push({ ang, age: 0, big: true });
    if (!state.quoteShown) { state.quoteShown = true; quoteToast.age = 0; }
  }

  for (const p of particles) {
    p.idx += p.speed * dt;
    if (!p.done && p.idx >= p.rec.pts.length - 1) {
      p.done = true;
      // small rim flash at this track's own angle
      flashes.push({ ang: (p.rec.theta / DEG) * p.sign, age: 0, big: p.rec.thetaAbs > 120 * DEG });
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    if (particles[i].done && particles[i].fade <= 0) particles.splice(i, 1);
  }
  for (const f of flashes) f.age += dt;
  while (flashes.length > 140) flashes.shift();

  quoteToast.age += dt;
}

let last = performance.now();
function loop(now) {
  if (!state.videoMode) step(Math.min(0.05, (now - last) / 1000));
  last = now;
  drawBench();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.addEventListener("resize", () => refresh());

// =============================================================================
// __demo API (for the video renderer and the curious)
// =============================================================================
window.__demo = {
  loadPreset: (id) => applyPreset(id),
  setTab: (name) => setTab(name),
  setParam: (name, value) => {
    if (name === "el") { state.el = value; syncTargets(); }
    if (name === "eMeV") state.eMeV = value;
    if (name === "tUm") state.tUm = value;
    if (name === "rateS") state.rateS = value;
    onParamChange();
  },
  setAuto: (on) => { state.auto = !!on; syncAuto(); },
  fireBurst: () => spawnBurst(),
  setVideoMode: (on) => { state.videoMode = !!on; },
  scrollToBench: () => $("bench").scrollIntoView({ block: "center" }),
  scrollToTabs: () => document.querySelector(".tabs-card").scrollIntoView({ block: "start" }),
  step: (dt) => step(dt),
};

// boot
applyPreset("manchester1909");
setTab("geom");
