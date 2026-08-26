// app.js — Drake's Derrick: the 1859 cable-tool rig, driven by exact forms
// from physics.js. All motion is deterministic (seeded rng + fixed step
// logic), so window.__demo.step(dt) reproduces any frame for the video.

import * as P from "./physics.js";

// ---------- deterministic rng ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(18590827);

// ---------- state ----------
const state = {
  preset: "drake",
  phase: "idle", // idle → driving → drilling → crevice → struck/gusher
  engineOn: false,
  videoMode: false,
  simDays: 0,        // days since drilling started (post-casing)
  totalDays: 0,      // incl. pipe-driving days
  pipeFt: 0,
  depthFt: 0,
  strokesVisual: 0,
  strokePhase: 0,    // 0..1 visual cycle
  shake: 0,
  oilAnim: 0,
  oilLevelFt: null,  // set at strike
  creviceTimer: 0,
  bannerTimer: 0,
  bannerShown: false,
  pipeLogged: false,
  monthsSinceStrike: 0,
  rig: { ...P.DRAKE_RIG },
  surplusKPa: P.DRAKE_SURPLUS_KPA,
  sg: P.DRAKE_SG,
  darcy: { ...P.DRAKE_DARCY },
  prod: { ...P.PRESETS.drake.prod },
  crudeId: "pa",
  speed: 1,
  particles: [],
  smoke: [],
  spray: [],
  logs: [],
};

// ---------- canvas plumbing ----------
const dpr = Math.min(window.devicePixelRatio || 1, 2);
function setup(canvas, w, h) {
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
const rigC = document.getElementById("rig");
const rigCtx = setup(rigC, 960, 560);
const chartCtx = setup(document.getElementById("chart"), 960, 400);
const darcyCtx = setup(document.getElementById("darcy"), 960, 360);
const apiCtx = setup(document.getElementById("api"), 960, 380);

const RIG = { W: 960, H: 560, ground: 210, bottom: 545, maxFt: 84, holeX: 300 };
RIG.pxPerFt = (RIG.bottom - RIG.ground) / RIG.maxFt;
const ftY = (ft) => RIG.ground + ft * RIG.pxPerFt;

const fmt = (n, d = 1) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// ---------- sim ----------
function currentRop() {
  if (state.phase === "driving") return 8.0; // pipe-driving, ft/day (time-lapse)
  if (state.phase !== "drilling") return 0;
  return P.ropAtFt(state.depthFt, state.rig);
}

function addLog(when, what, event = false) {
  state.logs.unshift({ when, what, event });
  renderLog();
}

function spawnCuttings(n) {
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x: RIG.holeX + (rng() - 0.5) * 10,
      y: ftY(state.depthFt),
      vx: (rng() - 0.5) * 26,
      vy: -20 - rng() * 40,
      life: 0.7 + rng() * 0.6,
      r: 1 + rng() * 2.2,
    });
  }
}

function targetOilLevel() {
  const rise = P.oilRiseFt(state.surplusKPa, state.sg);
  return Math.min(rise, 96); // 96 ft ≈ above the derrick floor → gusher
}

function tick(dt) {
  // visual stroke cycle (time-lapse: a steady 0.55 Hz stands for n per minute)
  if (state.engineOn) {
    state.strokePhase += dt * 0.55;
    if (state.strokePhase >= 1) {
      state.strokePhase %= 1;
      state.strokesVisual++;
      state.shake = 1;
      if (state.phase === "drilling") spawnCuttings(3 + Math.floor(rng() * 4));
    }
  }
  state.shake = Math.max(0, state.shake - dt * 4);

  const dtDays = dt * state.speed;
  if (state.phase === "driving" && state.engineOn) {
    state.totalDays += dtDays;
    state.pipeFt = Math.min(P.BEDROCK_FT, state.pipeFt + 8 * dtDays);
    if (state.pipeFt >= 6 && !state.pipeLogged) {
      state.pipeLogged = true;
      addLog("第 1 天", "套管穿过含水砾石层——白橡木夯锤一寸寸往下砸");
    }
    if (state.pipeFt >= P.BEDROCK_FT) {
      state.depthFt = P.BEDROCK_FT;
      state.phase = "drilling";
      state.simDays = 0;
      addLog(`第 ${fmt(state.totalDays, 0)} 天`, `套管坐上基岩 ${P.BEDROCK_FT} ft——从管心里往下钻`, true);
    }
  } else if (state.phase === "drilling" && state.engineOn) {
    state.totalDays += dtDays;
    state.simDays += dtDays;
    const before = state.depthFt;
    state.depthFt = Math.min(P.STRIKE_FT, state.depthFt + currentRop() * dtDays);
    if (before < P.OIL_SAND_FT && state.depthFt >= P.OIL_SAND_FT) {
      addLog(`第 ${fmt(state.totalDays, 0)} 天`, `进尺突然变快——${P.OIL_SAND_FT} ft，钻进第一油砂层`, true);
    }
    if (state.depthFt >= P.STRIKE_FT) {
      state.phase = "crevice";
      state.engineOn = false;
      state.creviceTimer = 0;
      addLog(`第 ${fmt(state.totalDays, 0)} 天 · 1859-08-26 傍晚`, `井深 ${P.STRIKE_FT} ft，钻头掉进裂缝 6 英寸——收工，过安息日`, true);
    }
  } else if (state.phase === "crevice") {
    state.creviceTimer += dt;
    if (state.creviceTimer >= 1.0) {
      const rise = P.oilRiseFt(state.surplusKPa, state.sg);
      state.phase = rise >= P.STRIKE_FT + 6 ? "gusher" : "struck";
      state.oilAnim = 0;
      state.bannerTimer = 0;
      state.bannerShown = true;
      document.getElementById("strike-banner").classList.add("show");
      addLog("1859-08-27 · 星期日下午", state.phase === "gusher"
        ? "油冲出井口——自喷井！油溪两岸很快会插满井架"
        : "井筒里升起了油面，离地面只剩几英尺——德雷克用泵一天抽上约 20 桶", true);
    }
  } else if (state.phase === "struck" || state.phase === "gusher") {
    state.oilAnim = Math.min(1, state.oilAnim + dt / 2.2);
    state.monthsSinceStrike += dtDays / 30.44;
    const tgt = targetOilLevel();
    const ease = 1 - Math.pow(1 - state.oilAnim, 3);
    state.oilLevelFt = P.STRIKE_FT + (tgt - P.STRIKE_FT) * ease;
    if (state.phase === "gusher" && rng() < dt * 22) {
      state.spray.push({
        x: RIG.holeX, y: RIG.ground - 2,
        vx: (rng() - 0.5) * 120, vy: -150 - rng() * 130,
        life: 1.1 + rng() * 0.7, r: 1.5 + rng() * 2.4,
      });
    }
    if (state.bannerShown) {
      state.bannerTimer += dt;
      if (state.bannerTimer > 4.2) {
        state.bannerShown = false;
        document.getElementById("strike-banner").classList.remove("show");
      }
    }
  }

  // particles / smoke
  for (const p of state.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const s of state.spray) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 300 * dt; s.life -= dt;
  }
  state.spray = state.spray.filter((s) => s.life > 0);
  if (state.engineOn && rng() < dt * 2.4) {
    state.smoke.push({ x: 618, y: 118, vx: 14 + rng() * 12, vy: -18 - rng() * 10, r: 4 + rng() * 3, life: 2.4 + rng() });
  }
  for (const s of state.smoke) { s.x += s.vx * dt; s.y += s.vy * dt; s.r += 7 * dt; s.life -= dt; }
  state.smoke = state.smoke.filter((s) => s.life > 0);

  updateReadouts();
}

