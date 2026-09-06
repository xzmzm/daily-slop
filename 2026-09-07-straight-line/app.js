// app.js — the Straight-Line studio. All numbers come from physics.js;
// this file only paints benches and runs the deterministic scan clock.

import * as P from "./physics.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// ── state ────────────────────────────────────────────────────────────────────
const LINES_STEPS = [30, 45, 60, 90, 120, 180, 240, 320, 405, 525, 700, 876, 1080];
const FPS_STEPS = [12.5, 15, 24, 25, 30, 50, 60];
const SLIDES = [
  { id: "line", name: "直线 · 1927.9.7" },
  { id: "dollar", name: "美元符号 · 1928" },
  { id: "card", name: "测试卡" },
  { id: "philo", name: "少年侧影" },
];

const state = {
  videoMode: false,
  clock: 0,
  tab: "scan",
  slide: 0,
  slideAngle: 0, slideTarget: 0,
  lines: 60,
  fps: 12.5,
  interlace: false,
  bandStd: 2,          // STANDARDS index (525)
  bandLines: 525,
  diskDia: 1.0,
  tint: 0,
  bw: false,
  dotCancel: false,
  event: -1,
};

// ── shared helpers ───────────────────────────────────────────────────────────
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const GREEN = "#7df0a8", AMBER = "#e9b64e", RED = "#e2604f", BLUE = "#74b9d8",
      DIM = "#8d97a4", INK = "#e9e4d2", PANEL = "#0d141d";

