// app.js — Faraday's Ring: the 29 Aug 1831 induction studio, driven by the
// exact forms in physics.js. Every canvas is a pure function of state.t and
// the event history (piecewise-closed-form replay, no numerical
// differentiation), so window.__demo.step(dt) reproduces any frame.

import * as P from "./physics.js";

// ---------- deterministic hash (no Math.random anywhere) ----------
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------- state ----------
const state = {
  preset: "ring1831",
  tab: "kick",
  videoMode: false,
  t: 0,
  ring: { ...P.RING_DEFAULTS, ac: { ...P.RING_DEFAULTS.ac } },
  closed: false,   // knife-switch position (manual drive only)
  events: [],      // { t, kind:'make'|'break', I0, tEff? }
  kicks: [],       // { t, q }  for the ballistic needle
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
const benchCtx = setup(document.getElementById("bench"), 960, 440);
const scopeCtx = setup(document.getElementById("scope"), 340, 300);
const kickCtx = setup(document.getElementById("kick"), 960, 430);
const kickPeakCtx = setup(document.getElementById("kickpeak"), 460, 230);
const kickQCtx = setup(document.getElementById("kickq"), 460, 230);
const coreCtx = setup(document.getElementById("core"), 460, 340);
const coreMCtx = setup(document.getElementById("corem"), 460, 160);
const coreBCtx = setup(document.getElementById("coreb"), 460, 160);
const acCtx = setup(document.getElementById("ac"), 960, 300);

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
  line2: CSS.getPropertyValue("--line2").trim(),
  green: CSS.getPropertyValue("--green").trim(),
  phosphor: CSS.getPropertyValue("--phosphor").trim(),
};

// ---------- derived quantities ----------
const Rl = () => P.reluctance(state.ring.muR);
const L1 = () => P.inductance(state.ring.N1, Rl());
const L2 = () => P.inductance(state.ring.N2, Rl());
const Mv = () => P.mutualInductance(state.ring.N1, state.ring.N2, Rl());
const Iinf = () => P.steadyCurrent(state.ring.V, state.ring.R1);
const tauNow = () => P.tau(L1(), state.ring.R1);
const R2 = () => P.secondaryLoopR(state.ring.N2);
const breakNow = (tb = state.ring.tbUs * 1e-6) =>
  P.breakAnalysis({ L: L1(), I0: Iinf(), tb, vBd: state.ring.vBd, N1: state.ring.N1, N2: state.ring.N2 });
const chargePerKick = () =>
  Math.abs(P.chargeThrough(state.ring.N2, P.fluxOf(state.ring.N1, Iinf(), Rl()), R2()));

// current at absolute time t from the event history (piecewise exact)
function currentAt(t) {
  let I = 0;
  for (const ev of state.events) {
    if (ev.t > t) break;
    I = P.segmentCurrent(ev, t, {
      V: state.ring.V, R1: state.ring.R1, L1: L1(), tEffOf: (e) => e.tEff, I0: ev.I0,
    });
  }
  return I;
}
// induced EMF at absolute time t: only the segment opened by the last event
function emf2At(t) {
  let e = 0;
  for (const ev of state.events) {
    if (ev.t > t) break;
    e = P.segmentEmf2(ev, t, {
      V: state.ring.V, R1: state.ring.R1, L1: L1(), M: Mv(), tEffOf: (x) => x.tEff, I0: ev.I0,
    });
  }
  return e;
}

const fmt = (n, d = 1) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtSI = (n, unit = "", d = 2) => {
  const a = Math.abs(n);
  if (a === 0) return `0 ${unit}`.trim();
  if (a >= 1e7) return `${fmt(n / 1e6, 0)} M${unit}`.trim();
  if (a >= 1e3) return `${fmt(n / 1e3, d)} k${unit}`.trim();
  if (a >= 1) return `${fmt(n, d)} ${unit}`.trim();
  if (a >= 1e-3) return `${fmt(n * 1e3, d)} m${unit}`.trim();
  if (a >= 1e-6) return `${fmt(n * 1e6, d)} µ${unit}`.trim();
  return `${fmt(n * 1e9, d)} n${unit}`.trim();
};
const fmtVolt = (v) => (Math.abs(v) >= 1000 ? `${fmt(v / 1000, 2)} kV` : `${fmt(v, v < 10 ? 2 : 0)} V`);

// ---------- switch events ----------
let autoDemo = { on: true, made: false, broke: false };

function fire(kind) {
  if (state.ring.drive === "ac") return;
  const t = state.t;
  const I = currentAt(t);
  if (kind === "make" && !state.closed) {
    state.events.push({ t, kind: "make", I0: I });
    state.kicks.push({ t, q: -(Mv() * (Iinf() - I)) / R2() });
    state.closed = true;
  } else if (kind === "break" && state.closed) {
    const ba = breakNow();
    state.events.push({ t, kind: "break", I0: I, tEff: ba.tEff });
    state.kicks.push({ t, q: (Mv() * I) / R2() });
    state.closed = false;
  }
  if (state.events.length > 14) state.events = state.events.slice(-14);
  if (state.kicks.length > 14) state.kicks = state.kicks.slice(-14);
  syncSwitchUI();
}

function makeBreak() {
  autoDemo.on = false; // a human took over
  fire(state.closed ? "break" : "make");
}

function syncSwitchUI() {
  const chip = $("switch-chip"), btn = $("switch-btn");
  if (state.ring.drive === "ac") {
    chip.textContent = "≈ 交流驱动";
    chip.classList.remove("on");
    btn.classList.remove("armed");
  } else if (state.closed) {
    chip.textContent = "● 闭合 · 稳恒电流";
    chip.classList.add("on");
    btn.classList.add("armed");
  } else {
    chip.textContent = "○ 断开 · 电弧余温";
    chip.classList.remove("on");
    btn.classList.remove("armed");
  }
}

// ballistic needle: deflection from the kick history, pure in t
const KICK_RISE = 0.12, KICK_HOLD = 1.1, KICK_FALL = 1.6;
function needleDeflection(t, qRef = 12e-3) {
  let theta = 0;
  for (const k of state.kicks) {
    const s = t - k.t;
    if (s < 0) continue;
    const mag = Math.min(1.15, Math.abs(k.q) / qRef);
    let pulse;
    if (s < KICK_RISE) pulse = (s / KICK_RISE) * Math.exp(1 - s / KICK_RISE);
    else if (s < KICK_HOLD) pulse = 1;
    else pulse = Math.exp(-(s - KICK_HOLD) / KICK_FALL);
    theta += Math.sign(k.q) * mag * pulse;
  }
  return Math.max(-1.15, Math.min(1.15, theta));
}

