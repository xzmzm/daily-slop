// app.js — Forward Pass 1906 · 第一传的物理
// All numbers come from physics.js; this file only draws and wires sliders.

import {
  MPH, YD,
  I_AXIAL, I_TRANS, REF_AREA, BALL_LEN, BALL_D,
  CD_SPIRAL, CD_TUMBLE, CM_ALPHA,
  vacuumRange, vacuumHangtime, vacuumApex, optimalAngle, optimalRange,
  integrateFlight, optimalAngleDrag,
  overturnSlope, spinOmega, angularMomentum,
  stabilityFactor, criticalSpinRps, precessionRate,
  ratingComponents, ratingFromRates, RATING_BASE,
  RELEASE_H, THROWS, FIRST_DOWN_YD, RATING_PRESETS, EVENTS, kindLabel,
} from "./physics.js";

// ── tiny helpers ─────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const fmt = (x, d = 0) => x.toLocaleString("en-US", {
  minimumFractionDigits: d, maximumFractionDigits: d,
});

const DEG = Math.PI / 180;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ── state ────────────────────────────────────────────────────
const state = {
  field: { vMph: 39.3, angle: 12, h: RELEASE_H, cache: null },
  flight: { active: false, landed: false, t: 0, pts: [], hang: 0, trail: [] },
  gyro: { rps: 10, mode: "spin", phase: 0, wobA: 0.5, wobDir: 0 },
  rating: { compPct: 67.6, ypa: 9.17, tdPct: 9.86, intPct: 2.01 },
  event: 2,                       // the star: 1906-09-05
  videoMode: false,
};

let rafId = null;

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
  THROWS.forEach((p, i) => {
    const b = document.createElement("button");
    b.textContent = p.label;
    b.dataset.i = i;
    b.addEventListener("click", () => selectThrow(i));
    host.appendChild(b);
  });
}

function clearPresetHighlight() {
  for (const b of $("presets").children) b.classList.remove("on");
}

function selectThrow(i) {
  const t = THROWS[i];
  state.field.vMph = t.v / MPH;
  state.field.angle = t.angleDeg;
  state.field.h = t.h;
  syncFieldSliders();
  resetFlight();
  setTab("field");
  scrollToTop();
  renderField();
  clearPresetHighlight();
  $("presets").children[i].classList.add("on");
  $("field-status").textContent = t.note;
}

function syncFieldSliders() {
  const f = state.field;
  $("s-v").value = f.vMph;
  $("o-v").textContent = f.vMph.toFixed(1);
  $("s-angle").value = f.angle;
  $("o-angle").textContent = f.angle.toFixed(1);
  $("s-h").value = f.h;
  $("o-h").textContent = f.h.toFixed(2);
}

// ── 1 · the field tab ────────────────────────────────────────
const FIELD_X_YD = 80;          // the chart shows 0…80 yd; height axis auto-fits the apex

function fieldDerived() {
  const f = state.field;
  const v = f.vMph * MPH;
  const ang = f.angle * DEG;
  const vac = vacuumRange(v, ang, f.h);
  const vacHang = vacuumHangtime(v, ang, f.h);
  const drag = integrateFlight(v, ang, f.h, CD_SPIRAL);
  const opt = optimalAngleDrag(v, f.h, CD_SPIRAL);
  const vacOpt = optimalAngle(v, f.h);
  const apexMax = Math.max(drag.apex, vacuumApex(v, ang, f.h));
  const yMax = Math.max(10, Math.ceil((apexMax * 1.12) / 2) * 2);
  return { v, ang, vac, vacHang, drag, opt, vacOpt, yMax };
}

