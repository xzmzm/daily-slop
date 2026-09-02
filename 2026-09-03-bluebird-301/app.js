// app.js — Bluebird 301 · the studio wiring.
// Tabs: the measured-mile bench (a live two-run record attempt), the cube-law
// chart, Cardano's exact terminal-speed bench, the tyre rim, the record
// ladder. All physics comes from physics.js; every number on screen is live.

import {
  W_PER_HP, MPH, MS, G, MILE,
  airDensity, densityRatio, aeroC, rollC, wheelPower,
  terminalSpeed, cardanoDisc, requiredPower, bisectSpeed,
  mphFromSeconds, harmonicMean, windRecord,
  wheelRpm, rimG, BLUEBIRD, configSpeed, PRESETS,
  RECORDS, equivalentPowerHp, kindLabel,
} from "./physics.js";

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ── shared car configuration ───────────────────────────────────────────────
let CONFIG = { ...BLUEBIRD };
const RUN_UP = 12875;       // metres of flying-start approach (8 miles — you need it to settle at v*)
const SHUTDOWN = 500;       // metres past the trap before braking
const BRAKE_A = 3.3;        // m/s²
const TRACTION_A = 4.6;     // m/s² the salt lets you put down

// ── tabs ───────────────────────────────────────────────────────────────────
function gotoTab(name) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.id === `tab-${name}`));
  if (name === "cube") drawCube();
  if (name === "limit") updateLimit();
  if (name === "ladder") selectRecord(selectedRecord == null ? 4 : selectedRecord);
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => gotoTab(b.dataset.tab)));

// ── presets ────────────────────────────────────────────────────────────────
for (const p of PRESETS) {
  const b = document.createElement("button");
  b.textContent = p.label;
  b.addEventListener("click", () => applyConfig(p.cfg, p.tab));
  $("presets").appendChild(b);
}

function applyConfig(cfg, tab) {
  CONFIG = { ...cfg };
  syncSliders();
  updateLimit();
  drawCube();
  resetRuns();
  if (tab) gotoTab(tab);
}

function syncSliders() {
  $("s-p").value = CONFIG.pEngine;
  $("s-a").value = CONFIG.area;
  $("s-cd").value = CONFIG.cd;
  $("s-m").value = CONFIG.mass;
  $("s-mu").value = CONFIG.mu;
  $("s-h").value = CONFIG.h;
  $("s-boost").checked = !!CONFIG.supercharged;
  $("cube-power").value = Math.round(wheelPower(CONFIG) / W_PER_HP);
  updateSliderOutputs();
}

