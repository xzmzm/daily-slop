// app.js — Carrington's Storm studio: the 1-AU battlefield, the parametric
// magnetogram replay, five formula tabs, and the telegraph/grid bench.
// All physics comes from physics.js; this file only draws and animates it.

import * as P from "./physics.js";

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------
const S = {
  t: 20, playing: false, speed: 6, // hours per second
  vKmS: P.CARRINGTON_V, depth: 1600,
  tab: "race",
  wire: { e: 2.0, l: 170, r: 1850, preset: "p1859", batteryOff: false },
  videoMode: false,
};
const sscH = () => P.CME_LAUNCH_H + P.transitHours(S.vKmS);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const TAU = Math.PI * 2;

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// canvas plumbing — every canvas gets a fixed logical size; CSS scales it
// ---------------------------------------------------------------------------
function setupCanvas(id, w, h) {
  const c = $(id);
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  return { c, ctx, w, h };
}
let CV = {};
function setupCanvases() {
  CV.bench = setupCanvas("bench", 1680, 1000);
  CV.spot = setupCanvas("spot", 460, 340);
  CV.race = setupCanvas("raceC", 780, 470);
  CV.l1 = setupCanvas("l1C", 780, 470);
  CV.mag = setupCanvas("magC", 780, 470);
  CV.magS = setupCanvas("magS", 780, 470);
  CV.ring = setupCanvas("ringC", 780, 470);
  CV.wire = setupCanvas("wireC", 780, 470);
}

// ---------------------------------------------------------------------------
// the great sunspot group (Carrington's drawing, 27 Aug – 7 Sep 1859)
// {x,y} in disc radii along a band tilted −11°; r in px on the main disc
// ---------------------------------------------------------------------------
const SPOTS = [
  { x: -0.315, y: -0.03, r: 30, u: 0.55 },
  { x: -0.205, y: 0.025, r: 21, u: 0.5 },
  { x: -0.09, y: -0.005, r: 17, u: 0.55 },
  { x: 0.025, y: -0.05, r: 14, u: 0.5 },
  { x: 0.13, y: 0.005, r: 11, u: 0.5 },
  { x: 0.235, y: 0.055, r: 9, u: 0.5 },
  { x: -0.26, y: 0.05, r: 7, u: 0.6 },
  { x: 0.075, y: 0.06, r: 6, u: 0.6 },
  { x: 0.31, y: 0.01, r: 5.5, u: 0.6 },
  { x: -0.02, y: -0.12, r: 4.5, u: 0.6 },
  { x: 0.19, y: -0.075, r: 4, u: 0.6 },
];
const KERNELS = [ // the two patches of white light, on the two largest spots
  { x: -0.315, y: -0.03, s: 13 },
  { x: -0.205, y: 0.025, s: 9 },
];
const flareEnv = (t) => {
  const d = t - P.FLARE_H;
  if (d < -0.02 || d > 0.14) return 0;
  const rise = d < 0 ? 0 : d / 0.03;
  const peak = Math.exp(-((d - 0.035) ** 2) / (2 * 0.0011));
  return Math.min(rise, 1) * peak;
};

// deterministic pseudo-random (stable across frames for sparks etc.)
const rand = (seed) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------------------------------------------------------------------
// main bench: space scene + magnetogram
// ---------------------------------------------------------------------------
const AU_X0 = 305, AU_X1 = 1230; // the AU ruler span
const SUN = { x: 168, y: 320, r: 96 };
const EARTH = { x: 1272, y: 320 };
const REpx = 9; // one Earth radius in scene pixels
const auX = (frac) => AU_X0 + frac * (AU_X1 - AU_X0);

function sceneTraces(t) {
  const ssc = sscH();
  return {
    ssc,
    dst: P.dstTrace(t, ssc, S.depth),
    p: P.pressureTrace(t, ssc),
    dho: P.dhoTrace(t, ssc, S.depth),
  };
}
const eNow = (dho) => P.eFromDho(dho) * (2 / 3); // mid-latitude ~2/3 of the Maine-like factor