// ---------- rig drawing ----------
function drawRig() {
  const c = rigCtx, W = RIG.W, H = RIG.H;
  const shakeX = state.shake > 0 ? (rng() - 0.5) * state.shake * 3 : 0;
  c.save();
  c.clearRect(0, 0, W, H);

  // dusk sky
  const sky = c.createLinearGradient(0, 0, 0, RIG.ground);
  sky.addColorStop(0, "#1b2233"); sky.addColorStop(0.55, "#3a3040"); sky.addColorStop(1, "#6d5136");
  c.fillStyle = sky; c.fillRect(0, 0, W, RIG.ground);
  // low sun
  c.fillStyle = "rgba(240,199,94,.85)";
  c.beginPath(); c.arc(790, 132, 26, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(240,199,94,.12)";
  c.beginPath(); c.arc(790, 132, 60, 0, Math.PI * 2); c.fill();
  // hills
  c.fillStyle = "#241d20";
  c.beginPath(); c.moveTo(0, RIG.ground);
  c.quadraticCurveTo(160, RIG.ground - 66, 340, RIG.ground - 18);
  c.quadraticCurveTo(560, RIG.ground - 60, 720, RIG.ground - 10);
  c.quadraticCurveTo(860, RIG.ground - 44, 960, RIG.ground - 22);
  c.lineTo(960, RIG.ground); c.closePath(); c.fill();
  // distant derricks after strike (the boom)
  if (state.monthsSinceStrike > 6) {
    c.strokeStyle = "rgba(20,16,10,.8)"; c.lineWidth = 2;
    for (const [bx, bh] of [[80, 30], [128, 22], [700, 26], [745, 32]]) {
      c.beginPath(); c.moveTo(bx - 10, RIG.ground); c.lineTo(bx, RIG.ground - bh);
      c.lineTo(bx + 10, RIG.ground); c.stroke();
    }
  }

  // ground
  c.fillStyle = "#20180f"; c.fillRect(0, RIG.ground, W, H - RIG.ground);
  c.strokeStyle = "#3d3220"; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, RIG.ground); c.lineTo(W, RIG.ground); c.stroke();

  // geology strata
  for (const l of P.LAYERS) {
    c.fillStyle = l.color;
    c.globalAlpha = l.id === "oilsand" ? 1 : 0.92;
    c.fillRect(34, ftY(l.from), W - 34, (l.to - l.from) * RIG.pxPerFt);
    c.globalAlpha = 1;
  }
  // oil-sand glow
  const glow = c.createLinearGradient(0, ftY(59), 0, ftY(69.5));
  glow.addColorStop(0, "rgba(212,164,55,0)");
  glow.addColorStop(0.5, "rgba(212,164,55,.16)");
  glow.addColorStop(1, "rgba(212,164,55,0)");
  c.fillStyle = glow; c.fillRect(34, ftY(59), W - 34, ftY(69.5) - ftY(59));
  // strata labels (left)
  c.font = "11px ui-monospace, Menlo, monospace"; c.textBaseline = "middle";
  for (const l of P.LAYERS) {
    c.fillStyle = "rgba(242,232,213,.72)";
    c.fillText(l.label, 40, (ftY(l.from) + ftY(l.to)) / 2 - 6);
  }

  // the hole (dark) below casing shoe
  if (state.depthFt > 0) {
    c.fillStyle = "#080604";
    c.fillRect(RIG.holeX - 6, ftY(0), 12, ftY(state.depthFt) - ftY(0));
  }
  // casing pipe (double line + joints)
  if (state.pipeFt > 0) {
    c.strokeStyle = "#8a6d3a"; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(RIG.holeX - 8, ftY(0)); c.lineTo(RIG.holeX - 8, ftY(state.pipeFt));
    c.moveTo(RIG.holeX + 8, ftY(0)); c.lineTo(RIG.holeX + 8, ftY(state.pipeFt)); c.stroke();
    c.strokeStyle = "rgba(138,109,58,.7)"; c.lineWidth = 1.5;
    for (let ft = 10; ft < state.pipeFt; ft += 10) {
      c.beginPath(); c.moveTo(RIG.holeX - 8, ftY(ft)); c.lineTo(RIG.holeX + 8, ftY(ft)); c.stroke();
    }
  }
  // oil column
  if ((state.phase === "struck" || state.phase === "gusher") && state.oilLevelFt != null) {
    const top = Math.max(state.oilLevelFt, 0);
    c.fillStyle = "#0b0805";
    c.fillRect(RIG.holeX - 6, ftY(top), 12, ftY(P.STRIKE_FT) - ftY(top));
    c.fillStyle = "rgba(212,164,55,.28)";
    c.fillRect(RIG.holeX - 6, ftY(top), 12, 3);
  }

  // depth ruler (right)
  c.font = "10.5px ui-monospace, Menlo, monospace";
  c.strokeStyle = "rgba(212,164,55,.5)"; c.fillStyle = "rgba(212,164,55,.85)"; c.lineWidth = 1;
  for (let ft = 0; ft <= 80; ft += 5) {
    const y = ftY(ft), long = ft % 10 === 0;
    c.beginPath(); c.moveTo(918, y); c.lineTo(918 + (long ? 10 : 5), y); c.stroke();
    if (long) c.fillText(String(ft), 932, y);
  }
  // strike line
  c.strokeStyle = "rgba(232,129,58,.9)"; c.setLineDash([5, 4]);
  c.beginPath(); c.moveTo(34, ftY(69.5)); c.lineTo(912, ftY(69.5)); c.stroke();
  c.setLineDash([]);
  c.fillStyle = "rgba(232,129,58,.95)";
  c.fillText("69.5 ft — 出油点", 806, ftY(69.5) - 7);

  // ---- derrick & machinery (shakes on impact) ----
  c.translate(shakeX, 0);

  // derrick legs
  c.strokeStyle = "#5d4a2c"; c.lineWidth = 5;
  c.beginPath();
  c.moveTo(RIG.holeX - 78, RIG.ground); c.lineTo(RIG.holeX - 8, 36);
  c.moveTo(RIG.holeX + 78, RIG.ground); c.lineTo(RIG.holeX + 8, 36);
  c.stroke();
  c.lineWidth = 2.5; c.strokeStyle = "#4a3a22";
  for (let i = 1; i <= 5; i++) {
    const t = i / 6, yTop = 36 + (RIG.ground - 36) * (t * t) * 0.9, yBot = 36 + (RIG.ground - 36) * ((t + 0.14) * (t + 0.14)) * 0.92;
    const spreadTop = 8 + 70 * t, spreadBot = 8 + 70 * (t + 0.13);
    c.beginPath();
    c.moveTo(RIG.holeX - spreadTop, yTop); c.lineTo(RIG.holeX + spreadBot, yBot);
    c.moveTo(RIG.holeX + spreadTop, yTop); c.lineTo(RIG.holeX - spreadBot, yBot);
    c.stroke();
  }
  // crown pulley
  c.fillStyle = "#2c2318";
  c.beginPath(); c.arc(RIG.holeX, 34, 8, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#d4a437"; c.lineWidth = 2;
  c.beginPath(); c.arc(RIG.holeX, 34, 8, 0, Math.PI * 2); c.stroke();

  // samson post + walking beam (pivots with the stroke)
  const ang = state.engineOn
    ? Math.sin(state.strokePhase * Math.PI * 2) * 0.10
    : 0;
  const beamLen = 150;
  c.save();
  c.translate(RIG.holeX, 74); c.rotate(ang);
  c.strokeStyle = "#7c6238"; c.lineWidth = 7; c.lineCap = "round";
  c.beginPath(); c.moveTo(-beamLen, 0); c.lineTo(beamLen, 0); c.stroke();
  // polish rod end (left) / crank end (right)
  c.fillStyle = "#d4a437";
  c.beginPath(); c.arc(-beamLen, 0, 4, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(beamLen, 0, 4, 0, Math.PI * 2); c.fill();
  c.restore();
  c.fillStyle = "#3a2e1c";
  c.fillRect(RIG.holeX - 5, 74, 10, RIG.ground - 74);

  // cable: bit side — from beam end over crown pulley down the hole
  // (pulled out of the hole after the strike, when the pump goes in)
  const bitGone = state.phase === "struck" || state.phase === "gusher";
  const beamEndY = 74 - Math.sin(ang) * beamLen;
  const beamEndX = RIG.holeX - Math.cos(ang) * beamLen;
  // bit vertical offset follows stroke: lift then release
  const lift = state.engineOn ? bitLiftPx() : 0;
  if (!bitGone) {
    c.strokeStyle = "#c9b06a"; c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(beamEndX, beamEndY);
    c.lineTo(RIG.holeX, 34);
    c.lineTo(RIG.holeX, ftY(Math.max(state.depthFt, 0.5)) - lift);
    c.stroke();
  }

  // the bit
  if (!bitGone) {
    const by = ftY(Math.max(state.depthFt, 0.5)) - lift;
    c.fillStyle = "#1c1a17";
    c.beginPath();
    c.moveTo(RIG.holeX - 9, by - 16); c.lineTo(RIG.holeX + 9, by - 16);
    c.lineTo(RIG.holeX + 6, by); c.lineTo(RIG.holeX - 6, by);
    c.closePath(); c.fill();
    c.strokeStyle = "#8c8878"; c.lineWidth = 1; c.stroke();
  }

  // steam engine: bandwheel + crank + pitman
  const cx = RIG.holeX + 232, cy = 176;
  c.fillStyle = "#241d12"; c.strokeStyle = "#6b5636"; c.lineWidth = 3;
  c.beginPath(); c.arc(cx, cy, 26, 0, Math.PI * 2); c.fill(); c.stroke();
  c.lineWidth = 6; c.strokeStyle = "#3a2f1d";
  c.beginPath(); c.arc(cx, cy, 26, 0, Math.PI * 2); c.stroke();
  const crankA = state.engineOn ? state.strokePhase * Math.PI * 2 : 0;
  const px = cx + Math.cos(crankA) * 22, py = cy + Math.sin(crankA) * 22;
  const bex = RIG.holeX + Math.cos(ang) * beamLen, bey = 74 + Math.sin(ang) * beamLen;
  c.strokeStyle = "#a08350"; c.lineWidth = 3;
  c.beginPath(); c.moveTo(px, py); c.lineTo(bex, bey); c.stroke();
  c.fillStyle = "#d4a437";
  c.beginPath(); c.arc(px, py, 3.5, 0, Math.PI * 2); c.fill();

  // boiler + stack
  c.fillStyle = "#2c2318";
  c.fillRect(560, 176, 84, 30);
  c.beginPath(); c.arc(602, 176, 42, Math.PI, 0); c.fill();
  c.fillStyle = "#241d12"; c.fillRect(612, 116, 12, 62);
  c.strokeStyle = "#6b5636"; c.lineWidth = 2; c.strokeRect(560, 176, 84, 30);
  if (state.engineOn) {
    // firebox glow
    c.fillStyle = "rgba(232,129,58,.8)";
    c.beginPath(); c.arc(586, 198, 6 + Math.sin(state.strokePhase * 6.28 * 2) * 1.6, 0, Math.PI * 2); c.fill();
  }
  // smoke
  for (const s of state.smoke) {
    c.fillStyle = `rgba(200,200,205,${0.16 * Math.min(1, s.life)})`;
    c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); c.fill();
  }
  // cuttings
  for (const p of state.particles) {
    c.fillStyle = `rgba(120,100,70,${Math.min(1, p.life)})`;
    c.fillRect(p.x, p.y, p.r, p.r);
  }
  // gusher spray
  for (const s of state.spray) {
    c.fillStyle = `rgba(10,8,5,${Math.min(1, s.life)})`;
    c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); c.fill();
  }
  // oil pool at surface for gusher
  if (state.phase === "gusher") {
    c.fillStyle = "rgba(8,6,4,.8)";
    c.beginPath(); c.ellipse(RIG.holeX, RIG.ground + 3, 90, 5, 0, 0, Math.PI * 2); c.fill();
  }

  // HUD: depth line + label
  if (state.depthFt > 0) {
    const y = ftY(state.depthFt);
    c.strokeStyle = "rgba(240,199,94,.9)"; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(RIG.holeX - 26, y); c.lineTo(RIG.holeX + 26, y); c.stroke();
    c.fillStyle = "#f0c75e"; c.font = "12px ui-monospace, Menlo, monospace";
    c.fillText(`${fmt(state.depthFt, 1)} ft`, RIG.holeX + 32, y);
  }
  c.restore();
}