function fmtHz(hz) {
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(hz >= 1e7 ? 1 : 3)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(hz >= 1e5 ? 0 : 2)} kHz`;
  return `${hz.toFixed(1)} Hz`;
}
function fmtTime(s) {
  if (s >= 1e-3) return `${(s * 1e3).toFixed(2)} ms`;
  if (s >= 1e-6) return `${(s * 1e6).toFixed(s >= 1e-5 ? 1 : 3)} µs`;
  return `${(s * 1e9).toFixed(0)} ns`;
}
const css = (rgb) => `rgb(${rgb.map((v) => Math.round(P.clamp01(v) * 255)).join(",")})`;
const lumaOf = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// ── tabs ─────────────────────────────────────────────────────────────────────
const QUICK = [
  { label: "重演 1927.9.7", tab: "scan" },
  { label: "30 行到 1080 行", tab: "band" },
  { label: "兼容彩色", tab: "color" },
  { label: "时间线", tab: "ladder" },
];

function fillQuickLinks() {
  const host = $("#presets");
  host.innerHTML = "";
  for (const q of QUICK) {
    const b = document.createElement("button");
    b.textContent = q.label;
    b.addEventListener("click", () => setTab(q.tab));
    host.appendChild(b);
  }
}

function setTab(name) {
  state.tab = name;
  $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
  $$(".tab").forEach((t) => t.classList.toggle("on", t.id === `tab-${name}`));
  if (name === "ladder") buildLadder();
}

// ══════════════════════════════════════════════════════════════════════════
// BENCH 1 · the dissector: slide → composite signal → phosphor
// ══════════════════════════════════════════════════════════════════════════
const SRC_W = 432, SRC_H = 324;
const BLANK = 0.175;             // visual blanking fraction of a line
const srcCanvas = document.createElement("canvas");
srcCanvas.width = SRC_W; srcCanvas.height = SRC_H;
const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });

const crtBuffer = document.createElement("canvas");
crtBuffer.width = SRC_W; crtBuffer.height = SRC_H;
const crtCtx = crtBuffer.getContext("2d");
const crtImage = crtCtx.createImageData(SRC_W, SRC_H);
let crtPx = crtImage.data;
crtPx.fill(0);

let drawnKey = "";                // frame/field id of the last drawn line run
let drawnLine = -1;

function drawSlide() {
  const s = SLIDES[state.slide];
  srcCtx.save();
  srcCtx.fillStyle = "#020407";
  srcCtx.fillRect(0, 0, SRC_W, SRC_H);
  srcCtx.translate(SRC_W / 2, SRC_H / 2);
  srcCtx.rotate((state.slideAngle * Math.PI) / 180);
  srcCtx.translate(-SRC_W / 2, -SRC_H / 2);

  if (s.id === "line") {
    srcCtx.fillStyle = "#000";
    srcCtx.fillRect(-SRC_W, -SRC_H, SRC_W * 3, SRC_H * 3);
    srcCtx.save();
    srcCtx.shadowColor = "rgba(255,255,240,.9)"; srcCtx.shadowBlur = 22;
    srcCtx.fillStyle = "#fdf9e8";
    srcCtx.fillRect(SRC_W * 0.22, SRC_H / 2 - 15, SRC_W * 0.56, 30);
    srcCtx.restore();
  } else if (s.id === "dollar") {
    srcCtx.fillStyle = "#020407"; srcCtx.fillRect(-SRC_W, -SRC_H, SRC_W * 3, SRC_H * 3);
    srcCtx.fillStyle = "#fdf9e8";
    srcCtx.font = "700 300px Georgia, serif";
    srcCtx.textAlign = "center"; srcCtx.textBaseline = "middle";
    srcCtx.shadowColor = "rgba(255,255,240,.7)"; srcCtx.shadowBlur = 18;
    srcCtx.fillText("$", SRC_W / 2, SRC_H / 2 + 10);
    srcCtx.shadowBlur = 0;
  } else if (s.id === "card") {
    srcCtx.fillStyle = "#e8e4d4"; srcCtx.fillRect(-SRC_W, -SRC_H, SRC_W * 3, SRC_H * 3);
    srcCtx.strokeStyle = "#141a22"; srcCtx.fillStyle = "#141a22"; srcCtx.lineWidth = 4;
    for (const r of [40, 90, 140]) {
      srcCtx.beginPath(); srcCtx.arc(SRC_W / 2, SRC_H / 2 - 20, r, 0, 2 * Math.PI); srcCtx.stroke();
    }
    srcCtx.beginPath();
    srcCtx.moveTo(SRC_W / 2 - 170, SRC_H / 2 - 20); srcCtx.lineTo(SRC_W / 2 + 170, SRC_H / 2 - 20);
    srcCtx.moveTo(SRC_W / 2, SRC_H / 2 - 190); srcCtx.lineTo(SRC_W / 2, SRC_H / 2 + 150);
    srcCtx.stroke();
    for (let k = 0; k < 6; k++) {           // grayscale staircase
      srcCtx.fillStyle = `rgb(${40 * k},${40 * k},${40 * k})`;
      srcCtx.fillRect(24 + k * 36, SRC_H - 60, 36, 40);
    }
    for (let k = 0; k < 22; k++) {          // vertical resolution wedge
      const n = 4 + k;
      for (let j = 0; j < n; j++) {
        srcCtx.fillStyle = "#141a22";
        srcCtx.fillRect(300 + k * 6, 30 + (j * 60) / n, 3, 60 / n - 1);
      }
    }
    srcCtx.font = "700 44px Georgia"; srcCtx.textAlign = "left";
    srcCtx.fillText("1927", 26, 60);
  } else if (s.id === "philo") {
    srcCtx.fillStyle = "#e8e4d4"; srcCtx.fillRect(-SRC_W, -SRC_H, SRC_W * 3, SRC_H * 3);
    srcCtx.fillStyle = "#10161e";
    srcCtx.beginPath();
    srcCtx.moveTo(120, 40);
    srcCtx.bezierCurveTo(210, 18, 268, 60, 268, 118);   // crown → forehead
    srcCtx.bezierCurveTo(268, 158, 250, 168, 252, 186);  // brow
    srcCtx.bezierCurveTo(232, 196, 216, 204, 214, 224);  // nose
    srcCtx.bezierCurveTo(232, 230, 238, 238, 230, 246);  // upper lip
    srcCtx.bezierCurveTo(222, 252, 224, 258, 234, 262);  // lips
    srcCtx.bezierCurveTo(246, 270, 240, 284, 224, 290);  // chin front
    srcCtx.bezierCurveTo(200, 300, 170, 296, 158, 288);  // jaw
    srcCtx.bezierCurveTo(150, 320, 154, 324, 158, 324);  // neck
    srcCtx.lineTo(158, 324); srcCtx.lineTo(96, 324);     // neck base
    srcCtx.bezierCurveTo(104, 296, 112, 268, 118, 244);  // nape
    srcCtx.bezierCurveTo(104, 200, 92, 128, 120, 40);
    srcCtx.fill();
    // round glasses: rim + ear arm, scratched white out of the silhouette
    srcCtx.strokeStyle = "#e8e4d4"; srcCtx.lineWidth = 6;
    srcCtx.beginPath(); srcCtx.arc(232, 172, 26, 0, 2 * Math.PI); srcCtx.stroke();
    srcCtx.beginPath(); srcCtx.moveTo(258, 168); srcCtx.lineTo(282, 160); srcCtx.stroke();
  }
  srcCtx.restore();
}

function sourceRowLuma(rowNorm) {
  const y = Math.max(0, Math.min(SRC_H - 1, Math.floor(rowNorm * SRC_H)));
  return lumaGrid.subarray(y * SRC_W, (y + 1) * SRC_W);
}

// the source luma grid is recomputed only when the slide actually changes
let srcDirty = true;
let srcAngleSeen = -1;
let lumaGrid = new Float32Array(SRC_W * SRC_H);
function ensureSource() {
  if (!srcDirty && srcAngleSeen === state.slideAngle) return;
  srcAngleSeen = state.slideAngle;
  srcDirty = false;
  drawSlide();
  const data = srcCtx.getImageData(0, 0, SRC_W, SRC_H).data;
  for (let i = 0, j = 0; i < data.length; i += 4, j++)
    lumaGrid[j] = lumaOf(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
}

function writeCrtRow(rowNorm, luma) {
  const py = Math.max(0, Math.min(SRC_H - 1, Math.round(rowNorm * SRC_H)));
  const base = py * SRC_W * 4;
  for (let x = 0; x < SRC_W; x++) {
    const v = luma[x];
    const o = base + x * 4;
    crtPx[o] = Math.max(crtPx[o], v * 150);
    crtPx[o + 1] = Math.max(crtPx[o + 1], v * 255);
    crtPx[o + 2] = Math.max(crtPx[o + 2], v * 190);
    crtPx[o + 3] = 255;
  }
}

function decayCrt(dt) {
  // P1 phosphor: persist long enough that low frame rates still hold a picture
  const tau = Math.max(0.09, 2.2 / state.fps);
  const f = Math.exp(-dt / tau);
  for (let i = 0; i < crtPx.length; i += 4) {
    if (crtPx[i + 3] === 0) continue;
    crtPx[i] *= f; crtPx[i + 1] *= f; crtPx[i + 2] *= f;
  }
}

function scanPosition() {
  const N = state.lines;
  const frameDur = 1 / state.fps;
  const frameCount = Math.floor(state.clock / frameDur);
  const u = (state.clock / frameDur) % 1;
  const fields = state.interlace ? 2 : 1;
  const f = state.interlace ? Math.min(1, Math.floor(u * 2)) : 0;
  const uIn = state.interlace ? (u * 2) % 1 : u;
  const lineF = uIn * N;
  const lineIdx = Math.min(N - 1, Math.floor(lineF));
  const xFrac = lineF - Math.floor(lineF);
  const rowNorm = Math.min(1, (lineIdx + (state.interlace && f === 1 ? 0.5 : 0)) / N);
  return { N, frameCount, f, fields, lineIdx, xFrac, rowNorm };
}

function advanceCrt(pos) {
  const key = `${pos.frameCount}:${pos.f}`;
  if (key !== drawnKey) { drawnKey = key; drawnLine = -1; }
  // completed lines since the last paint
  const from = drawnLine < 0 ? pos.lineIdx : drawnLine + 1;
  for (let li = from; li < pos.lineIdx; li++) {
    const row = (li + (state.interlace && pos.f === 1 ? 0.5 : 0)) / pos.N;
    writeCrtRow(row, sourceRowLuma(row));
  }
  drawnLine = Math.max(drawnLine, pos.lineIdx - 1);
  // the live partial line
  const live = sourceRowLuma(pos.rowNorm);
  writeCrtRow(pos.rowNorm, live);
  return live;
}

function drawScanBench(currentLuma) {
  const cv = $("#scan-canvas"), ctx = cv.getContext("2d");
  const pos = scanPosition();
  ctx.fillStyle = "#050709"; ctx.fillRect(0, 0, cv.width, cv.height);

  const sx = 24, sy = 20, cx0 = 824, cy0 = 20;
  const midX = 470, midW = 330;

  // titles
  ctx.font = `13px ${MONO}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = DIM;
  ctx.fillText("玻璃底片 · 发送", sx, sy - 6);
  ctx.fillText("萤光屏 · 接收（余辉 τ≈90 ms）", cx0, cy0 - 6);
  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = `600 15px Georgia, serif`;
  ctx.fillText("解剖", 640, 130);
  ctx.fillText("拼回", 640, 260);
  ctx.fillStyle = DIM;
  ctx.font = `12px ${MONO}`;
  ctx.fillText("一行一行的电流", 640, 152);
  ctx.fillText("一点一点的萤光", 640, 282);
  ctx.font = `13px ${MONO}`;

  // source panel (glass slide, lamp behind)
  ctx.save();
  ctx.shadowColor = "rgba(125,240,168,.14)"; ctx.shadowBlur = 30;
  ctx.fillStyle = "#020407"; ctx.fillRect(sx, sy, SRC_W, SRC_H);
  ctx.restore();
  ctx.drawImage(srcCanvas, sx, sy);
  // scan row highlight + beam
  const beamY = sy + pos.rowNorm * SRC_H;
  ctx.fillStyle = "rgba(125,240,168,.10)";
  ctx.fillRect(sx, beamY - 1.5, SRC_W, 3);
  ctx.beginPath();
  ctx.arc(sx + pos.xFrac * SRC_W, beamY, 4.5, 0, 2 * Math.PI);
  ctx.fillStyle = "#fffbe8"; ctx.shadowColor = GREEN; ctx.shadowBlur = 14; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(125,240,168,.5)"; ctx.lineWidth = 1;
  ctx.strokeRect(sx + .5, sy + .5, SRC_W - 1, SRC_H - 1);

  // the beam-position track
  ctx.strokeStyle = "rgba(141,151,164,.3)";
  ctx.beginPath(); ctx.moveTo(700, sy + 4); ctx.lineTo(700, sy + SRC_H - 4); ctx.stroke();
  ctx.beginPath(); ctx.arc(700, beamY, 5, 0, 2 * Math.PI);
  ctx.fillStyle = GREEN; ctx.fill();
  ctx.font = `12px ${MONO}`; ctx.fillStyle = DIM; ctx.textAlign = "left";
  ctx.fillText(`行 ${pos.lineIdx + 1}/${pos.N}`, 716, beamY - 6);
  ctx.fillText(`场 ${pos.f + 1}/${pos.fields}`, 716, beamY + 14);

  // CRT (phosphor bloom drawn from the buffer's own glow)
  crtCtx.putImageData(crtImage, 0, 0);
  ctx.save();
  ctx.shadowColor = "rgba(125,240,168,.28)"; ctx.shadowBlur = 30;
  ctx.fillStyle = "#010302"; ctx.fillRect(cx0, cy0, SRC_W, SRC_H);
  ctx.restore();
  ctx.shadowColor = "rgba(125,240,168,.55)"; ctx.shadowBlur = 16;
  ctx.drawImage(crtBuffer, cx0, cy0);
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(cx0 + pos.xFrac * SRC_W, cy0 + pos.rowNorm * SRC_H, 3.4, 0, 2 * Math.PI);
  ctx.fillStyle = "#eafff2"; ctx.fill();
  ctx.strokeStyle = "rgba(125,240,168,.5)";
  ctx.strokeRect(cx0 + .5, cy0 + .5, SRC_W - 1, SRC_H - 1);

  // composite waveform of the current line
  const wy = 380, wh = 150, wx = sx, ww = 1232;
  ctx.fillStyle = "#070a0e"; ctx.fillRect(wx, wy, ww, wh);
  ctx.strokeStyle = "rgba(141,151,164,.25)";
  ctx.strokeRect(wx + .5, wy + .5, ww - 1, wh - 1);
  ctx.font = `12px ${MONO}`; ctx.fillStyle = DIM; ctx.textAlign = "left";
  ctx.fillText(`复合信号 · 第 ${pos.lineIdx + 1} 行 · 场 ${pos.f + 1}`, wx, wy - 6);

  const plot = (xNorm, ire) => [
    wx + 46 + xNorm * (ww - 66),
    wy + wh - 18 - ((ire + 40) / 140) * (wh - 34),
  ];
  // IRE grid
  for (const [ire, label] of [[100, "100"], [0, "0"], [-40, "−40"]]) {
    const [, gy] = plot(0, ire);
    ctx.strokeStyle = "rgba(141,151,164,.18)";
    ctx.beginPath(); ctx.moveTo(wx + 44, gy); ctx.lineTo(wx + ww - 16, gy); ctx.stroke();
    ctx.fillStyle = DIM; ctx.textAlign = "right";
    ctx.fillText(label, wx + 40, gy + 4);
  }
  // sync + blanking + video
  ctx.beginPath();
  ctx.moveTo(...plot(0, -40));
  ctx.lineTo(...plot(0.07, -40));
  ctx.lineTo(...plot(0.07, 0));
  ctx.lineTo(...plot(BLANK, 0));
  const luma = currentLuma ?? sourceRowLuma(pos.rowNorm);
  for (let k = 0; k <= 160; k++) {
    const xN = BLANK + (1 - BLANK) * k / 160;
    const v = luma[Math.min(SRC_W - 1, Math.floor(((k / 160) * SRC_W)))];
    ctx.lineTo(...plot(xN, v * 100));
  }
  ctx.lineTo(...plot(1, 0));
  ctx.lineTo(...plot(1, -40));
  ctx.strokeStyle = GREEN; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.lineWidth = 1;
  // labels
  ctx.fillStyle = DIM; ctx.textAlign = "center"; ctx.font = `11.5px ${MONO}`;
  const [sx1] = plot(0.035, -75); ctx.fillText("同步", sx1, wy + wh - 6);
  const [sx2] = plot(0.12, -75); ctx.fillText("消隐", sx2, wy + wh - 6);
  const [sx3] = plot(0.58, -75);
  ctx.fillText("图像 · 0–100 IRE（本行亮度）", sx3, wy + wh - 6);
}