function drawBench() {
  const { ctx, w, h } = CV.bench;
  const t = S.t;
  const { dst, p, dho } = sceneTraces(t);
  const trans = P.transitHours(S.vKmS);
  const cmeFrac = clamp((t - P.CME_LAUNCH_H) / trans, 0, 1);
  const photonFrac = clamp((t - P.FLARE_H) / (P.tLightSeconds() / 3600), 0, 1);
  const E = eNow(dho);

  ctx.clearRect(0, 0, w, h);
  // deep-space wash
  const bg = ctx.createLinearGradient(0, 0, 0, 620);
  bg.addColorStop(0, "#050910"); bg.addColorStop(1, "#03060b");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, 640);

  // starfield
  for (let i = 0; i < 90; i++) {
    const sx = rand(i * 3.7) * w, sy = rand(i * 9.1) * 600;
    ctx.fillStyle = `rgba(200,220,235,${0.12 + rand(i * 1.3) * 0.35})`;
    ctx.fillRect(sx, sy, 1.4, 1.4);
  }

  // --- the Sun -------------------------------------------------------------
  const glow = ctx.createRadialGradient(SUN.x, SUN.y, SUN.r * 0.6, SUN.x, SUN.y, SUN.r * 2.6);
  glow.addColorStop(0, "rgba(255,214,120,.35)");
  glow.addColorStop(0.5, "rgba(255,170,60,.10)");
  glow.addColorStop(1, "rgba(255,150,50,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(SUN.x - SUN.r * 2.6, SUN.y - SUN.r * 2.6, SUN.r * 5.2, SUN.r * 5.2);
  const disc = ctx.createRadialGradient(SUN.x - 20, SUN.y - 20, 8, SUN.x, SUN.y, SUN.r);
  disc.addColorStop(0, "#fff3d6"); disc.addColorStop(0.75, "#ffd98f"); disc.addColorStop(1, "#f2b45c");
  ctx.fillStyle = disc;
  ctx.beginPath(); ctx.arc(SUN.x, SUN.y, SUN.r, 0, TAU); ctx.fill();

  // spots, rotated −11°
  ctx.save();
  ctx.translate(SUN.x, SUN.y); ctx.rotate(-0.19);
  for (const sp of SPOTS) {
    const px = sp.x * SUN.r, py = sp.y * SUN.r;
    ctx.fillStyle = "rgba(140,80,30,.55)";
    ctx.beginPath(); ctx.arc(px, py, sp.r, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(20,10,5,.92)";
    ctx.beginPath(); ctx.arc(px, py, sp.r * sp.u, 0, TAU); ctx.fill();
  }
  // the white-light kernels
  const fe = flareEnv(t);
  if (fe > 0.01) {
    for (const k of KERNELS) {
      const px = k.x * SUN.r, py = k.y * SUN.r;
      const kg = ctx.createRadialGradient(px, py, 0, px, py, k.s * (1 + fe));
      kg.addColorStop(0, `rgba(255,255,255,${0.95 * fe})`);
      kg.addColorStop(0.4, `rgba(255,250,220,${0.65 * fe})`);
      kg.addColorStop(1, "rgba(255,240,200,0)");
      ctx.fillStyle = kg;
      ctx.beginPath(); ctx.arc(px, py, k.s * (1 + fe) * 1.8, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
  ctx.fillStyle = "rgba(240,199,94,.9)";
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillText("太阳 · 大黑子群 ≈2300 msh", SUN.x - 78, SUN.y + SUN.r + 26);
  if (fe > 0.02) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px ui-monospace, Menlo, monospace";
    ctx.fillText("11:18 白光耀斑", SUN.x - 52, SUN.y - SUN.r - 14);
  }

  // --- the AU ruler ---------------------------------------------------------
  ctx.strokeStyle = "rgba(90,120,150,.35)";
  ctx.setLineDash([2, 6]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(AU_X0, SUN.y + 122); ctx.lineTo(AU_X1, SUN.y + 122); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(90,116,134,.9)";
  ctx.font = "11px ui-monospace, Menlo, monospace";
  for (const f of [0.25, 0.5, 0.75]) {
    const x = auX(f);
    ctx.beginPath(); ctx.moveTo(x, SUN.y + 117); ctx.lineTo(x, SUN.y + 127); ctx.stroke();
    ctx.fillText(`${(f).toFixed(2)} AU`, x - 16, SUN.y + 140);
  }
  ctx.fillText("0 AU", AU_X0 - 16, SUN.y + 140);
  ctx.fillText("1 AU", AU_X1 - 16, SUN.y + 140);

  // faint Parker spiral
  ctx.strokeStyle = "rgba(90,130,160,.10)";
  for (let arm = 0; arm < 3; arm++) {
    ctx.beginPath();
    for (let a = 0.4; a < 4.2; a += 0.06) {
      const r = 30 + a * 62;
      const x = SUN.x + Math.cos(a + arm * 2.1) * r;
      const y = SUN.y + Math.sin(a + arm * 2.1) * r * 0.6;
      if (x < AU_X0 - 40) continue;
      if (x > AU_X1 + 20) break;
      a === 0.4 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // --- photon front ---------------------------------------------------------
  if (t >= P.FLARE_H && photonFrac < 1) {
    const x = auX(photonFrac);
    ctx.strokeStyle = `rgba(255,244,200,${0.9 - photonFrac * 0.55})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(SUN.x, SUN.y, Math.hypot(x - SUN.x, 0), -0.55, 0.55);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,244,200,.8)";
    ctx.font = "11px ui-monospace, Menlo, monospace";
    ctx.fillText("光（8.3 分钟到）", x - 60, SUN.y - 96);
  }

  // --- the CME ---------------------------------------------------------------
  if (t >= P.CME_LAUNCH_H && cmeFrac > 0) {
    const x = auX(cmeFrac);
    // shock crescent
    ctx.strokeStyle = "rgba(232,150,58,.9)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(SUN.x, SUN.y, x - SUN.x, -0.3, 0.3); ctx.stroke();
    // ejecta cloud
    const eg = ctx.createRadialGradient(x - 46, SUN.y, 4, x - 30, SUN.y, 74);
    eg.addColorStop(0, "rgba(200,120,60,.5)");
    eg.addColorStop(1, "rgba(160,90,50,0)");
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(x - 30, SUN.y, 74, 0, TAU); ctx.fill();
    // trailing debris
    for (let i = 0; i < 14; i++) {
      const rr = rand(i * 5.3 + Math.floor(t * 3));
      const ra = rand(i * 7.7);
      ctx.fillStyle = `rgba(220,160,90,${0.15 + 0.5 * cmeFrac})`;
      ctx.beginPath();
      ctx.arc(x - 24 - rr * 130, SUN.y + (ra - 0.5) * 84 * cmeFrac, 1.2 + rr * 2.2, 0, TAU);
      ctx.fill();
    }
    const vLabel = `CME · ${Math.round(S.vKmS).toLocaleString()} km/s`;
    ctx.fillStyle = "rgba(232,150,58,1)";
    ctx.font = "bold 12px ui-monospace, Menlo, monospace";
    ctx.fillText(vLabel, clamp(x - 46, AU_X0, AU_X1 - 120), SUN.y - 108);
    if (cmeFrac >= 1) {
      ctx.fillStyle = `rgba(232,150,58,${0.5 + 0.5 * rand(Math.floor(t * 12))})`;
      ctx.font = "bold 13px ui-monospace, Menlo, monospace";
      ctx.fillText("激波到达 · SSC", AU_X1 - 210, SUN.y - 152);
    }
  }

  // --- L1 sentinel ------------------------------------------------------------
  const l1x = auX(1 - 1.5e6 / P.AU_KM);
  ctx.fillStyle = "#8ce0ec";
  ctx.save(); ctx.translate(l1x, SUN.y - 44); ctx.rotate(Math.PI / 4);
  ctx.fillRect(-4, -4, 8, 8); ctx.restore();
  ctx.strokeStyle = "rgba(140,224,236,.35)";
  ctx.beginPath(); ctx.moveTo(l1x, SUN.y - 36); ctx.lineTo(l1x, SUN.y + 8); ctx.stroke();
  ctx.fillStyle = "rgba(140,224,236,.75)";
  ctx.font = "10.5px ui-monospace, Menlo, monospace";
  ctx.fillText("L1 哨兵 · 预警 " + P.l1WarningMinutes(S.vKmS).toFixed(1) + " 分钟", l1x - 70, SUN.y - 56);

  drawMagnetosphere(ctx, p, dst, E, t);

  // --- phase caption ----------------------------------------------------------
  ctx.fillStyle = "rgba(230,238,243,.85)";
  ctx.font = "13px -apple-system, PingFang SC, sans-serif";
  ctx.fillText(phaseText(t), 26, 44);

  drawMagnetogram(ctx, t);
}

function drawMagnetosphere(ctx, p, dst, E, t) {
  const { x: ex, y: ey } = EARTH;
  const r0 = clamp(P.standoffRe(p), 2.4, 13) * REpx; // dipole nose (px)
  const stormy = dst < -80;

  // bow shock
  ctx.strokeStyle = "rgba(232,150,58,.45)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(ex - r0 * 0.55, ey, r0 * 1.35, r0 * 1.5, 0, -Math.PI / 2.4, Math.PI / 2.4);
  ctx.stroke();

  // tail
  ctx.strokeStyle = "rgba(95,198,216,.28)";
  ctx.beginPath();
  ctx.moveTo(ex - r0 * 0.6, ey - r0 * 0.95);
  ctx.quadraticCurveTo(ex + 150, ey - r0 * 1.5, ex + 320, ey - r0 * 1.15);
  ctx.moveTo(ex - r0 * 0.6, ey + r0 * 0.95);
  ctx.quadraticCurveTo(ex + 150, ey + r0 * 1.5, ex + 320, ey + r0 * 1.15);
  ctx.stroke();

  // dipole field lines (before magnetopause so the boundary reads on top)
  ctx.strokeStyle = "rgba(95,198,216,.3)";
  ctx.lineWidth = 1.2;
  for (const L of [2.4, 4.4, 6.6]) {
    ctx.beginPath();
    for (let lam = -1.25; lam <= 1.25; lam += 0.06) {
      const r = L * Math.cos(lam) ** 2 * REpx;
      const px = ex - r * Math.sin(lam) * 0.9;
      const py = ey - r * Math.cos(lam);
      lam === -1.25 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let lam = -1.25; lam <= 1.25; lam += 0.06) {
      const r = L * Math.cos(lam) ** 2 * REpx;
      const px = ex + r * Math.sin(lam) * 0.9;
      const py = ey - r * Math.cos(lam);
      lam === -1.25 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // magnetopause teardrop (Shue-flavored, scaled to the dipole nose)
  ctx.strokeStyle = stormy ? "rgba(224,104,92,.95)" : "rgba(124,232,164,.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let a = -2.35; a <= 2.35; a += 0.08) {
    const rr = r0 * Math.pow(2 / (1 + Math.cos(a)), 0.55);
    const px = ex - rr * Math.cos(a);
    const py = ey - rr * Math.sin(a);
    a === -2.35 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();

  // GEO ring — red when the magnetopause is inside it
  const geoBreached = P.standoffRe(p) < P.GEO_RE;
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = geoBreached ? "rgba(224,104,92,.95)" : "rgba(140,224,236,.6)";
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(ex, ey, P.GEO_RE * REpx, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 6; i++) {
    const ga = (i / 6) * TAU + 0.3;
    ctx.fillStyle = geoBreached ? "rgba(224,104,92,.9)" : "rgba(140,224,236,.7)";
    ctx.fillRect(ex + Math.cos(ga) * P.GEO_RE * REpx - 2, ey + Math.sin(ga) * P.GEO_RE * REpx - 2, 4, 4);
  }
  ctx.fillStyle = geoBreached ? "rgba(239,141,129,.95)" : "rgba(140,224,236,.6)";
  ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.fillText("GEO 同步轨道 6.62 R_E" + (geoBreached ? " · 暴露！" : ""), ex + 18, ey - P.GEO_RE * REpx - 10);

  // ring current
  const rcStrength = clamp(Math.abs(dst) / 1760, 0, 1);
  if (rcStrength > 0.03) {
    ctx.strokeStyle = `rgba(224,104,92,${0.25 + 0.6 * rcStrength})`;
    ctx.lineWidth = 2 + rcStrength * 9;
    ctx.beginPath(); ctx.arc(ex, ey, 4.4 * REpx, Math.PI * 0.62, Math.PI * 1.38); ctx.stroke();
  }

  // Earth disc
  const eg = ctx.createRadialGradient(ex - 4, ey - 4, 1, ex, ey, REpx);
  eg.addColorStop(0, "#9fd7ef"); eg.addColorStop(0.6, "#3d7fa8"); eg.addColorStop(1, "#1d4666");
  ctx.fillStyle = eg;
  ctx.beginPath(); ctx.arc(ex, ey, REpx, 0, TAU); ctx.fill();

  // aurora ovals — rings of latitude Λ, projected schematically (pole tilted
  // toward the viewer): radius ρ = Re·cos(Λ), plane height z = Re·sin(Λ)
  const mlat = clamp(P.auroraMLat(dst), 18, 68);
  const oval = (latDeg, color, width, glow) => {
    const lat = (latDeg * Math.PI) / 180;
    const rho = REpx * 1.62 * Math.cos(lat);
    const z = REpx * 1.62 * Math.sin(lat);
    const b = Math.max(rho * 0.32, 1.6);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = glow; ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.ellipse(ex, ey - z, rho, b, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(ex, ey + z, rho, b, 0, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;
  };
  const auroraIntensity = clamp((62 - mlat) / 44, 0, 1);
  if (auroraIntensity > 0.02) {
    if (mlat < 40) oval(mlat + 5, `rgba(224,104,92,${0.55 * auroraIntensity})`, 5, "rgba(224,104,92,.8)");
    oval(mlat, `rgba(124,232,164,${0.35 + 0.6 * auroraIntensity})`, 3, "rgba(124,232,164,.9)");
  }
  ctx.fillStyle = "rgba(230,238,243,.85)";
  ctx.font = "11.5px ui-monospace, Menlo, monospace";
  ctx.fillText(`极光边界 Λ ≈ ${mlat.toFixed(0)}°`, ex - 250, ey + 132);
  ctx.fillText(`R_mp = ${P.standoffRe(p).toFixed(1)} R_E`, ex - 250, ey + 148);

  // telegraph-era sparks on the dayside ground
  if (E > 1.2) {
    const sparkN = Math.min(7, Math.floor(E / 2));
    for (let i = 0; i < sparkN; i++) {
      const rr = rand(i * 3.1 + Math.floor(t * 14));
      const ra = rand(i * 8.9 + Math.floor(t * 7));
      if (rr < 0.35) continue;
      const sx = ex - 6 + ra * 34, sy = ey + 12 + rr * 16;
      ctx.strokeStyle = `rgba(255,240,180,${0.35 + rr * 0.5})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 4 + rr * 6, sy - 5 - rr * 7);
      ctx.lineTo(sx + 8 + rr * 3, sy - 1);
      ctx.stroke();
    }
  }
}

function phaseText(t) {
  const ssc = sscH();
  if (t < P.STORM1_SSC - 0.5) return "Ⅰ · 宁静的太阳（黑子群一天天长大）";
  if (t < P.FLARE_H - 0.6) return "Ⅱ · 8 月 28 日的热身风暴已过，黑子群转向地球";
  if (Math.abs(t - P.FLARE_H) < 0.4) return "Ⅲ · 9 月 1 日 11:18 —— 白光耀斑！克乌的磁针同刻轻跳（磁钩）";
  if (t < ssc - 0.3) return "Ⅳ · 等待第二个信使：CME 在路上，还剩 " + ((ssc - t)).toFixed(1) + " 小时";
  if (t < ssc + 6) return "Ⅴ · 04:03 SSC · 主相崩溃：环电流灌满，极光南下";
  if (t < ssc + 26) return "Ⅵ · 第二夜：亚暴连发，波士顿—波特兰拆掉电池收发";
  if (t < 165) return "Ⅶ · 恢复相：环电流一滴一滴漏掉";
  return "· 重放结束 —— 拖动速度滑杆，换一个信使";
}

// --- the magnetogram strip ---------------------------------------------------
function drawMagnetogram(ctx, tNow) {
  const X0 = 70, X1 = 1620, Y0 = 700, Y1 = 950;
  const T0 = 0, T1 = 168;
  const ssc = sscH();
  const tx = (t) => X0 + ((t - T0) / (T1 - T0)) * (X1 - X0);
  const hy = (v) => Y1 - ((v + 1800) / 2000) * (Y1 - Y0);

  ctx.fillStyle = "#060a10";
  ctx.fillRect(0, 640, 1680, 360);
  ctx.fillStyle = "rgba(230,238,243,.75)";
  ctx.font = "bold 13px ui-monospace, Menlo, monospace";
  ctx.fillText("磁力仪 · 红山镇—克乌—科拉巴 合成曲线（参数化重放，锚点为真）", X0, 672);
  ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "rgba(140,163,179,.8)";
  ctx.fillText("H 分量（nT）", X0, 688);
  ctx.fillStyle = "rgba(232,150,58,.8)";
  ctx.fillText("动压 p（nPa，右轴）", 190, 688);

  // frame + grid
  ctx.strokeStyle = "rgba(50,73,94,.5)";
  ctx.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
  for (let d = 0; d <= 7; d++) {
    const x = tx(d * 24);
    ctx.strokeStyle = "rgba(50,73,94,.45)";
    ctx.beginPath(); ctx.moveTo(x, Y0); ctx.lineTo(x, Y1); ctx.stroke();
    ctx.fillStyle = "rgba(140,163,179,.75)";
    ctx.fillText(P.dayLabel(d * 24 + 0.1), x - 18, Y1 + 16);
  }
  for (const v of [0, -500, -1000, -1500]) {
    const y = hy(v);
    ctx.strokeStyle = "rgba(50,73,94,.3)";
    ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X1, y); ctx.stroke();
    ctx.fillStyle = "rgba(140,163,179,.7)";
    ctx.fillText(String(v), X0 - 40, y + 4);
  }

  // pressure trace (ember, right axis)
  ctx.strokeStyle = "rgba(232,150,58,.55)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let t = T0; t <= T1; t += 0.1) {
    const py = Y1 - clamp(P.pressureTrace(t, ssc) / 70, 0, 1) * (Y1 - Y0);
    t === T0 ? ctx.moveTo(tx(t), py) : ctx.lineTo(tx(t), py);
  }
  ctx.stroke();

  // H trace
  ctx.strokeStyle = "#8ce0ec";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let t = T0; t <= T1; t += 0.05) {
    const y = hy(P.dstTrace(t, ssc, S.depth));
    t === T0 ? ctx.moveTo(tx(t), y) : ctx.lineTo(tx(t), y);
  }
  ctx.stroke();

  // event flags
  const flags = [
    { t: P.STORM1_SSC, label: "8/28 19:26 风暴一", c: "rgba(140,224,236,.6)" },
    { t: P.FLARE_H, label: "9/1 11:18 白光耀斑 + 磁钩", c: "#f0c75e" },
    { t: ssc, label: "SSC 04:03", c: "#e8963a" },
    { t: ssc + 2.3, label: "科拉巴极小 ≈−1600", c: "#e0685c" },
    { t: ssc + 13.5, label: "9/2 第二夜", c: "rgba(224,104,92,.6)" },
  ];
  ctx.font = "10.5px ui-monospace, Menlo, monospace";
  flags.forEach((f, i) => {
    const x = tx(f.t);
    ctx.strokeStyle = f.c; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(x, Y0); ctx.lineTo(x, Y1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = f.c;
    ctx.fillText(f.label, clamp(x - 30, X0, X1 - 120), Y0 + 14 + (i % 2) * 13);
  });

  // cursor
  const cx = tx(clamp(tNow, T0, T1));
  ctx.strokeStyle = "#f2f6f8"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(cx, Y0); ctx.lineTo(cx, Y1); ctx.stroke();
  const hv = P.dstTrace(tNow, ssc, S.depth);
  ctx.fillStyle = "#f2f6f8";
  ctx.beginPath(); ctx.arc(cx, hy(hv), 3.4, 0, TAU); ctx.fill();
  ctx.font = "bold 12px ui-monospace, Menlo, monospace";
  ctx.fillText(`${P.dayLabel(tNow)} ${P.hhmm(tNow)} · ${hv >= 0 ? "+" : ""}${hv.toFixed(0)} nT`,
    clamp(cx + 8, X0, X1 - 190), Y0 - 8);
}

// ---------------------------------------------------------------------------
// the projection-screen card (zoom on the group)
// ---------------------------------------------------------------------------
function drawSpot() {
  const { ctx, w, h } = CV.spot;
  const fe = flareEnv(S.t);
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, R = 150;
  const g = ctx.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, R);
  g.addColorStop(0, "#fff3d6"); g.addColorStop(0.8, "#ffd98f"); g.addColorStop(1, "#f0ae55");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

  // Carrington's cross-hair grid
  ctx.strokeStyle = "rgba(120,70,20,.25)";
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(cx - R, cy + i * R / 5); ctx.lineTo(cx + R, cy + i * R / 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + i * R / 5, cy - R); ctx.lineTo(cx + i * R / 5, cy + R); ctx.stroke();
  }
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-0.19);
  for (const sp of SPOTS) {
    const px = sp.x * R * 1.6, py = sp.y * R * 1.6;
    if (Math.hypot(px, py) > R * 0.92) continue;
    ctx.fillStyle = "rgba(140,80,30,.5)";
    ctx.beginPath(); ctx.arc(px, py, sp.r * 1.55, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(22,11,5,.92)";
    ctx.beginPath(); ctx.arc(px, py, sp.r * 1.55 * sp.u, 0, TAU); ctx.fill();
  }
  if (fe > 0.01) {
    for (const k of KERNELS) {
      const px = k.x * R * 1.6, py = k.y * R * 1.6;
      const kg = ctx.createRadialGradient(px, py, 0, px, py, k.s * 2.4 * (0.8 + fe));
      kg.addColorStop(0, `rgba(255,255,255,${0.95 * fe})`);
      kg.addColorStop(1, "rgba(255,250,220,0)");
      ctx.fillStyle = kg;
      ctx.beginPath(); ctx.arc(px, py, k.s * 2.6 * (0.8 + fe), 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
  ctx.fillStyle = "rgba(60,34,10,.85)";
  ctx.font = "11.5px ui-monospace, Menlo, monospace";
  ctx.fillText(fe > 0.05 ? "✦ 白光耀斑进行中" : "11:18 前后 · 黑子群第 26 号", 14, h - 12);
}

// ---------------------------------------------------------------------------
// tab charts
// ---------------------------------------------------------------------------
function axes(ctx, box, xTicks, yTicks, xl, yl, logx = false, logy = false) {
  const { x0, y0, x1, y1 } = box;
  ctx.strokeStyle = "rgba(50,73,94,.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = "rgba(140,163,179,.85)";
  ctx.font = "10.5px ui-monospace, Menlo, monospace";
  for (const [v, lab] of xTicks) {
    const x = logx ? mapLog(v, box, "x") : mapLin(v, box, "x");
    ctx.strokeStyle = "rgba(50,73,94,.35)";
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.fillText(lab, x - 14, y1 + 15);
  }
  for (const [v, lab] of yTicks) {
    const y = logy ? mapLog(v, box, "y") : mapLin(v, box, "y");
    ctx.strokeStyle = "rgba(50,73,94,.35)";
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.fillText(lab, x0 - 38, y + 4);
  }
  ctx.fillStyle = "rgba(140,163,179,.9)";
  ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.fillText(xl, x1 - 60, y1 + 30);
  ctx.save();
  ctx.translate(x0 - 46, y0 + 64); ctx.rotate(-Math.PI / 2);
  ctx.fillText(yl, -30, 0);
  ctx.restore();
}
const BOX = { x0: 64, y0: 26, x1: 745, y1: 408 };
const mapLin = (v, b, ax) =>
  ax === "x" ? b.x0 + ((v - LIN.x0) / (LIN.x1 - LIN.x0)) * (b.x1 - b.x0)
             : b.y1 - ((v - LIN.y0) / (LIN.y1 - LIN.y0)) * (b.y1 - b.y0);
const mapLog = (v, b, ax) =>
  ax === "x" ? b.x0 + ((Math.log10(v) - LOG.x0) / (LOG.x1 - LOG.x0)) * (b.x1 - b.x0)
             : b.y1 - ((Math.log10(v) - LOG.y0) / (LOG.y1 - LOG.y0)) * (b.y1 - b.y0);
let LIN = { x0: 0, x1: 1, y0: 0, y1: 1 };
let LOG = { x0: 0, x1: 1, y0: 0, y1: 1 };

function drawRace() {
  const { ctx, w, h } = CV.race;
  ctx.clearRect(0, 0, w, h);
  LOG = { x0: Math.log10(300), x1: Math.log10(3200), y0: Math.log10(8), y1: Math.log10(150) };
  axes(ctx, BOX,
    [[300, "300"], [1000, "1000"], [3200, "3200 km/s"]],
    [[10, "10 h"], [30, "30 h"], [100, "100 h"]],
    "v (km/s)", "到达时间 t", true, true);
  ctx.strokeStyle = "#5fc6d8"; ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let v = 300; v <= 3200; v += 10) {
    const x = mapLog(v, BOX, "x"), y = mapLog(P.transitHours(v), BOX, "y");
    v === 300 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  // one-day line
  ctx.strokeStyle = "rgba(240,199,94,.5)"; ctx.setLineDash([4, 5]);
  const y24 = mapLog(24, BOX, "y");
  ctx.beginPath(); ctx.moveTo(BOX.x0, y24); ctx.lineTo(BOX.x1, y24); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(240,199,94,.85)";
  ctx.fillText("24 小时线：当天到货", BOX.x1 - 150, y24 - 6);
  // markers
  const marks = [
    [400, "慢太阳风 4.3 天", "#8aa3b2"],
    [750, "常规 CME 55 h", "#8aa3b2"],
    [1000, "1989 级 41.6 h", "#8ce0ec"],
    [P.CARRINGTON_V, "卡林顿 2,368 → 17.55 h", "#f0c75e"],
    [3000, "2012 擦肩 13.9 h", "#ef8d81"],
  ];
  ctx.font = "11px ui-monospace, Menlo, monospace";
  for (const [v, lab, c] of marks) {
    const x = mapLog(v, BOX, "x"), y = mapLog(P.transitHours(v), BOX, "y");
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill();
    ctx.fillText(lab, clamp(x - 34, BOX.x0, BOX.x1 - 160), y - 10);
  }
  ctx.fillStyle = "rgba(140,163,179,.75)";
  ctx.fillText("t = 1AU / v；光只要 0.14 h —— 在本图底边下方还有 60 倍", BOX.x0 + 30, BOX.y1 - 14);
  ctx.fillStyle = "#8ce0ec";
  ctx.font = "bold 12px ui-monospace, Menlo, monospace";
  ctx.fillText("t = D/v", BOX.x1 - 190, BOX.y0 + 20);
}

function drawL1() {
  const { ctx, w, h } = CV.l1;
  ctx.clearRect(0, 0, w, h);
  LOG = { x0: Math.log10(300), x1: Math.log10(3200), y0: 0, y1: 1 };
  LIN = { x0: 0, x1: 1, y0: 0, y1: 60 };
  axes(ctx, BOX,
    [[300, "300"], [1000, "1000"], [3200, "3200 km/s"]],
    [[0, "0"], [15, "15"], [30, "30"], [60, "60 min"]],
    "v (km/s)", "L1 预警", true, false);
  // the usual warning band
  const yA = mapLin(15, BOX, "y"), yB = mapLin(45, BOX, "y");
  ctx.fillStyle = "rgba(140,163,179,.10)";
  ctx.fillRect(BOX.x0, yA, BOX.x1 - BOX.x0, yB - yA);
  ctx.strokeStyle = "#e0685c"; ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let v = 300; v <= 3200; v += 10) {
    const x = mapLog(v, BOX, "x"), y = mapLin(P.l1WarningMinutes(v), BOX, "y");
    v === 300 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  const marks = [
    [P.CARRINGTON_V, "卡林顿级：10.6 分钟", "#f0c75e"],
    [3000, "3,000 km/s：8.3 分钟", "#ef8d81"],
  ];
  ctx.font = "11px ui-monospace, Menlo, monospace";
  for (const [v, lab, c] of marks) {
    const x = mapLog(v, BOX, "x"), y = mapLin(P.l1WarningMinutes(v), BOX, "y");
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill();
    ctx.fillText(lab, clamp(x - 60, BOX.x0, BOX.x1 - 170), y + 20);
  }
  ctx.fillStyle = "rgba(140,163,179,.8)";
  ctx.fillText("常规 CME 的预警带 15–45 分钟（灰区）", BOX.x0 + 30, BOX.y0 + 20);
  ctx.fillStyle = "#8ce0ec";
  ctx.font = "bold 12px ui-monospace, Menlo, monospace";
  ctx.fillText("预警 = L1/v = 1.5×10⁶ km / v", BOX.x1 - 260, BOX.y1 - 14);
}

function drawMag() {
  const { ctx, w, h } = CV.mag;
  ctx.clearRect(0, 0, w, h);
  LOG = { x0: Math.log10(0.3), x1: Math.log10(200), y0: Math.log10(2), y1: Math.log10(14) };
  axes(ctx, BOX,
    [[0.3, "0.3"], [1, "1"], [10, "10"], [100, "100 nPa"]],
    [[2, "2"], [4, "4"], [7, "7"], [10, "10 R_E"]],
    "动压 p", "磁层顶 r", true, true);
  // danger region r < GEO
  const yGeo = mapLog(P.GEO_RE, BOX, "y");
  ctx.fillStyle = "rgba(224,104,92,.08)";
  ctx.fillRect(BOX.x0, yGeo, BOX.x1 - BOX.x0, BOX.y1 - yGeo);
  ctx.strokeStyle = "rgba(240,199,94,.7)"; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(BOX.x0, yGeo); ctx.lineTo(BOX.x1, yGeo); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(240,199,94,.9)";
  ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.fillText("GEO 6.62 R_E —— 下方即裸奔区", BOX.x0 + 220, yGeo + 15);

  ctx.strokeStyle = "#5fc6d8"; ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let p = 0.3; p <= 200; p *= 1.02) {
    const x = mapLog(p, BOX, "x"), y = mapLog(P.standoffRe(p), BOX, "y");
    p === 0.3 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // the exact 64× → ½ bracket
  const x1 = mapLog(1.6, BOX, "x"), y1v = mapLog(P.standoffRe(1.6), BOX, "y");
  const x2 = mapLog(1.6 * 64, BOX, "x"), y2v = mapLog(P.standoffRe(1.6 * 64), BOX, "y");
  ctx.strokeStyle = "#f0c75e"; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x1, y1v); ctx.lineTo(x2, y1v); ctx.lineTo(x2, y2v);
  ctx.stroke();
  ctx.fillStyle = "#f0c75e";
  ctx.fillText("×64 ⇒ ÷2（精确）", x1 + 40, (y1v + y2v) / 2 - 8);
  ctx.fillText("p = 1.6", x1 - 24, y1v - 8);
  ctx.fillText("102", x2 - 12, y1v - 8);

  // GEO crossing marker
  const xg = mapLog(P.P_AT_GEO, BOX, "x");
  ctx.strokeStyle = "rgba(239,141,129,.6)";
  ctx.beginPath(); ctx.moveTo(xg, BOX.y0); ctx.lineTo(xg, yGeo); ctx.stroke();
  ctx.fillStyle = "#ef8d81";
  ctx.fillText("≈4.4 nPa：偶极模型下 GEO 开始裸奔", xg - 120, BOX.y0 + 32);
  ctx.fillStyle = "#8ce0ec";
  ctx.font = "bold 12px ui-monospace, Menlo, monospace";
  ctx.fillText("r = (µ₀M²/32π²p)^⅙", BOX.x1 - 200, BOX.y0 + 20);
}

function drawMagS() {
  const { ctx, w, h } = CV.magS;
  ctx.clearRect(0, 0, w, h);
  const drawOne = (ex, ey, p, label, color) => {
    const r0 = P.standoffRe(p) * 13;
    ctx.strokeStyle = "rgba(232,150,58,.4)";
    ctx.beginPath();
    ctx.ellipse(ex - r0 * 0.5, ey, r0 * 1.3, r0 * 1.45, 0, -1.2, 1.2);
    ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = -2.3; a <= 2.3; a += 0.08) {
      const rr = r0 * Math.pow(2 / (1 + Math.cos(a)), 0.55);
      const px = ex - rr * Math.cos(a), py = ey - rr * Math.sin(a);
      a === -2.3 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(140,224,236,.55)";
    ctx.beginPath(); ctx.arc(ex, ey, P.GEO_RE * 13, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    const eg = ctx.createRadialGradient(ex - 3, ey - 3, 1, ex, ey, 12);
    eg.addColorStop(0, "#9fd7ef"); eg.addColorStop(1, "#1d4666");
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(ex, ey, 12, 0, TAU); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const ga = (i / 8) * TAU;
      const out = P.standoffRe(p) < P.GEO_RE;
      ctx.fillStyle = out ? "#e0685c" : "rgba(140,224,236,.75)";
      ctx.fillRect(ex + Math.cos(ga) * P.GEO_RE * 13 - 2, ey + Math.sin(ga) * P.GEO_RE * 13 - 2, 4, 4);
    }
    ctx.fillStyle = "rgba(230,238,243,.85)";
    ctx.font = "12px ui-monospace, Menlo, monospace";
    ctx.fillText(label, ex - 70, ey + 118);
  };
  drawOne(210, 210, 1.6, "宁静 p = 1.6 nPa · r ≈ 7.9 R_E", "rgba(124,232,164,.9)");
  drawOne(560, 210, 64, "卡林顿级 p ≈ 64 nPa · r ≈ 4.2 R_E", "rgba(224,104,92,.95)");
  ctx.fillStyle = "rgba(140,163,179,.8)";
  ctx.font = "11.5px ui-monospace, Menlo, monospace";
  ctx.fillText("虚线 = GEO；风暴侧的方块卫星泡在太阳风里（纯偶极账，实际边界再外推 ~30%）", 60, 388);
}

function drawRing() {
  const { ctx, w, h } = CV.ring;
  ctx.clearRect(0, 0, w, h);
  const X0 = 150, X1 = 730;
  const rows = P.STORMS;
  const rowH = 58, y0 = 40;
  ctx.strokeStyle = "rgba(50,73,94,.7)";
  ctx.beginPath(); ctx.moveTo(X0, y0 - 12); ctx.lineTo(X0, y0 + rows.length * rowH - 10); ctx.stroke();
  ctx.font = "11.5px ui-monospace, Menlo, monospace";
  rows.forEach((st, i) => {
    const y = y0 + i * rowH;
    const frac = Math.abs(st.dst) / 1800;
    const bw = (X1 - X0) * frac;
    const est = st.missed || st.dstRange[0] !== st.dstRange[1];
    ctx.fillStyle = st.id === "1859" ? "rgba(217,169,63,.85)" : st.missed ? "rgba(224,104,92,.18)" : "rgba(95,198,216,.55)";
    if (st.missed) {
      ctx.strokeStyle = "rgba(224,104,92,.8)";
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(X0, y, bw, 26);
      ctx.setLineDash([]);
    } else {
      ctx.fillRect(X0, y, bw, 26);
      if (st.dstRange[0] !== st.dstRange[1]) {
        const bw2 = (X1 - X0) * Math.abs(st.dstRange[0]) / 1800;
        ctx.strokeStyle = "rgba(240,199,94,.8)";
        ctx.strokeRect(X0, y, bw2, 26);
      }
    }
    ctx.fillStyle = "rgba(230,238,243,.9)";
    ctx.textAlign = "right";
    ctx.fillText(`${st.date} ${st.cn}`, X0 - 12, y + 18);
    ctx.textAlign = "left";
    ctx.fillStyle = st.missed ? "#ef8d81" : "rgba(230,238,243,.92)";
    ctx.fillText(`${st.dst} nT`, X0 + 8, y + 18);
    const E = P.ringEnergyJ(st.dst);
    const hi = P.ringHiroshimas(st.dst);
    ctx.fillStyle = "rgba(140,163,179,.9)";
    ctx.fillText(`E ≈ ${(E / 1e16).toFixed(1)}×10¹⁶ J ≈ ${Math.round(hi).toLocaleString()} 颗广岛`, X0 + 92, y + 18);
    ctx.fillStyle = "rgba(93,116,134,.9)";
    ctx.font = "10.5px ui-monospace, Menlo, monospace";
    ctx.fillText(st.note, X0 + 8, y + 40);
    ctx.font = "11.5px ui-monospace, Menlo, monospace";
  });
  // scale ticks
  for (const v of [0, 600, 1200, 1800]) {
    const x = X0 + ((X1 - X0) * v) / 1800;
    ctx.strokeStyle = "rgba(50,73,94,.4)";
    ctx.beginPath(); ctx.moveTo(x, y0 - 12); ctx.lineTo(x, y0 + rows.length * rowH - 10); ctx.stroke();
    ctx.fillStyle = "rgba(140,163,179,.7)";
    ctx.fillText(String(v), x - 14, y0 - 20);
  }
  ctx.fillStyle = "#8ce0ec";
  ctx.font = "bold 12px ui-monospace, Menlo, monospace";
  ctx.fillText("E ≈ 4×10¹³ J × |Dst|", X1 - 190, y0 + rows.length * rowH + 6);
}

// ---------------------------------------------------------------------------
// the wire bench: V = E·L, I = V/R
// ---------------------------------------------------------------------------
const WIRE_PRESETS = {
  p1859: { e: 2, l: 170, r: 1850, note: "1859 波士顿—波特兰铁线：E≈2 V/km（推定，标定自 1989 缅因）、L≈170 km、R≈1.85 kΩ → 约 184 mA。恰好是继电器的胃口：拆电池，用极光收发。" },
  p1989: { e: 21.66, l: 300, r: 60, note: "1989-03-13 缅因实测 E = 21.66 V/km（1 分钟峰值，Love 2022）。300 km 高压走廊、回路 ≈60 Ω → 108 A 准直流灌入变压器中性点。魁北克 735 kV 电网 92 秒内崩溃。" },
  p2003: { e: 4, l: 400, r: 50, note: "2003 万圣节：南非电网 E≈4 V/km 级——电流不大，但持续烘烤；一个月内多台大型变压器烧损退役。GIC 的第二种杀伤：慢性加热。" },
  p2024: { e: 6, l: 300, r: 60, note: "2024-05-10 盖农风暴：美加电网测到 30–80 A 级 GIC；调度提前减载、互备。同量级的风暴，学过课的电网把它扛过去了。" },
};
function wireVerdict(I) {
  if (I < 0.02) return ["静默：电池照常供电，磁针安睡", "rgba(140,224,236,.9)"];
  if (I < 0.1) return ["干扰：假信号串线（1859 年最常见的报修）", "rgba(240,199,94,.95)"];
  if (I < 0.4) return ["拆掉电池也能收发 —— 波士顿—波特兰模式", "#f0c75e"];
  if (I < 30) return ["电键打火花、避雷器放炮（有电报办公室起火）", "#ef8d81"];
  if (I < 100) return ["电网危险区：SVC 连锁跳闸（魁北克 92 秒）", "#e0685c"];
  return ["变压器半波饱和 · 烧损区（1989/2003 的真实账单）", "#e0685c"];
}
function drawWire(now) {
  const { ctx, w, h } = CV.wire;
  const W = S.wire;
  const V = P.gicVolts(W.e, W.l);
  const I = V / W.r;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#060a10"; ctx.fillRect(0, 0, w, h);

  const wireY = 210;
  const batX = 90, keyX = 330, sndX = 520, galX = 650;
  // the line, on poles
  ctx.strokeStyle = "rgba(140,163,179,.8)"; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(batX, wireY - 60); ctx.lineTo(keyX - 40, wireY - 60);
  ctx.lineTo(keyX, wireY - 40); ctx.lineTo(sndX, wireY - 60); ctx.lineTo(galX, wireY - 60);
  ctx.stroke();
  for (let px = 70; px < 740; px += 90) {
    ctx.strokeStyle = "rgba(90,116,134,.7)";
    ctx.beginPath(); ctx.moveTo(px, wireY - 60); ctx.lineTo(px, 290); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px - 8, 290); ctx.lineTo(px + 8, 290); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(140,163,179,.25)";
  ctx.beginPath(); ctx.moveTo(0, 292); ctx.lineTo(w, 292); ctx.stroke();

  // battery + knife switch
  ctx.strokeStyle = "#f0c75e"; ctx.lineWidth = 2.5;
  const bOn = !W.batteryOff;
  ctx.beginPath(); ctx.moveTo(batX, wireY - 90); ctx.lineTo(batX, wireY - 60); ctx.stroke();
  if (bOn) {
    ctx.beginPath(); ctx.moveTo(batX - 16, wireY - 90); ctx.lineTo(batX + 16, wireY - 90); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(batX - 8, wireY - 102); ctx.lineTo(batX + 8, wireY - 102); ctx.stroke();
    ctx.lineWidth = 2.5;
  } else {
    ctx.strokeStyle = "rgba(240,199,94,.5)";
    ctx.beginPath(); ctx.moveTo(batX, wireY - 90); ctx.lineTo(batX + 22, wireY - 112); ctx.stroke();
  }
  ctx.fillStyle = bOn ? "rgba(240,199,94,.9)" : "rgba(140,163,179,.7)";
  ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.fillText(bOn ? "电池（合）" : "电池已断开", batX - 26, wireY + 26);

  // the key
  ctx.strokeStyle = "#8ce0ec";
  ctx.beginPath(); ctx.moveTo(keyX - 30, wireY - 20); ctx.lineTo(keyX + 30, wireY - 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(keyX, wireY - 20); ctx.lineTo(keyX, wireY - 42); ctx.lineTo(keyX + 26, wireY - 54); ctx.stroke();
  ctx.beginPath(); ctx.arc(keyX + 30, wireY - 55, 3, 0, TAU); ctx.stroke();
  ctx.fillStyle = "rgba(140,224,236,.8)";
  ctx.fillText("电键", keyX - 12, wireY + 26);

  // sounder (electromagnet + armature)
  const working = I > 0.05 || (bOn && true);
  ctx.strokeStyle = "#8ce0ec";
  ctx.strokeRect(sndX - 24, wireY - 52, 48, 26);
  ctx.beginPath(); ctx.moveTo(sndX - 10, wireY - 52); ctx.lineTo(sndX - 10, wireY - 76);
  ctx.lineTo(sndX + 10, wireY - 76); ctx.lineTo(sndX + 10, wireY - 52); ctx.stroke();
  const clickUp = working && Math.sin(now * 9) > 0;
  ctx.strokeStyle = clickUp ? "#f0c75e" : "#8aa3b2";
  ctx.beginPath(); ctx.moveTo(sndX - 18, wireY - 80); ctx.lineTo(sndX + 18, wireY - 84 + (clickUp ? 0 : 8)); ctx.stroke();
  ctx.fillStyle = "rgba(140,224,236,.8)";
  ctx.fillText("继电器", sndX - 24, wireY + 26);

  // galvanometer with needle
  ctx.strokeStyle = "rgba(140,224,236,.8)";
  ctx.beginPath(); ctx.arc(galX, wireY - 100, 34, Math.PI, TAU); ctx.stroke();
  const needle = clamp(Math.log10(Math.max(I, 1e-4) / 1e-4) / 4.6, 0, 1); // 0.1 mA .. 3 kA
  const ang = Math.PI + needle * Math.PI;
  ctx.strokeStyle = needle > 0.62 ? "#e0685c" : "#f0c75e"; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(galX, wireY - 100);
  ctx.lineTo(galX + Math.cos(ang) * 30, wireY - 100 + Math.sin(ang) * 30);
  ctx.stroke();
  ctx.fillStyle = "rgba(140,224,236,.8)";
  ctx.font = "10.5px ui-monospace, Menlo, monospace";
  ctx.fillText("0.1mA", galX - 52, wireY - 92);
  ctx.fillText("3kA", galX + 34, wireY - 92);

  // sparks at the key when I > 0.4 A
  if (I > 0.4) {
    for (let i = 0; i < 5; i++) {
      const rr = rand(i * 4.4 + Math.floor(now * 16));
      if (rr < 0.3) continue;
      ctx.strokeStyle = `rgba(255,240,180,${rr})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(keyX + 28, wireY - 56);
      ctx.lineTo(keyX + 30 + rr * 16, wireY - 50 - rr * 24);
      ctx.stroke();
    }
  }

  // current dots
  const dotSpeed = clamp(Math.log10(Math.max(I, 1e-3) * 1e3) * 26 + 12, 10, 150);
  const nDots = clamp(Math.round(Math.log10(Math.max(I, 1e-4) * 1e4) * 5) + 2, 2, 14);
  for (let i = 0; i < nDots; i++) {
    const u = ((now * dotSpeed + i * 97) % 640) / 640;
    const x = batX + u * (galX - batX);
    ctx.fillStyle = "rgba(240,199,94,.9)";
    ctx.beginPath(); ctx.arc(x, wireY - 64 - Math.sin(u * Math.PI) * 8, 2.4, 0, TAU); ctx.fill();
  }

  // headline numbers
  ctx.fillStyle = "rgba(230,238,243,.95)";
  ctx.font = "bold 15px ui-monospace, Menlo, monospace";
  ctx.fillText(`V = E·L = ${W.e.toFixed(2)} V/km × ${W.l.toFixed(0)} km = ${V.toFixed(0)} V`, 24, 40);
  const [verdict, vc] = wireVerdict(I);
  ctx.fillStyle = vc;
  ctx.font = "bold 14px ui-monospace, Menlo, monospace";
  ctx.fillText(`I = V/R = ${(I >= 1 ? I.toFixed(1) + " A" : (I * 1000).toFixed(0) + " mA")}  →  ${verdict}`, 24, 66);
  if (W.batteryOff && I > 0.05) {
    ctx.fillStyle = "#f0c75e";
    ctx.font = "bold 12.5px ui-monospace, Menlo, monospace";
    ctx.fillText("✦ 「已断开……我们完全用极光电流收发。」— 1859.9.2", 24, 330);
  }
}
function drawWireStatic() {
  const W = S.wire;
  const V = P.gicVolts(W.e, W.l);
  const I = V / W.r;
  $("we-out").textContent = `${W.e.toFixed(2)} V/km`;
  $("wl-out").textContent = `${W.l.toFixed(0)} km`;
  $("wr-out").textContent = `${W.r < 10 ? W.r.toFixed(1) : W.r.toFixed(0)} Ω`;
  $("wy-v").textContent = `${V >= 1000 ? (V / 1000).toFixed(1) + " kV" : V.toFixed(1) + " V"}`;
  $("wy-i").textContent = I >= 1 ? `${I.toFixed(1)} A` : `${(I * 1000).toFixed(0)} mA`;
  const [verdict] = wireVerdict(I);
  $("wy-verdict").textContent = verdict;
  $("wire-note").textContent = WIRE_PRESETS[W.preset].note;
}

// ---------------------------------------------------------------------------
// readouts, controls, presets
// ---------------------------------------------------------------------------
function updateReadouts() {
  const t = S.t;
  const { dst, p, dho } = sceneTraces(t);
  const ssc = sscH();
  const trans = P.transitHours(S.vKmS);
  $("ro-ssc").innerHTML = `${P.dayLabel(ssc)} ${P.hhmm(ssc)}<small>+${trans < 48 ? trans.toFixed(1) + " h" : (trans / 24).toFixed(1) + " 天"}</small>`;
  const rmp = P.standoffRe(p);
  const roRmp = $("ro-rmp");
  roRmp.innerHTML = `${rmp.toFixed(1)} R_E<small>${rmp < P.GEO_RE ? "GEO 暴露" : "GEO 安全"}</small>`;
  roRmp.style.color = rmp < P.GEO_RE ? "var(--red2)" : "";
  $("ro-mlat").innerHTML = `${clamp(P.auroraMLat(dst), 18, 68).toFixed(0)}°<small>${dst < -800 ? "古巴见！" : dst < -300 ? "美国南部" : "极圈"}</small>`;
  const E = eNow(dho);
  $("ro-e").innerHTML = `${E.toFixed(1)} V/km<small>${E > 15 ? "电网警报" : E > 4 ? "电报火花" : E > 1 ? "拆电池档" : "安静"}</small>`;
  $("t-out").textContent = `${P.dayLabel(t)} ${P.hhmm(t)}`;
  $("v-out").textContent = `${Math.round(S.vKmS).toLocaleString()} km/s → ${trans < 48 ? trans.toFixed(1) + " 小时" : (trans / 24).toFixed(1) + " 天"}`;
  $("d-out").textContent = `−${S.depth} nT`;
  $("sp-out").textContent = `${S.speed} h/s`;
  $("y-dst").textContent = `${dst >= 0 ? "+" : ""}${dst.toFixed(0)} nT`;
  $("y-p").textContent = `${p.toFixed(1)} nPa`;
  $("y-dho").textContent = `${dho.toFixed(0)} nT/hr`;
  const gic1859 = P.gicAmps(Math.min(E, 3), P.LINE_1859.lKm, P.LINE_1859.rOhms) * 1000;
  $("y-gic").textContent = `${gic1859.toFixed(0)} mA${gic1859 > 100 ? " · 电池可拆" : ""}`;
  const chip = $("phase-chip");
  const alert = t >= ssc && t < ssc + 6;
  const flareNow = t >= P.FLARE_H - 0.2 && t < P.FLARE_H + 0.4;
  chip.textContent = (alert ? "⚠ " : "○ ") + phaseText(t).replace(/^[^·]+·\s*/, "");
  chip.className = "chip" + (alert ? " alert" : flareNow ? " on" : "");
  $("t-range").value = t;
}

function loadPreset(id) {
  const pr = P.PRESETS.find((p) => p.id === id);
  if (!pr) return;
  S.vKmS = pr.vKmS; S.depth = pr.depth;
  S.t = P.CME_LAUNCH_H - 2; S.playing = true;
  $("v-range").value = S.vKmS;
  $("d-range").value = S.depth;
  $("play-btn").textContent = "⏸ 暂停";
  for (const b of document.querySelectorAll("#presets button")) {
    b.classList.toggle("on", b.dataset.preset === id);
  }
}
function setTab(id) {
  S.tab = id;
  for (const b of document.querySelectorAll("#tabs button[data-tab]")) {
    b.classList.toggle("on", b.dataset.tab === id);
  }
  for (const body of document.querySelectorAll(".tab-body")) {
    body.classList.toggle("hidden", body.id !== `tab-${id}`);
  }
  drawTabCharts();
  const notes = {
    race: "光带来 11:18 的磁钩，等离子体带来第二天的风暴",
    mag: "压力 ×64，距离才 ÷2 —— 第六根的宽容",
    ring: "Dst 不只是强度，是一张能量账单",
    wire: "同一条公式，不同的电阻，两个时代的故事",
    hist: "不是会不会再来，是下一次轮到哪一代电网",
  };
  $("tab-note").textContent = notes[id] ?? "";
}
function drawTabCharts() {
  if (S.tab === "race") { drawRace(); drawL1(); }
  if (S.tab === "mag") { drawMag(); drawMagS(); }
  if (S.tab === "ring") drawRing();
}

const TIMELINE = [
  { when: "1859-08-28 → 09-01", what: "大黑子群横穿日面 —— 直径约为日面 9%，日落时<b>肉眼可见</b>；卡林顿每天投影描图", cls: "" },
  { when: "1859-09-01 11:18", what: "<b>白光耀斑</b>：两团白光在黑子上方生成、移动、五分钟熄灭；克乌磁针同刻轻跳（磁钩 ≈110 nT）", cls: "big" },
  { when: "1859-09-02 04:03", what: "SSC。主相崩溃：科拉巴（孟买）读出 ≈<b>−1600 nT</b>；极光烧到 18°，哈瓦那、檀香之南皆见红光；全球电报紊乱", cls: "big" },
  { when: "1859-09-03 →", what: "恢复相持续多日。卡林顿终生谨慎：他只说「两件事同时发生，未必互为因果」——他猜中了方向，也立了规矩", cls: "" },
  { when: "1921-05-13", what: "纽约铁路风暴（Dst 约 −907）：纽约中央铁路信号站起火，瑞典电话网瘫痪", cls: "" },
  { when: "1957 →", what: "国际地球物理年与太空时代：磁力仪台网、Dst 指数、卫星监测成为常规", cls: "" },
  { when: "1989-03-13", what: "魁北克风暴（Dst −589，缅因实测 21.66 V/km）：<b>600 万人停电 9 小时</b>，电网时代的第一次警告", cls: "" },
  { when: "2003-10-29", what: "万圣节风暴（−383）：极光进佛罗里达；南非变压器慢性烧损；极区航线改道", cls: "" },
  { when: "2012-07-23", what: "<b>擦肩而过</b>：约 3,000 km/s 的卡林顿级 CME 穿过地球轨道——地球差 9 天不在家。Baker 等：正面命中约 2 万亿美元损失", cls: "miss" },
  { when: "2024-05-10", what: "盖农风暴（Dst −412，SYM-H −518）：32 年最强，波多黎各拍到极光；电网提前减载、基本无恙", cls: "" },
  { when: "2026-09-01 · 今天", what: "L1 哨兵（ACE、DSCOVR）对卡林顿级只有 <b>≈11 分钟</b>；真正的防线是 167 年攒下的公式、储备变压器、和演练过的调度", cls: "" },
];

function buildDOM() {
  const presets = $("presets");
  for (const pr of P.PRESETS) {
    const b = document.createElement("button");
    b.textContent = pr.label;
    b.title = pr.note;
    b.dataset.preset = pr.id;
    if (pr.id === "replay1859") b.classList.add("on");
    b.addEventListener("click", () => loadPreset(pr.id));
    presets.appendChild(b);
  }
  const tl = $("tl");
  for (const it of TIMELINE) {
    const div = document.createElement("div");
    div.className = `tl-item ${it.cls}`;
    div.innerHTML = `<div class="when">${it.when}</div><div class="what">${it.what}</div>`;
    tl.appendChild(div);
  }
  for (const b of document.querySelectorAll("#tabs button[data-tab]")) {
    b.addEventListener("click", () => setTab(b.dataset.tab));
  }
  $("play-btn").addEventListener("click", () => {
    S.playing = !S.playing;
    $("play-btn").textContent = S.playing ? "⏸ 暂停" : "▶ 播放 1859";
  });
  $("now-btn").addEventListener("click", () => {
    S.t = P.FLARE_H - 0.1; S.playing = true;
    $("play-btn").textContent = "⏸ 暂停";
  });
  $("t-range").addEventListener("input", (e) => {
    S.t = +e.target.value; S.playing = false;
    $("play-btn").textContent = "▶ 播放 1859";
  });
  $("v-range").addEventListener("input", (e) => { S.vKmS = +e.target.value; });
  $("d-range").addEventListener("input", (e) => { S.depth = +e.target.value; });
  $("sp-range").addEventListener("input", (e) => { S.speed = +e.target.value; });

  // wire controls
  const weR = $("we-range"), wlR = $("wl-range"), wrR = $("wr-range");
  weR.value = Math.log10(S.wire.e); wlR.value = Math.log10(S.wire.l); wrR.value = Math.log10(S.wire.r);
  const wireSliders = () => {
    S.wire.e = 10 ** +weR.value; S.wire.l = 10 ** +wlR.value; S.wire.r = 10 ** +wrR.value;
    S.wire.preset = "";
    for (const b of document.querySelectorAll("[data-wire]")) b.classList.remove("on");
    drawWireStatic();
  };
  weR.addEventListener("input", wireSliders);
  wlR.addEventListener("input", wireSliders);
  wrR.addEventListener("input", wireSliders);
  for (const b of document.querySelectorAll("[data-wire]")) {
    b.addEventListener("click", () => {
      const pr = WIRE_PRESETS[b.dataset.wire];
      S.wire.preset = b.dataset.wire;
      S.wire.e = pr.e; S.wire.l = pr.l; S.wire.r = pr.r;
      if (b.dataset.wire === "p1859") S.wire.batteryOff = true; else S.wire.batteryOff = false;
      weR.value = Math.log10(pr.e); wlR.value = Math.log10(pr.l); wrR.value = Math.log10(pr.r);
      for (const bb of document.querySelectorAll("[data-wire]")) bb.classList.remove("on");
      b.classList.add("on");
      drawWireStatic();
    });
  }
  drawWireStatic();
}

// ---------------------------------------------------------------------------
// main loop
// ---------------------------------------------------------------------------
let last = performance.now();
function frame(nowMs) {
  const dt = Math.min(0.1, (nowMs - last) / 1000);
  last = nowMs;
  if (S.playing) {
    S.t = clamp(S.t + dt * S.speed, 0, 168);
    if (S.t >= 168) S.playing = false;
  }
  drawBench();
  drawSpot();
  if (S.tab === "wire") drawWire(nowMs / 1000);
  updateReadouts();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// the __demo API (video recording + tests drive the studio through here)
// ---------------------------------------------------------------------------
window.__demo = {
  step(dt) {
    S.t = clamp(S.t + dt, 0, 168);
  },
  play() { S.playing = true; },
  pause() { S.playing = false; },
  seek(t) { S.t = clamp(t, 0, 168); },
  setParam(key, value) {
    if (key === "vKmS") { S.vKmS = clamp(value, 300, 3000); $("v-range").value = S.vKmS; }
    if (key === "depth") { S.depth = clamp(value, 300, 2000); $("d-range").value = S.depth; }
    if (key === "speed") S.speed = value;
    if (key === "wireE") { S.wire.e = value; S.wire.preset = ""; $("we-range").value = Math.log10(value); drawWireStatic(); }
    if (key === "wireL") { S.wire.l = value; S.wire.preset = ""; $("wl-range").value = Math.log10(value); drawWireStatic(); }
    if (key === "wireR") { S.wire.r = value; S.wire.preset = ""; $("wr-range").value = Math.log10(value); drawWireStatic(); }
    if (key === "batteryOff") { S.wire.batteryOff = !!value; }
  },
  loadPreset,
  setTab,
  setWirePreset(id) {
    const b = document.querySelector(`[data-wire="${id}"]`);
    if (b) b.click();
  },
  setVideoMode(on) { S.videoMode = !!on; },
  scrollToBench() {
    document.querySelector(".bench-card").scrollIntoView({ block: "start" });
    window.scrollBy(0, -8);
  },
  scrollToTabs() {
    const el = document.querySelector(".tabs-card");
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 12);
  },
};

// boot
setupCanvases();
buildDOM();
setTab("race");
requestAnimationFrame(frame);