// ============================================================ 1 · the bench
function drawBench() {
  const W = 960, H = 440, ctx = benchCtx;
  ctx.clearRect(0, 0, W, H);
  const t = state.t;
  const ac = state.ring.drive === "ac";
  const { N1, N2, muR } = state.ring;

  // bench top
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(0, 330, W, H - 330);
  ctx.strokeStyle = COL.line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 330); ctx.lineTo(W, 330); ctx.stroke();

  const cx = 340, cy = 190, Ro = 126, Ri = 101;
  const iron = muR >= 50;

  // flux loops (inside the core), brightness ∝ |I| (or |Φ| in ac mode)
  const I = ac ? 1 : currentAt(t);
  const drive = ac ? Math.abs(P.emfAC(state.ring.N2, P.TAU * state.ring.ac.f,
    P.fluxAmpFromV(state.ring.ac.V1, state.ring.ac.f, state.ring.N1), t)) : 0;
  const fluxN = ac ? Math.min(1, drive / 8) : Math.min(1, Math.abs(I) / Math.max(0.4, Iinf()));
  if (fluxN > 0.012) {
    const dirSign = ac ? Math.sign(Math.sin(P.TAU * state.ring.ac.f * t)) : Math.sign(I) || 1;
    ctx.save();
    ctx.setLineDash([7, 6]);
    for (let i = 0; i < 3; i++) {
      const rr = 92 - i * 22;
      ctx.strokeStyle = COL.gold;
      ctx.globalAlpha = 0.15 + 0.6 * fluxN;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr * 1.28, rr, 0, 0, P.TAU);
      ctx.stroke();
      // arrowhead riding the loop (direction = Lenz's business)
      const ph = t * 0.7 + i * 2.1;
      const ax = cx + Math.cos(ph) * rr * 1.28, ay = cy + Math.sin(ph) * rr;
      const tang = ph + dirSign * (Math.PI / 2);
      ctx.setLineDash([]);
      ctx.fillStyle = COL.gold2;
      ctx.beginPath();
      ctx.moveTo(ax + Math.cos(tang) * 8, ay + Math.sin(tang) * 8);
      ctx.lineTo(ax + Math.cos(tang + 2.6) * 7, ay + Math.sin(tang + 2.6) * 7);
      ctx.lineTo(ax + Math.cos(tang - 2.6) * 7, ay + Math.sin(tang - 2.6) * 7);
      ctx.closePath(); ctx.fill();
      ctx.setLineDash([7, 6]);
    }
    ctx.restore();
    ctx.fillStyle = COL.dim; ctx.font = "11px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
    ctx.fillText(`Φ = N₁I/ℛ${ac ? "（交流，方向每半周翻转）" : ""}`, cx, cy + 148);
  }

  // the ring itself
  const grad = ctx.createRadialGradient(cx, cy, Ri, cx, cy, Ro);
  if (iron) {
    grad.addColorStop(0, "#2a2019"); grad.addColorStop(0.55, "#3d3128"); grad.addColorStop(1, "#221a12");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, Ro, 0, P.TAU); ctx.arc(cx, cy, Ri, 0, P.TAU, true); ctx.fill();
    ctx.strokeStyle = COL.line2; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, Ro, 0, P.TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, Ri, 0, P.TAU); ctx.stroke();
  } else {
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COL.blue; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(cx, cy, Ro, 0, P.TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, Ri, 0, P.TAU); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.fillStyle = COL.blue; ctx.font = "12px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
    ctx.fillText("空芯 · µ_r = 1", cx, cy + 5);
  }
  ctx.fillStyle = COL.faint; ctx.font = "11px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  ctx.fillText(iron ? `软铁环 · 6 in 外径 · µ_r = ${fmt(muR, 0)}` : "法拉第的险情：没有铁", cx, cy - Ro - 10);

  // windings: arcs across the annulus
  const winding = (a0, a1, n, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = 3.6; ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const a = a0 + ((i + 0.5) / n) * (a1 - a0);
      ctx.beginPath();
      ctx.arc(cx, cy, (Ro + Ri) / 2, a - 0.16, a + 0.16);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  };
  const n1Arcs = Math.max(6, Math.round(Math.min(26, (state.ring.N1 / 120) * 26)));
  const n2Arcs = Math.max(6, Math.round(Math.min(26, (Math.log10(state.ring.N2 / 20) / 3) * 22 + 6)));
  winding(Math.PI * 0.62, Math.PI * 1.38, n1Arcs, COL.gold);
  winding(-Math.PI * 0.38, Math.PI * 0.38, n2Arcs, COL.blue);
  ctx.fillStyle = COL.gold2; ctx.font = "12px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  ctx.fillText(`A · N₁ = ${N1} 匝`, cx - 128, cy + 158);
  ctx.fillStyle = COL.blue;
  ctx.fillText(`B · N₂ = ${fmt(N2, 0)} 匝`, cx + 128, cy + 158);

  // terminals
  const term = (ang, r) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  const [ta1x, ta1y] = term(Math.PI * 1.28, Ro + 8);
  const [ta2x, ta2y] = term(Math.PI * 0.72, Ro + 8);
  const [tb1x, tb1y] = term(-Math.PI * 0.28, Ro + 8);
  const [tb2x, tb2y] = term(Math.PI * 0.28, Ro + 8);

  // battery (or future AC source) + knife switch
  const batX = 78, batY = 372;
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.6;
  if (ac) {
    ctx.beginPath(); ctx.arc(batX + 40, batY + 24, 20, 0, P.TAU); ctx.stroke();
    ctx.font = "16px ui-monospace, Menlo, monospace"; ctx.fillStyle = COL.blue;
    ctx.fillText("~", batX + 40, batY + 30);
    ctx.fillStyle = COL.faint; ctx.font = "11px ui-monospace, Menlo, monospace";
    ctx.fillText(`未来牌交流电源 ${fmt(state.ring.ac.V1, 1)} V · ${state.ring.ac.f} Hz`, batX + 40, batY + 58);
  } else {
    for (let i = 0; i < 5; i++) {
      const x = batX + i * 13;
      ctx.beginPath(); ctx.moveTo(x, batY); ctx.lineTo(x, batY + (i % 2 ? 30 : 40)); ctx.stroke();
    }
    ctx.fillStyle = COL.faint; ctx.font = "11px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
    ctx.fillText(`${P.HIST.batteryPairs} 对 4 英寸铜锌板 · ${fmt(state.ring.V, 1)} V`, batX + 27, batY + 58);
  }

  // knife switch: pivot (245,392), contact (322,392)
  const px = 245, py = 392, qx = 322;
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px - 10, py); ctx.lineTo(px, py); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(qx, py); ctx.lineTo(qx + 8, py); ctx.stroke();
  ctx.beginPath(); ctx.arc(px, py, 4.4, 0, P.TAU); ctx.fillStyle = COL.gold2; ctx.fill();
  const bladeAng = ac ? 0 : (state.closed ? 0 : -0.95);
  const bl = 74;
  ctx.strokeStyle = COL.gold; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(bladeAng) * bl, py + Math.sin(bladeAng) * bl);
  ctx.stroke(); ctx.lineCap = "butt";
  ctx.beginPath(); ctx.arc(qx, py, 4, 0, P.TAU); ctx.fillStyle = COL.ink; ctx.fill();
  ctx.fillStyle = COL.faint; ctx.font = "11px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  ctx.fillText(ac ? "（交流下刀闸常闭）" : state.closed ? "合闸 · 电流稳了" : "断闸", px + 40, py + 40);

  // spark at the break, if fresh — and only if the break was fast enough to
  // strike an arc (vOpen > vBd); a slow knife never sparks
  if (!ac && !state.closed) {
    const last = state.events[state.events.length - 1];
    if (last && last.kind === "break" && t - last.t < 0.16) {
      const vDemand = P.breakSpike(L1(), last.I0, state.ring.tbUs * 1e-6);
      if (vDemand > state.ring.vBd) {
        const age = (t - last.t) / 0.16;
        const power = Math.min(1, 0.35 + Math.log10(Math.max(10, last.v2 || 100)) / 4);
        for (let b = 0; b < 3; b++) {
          const seed = Math.floor(t * 30) * 7 + b * 13;
          ctx.strokeStyle = b === 0 ? "rgba(255,246,214,.95)" : "rgba(232,129,58,.8)";
          ctx.lineWidth = b === 0 ? 2.2 : 1.3;
          ctx.shadowColor = COL.ember; ctx.shadowBlur = 14 * power * (1 - age);
          ctx.beginPath();
          let sx = qx - 4, sy = py - 2 - b * 3;
          ctx.moveTo(sx, sy);
          for (let k = 1; k <= 4; k++) {
            sx = qx - 4 + ((qx - 8) / 4) * k + (hash(seed + k) - 0.5) * 7;
            sy = py - 2 - b * 3 + (hash(seed + k + 40) - 0.5) * 13 * (1 - age);
            ctx.lineTo(sx, sy);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = COL.ember; ctx.font = "12px ui-monospace, Menlo, monospace"; ctx.textAlign = "left";
        ctx.fillText(`啪！ε₁ 要 ${fmtVolt(vDemand)} → 电弧钳到 ${fmtVolt(state.ring.vBd)}`, qx + 16, py - 18);
      } else if (t - last.t < 0.3) {
        ctx.fillStyle = COL.faint; ctx.font = "11.5px ui-monospace, Menlo, monospace"; ctx.textAlign = "left";
        ctx.fillText(`慢断（${fmtSI(state.ring.tbUs * 1e-6, "s", 1)}）：ε₁ 只要 ${fmtVolt(vDemand)}，没有火花`, qx + 16, py - 18);
      }
    }
  }

  // wires: battery/switch → coil A ; coil B → galvanometer
  const wire = (pts, color, current, seedBase = 0) => {
    ctx.strokeStyle = color; ctx.lineWidth = 1.8;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    if (Math.abs(current) > 0.01) {
      let total = 0;
      const lens = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
        lens.push(d); total += d;
      }
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 6;
      const speed = ac ? 90 : 46 * Math.min(2, Math.abs(current));
      for (let d = 0; d < total; d += 46) {
        let s = (d + t * speed) % total;
        for (let i = 0; i < lens.length; i++) {
          if (s <= lens[i]) {
            const f = s / lens[i];
            const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f;
            const y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
            ctx.beginPath(); ctx.arc(x, y, 2.6, 0, P.TAU); ctx.fill();
            break;
          }
          s -= lens[i];
        }
      }
      ctx.shadowBlur = 0;
    }
  };
  const i1 = ac ? 1 : I;
  wire([[batX + 65, batY + 14], [px - 10, py]], COL.gold, ac ? 1 : i1);
  wire([[qx + 8, py], [qx + 8, 332], [ta2x, ta2y]], COL.gold, ac ? 1 : i1);
  wire([[batX + 12, batY + 6], [batX + 12, 64], [ta1x - 6, ta1y]], COL.gold, ac ? 1 : i1);

  // galvanometer
  const gx = 762, gy = 178, gr = 88;
  const i2 = ac
    ? P.emfAC(state.ring.N2, P.TAU * state.ring.ac.f,
        P.fluxAmpFromV(state.ring.ac.V1, state.ring.ac.f, state.ring.N1), t) / R2()
    : emf2At(t) / R2();
  let theta;
  if (ac) {
    theta = Math.max(-1, Math.min(1, i2 / Math.max(1e-6, (P.K4 * state.ring.ac.f * state.ring.N2 * P.fluxAmpFromV(state.ring.ac.V1, state.ring.ac.f, state.ring.N1)) / R2())));
  } else {
    theta = needleDeflection(t);
  }
  ctx.strokeStyle = COL.line2; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(gx, gy, gr, 0, P.TAU); ctx.stroke();
  ctx.fillStyle = "#100d09";
  ctx.beginPath(); ctx.arc(gx, gy, gr - 3, 0, P.TAU); ctx.fill();
  // scale arc ±45°
  ctx.strokeStyle = COL.faint; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(gx, gy, gr - 16, -Math.PI * 0.75, -Math.PI * 0.25); ctx.stroke();
  for (let i = -4; i <= 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * (Math.PI / 4);
    ctx.strokeStyle = i === 0 ? COL.dim : COL.faint;
    ctx.lineWidth = i === 0 ? 1.8 : 1;
    ctx.beginPath();
    ctx.moveTo(gx + Math.cos(a) * (gr - 16), gy + Math.sin(a) * (gr - 16));
    ctx.lineTo(gx + Math.cos(a) * (gr - (i % 2 === 0 ? 28 : 23)), gy + Math.sin(a) * (gr - (i % 2 === 0 ? 28 : 23)));
    ctx.stroke();
  }
  ctx.fillStyle = COL.faint; ctx.font = "11px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  ctx.fillText("−", gx - (gr - 40) * 0.71, gy - (gr - 40) * 0.71 + 4);
  ctx.fillText("0", gx, gy - (gr - 44));
  ctx.fillText("+", gx + (gr - 40) * 0.71, gy - (gr - 40) * 0.71 + 4);
  // needle
  const na = -Math.PI / 2 + theta * (Math.PI / 4);
  const hot = Math.abs(theta) > 0.04;
  ctx.strokeStyle = hot ? COL.red : COL.dim;
  ctx.lineWidth = 3;
  if (hot) { ctx.shadowColor = COL.red; ctx.shadowBlur = 10; }
  ctx.beginPath(); ctx.moveTo(gx, gy);
  ctx.lineTo(gx + Math.cos(na) * (gr - 26), gy + Math.sin(na) * (gr - 26));
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(gx, gy, 5, 0, P.TAU); ctx.fillStyle = COL.gold2; ctx.fill();
  const recentKick = [...state.kicks].reverse().find((k) => t - k.t >= 0 && t - k.t < 3.2);
  ctx.fillStyle = ac ? COL.blue : hot ? COL.red : COL.faint;
  ctx.font = "11.5px ui-monospace, Menlo, monospace";
  if (ac) ctx.fillText("指针随交流摆动——稳了！", gx, gy + gr + 22);
  else if (hot && recentKick) ctx.fillText(`踢！|q| = ${fmtSI(Math.abs(recentKick.q), "C")}`, gx, gy + gr + 22);
  else if (state.closed) ctx.fillText("稳恒电流：指针睡着了（ε₂ = 0）", gx, gy + gr + 22);
  else if (theta !== 0 && Math.abs(theta) < 0.012) ctx.fillText("近乎不动——这就是拿走铁环的代价", gx, gy + gr + 22);
  else ctx.fillText("冲击电流计 · 在等一次变化", gx, gy + gr + 22);
  wire([[tb1x + 8, tb1y], [486, 306], [gx - 40, gy + gr - 6]], COL.blue, Math.abs(i2) > 1e-4 ? Math.sign(i2) || 1 : 0);
  wire([[tb2x + 8, tb2y], [500, 320], [gx + 46, gy + gr - 2]], COL.blue, Math.abs(i2) > 1e-4 ? Math.sign(i2) || 1 : 0);

  // header annotation
  ctx.fillStyle = COL.faint; ctx.font = "11px ui-monospace, Menlo, monospace"; ctx.textAlign = "left";
  ctx.fillText("1831-08-29 · 皇家研究院 · 法拉第记录本 #1", 14, 22);
}

