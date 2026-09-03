// app.js — Pearl Street 110 · 铜的一万倍
// All numbers come from physics.js; this file only draws and wires sliders.

import {
  RHO_CU, CU_DENSITY,
  lampFlux, lampLife, lampPower, lampCurrent, loadCurrent,
  wireArea, wireDiameter, copperMass, feederSteps,
  lossFraction, efficiency, reachPoint,
  dropPointLoad, dropDistributed,
  PEARL_V, PEARL_dV, PEARL_L, PEARL_P, JUMBO_T,
  LAMPS_FULL, LAMPS_W, PEARL_A,
  PRESETS, LINES, EVENTS,
} from "./physics.js";

// ── tiny helpers ─────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const fmt = (x, d = 0) => x.toLocaleString("en-US", {
  minimumFractionDigits: d, maximumFractionDigits: d,
});

function fmtKg(kg) {
  if (kg >= 1000) return `${fmt(kg / 1000, kg >= 1e5 ? 0 : 1)} t`;
  if (kg >= 1) return `${fmt(kg, kg >= 100 ? 0 : 1)} kg`;
  return `${fmt(kg * 1000, 0)} g`;
}

function fmtKm(m) {
  if (m >= 1000) return `${fmt(m / 1000, m >= 1e5 ? 0 : 1)} km`;
  return `${fmt(m, m >= 100 ? 0 : 1)} m`;
}

// slider 0..1000 → log-uniform between min and max
const LOG_MIN = 0, LOG_MAX = 1000;
function sliderToLog(el, min, max) {
  return min * Math.pow(max / min, el.value / LOG_MAX);
}
function logToSlider(value, min, max) {
  return Math.round((LOG_MAX * Math.log(value / min)) / Math.log(max / min));
}

const dVfromEta = (V, eta) => V * (1 / eta - 1);

// ── state ────────────────────────────────────────────────────
const COPPER_P_RANGE = [1e4, 1.2e10];
const COPPER_L_RANGE = [100, 3.5e6];
const COPPER_V_RANGE = [110, 1.2e6];

const state = {
  copper: { P: PEARL_P, L: PEARL_L, V: PEARL_V, eta: efficiency(PEARL_dV, PEARL_V) },
  street: { lamps: 400, mode: "end", switched: false, t: 0 },
  lamp: { R: PEARL_V * PEARL_V / LAMPS_W, ratio: 1 },
  reach: { scale: 1, line: 0 },
  event: 0,
  videoMode: false,
};

// ── tabs & presets ───────────────────────────────────────────
function setTab(id) {
  for (const b of document.querySelectorAll("#tabs button")) {
    b.classList.toggle("on", b.dataset.tab === id);
  }
  for (const s of document.querySelectorAll("main > section")) {
    s.classList.toggle("on", s.id === `tab-${id}`);
  }
}

for (const b of document.querySelectorAll("#tabs button")) {
  b.addEventListener("click", () => setTab(b.dataset.tab));
}

function scrollToTop() {
  window.scrollTo(0, 0);
}

function buildPresets() {
  const host = $("presets");
  PRESETS.forEach((p, i) => {
    const b = document.createElement("button");
    b.textContent = p.label;
    b.dataset.i = i;
    b.addEventListener("click", () => selectPreset(i));
    host.appendChild(b);
  });
}

function selectPreset(i) {
  const p = PRESETS[i];
  state.copper = {
    P: p.P, L: p.L, V: p.V, eta: efficiency(p.dV, p.V),
  };
  syncCopperSliders();
  setTab("copper");
  scrollToTop();
  renderCopper();
  for (const b of $("presets").children) {
    b.classList.toggle("on", Number(b.dataset.i) === i);
  }
}

function syncCopperSliders() {
  const c = state.copper;
  $("s-p").value = logToSlider(c.P, ...COPPER_P_RANGE);
  $("s-l").value = logToSlider(c.L, ...COPPER_L_RANGE);
  $("s-v").value = logToSlider(c.V, ...COPPER_V_RANGE);
  $("s-eta").value = Math.round(c.eta * 1000) / 10;
}

// ── 1 · copper tab ───────────────────────────────────────────
function copperDerived() {
  const { P, L, V, eta } = state.copper;
  const dV = dVfromEta(V, eta);
  const A = wireArea(P, L, V, dV);
  const steps = feederSteps(P, L, V, dV);
  return { P, L, V, eta, dV, A, steps, mass: copperMass(P, L, V, dV) };
}