function updateScanPanel() {
  const N = state.lines;
  const fLine = N * state.fps;
  const tLine = 1 / fLine;
  $("#scan-lines").textContent = N;
  $("#scan-kell").textContent = `眼睛只拿到 ${Math.round(P.kellLines(N))} 行（Kell 0.7）`;
  $("#fact-fline").textContent = fLine >= 1000 ? (fLine / 1000).toFixed(2) + "k" : Math.round(fLine);
  $("#fact-linems").textContent = (tLine * 1000).toFixed(tLine < 1e-3 ? 3 : 2);
  $("#fact-pxus").textContent = (tLine * 1e6 / 432).toFixed(1);
  $("#scan-formula").textContent =
`扫描节拍
行频 = N × f_v = ${N} × ${state.fps} = ${fLine.toFixed(1)} Hz
行周期 = ${fmtTime(tLine)}
消隐 ${Math.round(BLANK * 100)}% → 可见 ${fmtTime((1 - BLANK) * tLine)}
每行可见像素 ≈ (4/3)·N = ${Math.round((4 / 3) * N)}
像素时长 = ${fmtTime(tLine / 432)}
Kell：有效竖直分辨率 = 0.7 × ${N} = ${Math.round(0.7 * N)} 行`;
}

// ══════════════════════════════════════════════════════════════════════════
// BENCH 2 · the square law
// ══════════════════════════════════════════════════════════════════════════
const NTSC_BAL = P.bandwidthHz(P.STANDARDS[2]);   // the anchor of the law line
const lawB = (n) => NTSC_BAL * (n / 525) ** 2;