function bitLiftPx() {
  // lift (first 55% of cycle, eased), then free-fall snap (rest of cycle)
  const p = state.strokePhase;
  if (p < 0.55) {
    const t = p / 0.55;
    return 30 * Math.sin(t * Math.PI / 2);
  }
  const t = (p - 0.55) / 0.45;
  return 30 * (1 - t * t);
}

// ---------- readouts ----------
function updateReadouts() {
  document.getElementById("ro-depth").innerHTML = `${fmt(state.depthFt, 1)}<small>ft</small>`;
  const rop = currentRop();
  document.getElementById("ro-rop").innerHTML = state.phase === "driving"
    ? `8.0<small>ft/天 · 打套管</small>`
    : `${rop > 0 ? fmt(rop, 2) : "—"}<small>ft/天</small>`;
  const E = P.strokeEnergyJ(state.rig);
  document.getElementById("ro-energy").innerHTML = `${fmt(E, 0)}<small>J</small>`;
  document.getElementById("ro-oil").innerHTML = state.oilLevelFt != null
    ? `${fmt(state.oilLevelFt, 1)}<small>ft</small>`
    : `—<small>ft</small>`;

  const q = P.darcyInflowBblDay(state.darcy);
  const price = P.oilPrice(state.monthsSinceStrike);
  document.getElementById("yield-q").textContent = `${fmt(q, 1)} 桶/天`;
  const lvl = targetOilLevel();
  document.getElementById("yield-level").textContent = lvl >= P.STRIKE_FT
    ? "冲出地面（自喷）" : `还差 ${fmt(P.STRIKE_FT - Math.min(lvl, P.STRIKE_FT), 1)} ft 要抽`;
  document.getElementById("yield-money").textContent = `$${fmt(q * price, 0)} / 天 @ $${fmt(price, 2)}`;

  const chip = document.getElementById("phase-chip");
  const phases = {
    idle: "待命", driving: "打套管", drilling: "钻进", crevice: "收工过夜",
    struck: "出油", gusher: "自喷",
  };
  chip.textContent = `${phases[state.phase]} · 第 ${fmt(state.totalDays, 0)} 天`;
  chip.classList.toggle("on", state.phase === "struck" || state.phase === "gusher");
}