function updateSliderOutputs() {
  $("o-p").textContent = fmt(CONFIG.pEngine);
  $("o-a").textContent = CONFIG.area.toFixed(2);
  $("o-cd").textContent = CONFIG.cd.toFixed(2);
  $("o-m").textContent = fmt(CONFIG.mass);
  $("o-mu").textContent = CONFIG.mu.toFixed(3);
  $("o-h").textContent = fmt(CONFIG.h);
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 · the measured mile
// ═══════════════════════════════════════════════════════════════════════════

const SIM = {
  running: false, video: false, factor: 8,
  dir: 1, x: 0, v: 0, t: 0,
  inTrap: false, tEnter: 0, braking: false,
  result: null,          // {t, mph} of the run in flight
  results: [],           // completed runs
  wind: 5,               // mph, positive blows toward +x (helps run 1)
};

function simParams() {
  const a = aeroC(CONFIG.h, CONFIG.cd, CONFIG.area);
  const b = rollC(CONFIG.mu, CONFIG.mass);
  const P = wheelPower(CONFIG);
  return { a, b, P, m: CONFIG.mass };
}

function startRun() {
  if (SIM.results.length >= 2) return;
  SIM.dir = SIM.results.length === 0 ? 1 : -1;
  SIM.x = SIM.dir === 1 ? -RUN_UP : MILE + RUN_UP;
  SIM.v = 0; SIM.t = 0;
  SIM.inTrap = false; SIM.braking = false; SIM.result = null;
  SIM.running = true;
  $("btn-launch").disabled = true;
  $("btn-return").disabled = true;
  $("run-status").innerHTML = SIM.dir === 1
    ? "<b>去程</b>：尾风方向发车，飞驰进场 —— 绿旗进测量英里，秒表开始计时。"
    : "<b>返程</b>：一小时内反向再跑一趟 —— 风向对这趟正好反过来。";
  renderSalt();
}

function stepSim(dt) {
  if (!SIM.running) return;
  const { a, b, P, m } = simParams();
  const u = SIM.v - SIM.wind * MS * SIM.dir;          // airspeed along course
  let F = 0;
  if (!SIM.braking) F = Math.min(P / Math.max(SIM.v, 3), TRACTION_A * m);
  else F = -BRAKE_A * m;
  const dragF = a * u * u;
  SIM.v = Math.max(0, SIM.v + ((F - dragF - b) / m) * dt);
  const prevX = SIM.x;
  SIM.x += SIM.v * dt * SIM.dir;
  SIM.t += dt;

  const entry = SIM.dir === 1 ? 0 : MILE;
  const exit = SIM.dir === 1 ? MILE : 0;
  const crossed = (plane) => (SIM.dir === 1 ? prevX < plane && SIM.x >= plane : prevX > plane && SIM.x <= plane);
  const frac = (plane) => Math.abs((plane - prevX) / (SIM.x - prevX || 1));
  if (!SIM.inTrap && crossed(entry)) {
    SIM.inTrap = true;
    SIM.tEnter = SIM.t - dt * (1 - frac(entry));
  }
  if (SIM.inTrap && crossed(exit)) {
    SIM.inTrap = false;
    const tMile = SIM.t - dt * (1 - frac(exit)) - SIM.tEnter;
    SIM.result = { t: tMile, mph: 3600 / tMile };   // one mile, seconds in, mph out
  }
  const past = SIM.dir === 1 ? SIM.x - MILE : MILE - SIM.x;
  if (SIM.result && !SIM.braking && past > SHUTDOWN) SIM.braking = true;
  if (SIM.braking && SIM.v < 0.8) {
    SIM.running = false;
    SIM.results.push(SIM.result);
    SIM.result = null;
    updateRunList();
    if (SIM.results.length === 1) $("btn-return").disabled = false;
    if (SIM.results.length >= 2) showCertificate();
    else $("run-status").innerHTML = "第一趟完成。按规则调头，<b>一小时内</b>跑返程。";
  }
}

function updateRunList() {
  const cells = [$("run1-out"), $("run2-out")];
  SIM.results.forEach((r, i) => {
    cells[i].textContent = `${r.t.toFixed(2)} s → ${r.mph.toFixed(1)} mph`;
  });
  if (SIM.results.length >= 2) {
    const rec = harmonicMean(SIM.results[0].mph, SIM.results[1].mph);
    $("record-out").textContent = `${rec.toFixed(3)} mph`;
  }
}

function showCertificate() {
  const [r1, r2] = SIM.results;
  const rec = harmonicMean(r1.mph, r2.mph);
  const arith = (r1.mph + r2.mph) / 2;
  const vTrue = configSpeed(CONFIG) * MPH;
  const windCost = Math.abs(SIM.wind) > 0.01 ? windRecord(vTrue, Math.abs(SIM.wind)) : null;
  const isBird = CONFIG.pEngine === BLUEBIRD.pEngine && CONFIG.supercharged && Math.abs(CONFIG.h - BLUEBIRD.h) < 40;
  const delta = isBird ? rec - 301.129 : null;
  const lines = [
    `第一趟  ${r1.t.toFixed(2)} s   →  ${r1.mph.toFixed(3)} mph`,
    `第二趟  ${r2.t.toFixed(2)} s   →  ${r2.mph.toFixed(3)} mph`,
    `纪录 = 2 × 1 英里 ÷ (${r1.t.toFixed(2)} + ${r2.t.toFixed(2)}) s = <b>${rec.toFixed(3)} mph</b>`,
    `（两趟速度的算术平均是 ${arith.toFixed(3)} —— 高了 ${(arith - rec).toFixed(3)}，秒表给不了它）`,
  ];
  if (windCost != null) lines.push(`稳定 ${fmt(Math.abs(SIM.wind))} mph 风的理论损耗 w²/v ≈ ${(vTrue - windCost).toFixed(2)} mph`);
  if (delta != null) {
    lines.push(`对照 1935-09-03 真实成绩 301.129 mph：<b>${delta >= 0 ? "+" : ""}${delta.toFixed(2)} mph</b>`);
  }
  const cert = $("certificate");
  cert.hidden = false;
  cert.innerHTML = `<h3>计时小屋的成绩单</h3><div class="cert-lines">${lines.join("<br>")}</div>` +
    (rec > 300 && rec < 640 ? `<div class="stamp">邦纳维尔<br>盐上认证<br>${rec > 300 ? "300+" : ""} MPH</div>` : "");
  $("run-status").innerHTML = `两趟完成，纪录 <b>${rec.toFixed(3)} mph</b>。${isBird && Math.abs(delta) < 2
    ? "引擎、车重、海拔都是史实，风阻与滚阻是拟合参数 —— 卡尔达诺的解几乎正好落在坎贝尔的成绩上。"
    : "换一组参数再来 —— 「极限速度」页的每个旋钮都通向这里。"}`;
}

function resetRuns() {
  SIM.results = [];
  SIM.result = null;
  SIM.running = false;
  SIM.dir = 1;
  SIM.x = -140; SIM.v = 0;
  $("btn-launch").disabled = false;
  $("btn-return").disabled = true;
  $("run1-out").textContent = "—";
  $("run2-out").textContent = "—";
  $("record-out").textContent = "—";
  $("certificate").hidden = true;
  $("trap-clock").innerHTML = "--.-- <span>s</span>";
  $("trap-mph").textContent = "— mph";
  $("run-status").innerHTML = "纪录不是速度计说了算：一台车，一段<b>飞驰的测量英里</b>（1,609.344 米），两只百分之一秒的秒表，一小时内<b>相反方向跑两趟</b>，取调和平均。点「发车」看全过程。";
  renderSalt();
}

$("btn-launch").addEventListener("click", startRun);
$("btn-return").addEventListener("click", startRun);
$("btn-reset-run").addEventListener("click", resetRuns);
$("wind").addEventListener("input", (e) => {
  SIM.wind = Number(e.target.value);
  $("wind-out").textContent = (SIM.wind >= 0 ? "+" : "") + SIM.wind;
});
$("factor").addEventListener("change", (e) => { SIM.factor = Number(e.target.value); });

// ── the salt-flat scene ────────────────────────────────────────────────────
const saltC = $("salt-canvas");
const sctx = saltC.getContext("2d");
const W = saltC.width, H = saltC.height;
const HORIZON = 218;
const SCALE = 8;                 // px per metre
const CAR_X = 400;               // the car parks at this screen x
const GROUND = 432;              // screen y of the salt at the car's depth

const ridgeY = (x, seed) => {
  const s = Math.sin(x * 0.011 + seed) + Math.sin(x * 0.027 + seed * 2.3) * 0.55 + Math.sin(x * 0.005 + seed * 0.7) * 1.4;
  return s;
};

function renderSalt() {
  const camX = SIM.x;
  sctx.clearRect(0, 0, W, H);

  // sky
  let g = sctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, "#8fbdd8");
  g.addColorStop(0.75, "#d9e9f1");
  g.addColorStop(1, "#f0f2e9");
  sctx.fillStyle = g;
  sctx.fillRect(0, 0, W, HORIZON);
  // sun glare
  sctx.fillStyle = "rgba(255,250,235,0.9)";
  sctx.beginPath();
  sctx.arc(W - 220, 64, 26, 0, 7);
  sctx.fill();
  sctx.fillStyle = "rgba(255,252,240,0.28)";
  sctx.beginPath();
  sctx.arc(W - 220, 64, 58, 0, 7);
  sctx.fill();

  // mountain ridges (parallax)
  const drawRidge = (par, base, amp, color) => {
    const off = camX * SCALE * par;
    sctx.fillStyle = color;
    sctx.beginPath();
    sctx.moveTo(0, HORIZON);
    for (let sx = 0; sx <= W; sx += 8) {
      const y = base - amp * (0.55 + ridgeY(sx + off, par * 10));
      sctx.lineTo(sx, y);
    }
    sctx.lineTo(W, HORIZON);
    sctx.closePath();
    sctx.fill();
  };
  drawRidge(0.05, HORIZON - 6, 34, "#b7c6d4");
  drawRidge(0.13, HORIZON - 2, 20, "#c7d3dd");

  // mirage band + salt
  sctx.fillStyle = "rgba(255,255,255,0.55)";
  sctx.fillRect(0, HORIZON, W, 3);
  g = sctx.createLinearGradient(0, HORIZON, 0, H);
  g.addColorStop(0, "#f2efe6");
  g.addColorStop(0.35, "#eae6da");
  g.addColorStop(1, "#dcd7c8");
  sctx.fillStyle = g;
  sctx.fillRect(0, HORIZON + 3, W, H - HORIZON);

  // salt streaks (full parallax) — seeded per world position, not per frame
  sctx.strokeStyle = "rgba(150, 144, 128, 0.30)";
  sctx.lineWidth = 1;
  const streak = (wx, wy, len) => {
    const sx = (wx - camX) * SCALE + CAR_X;
    if (sx < -60 || sx > W + 60) return;
    sctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(wx * 1.7));
    sctx.beginPath();
    sctx.moveTo(sx, wy);
    sctx.lineTo(sx + len, wy);
    sctx.stroke();
  };
  for (let wx = Math.floor((camX - 200) / 7) * 7; wx < camX + 200; wx += 7) {
    streak(wx, HORIZON + 14 + (Math.abs(Math.sin(wx * 0.33)) * 130));
    streak(wx + 3, HORIZON + 26 + (Math.abs(Math.cos(wx * 0.21)) * 200));
  }
  sctx.globalAlpha = 1;

  // distance markers: quarter-mile posts, then the trap furniture
  const worldToScreen = (wx) => (wx - camX) * SCALE + CAR_X;
  const post = (wx, label, tall) => {
    const sx = worldToScreen(wx);
    if (sx < -120 || sx > W + 120) return;
    const ph = tall ? 96 : 26;
    sctx.fillStyle = "#8d8776";
    sctx.fillRect(sx - 1.5, GROUND - ph, 3, ph);
    sctx.fillStyle = tall ? "#a3282a" : "#a3282a";
    sctx.fillRect(sx - 1.5, GROUND - ph, 3, tall ? 22 : 10);
    if (tall) {
      // checkered flag
      sctx.fillStyle = "#23262c";
      for (let r = 0; r < 3; r += 1) for (let c = 0; c < 6; c += 1) {
        if ((r + c) % 2 === 0) continue;
        sctx.fillRect(sx + 2 + c * 7, GROUND - ph + r * 7 - 22, 7, 7);
      }
      sctx.fillStyle = "#23262c";
      sctx.font = "700 13px ui-monospace, Menlo, monospace";
      sctx.textAlign = "center";
      sctx.fillText(label, sx, GROUND - ph - 28);
      sctx.textAlign = "left";
    }
  };
  for (let q = 1; q <= 3; q += 1) post((MILE * q) / 4, "", false);
  post(0, "MILE START · 计时开始", true);
  post(MILE, "MILE END · 秒表停", true);

  // timing hut near the entry
  const hutX = worldToScreen(14);
  if (hutX > -80 && hutX < W + 80) {
    sctx.fillStyle = "#5b5346";
    sctx.fillRect(hutX, GROUND - 34, 44, 34);
    sctx.fillStyle = "#3d382f";
    sctx.beginPath();
    sctx.moveTo(hutX - 5, GROUND - 34);
    sctx.lineTo(hutX + 49, GROUND - 34);
    sctx.lineTo(hutX + 22, GROUND - 48);
    sctx.closePath();
    sctx.fill();
    sctx.strokeStyle = "#3d382f";
    sctx.beginPath();
    sctx.moveTo(hutX + 34, GROUND - 48);
    sctx.lineTo(hutX + 34, GROUND - 66);
    sctx.stroke();
    sctx.fillStyle = "#ffd98a";
    sctx.fillRect(hutX + 32, GROUND - 66, 4, 4);
  }

  // the car
  drawCar(worldToScreen(SIM.x), SIM.v, SIM.dir, SIM.running && !SIM.braking && tractionLimited());

  // HUD
  drawSaltHud();
}