function renderField() {
  const f = state.field;
  const d = fieldDerived();
  f.cache = d;

  $("field-range").textContent = fmt(d.drag.range / YD, 1);
  $("field-vac").textContent = `真空 ${fmt(d.vac / YD, 1)} 码`;
  $("field-hang").textContent = d.drag.hang.toFixed(2);
  $("field-apex").textContent = d.drag.apex.toFixed(1);
  $("field-opt").textContent = (d.opt / DEG).toFixed(1);

  $("field-formula").innerHTML =
    `R <span class="op">=</span> (v·cosθ/g)·(v·sinθ <span class="op">+</span> √(v²sin²θ <span class="op">+</span> 2gh))<br>` +
    `&nbsp;&nbsp;<span class="op">=</span> (<span class="hl">${d.v.toFixed(2)} m/s</span>·cos ${f.angle.toFixed(1)}° / 9.81)·` +
    `(<span class="hl">${(d.v * Math.sin(d.ang)).toFixed(2)}</span> <span class="op">+</span> ` +
    `<span class="hl">${Math.sqrt((d.v * Math.sin(d.ang)) ** 2 + 2 * 9.81 * f.h).toFixed(2)}</span>)<br>` +
    `&nbsp;&nbsp;<span class="op">=</span> <span class="hl">${fmt(d.vac / YD, 1)} 码</span> (真空)` +
    ` <span class="op">→</span> <span class="hl">${fmt(d.drag.range / YD, 1)} 码</span> (螺旋, C<sub>D</sub>=${CD_SPIRAL})<br>` +
    `θ* <span class="op">=</span> arctan(v/√(v²+2gh)) <span class="op">=</span> ` +
    `<span class="hl">${(d.vacOpt / DEG).toFixed(1)}°</span>` +
    ` <span class="op">→</span> <span class="hl">${(d.opt / DEG).toFixed(1)}°</span> (带阻)`;

  // crosscheck: RK4 with the drag switched off vs the closed form
  const vac0 = integrateFlight(d.v, d.ang, f.h, 0);
  const relErr = Math.abs(vac0.range - d.vac) / d.vac;
  $("field-crosscheck").innerHTML =
    `关掉阻力重算：RK4 落点 ${fmt(vac0.range / YD, 2)} 码 vs 闭式 ${fmt(d.vac / YD, 2)} 码，` +
    `相对差 <b>${relErr.toExponential(1)}</b>（只剩落地插值的残差）。`;

  const yd = d.drag.range / YD;
  $("field-cert-lines").innerHTML =
    `弹速 <b>${f.vMph.toFixed(1)} mph</b> · ${d.v.toFixed(1)} m/s<br>` +
    `出手 <b>${f.angle.toFixed(1)}°</b> @ ${f.h.toFixed(2)} m<br>` +
    `真空射程 <b>${fmt(d.vac / YD, 1)} 码</b><br>` +
    `带阻射程 <b>${fmt(yd, 1)} 码</b>（红线在 ${FIRST_DOWN_YD} 码）<br>` +
    `滞空 <b>${d.drag.hang.toFixed(2)} s</b> · 最高 ${d.drag.apex.toFixed(1)} m`;

  const touchdown = yd >= FIRST_DOWN_YD;
  const stamp = $("field-stamp");
  stamp.textContent = touchdown ? "达阵" : "未完成";
  stamp.classList.toggle("ok", touchdown);

  drawField();
}

function fieldProjectors(yMax) {
  const cv = $("field-canvas");
  const pad = { l: 64, r: 26, t: 26, b: 74 };
  const px = (m) => pad.l + (m / (FIELD_X_YD * YD)) * (cv.width - pad.l - pad.r);
  const py = (m) => (cv.height - pad.b) - (m / yMax) * (cv.height - pad.t - pad.b);
  return { cv, pad, px, py };
}

