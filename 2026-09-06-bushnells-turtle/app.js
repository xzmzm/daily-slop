// app.js — Turtle 1776 · the studio chrome around physics.js.
// Canvases: the trim pool (day), the night river (mission), and three charts
// (crank cube-root, CO₂ clock, tide window). The mission playback is a
// deterministic playhead over simulateMission's track, stepped by tick(dt)
// in video mode so every capture is identical.

import {
  G, KN, RHO_SW, P_ATM,
  HULL_L, HULL_H, HULL_W, C_SEMI,
  V_ENV, M_DISPLACED, WETTED_S, A_FRONT, A_PLAN,
  M_DRY, LEAD_KG, BALLAST_NEUTRAL, V_AIR_L, IRON_BUYS_L, OAK_COSTS_L,
  totalMass, netForce, steadyVertSpeed, BLOW_SPEED,
  gaugePa, volumeBelow, draftForMass,
  PROP_EFF, CD_FORM, cfIttc, dragCA, dragAt, steadySpeedFrozen, steadySpeed,
  crankWattsFor, CLAIM_MPH, CLAIM_MS, CLAIM_WATTS, NU_SW,
  metabolicW, vo2Lpm, vco2Lpm,
  CO2_START, O2_START, CO2_ABORT, CO2_DANGER, O2_FLOOR,
  co2After, o2After, timeToCo2, timeToO2,
  SPEC_CRANK_W, AIR_PRESETS,
  MISSION, tideKn, SLACKS, simulateMission, fmtClock,
  LAUNCH_PRESETS, EVENTS, kindLabel,
} from "./physics.js";

const $ = (id) => document.getElementById(id);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const MPH = 0.44704;
const f1 = (x) => x.toFixed(1);
const f2 = (x) => x.toFixed(2);

const state = {
  videoMode: false,
  tab: "trim",
  trim: {
    ballast: 0, leadDropped: false,
    depth: draftForMass(M_DRY),   // keel depth in m (animated)
    leadFall: 0,                  // seconds since the blow
    bubbles: [],
  },
  crank: { w: 100 },
  air: { w: SPEC_CRANK_W },
  mission: {
    launchH: 23, result: null, playhead: 0, running: false, launched: false,
    TIME_SCALE: 90,       // 1 s of video ≈ 90 s of 1776
    boomFlash: 0,
  },
  event: 2,
};

let rafId = null;

// ── tabs ─────────────────────────────────────────────────────
function setTab(name) {
  state.tab = name;
  for (const b of $("tabs").children) b.classList.toggle("on", b.dataset.tab === name);
  for (const s of document.querySelectorAll("main > section.tab")) {
    s.classList.toggle("on", s.id === `tab-${name}`);
  }
  renderActive();
}
function scrollToTop() { window.scrollTo({ top: 0 }); }

// ── header presets: the three launch hours ──────────────────
function buildPresets() {
  const box = $("presets");
  box.innerHTML = "";
  LAUNCH_PRESETS.forEach((p, i) => {
    const b = document.createElement("button");
    b.textContent = p.label;
    b.addEventListener("click", () => {
      selectLaunchPreset(i);
      setTab("mission");
    });
    box.appendChild(b);
  });
}
function selectLaunchPreset(i) {
  const p = LAUNCH_PRESETS[i];
  state.mission.launchH = p.h;
  $("s-launch").value = p.h;
  $("o-launch").textContent = fmtClock(p.h);
  for (const b of $("presets").children) b.classList.toggle("on", false);
  $("presets").children[i]?.classList.add("on");
  $("mission-status").textContent = p.note;
  drawTideChart();
}

// ── 1 · the trim tab ─────────────────────────────────────────
const TRIM_SCALE = 88;              // px per metre
const SEABED_M = 6.5;

function trimMass() { return totalMass(state.trim.ballast, state.trim.leadDropped); }
function trimForce() { return netForce(state.trim.ballast, state.trim.leadDropped); }

function trimTargetDepth() {
  const m = trimMass();
  if (m < M_DISPLACED) return draftForMass(m);         // floats: keel depth = draft
  return SEABED_M;                                     // sinks: to the seabed
}

function stepTrim(dt) {
  const t = state.trim;
  const target = trimTargetDepth();
  const mNow = trimMass();
  const imbalance = Math.abs(mNow - M_DISPLACED);
  const v = steadyVertSpeed(G * Math.min(imbalance, 400));   // capped for the eye
  const stepCap = Math.min(Math.abs(v), 0.75) * dt * 1.6;
  if (Math.abs(target - t.depth) <= stepCap) t.depth = target;
  else t.depth += Math.sign(target - t.depth) * stepCap;
  if (t.leadDropped) t.leadFall += dt;
  // bubbles while moving or submerged
  if (t.depth > 1.4 || Math.abs(target - t.depth) > 0.05) {
    t.bubbles.push({ x: (Math.random() - 0.5) * 60, y: 0, r: 1 + Math.random() * 2.4, a: 0.55 });
  }
  for (const b of t.bubbles) { b.y -= 46 * dt; b.a -= dt * 0.25; }
  t.bubbles = t.bubbles.filter((b) => b.a > 0).slice(-46);
}