function renderCopper() {
  const d = copperDerived();
  const tons = d.mass / 1000;

  if (tons >= 1) {
    $("copper-mass").textContent = fmt(tons, tons >= 100 ? 0 : 1);
    $("copper-mass-unit").textContent = "吨铜";
  } else {
    $("copper-mass").textContent = fmt(d.mass, d.mass < 10 ? 2 : 1);
    $("copper-mass-unit").textContent = "kg 铜";
  }
  const jumboRatio = d.mass / 1000 / JUMBO_T;
  $("copper-compare").textContent =
    jumboRatio >= 0.3
      ? `≈ ${jumboRatio.toFixed(1)} 台巨象发电机`
      : `≈ 巨象发电机的 ${(jumboRatio * 100).toFixed(jumboRatio < 0.01 ? 3 : 1)}%`;
  $("copper-area").textContent = fmt(d.A * 1e6, 0);
  $("copper-diam").textContent = (wireDiameter(d.A) * 100).toFixed(1);
  $("copper-loss").textContent = ((1 - d.eta) * 100).toFixed(1);
  $("o-p").textContent = d.P >= 1e6 ? fmt(d.P / 1e6, 0) + " MW" : fmt(d.P / 1e3, d.P < 1e5 ? 1 : 0) + " kW";
  $("o-l").textContent = fmtKm(d.L);
  $("o-v").textContent = d.V >= 1000 ? fmt(d.V / 1000, d.V >= 1e5 ? 0 : 0) + " kV" : fmt(d.V, 0);
  $("o-eta").textContent = (d.eta * 100).toFixed(1);

  // the 1882 main, reused at the two historic voltages (10 V absolute budget)
  const reach15k = reachPoint(PEARL_P, PEARL_A, PEARL_dV, 15000);
  const reachMv = reachPoint(PEARL_P, PEARL_A, PEARL_dV, 1.1e6);
  $("copper-reach").textContent = fmtKm(reach15k);
  $("copper-reach-mv").textContent = fmtKm(reachMv);

  $("copper-formula").innerHTML =
    `A <span class="op">=</span> 2ρLP/(ΔV·V)<br>` +
    `&nbsp;&nbsp;<span class="op">=</span> 2 · <span class="cm">1.724e-8 Ω·m</span> · ` +
    `<span class="hl">${fmt(d.L, d.L < 1000 ? 0 : 0)} m</span> · ` +
    `<span class="hl">${fmt(d.P, 0)} W</span><br>` +
    `&nbsp;&nbsp;<span class="op">÷</span> (<span class="hl">${fmt(d.dV, 1)} V</span> · ` +
    `<span class="hl">${fmt(d.V, 0)} V</span>)` +
    ` <span class="op">=</span> <span class="hl">${fmt(d.A * 1e6, 0)} mm²</span><br>` +
    `m <span class="op">=</span> 4ρρ<sub>m</sub>L²P/(ΔV·V²)` +
    ` <span class="op">=</span> <span class="hl">${fmtKg(d.mass)}</span>`;

  const s = d.steps;
  $("copper-crosscheck").innerHTML =
    `逐步：R = 2ρL/A = <b>${(s.resistance * 1000).toFixed(2)} mΩ</b>` +
    ` · I = P/V = <b>${fmt(s.current, 0)} A</b>` +
    ` · ΔV = I·R = <b>${s.dropCheck.toFixed(2)} V</b>` +
    ` · m = ρ<sub>m</sub>·2L·A = <b>${fmtKg(s.mass)}</b><br>` +
    `与闭式一致：Δ < ${(Math.abs(s.mass - d.mass) / Math.max(s.mass, 1e-9)).toExponential(1)}`;

  drawCopperChart(d);
}

