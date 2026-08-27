// app.js — WEAF 660: the 28 Aug 1922 first-commercial studio, driven by the
// exact forms in physics.js. Every animation is a pure function of state.t
// (deterministic hash + fixed formulas), so window.__demo.step(dt)
// reproduces any frame for the video.

import * as P from "./physics.js";

// ---------- deterministic hash (no Math.random anywhere) ----------
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------- state ----------
const state = {
  preset: "air",
  tab: "rx",
  videoMode: false,
  onAir: true,
  t: 0,
  tx: { ...P.TX_DEFAULTS },
  rx: { ...P.RX_DEFAULTS },
  prop: { ...P.PROP_DEFAULTS },
};

// ---------- canvas plumbing ----------
const dpr = Math.min(window.devicePixelRatio || 1, 2);
function setup(canvas, w, h) {
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.aspectRatio = `${w} / ${h}`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
const scopeCtx = setup(document.getElementById("scope"), 960, 440);
const specCtx = setup(document.getElementById("spectrum"), 340, 300);
const rxCtx = setup(document.getElementById("rx"), 560, 480);
const respCtx = setup(document.getElementById("resp"), 600, 240);
const detCtx = setup(document.getElementById("det"), 600, 200);
const propCtx = setup(document.getElementById("prop"), 960, 400);
const fadeCtx = setup(document.getElementById("fade"), 960, 180);

const fmt = (n, d = 1) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const $ = (id) => document.getElementById(id);
const CSS = getComputedStyle(document.documentElement);
const COL = {
  gold: CSS.getPropertyValue("--gold").trim(),
  gold2: CSS.getPropertyValue("--gold2").trim(),
  blue: CSS.getPropertyValue("--blue").trim(),
  ember: CSS.getPropertyValue("--ember").trim(),
  red: CSS.getPropertyValue("--red").trim(),
  dim: CSS.getPropertyValue("--dim").trim(),
  faint: CSS.getPropertyValue("--faint").trim(),
  ink: CSS.getPropertyValue("--ink").trim(),
  line: CSS.getPropertyValue("--line").trim(),
  green: CSS.getPropertyValue("--green").trim(),
};

// ---------- derived quantities ----------
const tunedF0 = () => P.resFreq(state.rx.LuH * 1e-6, state.rx.capPf * 1e-12);
const tunedQ = () => P.qSeries(tunedF0(), state.rx.LuH * 1e-6, state.rx.coilR);
const stationResp = (khz) =>
  P.stagesResponse(Math.abs(khz * 1e3 - tunedF0()), tunedF0(), tunedQ(), state.rx.stages);

// detector simulation, cached by parameter key
let detCache = { key: "", sim: null };
function detectorSim() {
  const { m, fm } = state.tx;
  const RC = state.rx.loadRCuS * 1e-6;
  const key = `${m}|${fm}|${RC}`;
  if (detCache.key !== key) {
    detCache = {
      key,
      sim: P.simulateDetector({ A: 1, m, fm, fc: P.WEAF_KHZ * 1e3, RC, periods: 4 }),
    };
  }
  return detCache.sim;
}

// station programme levels (for the meters) — deterministic in t
function progLevel(prog, t) {
  if (prog === "speech") {
    const s = Math.floor(t * 3.2), frac = t * 3.2 - s;
    const gate = hash(s) > 0.15 ? 0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, frac * 1.6)) : 0.06;
    return 0.12 + 0.85 * gate;
  }
  if (prog === "music") {
    const s = Math.floor(t * 2);
    return 0.4 + 0.45 * hash(s);
  }
  const s = Math.floor(t * 7);
  return hash(s) > 0.5 ? 0.9 : 0.06;
}

// propagation helpers
const groundFieldUV = () => 1000 / state.prop.distKm; // 1 mV/m at 1 km, 1/x
const skyPathKm = () => P.skywavePath(state.prop.distKm, state.prop.hEkM);
const diffKm = () => P.pathDiff(state.prop.distKm, state.prop.hEkM);
const geoPhase = () => P.phaseFromPath(diffKm() * 1e3, state.tx.fcKhz * 1e3);
const driftPhase = (t) =>
  geoPhase() + P.TAU * 0.09 * t + 0.35 * Math.sin(P.TAU * 0.031 * t);
const nightRho = () => (state.prop.night ? state.prop.skyAmp : 0);