function drawBandChart() {
  const cv = $("#band-chart"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const L = 66, R = W - 18, T = 20, B = H - 46;
  const xMin = 30, xMax = 1300, yMin = 3e3, yMax = 3e8;
  const lx = (n) => Math.log10(n), ly = (h) => Math.log10(h);
  const px = (n) => L + ((lx(n) - lx(xMin)) / (lx(xMax) - lx(xMin))) * (R - L);
  const py = (h) => B - ((ly(h) - ly(yMin)) / (ly(yMax) - ly(yMin))) * (B - T);

  ctx.fillStyle = "#0d141d"; ctx.fillRect(0, 0, W, H);
  ctx.font = `11.5px ${MONO}`; ctx.fillStyle = DIM;

  for (const h of [1e4, 1e5, 1e6, 1e7, 1e8]) {
    ctx.strokeStyle = "rgba(141,151,164,.12)";
    ctx.beginPath(); ctx.moveTo(L, py(h)); ctx.lineTo(R, py(h)); ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(h >= 1e6 ? `${h / 1e6} M` : `${h / 1e3} k`, L - 8, py(h) + 4);
  }
  for (const n of [30, 60, 120, 240, 480, 960]) {
    ctx.strokeStyle = "rgba(141,151,164,.10)";
    ctx.beginPath(); ctx.moveTo(px(n), T); ctx.lineTo(px(n), B); ctx.stroke();
    ctx.textAlign = "center"; ctx.fillText(String(n), px(n), B + 16);
  }
  ctx.textAlign = "center"; ctx.fillStyle = DIM;
  ctx.fillText("总行数（对数）", (L + R) / 2, H - 8);
  ctx.save();
  ctx.translate(14, (T + B) / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText("视频带宽（对数）", 0, 0);
  ctx.restore();

  // the N² law line through the NTSC balanced point
  ctx.beginPath();
  for (let k = 0; k <= 120; k++) {
    const n = xMin * (xMax / xMin) ** (k / 120);
    const [x, y] = [px(n), py(lawB(n))];
    k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "rgba(125,240,168,.45)"; ctx.setLineDash([6, 6]); ctx.stroke();
  ctx.setLineDash([]);
  const lx525 = px(525);
  ctx.fillStyle = "rgba(125,240,168,.75)";
  ctx.fillText("斜率 2：行数×2 → 带宽×4", px(160), py(lawB(140)) - 12);

  // standards
  let above = true;
  for (const std of P.STANDARDS) {
    const x = px(std.lines), y = py(std.docHz);
    const sel = P.STANDARDS.indexOf(std) === state.bandStd;
    if (std.digital) {
      ctx.strokeStyle = BLUE; ctx.fillStyle = "rgba(116,185,216,.25)";
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.rect(x - 5, y - 5, 10, 10); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = sel ? GREEN : "rgba(233,182,78,.9)";
      ctx.strokeStyle = sel ? GREEN : AMBER; ctx.lineWidth = sel ? 2 : 1.2;
      ctx.beginPath(); ctx.arc(x, y, sel ? 6 : 4.6, 0, 2 * Math.PI);
      sel ? ctx.fill() : (ctx.fillStyle = "#0d141d", ctx.fill(), ctx.stroke());
    }
    // balanced point ×
    if (!std.digital) {
      const yb = py(P.bandwidthHz(std));
      ctx.strokeStyle = "rgba(125,240,168,.6)";
      ctx.beginPath();
      ctx.moveTo(x - 3.5, yb - 3.5); ctx.lineTo(x + 3.5, yb + 3.5);
      ctx.moveTo(x + 3.5, yb - 3.5); ctx.lineTo(x - 3.5, yb + 3.5);
      ctx.stroke();
    }
    ctx.fillStyle = sel ? INK : DIM;
    ctx.textAlign = "center"; ctx.font = `${sel ? "700 " : ""}12px ${MONO}`;
    ctx.fillText(`${std.name} · ${fmtHz(std.docHz)}${std.digital ? "（采样）" : ""}`,
      x + (std.id === "baird" ? 60 : 0), y + (above ? -12 : 20));
    above = !above;
    ctx.font = `11.5px ${MONO}`;
  }

  // live marker
  const x = px(state.bandLines), y = py(lawB(state.bandLines));
  ctx.strokeStyle = "rgba(125,240,168,.3)";
  ctx.beginPath(); ctx.moveTo(x, B); ctx.lineTo(x, y); ctx.moveTo(L, y); ctx.lineTo(x, y); ctx.stroke();
  ctx.save();
  ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#fffbe8"; ctx.fillRect(-4.5, -4.5, 9, 9);
  ctx.restore();
  ctx.fillStyle = GREEN; ctx.textAlign = "left";
  ctx.fillText(`${state.bandLines} 行 → ${fmtHz(lawB(state.bandLines))}`, x + 10, y - 10);
}

function updateBandPanel() {
  const std = P.STANDARDS[state.bandStd];
  const b = P.bandwidthHz(std);
  const st = P.bandwidthSteps(std);
  $("#o-bandlines").textContent = state.bandLines;
  $("#band-b").textContent = lawB(state.bandLines) >= 1e6
    ? (lawB(state.bandLines) / 1e6).toFixed(2) : (lawB(state.bandLines) / 1e3).toFixed(1);
  $("#band-doc").textContent = `${std.name} · 史载 ${fmtHz(std.docHz)} · 平衡 ${fmtHz(b)}`;
  $("#band-formula").textContent =
`B = AR·K·n_v / (2·T_active)
AR ${std.aspect.toFixed(2)} × K 0.7 × n_v ${std.activeLines}
T_active = (1−${(std.blankH * 100).toFixed(1)}%) × ${fmtTime(st.tLine)}
⇒ B = ${fmtHz(b)}${std.digital ? "（数字：史载为采样时钟）" : ""}`;
  const rel = Math.abs((st.hz - b) / b);
  $("#band-crosscheck").innerHTML =
`逐步链：f_line ${st.fLine.toFixed(2)} Hz → T_line ${fmtTime(st.tLine)}
→ T_active ${fmtTime(st.tActive)} → 每行水平线对 ${st.pairsAcrossWidth.toFixed(1)}
→ B = 对数/T_active = <b class="ok">${fmtHz(st.hz)}</b>（与闭式一致 ${rel.toExponential(1)}）`;
  updateNipkow();
}

function updateNipkow() {
  const std = P.STANDARDS[state.bandStd];
  const v = P.rimSpeed(state.diskDia, std.fps);
  const mach = v / 343;
  const px = P.pixelTime(std);
  const duty = P.dutyCycle(std);
  const verdict = px > 1e-4
    ? "—— 转得动"
    : px > 1e-5 ? "—— 极限边缘" : "—— 死路";
  $("#nipkow-read").innerHTML =
    `盘径 ${state.diskDia.toFixed(2)} m × ${std.fps} 帧：边缘 <b>${v.toFixed(0)} m/s</b>` +
    `（马赫 ${mach.toFixed(2)}），每像素 <b>${fmtTime(px)}</b>、每帧点亮占比 ` +
    `${(duty * 100).toPrecision(2)}%${verdict}。<br>硒光电池响应 ≈ 1 ms，` +
    `像素时长要 ${(1e-3 / px).toFixed(0)} 倍才够——机械扫描到几百行就到头了。`;
}

// ══════════════════════════════════════════════════════════════════════════
// BENCH 3 · compatible color
// ══════════════════════════════════════════════════════════════════════════
function drawColorBench() {
  const cv = $("#color-canvas"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.fillStyle = "#0d141d"; ctx.fillRect(0, 0, W, H);
  const chain = P.colorChain();

  // ── bars
  const bx = 20, by = 34, bw = 68, bh = 216;
  ctx.font = `12px ${MONO}`; ctx.fillStyle = DIM; ctx.textAlign = "left";
  ctx.fillText(state.bw ? "1950 年黑白机看到的：只有 Y（+ 副载波点阵）" : "彩条 · 100%",
    bx, by - 10);
  const frameParity = Math.floor(state.clock * 60) % 2;
  for (let k = 0; k < P.BARS.length; k++) {
    const bar = P.BARS[k];
    const v = P.yiq(bar.rgb);
    const x0 = bx + k * bw;
    for (let row = 0; row < bh; row += 2) {
      let fill;
      if (state.bw) {
        let y = v[0];
        if (k > 0) {  // chroma leaks through as dot crawl on a B&W set
          y += 0.05 * Math.sin(2 * Math.PI * P.dotCycles(row, frameParity));
        }
        const c = Math.round(P.clamp01(y) * 255);
        fill = `rgb(${c},${c},${c})`;
      } else {
        const rot = P.rotateIQ(v, state.tint);
        fill = css(P.rgbFromYiq(rot));
      }
      ctx.fillStyle = fill;
      ctx.fillRect(x0, by + row, bw, 2);
    }
    if (!state.bw || k === 0) {
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x0 + 4, by + 8, 20, 20);
      ctx.fillStyle = INK; ctx.textAlign = "center";
      ctx.fillText(bar.name, x0 + 14, by + 22);
    }
  }
  ctx.textAlign = "left";

  // ── vectorscope
  const vx = 660, vy = 148, vr = 104;
  ctx.fillStyle = DIM; ctx.fillText("矢量示波器（I/Q 平面）", vx - vr - 16, by - 10);
  ctx.strokeStyle = "rgba(141,151,164,.3)";
  ctx.beginPath(); ctx.arc(vx, vy, vr, 0, 2 * Math.PI); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(vx - vr - 8, vy); ctx.lineTo(vx + vr + 8, vy);
  ctx.moveTo(vx, vy - vr - 8); ctx.lineTo(vx, vy + vr + 8);
  ctx.stroke();
  ctx.fillStyle = DIM; ctx.textAlign = "left";
  ctx.fillText("I", vx + vr + 4, vy - 6); ctx.fillText("Q", vx + 6, vy - vr - 2);
  ctx.beginPath(); ctx.arc(vx, vy, 3, 0, 2 * Math.PI); ctx.fillStyle = INK; ctx.fill();
  ctx.fillText("白", vx + 8, vy + 14);
  for (const bar of P.BARS) {
    const v = P.yiq(bar.rgb);
    if (P.saturation(v) < 1e-6) continue;
    const rot = P.rotateIQ(v, state.tint);
    const s = P.saturation(v);
    const r = Math.min(1, s / 0.63) * vr;
    const a = Math.atan2(rot[2], rot[1]);
    const px2 = vx + Math.cos(a) * r, py2 = vy - Math.sin(a) * r;
    ctx.beginPath(); ctx.arc(px2, py2, 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = css(P.rgbFromYiq(rot)); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.stroke();
  }
  ctx.fillStyle = DIM;
  ctx.fillText(`色调 ${state.tint}°：整把扇子一起转，白点不动`, vx - vr - 16, vy + vr + 24);

  // ── luma staircase (what a B&W set receives — tint never moves it)
  const sy2 = 286, sh = 96;
  ctx.fillStyle = DIM; ctx.fillText("亮度阶梯 · 黑白机收到的全部（色调旋钮转断也不动）", bx, sy2 - 8);
  ctx.strokeStyle = "rgba(141,151,164,.2)";
  ctx.strokeRect(bx + .5, sy2 + .5, bw * 7, sh);
  for (let k = 0; k < P.BARS.length; k++) {
    const y = P.yiq(P.BARS[k].rgb)[0];
    const x0 = bx + k * bw;
    const gy = sy2 + sh - y * (sh - 10) - 5;
    ctx.strokeStyle = GREEN; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0 + 1, gy); ctx.lineTo(x0 + bw - 1, gy); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = DIM; ctx.textAlign = "center";
    ctx.fillText(y.toFixed(3), x0 + bw / 2, Math.max(sy2 + 12, gy - 7));
  }

  // ── frequency ladder
  const fy = H - 44;
  const fl = (hz) => {
    const lo = Math.log10(1e4), hi = Math.log10(1e7);
    return bx + 40 + ((Math.log10(hz) - lo) / (hi - lo)) * (W - bx * 2 - 90);
  };
  ctx.strokeStyle = "rgba(141,151,164,.35)";
  ctx.beginPath(); ctx.moveTo(bx + 30, fy); ctx.lineTo(W - bx + 30, fy); ctx.stroke();
  for (const h of [1e4, 1e5, 1e6, 1e7]) {
    ctx.strokeStyle = "rgba(141,151,164,.18)";
    ctx.beginPath(); ctx.moveTo(fl(h), fy - 4); ctx.lineTo(fl(h), fy + 4); ctx.stroke();
    ctx.fillStyle = DIM; ctx.textAlign = "center";
    ctx.fillText(h >= 1e6 ? `${h / 1e6}M` : `${h / 1e3}k`, fl(h), fy + 18);
  }
  const marks = [
    { hz: chain.fLine, label: `行频 ${(chain.fLine / 1e3).toFixed(2)} kHz`, color: GREEN },
    { hz: chain.fSc, label: `副载波 ${(chain.fSc / 1e6).toFixed(6)} MHz`, color: AMBER },
    { hz: P.NTSC.fAudio, label: `声音 ${(P.NTSC.fAudio / 1e6).toFixed(1)} MHz`, color: BLUE },
  ];
  for (const m of marks) {
    const x = fl(m.hz);
    ctx.strokeStyle = m.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, fy - 2); ctx.lineTo(x, fy - 26); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = m.color; ctx.textAlign = "center";
    ctx.fillText(m.label, x, fy - 32);
  }
  ctx.fillStyle = DIM; ctx.textAlign = "left";
  ctx.fillText("227.5 × 行频 = 315/88 MHz（精确）  ·  4.5 MHz = 286 × 行频（整数，安静）",
    bx + 40, fy - 52);
}

function drawDotZoom() {
  const cv = $("#dot-canvas"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.fillStyle = "#0d141d"; ctx.fillRect(0, 0, W, H);
  ctx.font = `12px ${MONO}`; ctx.fillStyle = DIM; ctx.textAlign = "left";
  ctx.fillText(`副载波点阵 · 黄条放大（${state.dotCancel ? "隔行平均后：点被抵消" : "逐行反转的亮暗点"}）`, 14, 20);
  const rows = 18, cols = 72, cell = 7, ox = 16, oy = 34;
  const cyc = 3.5;                                   // cycles across the zoom
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const frac = ((P.dotCycles(r, 0) % 1) + 1) % 1;
      const ph = 2 * Math.PI * (cyc * c / cols + frac);
      let m = 0.085 * Math.sin(ph);
      if (state.dotCancel) {
        const frac2 = ((P.dotCycles(r + 1, 0) % 1) + 1) % 1;
        const ph2 = 2 * Math.PI * (cyc * c / cols + frac2);
        m = 0.085 * (Math.sin(ph) + Math.sin(ph2)) / 2;
      }
      const y = P.clamp01(0.886 + m);                // yellow's luma ± dots
      const g = Math.round(y * 255);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(ox + c * cell, oy + r * cell, cell - 1, cell - 1);
    }
  }
  ctx.fillStyle = DIM;
  ctx.fillText("两行一平均（眼睛/隔行显像管做的事）→", ox + cols * cell + 18,
    oy + rows * cell / 2 - 8);
  ctx.fillText(state.dotCancel ? "上面已经是平均后的平场" : "右边开关试试", ox + cols * cell + 18,
    oy + rows * cell / 2 + 10);
}

function updateColorPanel() {
  $("#o-tint").textContent = state.tint;
  const c = P.colorChain();
  const df = P.dropFrame();
  $("#color-formula").textContent =
`行频 = 4.5 MHz ÷ 286 = ${c.fLine.toFixed(4)} Hz
帧率 = 行频 ÷ 525 = 30000/1001 = ${c.fFrame.toFixed(5)} 帧/s
副载波 = 227.5 × 行频 = 315/88 MHz = ${(c.fSc / 1e6).toFixed(6)} MHz
场频 = ${c.fField.toFixed(4)} Hz（60 场标称）
时码补偿：每小时丢 ${df.dropped} 帧 ≈ ${df.driftSec.toFixed(3)} s 漂移`;
}

// ══════════════════════════════════════════════════════════════════════════
// BENCH 4 · the timeline
// ══════════════════════════════════════════════════════════════════════════
function starPath(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return pts.join(" ");
}

function buildLadder() {
  const svg = $("#ladder-chart");
  const y0 = 1927.5;
  const yMin = 1880, yMax = 2013;
  const px = (yr) => 80 + ((yr - yMin) / (yMax - yMin)) * 1150;
  const baseY = 250;
  const NS = "http://www.w3.org/2000/svg";
  svg.innerHTML = "";

  const mk = (tag, attrs, text) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (text !== undefined) el.textContent = text;
    svg.appendChild(el);
    return el;
  };

  mk("line", { x1: 60, y1: baseY, x2: 1240, y2: baseY, stroke: "#223041", "stroke-width": 2 });
  for (const yr of [1884, 1900, 1925, 1950, 1975, 2000]) {
    mk("line", { x1: px(yr), y1: baseY - 5, x2: px(yr), y2: baseY + 5, stroke: "#8d97a4" });
    mk("text", { x: px(yr), y: baseY + 24, fill: "#8d97a4", "font-size": 12,
      "font-family": MONO, "text-anchor": "middle" }, String(yr));
  }

  const rowsUsed = [[], [], [], [], []];             // occupied boxes per row
  const rowsY = [186, 138, 90, 296, 344];
  const overlaps = (box, row) => row.some((b) =>
    !(box.x + box.w < b.x - 8 || box.x > b.x + b.w + 8));

  P.EVENTS.forEach((ev, i) => {
    const x = px(ev.year);
    const isStar = !!ev.star;
    const sel = i === state.event;
    const pin = mk(isStar ? "polygon" : "circle", isStar
      ? { points: starPath(x, baseY, 11), fill: "#e9b64e", stroke: "#7e5f1e", "stroke-width": 1.4, class: "pin", "data-i": i }
      : { cx: x, cy: baseY, r: 6.5, fill: sel ? "#7df0a8" : "#101924",
          stroke: "#7df0a8", "stroke-width": sel ? 2.6 : 1.6, class: "pin", "data-i": i });
    pin.style.cursor = "pointer";
    pin.addEventListener("click", () => selectEvent(i));

    const label = mk("text", { x: x, fill: isStar ? "#e9b64e" : "#e9e4d2",
      "font-size": isStar ? 15 : 13, "font-family": MONO, "text-anchor": "middle", class: "lbl" },
      `${ev.when} ${ev.title}`);
    // greedy row pick by measured width
    const bb = label.getBBox();
    const box = { x: bb.x, y: 0, w: bb.width };
    let row = 0;
    while (row < rowsUsed.length && overlaps(box, rowsUsed[row])) row++;
    if (row >= rowsUsed.length) row = rowsUsed.length - 1;
    rowsUsed[row].push({ ...box });
    const ly = rowsY[row];
    label.setAttribute("y", ly + (ly < baseY ? -8 : 14));
    mk("line", { x1: x, y1: baseY + (isStar ? -13 : -8), x2: x, y2: ly < baseY ? ly + 2 : ly - 8,
      stroke: ly < baseY ? "rgba(125,240,168,.35)" : "rgba(141,151,164,.35)", "stroke-width": 1 });
  });

  // collision fixpoint: push any overlapping pair up one row
  for (let iter = 0; iter < 6; iter++) {
    const labels = [...svg.querySelectorAll("text.lbl")];
    const boxes = labels.map((l) => l.getBBox());
    let moved = false;
    for (let a = 0; a < labels.length && !moved; a++) {
      for (let b = a + 1; b < labels.length; b++) {
        const B1 = boxes[a], B2 = boxes[b];
        if (!(B1.x + B1.width + 8 < B2.x || B2.x + B2.width + 8 < B1.x ||
              B1.y + B1.height < B2.y || B2.y + B2.height < B1.y)) {
          const victim = labels[b];
          const ny = Number(victim.getAttribute("y")) - 48;
          if (ny > 40) { victim.setAttribute("y", ny); moved = true; }
          break;
        }
      }
      if (moved) break;
    }
    if (!moved) break;
  }

  mk("text", { x: 80, y: 400, fill: "#8d97a4", "font-size": 13, "font-family": MONO },
    "★ 1927.9.7 · 绿街 202 号 · 那条会跟着玻璃片转动的直线");
}