function drawTrim() {
  const cv = $("trim-canvas"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const t = state.trim;
  const WL = 208;                                        // waterline y
  const cx = W / 2 + 40;
  const mToPx = (m) => m * TRIM_SCALE;

  // sky + sea
  const sky = ctx.createLinearGradient(0, 0, 0, WL);
  sky.addColorStop(0, "#dfe8dc"); sky.addColorStop(1, "#c3d6cf");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, WL);
  const sea = ctx.createLinearGradient(0, WL, 0, H);
  sea.addColorStop(0, "#1d5370"); sea.addColorStop(0.5, "#16455c"); sea.addColorStop(1, "#0d2438");
  ctx.fillStyle = sea; ctx.fillRect(0, WL, W, H - WL);

  // surface ripples
  ctx.strokeStyle = "rgba(240,246,235,.5)"; ctx.lineWidth = 1.6;
  for (let i = 0; i < 26; i += 1) {
    const x = (i * 53 + 11) % W;
    const y = WL + Math.sin(i * 1.7) * 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 16, y); ctx.stroke();
  }

  // depth ruler (left)
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "rgba(240,246,235,.75)"; ctx.strokeStyle = "rgba(240,246,235,.35)";
  for (let d = 0; d <= 6; d += 1) {
    const y = WL + mToPx(d);
    ctx.beginPath(); ctx.moveTo(28, y); ctx.lineTo(46, y); ctx.stroke();
    ctx.fillText(`${d} m`, 52, y + 4);
  }

  // seabed
  const bedY = WL + mToPx(SEABED_M);
  ctx.fillStyle = "#0a1c2c";
  ctx.beginPath(); ctx.moveTo(0, bedY);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, bedY + 6 + Math.sin(x * 0.02) * 4);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

  // hull placement
  const hl = mToPx(HULL_L), hh = mToPx(HULL_H);
  const keelY = WL + mToPx(t.depth);
  const cy = keelY - hh / 2;
  const submerged = keelY - hh * 0.5 > WL;

  // dropped lead, falling
  if (t.leadDropped) {
    const fallY = keelY + 0.5 * 9.81 * t.leadFall * t.leadFall * 26;
    if (fallY < bedY - 6) {
      ctx.save();
      ctx.translate(cx - 14, Math.min(fallY, bedY - 10));
      ctx.fillStyle = "#5c1f21";
      ctx.fillRect(-16, -8, 32, 16);
      ctx.strokeStyle = "#e8e4d0"; ctx.lineWidth = 1.5;
      ctx.strokeRect(-16, -8, 32, 16);
      ctx.restore();
    }
  } else {
    // lead on the keel
    ctx.fillStyle = "#5c1f21";
    ctx.fillRect(cx - hl * 0.24, keelY - 9, hl * 0.48, 11);
    ctx.strokeStyle = "#e8e4d0"; ctx.lineWidth = 1.2;
    ctx.strokeRect(cx - hl * 0.24, keelY - 9, hl * 0.48, 11);
  }

  // the barrel
  ctx.save();
  if (submerged) { ctx.globalAlpha = 0.88; }
  ctx.translate(cx, cy);
  const bw = hl / 2, bh = hh / 2;
  const grad = ctx.createLinearGradient(0, -bh, 0, bh);
  grad.addColorStop(0, "#8a6b45"); grad.addColorStop(0.55, "#6d5233"); grad.addColorStop(1, "#4a361f");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2c2113"; ctx.lineWidth = 3;
  ctx.stroke();
  // iron hoops
  ctx.strokeStyle = "#3a3f47"; ctx.lineWidth = 5;
  for (const fx of [-0.62, -0.18, 0.28, 0.66]) {
    ctx.beginPath();
    ctx.ellipse(fx * bw, 0, 8, bh * Math.sqrt(1 - fx * fx), 0, -Math.PI / 2, Math.PI / 2, true);
    ctx.stroke();
  }
  // interior water
  const frac = clamp(state.trim.ballast / BALLAST_NEUTRAL, 0, 1.12);
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, bw - 4, bh - 4, 0, 0, Math.PI * 2); ctx.clip();
  const top = bh - frac * 2 * (bh - 5);
  ctx.fillStyle = "rgba(27,84,110,.78)";
  ctx.fillRect(-bw, Math.max(top, -bh), hl, bh);
  ctx.restore();
  // glass ports
  ctx.fillStyle = "#cfe3ef";
  for (const px of [-0.45, 0, 0.45]) {
    ctx.beginPath(); ctx.arc(px * bw, 4, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#2c2113"; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // dome + snorkel
  ctx.fillStyle = "#a8874f";
  ctx.beginPath(); ctx.arc(0, -bh, 26, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = "#2c2113"; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.strokeStyle = "#3a3f47"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(14, -bh - 20); ctx.lineTo(20, -bh - 40); ctx.stroke();
  // auger on top
  ctx.strokeStyle = "#b3ac93"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-34, -bh + 6); ctx.lineTo(-52, -bh - 22); ctx.stroke();
  // propeller at the stern
  ctx.save();
  ctx.translate(bw + 8, 10);
  ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 3.4;
  const spin = state.videoMode ? 0 : (performance.now() / 90);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 16 + s * 4 * Math.sin(spin), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  // bubbles
  for (const b of t.bubbles) {
    ctx.fillStyle = `rgba(226,240,244,${clamp(b.a, 0, 0.6)})`;
    ctx.beginPath(); ctx.arc(cx + b.x, keelY - hh * 0.4 + b.y, b.r, 0, Math.PI * 2); ctx.fill();
  }

  // pressure gauge (right)
  const pGauge = gaugePa(clamp(t.depth, 0, SEABED_M));
  const gx = W - 96, gy = 96;
  ctx.strokeStyle = "#e8e4d0"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(gx, gy, 34, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(gx, gy);
  const ang = -Math.PI / 2 + clamp(pGauge / 90000, 0, 1) * Math.PI * 1.7;
  ctx.lineTo(gx + 24 * Math.cos(ang), gy + 24 * Math.sin(ang)); ctx.stroke();
  ctx.fillStyle = "#e8e4d0"; ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${(pGauge / 1000).toFixed(1)} kPa`, gx, gy + 52);
  ctx.fillText(`龙骨 ${t.depth.toFixed(2)} m`, gx, gy + 68);
  ctx.textAlign = "left";

  // live status line
  const m = trimMass();
  const F = trimForce();
  const draft = t.depth;
  ctx.fillStyle = "rgba(20,30,40,.85)";
  ctx.fillRect(28, 14, 560, 54);
  ctx.fillStyle = "#eef2e6"; ctx.font = "13px ui-monospace, Menlo, monospace";
  ctx.fillText(`舱底水 ${state.trim.ballast.toFixed(0)} kg / 中性 ${BALLAST_NEUTRAL.toFixed(0)} kg`, 40, 34);
  ctx.fillText(
    `总质量 ${m.toFixed(0)} kg · 排水量 ${M_DISPLACED.toFixed(0)} kg · 净力 ${F >= 0 ? "+" : ""}${(F / 1000).toFixed(2)} kN`,
    40, 54,
  );
}

function renderTrim() {
  const t = state.trim;
  const m = trimMass();
  const F = trimForce();
  const floating = m < M_DISPLACED - 8;
  const sinking = m > M_DISPLACED + 8;
  const draft = t.depth ?? draftForMass(m) ?? 0;

  $("o-ballast").textContent = t.ballast.toFixed(0);
  $("s-ballast").value = t.ballast;
  $("fact-ballast").textContent = BALLAST_NEUTRAL.toFixed(0);

  const stateEl = $("trim-state");
  const subEl = $("trim-state-sub");
  if (t.leadDropped && floating) { stateEl.textContent = "上浮"; subEl.textContent = `应急抛铅 ${f2(BLOW_SPEED)} m/s`; }
  else if (floating) { stateEl.textContent = "漂浮"; subEl.textContent = `吃水 ${f2(draft)} m · 干舷 ${f2(HULL_H - draft)} m`; }
  else if (sinking) { stateEl.textContent = "下沉"; subEl.textContent = `龙骨 ${f2(Math.min(draft, SEABED_M))} m · 海底`; }
  else { stateEl.textContent = "悬停"; subEl.textContent = "净力 0 · 刀刃上"; }

  $("trim-formula").innerHTML =
    `W <span class="op">=</span> ρ·g·V <span class="op">=</span> 1025 × 9.81 × ${V_ENV.toFixed(3)} <span class="op">=</span> <span class="hl">${(RHO_SW * G * V_ENV / 1000).toFixed(2)} kN</span><br>` +
    `V_air <span class="op">=</span> M/ρ − V_solids <span class="op">=</span> Σ mᵢ(ρᵢ−ρ)/(ρ·ρᵢ)<br>` +
    `铁 <span class="op">+</span>${IRON_BUYS_L.toFixed(2)} L/kg · 橡木 ${OAK_COSTS_L.toFixed(2)} L/kg → <span class="hl">${V_AIR_L.toFixed(0)} L</span>`;

  $("trim-crosscheck").innerHTML =
    `切片积分逐层验证：πab[u − u³/3c² + 2c/3] 从龙骨积到塔顶 = π/6·L·W·H = ${V_ENV.toFixed(4)} m³（残差 &lt; 1e-9）`;

  const v = steadyVertSpeed(F);
  $("trim-cert-lines").innerHTML =
    `<b>注水</b> ${t.ballast.toFixed(0)} kg（${(t.ballast / RHO_SW * 264.17).toFixed(0)} 加仑）<br>` +
    `<b>总质量</b> ${m.toFixed(0)} / ${M_DISPLACED.toFixed(0)} kg<br>` +
    `<b>净力</b> ${F >= 0 ? "+" : ""}${(F / 1000).toFixed(2)} kN → 垂直速度 ${Math.abs(v).toFixed(2)} m/s<br>` +
    `<b>应急抛铅</b> → ${BLOW_SPEED.toFixed(2)} m/s（${(BLOW_SPEED / KN).toFixed(1)} kn）上浮<br>` +
    `<b>龙骨压力</b> +${(gaugePa(clamp(draft, 0, SEABED_M)) / 1000).toFixed(1)} kPa`;

  const stamp = $("trim-stamp");
  stamp.classList.remove("ok");
  if (t.leadDropped && floating) { stamp.textContent = "上浮"; stamp.classList.add("ok"); }
  else if (floating) stamp.textContent = "漂浮";
  else if (sinking) stamp.textContent = "下沉";
  else { stamp.textContent = "悬停"; stamp.classList.add("ok"); }

  $("trim-status").textContent = floating
    ? `总质量 ${m.toFixed(0)} kg，还差 ${(M_DISPLACED - m).toFixed(0)} kg 才到中性——继续注水，或者就这么漂着透气。`
    : sinking
      ? `超载 ${(m - M_DISPLACED).toFixed(0)} kg，净力 ${(F / 1000).toFixed(2)} kN 向下，垂直速度 ${Math.abs(v).toFixed(2)} m/s——桶在往泥里去。`
      : `净力在 ±80 N 以内：悬停。多一桶水就沉，少一桶就浮——这就是布什内尔的刀刃。`;
}

// ── 2 · the crank tab ────────────────────────────────────────
function buildCrankPresets() {
  const box = $("crank-presets");
  const presets = [
    { w: SPEC_CRANK_W, label: "规格 56 W" },
    { w: 100, label: "巡航 100 W" },
    { w: 250, label: "冲刺 250 W" },
    { w: 400, label: "极限 400 W" },
  ];
  box.innerHTML = "";
  presets.forEach((p) => {
    const b = document.createElement("button");
    b.textContent = p.label;
    b.addEventListener("click", () => setCrank(p.w));
    box.appendChild(b);
  });
}
function setCrank(w) {
  state.crank.w = w;
  $("s-power").value = w;
  $("o-power").textContent = w.toFixed(0);
  renderCrank();
}

function drawCrankChart() {
  const cv = $("crank-chart"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const pad = { l: 56, r: 26, t: 30, b: 44 };
  const xOf = (w) => pad.l + ((Math.log10(w) - Math.log10(40)) / (Math.log10(1600) - Math.log10(40))) * (W - pad.l - pad.r);
  const yOf = (mph) => H - pad.b - (mph / 3.4) * (H - pad.t - pad.b);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fbf8ec"; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#d8d2bb"; ctx.lineWidth = 1;
  ctx.fillStyle = "#59616d"; ctx.font = "11.5px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  for (const w of [40, 50, 100, 200, 400, 800, 1600]) {
    ctx.beginPath(); ctx.moveTo(xOf(w), pad.t); ctx.lineTo(xOf(w), H - pad.b); ctx.stroke();
    ctx.fillText(`${w}`, xOf(w), H - pad.b + 16);
  }
  ctx.textAlign = "right";
  for (let m = 0; m <= 3; m += 0.5) {
    ctx.beginPath(); ctx.moveTo(pad.l, yOf(m)); ctx.lineTo(W - pad.r, yOf(m)); ctx.stroke();
    ctx.fillText(m.toFixed(1), pad.l - 6, yOf(m) + 4);
  }
  ctx.textAlign = "center";
  ctx.fillText("曲柄功率 W（对数）", (pad.l + W - pad.r) / 2, H - 8);
  ctx.save();
  ctx.translate(14, (pad.t + H - pad.b) / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText("水中速度 mph", 0, 0);
  ctx.restore();

  // the 3 mph claim
  ctx.setLineDash([7, 5]); ctx.strokeStyle = "#a3282a"; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(pad.l, yOf(3)); ctx.lineTo(W - pad.r, yOf(3)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#a3282a"; ctx.textAlign = "left";
  ctx.fillText(`宣传册：3 mph → ${CLAIM_WATTS.toFixed(0)} W`, pad.l + 8, yOf(3) - 7);

  // the curve
  ctx.strokeStyle = "#16455c"; ctx.lineWidth = 2.6;
  ctx.beginPath();
  for (let i = 0; i <= 220; i += 1) {
    const w = 40 * (1600 / 40) ** (i / 220);
    const y = steadySpeed(w) / MPH;
    if (i === 0) ctx.moveTo(xOf(w), yOf(y)); else ctx.lineTo(xOf(w), yOf(y));
  }
  ctx.stroke();

  // preset dots
  for (const w of [SPEC_CRANK_W, 100, 250, 400]) {
    ctx.fillStyle = "#c9a227";
    ctx.beginPath(); ctx.arc(xOf(w), yOf(steadySpeed(w) / MPH), 4.4, 0, Math.PI * 2); ctx.fill();
  }

  // the slider line
  const w = state.crank.w;
  const v = steadySpeed(w) / MPH;
  ctx.strokeStyle = "#8a6b2f"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(xOf(w), pad.t); ctx.lineTo(xOf(w), H - pad.b); ctx.stroke();
  ctx.fillStyle = "#5f4718";
  ctx.beginPath(); ctx.arc(xOf(w), yOf(v), 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1c2430"; ctx.textAlign = "left"; ctx.font = "12.5px ui-monospace, Menlo, monospace";
  ctx.fillText(`${w.toFixed(0)} W → ${v.toFixed(2)} mph`, xOf(w) + 8, yOf(v) - 8);
}

function renderCrank() {
  const w = state.crank.w;
  const v = steadySpeed(w);
  $("crank-speed").textContent = (v / MPH).toFixed(2);
  const ground = (kn) => ((v - kn * KN) / MPH);
  $("crank-ground").textContent =
    `顶 1 kn 时 ${Math.max(ground(1), 0).toFixed(2)} mph · 顶 2 kn 时 倒退 ${Math.abs(Math.min(ground(2), 0)).toFixed(2)}`;
  $("fact-ground2").textContent = Math.max(ground(1.5), 0).toFixed(1);

  const vLive = steadySpeed(w);
  const cf = cfIttc((vLive * HULL_L) / NU_SW);
  $("crank-formula").innerHTML =
    `D <span class="op">=</span> ½ρ(C_f·S + C_D·A_f)v² · P <span class="op">=</span> Dv/η<br>` +
    `v <span class="op">=</span> (2ηP/ρ·C_tot)<span class="op">^</span>⅓ → 8×功率 <span class="op">=</span> 2×速度<br>` +
    `${w.toFixed(0)} W：C_f ${cf.toFixed(5)} · C_tot ${(dragCA(vLive)).toFixed(3)} → <span class="hl">${(vLive / MPH).toFixed(2)} mph</span><br>` +
    `3 mph 需 <span class="hl">${CLAIM_WATTS.toFixed(0)} W</span>（C_D ${CD_FORM} · S ${WETTED_S.toFixed(1)} m²）`;

  const vFrozen = steadySpeedFrozen(w, cf);
  $("crank-crosscheck").innerHTML =
    `闭式（冻结 C_f）${vFrozen.toFixed(6)} m/s vs 不动点（活雷诺数）${vLive.toFixed(6)} m/s —— 差 ${(Math.abs(vFrozen - vLive)).toExponential(1)} m/s`;

  drawCrankChart();
}

// ── 3 · the air tab ──────────────────────────────────────────
function buildAirPresets() {
  const box = $("air-presets");
  box.innerHTML = "";
  AIR_PRESETS.forEach((p, i) => {
    const b = document.createElement("button");
    b.textContent = p.label;
    b.addEventListener("click", () => selectAirPreset(i));
    box.appendChild(b);
  });
}
function selectAirPreset(i) {
  state.air.w = AIR_PRESETS[i].w;
  $("s-airpower").value = state.air.w;
  $("o-airpower").textContent = state.air.w.toFixed(0);
  for (const b of $("air-presets").children) b.classList.remove("on");
  $("air-presets").children[i]?.classList.add("on");
  renderAir();
}
function setAirPower(w) {
  state.air.w = w;
  $("s-airpower").value = w;
  $("o-airpower").textContent = w.toFixed(0);
  for (const b of $("air-presets").children) b.classList.remove("on");
  renderAir();
}

function drawAirChart() {
  const cv = $("air-chart"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const pad = { l: 56, r: 56, t: 30, b: 44 };
  const tMax = 100;
  const xOf = (min) => pad.l + (min / tMax) * (W - pad.l - pad.r);
  const yL = (pct) => H - pad.b - (pct / 6) * (H - pad.t - pad.b);          // CO₂ 0..6%
  const yR = (pct) => H - pad.b - ((21 - pct) / 6) * (H - pad.t - pad.b);   // O₂ 15..21%
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fbf8ec"; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#d8d2bb"; ctx.lineWidth = 1;
  ctx.fillStyle = "#59616d"; ctx.font = "11.5px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  for (let m = 0; m <= tMax; m += 10) {
    ctx.beginPath(); ctx.moveTo(xOf(m), pad.t); ctx.lineTo(xOf(m), H - pad.b); ctx.stroke();
    ctx.fillText(`${m}`, xOf(m), H - pad.b + 16);
  }
  ctx.textAlign = "right";
  for (let p = 0; p <= 6; p += 1) {
    ctx.beginPath(); ctx.moveTo(pad.l, yL(p)); ctx.lineTo(W - pad.r, yL(p)); ctx.stroke();
    ctx.fillStyle = "#7e1f21"; ctx.fillText(`${p}%`, pad.l - 6, yL(p) + 4);
    ctx.fillStyle = "#1c4f6e"; ctx.fillText(`${21 - p}%`, W - pad.r + 6 + 26, yR(21 - p) + 4);
  }
  ctx.textAlign = "center";
  ctx.fillText("分钟", (pad.l + W - pad.r) / 2, H - 8);

  // thresholds
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = "#b3842b"; ctx.beginPath(); ctx.moveTo(pad.l, yL(3)); ctx.lineTo(W - pad.r, yL(3)); ctx.stroke();
  ctx.strokeStyle = "#a3282a"; ctx.beginPath(); ctx.moveTo(pad.l, yL(5)); ctx.lineTo(W - pad.r, yL(5)); ctx.stroke();
  ctx.strokeStyle = "#1c4f6e"; ctx.beginPath(); ctx.moveTo(pad.l, yR(15)); ctx.lineTo(W - pad.r, yR(15)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = "left"; ctx.font = "11.5px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "#b3842b"; ctx.fillText("3% 呼吸加深", pad.l + 8, yL(3) - 6);
  ctx.fillStyle = "#a3282a"; ctx.fillText("5% 剧烈头痛", pad.l + 8, yL(5) - 6);
  ctx.fillStyle = "#1c4f6e"; ctx.fillText("15% O₂ 下限", pad.l + 8, yR(15) - 6);

  const w = state.air.w;
  // CO₂ curve
  ctx.strokeStyle = "#a3282a"; ctx.lineWidth = 2.6;
  ctx.beginPath();
  for (let m = 0; m <= tMax; m += 1) {
    const c = co2After(m, w) * 100;
    if (m === 0) ctx.moveTo(xOf(m), yL(Math.min(c, 6))); else ctx.lineTo(xOf(m), yL(Math.min(c, 6)));
  }
  ctx.stroke();
  // O₂ curve
  ctx.strokeStyle = "#1c4f6e"; ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let m = 0; m <= tMax; m += 1) {
    const o = o2After(m, w) * 100;
    if (m === 0) ctx.moveTo(xOf(m), yR(o)); else ctx.lineTo(xOf(m), yR(o));
  }
  ctx.stroke();

  // the 3% crossing
  const t3 = timeToCo2(w);
  if (t3 <= tMax) {
    ctx.strokeStyle = "#7e1f21"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xOf(t3), pad.t); ctx.lineTo(xOf(t3), yL(3)); ctx.stroke();
    ctx.fillStyle = "#7e1f21";
    ctx.beginPath(); ctx.arc(xOf(t3), yL(3), 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = "center";
    ctx.fillText(`${t3.toFixed(1)} min`, xOf(t3), yL(3) + 18);
  }

  // preset dots
  for (const p of AIR_PRESETS) {
    const tp = timeToCo2(p.w);
    if (tp <= tMax) {
      ctx.fillStyle = "#c9a227";
      ctx.beginPath(); ctx.arc(xOf(tp), yL(3), 4, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function renderAir() {
  const w = state.air.w;
  const t3 = timeToCo2(w);
  const tO2 = timeToO2(w);
  $("air-time").textContent = t3.toFixed(1);
  $("air-o2").textContent = `氧气同期 ${(o2After(Math.min(t3, 200), w) * 100).toFixed(1)}%`;
  $("fact-vco2").textContent = vco2Lpm(w).toFixed(2);
  $("fact-o2time").textContent = tO2.toFixed(1);

  $("air-formula").innerHTML =
    `E <span class="op">=</span> 100 + 4P <span class="op">=</span> ${metabolicW(w).toFixed(0)} W · V̇O₂ <span class="op">=</span> E/348.3 <span class="op">=</span> ${vo2Lpm(w).toFixed(3)} L/min<br>` +
    `V̇CO₂ <span class="op">=</span> 0.85·V̇O₂ <span class="op">=</span> ${vco2Lpm(w).toFixed(3)} L/min<br>` +
    `t(3%) <span class="op">=</span> 0.0296·${V_AIR_L.toFixed(0)}/V̇CO₂ <span class="op">=</span> <span class="hl">${t3.toFixed(1)} min</span>`;

  $("air-crosscheck").innerHTML =
    `谁先到：t(3% CO₂) = ${t3.toFixed(1)} min ＜ t(15% O₂) = ${tO2.toFixed(1)} min；` +
    `比值 ${(t3 / tO2).toFixed(3)} = (0.0296/0.059)/0.85 —— 任何功率下都是二氧化碳先到`;

  drawAirChart();
}

// ── 4 · the mission tab ──────────────────────────────────────
function launchMission() {
  const m = state.mission;
  m.result = simulateMission({ launchHour: m.launchH });
  m.playhead = 0;
  m.running = true;
  m.launched = true;
  m.boomFlash = 0;
  $("mission-stamp").classList.add("hidden");
  $("mission-status").textContent =
    LAUNCH_PRESETS.find((p) => p.h === m.launchH)?.note
    ?? `${fmtClock(m.launchH)} 出发——看看潮流给不给这一夜。`;
  renderMissionCert();
  drawTideChart();
}

function missionWall() {
  const m = state.mission;
  return (m.launchH + m.playhead / 3600) % 24;
}

function trackAt(tau) {
  const m = state.mission;
  if (!m.result) return null;
  const tr = m.result.track;
  if (!tr.length) return null;
  if (tau <= tr[0].t) return tr[0];
  if (tau >= tr[tr.length - 1].t) return tr[tr.length - 1];
  let lo = 0, hi = tr.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (tr[mid].t <= tau) lo = mid; else hi = mid;
  }
  const a = tr[lo], b = tr[hi];
  const u = (tau - a.t) / (b.t - a.t || 1);
  return { t: tau, x: a.x + u * (b.x - a.x), phase: b.phase, co2: a.co2 + u * (b.co2 - a.co2) };
}

function stepMission(dt) {
  const m = state.mission;
  if (!m.running) return;
  m.playhead += dt * m.TIME_SCALE;
  const endT = m.result.track[m.result.track.length - 1].t;
  if (m.playhead >= endT) {
    m.playhead = endT;
    m.running = false;
  }
  renderMissionCert();
  const boomEv = m.result.events.find((e) => e.kind === "boom");
  if (boomEv) {
    const since = m.playhead - boomEv.t;
    if (since >= 0 && since < 3) m.boomFlash = Math.max(m.boomFlash, since);
  }
  drawTideChart();
}

const MX0 = -600, MX1 = 2700;
const mX = (x, W) => 40 + ((x - MX0) / (MX1 - MX0)) * (W - 80);

function drawMission() {
  const cv = $("mission-canvas"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const m = state.mission;
  const WL = 250;                                   // waterline
  const mToPx = 46;                                 // px per metre of depth

  // sky: dawn brightens near the end
  const dawnU = clamp(m.launched ? missionWall() - 4.4 : 0, 0, 1.35) / 1.35;
  const sky = ctx.createLinearGradient(0, 0, 0, WL);
  sky.addColorStop(0, mix("#0a1626", "#4a4a63", dawnU));
  sky.addColorStop(1, mix("#0d2033", "#a88d6a", dawnU));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, WL);

  // stars + moon
  if (dawnU < 0.6) {
    ctx.fillStyle = `rgba(232,228,208,${0.8 * (1 - dawnU / 0.6)})`;
    for (let i = 0; i < 60; i += 1) {
      const x = (i * 197.3) % W, y = ((i * 89.7) % (WL - 60));
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  }
  const moon = ctx.createRadialGradient(1050, 86, 6, 1050, 86, 90);
  moon.addColorStop(0, "rgba(238,230,190,.95)"); moon.addColorStop(0.25, "rgba(238,230,190,.35)");
  moon.addColorStop(1, "rgba(238,230,190,0)");
  ctx.fillStyle = moon; ctx.beginPath(); ctx.arc(1050, 86, 90, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = mix("#e8e4d0", "#c9b89a", dawnU);
  ctx.beginPath(); ctx.arc(1050, 86, 22, 0, Math.PI * 2); ctx.fill();

  // sea
  const sea = ctx.createLinearGradient(0, WL, 0, H);
  sea.addColorStop(0, mix("#123244", "#2c4a58", dawnU));
  sea.addColorStop(1, "#081724");
  ctx.fillStyle = sea; ctx.fillRect(0, WL, W, H - WL);
  ctx.strokeStyle = `rgba(214,228,224,${0.35 + 0.25 * (1 - dawnU)})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, WL); ctx.lineTo(W, WL); ctx.stroke();

  // tide arrows at playhead time
  const wall = missionWall();
  const cKn = m.launched ? tideKn(wall) : tideKn(23);
  const dir = Math.sign(cKn) || 1;
  const strength = clamp(Math.abs(cKn) / 2.1, 0.12, 1);
  ctx.strokeStyle = `rgba(150,205,225,${0.3 + 0.42 * strength})`;
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 14; i += 1) {
    const ax = 70 + i * 88 + ((m.playhead * 6) % 88) * dir;
    const ay = WL + 66 + (i % 4) * 66;
    const len = 34 * strength * dir;
    ctx.beginPath(); ctx.moveTo(ax - len / 2, ay); ctx.lineTo(ax + len / 2, ay);
    ctx.moveTo(ax + len / 2, ay); ctx.lineTo(ax + len / 2 - 7 * dir, ay - 5);
    ctx.moveTo(ax + len / 2, ay); ctx.lineTo(ax + len / 2 - 7 * dir, ay + 5);
    ctx.stroke();
  }

  // Manhattan skyline (left, behind the pier)
  ctx.fillStyle = mix("#0e1a24", "#3f3a44", dawnU);
  ctx.beginPath(); ctx.moveTo(0, WL);
  const spires = [[0, 60], [40, 96], [86, 40], [120, 130], [168, 52], [206, 78], [250, 44], [292, 120], [340, 66]];
  let sx = 0;
  for (const [w, h] of spires) {
    ctx.lineTo(sx, WL - h); ctx.lineTo(sx + w, WL - h);
    sx += w + 10;
  }
  ctx.lineTo(sx, WL); ctx.closePath(); ctx.fill();
  // Trinity spire + windmill
  ctx.fillRect(120, WL - 176, 8, 50);
  ctx.beginPath(); ctx.moveTo(124, WL - 176); ctx.lineTo(124, WL - 196); ctx.lineTo(130, WL - 176); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.translate(300, WL - 116); ctx.strokeStyle = mix("#0e1a24", "#3f3a44", dawnU); ctx.lineWidth = 4;
  const millSpin = (m.playhead / 14) % (Math.PI * 2);
  for (let k = 0; k < 4; k += 1) {
    const a = millSpin + (k * Math.PI) / 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26 * Math.cos(a), 26 * Math.sin(a)); ctx.stroke();
  }
  ctx.restore();

  // Whitehall pier (x = 0)
  const px0 = mX(0, W);
  ctx.fillStyle = mix("#13202b", "#4a444c", dawnU);
  ctx.fillRect(px0 - 58, WL - 46, 64, 50);
  ctx.fillRect(px0 - 46, WL - 88, 14, 44);
  ctx.fillStyle = "#e8d9a8";
  ctx.fillRect(px0 - 44, WL - 86, 6, 6);
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "rgba(226,232,220,.75)";
  ctx.fillText("白厅滑道 · 出发", px0 - 58, WL - 56);

  // Governors Island (bottom right)
  ctx.fillStyle = "#0c1c28";
  ctx.beginPath();
  ctx.moveTo(W - 20, H); ctx.quadraticCurveTo(W - 150, H - 46, W - 330, H);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(226,232,220,.7)";
  ctx.fillText("总督岛（哨兵在这里）", W - 300, H - 12);

  // the Eagle at x = 2000
  const pxS = mX(2000, W);
  drawEagle(ctx, pxS, WL, dawnU);

  // the route
  ctx.setLineDash([3, 9]); ctx.strokeStyle = "rgba(200,214,220,.22)";
  ctx.beginPath(); ctx.moveTo(mX(MX0 + 40, W), WL + 318); ctx.lineTo(mX(MX1 - 40, W), WL + 318);
  ctx.stroke(); ctx.setLineDash([]);

  // distance labels
  ctx.fillStyle = "rgba(226,232,220,.5)";
  ctx.fillText("1 km", mX(1000, W) - 10, WL + 336);
  ctx.fillText("2 km · 鹰号", mX(2000, W) - 26, WL + 336);

  if (!m.launched) {
    ctx.fillStyle = "rgba(226,232,220,.85)";
    ctx.font = "15px ui-monospace, Menlo, monospace";
    ctx.fillText(`拨好出发时刻（现在 ${fmtClock(m.launchH)}），点「出航」。`, 70, WL + 190);
    return;
  }

  const now = trackAt(m.playhead);
  const tau = m.playhead;

  // the released charge, pulsing under the Eagle
  const relEv = m.result.events.find((e) => e.kind === "release");
  if (relEv && tau >= relEv.t) {
    const boomEv = m.result.events.find((e) => e.kind === "boom");
    const armed = !boomEv || tau < boomEv.t;
    const pulse = armed ? 1 + 0.18 * Math.sin(tau * 6) : 0;
    ctx.fillStyle = "#5c1f21";
    ctx.beginPath(); ctx.ellipse(pxS, WL + 64, 14 * pulse, 9 * pulse, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = armed ? "#e0a13e" : "rgba(224,161,62,.25)";
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(pxS, WL + 64, 20 * pulse + 4, 0, Math.PI * 2); ctx.stroke();
    if (armed) {
      ctx.fillStyle = "#e8d9a8"; ctx.font = "11.5px ui-monospace, Menlo, monospace";
      ctx.fillText("引信走动中", pxS + 26, WL + 68);
    }
  }

  // the turtle
  const submerged = now.phase === "dive" || now.phase === "drill";
  const ty = submerged ? WL + 2.0 * mToPx : WL - 12;
  const tx = mX(now.x, W);
  drawTurtleSprite(ctx, tx, ty, submerged, tau);

  // whaleboat during tow
  if (now.phase === "tow") {
    ctx.strokeStyle = "rgba(210,220,214,.6)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx + 26, ty); ctx.lineTo(tx + 86, ty); ctx.stroke();
    ctx.fillStyle = "#101c26";
    ctx.beginPath();
    ctx.moveTo(tx + 84, ty); ctx.quadraticCurveTo(tx + 104, ty - 10, tx + 124, ty);
    ctx.quadraticCurveTo(tx + 104, ty + 8, tx + 84, ty); ctx.fill();
    ctx.strokeStyle = "#2a3b46"; ctx.stroke();
  }

  // the auger during drill
  if (now.phase === "drill") {
    ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 2.4;
    const wob = Math.sin(tau * 22) * 3;
    ctx.beginPath(); ctx.moveTo(tx, ty - 12); ctx.lineTo(tx + wob, WL + 58); ctx.stroke();
    ctx.strokeStyle = "rgba(224,161,62,.8)";
    for (let k = 0; k < 3; k += 1) {
      const r = 4 + ((tau * 26 + k * 9) % 26);
      ctx.beginPath(); ctx.arc(tx + wob, WL + 58, r, -Math.PI / 3, Math.PI / 3); ctx.stroke();
    }
    ctx.strokeStyle = "#c9a227";
  }

  // the boom
  const boomEv = m.result.events.find((e) => e.kind === "boom");
  if (boomEv && tau >= boomEv.t && tau < boomEv.t + 3) {
    const u = (tau - boomEv.t) / 3;
    const flash = 1 - u;
    const colH = 130 * Math.sin(Math.min(u * 1.25, 1) * Math.PI);
    ctx.fillStyle = `rgba(238,226,190,${0.75 * flash + 0.1})`;
    ctx.beginPath();
    ctx.moveTo(pxS - 26, WL + 40);
    ctx.quadraticCurveTo(pxS - 10, WL - colH * 0.7, pxS, WL - colH);
    ctx.quadraticCurveTo(pxS + 12, WL - colH * 0.6, pxS + 30, WL + 40);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(240,235,214,${flash})`;
    ctx.lineWidth = 3;
    for (let k = 0; k < 3; k += 1) {
      const r = 24 + u * 150 + k * 16;
      ctx.beginPath(); ctx.arc(pxS, WL + 20, r, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // HUD
  ctx.fillStyle = "rgba(8,15,24,.82)";
  ctx.fillRect(26, 16, 640, 84);
  ctx.fillStyle = "#f4f6ee"; ctx.font = "14px ui-monospace, Menlo, monospace";
  ctx.fillText(`时刻 ${fmtClock(wall)} · ${phaseLabel(now.phase)}`, 40, 40);
  ctx.fillText(`已走 ${Math.max(now.x, 0).toFixed(0)} m / ${MISSION.distance} m · 剩 ${Math.max(MISSION.distance - now.x, 0).toFixed(0)} m`, 40, 62);
  ctx.fillText(`潮流 ${cKn >= 0 ? "+" : ""}${cKn.toFixed(2)} kn（${cKn >= 0 ? "顺" : "顶"}流） · CO₂ ${(now.co2 * 100).toFixed(2)}%`, 40, 84);

  // CO₂ bar
  ctx.fillStyle = "rgba(8,15,24,.82)";
  ctx.fillRect(W - 208, 16, 182, 48);
  ctx.fillStyle = "#3a2526"; ctx.fillRect(W - 198, 44, 162, 11);
  ctx.fillStyle = now.co2 >= CO2_ABORT ? "#c0392b" : "#c9a227";
  ctx.fillRect(W - 198, 44, 162 * clamp(now.co2 / 0.05, 0, 1), 11);
  ctx.fillStyle = "#f4f6ee"; ctx.font = "13px ui-monospace, Menlo, monospace";
  ctx.fillText(`CO₂ ${(now.co2 * 100).toFixed(2)}%`, W - 198, 36);
}

function phaseLabel(p) {
  return {
    tow: "捕鲸艇拖带中", surface: "水面巡航（换气中）", dive: "潜航最终段",
    drill: "船底钻孔", retreat: "撤退", done: "结束",
  }[p] ?? p;
}

function drawEagle(ctx, x, WL, dawnU) {
  ctx.save();
  ctx.translate(x, WL);
  const hull = mix("#0f1d29", "#3d3944", dawnU);
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-150, 0); ctx.lineTo(-140, 44); ctx.lineTo(120, 44); ctx.lineTo(158, 0);
  ctx.closePath(); ctx.fill();
  // gun ports
  ctx.fillStyle = "#060d13";
  for (let i = 0; i < 7; i += 1) ctx.fillRect(-120 + i * 34, 22, 14, 12);
  // masts + yards
  ctx.strokeStyle = mix("#1a2a36", "#4a444c", dawnU); ctx.lineWidth = 4;
  for (const mx of [-80, 0, 84]) {
    ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, -128); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(mx - 44, -96); ctx.lineTo(mx + 44, -96); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx - 32, -58); ctx.lineTo(mx + 32, -58); ctx.stroke();
    ctx.lineWidth = 4;
  }
  // sails furled hints
  ctx.fillStyle = "rgba(200,196,178,.14)";
  ctx.fillRect(-44, -96, 88, 8); ctx.fillRect(-32, -58, 64, 7);
  // riding lantern + anchor rope
  ctx.fillStyle = "#e8d9a8";
  ctx.beginPath(); ctx.arc(0, -132, 3.4, 0, Math.PI * 2); ctx.fill();
  const glow = ctx.createRadialGradient(0, -132, 2, 0, -132, 26);
  glow.addColorStop(0, "rgba(232,217,168,.5)"); glow.addColorStop(1, "rgba(232,217,168,0)");
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -132, 26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(210,220,214,.5)"; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(158, 0); ctx.quadraticCurveTo(230, 30, 300, 44); ctx.stroke();
  ctx.fillStyle = "rgba(233,238,226,.95)"; ctx.font = "13px ui-monospace, Menlo, monospace";
  ctx.fillText("HMS 鹰号 · 豪勋爵旗舰", -150, 88);
  ctx.restore();
}

function drawTurtleSprite(ctx, x, y, submerged, tau) {
  ctx.save();
  ctx.translate(x, y);
  if (submerged) ctx.globalAlpha = 0.9;
  // hull
  const g = ctx.createLinearGradient(0, -12, 0, 12);
  g.addColorStop(0, "#96744a"); g.addColorStop(1, "#5a4227");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, 27, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#241a10"; ctx.lineWidth = 2; ctx.stroke();
  // bands
  ctx.strokeStyle = "#39414b"; ctx.lineWidth = 2;
  for (const bx of [-14, -2, 10]) {
    ctx.beginPath(); ctx.moveTo(bx, -12.4); ctx.lineTo(bx, 12.4); ctx.stroke();
  }
  // dome
  ctx.fillStyle = "#a8874f";
  ctx.beginPath(); ctx.arc(0, -12, 8, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = "#241a10"; ctx.lineWidth = 1.6; ctx.stroke();
  if (!submerged) {
    ctx.strokeStyle = "#39414b"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(5, -19); ctx.lineTo(7, -27); ctx.stroke();
  }
  // propeller
  ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 2;
  const spin = Math.sin(tau * 20) * 6;
  ctx.beginPath(); ctx.ellipse(30, 3, 2.6, 8 + spin * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
  // bubbles
  if (submerged) {
    ctx.fillStyle = "rgba(220,236,240,.5)";
    for (let i = 0; i < 5; i += 1) {
      const bt = (tau * 1.4 + i * 0.8) % 4;
      ctx.beginPath();
      ctx.arc(-24 + i * 11, -16 - bt * 9, 1.4 + (i % 3) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function mix(a, b, u) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp(u, 0, 1)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function renderMissionCert() {
  const m = state.mission;
  if (!m.result) return;
  const r = m.result;
  const passed = r.events.filter((e) => e.t <= m.playhead + 0.01);
  const lines = [];
  for (const e of passed) {
    if (e.kind === "launch") lines.push(`<b>出航</b> ${fmtClock(m.launchH)} · 捕鲸艇拖带`);
    if (e.kind === "castoff") lines.push(`<b>解缆</b> ${fmtClock(m.launchH + e.t)} · 自航 ${Math.round(MISSION.distance - e.x)} m`);
    if (e.kind === "dive") lines.push(`<b>下潜</b> ${fmtClock(m.launchH + e.t)} · 距船 ${Math.round(MISSION.distance - e.x)} m`);
    if (e.kind === "arrive") lines.push(`<b>抵船底</b> ${fmtClock(m.launchH + e.t)} · 航程 ${(e.t / 3600).toFixed(1)} h`);
    if (e.kind === "vent") lines.push(`<b>换气</b> ${fmtClock(m.launchH + e.t)} · 被迫上浮`);
    if (e.kind === "spotted") lines.push(`<b>暴露</b> ${fmtClock(m.launchH + e.t)} · 哨兵喊声`);
    if (e.kind === "abort") lines.push(`<b>放弃</b> ${fmtClock(m.launchH + e.t)} · CO₂ ${(e.co2 * 100).toFixed(1)}%`);
    if (e.kind === "release") lines.push(`<b>放雷</b> ${fmtClock(m.launchH + e.t)} · 引信 ${MISSION.fuseMin} min`);
    if (e.kind === "fatigue") lines.push(`<b>力竭</b> ${fmtClock(m.launchH + e.t)} · 四小时摇满`);
    if (e.kind === "ashore") lines.push(`<b>登岸</b> ${fmtClock(m.launchH + e.t)} · 白厅石阶`);
    if (e.kind === "boom") lines.push(`<b>起爆</b> ${fmtClock(m.launchH + e.t)} · 距离 ${r.detonationKm.toFixed(1)} km`);
    if (e.kind === "dawn") lines.push(`<b>天明</b> ${fmtClock(m.launchH + e.t)} · 未及撤离`);
  }
  $("mission-cert").innerHTML = lines.join("<br>") || "出航中……";

  const stamp = $("mission-stamp");
  if (!m.running) {
    stamp.classList.remove("hidden", "ok");
    if (r.outcome === "boom") { stamp.textContent = "未附着"; }
    else { stamp.textContent = "未抵达"; }
    $("mission-status").textContent = r.outcome === "boom"
      ? (r.ashoreBeforeBoom
        ? `起爆前他已在岸上。火药从未拧上船壳——但两百五十年前的这一夜，就是潜艇战的第 1 号档案。`
        : `起爆时他还在河上被潮水推着走——出发太早，撤退的顺流还没转过来。`)
      : `天亮了，任务失败：这一班潮流没有给他机会。`;
  }
}

function drawTideChart() {
  const cv = $("tide-chart"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const pad = { l: 40, r: 16, t: 18, b: 34 };
  const h0 = 19, h1 = 31.5;
  const xOf = (h) => pad.l + (((h - h0) / (h1 - h0)) * (W - pad.l - pad.r));
  const yOf = (kn) => H / 2 - (kn / 2.6) * (H / 2 - pad.t);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fbf8ec"; ctx.fillRect(0, 0, W, H);

  // window band: launches that make it (scan the tide gate)
  ctx.fillStyle = "rgba(29,74,44,.12)";
  ctx.fillRect(xOf(19), pad.t, xOf(23.25) - xOf(19), H - pad.t - pad.b);

  // helpful / adverse shading
  ctx.fillStyle = "rgba(28,79,110,.10)";
  ctx.fillRect(pad.l, yOf(0), W - pad.l - pad.r, H / 2 - yOf(0));

  ctx.strokeStyle = "#d8d2bb"; ctx.lineWidth = 1;
  ctx.fillStyle = "#59616d"; ctx.font = "10.5px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  for (let h = 19; h <= 31; h += 2) {
    ctx.beginPath(); ctx.moveTo(xOf(h), pad.t); ctx.lineTo(xOf(h), H - pad.b); ctx.stroke();
    ctx.fillText(fmtClock(h % 24), xOf(h), H - pad.b + 14);
  }
  ctx.textAlign = "right";
  for (const kn of [-2, -1, 0, 1, 2]) {
    ctx.beginPath(); ctx.moveTo(pad.l, yOf(kn)); ctx.lineTo(W - pad.r, yOf(kn)); ctx.stroke();
    ctx.fillText(`${kn > 0 ? "+" : ""}${kn}`, pad.l - 4, yOf(kn) + 3);
  }
  ctx.beginPath(); ctx.moveTo(pad.l, yOf(0)); ctx.lineTo(W - pad.r, yOf(0));
  ctx.strokeStyle = "#8a8570"; ctx.lineWidth = 1.4; ctx.stroke();

  // the curve
  ctx.strokeStyle = "#16455c"; ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i <= 300; i += 1) {
    const h = h0 + ((h1 - h0) * i) / 300;
    const y = tideKn(h);
    if (i === 0) ctx.moveTo(xOf(h), yOf(y)); else ctx.lineTo(xOf(h), yOf(y));
  }
  ctx.stroke();

  // slacks
  ctx.fillStyle = "#59616d"; ctx.textAlign = "center";
  for (const s of SLACKS) {
    if (s < h0 || s > h1) continue;
    ctx.beginPath(); ctx.arc(xOf(s), yOf(0), 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillText("平潮", xOf(s), yOf(0) + (s > 24 ? 26 : -16));
  }

  // event dots from the last run
  const m = state.mission;
  if (m.result) {
    const colors = { castoff: "#8a6b2f", dive: "#1c4f6e", arrive: "#1d4a2c", abort: "#b3842b", boom: "#a3282a", dawn: "#59616d" };
    for (const e of m.result.events) {
      if (!(e.kind in colors)) continue;
      const hh = m.launchH + e.t;
      if (hh < h0 || hh > h1) continue;
      ctx.fillStyle = colors[e.kind];
      ctx.beginPath(); ctx.arc(xOf(hh), yOf(tideKn(hh)) - 8, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // the launch line
  ctx.strokeStyle = "#a3282a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(xOf(m.launchH), pad.t); ctx.lineTo(xOf(m.launchH), H - pad.b); ctx.stroke();
  ctx.fillStyle = "#a3282a"; ctx.textAlign = "center"; ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.fillText(`出发 ${fmtClock(m.launchH % 24)}`, xOf(m.launchH), pad.t - 4 < 10 ? 12 : pad.t + 10);

  ctx.fillStyle = "#59616d"; ctx.textAlign = "left"; ctx.font = "10.5px ui-monospace, Menlo, monospace";
  ctx.fillText("潮流 kn（负 = 顶流）· 绿带 = 能赶上的出发窗口", pad.l + 4, pad.t + 8);
}

// ── 5 · the ladder tab ───────────────────────────────────────
function buildLadder() {
  const svg = $("ladder-chart");
  const NS = "http://www.w3.org/2000/svg";
  const W = 1280, H = 420;
  const pad = { l: 60, r: 40 };
  const y0 = 1774, y1 = 1866;
  const px = (year) => pad.l + ((year - y0) / (y1 - y0)) * (W - pad.l - pad.r);

  const AX = 250;
  svg.innerHTML = "";

  const axis = document.createElementNS(NS, "line");
  axis.setAttribute("x1", pad.l - 20); axis.setAttribute("x2", W - pad.r + 10);
  axis.setAttribute("y1", AX); axis.setAttribute("y2", AX);
  axis.setAttribute("class", "axis");
  svg.appendChild(axis);

  for (const dec of [1780, 1800, 1820, 1840, 1860]) {
    const g = document.createElementNS(NS, "line");
    g.setAttribute("x1", px(dec)); g.setAttribute("x2", px(dec));
    g.setAttribute("y1", 70); g.setAttribute("y2", 358);
    g.setAttribute("class", "gridline");
    svg.appendChild(g);
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", px(dec)); t.setAttribute("y", 392);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("class", "year-label");
    t.textContent = `${dec}`;
    svg.appendChild(t);
  }

  // stagger same-year pins (1775 ×2, 1776 ×2)
  const yearCount = {};
  const yearSeen = {};
  for (const e of EVENTS) yearCount[e.y] = (yearCount[e.y] || 0) + 1;
  const pinXs = EVENTS.map((e) => {
    const idx = yearSeen[e.y] || 0;
    yearSeen[e.y] = idx + 1;
    const n = yearCount[e.y];
    const spread = n > 1 ? (idx - (n - 1) / 2) * 26 : 0;
    return px(e.y) + spread;
  });

  const rows = [
    { y: 232, last: -Infinity }, { y: 196, last: -Infinity }, { y: 160, last: -Infinity },
    { y: 303, last: -Infinity }, { y: 337, last: -Infinity }, { y: 371, last: -Infinity },
  ];
  EVENTS.forEach((e, i) => {
    const x = pinXs[i];
    const pin = document.createElementNS(NS, "g");
    pin.setAttribute("class", "pin");
    pin.dataset.i = i;

    const labelW = e.short.length * 15 + 26;
    const fitsRight = x + 10 + labelW < W - pad.r;
    const startX = fitsRight ? x + 10 : x - 10 - labelW;
    let row = rows.find((r) => r.last < startX - 4) || rows[0];
    row.last = startX + labelW;

    const link = document.createElementNS(NS, "line");
    link.setAttribute("x1", x); link.setAttribute("y1", AX);
    link.setAttribute("x2", startX + (fitsRight ? 2 : labelW - 2));
    link.setAttribute("y2", row.y + (row.y < AX ? 7 : -6));
    link.setAttribute("stroke", "rgba(89,97,109,.5)");
    pin.appendChild(link);

    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", startX);
    t.setAttribute("y", row.y);
    t.setAttribute("class", "title-label");
    t.textContent = e.short;
    pin.appendChild(t);

    if (e.star) {
      drawSvgStar(pin, x, AX, 16, "#a3282a");
    } else {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", x); c.setAttribute("cy", AX);
      c.setAttribute("r", 7);
      c.setAttribute("fill", e.kind === "attack" ? "#a3282a"
        : e.kind === "build" ? "#8a4b1f"
        : e.kind === "trial" ? "#1c4f9c"
        : e.kind === "mine" ? "#c9a227"
        : e.kind === "death" ? "#232823" : "#1d4a2c");
      c.setAttribute("stroke", "#f2edda");
      c.setAttribute("stroke-width", 2);
      pin.appendChild(c);
    }

    pin.addEventListener("click", () => selectEvent(i));
    svg.appendChild(pin);
  });

  // programmatic overlap check (getBBox): nudge down until zero collisions
  document.body.getBoundingClientRect();               // layout flush
  let collisions = 0;
  for (let round = 0; round < 8; round += 1) {
    const labels = [...svg.querySelectorAll(".title-label")];
    const boxes = labels.map((l) => ({ el: l, ...l.getBBox() }));
    let hits = 0;
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i], b = boxes[j];
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width
          && a.y < b.y + b.height && b.y < a.y + a.height;
        if (overlap) {
          hits += 1; collisions += 1;
          const lower = a.y > b.y ? a : b;
          lower.el.setAttribute("y", Number(lower.el.getAttribute("y")) + 18);
        }
      }
    }
    if (hits === 0) break;
  }
  console.assert(collisions === 0, `ladder labels: ${collisions} collisions after nudges`);

  selectEvent(state.event);
}

function drawSvgStar(parent, x, y, r, color) {
  const NS = "http://www.w3.org/2000/svg";
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${x + rad * Math.cos(a)},${y + rad * Math.sin(a)}`);
  }
  const poly = document.createElementNS(NS, "polygon");
  poly.setAttribute("points", pts.join(" "));
  poly.setAttribute("fill", color);
  poly.setAttribute("stroke", "#f2edda");
  poly.setAttribute("stroke-width", 1.5);
  parent.appendChild(poly);
}