function drawField() {
  const d = state.field.cache ?? fieldDerived();
  const { cv, pad, px, py } = fieldProjectors(d.yMax);
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;

  // the turf
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#173a22");
  bg.addColorStop(1, "#0f2a18");
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // yard lines every 5 yd
  ctx.font = "13px ui-monospace, Menlo, monospace";
  for (let yd = 0; yd <= FIELD_X_YD; yd += 5) {
    const X = px(yd * YD);
    ctx.strokeStyle = yd % 10 === 0 ? "rgba(247,245,239,.38)" : "rgba(247,245,239,.16)";
    ctx.lineWidth = yd % 10 === 0 ? 2 : 1;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(X, 46); ctx.lineTo(X, H - 74); ctx.stroke();
    if (yd % 10 === 0) {
      ctx.fillStyle = "rgba(247,245,239,.72)";
      ctx.textAlign = "center";
      ctx.fillText(`${yd}`, X, H - 24);
    }
  }
  ctx.fillStyle = "rgba(247,245,239,.5)";
  ctx.textAlign = "left";
  ctx.fillText("码", 12, H - 24);

  // the 20-yd line — where Schneider caught it (label at the top of the line)
  const Xt = px(FIRST_DOWN_YD * YD);
  ctx.strokeStyle = "rgba(212,80,80,.9)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 7]);
  ctx.beginPath(); ctx.moveTo(Xt, 40); ctx.lineTo(Xt, H - 74); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(240,150,150,.95)";
  ctx.textAlign = "center";
  ctx.fillText(`施奈德 · ${FIRST_DOWN_YD} 码`, Xt, 30);

  // the passer and the receiver
  drawStick(ctx, px(0), py(0), py(state.field.h), "#f7f5ef");
  drawStick(ctx, Xt, py(0), py(1.5), "rgba(247,245,239,.8)");

  // height axis labels
  ctx.font = "12.5px ui-monospace, Menlo, monospace";
  ctx.textAlign = "right";
  for (let i = 1; i <= 3; i += 1) {
    const hm = (d.yMax * i) / 4;
    ctx.fillStyle = "rgba(247,245,239,.45)";
    ctx.fillText(`${hm.toFixed(0)} m`, pad.l - 12, py(hm) + 4);
    ctx.strokeStyle = "rgba(247,245,239,.07)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, py(hm)); ctx.lineTo(W - pad.r, py(hm)); ctx.stroke();
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(247,245,239,.35)";
  ctx.fillText("高", 14, py(d.yMax * 0.75));

  // ground
  ctx.strokeStyle = "rgba(247,245,239,.5)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px(0), py(0) + 8); ctx.lineTo(W - 26, py(0) + 8); ctx.stroke();

  // vacuum parabola (dashed chalk)
  ctx.strokeStyle = "rgba(247,245,239,.5)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  const th = vacuumHangtime(d.v, d.ang, state.field.h);
  for (let i = 0; i <= 60; i += 1) {
    const t = (i / 60) * th;
    const x = d.v * Math.cos(d.ang) * t;
    const y = state.field.h + d.v * Math.sin(d.ang) * t - 4.905 * t * t;
    const X = px(x), Y = py(y);
    if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // drag trajectory (solid gold)
  ctx.strokeStyle = "#e8c766";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  d.drag.pts.forEach((p, i) => {
    const X = px(p.x), Y = py(p.y);
    if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  });
  ctx.stroke();

  // landing labels: two clean lanes with short leader lines, never colliding
  ctx.font = "13.5px ui-monospace, Menlo, monospace";
  ctx.lineJoin = "round";
  const halo = "#0f2a18";
  const labelAt = (text, x, y, align, color) => {
    ctx.strokeStyle = halo;
    ctx.lineWidth = 4;
    ctx.textAlign = align;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };
  // vacuum: above ground with a leader from its landing point
  const xv = px(d.vac);
  labelAt(`真空 ${fmt(d.vac / YD, 1)} 码`, xv, py(0) - 40, "center", "rgba(247,245,239,.92)");
  ctx.strokeStyle = "rgba(247,245,239,.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(xv, py(0) - 32); ctx.lineTo(xv, py(0) - 4); ctx.stroke();
  // drag: below ground with a leader; nudge right if it would crowd the vacuum label
  const xd = px(d.drag.range);
  const nudge = Math.abs(xv - xd) < 110 ? (xd <= xv ? -120 : 120) : 0;
  labelAt(`带阻 ${fmt(d.drag.range / YD, 1)} 码`, xd + nudge, py(0) + 34,
          nudge ? (nudge < 0 ? "right" : "left") : "center", "#ffd98a");
  ctx.strokeStyle = "rgba(232,199,102,.5)";
  ctx.beginPath(); ctx.moveTo(xd, py(0) + 6); ctx.lineTo(xd, py(0) + 22); ctx.stroke();
  if (nudge) {
    ctx.beginPath();
    ctx.moveTo(xd, py(0) + 22);
    ctx.lineTo(xd + (nudge < 0 ? -34 : 34), py(0) + 30);
    ctx.stroke();
  }

  // legend with real line samples
  ctx.font = "14px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.strokeStyle = "rgba(247,245,239,.75)";
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 6]);
  ctx.beginPath(); ctx.moveTo(78, 54); ctx.lineTo(120, 54); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(247,245,239,.85)";
  ctx.fillText("真空抛物线", 128, 58);
  ctx.strokeStyle = "#e8c766";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(78, 76); ctx.lineTo(120, 76); ctx.stroke();
  ctx.fillStyle = "#e8c766";
  ctx.fillText("螺旋带阻（C_D 0.10）", 128, 80);

  // the ball (static ghost at release, or animated in flight)
  const fl = state.flight;
  if (fl.active || fl.landed) {
    const pos = fl.active ? sampleFlight(fl.t) : fl.pts[fl.pts.length - 1];
    // trail
    ctx.strokeStyle = "rgba(232,199,102,.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    fl.trail.forEach((p, i) => {
      const X = px(p.x), Y = py(p.y);
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    });
    ctx.stroke();
    if (fl.active) drawBall(ctx, px(pos.x), py(pos.y), headingAt(fl.t), 1);
    if (fl.landed) {
      ctx.strokeStyle = "#e8c766";
      ctx.lineWidth = 2.5;
      const X = px(pos.x), Y = py(0);
      ctx.beginPath();
      ctx.moveTo(X - 7, Y - 7); ctx.lineTo(X + 7, Y + 7);
      ctx.moveTo(X + 7, Y - 7); ctx.lineTo(X - 7, Y + 7);
      ctx.stroke();
    }
  } else {
    drawBall(ctx, px(0), py(state.field.h), -state.field.angle * DEG, 1);
  }

  function sampleFlight(t) {
    const pts = fl.pts;
    if (t <= 0) return pts[0];
    for (let i = 1; i < pts.length; i += 1) {
      if (pts[i].t >= t) {
        const a = pts[i - 1], b = pts[i];
        const u = (t - a.t) / (b.t - a.t || 1);
        return { x: a.x + u * (b.x - a.x), y: a.y + u * (b.y - a.y) };
      }
    }
    return pts[pts.length - 1];
  }

  function headingAt(t) {
    const e = 0.02;
    const p1 = sampleFlight(Math.max(0, t - e));
    const p2 = sampleFlight(Math.min(fl.hang, t + e));
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
  }
}