function selectEvent(i) {
  state.event = i;
  const ev = P.EVENTS[i];
  $("#record-card").innerHTML = `<b>${ev.when}</b>　${ev.title}<br>${ev.text}`;
  buildLadder();
}

// ══════════════════════════════════════════════════════════════════════════
// wiring
// ══════════════════════════════════════════════════════════════════════════
function fillScanPresets() {
  const host = $("#scan-presets");
  host.innerHTML = "";
  SLIDES.forEach((s, i) => {
    const b = document.createElement("button");
    b.textContent = s.name;
    b.classList.toggle("on", i === state.slide);
    b.addEventListener("click", () => {
      state.slide = i; crtPx.fill(0); srcDirty = true; fillScanPresets();
    });
    host.appendChild(b);
  });
}

function fillBandPresets() {
  const host = $("#band-presets");
  host.innerHTML = "";
  P.STANDARDS.forEach((std, i) => {
    const b = document.createElement("button");
    b.textContent = std.name;
    b.classList.toggle("on", i === state.bandStd);
    b.addEventListener("click", () => {
      state.bandStd = i;
      state.bandLines = std.lines;
      $("#s-bandlines").value = std.lines;
      fillBandPresets(); updateBandPanel(); drawBandChart();
    });
    host.appendChild(b);
  });
}