// ============================================================ 1 · the scope
function drawScope() {
  const W = 960, H = 440, ctx = scopeCtx;
  ctx.clearRect(0, 0, W, H);
  const { A, m, fm } = state.tx;
  const T = 3 / fm;                       // show three audio cycles
  const fcv = fm * 27;                    // carrier drawn at 1:27 of true scale
  const midY = H / 2 - 24;
  const k = (H / 2 - 78) / 1.75;          // volts → pixels
  const tau = state.t;

  // grid: centre line + one tick per audio period
  ctx.strokeStyle = "#2c2417"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke();
  ctx.fillStyle = COL.faint; ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  for (let i = 0; i <= 3; i++) {
    const x = (i / 3) * W;
    ctx.beginPath(); ctx.moveTo(x, midY - 6); ctx.lineTo(x, midY + 6); ctx.stroke();
  }
  ctx.fillText(`时间窗 ${(T * 1000).toFixed(1)} ms（三个音频周期）`, W / 2, H - 8);

  // overmodulation bands: where (1 + m·cos) < 0
  if (m > 1) {
    ctx.fillStyle = "rgba(217,106,90,.10)";
    for (let x = 0; x < W; x++) {
      const t = tau + (x / W) * T;
      if (1 + m * Math.cos(P.TAU * fm * t) < 0) ctx.fillRect(x, 40, 1, H - 96);
    }
    ctx.fillStyle = COL.red; ctx.textAlign = "left";
    ctx.fillText("▨ 包络为负：相位翻转 · 检波器会偷出失真", 14, 26);
  }

  // the RF trace (carrier compressed 1:27)
  ctx.strokeStyle = COL.gold2; ctx.lineWidth = 1.4;
  ctx.shadowColor = "rgba(240,199,94,.5)"; ctx.shadowBlur = 6;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 1) {
    const t = tau + (x / W) * T;
    const e = state.onAir ? P.envelope(t, A, m, fm) : 0;
    const v = e * Math.cos(P.TAU * fcv * t);
    const y = midY - v * k;
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (state.onAir) {
    // envelope ±A(1+m·cos) — the real formula, no compression
    ctx.strokeStyle = COL.blue; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
    for (const sign of [1, -1]) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const t = tau + (x / W) * T;
        const y = midY - sign * P.envelope(t, A, m, fm) * k;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // when overmodulated, the |envelope| ghost shows what the detector sees
    if (m > 1) {
      ctx.strokeStyle = "rgba(217,106,90,.8)"; ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const t = tau + (x / W) * T;
        const y = midY - Math.abs(P.envelope(t, A, m, fm)) * k;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else {
    ctx.fillStyle = COL.faint; ctx.textAlign = "center";
    ctx.fillText("停播 —— 载波关闭", W / 2, midY - 40);
  }

  // annotations
  ctx.fillStyle = COL.dim; ctx.textAlign = "right";
  ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.fillText(`f_c = ${state.tx.fcKhz} kHz（真实值，图中按 1:27 压缩）`, W - 14, 26);
  ctx.textAlign = "left";
  ctx.fillText(`包络 ±A(1+m·cos ω_m t)`, 14, H - 30);
}

// ============================================================ 2 · the spectrum
function drawSpectrum() {
  const W = 340, H = 300, ctx = specCtx;
  ctx.clearRect(0, 0, W, H);
  const { A, m, fm } = state.tx;
  const fc = state.tx.fcKhz * 1e3;
  const span = Math.max(2500, fm * 1.9);
  const x0 = 46, x1 = W - 14, yBase = H - 34, yTop = 26;
  const dbToY = (db) => yBase - ((db + 40) / 40) * (yBase - yTop);
  const fToX = (f) => x0 + ((f - (fc - span)) / (2 * span)) * (x1 - x0);

  // axes
  ctx.strokeStyle = "#2c2417"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, yBase); ctx.lineTo(x1, yBase); ctx.stroke();
  ctx.fillStyle = COL.faint; ctx.font = "10px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  for (const db of [0, -10, -20, -30, -40]) {
    const y = dbToY(db);
    ctx.beginPath(); ctx.moveTo(x0 - 4, y); ctx.lineTo(x0, y); ctx.stroke();
    ctx.fillText(`${db}`, x0 - 20, y + 3);
  }
  ctx.fillText(`−${(span / 1000).toFixed(1)}k`, x0, H - 16);
  ctx.fillText("f_c", fToX(fc), H - 16);
  ctx.fillText(`+${(span / 1000).toFixed(1)}k`, x1, H - 16);

  // overmodulation splatter skirt (distortion sidebands, hatched)
  if (m > 1) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, yTop, x1 - x0, yBase - yTop);
    ctx.clip();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(fToX(fc + side * fm), dbToY(0));
      for (let mult = fm; mult <= span; mult += 60) {
        const db = -8 - 26 * ((mult - fm) / (span - fm));
        ctx.lineTo(fToX(fc + side * mult), dbToY(db));
      }
      ctx.lineTo(fToX(fc + side * span), yBase);
      ctx.lineTo(fToX(fc + side * fm), yBase);
      ctx.closePath();
      ctx.fillStyle = "rgba(217,106,90,.16)";
      ctx.fill();
      ctx.strokeStyle = "rgba(217,106,90,.5)"; ctx.setLineDash([4, 3]); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  const stem = (f, db, color, label) => {
    const x = fToX(f), y = dbToY(db);
    ctx.strokeStyle = color; ctx.lineWidth = 2.4;
    ctx.shadowColor = color; ctx.shadowBlur = 7;
    ctx.beginPath(); ctx.moveTo(x, yBase); ctx.lineTo(x, y); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 3.4, 0, P.TAU); ctx.fill();
    if (label) { ctx.textAlign = x < (x0 + x1) / 2 ? "left" : "right"; ctx.fillText(label, x + (x < (x0 + x1) / 2 ? 5 : -5), y - 6); }
  };

  const sbDb = P.toDb(Math.min(1, m / 2));
  stem(fc, 0, COL.gold2, "载波 A");
  stem(fc - fm, sbDb, COL.blue, "A·m/2");
  stem(fc + fm, sbDb, COL.blue, "A·m/2");
  if (m > 1) {
    ctx.fillStyle = COL.red; ctx.textAlign = "center"; ctx.font = "10.5px ui-monospace, Menlo, monospace";
    ctx.fillText("越调制：失真边带溅出", (x0 + x1) / 2, yTop + 10);
  }
}