// log-log canvas: copper mass vs voltage, slope −2, with the real lines marked
function drawCopperChart(d) {
  const cv = $("copper-chart");
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const pad = { l: 90, r: 30, t: 30, b: 56 };
  const X0 = Math.log10(110), X1 = Math.log10(1.2e6);
  const Y0 = -4, Y1 = 7;                    // log10 kg: 0.1 g … 1,000 t
  const px = (v) => pad.l + ((Math.log10(v) - X0) / (X1 - X0)) * (W - pad.l - pad.r);
  const py = (m) => pad.t + (1 - (Math.log10(m) - Y0) / (Y1 - Y0)) * (H - pad.t - pad.b);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fbfaf6";
  ctx.fillRect(0, 0, W, H);

  // grid
  ctx.font = "13px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "#7d8894";
  ctx.strokeStyle = "#e3ded2";
  ctx.lineWidth = 1;
  for (let x = 100; x <= 1.2e6; x *= 10) {
    ctx.beginPath(); ctx.moveTo(px(x), pad.t); ctx.lineTo(px(x), H - pad.b); ctx.stroke();
  }
  const vlabels = [[110, "110 V"], [1000, "1 kV"], [1e4, "10 kV"], [1e5, "100 kV"], [1.1e6, "1.1 MV"]];
  for (const [v, t] of vlabels) {
    ctx.textAlign = "center";
    ctx.fillText(t, px(v), H - pad.b + 20);
  }
  for (let e = Y0; e <= Y1; e += 1) {
    ctx.beginPath(); ctx.moveTo(pad.l, py(Math.pow(10, e))); ctx.lineTo(W - pad.r, py(Math.pow(10, e))); ctx.stroke();
  }
  const mlabels = [[1e-3, "1 g"], [1, "1 kg"], [1e3, "1 t"], [1e6, "1,000 t"]];
  ctx.textAlign = "right";
  for (const [m, t] of mlabels) ctx.fillText(t, pad.l - 10, py(m) + 4);
  ctx.textAlign = "center";
  ctx.fillStyle = "#555c66";
  ctx.fillText("线电压", (pad.l + W - pad.r) / 2, H - 12);
  ctx.save();
  ctx.translate(20, (pad.t + H - pad.b) / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText("一回路铜的质量", 0, 0);
  ctx.restore();

  // the slope −2 curve for the current P, L, η
  ctx.strokeStyle = "#9a5b21";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  let started = false;
  for (let x = 110; x <= 1.2e6; x *= 1.02) {
    const m = copperMass(d.P, d.L, x, dVfromEta(x, d.eta));
    if (m < 1e-4 || m > 1e8) continue;
    const X = px(x), Y = py(m);
    if (!started) { ctx.moveTo(X, Y); started = true; } else ctx.lineTo(X, Y);
  }
  ctx.stroke();

  // real lines as markers
  const marks = [
    { i: 0, color: "#a3282a", star: true, label: "珍珠街 · 46 t" },
    { i: 1, color: "#1c4f9c", label: "劳芬 · 56 t" },
    { i: 2, color: "#c9a227", label: "昌吉 · 590 t*" },
  ];
  ctx.font = "14px ui-monospace, Menlo, monospace";
  for (const mk of marks) {
    const p = PRESETS[mk.i];
    const m = copperMass(p.P, p.L, p.V, p.dV);
    const X = px(p.V), Y = py(Math.min(Math.max(m, 1e-4), 1e7));
    ctx.fillStyle = mk.color;
    ctx.beginPath();
    if (mk.star) drawStar(ctx, X, Y, 9);
    else { ctx.arc(X, Y, 7, 0, Math.PI * 2); ctx.fill(); }
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = mk.color;
    ctx.fillText(mk.label, X + 12, Y + 4);
  }

  // the current position
  ctx.fillStyle = "#22262c";
  ctx.beginPath(); ctx.arc(px(d.V), py(d.mass), 6, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = "left";
  ctx.fillText("当前", px(d.V) + 10, py(d.mass) - 8);
}

function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + rad * Math.cos(a), py = y + rad * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// ── 2 · street tab ───────────────────────────────────────────
function streetDerived() {
  const { lamps, mode } = state.street;
  const P = lamps * LAMPS_W;
  const end = dropPointLoad(P, PEARL_L, PEARL_V, PEARL_A);
  const dist = dropDistributed(P, PEARL_L, PEARL_V, PEARL_A);
  const dV = mode === "end" ? end : dist;
  const farV = PEARL_V - dV;
  return {
    lamps, mode, P, end, dist, dV, farV,
    ratio: farV / PEARL_V,
    flux: lampFlux(farV / PEARL_V),
    life: lampLife(farV / PEARL_V),
  };
}

function renderStreet() {
  const s = streetDerived();
  $("o-lamps").textContent = fmt(s.lamps);
  $("far-volt").innerHTML = `${s.farV.toFixed(1)} <span>V</span>`;
  $("far-bright").textContent =
    s.lamps === 0 ? "空载" : `亮度 ${(s.flux * 100).toFixed(0)}% · 寿命 ×${s.life.toFixed(1)}`;
  $("street-end").textContent = `${s.end.toFixed(2)} V`;
  $("street-dist").textContent = `${s.dist.toFixed(2)} V`;
  $("street-half").textContent =
    s.end > 0 ? `${s.dist.toFixed(2)} / ${s.end.toFixed(2)} = ${(s.dist / s.end).toFixed(3)}` : "—";

  const good = s.farV >= 100;
  $("lamp-cert").innerHTML =
    `灯数 <b>${fmt(s.lamps)}</b> 盏 · 负荷 <b>${fmt(s.P / 1000, 1)} kW</b> · 电流 <b>${fmt(loadCurrent(s.P, PEARL_V), 0)} A</b><br>` +
    `街尾电压 <b>${s.farV.toFixed(1)} V</b>（${(s.ratio * 100).toFixed(1)}% 额定）<br>` +
    `亮度 <b>${(s.flux * 100).toFixed(0)}%</b> · 寿命 <b>×${s.life.toFixed(1)}</b>（V^3.4 / V^-13）`;
  const stamp = $("street-stamp");
  if (s.lamps === 0) stamp.innerHTML = "空载";
  else if (good) stamp.innerHTML = "110 V<br>合格";
  else if (s.farV >= 90) stamp.innerHTML = "压降<br>超标";
  else stamp.innerHTML = "街尾<br>昏暗";

  $("street-status").innerHTML =
    s.lamps === 0
      ? "拉开负载：主线里没有电流，也就没有压降 —— 街尾和站里一样亮。"
      : `${fmt(s.lamps)} 盏灯 · ${s.mode === "end" ? "全挂街尾" : "均匀铺满"} · ` +
        `街尾 ${s.farV.toFixed(1)} V，亮度只剩 ${(s.flux * 100).toFixed(0)}%，寿命却 ×${s.life.toFixed(1)}。` +
        `换成均匀铺满，压降正好减半。`;

  drawStreet(s);
}

function streetLampColor(ratio) {
  // hot → warm → ember as the voltage sags
  const c = Math.max(0, Math.min(1, (ratio - 0.72) / 0.28));
  return `rgba(${Math.round(255)}, ${Math.round(120 + 95 * c)}, ${Math.round(40 + 98 * c)}`;
}

function drawStreet(s) {
  const cv = $("street-canvas");
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#171a1f";
  ctx.fillRect(0, 0, W, H);

  const ground = 400;
  const x0 = 190, x1 = 1230;

  // ground & street
  ctx.fillStyle = "#23262c";
  ctx.fillRect(0, ground, W, H - ground);
  ctx.strokeStyle = "#3a3e46";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(W, ground); ctx.stroke();

  // the underground conduit (Edison ran his mains in tubes under the street)
  const ductY = ground + 42;
  ctx.fillStyle = "#6f3f12";
  ctx.fillRect(x0 - 30, ductY, x1 - x0 + 60, 10);
  ctx.strokeStyle = "#9a5b21";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0 - 30, ductY, x1 - x0 + 60, 10);
  ctx.fillStyle = "#7d8894";
  ctx.font = "13px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.fillText("地下铜管 · 908 m · 2,846 mm²", x0 + 6, ductY + 28);

  // the station
  ctx.fillStyle = "#2e2420";
  ctx.fillRect(30, ground - 130, 130, 130);
  ctx.fillStyle = "#3d2f27";
  ctx.fillRect(30, ground - 130, 130, 14);
  ctx.fillRect(58, ground - 176, 16, 46);           // chimney
  ctx.fillStyle = "#101317";
  ctx.fillRect(76, ground - 60, 34, 60);            // door
  ctx.fillStyle = "#ffd98a";
  ctx.fillRect(38, ground - 108, 26, 20);           // lit window
  ctx.fillRect(110, ground - 108, 26, 20);
  ctx.fillStyle = "#e8e4d5";
  ctx.font = "14px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText("珍珠街 257 号", 95, ground - 142);
  ctx.fillStyle = "#9aa4b0";
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillText("6 × JUMBO", 95, ground - 12);

  // lamp posts
  const drawables = Math.min(s.lamps, 26);
  const t = state.street.t;
  const bulbs = [];
  if (s.mode === "end") {
    // one pole at the end of the street, bulbs clustered on it
    ctx.strokeStyle = "#4a4038";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x1, ground); ctx.lineTo(x1, ground - 130); ctx.stroke();
    for (let i = 0; i < drawables; i += 1) {
      bulbs.push({ x: x1 - 8 + (i % 3) * 13, y: ground - 136 - Math.floor(i / 3) * 24, frac: 1 });
    }
  } else {
    for (let i = 0; i < drawables; i += 1) {
      const x = x0 + ((x1 - x0) * i) / Math.max(1, drawables - 1);
      ctx.strokeStyle = "#4a4038";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, ground); ctx.lineTo(x, ground - 110); ctx.stroke();
      bulbs.push({ x, y: ground - 116, frac: i / Math.max(1, drawables - 1) });
    }
  }

  bulbs.forEach((b, i) => {
    const vHere = PEARL_V - s.dV * b.frac;
    const ratio = vHere / PEARL_V;
    const lightAt = (i + 1) / (drawables + 1);
    let on = 0;
    if (state.street.switched && drawables > 0) {
      if (t >= lightAt) {
        const since = t - lightAt;
        on = since < 0.12 ? 1 + 0.45 * Math.sin(46 * since) * Math.exp(-10 * since) : 1;
      }
    }
    const px = b.x, by = b.y;
    if (on > 0) {
      const color = streetLampColor(ratio);
      const glowR = 6 + 16 * ratio * on;
      const grad = ctx.createRadialGradient(px, by, 1, px, by, glowR * 2.2);
      grad.addColorStop(0, `${color},${0.95 * on})`);
      grad.addColorStop(1, `${color},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(px, by, glowR * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,236,190,${0.95 * on})`;
    } else {
      ctx.fillStyle = "#3d4149";
    }
    ctx.beginPath(); ctx.arc(px, by, 5.5, 0, Math.PI * 2); ctx.fill();
  });

  // voltage profile strip
  const chartY = H - 78, chartH = 52;
  ctx.fillStyle = "rgba(16,19,23,0.85)";
  ctx.fillRect(30, chartY - 6, W - 60, chartH + 18);
  const vy = (v) => chartY + (1 - (v - 85) / (115 - 85)) * chartH;
  ctx.strokeStyle = "#3a3e46";
  ctx.lineWidth = 1;
  [110, 100, 90].forEach((v) => {
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(40, vy(v)); ctx.lineTo(W - 40, vy(v)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#5d6672";
    ctx.font = "11px ui-monospace, Menlo, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${v} V`, W - 34, vy(v) + 4);
  });
  ctx.strokeStyle = "#ffd98a";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(40, vy(PEARL_V));
  ctx.lineTo(W - 40, vy(s.farV));
  ctx.stroke();
  ctx.fillStyle = "#ffd98a";
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`站端 110 V`, 44, chartY - 12);
  ctx.textAlign = "right";
  ctx.fillText(`街尾 ${s.farV.toFixed(1)} V`, W - 44, chartY - 12);
}