function drawStick(ctx, x, groundY, releaseY, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, releaseY - 16, 5, 0, Math.PI * 2);      // head
  ctx.moveTo(x, releaseY - 11); ctx.lineTo(x, groundY - 12); // body
  ctx.moveTo(x - 9, groundY - 6); ctx.lineTo(x, groundY - 16); // legs
  ctx.moveTo(x + 9, groundY - 6); ctx.lineTo(x, groundY - 16);
  ctx.moveTo(x - 10, releaseY - 4); ctx.lineTo(x + 10, releaseY - 10); // arm, forward
  ctx.stroke();
}

function drawBall(ctx, x, y, angleRad, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#8a4b1f";
  ctx.strokeStyle = "#f2ead8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(242,234,216,.8)";
  ctx.beginPath();
  ctx.moveTo(-5, -1.5); ctx.lineTo(5, -1.5);
  ctx.moveTo(-5, 1.5); ctx.lineTo(5, 1.5);
  ctx.stroke();
  ctx.restore();
}

function resetFlight() {
  state.flight = { active: false, landed: false, t: 0, pts: [], hang: 0, trail: [] };
}

function throwBall() {
  const d = state.field.cache ?? fieldDerived();
  const fl = state.flight;
  fl.pts = d.drag.pts;
  fl.hang = d.drag.hang;
  fl.t = 0;
  fl.active = true;
  fl.landed = false;
  fl.trail = [];
}

// ── 2 · the gyro tab ─────────────────────────────────────────
const GYRO_V = 55 * MPH;        // the flight the stability numbers refer to
const SLOWMO = 8;               // visual slow-motion factor for spin

function gyroDerived() {
  const g = state.gyro;
  const v = GYRO_V;
  const s = g.rps > 0 ? stabilityFactor(g.rps, v) : 0;
  const crit = criticalSpinRps(v);
  const L = angularMomentum(g.rps);
  const omega5 = g.rps > 0 ? precessionRate(5 * DEG, g.rps, v) : Infinity;
  const period = Number.isFinite(omega5) && omega5 > 0 ? (2 * Math.PI) / omega5 : Infinity;
  const Malpha = overturnSlope(v);
  return { s, crit, L, period, Malpha };
}

function renderGyro() {
  const d = gyroDerived();
  $("gyro-s").textContent = state.gyro.rps > 0 ? d.s.toFixed(1) : "0.0";
  const verdict = $("gyro-verdict");
  if (state.gyro.mode === "tumble") {
    verdict.textContent = "端对端翻跟头";
  } else if (d.s >= 2) {
    verdict.textContent = "稳如炮弹";
  } else if (d.s >= 1) {
    verdict.textContent = "边缘稳定";
  } else {
    verdict.textContent = state.gyro.rps > 0 ? "晃成翻跟头" : "不转 = 翻跟头";
  }
  $("gyro-crit").textContent = d.crit.toFixed(1);
  $("gyro-L").textContent = d.L.toFixed(3);
  $("gyro-prec").textContent = Number.isFinite(d.period) ? d.period.toFixed(1) : "—";

  const w = spinOmega(state.gyro.rps);
  $("gyro-formula").innerHTML =
    `s <span class="op">=</span> I<sub>a</sub>²ω² / (2·I<sub>t</sub>·M<sub>α</sub>)` +
    ` <span class="cm"># 炮弹判据</span><br>` +
    `&nbsp;&nbsp;<span class="op">=</span> (${I_AXIAL.toExponential(3)})²·(${w.toFixed(1)})² ` +
    `/ (2·${I_TRANS.toExponential(3)}·${d.Malpha.toFixed(4)})<br>` +
    `&nbsp;&nbsp;<span class="op">=</span> <span class="hl">${d.s.toFixed(2)}</span>` +
    ` <span class="cm">（v = 55 mph, C<sub>mα</sub> = ${CM_ALPHA}）</span><br>` +
    `ω<sub>c</sub> <span class="op">=</span> √(2·I<sub>t</sub>·M<sub>α</sub>)/I<sub>a</sub> ` +
    `<span class="op">=</span> <span class="hl">${d.crit.toFixed(2)} 圈/秒</span>` +
    ` <span class="cm"># s = 1 的那条线</span><br>` +
    `Ω <span class="op">=</span> τ/(I<sub>a</sub>ω) <span class="cm"># 鼻尖追速度的慢圈</span>`;

  drawGyro();
  drawStabChart();
}