function tractionLimited() {
  const { P, m } = simParams();
  return P / Math.max(SIM.v, 3) > TRACTION_A * m;
}

function drawCar(cx, v, dir, wheelspin) {
  sctx.save();
  sctx.translate(cx, GROUND);
  sctx.scale(dir, 1);

  // speed lines
  if (v > 40) {
    sctx.strokeStyle = "rgba(255,255,255,0.5)";
    sctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i += 1) {
      const ly = -10 - ((i * 13) % 40) - 4;
      const ll = 26 + (v / MPH) * 0.9 + (i % 3) * 14;
      sctx.globalAlpha = 0.18 + 0.16 * ((i % 3) / 2);
      sctx.beginPath();
      sctx.moveTo(-30 - ll - i * 12, ly);
      sctx.lineTo(-30 - i * 12, ly);
      sctx.stroke();
    }
    sctx.globalAlpha = 1;
  }

  // salt spray at the driven wheel
  if (wheelspin || v > 90) {
    for (let i = 0; i < 9; i += 1) {
      const sx = -14 + Math.sin(i * 2.1 + v * 0.05) * 10;
      const sy = -2 - Math.abs(Math.cos(i * 1.7 + v * 0.07)) * 16;
      sctx.fillStyle = `rgba(240,238,228,${0.5 - i * 0.045})`;
      sctx.beginPath();
      sctx.arc(sx - i * 3, sy - i * 1.6, 3 + i * 0.8, 0, 7);
      sctx.fill();
    }
  }

  // wheels first (behind bodywork): front exposed, rear in a fairing
  const wheel = (wx, r, covered) => {
    sctx.fillStyle = "#1d2025";
    sctx.beginPath();
    sctx.arc(wx, -r, r, 0, 7);
    sctx.fill();
    sctx.fillStyle = "#7c7f86";
    sctx.beginPath();
    sctx.arc(wx, -r, r * 0.42, 0, 7);
    sctx.fill();
    if (!covered) {
      // a rotating spoke to sell the spin
      const ang = (performance.now() / (140 - Math.min(120, v)) ) * (v > 1 ? 1 : 0.2);
      sctx.strokeStyle = "#2c3037";
      sctx.lineWidth = 1.6;
      sctx.beginPath();
      sctx.moveTo(wx - r * 0.8 * Math.cos(ang), -r - r * 0.8 * Math.sin(ang));
      sctx.lineTo(wx + r * 0.8 * Math.cos(ang), -r + r * 0.8 * Math.sin(ang));
      sctx.stroke();
    }
  };
  wheel(22, 6.5, false);
  wheel(-26, 7, true);

  // long teardrop body, nose at right
  const body = new Path2D();
  body.moveTo(46, -7);
  body.bezierCurveTo(46, -13, 34, -16, 18, -16);         // nose over front wheel
  body.bezierCurveTo(2, -17, -14, -18, -28, -17);        // bonnet with RR radiator at nose
  body.bezierCurveTo(-40, -16.5, -48, -14, -52, -11);    // tail taper
  body.bezierCurveTo(-54, -8, -54, -5, -50, -3.5);
  body.lineTo(42, -3.5);
  body.bezierCurveTo(45, -4.5, 46, -5.5, 46, -7);
  body.closePath();
  const bg = sctx.createLinearGradient(0, -18, 0, -2);
  bg.addColorStop(0, "#3a6fc4");
  bg.addColorStop(0.55, "#1c4f9c");
  bg.addColorStop(1, "#12315f");
  sctx.fillStyle = bg;
  sctx.fill(body);
  sctx.strokeStyle = "#0d2547";
  sctx.lineWidth = 1.2;
  sctx.stroke(body);

  // twin bulges over the cylinder banks (the 1935 car's signature)
  sctx.fillStyle = "#2a5dab";
  sctx.beginPath();
  sctx.ellipse(-16, -19, 15, 3.4, 0, Math.PI, 0);
  sctx.fill();
  sctx.beginPath();
  sctx.ellipse(-36, -17.5, 12, 3, -0.06, Math.PI, 0);
  sctx.fill();

  // cockpit + driver
  sctx.fillStyle = "#101317";
  sctx.beginPath();
  sctx.ellipse(-4, -17, 7, 2.6, 0, Math.PI, 0);
  sctx.fill();
  sctx.fillStyle = "#c9b48a";
  sctx.beginPath();
  sctx.arc(-3, -18.5, 2.6, Math.PI, 0);
  sctx.fill();

  // chrome radiator nose
  sctx.fillStyle = "#d8dde2";
  sctx.fillRect(43, -12, 3.6, 6);

  // fin
  sctx.fillStyle = "#143a73";
  sctx.beginPath();
  sctx.moveTo(-50, -11);
  sctx.lineTo(-58, -6.5);
  sctx.lineTo(-50, -5);
  sctx.closePath();
  sctx.fill();

  // shadow
  sctx.fillStyle = "rgba(90, 84, 66, 0.35)";
  sctx.beginPath();
  sctx.ellipse(-4, 1.5, 52, 4, 0, 0, 7);
  sctx.fill();
  sctx.restore();
}