function selectEvent(i) {
  const e = EVENTS[i];
  state.event = i;
  const card = $("record-card");
  card.innerHTML =
    `<div class="rc-head">` +
    `<span class="rc-title">${e.title}</span>` +
    `<span class="rc-date">${e.date}</span>` +
    `<span class="rc-kind">${kindLabel(e.kind)}</span>` +
    `${e.star ? `<span class="star-flag">★ 今晚的主角</span>` : ""}` +
    `</div><p style="margin:8px 0 0">${e.text}</p>`;
}

// ── the animation loop ───────────────────────────────────────
function step(dt) {
  stepTrim(dt);
  stepMission(dt);
}

function renderActive() {
  const active = state.tab;
  if (active === "trim") { drawTrim(); }
  else if (active === "crank") { drawCrankChart(); }
  else if (active === "air") { drawAirChart(); }
  else if (active === "mission") { drawMission(); drawTideChart(); }
}

function frame() {
  if (!state.videoMode) step(1 / 60);
  renderActive();
  rafId = requestAnimationFrame(frame);
}

// ── wiring ───────────────────────────────────────────────────
$("s-ballast").addEventListener("input", (e) => {
  state.trim.ballast = Number(e.target.value);
  renderTrim(); drawTrim();
});
$("btn-blow").addEventListener("click", () => {
  if (state.trim.leadDropped) return;
  state.trim.leadDropped = true;
  state.trim.leadFall = 0;
  renderTrim(); drawTrim();
});
$("btn-reset-trim").addEventListener("click", resetTrim);
function resetTrim() {
  state.trim.ballast = 0;
  state.trim.leadDropped = false;
  state.trim.leadFall = 0;
  state.trim.depth = draftForMass(M_DRY);
  renderTrim(); drawTrim();
}