function drawGyro() {
  const cv = $("gyro-canvas");
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const cx = W / 2, cy = H / 2;
  ctx.clearRect(0, 0, W, H);

  // backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#173a22");
  bg.addColorStop(1, "#0f2a18");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(247,245,239,.12)";
  for (let yd = 40; yd < W; yd += 80) {
    ctx.beginPath(); ctx.moveTo(yd, 30); ctx.lineTo(yd, H - 30); ctx.stroke();
  }

  const g = state.gyro;
  const d = gyroDerived();

  if (g.mode === "tumble") {
    // end-over-end: the whole silhouette cartwheels at ~4 rps, slow-motioned
    const chi = g.phase * Math.PI * (4 / SLOWMO) * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(chi);
    ctx.fillStyle = "#8a4b1f";
    ctx.strokeStyle = "#f2ead8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 180, 100, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    hud(`端对端 · 绕横轴 I_t = ${I_TRANS.toExponential(2)} · C_D ≈ ${CD_TUMBLE}`);
    return;
  }

  // wobble centre: radius converges when s > 1, grows when s < 1
  const wobPx = g.wobA * 70;
  const ox = cx + wobPx * Math.cos(g.wobDir);
  const oy = cy + 0.6 * wobPx * Math.sin(g.wobDir);

  // the precession circle being traced
  ctx.strokeStyle = "rgba(232,199,102,.4)";
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(wobPx, 2), Math.max(wobPx * 0.6, 2), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // velocity direction (gold arrow to the right)
  ctx.strokeStyle = "#e8c766";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx + 150, cy - 120);
  ctx.lineTo(cx + 260, cy - 120);
  ctx.lineTo(cx + 248, cy - 126);
  ctx.moveTo(cx + 260, cy - 120);
  ctx.lineTo(cx + 248, cy - 114);
  ctx.stroke();
  ctx.fillStyle = "#e8c766";
  ctx.font = "13px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.fillText("速度方向", cx + 150, cy - 132);

  // the ball, seen from behind, spinning about its long axis
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(Math.atan2(0.6 * Math.sin(g.wobDir), Math.cos(g.wobDir)) * (wobPx / 70) * 0.4);
  ctx.fillStyle = "#8a4b1f";
  ctx.strokeStyle = "#f2ead8";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 190, 105, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // laces and stripes orbit the rim: three dots phase-locked to the spin
  const phi = g.phase * (g.rps / SLOWMO) * 2 * Math.PI;
  for (let k = 0; k < 3; k += 1) {
    const a = phi + (k * 2 * Math.PI) / 3;
    const front = Math.cos(a);
    if (front > 0.05) {
      ctx.fillStyle = "rgba(242,234,216,.9)";
      ctx.beginPath();
      ctx.arc(190 * Math.cos(a), 105 * Math.sin(a), 4 + 4 * front, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // the white stripes near each tip
  ctx.strokeStyle = "rgba(242,234,216,.75)";
  ctx.lineWidth = 3;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 105, -58 * 0.62);
    ctx.lineTo(sx * 105, 58 * 0.62);
    ctx.stroke();
  }
  ctx.restore();

  // the nose needle: where the nose points — precessing around the velocity
  const noseDrop = g.wobA * 60 * Math.sin(g.wobDir);
  ctx.strokeStyle = "rgba(247,245,239,.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + 300, oy + noseDrop);
  ctx.stroke();

  hud(`${g.rps.toFixed(1)} 圈/秒 · s = ${d.s.toFixed(2)} · 慢放 ${SLOWMO}×`);

  function hud(text) {
    ctx.fillStyle = "rgba(247,245,239,.85)";
    ctx.font = "15px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, W / 2, H - 26);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(247,245,239,.5)";
    ctx.font = "13px ui-monospace, Menlo, monospace";
    ctx.fillText("后视图", 18, 30);
  }
}