function drawSaltHud() {
  const vMph = SIM.v * MPH;
  // left panel: phase + speed
  sctx.fillStyle = "rgba(16,19,23,0.80)";
  roundRect(sctx, 18, 16, 258, 96, 9);
  sctx.fill();
  sctx.fillStyle = "#9aa4b0";
  sctx.font = "600 12px ui-monospace, Menlo, monospace";
  const phase = SIM.running
    ? (SIM.braking ? "刹停中" : SIM.inTrap ? "测量英里内 —— 计时！" : "飞驰进场")
    : SIM.results.length >= 2 ? "两趟完成" : "待命 · 蓝鸟停在起点";
  sctx.fillText(phase, 34, 40);
  sctx.fillStyle = "#ffd98a";
  sctx.font = "700 44px ui-monospace, Menlo, monospace";
  sctx.fillText(vMph.toFixed(0), 34, 84);
  sctx.fillStyle = "#b7a97e";
  sctx.font = "700 16px ui-monospace, Menlo, monospace";
  sctx.fillText("mph", 128, 84);
  sctx.fillStyle = "#8fd0a0";
  sctx.font = "600 12.5px ui-monospace, Menlo, monospace";
  sctx.fillText(`v* 卡尔达诺解 ${Math.round(configSpeed(CONFIG) * MPH)} mph`, 34, 103);

  // right panel: the trap clock
  sctx.fillStyle = "rgba(16,19,23,0.80)";
  roundRect(sctx, W - 292, 16, 274, 96, 9);
  sctx.fill();
  sctx.fillStyle = "#9aa4b0";
  sctx.font = "600 12px ui-monospace, Menlo, monospace";
  sctx.fillText("测量英里 · THE MEASURED MILE", W - 276, 40);
  const clockText = SIM.inTrap ? (SIM.t - SIM.tEnter).toFixed(2)
    : SIM.result ? SIM.result.t.toFixed(2)
    : SIM.results.length ? SIM.results[SIM.results.length - 1].t.toFixed(2) : "--.--";
  sctx.fillStyle = "#ffd98a";
  sctx.font = "700 44px ui-monospace, Menlo, monospace";
  sctx.fillText(clockText, W - 276, 84);
  sctx.fillStyle = "#b7a97e";
  sctx.font = "700 16px ui-monospace, Menlo, monospace";
  sctx.fillText("s", W - 160, 84);
  const mileMph = SIM.inTrap ? 0
    : SIM.result ? SIM.result.mph
    : SIM.results.length ? SIM.results[SIM.results.length - 1].mph : 0;
  sctx.fillStyle = "#8fd0a0";
  sctx.font = "600 13.5px ui-monospace, Menlo, monospace";
  sctx.fillText(SIM.inTrap ? "计时中…" : mileMph ? `${mileMph.toFixed(1)} mph = 3600/t` : "— mph", W - 276, 103);

  // wind gauge, bottom centre
  sctx.fillStyle = "rgba(16,19,23,0.80)";
  roundRect(sctx, W / 2 - 118, H - 62, 236, 44, 9);
  sctx.fill();
  sctx.fillStyle = "#9aa4b0";
  sctx.font = "600 12.5px ui-monospace, Menlo, monospace";
  const arrow = SIM.wind === 0 ? "·" : SIM.wind > 0 ? "⟶⟶" : "⟵⟵";
  sctx.fillText(`风 ${Math.abs(SIM.wind)} mph ${arrow}（${SIM.wind >= 0 ? "去程顺风" : "去程顶风"}）`, W / 2 - 100, H - 34);

  // mirror the clock into the DOM
  $("trap-clock").innerHTML = `${clockText} <span>s</span>`;
  $("trap-mph").textContent = mileMph ? `${mileMph.toFixed(1)} mph` : (SIM.inTrap ? "计时中…" : "— mph");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 · the cube law
// ═══════════════════════════════════════════════════════════════════════════

const cubeC = $("cube-chart");
const cctx = cubeC.getContext("2d");
const KIND_COLORS = { electric: "#0f8f7a", piston: "#a3282a", turbine: "#c07818", rocket: "#5a4fb0", jet: "#1c4f9c" };

const CX0 = 30, CX1 = 950, CY0 = 20, CY1 = 560;        // plot rect
const V_MIN = 30, V_MAX = 820, P_MIN = 15, P_MAX = 260000;

const lg = (v) => Math.log10(v);
const xOfV = (v) => CX0 + ((lg(v) - lg(V_MIN)) / (lg(V_MAX) - lg(V_MIN))) * (CX1 - CX0);
const yOfP = (p) => CY1 - ((lg(p) - lg(P_MIN)) / (lg(P_MAX) - lg(P_MIN))) * (CY1 - CY0);

function drawCube() {
  cctx.clearRect(0, 0, cubeC.width, cubeC.height);
  cctx.fillStyle = "#fbfaf6";
  cctx.fillRect(0, 0, cubeC.width, cubeC.height);

  // grid
  cctx.font = "11.5px ui-monospace, Menlo, monospace";
  cctx.fillStyle = "#8a8578";
  for (const v of [40, 60, 100, 150, 200, 300, 400, 600, 800]) {
    const x = xOfV(v);
    cctx.strokeStyle = "#e6e2d4";
    cctx.beginPath(); cctx.moveTo(x, CY0); cctx.lineTo(x, CY1); cctx.stroke();
    cctx.textAlign = "center";
    cctx.fillText(String(v), x, CY1 + 18);
  }
  for (const p of [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000]) {
    const y = yOfP(p);
    cctx.strokeStyle = "#e6e2d4";
    cctx.beginPath(); cctx.moveTo(CX0, y); cctx.lineTo(CX1, y); cctx.stroke();
    cctx.textAlign = "right";
    cctx.fillText(fmt(p), CX0 - 6, y + 4);
  }
  cctx.fillStyle = "#555c66";
  cctx.font = "600 13px ui-monospace, Menlo, monospace";
  cctx.textAlign = "center";
  cctx.fillText("速度 mph（对数）", (CX0 + CX1) / 2, CY1 + 40);
  cctx.save();
  cctx.translate(16, (CY0 + CY1) / 2);
  cctx.rotate(-Math.PI / 2);
  cctx.fillText("功率 hp（对数）", 0, 0);
  cctx.restore();

  // the required-power line for the current car
  const { a, b } = simParams();
  cctx.strokeStyle = "#1c4f9c";
  cctx.lineWidth = 2.4;
  cctx.beginPath();
  for (let i = 0; i <= 160; i += 1) {
    const v = Math.pow(10, lg(V_MIN) + (i / 160) * (lg(V_MAX) - lg(V_MIN)));
    const p = requiredPower(v * MS, a, b) / W_PER_HP;
    const x = xOfV(v), y = yOfP(Math.min(p, P_MAX));
    if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
  }
  cctx.stroke();
  cctx.fillStyle = "#1c4f9c";
  cctx.font = "600 13px ui-monospace, Menlo, monospace";
  cctx.textAlign = "left";
  cctx.fillText("P = ½ρ·CdA·v³ + μmg·v（当前车）", xOfV(58), yOfP(2400));

  // the 8× bracket: 150 → 300 mph on the same curve
  const pAt = (v) => requiredPower(v * MS, a, b) / W_PER_HP;
  const bx1 = xOfV(150), by1 = yOfP(pAt(150)), bx2 = xOfV(300), by2 = yOfP(pAt(300));
  cctx.strokeStyle = "#a3282a";
  cctx.setLineDash([5, 4]);
  cctx.lineWidth = 1.6;
  cctx.beginPath(); cctx.moveTo(bx1, by1); cctx.lineTo(bx1, CY1); cctx.stroke();
  cctx.beginPath(); cctx.moveTo(bx2, by2); cctx.lineTo(bx2, CY1); cctx.stroke();
  cctx.setLineDash([]);
  cctx.beginPath(); cctx.moveTo(bx1, by1); cctx.lineTo(bx2, by2); cctx.stroke();
  cctx.fillStyle = "#a3282a";
  cctx.font = "700 13.5px ui-monospace, Menlo, monospace";
  cctx.textAlign = "center";
  cctx.fillText("2× 速度", (bx1 + bx2) / 2, (by1 + by2) / 2 + 30);
  cctx.fillText("8× 功率", (bx1 + bx2) / 2, (by1 + by2) / 2 + 46);

  // history dots
  for (const r of RECORDS) {
    const hp = equivalentPowerHp(r);
    const x = xOfV(r.mph), y = yOfP(Math.min(hp, P_MAX));
    cctx.fillStyle = KIND_COLORS[r.kind];
    cctx.beginPath();
    cctx.arc(x, y, r.star ? 8 : 5.5, 0, 7);
    cctx.fill();
    if (r.star) {
      cctx.strokeStyle = "#a3282a";
      cctx.lineWidth = 2;
      cctx.stroke();
      cctx.font = "700 13px ui-monospace, Menlo, monospace";
      cctx.textAlign = "left";
      cctx.fillText("1935 蓝鸟 301", x + 12, y - 8);
    }
    if (r.y === 1997 || r.y === 1899 || r.y === 1927) {
      cctx.fillStyle = "#555c66";
      cctx.font = "600 11.5px ui-monospace, Menlo, monospace";
      cctx.textAlign = "left";
      cctx.fillText(`${r.y} · ${fmt(hp)} hp`, x + 9, y + 4);
    }
  }

  // the slider's power line + its exact crossing
  const hp = Number($("cube-power").value);
  const vStar = terminalSpeed(hp * W_PER_HP, a, b) * MPH;
  const y = yOfP(Math.min(hp, P_MAX));
  cctx.strokeStyle = "#c07818";
  cctx.lineWidth = 2;
  cctx.beginPath(); cctx.moveTo(CX0, y); cctx.lineTo(CX1, y); cctx.stroke();
  if (vStar > V_MIN && vStar < V_MAX) {
    const x = xOfV(vStar);
    cctx.setLineDash([4, 4]);
    cctx.strokeStyle = "#c07818";
    cctx.beginPath(); cctx.moveTo(x, y); cctx.lineTo(x, CY1); cctx.stroke();
    cctx.setLineDash([]);
    cctx.fillStyle = "#c07818";
    cctx.beginPath(); cctx.arc(x, y, 7, 0, 7); cctx.fill();
    cctx.font = "700 14px ui-monospace, Menlo, monospace";
    cctx.textAlign = "left";
    cctx.fillText(`${fmt(vStar)} mph`, x + 11, y + 24);
  }
  $("cube-power-out").textContent = fmt(hp);
  $("cube-speed").textContent = fmt(Math.min(vStar, 9999));
  $("cube-ratio").textContent = "×" + fmt((301.129 / 39.24) ** 3);
}
$("cube-power").addEventListener("input", drawCube);

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 · Cardano's bench
// ═══════════════════════════════════════════════════════════════════════════

const sliderMap = [["s-p", "pEngine", 1], ["s-a", "area", 1], ["s-cd", "cd", 1], ["s-m", "mass", 1], ["s-mu", "mu", 1], ["s-h", "h", 1]];
for (const [id, key] of sliderMap) {
  $(id).addEventListener("input", (e) => {
    CONFIG[key] = Number(e.target.value);
    updateSliderOutputs();
    updateLimit();
    drawCube();
  });
}
$("s-boost").addEventListener("change", (e) => {
  CONFIG.supercharged = e.target.checked;
  updateLimit();
  drawCube();
});

function updateLimit() {
  const rho = airDensity(CONFIG.h);
  const a = aeroC(CONFIG.h, CONFIG.cd, CONFIG.area);
  const b = rollC(CONFIG.mu, CONFIG.mass);
  const P = wheelPower(CONFIG);
  const v = terminalSpeed(P, a, b);
  const d = cardanoDisc(P, a, b);

  $("limit-v").textContent = fmt(v * MPH);
  $("limit-kmh").textContent = `${fmt(v * 3.6, 1)} km/h`;
  const dragShare = (a * v ** 3) / (a * v ** 3 + b * v);
  $("seg-drag").style.width = `${(dragShare * 100).toFixed(1)}%`;
  $("seg-roll").style.width = `${(100 - dragShare * 100).toFixed(1)}%`;
  $("share-drag").textContent = `${(dragShare * 100).toFixed(0)}%`;
  $("share-roll").textContent = `${(100 - dragShare * 100).toFixed(0)}%`;

  $("cardano-work").innerHTML =
    `<span class="cm">ρ(${fmt(CONFIG.h)} m) =</span> <span class="hl">${rho.toFixed(4)}</span> kg/m³<br>` +
    `<span class="cm">a = ½ρC_dA =</span> <span class="hl">${a.toFixed(4)}</span> kg/m · <span class="cm">b = μmg =</span> <span class="hl">${fmt(b)}</span> N<br>` +
    `<span class="cm">P_轮上 =</span> <span class="hl">${fmt(P / W_PER_HP)}</span> hp ${CONFIG.supercharged ? "<span class=cm>（增压顶住了海拔）</span>" : "<span class=cm>（自然吸气：× ρ/ρ₀）</span>"}<br>` +
    `v* <span class="op">=</span> ∛(P/2a + √Δ) <span class="op">+</span> ∛(P/2a − √Δ)<br>` +
    `&nbsp;&nbsp;<span class="op">=</span> ∛(${fmt(P / (2 * a))} + ${d.toFixed(1)}) <span class="op">+</span> ∛(${fmt(P / (2 * a))} − ${d.toFixed(1)})<br>` +
    `&nbsp;&nbsp;<span class="op">=</span> <span class="hl">${(Math.cbrt(P / (2 * a) + d) + Math.cbrt(P / (2 * a) - d)).toFixed(4)}</span> m/s <span class="op">=</span> <span class="hl">${(v * MPH).toFixed(1)}</span> mph`;

  const numeric = bisectSpeed(P, a, b);
  $("bisect-line").textContent = `二分法 200 次迭代 → ${numeric.toFixed(6)} m/s · 与卡尔达诺差 ${(Math.abs(numeric - v) / v).toExponential(1)}（相对）`;

  // the altitude ledger
  const rows = [
    { place: "代托纳沙滩", sub: "海平面", h: 0 },
    { place: "邦纳维尔盐滩", sub: "犹他州", h: 1282 },
    { place: "更高的高原", sub: "对照", h: 2600 },
  ];
  const cells = rows.map((r) => {
    const sc = configSpeed({ ...CONFIG, h: r.h, supercharged: true }) * MPH;
    const na = configSpeed({ ...CONFIG, h: r.h, supercharged: false }) * MPH;
    return `<tr${r.h === 1282 ? ' class="star"' : ""}><td class="place">${r.place}<br><span class="dim" style="font-size:11.5px">${r.sub} · ${fmt(r.h)} m</span></td>` +
      `<td>${airDensity(r.h).toFixed(3)}</td><td>${fmt(sc)}</td><td>${fmt(na)}</td><td>${(sc - na).toFixed(1)}</td></tr>`;
  });
  $("alt-table").innerHTML =
    `<table class="alt-table"><tr><th>场地</th><th>ρ kg/m³</th><th>增压 v* mph</th><th>自吸 v* mph</th><th>差</th></tr>${cells.join("")}</table>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4 · the rim
// ═══════════════════════════════════════════════════════════════════════════

const rimC = $("rim-canvas");
const rctx = rimC.getContext("2d");
let rimSpeedMph = 301, rimRadius = 0.47;

function updateRim() {
  const v = rimSpeedMph * MS;
  const rpm = wheelRpm(v, rimRadius);
  const g = rimG(v, rimRadius);
  $("rim-rpm").textContent = fmt(rpm);
  $("rim-g").textContent = fmt(g);
  $("pebble-kg").textContent = fmt(0.028 * g);
  drawRim(rpm, g);
}

function drawRim(rpm, g) {
  rctx.clearRect(0, 0, rimC.width, rimC.height);
  rctx.fillStyle = "#171a1f";
  rctx.fillRect(0, 0, rimC.width, rimC.height);

  const cx = rimC.width * 0.44, cy = rimC.height / 2;
  const R = 190;
  const frac = clamp(g / 6000, 0, 1);
  const rimColor = `rgb(${Math.round(63 + frac * 140)}, ${Math.round(143 - frac * 103)}, ${Math.round(95 - frac * 60)})`;

  // outer pneumatic ring
  const og = rctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R);
  og.addColorStop(0, "#20242b");
  og.addColorStop(0.78, "#191c22");
  og.addColorStop(0.79, rimColor);
  og.addColorStop(1, shade(rimColor, -34));
  rctx.fillStyle = og;
  rctx.beginPath();
  rctx.arc(cx, cy, R, 0, 7);
  rctx.fill();

  // rotating tick marks on the tyre
  const spin = (rpm / 60) * 2 * Math.PI * 0.02 * performance.now() / 1000 * 60;
  rctx.strokeStyle = "rgba(255,255,255,0.55)";
  rctx.lineWidth = 2.5;
  for (let i = 0; i < 16; i += 1) {
    const ang = spin + (i / 16) * Math.PI * 2;
    rctx.beginPath();
    rctx.moveTo(cx + Math.cos(ang) * (R - 14), cy + Math.sin(ang) * (R - 14));
    rctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
    rctx.stroke();
  }

  // wire spokes
  rctx.strokeStyle = "rgba(190,196,205,0.5)";
  rctx.lineWidth = 1.4;
  for (let i = 0; i < 24; i += 1) {
    const ang = -spin * 0.4 + (i / 24) * Math.PI * 2;
    rctx.beginPath();
    rctx.moveTo(cx + Math.cos(ang) * 44, cy + Math.sin(ang) * 44);
    rctx.lineTo(cx + Math.cos(ang) * (R - 40), cy + Math.sin(ang) * (R - 40));
    rctx.stroke();
  }

  // hub
  rctx.fillStyle = "#3b414b";
  rctx.beginPath(); rctx.arc(cx, cy, 46, 0, 7); rctx.fill();
  rctx.fillStyle = "#23262c";
  rctx.beginPath(); rctx.arc(cx, cy, 16, 0, 7); rctx.fill();

  // the pebble and its apparent weight
  const pAng = spin * 0.9 + 0.6;
  const px = cx + Math.cos(pAng) * R, py = cy + Math.sin(pAng) * R;
  rctx.fillStyle = "#e8e2d2";
  rctx.beginPath(); rctx.arc(px, py, 7, 0, 7); rctx.fill();
  const alen = clamp(g * 0.045, 8, 150);
  rctx.strokeStyle = "#ffd98a";
  rctx.lineWidth = 3;
  rctx.beginPath();
  rctx.moveTo(px, py);
  rctx.lineTo(px + Math.cos(pAng) * alen, py + Math.sin(pAng) * alen);
  rctx.stroke();

  // readouts on the canvas
  rctx.textAlign = "left";
  rctx.fillStyle = "#9aa4b0";
  rctx.font = "600 13px ui-monospace, Menlo, monospace";
  rctx.fillText("0.02× 慢放 · 胎面上一粒 28 g 的盐", cx + R + 34, cy - 64);
  rctx.fillStyle = "#ffd98a";
  rctx.font = "700 30px ui-monospace, Menlo, monospace";
  rctx.fillText(`${fmt(rpm)} rpm`, cx + R + 34, cy - 28);
  rctx.fillStyle = "#8fd0a0";
  rctx.font = "700 21px ui-monospace, Menlo, monospace";
  rctx.fillText(`${fmt(g)} g`, cx + R + 34, cy + 4);
  rctx.fillStyle = "#c9a227";
  rctx.font = "600 15px ui-monospace, Menlo, monospace";
  rctx.fillText(`28 g 盐粒 ≈ ${fmt(0.028 * g)} kg`, cx + R + 34, cy + 30);
  rctx.fillStyle = "#7d8894";
  rctx.font = "600 12.5px ui-monospace, Menlo, monospace";
  rctx.fillText(`r = ${rimRadius.toFixed(2)} m · a = v²/r`, cx + R + 34, cy + 54);

  // g-scale
  const marks = [
    { g: 1, label: "1 g 静坐" },
    { g: 9, label: "9 g 战斗机" },
    { g: g, label: `${fmt(g)} g 轮缘`, current: true },
  ];
  $("gscale-bar").innerHTML = "";
  const bar = document.createElement("div");
  bar.style.position = "relative";
  for (const m of marks) {
    const pct = clamp((Math.log10(1 + m.g) / Math.log10(1 + 6000)) * 100, 0, 100);
    const mk = document.createElement("div");
    mk.className = "mk";
    mk.style.left = `${pct}%`;
    mk.style.color = m.current ? "#a3282a" : "#555c66";
    mk.style.fontWeight = m.current ? "700" : "400";
    mk.textContent = m.label;
    $("gscale-marks").appendChild(mk);
  }
}

function shade(rgb, amt) {
  const [r, g, b] = rgb.match(/\d+/g).map(Number);
  return `rgb(${clamp(r + amt, 0, 255)}, ${clamp(g + amt, 0, 255)}, ${clamp(b + amt, 0, 255)})`;
}

$("s-rspeed").addEventListener("input", (e) => {
  rimSpeedMph = Number(e.target.value);
  $("o-rspeed").textContent = rimSpeedMph;
  updateRim();
});
$("s-rr").addEventListener("input", (e) => {
  rimRadius = Number(e.target.value);
  $("o-rr").textContent = rimRadius.toFixed(2);
  updateRim();
});

// ═══════════════════════════════════════════════════════════════════════════
// TAB 5 · the ladder
// ═══════════════════════════════════════════════════════════════════════════

let selectedRecord = null;

function buildLadder() {
  const svg = $("ladder-chart");
  const L = 58, R = 1230, T = 34, B = 336;
  const y0 = 1896, y1 = 2002;
  const xOf = (yr) => L + ((yr - y0) / (y1 - y0)) * (R - L);
  const yOf = (mph) => B - ((Math.log10(mph / 35)) / Math.log10(800 / 35)) * (B - T);

  const parts = [];
  parts.push(`<line class="axis" x1="${L}" y1="${B}" x2="${R}" y2="${B}"/>`);
  for (const yr of [1900, 1920, 1940, 1960, 1980, 2000]) {
    parts.push(`<line class="gridline" x1="${xOf(yr)}" y1="${T}" x2="${xOf(yr)}" y2="${B}"/>`);
    parts.push(`<text class="year-label" x="${xOf(yr)}" y="${B + 20}" text-anchor="middle">${yr}</text>`);
  }
  for (const s of [50, 100, 200, 400, 800]) {
    parts.push(`<line class="gridline" x1="${L}" x2="${R}" y1="${yOf(s)}" y2="${yOf(s)}"/>`);
    parts.push(`<text class="year-label" x="${L - 8}" y="${yOf(s) + 4}" text-anchor="end">${s}</text>`);
  }
  parts.push(`<text class="year-label" x="${L - 8}" y="${B + 4}" text-anchor="end">mph</text>`);

  RECORDS.forEach((r, i) => {
    const x = xOf(r.y), y = yOf(r.mph);
    const c = KIND_COLORS[r.kind];
    parts.push(`<line x1="${x}" y1="${B}" x2="${x}" y2="${y}" stroke="${c}" stroke-width="5" opacity="0.33" stroke-linecap="round"/>`);
    if (r.star) {
      parts.push(`<circle cx="${x}" cy="${y}" r="16" fill="none" stroke="#a3282a" stroke-width="1.6" stroke-dasharray="4 4"/>`);
      const pts = starPoints(x, y - 0, 11, 4.6);
      parts.push(`<polygon points="${pts}" fill="#a3282a"/>`);
      parts.push(`<text x="${x}" y="${y - 24}" text-anchor="middle" fill="#a3282a" font-weight="700" font-size="13">今天 · 91 年前</text>`);
    }
    parts.push(`<g class="pin" data-i="${i}"><circle cx="${x}" cy="${y}" r="8" fill="${r.star ? "#ffd98a" : c}" stroke="#f2f0ea" stroke-width="2"/></g>`);
    parts.push(`<text class="speed-label" x="${x}" y="${y + (r.star ? 30 : 16)}" text-anchor="middle">${r.mph.toFixed(r.mph < 100 ? 1 : 0)}</text>`);
    parts.push(`<text class="year-label" x="${x}" y="${B + 38}" text-anchor="middle">${r.y}</text>`);
  });
  svg.innerHTML = parts.join("");
  svg.querySelectorAll(".pin").forEach((p) => p.addEventListener("click", () => selectRecord(Number(p.dataset.i))));
}