// ============================================================ 3 · the receiver
function drawRx() {
  const W = 560, H = 480, ctx = rxCtx;
  ctx.clearRect(0, 0, W, H);
  const f0 = tunedF0();

  // incoming station waves at the antenna
  for (const s of P.STATIONS) {
    const resp = stationResp(s.khz);
    const amp = 6 + 16 * resp * progLevel(s.prog, state.t);
    ctx.strokeStyle = s.color; ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.25 + 0.7 * resp;
    ctx.beginPath();
    for (let x = 0; x <= 120; x += 2) {
      const ph = (x / 120) * 5 * P.TAU - state.t * (2.2 + s.khz / 400);
      const y = 56 - Math.sin(ph) * amp * Math.exp(-x / 90);
      x === 0 ? ctx.moveTo(14 + x, y) : ctx.lineTo(14 + x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = COL.faint; ctx.font = "10.5px ui-monospace, Menlo, monospace"; ctx.textAlign = "left";
  ctx.fillText("空中共有三台", 16, 22);

  // antenna
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(58, 70); ctx.lineTo(58, 200); ctx.stroke();          // mast
  ctx.beginPath(); ctx.moveTo(24, 84); ctx.lineTo(96, 84); ctx.stroke();           // T-top
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(136, 56); ctx.lineTo(136, 200); ctx.stroke();        // lead-in from T
  ctx.beginPath(); ctx.moveTo(96, 84); ctx.lineTo(136, 56); ctx.stroke();
  ctx.fillStyle = COL.faint; ctx.fillText("天线", 60, 214);

  // tank: parallel LC
  const topY = 200, botY = 330, nodeX = 136;
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(nodeX, topY); ctx.lineTo(210, topY); ctx.stroke();   // top bus
  // coil (left branch): six semicircle bumps
  const coilX = 170;
  ctx.strokeStyle = COL.gold2; ctx.lineWidth = 2;
  ctx.beginPath();
  let cy = topY;
  const step = (botY - topY) / 6;
  ctx.moveTo(coilX, cy);
  for (let i = 0; i < 6; i++) {
    ctx.arc(coilX, cy + step / 2, step / 2, -Math.PI / 2, Math.PI / 2);
    cy += step;
  }
  ctx.stroke();
  ctx.fillStyle = COL.faint; ctx.textAlign = "center";
  ctx.fillText(`L = ${state.rx.LuH} µH`, coilX - 52, (topY + botY) / 2);

  // variable capacitor (right branch), rotor angle ∝ C
  const capX = 216, capTop = 250, capBot = 288;
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(capX, topY); ctx.lineTo(capX, capTop); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(nodeX, botY); ctx.lineTo(250, botY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(nodeX, topY); ctx.lineTo(nodeX, topY); ctx.stroke();
  // stator + rotor plates
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(capX - 24, capTop); ctx.lineTo(capX + 24, capTop); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(capX - 24, capBot); ctx.lineTo(capX + 24, capBot); ctx.stroke();
  const rot = (state.rx.capPf - 15) / 350;   // 0..1
  ctx.strokeStyle = COL.gold; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(capX, capBot);
  ctx.lineTo(capX + 20 * Math.cos(-0.4 - rot * 2.4), capBot + 14 * Math.sin(-0.4 - rot * 2.4) * -1);
  ctx.stroke();
  ctx.fillStyle = COL.faint; ctx.textAlign = "center";
  ctx.fillText(`C = ${state.rx.capPf.toFixed(1)} pF`, capX + 66, (capTop + capBot) / 2);
  // ground
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.4;
  const gX = 226;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(gX - (14 - i * 4), botY + 12 + i * 6);
    ctx.lineTo(gX + (14 - i * 4), botY + 12 + i * 6);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(gX, botY); ctx.lineTo(gX, botY + 12); ctx.stroke();

  // detector: galena + cat's whisker
  const detX = 300, detY = 214;
  ctx.beginPath(); ctx.moveTo(250, topY); ctx.lineTo(detX - 34, topY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(detX - 34, topY); ctx.lineTo(detX - 34, detY); ctx.stroke();
  // galena chunk
  ctx.fillStyle = "#241d12"; ctx.strokeStyle = COL.line2; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(detX - 30, detY + 34); ctx.lineTo(detX - 22, detY + 6);
  ctx.lineTo(detX + 2, detY); ctx.lineTo(detX + 14, detY + 16);
  ctx.lineTo(detX + 4, detY + 36); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(212,164,55,.35)";
  ctx.beginPath(); ctx.moveTo(detX - 22, detY + 6); ctx.lineTo(detX + 2, detY); ctx.lineTo(detX - 6, detY + 16); ctx.closePath();
  ctx.fill();
  // whisker with a tiny deterministic tremble
  const wob = Math.sin(state.t * 0.9) * 1.6;
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(detX + 34, detY - 26); ctx.quadraticCurveTo(detX + 30 + wob, detY - 8, detX - 8 + wob, detY + 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(detX + 34, detY - 26); ctx.lineTo(detX + 34, topY); ctx.stroke();
  ctx.fillStyle = COL.faint; ctx.textAlign = "left";
  ctx.fillText("方铅矿", detX - 40, detY + 52);
  ctx.fillText("猫须", detX + 40, detY - 20);

  // RC load + headphones
  const lx = 360;
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(detX + 34, topY); ctx.lineTo(lx, topY); ctx.stroke();
  // resistor zigzag
  ctx.beginPath(); ctx.moveTo(lx, topY);
  const seg = 9;
  for (let i = 0; i < 6; i++) ctx.lineTo(lx + seg * i + seg / 2, topY - 9 + (i % 2) * 18 * 0 + (i % 2 === 0 ? -8 : 8));
  ctx.lineTo(lx + seg * 6, topY); ctx.stroke();
  ctx.fillStyle = COL.faint; ctx.textAlign = "center";
  ctx.fillText(`R·C = ${state.rx.loadRCuS} µs`, lx + 27, topY - 22);
  // parallel cap to ground
  const pcX = lx + 27;
  ctx.beginPath(); ctx.moveTo(pcX, topY); ctx.lineTo(pcX, topY + 22); ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(pcX - 12, topY + 22); ctx.lineTo(pcX + 12, topY + 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pcX - 12, topY + 28); ctx.lineTo(pcX + 12, topY + 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pcX, topY + 28); ctx.lineTo(pcX, topY + 44); ctx.stroke();
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(pcX - (14 - i * 4), topY + 44 + i * 5); ctx.lineTo(pcX + (14 - i * 4), topY + 44 + i * 5); ctx.stroke();
  }
  // headphones
  const hx = 480;
  ctx.beginPath(); ctx.moveTo(lx + seg * 6, topY); ctx.lineTo(hx, topY); ctx.stroke();
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(hx + 4, topY - 8, 20, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(hx - 14, topY - 24, 7, 0, P.TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(hx + 22, topY - 24, 7, 0, P.TAU); ctx.stroke();
  ctx.fillStyle = COL.faint; ctx.textAlign = "center";
  ctx.fillText("耳机", hx + 4, topY - 48);
  const vu = stationResp(P.WEAF_KHZ) * progLevel("speech", state.t);
  ctx.fillStyle = COL.gold; ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillText(`♪ ${Math.round(vu * 100)}`, hx + 4, topY + 14);

  // current dots when on air
  if (state.onAir) {
    ctx.fillStyle = COL.gold2;
    ctx.shadowColor = COL.gold; ctx.shadowBlur = 6;
    const path = [[136, 56], [136, 200], [250, 200], [334, 200], [414, 200], [484, 200]];
    const lens = [];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const d = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
      lens.push(d); total += d;
    }
    for (let d = 0; d < total; d += 42) {
      let s = (d + state.t * 60) % total;
      for (let i = 0; i < lens.length; i++) {
        if (s <= lens[i]) {
          const f = s / lens[i];
          const x = path[i][0] + (path[i + 1][0] - path[i][0]) * f;
          const y = path[i][1] + (path[i + 1][1] - path[i][1]) * f;
          ctx.beginPath(); ctx.arc(x, y, 2.6, 0, P.TAU); ctx.fill();
          break;
        }
        s -= lens[i];
      }
    }
    ctx.shadowBlur = 0;
  }

  // ---- the tuning dial ----
  const dCx = 380, dCy = 402, dR = 128;
  ctx.strokeStyle = COL.line2; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(dCx, dCy, dR, Math.PI, P.TAU); ctx.stroke();
  ctx.fillStyle = COL.faint; ctx.font = "10.5px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  for (let khz = 600; khz <= 720; khz += 10) {
    const ang = Math.PI + ((khz - 600) / 120) * Math.PI;
    const r1 = dR - (khz % 20 === 0 ? 12 : 6);
    ctx.beginPath();
    ctx.moveTo(dCx + Math.cos(ang) * r1, dCy + Math.sin(ang) * r1);
    ctx.lineTo(dCx + Math.cos(ang) * dR, dCy + Math.sin(ang) * dR);
    ctx.strokeStyle = COL.dim; ctx.lineWidth = 1; ctx.stroke();
    if (khz % 20 === 0) ctx.fillText(`${khz}`, dCx + Math.cos(ang) * (dR - 26), dCy + Math.sin(ang) * (dR - 26) + 3);
  }
  // station pins
  for (const s of P.STATIONS) {
    const ang = Math.PI + ((s.khz - 600) / 120) * Math.PI;
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(dCx + Math.cos(ang) * (dR + 8), dCy + Math.sin(ang) * (dR + 8), 4, 0, P.TAU); ctx.fill();
  }
  // needle at f0
  const ang = Math.PI + ((Math.min(720, Math.max(600, f0 / 1e3)) - 600) / 120) * Math.PI;
  ctx.strokeStyle = COL.red; ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(dCx, dCy);
  ctx.lineTo(dCx + Math.cos(ang) * (dR - 4), dCy + Math.sin(ang) * (dR - 4));
  ctx.stroke();
  ctx.fillStyle = COL.gold2; ctx.font = "15px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  ctx.fillText(`${(f0 / 1e3).toFixed(1)} kHz`, dCx - 46, dCy - 14);
  ctx.fillStyle = COL.faint; ctx.font = "10.5px ui-monospace, Menlo, monospace";
  ctx.fillText("f₀ = 1/(2π√LC)", dCx - 46, dCy + 2);
}

// ============================================================ 4 · selectivity
function drawResp() {
  const W = 600, H = 240, ctx = respCtx;
  ctx.clearRect(0, 0, W, H);
  const f0 = tunedF0(), Q = tunedQ(), bw = P.bandwidth(f0, Q);
  const fMin = 630e3, fMax = 690e3;
  const x0 = 44, x1 = W - 12, yBase = H - 26, yTop = 18;
  const fToX = (f) => x0 + ((f - fMin) / (fMax - fMin)) * (x1 - x0);
  const dbToY = (db) => yBase - ((db + 42) / 42) * (yBase - yTop);

  // −3 dB bandwidth band
  ctx.fillStyle = "rgba(127,168,201,.10)";
  ctx.fillRect(fToX(f0 - bw / 2), yTop, fToX(f0 + bw / 2) - fToX(f0 - bw / 2), yBase - yTop);

  // axes
  ctx.strokeStyle = "#2c2417"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, yBase); ctx.lineTo(x1, yBase); ctx.stroke();
  ctx.fillStyle = COL.faint; ctx.font = "10.5px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  for (let khz = 640; khz <= 680; khz += 10) ctx.fillText(`${khz}`, fToX(khz * 1e3), H - 10);
  for (const db of [0, -10, -20, -30, -40]) {
    ctx.beginPath(); ctx.moveTo(x0 - 4, dbToY(db)); ctx.lineTo(x0, dbToY(db)); ctx.stroke();
    ctx.textAlign = "right"; ctx.fillText(`${db}`, x0 - 7, dbToY(db) + 3); ctx.textAlign = "center";
  }

  const curve = (stages, style) => {
    ctx.strokeStyle = style === "bold" ? COL.gold2 : COL.dim;
    ctx.lineWidth = style === "bold" ? 2.2 : 1.4;
    if (style !== "bold") ctx.setLineDash([5, 4]);
    ctx.beginPath();
    let started = false;
    for (let x = x0; x <= x1; x += 1) {
      const f = fMin + ((x - x0) / (x1 - x0)) * (fMax - fMin);
      const db = P.toDb(P.stagesResponse(Math.abs(f - f0), f0, Q, stages));
      const y = dbToY(Math.max(-42, db));
      started ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), (started = true));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  curve(1, "thin");
  if (state.rx.stages >= 2) curve(state.rx.stages, "bold");

  // station markers (label the detuned ones; the tuned one IS the peak)
  for (const s of P.STATIONS) {
    const x = fToX(s.khz * 1e3);
    const db = P.toDb(stationResp(s.khz));
    ctx.strokeStyle = s.color; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.moveTo(x, yBase); ctx.lineTo(x, dbToY(Math.max(-42, db))); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(x, dbToY(Math.max(-42, db)), 3.6, 0, P.TAU); ctx.fill();
    if (Math.abs(s.khz * 1e3 - f0) > 4e3) {
      ctx.textAlign = x < (x0 + x1) / 2 ? "left" : "right";
      ctx.fillText(`${s.khz}`, x + (x < (x0 + x1) / 2 ? 5 : -5), dbToY(Math.max(-42, db)) - 6);
    }
  }
  // f₀ marker, pinned top-left so it never fights the peak label
  ctx.fillStyle = COL.ink; ctx.textAlign = "left";
  ctx.fillText(`f₀ = ${(f0 / 1e3).toFixed(1)} kHz · BW = ${(bw / 1000).toFixed(1)} kHz`, x0 + 6, yTop + 10);
}

// ============================================================ 5 · the detector
function drawDet() {
  const W = 600, H = 200, ctx = detCtx;
  ctx.clearRect(0, 0, W, H);
  const sim = detectorSim();
  const y0 = H - 30, yT = 14;
  const vToY = (v) => y0 - ((v + 0.25) / 1.7) * (y0 - yT);

  // zero line
  ctx.strokeStyle = "#2c2417"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, vToY(0)); ctx.lineTo(W, vToY(0)); ctx.stroke();

  // envelope
  ctx.strokeStyle = COL.gold2; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 2) {
    const i = Math.floor((x / W) * (sim.n - 1));
    const y = vToY(sim.env[i]);
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // detector output: min/max band per column (the carrier ripple is real —
  // 8 samples per carrier cycle at 660 kHz)
  ctx.fillStyle = "rgba(127,168,201,.30)";
  ctx.beginPath();
  let tops = [], bots = [];
  const cols = Math.min(600, sim.n);
  for (let c = 0; c < cols; c++) {
    const i0 = Math.floor((c / cols) * sim.n), i1 = Math.floor(((c + 1) / cols) * sim.n);
    let mn = Infinity, mx = -Infinity;
    for (let i = i0; i < i1; i++) { mn = Math.min(mn, sim.out[i]); mx = Math.max(mx, sim.out[i]); }
    tops.push(mx); bots.push(mn);
  }
  for (let c = 0; c < cols; c++) ctx.rect(c, vToY(tops[c]), 1, Math.max(1, vToY(bots[c]) - vToY(tops[c])));
  ctx.fill();
  ctx.strokeStyle = COL.blue; ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let c = 0; c < cols; c += 1) {
    const y = vToY((tops[c] + bots[c]) / 2);
    c === 0 ? ctx.moveTo(c, y) : ctx.lineTo(c, y);
  }
  ctx.stroke();

  // diagonal clipping: spans where the output rides above the envelope
  const clipPx = 3;
  ctx.strokeStyle = COL.red; ctx.lineWidth = clipPx; ctx.globalAlpha = 0.9;
  let inClip = false;
  ctx.beginPath();
  for (let c = 0; c < cols; c++) {
    const i = Math.floor((c / cols) * sim.n);
    const clipped = sim.out[i] > sim.env[i] + 1e-9;
    if (clipped && !inClip) { ctx.moveTo(c, y0 + 8); inClip = true; }
    if (!clipped && inClip) { ctx.lineTo(c, y0 + 8); ctx.stroke(); ctx.beginPath(); inClip = false; }
  }
  if (inClip) { ctx.lineTo(cols - 1, y0 + 8); ctx.stroke(); }
  ctx.globalAlpha = 1;

  ctx.fillStyle = COL.faint; ctx.font = "10.5px ui-monospace, Menlo, monospace"; ctx.textAlign = "left";
  ctx.fillText("四个音频周期 · 载波 660 kHz（纹波与切割是数值检波的真实输出）", 10, H - 8);
}

// ============================================================ 6 · propagation
function drawProp() {
  const W = 960, H = 400, ctx = propCtx;
  ctx.clearRect(0, 0, W, H);
  const { night, skyAmp, hEkM, distKm } = state.prop;

  // sky
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  if (night) { grad.addColorStop(0, "#0a0f1c"); grad.addColorStop(0.7, "#101722"); grad.addColorStop(1, "#171b20"); }
  else { grad.addColorStop(0, "#2a2113"); grad.addColorStop(0.7, "#3a2e18"); grad.addColorStop(1, "#463519"); }
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  if (night) {
    // deterministic stars
    ctx.fillStyle = "rgba(242,232,213,.8)";
    for (let i = 0; i < 70; i++) {
      const x = hash(i) * W, y = hash(i + 500) * 200;
      const tw = 0.5 + 0.5 * Math.sin(state.t * (0.8 + hash(i + 99)) + i);
      ctx.globalAlpha = 0.25 + 0.6 * tw;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#e8e0c8";
    ctx.beginPath(); ctx.arc(W - 120, 64, 20, 0, P.TAU); ctx.fill();
    ctx.fillStyle = "#101722";
    ctx.beginPath(); ctx.arc(W - 128, 58, 17, 0, P.TAU); ctx.fill();
  } else {
    ctx.fillStyle = "#f0c75e"; ctx.shadowColor = "#f0c75e"; ctx.shadowBlur = 40;
    ctx.beginPath(); ctx.arc(W - 110, 70, 24, 0, P.TAU); ctx.fill();
    ctx.shadowBlur = 0;
  }

  const eY = 96; // E layer band
  ctx.fillStyle = night ? "rgba(127,168,201,.16)" : "rgba(127,168,201,.05)";
  ctx.fillRect(0, eY - 14, W, 26);
  ctx.strokeStyle = night ? "rgba(127,168,201,.5)" : "rgba(127,168,201,.18)";
  ctx.lineWidth = 1; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(0, eY - 14); ctx.lineTo(W, eY - 14); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COL.blue; ctx.font = "12px ui-monospace, Menlo, monospace"; ctx.textAlign = "left";
  ctx.fillText(`E 层 · ${hEkM} km ${night ? "· 夜间镜面" : "· 白天被 D 层遮蔽"}`, 14, eY - 20);
  if (!night) {
    ctx.fillStyle = "rgba(217,106,90,.35)";
    ctx.fillRect(0, eY + 60, W, 18);
    ctx.fillStyle = COL.red;
    ctx.fillText("D 层 · 白天吞掉天波（广告播在下午 5:15 —— 只有地波）", 14, eY + 74);
  }

  // earth
  const gY = 320;
  ctx.fillStyle = "rgba(26,20,14,.92)";
  ctx.beginPath(); ctx.moveTo(0, gY); ctx.quadraticCurveTo(W / 2, gY + 42, W, gY);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = COL.line2; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(0, gY); ctx.quadraticCurveTo(W / 2, gY + 42, W, gY); ctx.stroke();
  const earthY = (x) => gY + 42 * (4 * (x / W) * (1 - x / W)) / 2;

  // transmitter (Walker Street, Lower Manhattan) — filled silhouettes
  const txX = 90, txY = earthY(txX);
  ctx.fillStyle = "#0e0b07"; ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.rect(txX - 30, txY - 44, 20, 44); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(txX - 4, txY - 64, 24, 64); ctx.fill(); ctx.stroke();
  // lit windows
  ctx.fillStyle = night ? "rgba(240,199,94,.75)" : "rgba(240,199,94,.4)";
  for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) {
    if (hash(r * 7 + c) > 0.35) ctx.fillRect(txX - 26 + c * 9, txY - 38 + r * 9, 4, 5);
    if (hash(r * 5 + c + 40) > 0.35) ctx.fillRect(txX + 1 + c * 10, txY - 58 + r * 10, 5, 6);
  }
  // mast + T antenna
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(txX + 8, txY - 64); ctx.lineTo(txX + 8, txY - 104); ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(txX - 6, txY - 96); ctx.lineTo(txX + 26, txY - 96); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(txX - 6, txY - 96); ctx.lineTo(txX + 8, txY - 104); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(txX + 26, txY - 96); ctx.lineTo(txX + 8, txY - 104); ctx.stroke();
  ctx.fillStyle = COL.dim; ctx.textAlign = "center"; ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillText("WEAF 发射塔 · 曼哈顿", txX, txY + 18);
  if (state.onAir) {
    ctx.strokeStyle = COL.gold; ctx.lineWidth = 1.6;
    for (let ring = 0; ring < 3; ring++) {
      const ph = ((state.t * 0.5 + ring / 3) % 1);
      ctx.globalAlpha = 0.75 * (1 - ph);
      ctx.beginPath(); ctx.arc(txX + 8, txY - 104, 8 + ph * 38, 0, P.TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // receiver car — filled with wheels
  const rxX = 120 + (distKm / 120) * 780, rxY = earthY(Math.min(rxX, W - 20));
  ctx.fillStyle = "#161009"; ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(rxX - 24, rxY - 16);
  ctx.lineTo(rxX - 24, rxY - 4); ctx.lineTo(rxX + 24, rxY - 4); ctx.lineTo(rxX + 24, rxY - 16);
  ctx.lineTo(rxX + 12, rxY - 16); ctx.lineTo(rxX + 6, rxY - 27); ctx.lineTo(rxX - 14, rxY - 27);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COL.gold;
  ctx.beginPath(); ctx.arc(rxX - 12, rxY - 2, 4, 0, P.TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(rxX + 12, rxY - 2, 4, 0, P.TAU); ctx.fill();
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(rxX + 16, rxY - 27); ctx.lineTo(rxX + 16, rxY - 52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rxX + 6, rxY - 46); ctx.lineTo(rxX + 26, rxY - 46); ctx.stroke();
  ctx.fillStyle = COL.dim; ctx.textAlign = "center";
  ctx.fillText(`收听点 · ${distKm} km`, rxX, rxY + 18);

  // ground wave (dashed arc hugging the earth)
  ctx.strokeStyle = COL.gold2; ctx.lineWidth = 2.6; ctx.setLineDash([9, 7]);
  ctx.beginPath();
  ctx.moveTo(txX + 12, txY - 4);
  for (let x = txX; x <= rxX; x += 24) ctx.lineTo(x, earthY(x) + 8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COL.gold2; ctx.textAlign = "center"; ctx.font = "12.5px ui-monospace, Menlo, monospace";
  ctx.fillText(`地波 · ${distKm} km · 场强 ∝ 1/x`, (txX + rxX) / 2 - 40, earthY((txX + rxX) / 2) + 32);

  // skywave (night only): TX → mid-hop at E layer → RX
  if (night && skyAmp > 0.02) {
    const midX = (txX + rxX) / 2;
    ctx.strokeStyle = COL.blue; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(txX + 8, txY - 104); ctx.lineTo(midX, eY); ctx.lineTo(rxX + 16, rxY - 52); ctx.stroke();
    ctx.fillStyle = COL.blue;
    ctx.beginPath(); ctx.arc(midX, eY, 5, 0, P.TAU); ctx.fill();
    ctx.font = "12.5px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
    ctx.fillText(`天波一跳 · 2√((x/2)²+h²) = ${skyPathKm().toFixed(0)} km`, midX, eY - 16);
    ctx.textAlign = "left";
    ctx.fillText(`Δ 路程差 = ${diffKm().toFixed(1)} km = ${(diffKm() * 1000 / P.wavelength(state.tx.fcKhz * 1e3)).toFixed(0)} λ`, Math.min(W - 260, rxX - 150), (eY + rxY) / 2 + 24);
    // phase wheel at the receiver
    const px = rxX + 74, py = rxY - 60;
    ctx.strokeStyle = COL.faint; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, py, 16, 0, P.TAU); ctx.stroke();
    ctx.strokeStyle = COL.gold2; ctx.lineWidth = 2;
    const ph = driftPhase(state.t);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 15 * Math.cos(ph), py - 15 * Math.sin(ph)); ctx.stroke();
    ctx.strokeStyle = COL.blue;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 15 * nightRho() * Math.cos(ph), py - 15 * nightRho() * Math.sin(ph) + 2); ctx.stroke();
    ctx.fillStyle = COL.faint; ctx.font = "10.5px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
    ctx.fillText("两路相加", px, py + 30);
  }

  // antenna engineering inset: Woolworth vs λ/4
  const ix = 20, iy = H - 118, iw = 214, ih = 96;
  ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.strokeStyle = COL.line2; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, 8); ctx.fill(); ctx.stroke();
  const base = iy + ih - 12;
  const mScale = 62 / 241; // px per metre
  ctx.strokeStyle = COL.dim; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(ix + 40, base); ctx.lineTo(ix + 40, base - 241 * mScale); ctx.stroke();
  ctx.strokeStyle = COL.gold2;
  ctx.beginPath(); ctx.moveTo(ix + 116, base); ctx.lineTo(ix + 116, base - 113.6 * mScale); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = COL.faint;
  ctx.beginPath(); ctx.moveTo(ix + 10, base); ctx.lineTo(ix + iw - 10, base); ctx.stroke();
  ctx.fillStyle = COL.dim; ctx.font = "10.5px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  ctx.fillText("伍尔沃斯 241 m", ix + 40, base - 241 * mScale - 6);
  ctx.fillStyle = COL.gold2;
  ctx.fillText("λ/4 = 114 m", ix + 116, base - 113.6 * mScale - 6);
  ctx.fillStyle = COL.faint;
  ctx.fillText("λ = c/f = 454 m", ix + 160, iy + 14);
}

// ============================================================ 7 · the fade
function drawFade() {
  const W = 960, H = 180, ctx = fadeCtx;
  ctx.clearRect(0, 0, W, H);
  const window = 20; // seconds
  const yBase = H - 22, yTop = 12;
  const dbToY = (db) => yBase - ((db + 30) / 38) * (yBase - yTop);

  ctx.strokeStyle = "#2c2417"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, dbToY(0)); ctx.lineTo(W, dbToY(0)); ctx.stroke();
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(0, dbToY(-20)); ctx.lineTo(W, dbToY(-20)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COL.faint; ctx.font = "10.5px ui-monospace, Menlo, monospace"; ctx.textAlign = "left";
  ctx.fillText("0 dB", 6, dbToY(0) - 4);
  ctx.fillText("−20 dB", 6, dbToY(-20) - 4);
  ctx.textAlign = "right";
  ctx.fillText(`过去 ${window} s · 电离层漂移使 φ 转动`, W - 8, H - 6);

  const rho = nightRho();
  ctx.strokeStyle = COL.gold2; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 1) {
    const t = state.t - (W - x) / W * window;
    const db = P.toDb(P.twoRay(1, rho, driftPhase(t)));
    const y = dbToY(Math.max(-30, Math.min(8, db)));
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  // current marker
  const nowDb = P.toDb(P.twoRay(1, rho, driftPhase(state.t)));
  ctx.fillStyle = COL.ember;
  ctx.beginPath(); ctx.arc(W - 4, dbToY(Math.max(-30, Math.min(8, nowDb))), 4, 0, P.TAU); ctx.fill();
}

// ============================================================ readouts
function updateReadouts() {
  const { m, fm, fcKhz, A } = state.tx;
  $("ro-m").firstChild.nodeValue = m.toFixed(2);
  $("ro-m-note").textContent = m > 1 ? "越调制！" : "合规 ≤ 1";
  $("ro-sb").firstChild.nodeValue = (P.sidebandPowerFrac(m) * 100).toFixed(1);
  $("ro-env").firstChild.nodeValue = (A * (1 + m)).toFixed(2);
  $("ro-lam").firstChild.nodeValue = P.wavelength(fcKhz * 1e3).toFixed(1);
  $("pw-carrier").textContent = `${(P.carrierPowerFrac(m) * 100).toFixed(1)} %`;
  $("pw-side").textContent = `共 ${(P.sidebandPowerFrac(m) * 100).toFixed(1)} %`;

  // rx
  const f0 = tunedF0(), Q = tunedQ(), bw = P.bandwidth(f0, Q);
  $("rx-f0").textContent = `${(f0 / 1e3).toFixed(1)} kHz`;
  $("rx-bw").textContent = `Q ${Q.toFixed(0)} · BW ${(bw / 1000).toFixed(1)} kHz`;
  const bound = P.maxLoadRC(m, fm);
  $("rx-rcbound").textContent = Number.isFinite(bound) ? `${(bound * 1e6).toFixed(0)} µs ${state.rx.loadRCuS <= bound ? "✓ 未切割" : "✗ 越界切割"}` : "∞";
  $("rx-dist").textContent = `${(P.sqDistortion(m) * 100).toFixed(1)} % 二次谐波`;

  // station meters
  const meters = $("st-meters");
  const bars = meters.querySelectorAll(".st-meter");
  P.STATIONS.forEach((s, i) => {
    const el = bars[i];
    if (!el) return;
    const resp = stationResp(s.khz);
    const db = P.toDb(resp);
    const lvl = resp * progLevel(s.prog, state.t);
    el.querySelector(".db").textContent = `${db.toFixed(1)} dB`;
    const fill = Math.max(2, Math.min(100, ((db + 42) / 42) * 100 * (0.55 + 0.45 * lvl)));
    el.querySelector(".bar i").style.width = `${fill}%`;
  });

  // prop
  const rho = nightRho();
  $("pf-ground").textContent = `${groundFieldUV().toFixed(0)} µV/m（1 mV/m @ 1 km）`;
  $("pf-sky").textContent = `${skyPathKm().toFixed(1)} km`;
  $("pf-diff").textContent = `${diffKm().toFixed(1)} km · ${(diffKm() * 1000 / P.wavelength(state.tx.fcKhz * 1e3)).toFixed(0)} λ`;
  $("pf-sum").textContent = `${P.toDb(P.twoRay(1, rho, driftPhase(state.t))).toFixed(1)} dB ${state.prop.night ? "(衰落中)" : "(地波单路)"}`;
}

// ============================================================ wiring
const refreshers = [];
function refresh() { refreshers.forEach((f) => f()); }

function bindSlider(id, outId, get, set, format) {
  const range = $(id), out = $(outId);
  const sync = () => { range.value = get(); out.textContent = format(get()); };
  range.addEventListener("input", () => { set(parseFloat(range.value)); refresh(); });
  refreshers.push(sync);
  sync();
}

bindSlider("m-range", "m-out", () => state.tx.m, (v) => { state.tx.m = v; }, (v) => v.toFixed(2));
bindSlider("fm-range", "fm-out", () => state.tx.fm, (v) => { state.tx.fm = v; }, (v) => `${v.toFixed(0)} Hz`);
bindSlider("fc-range", "fc-out", () => state.tx.fcKhz, (v) => { state.tx.fcKhz = v; }, (v) => `${v.toFixed(0)} kHz`);
bindSlider("cap-range", "cap-out", () => state.rx.capPf, (v) => { state.rx.capPf = v; }, (v) => `${v.toFixed(1)} pF`);
bindSlider("l-range", "l-out", () => state.rx.LuH, (v) => { state.rx.LuH = v; }, (v) => `${v.toFixed(0)} µH`);
bindSlider("r-range", "r-out", () => state.rx.coilR, (v) => { state.rx.coilR = v; }, (v) => `${v.toFixed(1)} Ω`);
bindSlider("rc-range", "rc-out", () => state.rx.loadRCuS, (v) => { state.rx.loadRCuS = v; }, (v) => `${v.toFixed(0)} µs`);
bindSlider("rho-range", "rho-out", () => state.prop.skyAmp, (v) => { state.prop.skyAmp = v; }, (v) => v.toFixed(2));
bindSlider("he-range", "he-out", () => state.prop.hEkM, (v) => { state.prop.hEkM = v; }, (v) => `${v.toFixed(0)} km`);
bindSlider("dist-range", "dist-out", () => state.prop.distKm, (v) => { state.prop.distKm = v; }, (v) => `${v.toFixed(0)} km`);

// station meters (built once)
const meterBox = $("st-meters");
for (const s of P.STATIONS) {
  const el = document.createElement("div");
  el.className = "st-meter";
  el.innerHTML = `<span class="nm">${s.khz === P.WEAF_KHZ ? "<b>WEAF</b>" : s.khz}</span>
    <span class="bar"><i style="background:${s.color}"></i></span>
    <span class="db">—</span>`;
  meterBox.appendChild(el);
}

// presets
const presetBox = $("presets");
for (const preset of Object.values(P.PRESETS)) {
  const btn = document.createElement("button");
  btn.textContent = preset.label;
  btn.dataset.id = preset.id;
  btn.addEventListener("click", () => applyPreset(preset.id));
  presetBox.appendChild(btn);
}

function applyPreset(id) {
  const preset = P.PRESETS[id];
  state.preset = id;
  Object.assign(state.tx, preset.tx);
  Object.assign(state.rx, preset.rx);
  Object.assign(state.prop, preset.prop);
  $("day-btn").classList.toggle("primary", !state.prop.night);
  $("night-btn").classList.toggle("primary", state.prop.night);
  $("stages-btn").textContent = `双联两级调谐：${state.rx.stages >= 2 ? "开" : "关"}`;
  presetBox.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.id === id));
  refresh();
}

// tabs
function setTab(name) {
  state.tab = name;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
  document.querySelectorAll(".tab-body").forEach((b) => b.classList.toggle("hidden", b.id !== `tab-${name}`));
  drawAll();
}
document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

// buttons
$("onair-btn").addEventListener("click", () => {
  state.onAir = !state.onAir;
  $("onair-chip").textContent = state.onAir ? "● ON AIR" : "○ OFF AIR";
  $("onair-chip").classList.toggle("on", state.onAir);
});
$("tune-btn").addEventListener("click", () => {
  state.rx.capPf = +(P.capFor(P.WEAF_KHZ * 1e3, state.rx.LuH * 1e-6) * 1e12).toFixed(1);
  refresh();
});
$("stages-btn").addEventListener("click", () => {
  state.rx.stages = state.rx.stages >= 2 ? 1 : 2;
  $("stages-btn").textContent = `双联两级调谐：${state.rx.stages >= 2 ? "开" : "关"}`;
});
$("day-btn").addEventListener("click", () => { state.prop.night = false; applyDayNight(); });
$("night-btn").addEventListener("click", () => { state.prop.night = true; applyDayNight(); });
function applyDayNight() {
  $("day-btn").classList.toggle("primary", !state.prop.night);
  $("night-btn").classList.toggle("primary", state.prop.night);
}

// history timeline (static content)
$("timeline").innerHTML = [
  ["1920-11-02", "KDKA 匹兹堡开播——西屋公司拿到第一张商业电台执照，播报哈定/考克斯大选开票，广播从业余爱好变成生意。"],
  ["1922-08-16", "AT&T/西部电气的 <b>WEAF</b> 在纽约开播，口号是「收费广播」：播出时间像长途电话一样按分钟出售。"],
  ["<b>1922-08-28</b>", "<b>下午 5:15</b>——昆斯伯罗公司买下十分钟，布莱克韦尔先生推销杰克逊高地的「霍桑庭院」公寓。公认的第一条付费广播广告，<b>$50</b>。", "big"],
  ["1922-10", "收费广播账本累计 <b>$550</b>——恰好十一条「霍桑级」广告；电台开始为「谁在听」发明收听率。"],
  ["1926", "AT&T 把 WEAF 卖给 RCA，与 WJZ 网合并成 <b>NBC 红网</b>——广告养网的美国广播模式就此定型。"],
  ["1946", "WEAF 改呼号 WNBC，成为 NBC 旗舰台。"],
  ["1988-今", "660 千赫移交 <b>WFAN</b> 体育台——那个频率今天仍在播音，从卖公寓到播橄榄球，一百零四年没下过班。"],
].map(([when, what, cls]) => `<div class="tl-item ${cls || ""}"><span class="when">${when}</span><span class="what">${what}</span></div>`).join("");

// ============================================================ main loop
function drawAll() {
  drawScope();
  drawSpectrum();
  if (state.tab === "rx") { drawRx(); drawResp(); drawDet(); }
  if (state.tab === "prop") { drawProp(); drawFade(); }
  updateReadouts();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  state.t += dt;
  drawAll();
  if (state.videoMode) return; // __demo.step drives everything
  requestAnimationFrame(loop);
}

applyPreset("air");
setTab("rx");
requestAnimationFrame(loop);

// ============================================================ deterministic demo/video API
window.__demo = {
  loadPreset: (id) => applyPreset(id),
  setTab: (name) => setTab(name),
  setVideoMode: (on) => { state.videoMode = on; },
  setOnAir: (on) => {
    state.onAir = on;
    $("onair-chip").textContent = on ? "● ON AIR" : "○ OFF AIR";
    $("onair-chip").classList.toggle("on", on);
  },
  setTx: (k, v) => { state.tx[k] = v; refresh(); },
  setRx: (k, v) => { state.rx[k] = v; if (k === "stages") $("stages-btn").textContent = `双联两级调谐：${v >= 2 ? "开" : "关"}`; refresh(); },
  setProp: (k, v) => {
    state.prop[k] = v;
    if (k === "night") applyDayNight();
    refresh();
  },
  tuneToWeaf: () => { state.rx.capPf = +(P.capFor(P.WEAF_KHZ * 1e3, state.rx.LuH * 1e-6) * 1e12).toFixed(1); refresh(); },
  scrollToScope: () => document.querySelector(".tx-card").scrollIntoView({ block: "center" }),
  scrollToRx: () => document.querySelector(".tabs-card").scrollIntoView({ block: "start" }),
  step(dt) {
    state.videoMode = true;
    state.t += dt;
    drawAll();
  },
  state: () => ({
    tab: state.tab,
    onAir: state.onAir,
    m: state.tx.m,
    fm: state.tx.fm,
    fcKhz: state.tx.fcKhz,
    f0Khz: tunedF0() / 1e3,
    q: tunedQ(),
    bwHz: P.bandwidth(tunedF0(), tunedQ()),
    respDb: Object.fromEntries(P.STATIONS.map((s) => [s.id, P.toDb(stationResp(s.khz))])),
    clippedFrac: detectorSim().clippedFrac,
    ripplePct: P.rippleDroop(P.WEAF_KHZ * 1e3, state.rx.loadRCuS * 1e-6) * 100,
    night: state.prop.night,
    skyAmp: state.prop.skyAmp,
    distKm: state.prop.distKm,
    fadeDb: P.toDb(P.twoRay(1, nightRho(), driftPhase(state.t))),
  }),
};