function drawStabChart() {
  const cv = $("stab-chart");
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const pad = { l: 70, r: 24, t: 22, b: 44 };
  const X0 = 0, X1 = 15;
  const Y0 = -2, Y1 = 2;        // log10 s: 0.01 … 100
  const px = (r) => pad.l + ((r - X0) / (X1 - X0)) * (W - pad.l - pad.r);
  const py = (s) => pad.t + (1 - (Math.log10(Math.max(s, 1e-3)) - Y0) / (Y1 - Y0)) * (H - pad.t - pad.b);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fbfaf4";
  ctx.fillRect(0, 0, W, H);

  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.strokeStyle = "#e3ded0";
  for (const r of [0, 3, 6, 9, 12, 15]) {
    ctx.beginPath(); ctx.moveTo(px(r), pad.t); ctx.lineTo(px(r), H - pad.b); ctx.stroke();
    ctx.fillStyle = "#5a6058";
    ctx.textAlign = "center";
    ctx.fillText(`${r}`, px(r), H - pad.b + 16);
  }
  for (const e of [-2, -1, 0, 1, 2]) {
    ctx.beginPath(); ctx.moveTo(pad.l, py(10 ** e)); ctx.lineTo(W - pad.r, py(10 ** e)); ctx.stroke();
    ctx.fillStyle = "#5a6058";
    ctx.textAlign = "right";
    ctx.fillText(`s=${10 ** e}`, pad.l - 8, py(10 ** e) + 4);
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#5a6058";
  ctx.fillText("自转 圈/秒（55 mph 弹速）", (pad.l + W - pad.r) / 2, H - 8);

  // s = 1 threshold
  ctx.strokeStyle = "#a3282a";
  ctx.setLineDash([7, 5]);
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(pad.l, py(1)); ctx.lineTo(W - pad.r, py(1)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#a3282a";
  ctx.textAlign = "left";
  ctx.fillText("s = 1 · 稳定性门槛", px(0.4), py(1) - 6);

  // the curve
  ctx.strokeStyle = "#8a4b1f";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  let started = false;
  for (let r = 0.15; r <= 15; r += 0.05) {
    const X = px(r), Y = py(stabilityFactor(r, GYRO_V));
    if (!started) { ctx.moveTo(X, Y); started = true; } else ctx.lineTo(X, Y);
  }
  ctx.stroke();

  // the NFL marker
  const xn = px(10);
  ctx.fillStyle = "#1d4a2c";
  ctx.beginPath(); ctx.arc(xn, py(stabilityFactor(10, GYRO_V)), 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1d4a2c";
  ctx.textAlign = "center";
  ctx.fillText("NFL ≈ 10", xn, py(stabilityFactor(10, GYRO_V)) - 12);

  // the current position
  const rps = state.gyro.rps;
  if (rps > 0.05) {
    ctx.fillStyle = "#232823";
    ctx.beginPath(); ctx.arc(px(rps), py(stabilityFactor(rps, GYRO_V)), 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#c9a227";
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(px(rps), py(stabilityFactor(rps, GYRO_V)), 7, 0, Math.PI * 2); ctx.stroke();
  }
}

// ── 3 · the rating tab ───────────────────────────────────────
const BAR_LABELS = ["完成率", "每次尝试码数", "达阵率", "被截率"];

function buildBars() {
  const host = $("bars");
  BAR_LABELS.forEach((label, i) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML =
      `<div class="bar-head"><span>${label}</span><span class="bar-val" id="bar-val-${i}">—</span></div>` +
      `<div class="bar-track">` +
      `<div class="bar-tick" style="left:${(1 / 2.375) * 100}%"></div>` +
      `<div class="bar-tick ceil" style="left:100%"></div>` +
      `<div class="bar-fill" id="bar-fill-${i}"></div>` +
      `<div class="bar-raw" id="bar-raw-${i}"></div>` +
      `</div>` +
      `<div class="bar-scale"><span>0</span><span>1.0 基线</span><span>2.375 封顶</span></div>`;
    host.appendChild(row);
  });
}

function buildRatingPresets() {
  const host = $("rating-presets");
  RATING_PRESETS.forEach((p, i) => {
    const b = document.createElement("button");
    b.textContent = p.label;
    b.dataset.i = i;
    b.addEventListener("click", () => selectRatingPreset(i));
    host.appendChild(b);
  });
}

function syncRatingSliders() {
  const r = state.rating;
  $("s-comp").value = r.compPct; $("o-comp").textContent = r.compPct.toFixed(1);
  $("s-ypa").value = r.ypa; $("o-ypa").textContent = r.ypa.toFixed(2);
  $("s-td").value = r.tdPct; $("o-td").textContent = r.tdPct.toFixed(1);
  $("s-int").value = r.intPct; $("o-int").textContent = r.intPct.toFixed(1);
}

function selectRatingPreset(i) {
  const p = RATING_PRESETS[i];
  state.rating = {
    compPct: (p.comp / p.att) * 100,
    ypa: p.yds / p.att,
    tdPct: (p.td / p.att) * 100,
    intPct: (p.int / p.att) * 100,
  };
  syncRatingSliders();
  renderRating();
  for (const b of $("rating-presets").children) {
    b.classList.toggle("on", Number(b.dataset.i) === i);
  }
}

function renderRating() {
  const r = state.rating;
  const rr = ratingFromRates(r);
  $("rating-value").textContent = rr.value.toFixed(1);

  let pinned = 0, floored = 0;
  const subs = [
    `((comp% − 30)/20)`,
    `((YPA − 3)/4)`,
    `(TD%/5)`,
    `(2.375 − INT%/4)`,
  ];
  const rawLines = [];
  BAR_LABELS.forEach((label, i) => {
    const raw = rr.raw[i];
    const c = rr.c[i];
    const isPin = raw > 2.375;
    const isFloor = raw < 0;
    if (isPin) pinned += 1;
    if (isFloor) floored += 1;
    $("bar-fill-" + i).style.width = `${(c / 2.375) * 100}%`;
    $("bar-fill-" + i).classList.toggle("pinned", isPin || isFloor);
    const rawEl = $("bar-raw-" + i);
    const rawPos = clamp(raw / 2.375, 0, 1);
    rawEl.style.left = `${rawPos * 100}%`;
    rawEl.style.opacity = (isPin || isFloor) ? "1" : "0.35";
    $("bar-val-" + i).textContent =
      `${c.toFixed(3)}${isPin ? "（封顶）" : isFloor ? "（封底）" : ""}`;
    rawLines.push(
      `c${i + 1} <span class="op">=</span> ${subs[i].replace("comp%", r.compPct.toFixed(1))
        .replace("YPA", r.ypa.toFixed(2)).replace("TD%", r.tdPct.toFixed(1))
        .replace("INT%", r.intPct.toFixed(1))}` +
      ` <span class="op">=</span> <span class="hl">${c.toFixed(3)}</span>` +
      (isPin ? ` <span class="cm"># 原始 ${raw.toFixed(2)}，夹回 2.375</span>`
             : isFloor ? ` <span class="cm"># 原始 ${raw.toFixed(2)}，夹回 0</span>` : ""),
    );
  });
  $("rating-pin").textContent =
    `${pinned} 项封顶 · ${floored} 项封底`;

  $("rating-formula").innerHTML =
    rawLines.join("<br>") +
    `<br>评分 <span class="op">=</span> (Σc/6)·100 ` +
    `<span class="op">=</span> (${rr.c.map((c) => c.toFixed(3)).join(" + ")})/6 × 100 ` +
    `<span class="op">=</span> <span class="hl">${rr.value.toFixed(1)}</span>`;

  // the honest check against real stat lines (computed, never hard-coded)
  const m = ratingComponents(RATING_PRESETS[0]);
  const rg = ratingComponents(RATING_PRESETS[1]);
  $("rating-crosscheck").innerHTML =
    `真档案对表：曼宁 2004（336/497 · 4557 码 · 49 TD · 10 INT）→ ` +
    `(${m.c.map((c) => c.toFixed(2)).join("+")})/6×100 = <b>${m.value.toFixed(1)}</b>；` +
    `罗杰斯 2011（343/502 · 4643 码 · 45 TD · 6 INT）= <b>${rg.value.toFixed(1)}</b>。`;
}

// ── 4 · the ladder tab ───────────────────────────────────────
function buildLadder() {
  const svg = $("ladder-chart");
  const NS = "http://www.w3.org/2000/svg";
  const W = 1280, H = 420;
  const pad = { l: 60, r: 40 };
  const y0 = 1902, y1 = 2014;
  const px = (year) => pad.l + ((year - y0) / (y1 - y0)) * (W - pad.l - pad.r);

  const AX = 250;      // the axis line
  svg.innerHTML = "";

  const axis = document.createElementNS(NS, "line");
  axis.setAttribute("x1", pad.l - 20); axis.setAttribute("x2", W - pad.r + 10);
  axis.setAttribute("y1", AX); axis.setAttribute("y2", AX);
  axis.setAttribute("class", "axis");
  svg.appendChild(axis);

  for (const dec of [1910, 1930, 1950, 1970, 1990, 2010]) {
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

  // stagger same-year pins (1905 ×2, 1906 ×2)
  const yearCount = {};
  const yearSeen = {};
  for (const e of EVENTS) yearCount[e.y] = (yearCount[e.y] || 0) + 1;
  const pinXs = EVENTS.map((e) => {
    const idx = yearSeen[e.y] || 0;
    yearSeen[e.y] = idx + 1;
    const n = yearCount[e.y];
    const spread = n > 1 ? (idx - (n - 1) / 2) * 16 : 0;
    return px(e.y) + spread;
  });

  // greedy two-row label placement above and below
  const rows = [
    { y: 172, last: -Infinity }, { y: 128, last: -Infinity },
    { y: 316, last: -Infinity }, { y: 350, last: -Infinity },
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
    link.setAttribute("stroke", "rgba(90,96,88,.5)");
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
      c.setAttribute("fill", e.kind === "crisis" ? "#232823"
        : e.kind === "rule" ? "#8a4b1f"
        : e.kind === "ball" ? "#c9a227"
        : e.kind === "stat" ? "#1c4f9c" : "#1d4a2c");
      c.setAttribute("stroke", "#f3f0e7");
      c.setAttribute("stroke-width", 2);
      pin.appendChild(c);
    }

    pin.addEventListener("click", () => selectEvent(i));
    svg.appendChild(pin);
  });

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
  poly.setAttribute("stroke", "#f3f0e7");
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
    `${e.star ? `<span class="star-flag">★ 今天的主角</span>` : ""}` +
    `</div><p style="margin:8px 0 0">${e.text}</p>`;
}

// ── the animation loop ───────────────────────────────────────
function step(dt) {
  // the flight
  const fl = state.flight;
  if (fl.active) {
    fl.t += dt;
    const pos = (() => {
      const pts = fl.pts;
      for (let i = 1; i < pts.length; i += 1) {
        if (pts[i].t >= fl.t) {
          const a = pts[i - 1], b = pts[i];
          const u = (fl.t - a.t) / (b.t - a.t || 1);
          return { x: a.x + u * (b.x - a.x), y: a.y + u * (b.y - a.y) };
        }
      }
      return pts[pts.length - 1];
    })();
    fl.trail.push(pos);
    if (fl.trail.length > 90) fl.trail.shift();
    if (fl.t >= fl.hang) {
      fl.active = false;
      fl.landed = true;
      const yd = (state.field.cache?.drag.range ?? 0) / YD;
      $("field-status").textContent =
        `球飞了 ${fl.hang.toFixed(2)} 秒，落在 ${fmt(yd, 1)} 码` +
        `${yd >= FIRST_DOWN_YD ? " —— 达阵！" : " —— 落地未接，球权交给对方。"}`;
    }
  }

  // the gyro
  const g = state.gyro;
  g.phase += dt;
  const s = g.rps > 0 ? stabilityFactor(g.rps, GYRO_V) : 0;
  // wobble amplitude: damps when s > 1, grows when s < 1
  const lambda = (s - 1) * 1.1;
  g.wobA = clamp(g.wobA + (-lambda * g.wobA) * dt, 0.02, 1);
  g.wobDir += (0.9 + Math.min(s, 6) * 0.05) * dt;
}

function renderActive() {
  const active = document.querySelector("main > section.on")?.id || "";
  if (active === "tab-field") drawField();
  else if (active === "tab-gyro") drawGyro();
}

function frame() {
  if (!state.videoMode) step(1 / 60);
  renderActive();
  rafId = requestAnimationFrame(frame);
}

// ── wiring ───────────────────────────────────────────────────
$("s-v").addEventListener("input", (e) => {
  state.field.vMph = Number(e.target.value);
  resetFlight(); clearPresetHighlight(); syncOutputs(); renderField();
});
$("s-angle").addEventListener("input", (e) => {
  state.field.angle = Number(e.target.value);
  resetFlight(); clearPresetHighlight(); syncOutputs(); renderField();
});
$("s-h").addEventListener("input", (e) => {
  state.field.h = Number(e.target.value);
  resetFlight(); clearPresetHighlight(); syncOutputs(); renderField();
});
function syncOutputs() {
  $("o-v").textContent = state.field.vMph.toFixed(1);
  $("o-angle").textContent = state.field.angle.toFixed(1);
  $("o-h").textContent = state.field.h.toFixed(2);
}

$("btn-throw").addEventListener("click", throwBall);

$("s-spin").addEventListener("input", (e) => {
  state.gyro.rps = Number(e.target.value);
  $("o-spin").textContent = state.gyro.rps.toFixed(1);
  renderGyro();
});
$("btn-spin-mode").addEventListener("click", () => setGyroMode("spin"));
$("btn-tumble-mode").addEventListener("click", () => setGyroMode("tumble"));
function setGyroMode(mode) {
  state.gyro.mode = mode;
  $("btn-spin-mode").classList.toggle("on", mode === "spin");
  $("btn-tumble-mode").classList.toggle("on", mode === "tumble");
  renderGyro();
}

$("s-comp").addEventListener("input", ratingSlider("compPct", 1));
$("s-ypa").addEventListener("input", ratingSlider("ypa", 2));
$("s-td").addEventListener("input", ratingSlider("tdPct", 1));
$("s-int").addEventListener("input", ratingSlider("intPct", 1));
function ratingSlider(key, digits) {
  return (e) => {
    state.rating[key] = Number(e.target.value);
    $(`o-${key === "compPct" ? "comp" : key === "ypa" ? "ypa" : key === "tdPct" ? "td" : "int"}`)
      .textContent = state.rating[key].toFixed(digits);
    for (const b of $("rating-presets").children) b.classList.remove("on");
    renderRating();
  };
}

$("btn-baseline").addEventListener("click", () => {
  state.rating = { ...RATING_BASE };
  syncRatingSliders();
  renderRating();
  for (const b of $("rating-presets").children) b.classList.remove("on");
});

// ── video hooks ──────────────────────────────────────────────
window.__demo = {
  setTab,
  scrollToTop,
  setVideoMode(on) {
    state.videoMode = on;
    document.body.classList.toggle("video-mode", on);
    if (on && rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    if (!on && rafId === null) rafId = requestAnimationFrame(frame);
  },
  selectThrow,
  setV(mph) { state.field.vMph = mph; resetFlight(); syncFieldSliders(); renderField(); },
  setAngle(deg) { state.field.angle = deg; resetFlight(); syncFieldSliders(); renderField(); },
  setH(m) { state.field.h = m; resetFlight(); syncFieldSliders(); renderField(); },
  throwBall,
  tick(dt) { step(dt); renderActive(); },
  flightT: () => state.flight.t,
  flightActive: () => state.flight.active,
  setSpin(rps) { state.gyro.rps = rps; $("s-spin").value = rps; $("o-spin").textContent = rps.toFixed(1); renderGyro(); },
  setGyroMode,
  selectRatingPreset,
  setRate(key, value) {
    state.rating[key] = value;
    syncRatingSliders();
    renderRating();
  },
  resetBaseline() {
    state.rating = { ...RATING_BASE };
    syncRatingSliders();
    renderRating();
  },
  selectEvent,
};

// ── boot ─────────────────────────────────────────────────────
buildPresets();
buildBars();
buildRatingPresets();
syncRatingSliders();
renderRating();
renderGyro();
selectThrow(0);
buildLadder();
rafId = requestAnimationFrame(frame);