$("s-power").addEventListener("input", (e) => setCrank(Number(e.target.value)));

$("s-airpower").addEventListener("input", (e) => setAirPower(Number(e.target.value)));

$("s-launch").addEventListener("input", (e) => {
  state.mission.launchH = Number(e.target.value);
  $("o-launch").textContent = fmtClock(state.mission.launchH % 24);
  drawTideChart();
});
$("btn-launch").addEventListener("click", launchMission);

for (const b of $("tabs").children) {
  b.addEventListener("click", () => setTab(b.dataset.tab));
}

// ── video hooks ──────────────────────────────────────────────
window.__demo = {
  setTab,
  scrollToTop,
  setVideoMode(on) {
    state.videoMode = on;
    document.body.classList.toggle("video-mode", on);
    if (on && rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    if (!on && rafId === null) { rafId = requestAnimationFrame(frame); }
  },
  tick(dt) { step(dt); renderActive(); },
  setBallast(kg) {
    state.trim.ballast = clamp(kg, 0, 1400);
    renderTrim(); drawTrim();
  },
  blowLead() {
    state.trim.leadDropped = true;
    state.trim.leadFall = 0;
    renderTrim(); drawTrim();
  },
  resetTrim,
  setCrank,
  setAirPower,
  selectAirPreset,
  setLaunch(h) {
    state.mission.launchH = h;
    $("s-launch").value = h;
    $("o-launch").textContent = fmtClock(h % 24);
    drawTideChart();
  },
  selectLaunchPreset(i) { selectLaunchPreset(i); },
  launchMission,
  missionActive: () => state.mission.running,
  missionPlayhead: () => state.mission.playhead,
  missionResult: () => state.mission.result,
  selectEvent,
};

// ── boot ─────────────────────────────────────────────────────
buildPresets();
buildCrankPresets();
buildAirPresets();
selectAirPreset(0);
renderTrim();
renderCrank();
launchMission();            // the 23:00 history run waits, finished, behind the curtain
state.mission.running = false;
state.mission.playhead = state.mission.result.track[state.mission.result.track.length - 1].t;
renderMissionCert();
buildLadder();
drawTideChart();
setTab("trim");
rafId = requestAnimationFrame(frame);