function wireControls() {
  $$(".tabs button").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

  $("#s-lines").addEventListener("input", (e) => {
    state.lines = LINES_STEPS[+e.target.value];
    $("#o-lines").textContent = state.lines;
    drawnKey = ""; updateScanPanel();
  });
  $("#s-fps").addEventListener("input", (e) => {
    state.fps = FPS_STEPS[+e.target.value];
    $("#o-fps").textContent = state.fps;
    drawnKey = ""; updateScanPanel();
  });
  $("#c-interlace").addEventListener("change", (e) => {
    state.interlace = e.target.checked; drawnKey = "";
  });
  $("#btn-turn").addEventListener("click", () => { state.slideTarget += 90; });
  $("#btn-reset-scan").addEventListener("click", () => {
    state.slideTarget = 0; state.slideAngle = 0; state.lines = 60; state.fps = 12.5;
    state.interlace = false; state.clock = 0;
    $("#s-lines").value = 2; $("#o-lines").textContent = 60;
    $("#s-fps").value = 0; $("#o-fps").textContent = "12.5";
    $("#c-interlace").checked = false;
    crtPx.fill(0); drawnKey = ""; updateScanPanel();
  });

  $("#s-bandlines").addEventListener("input", (e) => {
    state.bandLines = +e.target.value;
    drawBandChart(); updateBandPanel();
  });
  $("#s-disk").addEventListener("input", (e) => {
    state.diskDia = +e.target.value; updateNipkow();
  });

  $("#s-tint").addEventListener("input", (e) => {
    state.tint = +e.target.value;
    $("#o-tint").textContent = state.tint;
    drawColorBench();
  });
  $("#btn-bw").addEventListener("click", (e) => {
    state.bw = !state.bw;
    e.target.classList.toggle("on", state.bw);
    e.target.textContent = state.bw ? "回到彩色机" : "用 1950 年黑白机看";
    drawColorBench();
  });
  $("#btn-dots").addEventListener("click", (e) => {
    state.dotCancel = !state.dotCancel;
    e.target.classList.toggle("on", state.dotCancel);
    e.target.textContent = state.dotCancel ? "隔行抵消（开）" : "隔行抵消（关）";
    drawDotZoom();
  });
}