// ── 3 · lamps tab ────────────────────────────────────────────
function renderLamp() {
  const { R, ratio } = state.lamp;
  const V = PEARL_V * ratio;
  const P = lampPower(V, R);
  const I = lampCurrent(V, R);
  const flux = lampFlux(ratio);
  const life = lampLife(ratio);

  $("o-r").textContent = fmt(R, 0);
  $("o-ratio").textContent = ratio.toFixed(2);
  $("lamp-w").textContent = fmt(P, P < 100 ? 1 : 0);
  $("lamp-a").textContent = I.toFixed(2);
  $("lamp-flux").textContent = (flux * 100).toFixed(0);
  $("lamp-life").textContent = `×${life.toFixed(1)}`;

  $("lamp-formula").innerHTML =
    `P <span class="op">=</span> V²/R <span class="op">=</span> ` +
    `<span class="hl">${V.toFixed(1)}²</span> / <span class="hl">${fmt(R, 0)}</span>` +
    ` <span class="op">=</span> <span class="hl">${fmt(P, 1)} W</span><br>` +
    `I <span class="op">=</span> V/R <span class="op">=</span> <span class="hl">${I.toFixed(2)} A</span>` +
    ` <span class="cm">· 6,600 盏就是 ${fmt(loadCurrent(600000, PEARL_V), 0)} A</span><br>` +
    `亮度 <span class="op">∝</span> (V/V₀)<sup>3.4</sup> <span class="op">=</span> ` +
    `<span class="hl">${(flux * 100).toFixed(0)}%</span>` +
    ` · 寿命 <span class="op">∝</span> (V/V₀)<sup>−13</sup> <span class="op">=</span> ` +
    `<span class="hl">×${life.toFixed(1)}</span>`;

  drawLamp(ratio, flux);
}