function starPoints(cx, cy, R, r) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + Math.cos(ang) * rad).toFixed(1)},${(cy + Math.sin(ang) * rad).toFixed(1)}`);
  }
  return pts.join(" ");
}

function selectRecord(i) {
  selectedRecord = i;
  const r = RECORDS[i];
  const meta = r.powerHp != null
    ? `${kindLabel(r.kind)} · ${fmt(r.powerHp)} hp`
    : `${kindLabel(r.kind)} · 推力 ${fmt(r.thrustN / 1000)} kN · 等效 ${fmt(equivalentPowerHp(r))} hp`;
  $("record-card").innerHTML =
    `<div class="rc-head"><span class="rc-title">${r.car}</span><span class="rc-date">${r.date}</span>` +
    `<span class="rc-mpg">${r.mph.toFixed(3)}<span style="font-size:15px;color:var(--ink-soft)"> mph</span></span>` +
    `${r.star ? '<span class="star-flag">★ 1935-09-03 · 今天</span>' : ""}</div>` +
    `<div class="rc-meta">${r.driver} · ${r.place} · ${meta}</div>` +
    `<p style="margin:6px 0 0">${r.note}</p>`;
}

// ── the loop ───────────────────────────────────────────────────────────────
let lastT = performance.now();
function frame(now) {
  const dtReal = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (!SIM.video && SIM.running) {
    stepSim(dtReal * SIM.factor);
  }
  const activeTab = document.querySelector(".tab.on")?.id;
  if (activeTab === "tab-mile") renderSalt();
  if (activeTab === "tab-rim") updateRim();
  requestAnimationFrame(frame);
}

// ── boot ───────────────────────────────────────────────────────────────────
buildLadder();
syncSliders();
updateLimit();
updateRim();
resetRuns();
drawCube();
requestAnimationFrame(frame);

// ── video-control API (headless narration drives the studio) ───────────────
window.__demo = {
  setTab: gotoTab,
  setVideoMode(on) {
    SIM.video = !!on;
    SIM.factor = 16;
    document.body.classList.toggle("video-mode", !!on);
  },
  scrollToTop() { window.scrollTo(0, 0); },
  launch: startRun,
  resetRuns,
  setWind(w) { $("wind").value = w; SIM.wind = w; $("wind-out").textContent = (w >= 0 ? "+" : "") + w; },
  tick(dtReal) {           // deterministic video stepping: dt seconds of wall time
    if (SIM.running) stepSim(dtReal * SIM.factor);
    renderSalt();
  },
  setLimit(key, value) {
    CONFIG[key] = value;
    syncSliders();
    updateLimit();
    drawCube();
  },
  setCubePower(hp) { $("cube-power").value = hp; drawCube(); },
  setRimSpeed(mph) { $("s-rspeed").value = mph; rimSpeedMph = mph; $("o-rspeed").textContent = mph; updateRim(); },
  setRimRadius(r) { $("s-rr").value = r; rimRadius = r; $("o-rr").textContent = r.toFixed(2); updateRim(); },
  selectRecord,
  config() { return { ...CONFIG }; },
};