// ============================================================ 2 · the scope
function drawScope() {
  const W = 340, H = 300, ctx = scopeCtx;
  ctx.clearRect(0, 0, W, H);
  const WIN = 0.08, t1 = state.t, t0 = t1 - WIN;
  const iTop = 96, iBot = 10, eTop = 288, eMid = 192;
  const IinfV = Math.max(0.5, Iinf());

  const iToY = (i) => iBot + (1 - Math.min(1.15, i / IinfV)) * (iTop - iBot);

  // symmetric-log scale for ε₂
  const vals = [];
  for (let x = 0; x <= W; x += 4) vals.push(Math.abs(emf2At(t0 + (x / W) * WIN)));
  const vMax = Math.max(5, ...vals);
  const v0 = 0.4;
  const eToY = (v) => {
    const s = Math.sign(v);
    const m = Math.log10(1 + Math.abs(v) / v0) / Math.log10(1 + vMax / v0);
    return eMid - s * m * (eTop - eMid);
  };

  // zero lines + event ticks
  ctx.strokeStyle = "#2c2417"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, iToY(0)); ctx.lineTo(W, iToY(0)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, eMid); ctx.lineTo(W, eMid); ctx.stroke();
  for (const ev of state.events) {
    if (ev.t < t0 || ev.t > t1) continue;
    const x = ((ev.t - t0) / WIN) * W;
    ctx.strokeStyle = ev.kind === "make" ? COL.gold : COL.ember;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, iBot); ctx.lineTo(x, eTop); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ev.kind === "make" ? COL.gold2 : COL.ember;
    ctx.font = "10px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
    ctx.fillText(ev.kind === "make" ? "合" : "断", x, iBot + 20);
  }

  // I₁ trace
  ctx.strokeStyle = COL.gold2; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x++) {
    const y = iToY(currentAt(t0 + (x / W) * WIN));
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  // ε₂ trace
  ctx.strokeStyle = COL.blue; ctx.lineWidth = 1.7;
  ctx.beginPath();
  for (let x = 0; x <= W; x++) {
    const y = eToY(emf2At(t0 + (x / W) * WIN));
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = COL.faint; ctx.font = "10px ui-monospace, Menlo, monospace"; ctx.textAlign = "left";
  ctx.fillText(`I₁（满度 ${fmt(IinfV, 1)} A）`, 6, iTop - 12);
  ctx.fillText(`ε₂ 对数轴（±${fmtVolt(vMax)}）`, 6, eTop - 2);
  ctx.textAlign = "right";
  ctx.fillText(`窗口 ${Math.round(WIN * 1000)} ms`, W - 6, H - 6);
}

// ============================================================ 3 · kick tab
function kickScenario() {
  const tauV = tauNow(), ba = breakNow();
  const T = Math.max(0.04, 8 * tauV, 30 * Math.min(ba.tEff, 0.05), 3 * ba.tEff + 0.02);
  return { tauV, ba, T, tMake: 0.14 * T, tBreak: 0.58 * T };
}

function drawKick() {
  const W = 960, H = 430, ctx = kickCtx;
  ctx.clearRect(0, 0, W, H);
  const { tauV, ba, T, tMake, tBreak } = kickScenario();
  const Mv2 = Mv(), I0v = Iinf(), R2v = R2();

  // phase shading
  ctx.fillStyle = "rgba(212,164,55,.05)"; ctx.fillRect((tMake / T) * W, 16, W, H - 40);
  ctx.fillStyle = "rgba(217,106,90,.07)";
  ctx.fillRect((tBreak / T) * W, 16, Math.max(2, (Math.min(ba.tEff, T) / T) * W), H - 40);

  // --- strip 1: I₁
  const i1y0 = 148, i1y1 = 30;
  const i1ToY = (i) => i1y0 - Math.min(1.05, i / I0v) * (i1y0 - i1y1);
  ctx.strokeStyle = "#2c2417";
  ctx.beginPath(); ctx.moveTo(0, i1y0); ctx.lineTo(W, i1y0); ctx.stroke();
  ctx.strokeStyle = COL.gold2; ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let x = 0; x <= W; x++) {
    const t = (x / W) * T;
    const I = t < tMake ? 0 : t < tBreak ? P.rlGrowth(t - tMake, state.ring.V, state.ring.R1, L1()) : P.rlDecay(t - tBreak, I0v, ba.tEff);
    const y = i1ToY(I);
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  // τ annotation
  const tauX = ((tMake + tauV) / T) * W;
  ctx.strokeStyle = COL.dim; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(tauX, i1y0); ctx.lineTo(tauX, i1ToY(I0v * 0.632)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COL.dim; ctx.font = "11px ui-monospace, Menlo, monospace"; ctx.textAlign = "left";
  ctx.fillText(`I₁ · τ = L₁/R₁ = ${fmtSI(tauV, "s")}（63% 线）`, 10, i1y1 + 4);

  // --- strip 2: ε₂ on a symmetric-log axis
  const eMid = 268, eTop = 182, eBot = 354;
  const ePk = Math.max(ba.v2, (Mv2 * I0v) / tauV, 1);
  const v0 = 0.4;
  const eToY = (v) => {
    const s = Math.sign(v);
    const m = Math.log10(1 + Math.abs(v) / v0) / Math.log10(1 + ePk / v0);
    return eMid - s * m * (eBot - eMid) * 0.94;
  };
  ctx.strokeStyle = "#2c2417";
  ctx.beginPath(); ctx.moveTo(0, eMid); ctx.lineTo(W, eMid); ctx.stroke();
  ctx.strokeStyle = COL.blue; ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let x = 0; x <= W; x++) {
    const t = (x / W) * T;
    let e = 0;
    if (t >= tMake && t < tBreak) e = P.segmentEmf2({ t: tMake, kind: "make", I0: 0 }, t, { V: state.ring.V, R1: state.ring.R1, L1: L1(), M: Mv2, I0: 0 });
    else if (t >= tBreak) e = P.segmentEmf2({ t: tBreak, kind: "break", I0: I0v }, t, { L1: L1(), M: Mv2, tEffOf: () => ba.tEff, I0: I0v });
    const y = eToY(e);
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = COL.blue; ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.fillText(`ε₂（对称对数轴，满刻度 ±${fmtVolt(ePk)}）`, 10, eTop - 8);

  // --- strip 3: both kicks normalized to their own charge — equal areas
  const nBase = 404, nTop = 378;
  const q = (Mv2 * I0v) / R2v;
  const normMake = (s) => ((Mv2 * I0v) / tauV / q) * Math.exp(-s / tauV);
  const normBreak = (s) => ((Mv2 * I0v) / ba.tEff / q) * Math.exp(-s / ba.tEff);
  const peakN = Math.max(normMake(0), normBreak(0));
  const nToY = (v) => nBase - (v / (peakN * 1.06)) * (nBase - nTop);
  const strip = (color, tEv, fn) => {
    ctx.strokeStyle = color; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo((tEv / T) * W, nBase);
    for (let x = Math.floor((tEv / T) * W); x <= W; x++) {
      const s = (x / W) * T - tEv;
      ctx.lineTo(x, nToY(fn(s)));
    }
    ctx.lineTo(W, nBase);
    ctx.fillStyle = color; ctx.globalAlpha = 0.16; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath();
    for (let x = Math.floor((tEv / T) * W); x <= W; x++) {
      const s = (x / W) * T - tEv;
      const y = nToY(fn(s));
      x === Math.floor((tEv / T) * W) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  strip(COL.gold2, tMake, normMake);
  strip(COL.ember, tBreak, normBreak);
  ctx.fillStyle = COL.green; ctx.font = "11px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  ctx.fillText("两块阴影的面积都是 q = N₂ΔΦ/R₂ —— 高瘦矮胖，分毫不差", W / 2, nTop - 8);

  // phase labels
  ctx.fillStyle = COL.gold2; ctx.textAlign = "center";
  ctx.fillText("合闸", (tMake / T) * W, H - 10);
  ctx.fillStyle = COL.ember;
  ctx.fillText("断闸", (tBreak / T) * W, H - 10);
  ctx.fillStyle = COL.faint; ctx.textAlign = "left";
  ctx.fillText(`窗口 ${(T * 1000).toFixed(1)} ms · 电弧钳位后 t_eff = ${fmtSI(ba.tEff, "s")}`, 10, H - 10);
}

function drawKickPeak() {
  const W = 460, H = 230, ctx = kickPeakCtx;
  ctx.clearRect(0, 0, W, H);
  const x0 = 52, x1 = W - 16, y0 = H - 30, y1 = 20;
  const tbMin = 1e-6, tbMax = 1e-2;
  const logX = (tb) => x0 + (Math.log10(tb / tbMin) / Math.log10(tbMax / tbMin)) * (x1 - x0);
  const Mv2 = Mv(), I0v = Iinf();
  const eMin = (Mv2 * I0v) / tbMax, eMax = (Mv2 * I0v) / tbMin;
  const logY = (e) => y0 - (Math.log10(e / eMin) / Math.log10(eMax / eMin)) * (y0 - y1);

  // arc-clamp zone
  const vBd = state.ring.vBd;
  if (vBd > eMin && vBd < eMax) {
    const yBd = logY(vBd);
    ctx.fillStyle = "rgba(217,106,90,.12)";
    ctx.fillRect(x0, y1, x1 - x0, yBd - y1);
    ctx.strokeStyle = COL.red; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x0, yBd); ctx.lineTo(x1, yBd); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COL.red; ctx.font = "10.5px ui-monospace, Menlo, monospace"; ctx.textAlign = "left";
    ctx.fillText(`电弧钳位 ${fmtVolt(vBd)}——想再快也快不动`, x0 + 6, yBd - 6);
  }

  ctx.strokeStyle = "#2c2417";
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
  ctx.strokeStyle = COL.blue; ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 2) {
    const tb = tbMin * Math.pow(tbMax / tbMin, (x - x0) / (x1 - x0));
    const y = logY(Math.min((Mv2 * I0v) / tb, eMax));
    x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // current t_b marker (clamped height)
  const ba = breakNow();
  const tbNow = Math.min(tbMax, Math.max(tbMin, state.ring.tbUs * 1e-6));
  const xm = logX(tbNow), ym = logY(Math.min(ba.v1, eMax));
  ctx.strokeStyle = COL.gold; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(xm, y0); ctx.lineTo(xm, ym); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COL.gold2;
  ctx.beginPath(); ctx.arc(xm, ym, 4, 0, P.TAU); ctx.fill();

  ctx.fillStyle = COL.faint; ctx.font = "10px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  ctx.fillText("1 µs", x0, H - 12); ctx.fillText("10 ms", x1, H - 12);
  ctx.textAlign = "left";
  ctx.fillText("峰值 ε₂ vs 断开用时 t_b（对数-对数）", x0, y1 - 4);
}

function drawKickQ() {
  const W = 460, H = 230, ctx = kickQCtx;
  ctx.clearRect(0, 0, W, H);
  const x0 = 52, x1 = W - 16, y0 = H - 30, y1 = 30;
  const tbMin = 1e-6, tbMax = 1e-2;
  const logX = (tb) => x0 + (Math.log10(tb / tbMin) / Math.log10(tbMax / tbMin)) * (x1 - x0);
  const q = chargePerKick();
  const qTop = q * 1.35;
  const qToY = (v) => y0 - (v / qTop) * (y0 - y1);

  // equal-area shading under the flat line
  ctx.fillStyle = "rgba(143,181,115,.12)";
  ctx.fillRect(x0, qToY(q), x1 - x0, y0 - qToY(q));
  ctx.strokeStyle = COL.green; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(x0, qToY(q)); ctx.lineTo(x1, qToY(q)); ctx.stroke();
  ctx.fillStyle = COL.green; ctx.font = "12px ui-monospace, Menlo, monospace"; ctx.textAlign = "left";
  ctx.fillText(`q = N₂ΔΦ/R₂ = ${fmtSI(q, "C")}`, x0 + 8, qToY(q) - 8);

  const tbNow = Math.min(tbMax, Math.max(tbMin, state.ring.tbUs * 1e-6));
  const xm = logX(tbNow);
  ctx.strokeStyle = COL.gold; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(xm, y0); ctx.lineTo(xm, qToY(q)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COL.gold2;
  ctx.beginPath(); ctx.arc(xm, qToY(q), 4, 0, P.TAU); ctx.fill();

  ctx.strokeStyle = "#2c2417"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
  ctx.fillStyle = COL.faint; ctx.font = "10px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  ctx.fillText("1 µs", x0, H - 12); ctx.fillText("10 ms", x1, H - 12);
  ctx.textAlign = "left";
  ctx.fillText("电荷 q vs 断开用时 t_b —— 一条水平线", x0, y1 - 8);
  ctx.fillText("从 1 µs 到 10 ms：线的位置纹丝不动", x0, y1 + 8);
}

// ============================================================ 4 · core tab
function drawCore() {
  const W = 460, H = 340, ctx = coreCtx;
  ctx.clearRect(0, 0, W, H);
  const iron = state.ring.muR >= 50;

  // magnetic circuit: source (N₁I₀) at bottom, reluctance ℛ on the right
  const bx = 56, by = 56, bw = 300, bh = 210;
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);
  // flux arrow along the top
  ctx.strokeStyle = COL.gold; ctx.lineWidth = 2;
  const fx = bx + 30 + ((state.t * 40) % (bw - 130));
  ctx.beginPath(); ctx.moveTo(fx, by - 12); ctx.lineTo(fx + 26, by - 12); ctx.stroke();
  ctx.fillStyle = COL.gold2;
  ctx.beginPath();
  ctx.moveTo(fx + 34, by - 12);
  ctx.lineTo(fx + 24, by - 17); ctx.lineTo(fx + 24, by - 7);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = COL.gold2; ctx.font = "12px ui-monospace, Menlo, monospace"; ctx.textAlign = "left";
  ctx.fillText(`Φ = ${fmtSI(P.fluxOf(state.ring.N1, Iinf(), Rl()), "Wb", 2)}`, bx + bw - 110, by - 16);

  // source: coil bumps bottom
  ctx.strokeStyle = COL.gold; ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(bx + 70 + i * 22, by + bh, 11, 0, Math.PI);
    ctx.stroke();
  }
  ctx.fillStyle = COL.gold2; ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillText(`磁动势 N₁I₀ = ${fmt(state.ring.N1 * Iinf(), 0)} A`, bx + 20, by + bh + 26);
  ctx.fillStyle = COL.faint;
  ctx.fillText(`${state.ring.N1} 匝 × ${fmt(Iinf(), 2)} A`, bx + 20, by + bh + 44);

  // reluctance resistor right, labelled inside the loop
  ctx.strokeStyle = iron ? COL.gold : COL.blue; ctx.lineWidth = 2.4;
  const rz = by + 55, seg = 7.4;
  ctx.beginPath(); ctx.moveTo(bx + bw, rz);
  for (let i = 0; i < 6; i++) ctx.lineTo(bx + bw + seg * (i % 2 ? 1 : -1) * 1.7, rz + (seg * i) + seg / 2);
  ctx.lineTo(bx + bw, rz + seg * 6 + 6);
  ctx.stroke();
  ctx.fillStyle = iron ? COL.gold2 : COL.blue;
  ctx.textAlign = "right";
  ctx.fillText(`ℛ = ${fmtSI(Rl(), "A/Wb", 1)}`, bx + bw - 12, rz + 26);
  ctx.fillStyle = COL.faint;
  ctx.fillText(iron ? `µ_r = ${fmt(state.ring.muR, 0)}` : "空气芯 µ_r = 1", bx + bw - 12, rz + 44);
  ctx.textAlign = "left";

  // the law, centre stage
  ctx.fillStyle = COL.ink; ctx.font = "16px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
  ctx.fillText("Φ = N₁I₀ / ℛ", bx + bw / 2, by + bh / 2 - 12);
  ctx.fillStyle = COL.dim; ctx.font = "12.5px ui-monospace, Menlo, monospace";
  ctx.fillText("磁路的欧姆定律", bx + bw / 2, by + bh / 2 + 10);
  ctx.fillText("ℛ = l / (µ₀·µ_r·A)", bx + bw / 2, by + bh / 2 + 30);
}

function drawCoreM() {
  const W = 460, H = 160, ctx = coreMCtx;
  ctx.clearRect(0, 0, W, H);
  const x0 = 52, x1 = W - 16, y0 = H - 26, y1 = 16;
  const muMin = 1, muMax = 1e4;
  const logX = (mu) => x0 + (Math.log10(mu / muMin) / Math.log10(muMax / muMin)) * (x1 - x0);
  const Mmax = P.mutualInductance(state.ring.N1, state.ring.N2, P.reluctance(muMax));
  const Mmin = P.mutualInductance(state.ring.N1, state.ring.N2, P.reluctance(muMin));
  const logY = (m) => y0 - (Math.log10(m / Mmin) / Math.log10(Mmax / Mmin)) * (y0 - y1);

  ctx.strokeStyle = "#2c2417";
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
  ctx.strokeStyle = COL.gold2; ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 2) {
    const mu = muMin * Math.pow(muMax / muMin, (x - x0) / (x1 - x0));
    const y = logY(P.mutualInductance(state.ring.N1, state.ring.N2, P.reluctance(mu)));
    x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  // markers: air(1), soft iron(3000), current — stagger labels when they collide
  const mark = (mu, color, label, below) => {
    const xm = logX(mu), ym = logY(P.mutualInductance(state.ring.N1, state.ring.N2, P.reluctance(mu)));
    ctx.strokeStyle = color; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(xm, y0); ctx.lineTo(xm, ym); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(xm, ym, 4, 0, P.TAU); ctx.fill();
    ctx.font = "10px ui-monospace, Menlo, monospace"; ctx.textAlign = "center";
    ctx.fillText(label, xm, ym + (below ? 16 : -8));
  };
  const nearSoftIron = Math.abs(state.ring.muR - P.HIST.softIronMuR) < 900;
  mark(1, COL.blue, "空气");
  mark(P.HIST.softIronMuR, COL.dim, "软铁", nearSoftIron);
  mark(Math.max(1, state.ring.muR), COL.gold, "现在");
  ctx.fillStyle = COL.faint; ctx.textAlign = "left";
  ctx.fillText(`M ∝ µ_r（µ_r = ${fmt(Math.max(1, state.ring.muR), 0)} → M = ${fmtSI(Mv(), "H", 2)}）`, x0, H - 8);
}

function drawCoreB() {
  const W = 460, H = 160, ctx = coreBCtx;
  ctx.clearRect(0, 0, W, H);
  const x0 = 52, x1 = W - 16, y0 = H - 26, y1 = 16;
  const Imax = 5;
  const bOf = (I) => P.bField(P.fluxOf(state.ring.N1, I, Rl()));
  const bTop = 2.2;
  const iToX = (i) => x0 + (i / Imax) * (x1 - x0);
  const bToY = (b) => y0 - (b / bTop) * (y0 - y1);

  // beyond-knee zone
  ctx.fillStyle = "rgba(217,106,90,.10)";
  ctx.fillRect(x0, y1, x1 - x0, bToY(P.HIST.bSat) - y1);
  ctx.strokeStyle = COL.red; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(x0, bToY(P.HIST.bSat)); ctx.lineTo(x1, bToY(P.HIST.bSat)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COL.red; ctx.font = "10px ui-monospace, Menlo, monospace"; ctx.textAlign = "left";
  ctx.fillText("膝点 1.8 T：真铁会弯，公式先直着走", x0 + 6, bToY(P.HIST.bSat) - 5);

  ctx.strokeStyle = "#2c2417";
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
  ctx.strokeStyle = COL.gold2; ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 2) {
    const y = bToY(Math.min(bTop, bOf(((x - x0) / (x1 - x0)) * Imax)));
    x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  // current marker
  const xm = iToX(Math.min(Imax, Iinf()));
  const ym = bToY(Math.min(bTop, bOf(Iinf())));
  ctx.strokeStyle = COL.gold; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(xm, y0); ctx.lineTo(xm, ym); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COL.gold2;
  ctx.beginPath(); ctx.arc(xm, ym, 4, 0, P.TAU); ctx.fill();
  ctx.fillStyle = COL.faint; ctx.textAlign = "left";
  ctx.fillText(`B = ${fmt(bOf(Iinf()), 2)} T @ I₀ = ${fmt(Iinf(), 2)} A（裕度 ${fmt(P.saturationMargin(bOf(Iinf())), 2)} T）`, x0, H - 8);
}

// ============================================================ 5 · ac tab
function drawAC() {
  const W = 960, H = 300, ctx = acCtx;
  ctx.clearRect(0, 0, W, H);
  const { V1, f } = state.ring.ac;
  const { N1, N2 } = state.ring;
  const w = P.TAU * f;
  const phiHat = P.fluxAmpFromV(V1, f, N1);
  const v2 = V1 * (N2 / N1);
  const T = 2 / f;
  const stripY0 = 20, stripY1 = 190, mid = (stripY0 + stripY1) / 2;
  const scaleV = Math.max(V1, Math.min(v2, V1 * 5), 1) * Math.SQRT2 * 1.12;
  const vToY = (v) => mid - (v / scaleV) * (stripY1 - stripY0) / 2;

  ctx.strokeStyle = "#2c2417";
  ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();

  // Φ (dim, normalized to its own amp, drawn between)
  ctx.strokeStyle = COL.faint; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 2) {
    const t = (x / W) * T;
    const y = mid - (Math.sin(w * t) / 1.15) * (stripY1 - stripY0) / 2;
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke(); ctx.setLineDash([]);

  const trace = (amp, color, width, label, labelSide) => {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.shadowColor = color; ctx.shadowBlur = 5;
    ctx.beginPath();
    for (let x = 0; x <= W; x++) {
      const t = (x / W) * T;
      const y = vToY(amp * Math.SQRT2 * Math.sin(w * t));
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = color; ctx.font = "11.5px ui-monospace, Menlo, monospace";
    ctx.textAlign = labelSide;
    ctx.fillText(label, labelSide === "left" ? 10 : W - 10, vToY(amp * Math.SQRT2) - 8);
  };
  trace(V1, COL.gold2, 2.4, `V₁ = ${fmt(V1, 1)} V · N₁ = ${N1}`, "left");
  trace(Math.min(v2, V1 * 5), COL.blue, 2.2, v2 > V1 * 5 ? `V₂ = ${fmtVolt(v2)}（超出轴，画了 ${fmt(V1 * 5, 1)} V 帽）` : `V₂ = V₁·N₂/N₁ = ${fmt(v2, 2)} V`, "right");

  // ε peaks exactly at Φ zero crossings — mark one
  const zx = ((0.25 / f) / T) * W;
  ctx.strokeStyle = COL.ember; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(zx, stripY0); ctx.lineTo(zx, stripY1); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COL.ember; ctx.textAlign = "center"; ctx.font = "10.5px ui-monospace, Menlo, monospace";
  ctx.fillText("Φ 过零 → |ε| 最大", zx, stripY1 + 14);

  // B gauge
  const gy = 236, gx0 = 60, gx1 = W - 60;
  const bMax = P.bField(phiHat);
  const gToX = (b) => gx0 + (b / 2.2) * (gx1 - gx0);
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.fillRect(gx0, gy, gx1 - gx0, 26);
  ctx.fillStyle = "rgba(232,129,58,.18)";
  ctx.fillRect(gToX(P.HIST.bSat), gy, gToX(2.2) - gToX(P.HIST.bSat), 26);
  const bw2 = Math.max(0, gToX(Math.min(2.2, bMax)) - gx0);
  const bg = ctx.createLinearGradient(gx0, 0, gToX(Math.min(2.2, bMax)), 0);
  bg.addColorStop(0, COL.green); bg.addColorStop(0.75, COL.gold); bg.addColorStop(1, COL.red);
  ctx.fillStyle = bg;
  ctx.fillRect(gx0, gy, bw2, 26);
  ctx.strokeStyle = COL.line2; ctx.lineWidth = 1;
  ctx.strokeRect(gx0, gy, gx1 - gx0, 26);
  ctx.strokeStyle = COL.red;
  ctx.beginPath(); ctx.moveTo(gToX(P.HIST.bSat), gy - 6); ctx.lineTo(gToX(P.HIST.bSat), gy + 32); ctx.stroke();
  ctx.fillStyle = COL.faint; ctx.font = "10.5px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`B_max = Φ̂/A = ${fmt(bMax, 2)} T`, gx0, gy + 44);
  ctx.fillStyle = COL.red; ctx.textAlign = "center";
  ctx.fillText("膝点 1.8 T", gToX(P.HIST.bSat), gy - 10);
  ctx.fillStyle = COL.dim; ctx.textAlign = "right";
  ctx.fillText(bMax > P.HIST.bSat ? "✗ 越膝：真铁芯会饱和发热" : "✓ 铁芯吃得下", gx1, gy + 44);

  ctx.fillStyle = COL.faint; ctx.textAlign = "left"; ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.fillText(`Φ̂ = V₁/(π√2·f·N₁) = ${fmtSI(phiHat, "Wb", 2)} · 4.44 = π√2 · 两个周期`, 12, H - 8);
}

// ============================================================ readouts
function updateReadouts() {
  const ba = breakNow();
  const q = chargePerKick();
  $("ro-m").firstChild.nodeValue = fmtSI(Mv(), "H", 2);
  $("ro-m-note").textContent = state.ring.muR < 50 ? "空芯！" : "铁环在位";
  $("ro-tau").textContent = fmtSI(tauNow(), "s", 2);
  $("ro-spike").textContent = fmtVolt(ba.v2);
  $("ro-q").textContent = fmtSI(q, "C", 2);

  $("y-i0").textContent = `${fmt(Iinf(), 2)} A`;
  $("y-phi").textContent = fmtSI(P.fluxOf(state.ring.N1, Iinf(), Rl()), "Wb", 2);
  const B = P.bField(P.fluxOf(state.ring.N1, Iinf(), Rl()));
  $("y-b").textContent = `${fmt(B, 2)} T · 裕度 ${fmt(Math.max(0, P.saturationMargin(B)), 2)} T`;
  $("y-l1").textContent = `${fmtSI(L1(), "H", 2)} · ${fmtSI(P.fieldEnergy(L1(), Iinf()), "J", 2)}`;
  $("y-r2").textContent = `${fmt(R2(), 2)} Ω`;

  const slow = breakNow(Math.min(0.05, state.ring.tbUs * 1e-6 * 1000));
  $("k-fast").textContent = `${fmtVolt(ba.v2)}${ba.clamped ? "（已钳位）" : ""}`;
  $("k-slow").textContent = `${fmtVolt(slow.v2)}${slow.clamped ? "（已钳位）" : ""}`;
  $("k-charge").textContent = `${fmtSI(q, "C", 3)} —— 与快慢无关`;

  $("c-rl").textContent = fmtSI(Rl(), "A/Wb", 1);
  $("c-k").textContent = coupling().toFixed(6);
  $("c-l").textContent = `${fmtSI(L1(), "H", 2)} / ${fmtSI(L2(), "H", 2)}`;
  $("c-air").textContent = fmtSI(P.mutualInductance(state.ring.N1, state.ring.N2, P.reluctance(1)), "H", 2);
  $("c-factor").textContent = `×${fmt(Math.max(1, state.ring.muR), 0)}`;

  const phiHat = P.fluxAmpFromV(state.ring.ac.V1, state.ring.ac.f, state.ring.N1);
  const bAc = P.bField(phiHat);
  $("a-phi").textContent = fmtSI(phiHat, "Wb", 2);
  $("a-b").textContent = `${fmt(bAc, 2)} T ${bAc > P.HIST.bSat ? "✗ 越膝" : "✓"}`;
  $("a-v2").textContent = fmtVolt(state.ring.ac.V1 * (state.ring.N2 / state.ring.N1));

  $("h-ign").textContent = `${fmtVolt(P.ignitionSpike())}（断闸尖峰 × 匝比）`;
}
function coupling() {
  return P.coupling(Mv(), L1(), L2());
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

// log-mapped sliders
const mapN2 = (v) => Math.round(20 * Math.pow(1000, v / 100));
const invN2 = (n) => (Math.log(n / 20) / Math.log(1000)) * 100;
const mapMu = (v) => Math.max(1, Math.round(Math.pow(8000, v / 100)));
const invMu = (mu) => (Math.log(Math.max(1, mu)) / Math.log(8000)) * 100;
const mapTb = (v) => Math.pow(2e4, v / 100);           // µs: 1 → 20000
const invTb = (tbUs) => (Math.log(tbUs) / Math.log(2e4)) * 100;

bindSlider("v-range", "v-out", () => state.ring.V, (v) => { state.ring.V = v; }, (v) => `${v.toFixed(1)} V`);
bindSlider("n1-range", "n1-out", () => state.ring.N1, (v) => { state.ring.N1 = Math.round(v); }, (v) => `${Math.round(v)} 匝`);
bindSlider("r1-range", "r1-out", () => state.ring.R1, (v) => { state.ring.R1 = v; }, (v) => `${v.toFixed(1)} Ω`);
bindSlider("n2-range", "n2-out",
  () => invN2(state.ring.N2),
  (v) => { state.ring.N2 = mapN2(v); },
  () => `${fmt(state.ring.N2, 0)} 匝（${fmt(P.coilWireKm(state.ring.N2), 2)} km 线）`);
bindSlider("mur-range", "mur-out",
  () => invMu(state.ring.muR),
  (v) => { state.ring.muR = mapMu(v); },
  () => `µ_r = ${fmt(state.ring.muR, 0)}${state.ring.muR < 50 ? "（空芯）" : ""}`);
bindSlider("tb-range", "tb-out",
  () => invTb(state.ring.tbUs),
  (v) => { state.ring.tbUs = mapTb(v); },
  () => fmtSI(state.ring.tbUs * 1e-6, "s", 1));
bindSlider("acv-range", "acv-out", () => state.ring.ac.V1, (v) => { state.ring.ac.V1 = v; }, (v) => `${v.toFixed(1)} V`);
bindSlider("acf-range", "acf-out", () => state.ring.ac.f, (v) => { state.ring.ac.f = Math.round(v); }, (v) => `${Math.round(v)} Hz`);

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
  state.ring = { ...preset.ring, ac: { ...preset.ring.ac } };
  state.closed = false;
  state.events = [];
  state.kicks = [];
  presetBox.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.id === id));
  syncSwitchUI();
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
$("switch-btn").addEventListener("click", makeBreak);
$("ac-btn").addEventListener("click", () => {
  state.ring.drive = state.ring.drive === "ac" ? "manual" : "ac";
  $("ac-btn").classList.toggle("primary", state.ring.drive === "ac");
  syncSwitchUI();
});

// history timeline (static content)
$("timeline").innerHTML = [
  ["1830 · 奥尔巴尼", "约瑟夫·亨利的实验室里早已见过感应的踪迹，但论文压到了法拉第之后——<b>亨利先看见，法拉第先发表</b>，发现权与发表权从此分家。"],
  ["<b>1831-08-29</b>", "<b>皇家研究院地下室</b>——法拉第在软铁环上完成第一个感应实验：合闸一踢、稳恒归零、断闸反踢。记录本第一页写着那根 6 英寸的环。", "big"],
  ["1831-10-17", "线圈套上磁棒，抽插之间指针起舞——发电机的原理到手，从此不需要铁环。"],
  ["1831-11-24", "《电学实验研究》第一辑在皇家学会宣读：感应电流与电池电流「性质相同，只是转瞬」。"],
  ["1851", "卢姆科夫把副线圈绕到几千匝、几公里线，断闸尖峰抬到几万伏——火花机点亮半个世纪的实验室；1853 年斐索在断点并上电容，火花更干净。"],
  ["1886", "美国 Great Barrington，斯坦利与西屋把这只环接上交流电网——第一座商用变压器变电站；<b>V = 4.44·f·N·Φ̂</b> 从此管着整个电网。"],
  ["1887", "赫兹用感应线圈驱动的火花隙发出并收回了电磁波——无线电的第一次呼吸；1922 年，WEAF 用交流发电机播出了第一条广告。"],
  ["1910", "凯特林的点火线圈装上凯迪拉克：断闸尖峰 × 匝比 = 火花塞上的 <b>26 kV</b>——每台燃油车至今背着一只法拉第环。"],
  ["今天", "手机充电器、电磁炉、无线充电板、电网变压器、发电机组——全是 <b>ε = −N·dΦ/dt</b> 的直系后代。"],
].map(([when, what, cls]) => `<div class="tl-item ${cls || ""}"><span class="when">${when}</span><span class="what">${what}</span></div>`).join("");

// ============================================================ main loop
function drawAll() {
  drawBench();
  drawScope();
  if (state.tab === "kick") { drawKick(); drawKickPeak(); drawKickQ(); }
  if (state.tab === "core") { drawCore(); drawCoreM(); drawCoreB(); }
  if (state.tab === "ac") drawAC();
  updateReadouts();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  state.t += dt;
  // breathing demo: the bench throws its own switch until a human takes over
  if (autoDemo.on && !state.videoMode) {
    if (!autoDemo.made && state.t > 1.2) { autoDemo.made = true; fire("make"); }
    else if (!autoDemo.broke && state.t > 4.8) { autoDemo.broke = true; fire("break"); }
    else if (autoDemo.broke && state.t > 8.8) {
      state.t = 0.001;
      state.events = []; state.kicks = [];
      autoDemo.made = false; autoDemo.broke = false;
    }
  }
  drawAll();
  if (state.videoMode) return; // __demo.step drives everything
  requestAnimationFrame(loop);
}

applyPreset("ring1831");
setTab("kick");
requestAnimationFrame(loop);

// ============================================================ deterministic demo/video API
window.__demo = {
  loadPreset: (id) => applyPreset(id),
  setTab: (name) => setTab(name),
  setVideoMode: (on) => { state.videoMode = on; if (on) autoDemo.on = false; },
  setSwitch: (mode) => {
    if (state.ring.drive === "ac") return;
    if (mode === "closed" && !state.closed) makeBreak();
    if (mode === "open" && state.closed) makeBreak();
  },
  setRing: (k, v) => {
    if (k === "ac") { Object.assign(state.ring.ac, v); }
    else state.ring[k] = v;
    syncSwitchUI();
    refresh();
  },
  setDrive: (mode) => {
    state.ring.drive = mode;
    $("ac-btn").classList.toggle("primary", mode === "ac");
    syncSwitchUI();
    refresh();
  },
  scrollToBench: () => document.querySelector(".bench-card").scrollIntoView({ block: "center" }),
  scrollToTabs: () => document.querySelector(".tabs-card").scrollIntoView({ block: "start" }),
  step(dt) {
    state.videoMode = true;
    state.t += dt;
    drawAll();
  },
  state: () => ({
    tab: state.tab,
    closed: state.closed,
    drive: state.ring.drive,
    V: state.ring.V,
    N1: state.ring.N1,
    N2: state.ring.N2,
    muR: state.ring.muR,
    I0: Iinf(),
    M: Mv(),
    tau: tauNow(),
    q: chargePerKick(),
    v2: breakNow().v2,
    v2Clamped: breakNow().clamped,
    B: P.bField(P.fluxOf(state.ring.N1, Iinf(), Rl())),
  }),
};