function drawLamp(ratio, flux) {
  const cv = $("lamp-canvas");
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#171a1f";
  ctx.fillRect(0, 0, W, H);

  const cx = 300, cy = 220, r = 120;
  // glow
  const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, r * (1.4 + 0.9 * ratio));
  const c = Math.max(0, Math.min(1, (ratio - 0.72) / 0.28));
  const col = `${Math.round(255)}, ${Math.round(120 + 95 * c)}, ${Math.round(40 + 98 * c)}`;
  glow.addColorStop(0, `rgba(${col},${0.5 * Math.min(1.4, flux)})`);
  glow.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 430);

  // glass
  ctx.strokeStyle = "#4a5058";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fill();

  // base
  ctx.fillStyle = "#3d4149";
  ctx.fillRect(cx - 26, cy + r - 6, 52, 46);
  ctx.strokeStyle = "#5d6672";
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy + r + 4 + i * 10);
    ctx.lineTo(cx + 26, cy + r + 4 + i * 10);
    ctx.stroke();
  }

  // filament: high-resistance carbon zigzag between two posts
  const fx0 = cx - 52, fx1 = cx + 52, fy = cy + 30;
  ctx.strokeStyle = "#6a727c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(fx0, fy + 34); ctx.lineTo(fx0, fy);
  ctx.moveTo(fx1, fy + 34); ctx.lineTo(fx1, fy);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = `rgba(${col},${Math.min(1, 0.25 + flux)})`;
  ctx.beginPath();
  ctx.moveTo(fx0, fy);
  const zig = 9;
  for (let i = 0; i <= zig; i += 1) {
    const x = fx0 + ((fx1 - fx0) * i) / zig;
    const y = fy - (i % 2 === 0 ? 0 : 26) - 6;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  // filament glow
  ctx.save();
  ctx.shadowColor = `rgba(${col},1)`;
  ctx.shadowBlur = 22 * Math.min(1.5, flux);
  ctx.strokeStyle = `rgba(${col},0.95)`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= zig; i += 1) {
    const x = fx0 + ((fx1 - fx0) * i) / zig;
    const y = fy - (i % 2 === 0 ? 0 : 26) - 6;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // rays when overdriven
  if (ratio > 1.1) {
    ctx.strokeStyle = `rgba(${col},${Math.min(0.8, (ratio - 1.1) * 4)})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i += 1) {
      const a = (i * Math.PI) / 5 + 0.3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r + 14), cy + Math.sin(a) * (r + 14));
      ctx.lineTo(cx + Math.cos(a) * (r + 34 + 8 * (i % 2)), cy + Math.sin(a) * (r + 34 + 8 * (i % 2)));
      ctx.stroke();
    }
  }

  // the flux / life curves panel
  const gx = 560, gy = 90, gw = 280, gh = 260;
  ctx.fillStyle = "rgba(16,19,23,0.85)";
  ctx.fillRect(gx, gy, gw, gh);
  ctx.strokeStyle = "#3a3e46";
  ctx.strokeRect(gx, gy, gw, gh);
  const yFor = (f) => gy + gh - 18 - Math.min(1, f) * (gh - 40);
  // flux curve (clipped at 1)
  ctx.strokeStyle = "#ffd98a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 60; i += 1) {
    const x = 0.5 + (i / 60) * 0.8;
    const X = gx + 16 + (i / 60) * (gw - 32);
    if (i === 0) ctx.moveTo(X, yFor(lampFlux(x))); else ctx.lineTo(X, yFor(lampFlux(x)));
  }
  ctx.stroke();
  // life curve (log-scaled, drawn downward from the top of its own axis)
  ctx.strokeStyle = "#8fd0a0";
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  for (let i = 0; i <= 60; i += 1) {
    const x = 0.5 + (i / 60) * 0.8;
    const l = Math.min(4, lampLife(x)) / 4;   // clip at ×4 for display
    const X = gx + 16 + (i / 60) * (gw - 32);
    const Y = gy + 18 + (1 - l) * (gh - 36);
    if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // marker
  const mx = gx + 16 + ((ratio - 0.5) / 0.8) * (gw - 32);
  ctx.fillStyle = "#f2f0ea";
  ctx.beginPath(); ctx.arc(mx, yFor(flux), 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#9aa4b0";
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.fillText("亮度 ∝ V^3.4", gx + 16, gy + 20);
  ctx.fillStyle = "#8fd0a0";
  ctx.fillText("寿命 ∝ V^−13（截到 ×4）", gx + 16, gy + 38);
  ctx.fillStyle = "#9aa4b0";
  ctx.textAlign = "center";
  ctx.fillText("0.5", gx + 16, gy + gh - 2);
  ctx.fillText("1.3", gx + gw - 16, gy + gh - 2);
  ctx.fillText("V/V₀", gx + gw / 2, gy + gh - 2);
}

// ── 4 · reach tab ────────────────────────────────────────────
function renderReach() {
  const { scale, line } = state.reach;
  $("o-scale").textContent = `×${(scale).toFixed(1)}`;
  const host = $("line-list");
  host.innerHTML = "";
  LINES.forEach((L, i) => {
    const vTxt = L.V >= 1e6 ? `${fmt(L.V / 1e6, 1)} MV` : L.V >= 1000 ? `${fmt(L.V / 1000, 0)} kV` : `${fmt(L.V, 0)} V`;
    const kmTxt = `${fmt(L.km, L.km < 10 ? 1 : 0)} km`;
    const row = document.createElement("div");
    row.className = `line-row${i === line ? " on" : ""}`;
    row.innerHTML =
      `<span class="line-year">${L.y}</span><span class="line-name">${L.name}</span>` +
      `<span class="line-fact">${vTxt} · ${kmTxt}</span>`;
    row.addEventListener("click", () => selectLine(i));
    host.appendChild(row);
  });
  drawReach();
}

function drawReach() {
  const cv = $("reach-chart");
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const pad = { l: 90, r: 30, t: 30, b: 56 };
  const X0 = Math.log10(100), X1 = Math.log10(2e6);
  const Y0 = Math.log10(0.4), Y1 = Math.log10(1.2e4);
  const px = (v) => pad.l + ((Math.log10(v) - X0) / (X1 - X0)) * (W - pad.l - pad.r);
  const py = (km) => pad.t + (1 - (Math.log10(km) - Y0) / (Y1 - Y0)) * (H - pad.t - pad.b);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fbfaf6";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#e3ded2";
  ctx.lineWidth = 1;
  ctx.font = "13px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "#7d8894";
  for (let v = 100; v <= 2e6; v *= 10) {
    ctx.beginPath(); ctx.moveTo(px(v), pad.t); ctx.lineTo(px(v), H - pad.b); ctx.stroke();
  }
  [[110, "110 V"], [1e3, "1 kV"], [1e4, "10 kV"], [1e5, "100 kV"], [1.1e6, "1.1 MV"]].forEach(([v, t]) => {
    ctx.textAlign = "center";
    ctx.fillText(t, px(v), H - pad.b + 20);
  });
  for (let e = Math.ceil(Y0); e <= Y1; e += 1) {
    ctx.beginPath(); ctx.moveTo(pad.l, py(Math.pow(10, e))); ctx.lineTo(W - pad.r, py(Math.pow(10, e))); ctx.stroke();
  }
  ctx.textAlign = "right";
  [[1, "1 km"], [10, "10"], [100, "100"], [1000, "1,000"], [1e4, "10,000 km"]].forEach(([k, t]) => {
    ctx.fillText(t, pad.l - 10, py(k) + 4);
  });
  ctx.textAlign = "center";
  ctx.fillStyle = "#555c66";
  ctx.fillText("系统电压", (pad.l + W - pad.r) / 2, H - 12);
  ctx.save();
  ctx.translate(20, (pad.t + H - pad.b) / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText("可达距离", 0, 0);
  ctx.restore();

  // the 1882 copper, reused at every voltage: slope exactly 1
  const A = PEARL_A * state.reach.scale;
  ctx.strokeStyle = "#b8b2a2";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  let started = false;
  for (let v = 110; v <= 2e6; v *= 1.03) {
    const km = reachPoint(PEARL_P, A, PEARL_dV, v) / 1000;
    if (km < 0.4 || km > 1.2e4) continue;
    const X = px(v), Y = py(km);
    if (!started) { ctx.moveTo(X, Y); started = true; } else ctx.lineTo(X, Y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#8d8776";
  ctx.font = "13px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.fillText("1882 年的铜 ×" + state.reach.scale.toFixed(1), px(110) + 6, py(reachPoint(PEARL_P, A, PEARL_dV, 110) / 1000) - 10);

  // real lines
  ctx.font = "14px ui-monospace, Menlo, monospace";
  LINES.forEach((L, i) => {
    const X = px(L.V), Y = py(L.km);
    const on = i === state.reach.line;
    const color = { dc: "#9a5b21", ac: "#1c4f9c", hvdc: "#c9a227" }[L.kind];
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(X, Y, on ? 10 : 7, 0, Math.PI * 2); ctx.fill();
    if (L.y === 1882) {
      ctx.fillStyle = color;
      drawStar(ctx, X, Y - 18, 9);
    }
    if (on) {
      ctx.strokeStyle = "#22262c";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X, Y, 14, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = on ? "#22262c" : "#555c66";
    ctx.textAlign = "center";
    ctx.fillText(`${L.y} · ${L.name}`, X, Y - 18);
  });
}

function selectLine(i) {
  state.reach.line = i;
  setTab("reach");
  renderReach();
}

// ── 5 · ladder tab ───────────────────────────────────────────
const KIND_COLOR = { dc: "#9a5b21", ac: "#1c4f9c", fire: "#c0392b", hvdc: "#c9a227" };

function buildLadder() {
  const svg = $("ladder-chart");
  const W = 1280, H = 480;
  const x0 = 70, x1 = 1250;
  const y0 = 1880, y1 = 2028;
  const px = (y) => x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
  const baseline = 320;

  // greedy label placement: alternate above/below slots, skip any that would
  // collide with an already-placed label
  const slots = [
    ...[-44, -82, -120, -158].map((d) => ({ dy: d, side: "up" })),
    ...[46, 78, 110].map((d) => ({ dy: d, side: "down" })),
  ];
  const placed = [];
  const collides = (x, y, w) =>
    placed.some((p) => Math.abs(p.y - y) < 26 && Math.abs(p.x - x) < (p.w + w) / 2 + 10);

  let out = "";
  out += `<line class="axis" x1="${x0}" y1="${baseline}" x2="${x1}" y2="${baseline}"/>`;
  for (let y = 1880; y <= 2020; y += 20) {
    out += `<line class="gridline" x1="${px(y)}" y1="50" x2="${px(y)}" y2="${baseline}"/>` +
      `<text class="year-label" x="${px(y)}" y="${baseline + 22}" text-anchor="middle">${y}</text>`;
  }

  EVENTS.forEach((e, i) => {
    const color = KIND_COLOR[e.kind];
    const X = px(e.y);
    const lw = e.short.length * 14 + 26;
    let slot = slots[slots.length - 1];
    for (const s of slots) {
      const ly = baseline + s.dy;
      if (!collides(X, ly, lw)) { slot = s; break; }
    }
    const ly = baseline + slot.dy;
    placed.push({ x: X, y: ly, w: lw });

    const yearDy = slot.side === "up" ? -16 : 16;
    const titleDy = slot.side === "up" ? -31 : 31;

    out += `<g class="pin" data-i="${i}">`;
    out += `<line x1="${X}" y1="${baseline}" x2="${X}" y2="${baseline + (slot.side === "up" ? -12 : 12)}" ` +
      `stroke="${color}" stroke-width="1.6"/>`;
    if (e.star) {
      out += `<path transform="translate(${X} ${baseline - 26}) scale(1.5)" ` +
        `d="M0,-9 L2.6,-2.9 L9,-2.9 L3.8,1.2 L5.6,7.6 L0,3.8 L-5.6,7.6 L-3.8,1.2 L-9,-2.9 L-2.6,-2.9 Z" ` +
        `fill="${color}" stroke="#22262c" stroke-width="0.6"/>`;
      out += `<circle cx="${X}" cy="${baseline}" r="${i === state.event ? 9 : 6}" fill="${color}"/>`;
    } else {
      out += `<circle cx="${X}" cy="${baseline}" r="${i === state.event ? 9 : 7}" fill="${color}"/>`;
    }
    if (i === state.event) {
      out += `<circle cx="${X}" cy="${baseline}" r="14" fill="none" stroke="#22262c" stroke-width="2"/>`;
    }
    out += `<text class="year-label" x="${X}" y="${ly + yearDy}" text-anchor="middle" fill="${color}">${e.date.slice(0, 4)}</text>` +
      `<text class="title-label" x="${X}" y="${ly + titleDy}" text-anchor="middle" ` +
      `font-weight="${i === state.event ? 700 : 400}">${e.short}</text>` +
      `</g>`;
  });
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = out;
  for (const g of svg.querySelectorAll(".pin")) {
    g.addEventListener("click", () => selectEvent(Number(g.dataset.i)));
  }
}

function renderEventCard() {
  const e = EVENTS[state.event];
  const color = KIND_COLOR[e.kind];
  $("record-card").innerHTML =
    `<div class="rc-head">` +
    `<span class="rc-title">${e.title}</span>` +
    `<span class="rc-date">${e.date}</span>` +
    `<span class="rc-kind" style="border-color:${color};color:${color}">${e.kind.toUpperCase()}</span>` +
    `${e.star ? '<span class="star-flag">★ 1882-09-04 · 今天</span>' : ""}</div>` +
    `<p>${e.text}</p>`;
  buildLadder();
}

function selectEvent(i) {
  state.event = i;
  setTab("ladder");
  renderEventCard();
}

// ── switch-on animation (deterministic; the video drives tick()) ──
let rafId = null;

function throwSwitch() {
  state.street.switched = true;
  state.street.t = 0;
  if (!state.videoMode && rafId === null) loop();
}

function loop() {
  state.street.t += 1 / 60;
  if (state.street.t >= 3.4) { rafId = null; renderStreet(); return; }
  renderStreet();
  rafId = requestAnimationFrame(loop);
}

function tick(dt) {
  if (!state.street.switched) return;
  state.street.t += dt;
  renderStreet();
}

$("btn-switch").addEventListener("click", throwSwitch);
$("s-lamps").addEventListener("input", (e) => {
  state.street.lamps = Number(e.target.value);
  renderStreet();
});
$("btn-end").addEventListener("click", () => setStreetMode("end"));
$("btn-dist").addEventListener("click", () => setStreetMode("dist"));

function setStreetMode(mode) {
  state.street.mode = mode;
  $("btn-end").classList.toggle("on", mode === "end");
  $("btn-dist").classList.toggle("on", mode === "dist");
  renderStreet();
}

// copper sliders
$("s-p").addEventListener("input", (e) => {
  state.copper.P = sliderToLog(e.target, ...COPPER_P_RANGE);
  clearPresetHighlight();
  renderCopper();
});
$("s-l").addEventListener("input", (e) => {
  state.copper.L = sliderToLog(e.target, ...COPPER_L_RANGE);
  clearPresetHighlight();
  renderCopper();
});
$("s-v").addEventListener("input", (e) => {
  state.copper.V = sliderToLog(e.target, ...COPPER_V_RANGE);
  clearPresetHighlight();
  renderCopper();
});
$("s-eta").addEventListener("input", (e) => {
  state.copper.eta = Number(e.target.value) / 100;
  clearPresetHighlight();
  renderCopper();
});

function clearPresetHighlight() {
  for (const b of $("presets").children) b.classList.remove("on");
}

// lamp sliders
$("s-r").addEventListener("input", (e) => {
  state.lamp.R = Number(e.target.value);
  renderLamp();
});
$("s-ratio").addEventListener("input", (e) => {
  state.lamp.ratio = Number(e.target.value) / 100;
  renderLamp();
});

// reach slider
$("s-scale").addEventListener("input", (e) => {
  state.reach.scale = Number(e.target.value) / 100;
  renderReach();
});

// ── video hooks ──────────────────────────────────────────────
window.__demo = {
  setTab,
  scrollToTop,
  setVideoMode(on) {
    state.videoMode = on;
    document.body.classList.toggle("video-mode", on);
    if (on && rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  },
  selectPreset,
  setCopperP(w) { state.copper.P = w; syncCopperSliders(); clearPresetHighlight(); renderCopper(); },
  setCopperL(m) { state.copper.L = m; syncCopperSliders(); clearPresetHighlight(); renderCopper(); },
  setCopperV(v) { state.copper.V = v; syncCopperSliders(); clearPresetHighlight(); renderCopper(); },
  setCopperEta(x) { state.copper.eta = x; syncCopperSliders(); clearPresetHighlight(); renderCopper(); },
  setStreetLamps(n) { state.street.lamps = n; $("s-lamps").value = n; renderStreet(); },
  setStreetMode,
  throwSwitch,
  tick,
  switchT: () => state.street.t,
  setLampR(r) { state.lamp.R = r; $("s-r").value = r; renderLamp(); },
  setLampRatio(x) { state.lamp.ratio = x; $("s-ratio").value = Math.round(x * 100); renderLamp(); },
  selectLine,
  setReachScale(x) { state.reach.scale = x; $("s-scale").value = Math.round(x * 100); renderReach(); },
  selectEvent,
};

// ── boot ─────────────────────────────────────────────────────
buildPresets();
syncCopperSliders();
renderCopper();
renderStreet();
renderLamp();
renderReach();
buildLadder();
renderEventCard();