// ── the clock ────────────────────────────────────────────────────────────────
let lastReal = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - lastReal) / 1000);
  lastReal = now;
  if (!state.videoMode) step(dt);
  requestAnimationFrame(loop);
}

function step(dt) {
  state.clock += dt;
  // glass-slide rotation eases toward its target (the 90° moment)
  const d = state.slideTarget - state.slideAngle;
  if (Math.abs(d) > 0.01)
    state.slideAngle += Math.sign(d) * Math.min(Math.abs(d), 110 * dt);
  else state.slideAngle = state.slideTarget;

  if (state.tab === "scan") {
    ensureSource();
    decayCrt(dt);
    const pos = scanPosition();
    const live = advanceCrt(pos);
    drawScanBench(live);
  } else if (state.tab === "color") {
    drawColorBench();
  }
}

// ── boot ─────────────────────────────────────────────────────────────────────
fillQuickLinks();
fillScanPresets();
fillBandPresets();
wireControls();
updateScanPanel();
updateBandPanel();
updateColorPanel();
drawDotZoom();
drawBandChart();
requestAnimationFrame(loop);

// ── the deterministic video hook ─────────────────────────────────────────────
window.__demo = {
  setVideoMode(v) { state.videoMode = v; },
  tick(dt) { step(dt); },
  setTab(name) { setTab(name); },
  scrollToTop() { window.scrollTo({ top: 0 }); },
  setSlide(i) { state.slide = i; crtPx.fill(0); srcDirty = true; fillScanPresets(); },
  setLines(n) {
    const idx = LINES_STEPS.indexOf(n);
    if (idx >= 0) { state.lines = n; $("#s-lines").value = idx; $("#o-lines").textContent = n; drawnKey = ""; updateScanPanel(); }
  },
  setFps(v) {
    const idx = FPS_STEPS.indexOf(v);
    if (idx >= 0) { state.fps = v; $("#s-fps").value = idx; $("#o-fps").textContent = v; drawnKey = ""; updateScanPanel(); }
  },
  setInterlace(v) { state.interlace = v; $("#c-interlace").checked = v; drawnKey = ""; },
  turnSlide() { state.slideTarget += 90; },
  resetScan() { $("#btn-reset-scan").click(); },
  setBandStd(i) { state.bandStd = i; state.bandLines = P.STANDARDS[i].lines;
    $("#s-bandlines").value = state.bandLines; fillBandPresets(); updateBandPanel(); drawBandChart(); },
  setBandLines(n) { state.bandLines = n; $("#s-bandlines").value = n; drawBandChart(); updateBandPanel(); },
  setDiskDia(m) { state.diskDia = m; $("#s-disk").value = m; updateNipkow(); },
  setTint(deg) { state.tint = deg; $("#s-tint").value = deg; $("#o-tint").textContent = deg; drawColorBench(); },
  setBW(v) { if (state.bw !== v) $("#btn-bw").click(); },
  setDots(v) { if (state.dotCancel !== v) $("#btn-dots").click(); },
  selectEvent(i) { selectEvent(i); },
};