// ---------- chart tab ----------
function drawChart() {
  const c = chartCtx, W = 960, H = 400;
  c.clearRect(0, 0, W, H);
  const { qi, Di, b } = state.prod;
  const x0 = 70, x1 = 930;
  const months = 36;
  const xm = (m) => x0 + (m / months) * (x1 - x0);

  // ---- top: q (log) + N ----
  const qTop = 16, qBot = 156;
  const qmin = Math.log10(8), qmax = Math.log10(5000);
  const yq = (q) => qBot - ((Math.log10(Math.max(q, 8)) - qmin) / (qmax - qmin)) * (qBot - qTop);
  // grid
  c.font = "10.5px ui-monospace, Menlo, monospace"; c.fillStyle = "#6f6350"; c.strokeStyle = "#2a2317";
  for (const q of [10, 30, 100, 300, 1000, 3000]) {
    c.beginPath(); c.moveTo(x0, yq(q)); c.lineTo(x1, yq(q)); c.stroke();
    c.textAlign = "right"; c.fillText(String(q), x0 - 8, yq(q) + 3);
  }
  c.textAlign = "left";
  c.fillText("桶/天（对数）", x0, qTop - 4);
  // q(t)
  c.strokeStyle = "#f0c75e"; c.lineWidth = 2.4; c.beginPath();
  for (let m = 0; m <= months; m += 0.25) {
    const y = yq(P.arpsRate(qi, Di, b, m));
    m === 0 ? c.moveTo(xm(m), y) : c.lineTo(xm(m), y);
  }
  c.stroke();
  // N(t) normalized
  let nMax = P.arpsCum(qi, Di, b, months);
  c.strokeStyle = "#7fa8c9"; c.lineWidth = 1.8; c.setLineDash([6, 4]); c.beginPath();
  for (let m = 0; m <= months; m += 0.25) {
    const y = qBot - (P.arpsCum(qi, Di, b, m) / nMax) * (qBot - qTop);
    m === 0 ? c.moveTo(xm(m), y) : c.lineTo(xm(m), y);
  }
  c.stroke(); c.setLineDash([]);
  c.fillStyle = "#7fa8c9"; c.textAlign = "right";
  c.fillText(`N(36月) = ${fmt(nMax, 0)} 桶`, x1 - 4, qTop + 12);

  // ---- bottom: price ----
  const pTop = 216, pBot = 336;
  const pmin = Math.log10(0.4), pmax = Math.log10(20);
  const yp = (p) => pBot - ((Math.log10(p) - pmin) / (pmax - pmin)) * (pBot - pTop);
  c.strokeStyle = "#2a2317";
  for (const p of [0.49, 1, 4, 20]) {
    c.beginPath(); c.moveTo(x0, yp(p)); c.lineTo(x1, yp(p)); c.stroke();
    c.fillStyle = "#6f6350"; c.textAlign = "right";
    c.fillText(`$${p}`, x0 - 8, yp(p) + 3);
  }
  // crash shading
  c.fillStyle = "rgba(232,129,58,.08)";
  c.fillRect(xm(0), pTop, xm(P.CRASH_MONTHS) - x0, pBot - pTop);
  c.strokeStyle = "#e8813a"; c.lineWidth = 2.2; c.beginPath();
  for (let m = 0; m <= months; m += 0.25) {
    const y = yp(P.oilPrice(m));
    m === 0 ? c.moveTo(xm(m), y) : c.lineTo(xm(m), y);
  }
  c.stroke();
  c.fillStyle = "#e8813a"; c.textAlign = "left";
  c.fillText("油价 $/桶", x0, pTop - 6);
  c.textAlign = "left";
  c.fillText("$20 → 49¢（21 个月）", xm(2), yp(1) - 14);
  c.setLineDash([4, 4]); c.strokeStyle = "rgba(232,129,58,.5)";
  c.beginPath(); c.moveTo(xm(21), pTop); c.lineTo(xm(21), pBot); c.stroke(); c.setLineDash([]);

  // x axis
  c.fillStyle = "#6f6350"; c.textAlign = "center"; c.font = "10.5px ui-monospace, Menlo, monospace";
  for (let m = 0; m <= months; m += 6) {
    c.fillText(`${m} 月`, xm(m), pBot + 16);
    c.strokeStyle = "#2a2317";
    c.beginPath(); c.moveTo(xm(m), pTop); c.lineTo(xm(m), pBot); c.stroke();
  }
  // revenue numbers
  let rev = 0;
  for (let m = 0; m < 36; m += 0.5) {
    rev += P.arpsRate(qi, Di, b, m) * P.oilPrice(m) * 0.5 * 30.44;
  }
  document.getElementById("chart-cum").textContent = `${fmt(nMax / 1000, 2)} 千桶`;
  document.getElementById("chart-rev").textContent = `$${fmt(rev / 1000, 1)} 千`;
  const tail = P.arpsRate(qi, Di, b, 36);
  document.getElementById("chart-tail").textContent = `${fmt(tail, 1)} 桶/天（${fmt(tail / qi * 100, 0)}%）`;
}

// ---------- darcy tab ----------
function drawDarcy() {
  const c = darcyCtx, W = 960, H = 360;
  c.clearRect(0, 0, W, H);
  const d = state.darcy;
  const q = P.darcyInflowBblDay(d);

  // plan view: rings colored by P(r)
  const cx = 235, cy = 196, R = 150;
  const rings = 26;
  for (let i = rings; i >= 1; i--) {
    const frac = i / rings;
    const r = R * Math.pow(frac, 2.4); // visual spacing (log-ish)
    const rM = d.rwM * Math.pow(d.reM / d.rwM, frac);
    const pFrac = P.pressureAtRkPa(rM, d) / d.dPkPa;
    // red near well → blue at boundary
    const hue = 12 + pFrac * 210;
    c.fillStyle = `hsla(${hue}, 62%, ${34 + pFrac * 14}%, .55)`;
    c.beginPath(); c.arc(cx, cy, Math.max(r, 2), 0, Math.PI * 2); c.fill();
  }
  // half-drawdown circle
  const halfR = R * Math.pow(Math.sqrt(d.reM * d.rwM) / d.reM, 2.4);
  c.strokeStyle = "#7fa8c9"; c.lineWidth = 2; c.setLineDash([6, 5]);
  c.beginPath(); c.arc(cx, cy, Math.max(halfR, 3), 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  // well
  c.fillStyle = "#0d0b08"; c.beginPath(); c.arc(cx, cy, 5, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#f0c75e"; c.lineWidth = 1.6;
  c.beginPath(); c.arc(cx, cy, 5, 0, Math.PI * 2); c.stroke();
  c.fillStyle = "#7fa8c9"; c.font = "11.5px ui-monospace, Menlo, monospace"; c.textAlign = "left";
  c.fillText(`√(r_w·rₑ) = ${fmt(P.halfDrawdownRadiusM(d), 1)} m`, cx + halfR + 8, cy - halfR - 6);
  c.fillStyle = "#a89878";
  c.fillText(`rₑ = ${fmt(d.reM, 0)} m`, cx + R - 44, cy + R * 0.78);
  c.fillText("井筒 r_w = 3 in", cx - 30, cy + 18);
  c.fillStyle = "#f2e8d5"; c.font = "13px Georgia, serif";
  c.fillText("俯视：压降都堆在井壁边上", 40, 30);

  // right: P vs log r (a straight line)
  const px0 = 540, px1 = 920, py0 = 60, py1 = 300;
  const lg0 = Math.log10(d.rwM), lg1 = Math.log10(d.reM);
  const xr = (rM) => px0 + ((Math.log10(rM) - lg0) / (lg1 - lg0)) * (px1 - px0);
  const yp = (p) => py1 - (p / d.dPkPa) * (py1 - py0);
  c.strokeStyle = "#2a2317"; c.fillStyle = "#6f6350"; c.font = "10.5px ui-monospace, Menlo, monospace";
  for (const f of [0, 0.5, 1]) {
    const y = py1 - f * (py1 - py0);
    c.beginPath(); c.moveTo(px0, y); c.lineTo(px1, y); c.stroke();
    c.textAlign = "right"; c.fillText(`${fmt(d.dPkPa * f, 0)} kPa`, px0 - 8, y + 3);
  }
  const ticks = [d.rwM, 1, 3, 50, d.reM].filter((t) => t >= d.rwM && t <= d.reM);
  c.textAlign = "center";
  for (const t of ticks) {
    if (t < d.rwM || t > d.reM) continue;
    c.strokeStyle = "#2a2317";
    c.beginPath(); c.moveTo(xr(t), py1); c.lineTo(xr(t), py1 + 5); c.stroke();
    c.fillStyle = "#6f6350";
    c.fillText(t < 1 ? `${fmt(t * 100, 0)}cm` : `${fmt(t, 0)}m`, xr(t), py1 + 18);
  }
  // half point
  const rHalf = P.halfDrawdownRadiusM(d);
  c.fillStyle = "rgba(127,168,201,.14)";
  c.fillRect(px0, py0, xr(rHalf) - px0, py1 - py0);
  // the line
  c.strokeStyle = "#e8813a"; c.lineWidth = 2.6; c.beginPath();
  c.moveTo(xr(d.rwM), yp(0)); c.lineTo(xr(d.reM), yp(d.dPkPa));
  c.stroke();
  // dot at half
  c.fillStyle = "#7fa8c9"; c.beginPath(); c.arc(xr(rHalf), yp(d.dPkPa / 2), 5, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#f2e8d5"; c.font = "12.5px Georgia, serif"; c.textAlign = "left";
  c.fillText("P(r) 在对数轴上是一条直线", px0, py0 - 14);
  c.fillStyle = "#7fa8c9"; c.font = "11px ui-monospace, Menlo, monospace";
  c.fillText("← 一半压降，已经花完", px0 + 10, yp(d.dPkPa / 2) + 24);

  // side numbers
  document.getElementById("d-k").textContent = `${fmt(d.kD, 2)} D`;
  document.getElementById("d-h").textContent = `${fmt(d.hNetM, 1)} m`;
  document.getElementById("d-dp").textContent = `${fmt(d.dPkPa, 0)} kPa`;
  document.getElementById("d-mu").textContent = `${fmt(d.muCp, 1)} cP`;
  document.getElementById("d-re").textContent = `${fmt(d.reM, 0)} m`;
  document.getElementById("d-ln").textContent = `ln(${fmt(d.reM / d.rwM, 0)}) = ${fmt(Math.log(d.reM / d.rwM), 2)}`;
  const qEl = document.getElementById("d-q");
  qEl.textContent = `${fmt(q, 1)} 桶/天`;
}

// ---------- api tab ----------
function drawApi() {
  const c = apiCtx, W = 960, H = 380;
  c.clearRect(0, 0, W, H);
  const crude = P.CRUDES.find((x) => x.id === state.crudeId);
  const sg = P.sgFromAPI(crude.api);

  // jar
  const jx = 250, jw = 130, jy = 48, jh = 300;
  c.fillStyle = "rgba(255,255,255,.03)"; c.strokeStyle = "#57472c"; c.lineWidth = 3;
  c.beginPath(); c.roundRect(jx, jy, jw, jh, 10); c.fill(); c.stroke();
  // liquid
  c.fillStyle = crude.color; c.globalAlpha = 0.9;
  c.fillRect(jx + 5, jy + 70, jw - 10, jh - 78); c.globalAlpha = 1;
  // hydrometer: Archimedes — a denser (heavier, lower-API) liquid buoys it
  // higher. Schematic: the stem is a 0–50° scale and the instrument sits so
  // its own degree tick meets the liquid line.
  const api = crude.api;
  const lineY = jy + 70;
  // keep the stem inside the jar for very heavy crudes by shortening it
  const stemLen = Math.min(150, (lineY - (jy + 10)) / Math.max(1 - api / 50, 0.04));
  const hydTop = lineY - (1 - api / 50) * stemLen;
  c.strokeStyle = "#e8dcc0"; c.lineWidth = 2;
  c.beginPath(); c.moveTo(jx + jw / 2, hydTop); c.lineTo(jx + jw / 2, hydTop + stemLen); c.stroke();
  // bulb
  c.fillStyle = "#c9bda0";
  c.beginPath(); c.ellipse(jx + jw / 2, hydTop + stemLen + 16, 15, 20, 0, 0, Math.PI * 2); c.fill();
  // stem scale ticks (50° at the top, near the bulb it is 0°)
  c.strokeStyle = "rgba(232,220,192,.85)"; c.lineWidth = 1;
  c.font = "9.5px ui-monospace, Menlo, monospace"; c.fillStyle = "rgba(232,220,192,.8)"; c.textAlign = "right";
  for (let a = 0; a <= 50; a += 10) {
    const ty = hydTop + (1 - a / 50) * stemLen;
    c.beginPath(); c.moveTo(jx + jw / 2 - 12, ty); c.lineTo(jx + jw / 2 - 4, ty); c.stroke();
    c.fillText(String(a), jx + jw / 2 - 16, ty + 3);
  }
  // reading marker at the liquid line
  c.strokeStyle = "#f0c75e"; c.lineWidth = 2; c.setLineDash([5, 4]);
  c.beginPath(); c.moveTo(jx - 30, lineY); c.lineTo(jx + jw + 46, lineY); c.stroke(); c.setLineDash([]);
  c.fillStyle = "#f0c75e"; c.font = "12px ui-monospace, Menlo, monospace"; c.textAlign = "left";
  c.fillText(`液面读数 ${api}°`, jx + jw + 52, lineY - 8);

  // right: the whole crude spectrum as a scale
  const sx = 620, sy = 52, sh = 290;
  const grad = c.createLinearGradient(0, sy, 0, sy + sh);
  grad.addColorStop(0, "#e8c766"); grad.addColorStop(0.4, "#c99a3a");
  grad.addColorStop(0.75, "#7a5a20"); grad.addColorStop(1, "#2b241a");
  c.fillStyle = grad; c.fillRect(sx, sy, 16, sh);
  c.strokeStyle = "#57472c"; c.strokeRect(sx, sy, 16, sh);
  c.font = "12.5px ui-monospace, Menlo, monospace";
  for (const cr of P.CRUDES) {
    const y = sy + (1 - cr.api / 50) * sh;
    c.fillStyle = "#a89878"; c.textAlign = "right";
    c.fillText(`${cr.name}`, sx - 12, y + 4);
    c.fillStyle = "#f2e8d5"; c.textAlign = "left";
    c.fillText(`${cr.api}°`, sx + 26, y + 4);
    if (cr.id === state.crudeId) {
      c.fillStyle = "#f0c75e";
      c.beginPath(); c.arc(sx + 8, y, 5.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#0d0b08"; c.lineWidth = 1.6; c.stroke();
    }
  }
  c.fillStyle = "#6f6350"; c.font = "11.5px ui-monospace, Menlo, monospace";
  c.fillText("↑ 轻（煤油多，1859 年的宝贝）", sx + 30, sy + 12);
  c.fillText("↓ 重（沥青，能铺路）", sx + 30, sy + sh - 6);
  c.fillStyle = "#f2e8d5"; c.font = "13px Georgia, serif";
  c.fillText(`${crude.name} —— ${crude.note}`, 60, 30);

  // facts
  document.getElementById("a-formula").textContent = `141.5/${fmt(sg, 3)} − 131.5`;
  document.getElementById("a-sg").textContent = fmt(sg, 3);
  document.getElementById("a-api").textContent = `${api}°`;
  document.getElementById("a-kg").textContent = `${fmt(sg * 158.987, 0)} kg`;
}

// ---------- log ----------
function renderLog() {
  const el = document.getElementById("log-list");
  el.innerHTML = state.logs
    .map((l) => `<div class="log-entry${l.event ? " event" : ""}">
      <span class="when">${l.when}</span><span class="what">${l.what}</span></div>`)
    .join("");
}

function seedStaticLog() {
  state.logs = [];
  addLog("1861 · 尾声", "油溪两岸井架林立，油价从 $20 跌到 49¢；石油溪协会想把油价托在 $4");
  addLog("1859-08-27", "（下面这些会在你钻到 69.5 ft 时发生——往下钻吧）", false);
  addLog("1859-08-01 前后", "蒸汽绳式钻开钻：页岩里一天约 3 英尺", true);
  addLog("1859-06", "塌孔治住了：10 英尺一节的铸铁管用白橡木夯锤一路砸到基岩——现代下套管工艺从这里定型", true);
  addLog("1859 春", "盐井钻工一听说是「找油」，全都笑走人了；铁匠比利·史密斯大叔留了下来", false);
  addLog("1858-12", "铁路列车员埃德温·德雷克被派到油溪。名片上的「上校」是自己加的——为了让钻井队听他的", false);
}

// ---------- UI wiring ----------
const $ = (id) => document.getElementById(id);

function slider(out, range, get, set, fmtFn) {
  const o = $(out), r = $(range);
  const refresh = () => { o.textContent = fmtFn(get()); r.value = get(); };
  r.addEventListener("input", () => { set(parseFloat(r.value)); o.textContent = fmtFn(get()); updateReadouts(); });
  return refresh;
}

const refreshers = [];
refreshers.push(slider("spm-out", "spm-range", () => state.rig.strokesPerMin, (v) => (state.rig.strokesPerMin = v), (v) => `${v} 锤/分`));
refreshers.push(slider("mass-out", "mass-range", () => state.rig.massKg, (v) => (state.rig.massKg = v), (v) => `${v} kg`));
refreshers.push(slider("drop-out", "drop-range", () => state.rig.dropM, (v) => (state.rig.dropM = v), (v) => `${fmt(v, 2)} m`));
refreshers.push(slider("dia-out", "dia-range", () => state.rig.diaM * 39.3701, (v) => (state.rig.diaM = v / 39.3701), (v) => `${fmt(v, 2)} in`));
refreshers.push(slider("speed-out", "speed-range", () => state.speed, (v) => (state.speed = v), (v) => `×${v}`));
refreshers.push(slider("surplus-out", "surplus-range", () => state.surplusKPa, (v) => { state.surplusKPa = v; if (state.phase === "struck" || state.phase === "gusher") state.oilAnim = Math.min(state.oilAnim, 0.4); }, (v) => `${v} kPa`));
refreshers.push(slider("qi-out", "qi-range", () => state.prod.qi, (v) => (state.prod.qi = v), (v) => `${v}`));
refreshers.push(slider("di-out", "di-range", () => state.prod.Di, (v) => (state.prod.Di = v), (v) => `${fmt(v, 3)}`));
refreshers.push(slider("b-out", "b-range", () => state.prod.b, (v) => (state.prod.b = v), (v) => fmt(v, 2)));
refreshers.push(slider("dk-out", "dk-range", () => state.darcy.kD, (v) => (state.darcy.kD = v), (v) => `${fmt(v, 2)} D`));
refreshers.push(slider("ddp-out", "ddp-range", () => state.darcy.dPkPa, (v) => (state.darcy.dPkPa = v), (v) => `${v} kPa`));
refreshers.push(slider("dmu-out", "dmu-range", () => state.darcy.muCp, (v) => (state.darcy.muCp = v), (v) => `${fmt(v, 1)} cP`));
refreshers.push(slider("dh-out", "dh-range", () => state.darcy.hNetM, (v) => (state.darcy.hNetM = v), (v) => `${fmt(v, 1)} m`));
refreshers.push(slider("dre-out", "dre-range", () => state.darcy.reM, (v) => (state.darcy.reM = v), (v) => `${v} m`));

function setEngine(on) {
  state.engineOn = on;
  const btn = $("engine-btn");
  btn.textContent = on ? "■ 停钻" : "⚙ 开钻";
  btn.classList.toggle("primary", !on);
  if (on && state.phase === "idle") {
    state.phase = "driving";
    addLog("第 0 天", "开钻——先把套管打过含水砾石层", true);
  }
  if (!on && state.phase === "driving") { /* pause */ }
}
$("engine-btn").addEventListener("click", () => setEngine(!state.engineOn));
$("casing-btn").addEventListener("click", () => {
  if (state.phase !== "idle" && state.phase !== "driving") return;
  state.pipeFt = P.BEDROCK_FT;
  state.phase = "drilling";
  state.depthFt = P.BEDROCK_FT;
  state.simDays = 0;
  addLog("捷径", "套管直接坐上 32 ft 基岩——开始钻进", true);
  updateReadouts();
});
function resetWell(keepParams = true) {
  Object.assign(state, {
    phase: "idle", engineOn: false, simDays: 0, totalDays: 0,
    pipeFt: 0, depthFt: 0, oilLevelFt: null, oilAnim: 0,
    creviceTimer: 0, bannerTimer: 0, bannerShown: false,
    monthsSinceStrike: 0, particles: [], spray: [],
  });
  state.pipeLogged = false;
  document.getElementById("strike-banner").classList.remove("show");
  setEngine(false);
  const btn = $("engine-btn"); btn.textContent = "⚙ 开钻"; btn.classList.add("primary");
  if (!keepParams) { /* params live in state already */ }
  seedStaticLog();
  updateReadouts();
}
$("reset-btn").addEventListener("click", () => resetWell());

// presets
const presetRoot = $("presets");
for (const p of Object.values(P.PRESETS)) {
  const b = document.createElement("button");
  b.textContent = p.label;
  b.dataset.preset = p.id;
  b.addEventListener("click", () => applyPreset(p.id));
  presetRoot.appendChild(b);
}
function applyPreset(id) {
  const p = P.PRESETS[id];
  state.preset = id;
  state.rig = { ...p.rig };
  state.darcy = { ...p.darcy };
  state.prod = { ...p.prod };
  state.surplusKPa = p.surplusKPa;
  state.sg = P.sgFromAPI(P.CRUDES.find((c) => c.id === p.crudeId).api);
  state.crudeId = p.crudeId;
  refreshers.forEach((f) => f());
  refreshCrudes();
  resetWell();
  document.querySelectorAll("#presets button").forEach((b) => b.classList.toggle("on", b.dataset.preset === id));
  updateReadouts();
  drawTabs();
}

// tabs
let activeTab = "chart";
document.querySelectorAll("#tabs button").forEach((b) => {
  b.addEventListener("click", () => setTab(b.dataset.tab));
});
function setTab(name) {
  activeTab = name;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
  for (const t of ["chart", "darcy", "api", "log"]) {
    document.getElementById(`tab-${t}`).classList.toggle("hidden", t !== name);
  }
  drawTabs();
}
function drawTabs() {
  if (activeTab === "chart") drawChart();
  if (activeTab === "darcy") drawDarcy();
  if (activeTab === "api") drawApi();
}

// crude picker
function refreshCrudes() {
  const root = $("crude-pick");
  root.innerHTML = "";
  for (const cr of P.CRUDES) {
    const b = document.createElement("button");
    b.innerHTML = `${cr.name}<span class="deg">${cr.api}°</span><i>${cr.note}</i>`;
    b.classList.toggle("on", cr.id === state.crudeId);
    b.addEventListener("click", () => {
      state.crudeId = cr.id;
      state.sg = P.sgFromAPI(cr.api);
      refreshCrudes(); drawApi();
    });
    root.appendChild(b);
  }
}

// ---------- boot & loop ----------
applyPreset("drake");
resetWell();
refreshers.forEach((f) => f());

let last = performance.now();
function loop(t) {
  const dt = Math.min((t - last) / 1000, 0.05);
  last = t;
  tick(dt);
  drawRig();
  if (state.videoMode) return; // __demo.step drives everything
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- deterministic demo/video API ----------
window.__demo = {
  loadPreset: (id) => applyPreset(id),
  setEngine: (on) => setEngine(on),
  setCasing: () => $("casing-btn").click(),
  setSpeed: (v) => { state.speed = v; refreshers.forEach((f) => f()); },
  setSurplus: (kPa) => { state.surplusKPa = kPa; refreshers.forEach((f) => f()); },
  setTab: (name) => setTab(name),
  setProd: (k, v) => { state.prod[k] = v; refreshers.forEach((f) => f()); drawChart(); },
  setRig: (k, v) => { state.rig[k] = v; refreshers.forEach((f) => f()); },
  setDarcy: (k, v) => { state.darcy[k] = v; refreshers.forEach((f) => f()); drawDarcy(); },
  setCrude: (id) => { state.crudeId = id; state.sg = P.sgFromAPI(P.CRUDES.find((c) => c.id === id).api); refreshCrudes(); drawApi(); },
  scrollToRig: () => document.querySelector(".rig-card").scrollIntoView({ block: "center" }),
  setVideoMode: (on) => { state.videoMode = on; },
  reset: () => resetWell(),
  step(dt) {
    state.videoMode = true;
    tick(dt);
    drawRig();
    drawTabs();
  },
  state: () => ({ ...state, rop: currentRop() }),
};
