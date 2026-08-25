// app.js — Lavoisier's Ledger UI. Every number comes from physics.js;
// this file draws the balance bench, keeps the register, and runs the
// phlogiston court. All motion is a pure function of clock `t`, so video
// captures are deterministic through window.__demo.step(dt).
import {
  REACTIONS,
  SPECIES,
  reactionById,
  buildLedger,
  o2MolesInAir,
  n2MolesInAir,
} from "./physics.js";

const $ = (id) => document.getElementById(id);

const state = {
  r: REACTIONS[0],
  masses: {},
  airL: 1.2,
  vessel: "sealed",
  f: 0,
  flame: false,
  tab: "chart",
  t: 0,
};

const HEAT_RATE = 0.055; // ξ/ξmax per second while the burner is on

/* ---------- formatting ---------- */
const fmtG = (x) => `${x.toFixed(3)} g`;
const fmtSign = (x) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(3)} g`;
const fmtX = (x) => `${x.toFixed(3)}×`;

/* ---------- deterministic particle params ---------- */
function hash01(i, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7 + 74.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ---------- setup / scenario ---------- */
function loadScenario(id) {
  state.r = reactionById(id);
  state.masses = { [state.r.sampleKey]: state.r.sampleDefault };
  state.airL = state.r.airLitres ? state.r.airLitres.def : 0;
  state.vessel = state.r.vesselDefault;
  state.f = 0;
  state.flame = false;
  syncControls();
  render();
}

function syncControls() {
  const r = state.r;
  document.querySelectorAll(".presets button").forEach((b) =>
    b.classList.toggle("on", b.dataset.id === r.id)
  );
  $("bench-title").textContent = `实验台 · ${r.title}（${r.year}）`;
  $("bench-eq").textContent = r.eq;

  // vessel picker
  const btns = document.querySelectorAll("#vessel-pick button");
  btns.forEach((b) => {
    b.disabled = !!r.sealedOnly && b.dataset.vessel === "open";
    b.classList.toggle("on", b.dataset.vessel === state.vessel);
  });
  const chip = $("vessel-chip");
  chip.textContent = state.vessel === "sealed" ? "密封系统" : "敞口坩埚";
  chip.classList.toggle("off", state.vessel !== "sealed");

  // sliders
  const sr = $("sample-range");
  sr.min = r.sampleMin;
  sr.max = r.sampleMax;
  sr.step = r.id === "water" ? 0.016 : 0.1;
  sr.value = state.masses[r.sampleKey];
  $("sample-label").textContent = r.sampleLabel;
  $("sample-out").textContent = fmtG(state.masses[r.sampleKey]);

  const airWrap = $("air-label-wrap");
  if (r.airLitres) {
    airWrap.style.display = "";
    const ar = $("air-range");
    ar.min = r.airLitres.min;
    ar.max = r.airLitres.max;
    ar.step = r.airLitres.step;
    ar.value = state.airL;
    $("air-out").textContent = `${state.airL.toFixed(2)} L`;
  } else {
    airWrap.style.display = "none";
  }
  $("extent-range").value = state.f;
  $("extent-out").textContent = `${(state.f * 100).toFixed(1)} %`;
  const fb = $("flame-btn");
  fb.classList.toggle("on", state.flame);
  fb.textContent = state.flame ? "🔥 加热中…" : "🔥 加热";
}

/* ---------- ledger DOM ---------- */
function renderLedger(led) {
  const wrap = $("ledger-rows");
  wrap.replaceChildren();
  for (const row of led.rows) {
    const sp = SPECIES[row.s];
    const div = document.createElement("div");
    div.className = "row";
    const esc =
      row.escapedNote && Math.abs(row.after - row.before) > 1e-9
        ? ` <em>↑ ${row.escapedNote}</em>`
        : "";
    div.innerHTML = `
      <span class="sp"><i class="dot" style="background:${sp.color}"></i>
        <span class="name">${row.label} <em>${row.formula}${esc}</em></span></span>
      <span class="grams">${row.before.toFixed(3)} → ${row.after.toFixed(3)}</span>`;
    wrap.appendChild(div);
  }
  $("ledger-total").textContent = fmtG(led.totalAfter);
  const dRow = document.querySelector(".delta-row");
  $("ledger-delta").textContent = fmtSign(led.weighedDelta);
  dRow.classList.toggle("neg", led.weighedDelta < 0);

  let note = state.r.story;
  if (state.r.airFeed && state.vessel === "sealed") {
    const o2a = o2MolesInAir(state.airL);
    note += ` 密闭的 ${state.airL.toFixed(2)} L 空气只含 <b>${o2MolesInAir(state.airL).toFixed(4)} mol（${(o2a * SPECIES.O2.M).toFixed(3)} g）活气</b>。`;
  } else if (state.vessel === "open") {
    note += ` <b>敞口</b>：秤盘只称固体与液体，气体与大气自由交换。`;
  }
  $("ledger-note").innerHTML = note;
}

/* ---------- court ---------- */
const COURT = {
  tin: {
    predicts: "煅烧 = 物体向空气释放燃素。锡跑掉了燃素，剩下的锡灰<b>理应更轻</b>。",
    observedFn: (led) =>
      `凝聚相（锡＋锡灰）净重 <b>${led.weighedDelta >= 0 ? "增加" : "减少"} ${Math.abs(condensedDelta(led)).toFixed(3)} g</b>——恰好等于空气交出的氧。`,
    fine: "拉瓦锡 1774：密封瓶总重分毫不差；打开瓶塞，空气涌入补上被消耗的氧气。变重的不是“火原则”，是空气里的氧。",
  },
  charcoal: {
    predicts: "木炭燃烧释放大量燃素，灰比炭轻——<b>燃素说在这口炭盆上是对的</b>，它的支持者最爱这个例子。",
    observedFn: (led) =>
      `秤盘读数减少，但账本追到了失踪的质量：<b>${Math.abs(led.rows.find((x) => x.s === "CO2").after - led.rows.find((x) => x.s === "CO2").before).toFixed(3)} g 二氧化碳</b>逃进了空气。`,
    fine: "减重不是燃素飞走的证据，只是气体没上秤。把天平罩进密封瓶，一切归位——解释权从哲学搬到了账本。",
  },
  calx: {
    predicts: "红灰（氧化汞）若按燃素的逻辑加热，应该继续失掉燃素、越烧越轻。",
    observedFn: (led) =>
      `红灰分解成水银和一种气体：让蜡烛爆燃、比普通空气猛烈五六倍的<b>“活气”</b>。1778 年它被命名为 oxygène——成酸者。`,
    fine: "Priestley 先看到这种气体，却叫它“脱燃素空气”；Lavoisier 称出它的质量并给它命名。看见和看懂之间，隔着一本账。",
  },
  water: {
    predicts: "水自太古便是元素；易燃气则是燃素本身——燃素烧成了水？学说在这里开始胡言乱语。",
    observedFn: (led) =>
      `2 份易燃气 + 1 份活气，火花一闪，凝出的液滴恰是水：<b>${led.totalAfter.toFixed(3)} g 原料 = ${led.totalAfter.toFixed(3)} g 水</b>。`,
    fine: "1783 年 6 月，Cavendish 的报告传到巴黎，Lavoisier 与 Laplace 立刻复现：水不是元素，是氢的氧化物。“氢”的意思就是——造水者。",
  },
};

function condensedDelta(led) {
  let d = 0;
  for (const row of led.rows) if (row.phase !== "gas") d += row.after - row.before;
  return d;
}

function renderCourt(led) {
  const c = COURT[state.r.id];
  $("court-predicts").innerHTML = c.predicts;
  $("court-observed").innerHTML = c.observedFn(led);
  const contradicts =
    (state.r.id === "tin" || state.r.id === "calx") ? true : false;
  $("court-verdict").innerHTML = contradicts
    ? `燃素说在金属煅烧上<b>当庭矛盾</b>：预言变轻，实测变重。<span class="verdict-badge guilty">PHLOGISTON · 不成立</span>`
    : `木炭帮了燃素说最后一个忙，也暴露了它的死穴：不称气的天平不是好法官。<span class="verdict-badge innocent">需要一本完整的账</span>`;
  $("court-fineprint").innerHTML = c.fine;
}

/* ---------- log ---------- */
function renderLog(led) {
  const list = $("log-list");
  list.replaceChildren();
  const entry = (tag, html) => {
    const d = document.createElement("div");
    d.className = "log-entry";
    d.innerHTML = `<b>${tag}</b> ${html}`;
    list.appendChild(d);
  };
  entry("实验", `${state.r.title}（${state.r.year}）· ${state.r.eq} · ${state.vessel === "sealed" ? "密封系统" : "敞口坩埚"}`);
  entry("守恒", `密封总质量 ${led.totalBefore.toFixed(3)} g → ${led.totalAfter.toFixed(3)} g，漂移 ${Math.abs(led.drift) < 1e-9 ? "0.000" : led.drift.toFixed(3)} g —— 账平了。`);
  if (state.r.airFeed && state.vessel === "sealed") {
    const consumed = o2MolesInAir(state.airL) - (led.n1.O2 || 0);
    entry("空气", `消耗活气 ${consumed.toFixed(4)} mol；氮气 ${led.n1.N2.toFixed(4)} mol 原封不动——空气少掉约五分之一。`);
  }
  entry("压强", state.vessel === "sealed"
    ? `同温同容下 P/P₀ = n₁/n₀ = ${led.pressure.toFixed(3)}（${led.pressure < 1 ? "负压：打开瓶塞会吸入空气" : led.pressure > 1.001 ? "正压：产物气体在积累" : "不变"}）。`
    : "敞口坩埚通大气，压强恒为 1 atm——所以天平只谈质量，不谈压强。");
  entry("秤盘", `敞口读数将变化 ${fmtSign(led.weighedDelta)}；密封时这个数字恒为 ${fmtSign(0)}。`);
}

/* ---------- charts ---------- */
function drawChart(led) {
  const cv = $("chart");
  const ctx = prepCanvas(cv, 320);
  const W = cv.clientWidth, H = 320;
  ctx.clearRect(0, 0, W, H);
  const padL = 74, padR = 20, padT = 18, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;

  // curves
  const sealedPts = [], openPts = [];
  for (let i = 0; i <= 64; i++) {
    const f = i / 64;
    const l = buildLedger(state.r, state.masses, state.airL, "sealed", f);
    sealedPts.push([f, l.totalAfter]);
    if (!state.r.sealedOnly) {
      const lo = buildLedger(state.r, state.masses, state.airL, "open", f);
      openPts.push([f, lo.weighedAfter]);
    }
  }
  let lo = Infinity, hi = -Infinity;
  for (const [, v] of [...sealedPts, ...openPts]) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (hi - lo < hi * 0.02) { lo = 0; hi *= 1.15; } // flat curve (e.g. water)
  const span = Math.max(1e-6, hi - lo);
  lo -= span * 0.08;
  hi += span * 0.08;
  const X = (f) => padL + f * iw;
  const Y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;

  // grid
  ctx.strokeStyle = "rgba(34,48,79,.8)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (ih * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.fillStyle = "#8fa1c4";
    ctx.font = "11px ui-monospace, Menlo, monospace";
    ctx.textAlign = "right";
    const val = hi - ((hi - lo) * i) / 4;
    ctx.fillText(val.toFixed(1), padL - 8, y + 4);
  }
  for (let i = 0; i <= 4; i++) {
    const x = X(i / 4);
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + ih);
    ctx.stroke();
    ctx.fillStyle = "#8fa1c4";
    ctx.textAlign = "center";
    ctx.fillText(`${i * 25}%`, x, H - 12);
  }
  ctx.textAlign = "left";
  ctx.fillText("ξ/ξmax", padL - 56, H - 12); // axis caption left of the ticks
  ctx.save();
  ctx.translate(14, padT + ih / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("质量 / g", 0, 0);
  ctx.restore();

  const line = (pts, color, dash) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    pts.forEach(([f, v], i) => (i ? ctx.lineTo(X(f), Y(v)) : ctx.moveTo(X(f), Y(v))));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  if (!state.r.sealedOnly) line(openPts, "#7fd4ff", [7, 5]);
  line(sealedPts, "#d4af37");

  // marker
  const mx = X(state.f);
  ctx.strokeStyle = "rgba(242,245,252,.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(mx, padT);
  ctx.lineTo(mx, padT + ih);
  ctx.stroke();
  ctx.fillStyle = "#d4af37";
  ctx.beginPath();
  ctx.arc(mx, Y(sealedPts[Math.round(state.f * 64)][1]), 5, 0, 7);
  ctx.fill();
  if (!state.r.sealedOnly) {
    ctx.fillStyle = "#7fd4ff";
    ctx.beginPath();
    ctx.arc(mx, Y(openPts[Math.round(state.f * 64)][1]), 5, 0, 7);
    ctx.fill();
  }
}

/* ---------- balance bench ---------- */
function prepCanvas(cv, cssH) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || cv.parentElement.clientWidth;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(cssH * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(cssH * dpr);
  }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function drawBench(led) {
  const cv = $("bench");
  const ctx = prepCanvas(cv, 460);
  const W = cv.clientWidth, H = 460;
  const t = state.t;
  ctx.clearRect(0, 0, W, H);
  const sc = Math.min(1, W / 980);
  ctx.save();
  ctx.translate((W - 980 * sc) / 2, 0);
  ctx.scale(sc, sc);

  const CX = 320;              // jar centre (logical units)
  const PAN_Y = 392;           // balance pan top
  const GAUZE_Y = PAN_Y - 22;
  const JAR_L = CX - 168, JAR_R = CX + 168, JAR_TOP = 96;

  /* balance body */
  ctx.fillStyle = "#10182e";
  roundRect(ctx, CX - 300, PAN_Y + 26, 600, 42, 8);
  ctx.fill();
  ctx.strokeStyle = "#22304f";
  ctx.stroke();
  // digital display
  ctx.fillStyle = "#05070f";
  roundRect(ctx, CX + 60, PAN_Y + 30, 220, 36, 6);
  ctx.fill();
  ctx.fillStyle = "#ffd76a";
  ctx.font = "600 20px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${led.weighedAfter.toFixed(3)} g`, CX + 170, PAN_Y + 50);
  ctx.fillStyle = "#5c6c92";
  ctx.font = "10px ui-monospace, Menlo, monospace";
  ctx.fillText(state.vessel === "sealed" ? "SEALED · 全系统" : "OPEN · 仅凝聚相", CX + 170, PAN_Y + 62);
  // pan column + plate
  ctx.fillStyle = "#1b2743";
  roundRect(ctx, CX - 130, PAN_Y + 8, 260, 20, 4);
  ctx.fill();
  ctx.fillStyle = "#8a6d2f";
  roundRect(ctx, CX - 210, PAN_Y, 420, 10, 4);
  ctx.fill();

  /* tripod + gauze */
  ctx.strokeStyle = "#6b5724";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(CX - 120, GAUZE_Y);
  ctx.lineTo(CX - 140, PAN_Y);
  ctx.moveTo(CX + 120, GAUZE_Y);
  ctx.lineTo(CX + 140, PAN_Y);
  ctx.moveTo(CX - 150, GAUZE_Y);
  ctx.lineTo(CX + 150, GAUZE_Y);
  ctx.stroke();

  /* burner flames between gauze and pan */
  const heating = state.flame && state.f < 1;
  if (heating || state.flame) {
    for (let i = 0; i < 5; i++) {
      const fx = CX - 80 + i * 40;
      const hgt = heating ? 16 + 7 * Math.sin(t * 7 + i * 2.1) + 4 * Math.sin(t * 13 + i) : 4;
      const grd = ctx.createLinearGradient(fx, PAN_Y - hgt, fx, PAN_Y);
      grd.addColorStop(0, "rgba(255,214,106,.95)");
      grd.addColorStop(.55, "rgba(255,154,92,.85)");
      grd.addColorStop(1, "rgba(120,60,20,.15)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(fx, PAN_Y - hgt / 2, 7, hgt / 2 + 2, 0, 0, 7);
      ctx.fill();
    }
  }

  /* heat shimmer rising along jar walls */
  if (heating) {
    ctx.strokeStyle = "rgba(255,154,92,.28)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const yy = JAR_TOP + 40 + ((t * 46 + i * 90) % 230);
      const xx = i === 1 ? JAR_R + 14 : (i === 0 ? JAR_L - 14 : CX);
      ctx.beginPath();
      ctx.moveTo(xx + 5 * Math.sin(t * 3 + i), yy);
      ctx.quadraticCurveTo(xx - 5 * Math.sin(t * 3 + i), yy + 16, xx + 5 * Math.sin(t * 3 + i + 1), yy + 32);
      ctx.stroke();
    }
  }

  /* bell jar (glass) */
  ctx.beginPath();
  ctx.moveTo(JAR_L, GAUZE_Y);
  ctx.lineTo(JAR_L, JAR_TOP + 46);
  ctx.quadraticCurveTo(JAR_L, JAR_TOP, CX - 60, JAR_TOP);
  ctx.lineTo(CX + 60, JAR_TOP);
  ctx.quadraticCurveTo(JAR_R, JAR_TOP, JAR_R, JAR_TOP + 46);
  ctx.lineTo(JAR_R, GAUZE_Y);
  ctx.closePath();
  ctx.fillStyle = "rgba(127,212,255,.05)";
  ctx.fill();
  ctx.strokeStyle = "rgba(160,215,250,.55)";
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // glass highlight
  ctx.strokeStyle = "rgba(255,255,255,.14)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(JAR_L + 22, GAUZE_Y - 30);
  ctx.lineTo(JAR_L + 22, JAR_TOP + 70);
  ctx.stroke();

  /* stopcock / seal at dome */
  ctx.fillStyle = state.vessel === "sealed" ? "#d4af37" : "#33405f";
  circle(ctx, CX, JAR_TOP - 8, 9);
  ctx.strokeStyle = "rgba(160,215,250,.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CX, JAR_TOP - 2);
  ctx.lineTo(CX, JAR_TOP + 8);
  ctx.stroke();
  ctx.fillStyle = "#8fa1c4";
  ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.fillText(state.vessel === "sealed" ? "SEAL · 密封" : "VENT · 通大气", CX + 16, JAR_TOP - 4);

  /* manometer (sealed only) */
  if (state.vessel === "sealed") {
    const mx = JAR_R + 66;
    ctx.strokeStyle = "rgba(160,215,250,.5)";
    ctx.lineWidth = 2;
    // connect jar dome to left limb
    ctx.beginPath();
    ctx.moveTo(CX, JAR_TOP - 14);
    ctx.lineTo(CX, JAR_TOP - 30);
    ctx.lineTo(mx - 16, JAR_TOP - 30);
    ctx.lineTo(mx - 16, 180);
    ctx.stroke();
    // U tube limbs
    ctx.beginPath();
    ctx.moveTo(mx - 16, 180);
    ctx.lineTo(mx - 16, 296);
    ctx.lineTo(mx + 16, 296);
    ctx.lineTo(mx + 16, 180);
    ctx.stroke();
    // liquid columns
    const dh = Math.max(-52, Math.min(84, (led.pressure - 1) * 190));
    ctx.strokeStyle = "#ff6b5e";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mx - 16, 196);
    ctx.lineTo(mx - 16, 290);
    ctx.lineTo(mx + 16, 290);
    ctx.lineTo(mx + 16, 196 - dh);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = "#8fa1c4";
    ctx.textAlign = "center";
    ctx.fillText(`P/P₀=${led.pressure.toFixed(3)}`, mx, 320);
    ctx.fillText("压强计", mx, 336);
  }

  /* ---- particles inside the jar ---- */
  const inner = { l: JAR_L + 16, r: JAR_R - 16, t: JAR_TOP + 16, b: GAUZE_Y - 6 };

  // solid reactant/product beds
  const solidReactant = Object.keys(state.r.reactants).find(
    (s) => SPECIES[s].phase !== "gas"
  );
  const prodSpecies = Object.keys(state.r.products);

  if (solidReactant) {
    const sp = SPECIES[solidReactant];
    const nBalls = 14;
    const conv = Math.round(state.f * nBalls);
    // grains visibly turn into the product only when that product is a
    // solid (tin → calx); gas/liquid products simply leave the bed
    const solidProduct = prodSpecies.find((s) => SPECIES[s].phase === "solid");
    let placed = 0;
    for (let row = 0; placed < nBalls; row++) {
      const inRow = 7 - row;
      for (let col = 0; col < inRow && placed < nBalls; col++, placed++) {
        const bx = CX - ((inRow - 1) * 26) / 2 + col * 26;
        const by = inner.b - 14 - row * 26 + 1.6 * Math.sin(t * 2.4 + placed);
        const isConv = placed < conv;
        if (!isConv) {
          ctx.fillStyle = sp.color;
          circle(ctx, bx, by, sp.r - 2);
        } else if (solidProduct) {
          ctx.fillStyle = SPECIES[solidProduct].color;
          circle(ctx, bx, by, sp.r - 1);
        }
      }
    }
    label(ctx, SPECIES[solidReactant].formula, JAR_L + 26, inner.b - 78, sp.color);
  }

  // liquid products pooling at the bottom
  for (const ps of prodSpecies) {
    if (SPECIES[ps].phase !== "liquid") continue;
    const wPool = (JAR_R - JAR_L - 44) * Math.min(1, state.f);
    ctx.fillStyle = SPECIES[ps].color;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.ellipse(CX, inner.b - 6, Math.max(6, wPool / 2), 9, 0, 0, 7);
    ctx.fill();
    // shiny beads
    for (let i = 0; i < 5; i++) {
      const bx = CX - wPool / 2 + (wPool * (i + 0.5)) / 5;
      circle(ctx, bx, inner.b - 8 - 2 * Math.abs(Math.sin(t * 1.7 + i)), 5);
    }
    ctx.globalAlpha = 1;
    label(ctx, `${SPECIES[ps].label} ${SPECIES[ps].formula}`, CX + 40, inner.b - 30, SPECIES[ps].color);
  }

  // gas population
  const gasFade = gasOpacity(led);
  drawGas(ctx, inner, t, "N2", 10, gasFade.n2, inner.r - 44);
  const feedKey = state.r.airFeed ||
    Object.keys(state.r.reactants).find((s) => SPECIES[s].phase === "gas");
  if (feedKey) drawGas(ctx, inner, t, feedKey, 8, gasFade.feed, inner.l + 8);
  // produced gas appearing
  const producedGas = prodSpecies.find((s) => SPECIES[s].phase === "gas");
  if (producedGas && state.f > 0.02) {
    drawProduced(ctx, inner, t, producedGas, Math.min(1, state.f));
  }

  /* caption strip */
  ctx.fillStyle = "rgba(8,10,18,.72)";
  roundRect(ctx, JAR_L - 40, 26, 380, 44, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(34,48,79,.9)";
  ctx.stroke();
  ctx.fillStyle = "#d4af37";
  ctx.font = "650 15px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.fillText(state.r.eq, JAR_L - 22, 45);
  ctx.fillStyle = "#8fa1c4";
  ctx.font = "12px -apple-system, 'Hiragino Sans GB', sans-serif";
  ctx.fillText(`${state.r.year} · ${state.r.title}`, JAR_L - 22, 62);

  ctx.restore();
}

function gasOpacity(led) {
  // feed gas fades in proportion to what the reaction has drunk
  const feedKey = state.r.airFeed || Object.keys(state.r.reactants).find((s) => SPECIES[s].phase === "gas");
  let feed = 1;
  if (feedKey && led.n0[feedKey] > 0) {
    const fracLeft = (led.n1[feedKey] || 0) / led.n0[feedKey];
    feed = state.vessel === "open" ? Math.max(0.25, fracLeft) : fracLeft;
  }
  return { feed, n2: state.r.spectators.includes("N2") ? 0.75 : 0 };
}

function drawGas(ctx, box, t, spKey, count, alpha, labelX) {
  if (alpha <= 0.02) return;
  const sp = SPECIES[spKey];
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i++) {
    const px = box.l + 26 + hash01(i, 3) * (box.r - box.l - 52);
    const py = box.t + 26 + hash01(i, 7) * (box.b - box.t - 88);
    const jx = 17 * Math.sin(t * (0.5 + hash01(i, 1) * 0.7) + i * 1.7);
    const jy = 12 * Math.sin(t * (0.6 + hash01(i, 2) * 0.8) + i * 2.3);
    ctx.fillStyle = sp.color;
    circle(ctx, px + jx, py + jy, sp.r - 2);
  }
  ctx.globalAlpha = 1;
  label(ctx, sp.formula, labelX !== undefined ? labelX : box.l + 8, box.t + 16, sp.color);
}

function drawProduced(ctx, box, t, spKey, k) {
  const sp = SPECIES[spKey];
  const count = Math.max(1, Math.round(k * 8));
  ctx.globalAlpha = 0.95;
  for (let i = 0; i < count; i++) {
    const appear = Math.min(1, k * 8 - i);
    if (appear <= 0) break;
    const px = box.l + 40 + hash01(i, 11) * (box.r - box.l - 80);
    const py = box.t + 40 + hash01(i, 13) * (box.b - box.t - 110);
    const jx = 19 * Math.sin(t * (0.55 + hash01(i, 4) * 0.6) + i * 2.9);
    const jy = 13 * Math.cos(t * (0.5 + hash01(i, 5) * 0.7) + i * 1.3);
    ctx.globalAlpha = 0.95 * appear;
    ctx.fillStyle = sp.color;
    circle(ctx, px + jx, py + jy, sp.r - 2);
  }
  ctx.globalAlpha = 1;
  label(ctx, sp.formula, box.r - 46, box.b - 96, sp.color);
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
}
function label(ctx, text, x, y, color) {
  ctx.fillStyle = color;
  ctx.font = "600 12px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.fillText(text, x, y);
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

/* ---------- master render ---------- */
function render() {
  const led = buildLedger(state.r, state.masses, state.airL, state.vessel, state.f);
  $("ro-weighed").textContent = fmtG(led.weighedAfter);
  $("ro-total").textContent = fmtG(led.totalAfter);
  $("ro-pressure").textContent =
    state.vessel === "sealed" ? fmtX(led.pressure) : "通大气";
  $("ro-extent").textContent = `${(state.f * 100).toFixed(1)} %`;
  renderLedger(led);
  renderCourt(led);
  renderLog(led);
  drawBench(led);
  if (state.tab === "chart") drawChart(led);
  $("tab-note").textContent =
    state.tab === "chart"
      ? "金线永远水平——密封系统的总质量是不变量；蓝线是同一反应在敞口坩埚里的秤盘读数。"
      : state.tab === "court"
      ? "把 1770 年代的理论押上 2026 年的天平。"
      : "每一行都可以在物理引擎里复算。";
}

/* ---------- tick ---------- */
function tick(dt) {
  state.t += dt;
  if (state.flame && state.f < 1) {
    state.f = Math.min(1, state.f + dt * HEAT_RATE);
    $("extent-range").value = state.f;
    $("extent-out").textContent = `${(state.f * 100).toFixed(1)} %`;
    render();
  } else {
    render();
  }
}

let lastTs = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  tick(dt);
  requestAnimationFrame(loop);
}

/* ---------- wiring ---------- */
function initUI() {
  const presets = $("presets");
  for (const r of REACTIONS) {
    const b = document.createElement("button");
    b.dataset.id = r.id;
    b.innerHTML = `<small>${r.year}</small>${r.title}<small>${r.eq}</small>`;
    b.addEventListener("click", () => loadScenario(r.id));
    presets.appendChild(b);
  }

  document.querySelectorAll("#vessel-pick button").forEach((b) =>
    b.addEventListener("click", () => setVessel(b.dataset.vessel))
  );
  $("sample-range").addEventListener("input", (e) =>
    setSample(parseFloat(e.target.value))
  );
  $("air-range").addEventListener("input", (e) =>
    setAirVolume(parseFloat(e.target.value))
  );
  $("extent-range").addEventListener("input", (e) =>
    setExtent(parseFloat(e.target.value))
  );
  $("flame-btn").addEventListener("click", () => setFlame(!state.flame));
  $("reset-btn").addEventListener("click", () => {
    state.f = 0;
    state.flame = false;
    syncControls();
    render();
  });
  document.querySelectorAll("#tabs button").forEach((b) =>
    b.addEventListener("click", () => setTab(b.dataset.tab))
  );

  loadScenario("tin");
  requestAnimationFrame(loop);
}

function setVessel(v) {
  if (state.r.sealedOnly && v === "open") return;
  state.vessel = v;
  syncControls();
  render();
}
function setSample(g) {
  state.masses[state.r.sampleKey] = g;
  $("sample-out").textContent = fmtG(g);
  render();
}
function setAirVolume(L) {
  state.airL = L;
  $("air-out").textContent = `${L.toFixed(2)} L`;
  render();
}
function setExtent(f) {
  state.f = Math.max(0, Math.min(1, f));
  $("extent-range").value = state.f;
  $("extent-out").textContent = `${(state.f * 100).toFixed(1)} %`;
  render();
}
function setFlame(on) {
  state.flame = !!on;
  syncControls();
  render();
}
function setTab(id) {
  state.tab = id;
  document.querySelectorAll("#tabs button").forEach((b) =>
    b.classList.toggle("on", b.dataset.tab === id)
  );
  for (const t of ["chart", "court", "log"]) {
    $(`tab-${t}`).classList.toggle("hidden", t !== id);
  }
  render();
}

initUI();

/* ---------- deterministic demo API for video capture ---------- */
window.__demo = {
  loadScenario,
  setVessel,
  setSample,
  setAirVolume,
  setExtent,
  setFlame,
  setTab,
  step(dt) {
    tick(Math.min(0.5, Math.max(0, dt)));
  },
  snapshot() {
    const led = buildLedger(state.r, state.masses, state.airL, state.vessel, state.f);
    return {
      reaction: state.r.id,
      vessel: state.vessel,
      f: state.f,
      weighed: led.weighedAfter,
      totalBefore: led.totalBefore,
      totalAfter: led.totalAfter,
      drift: led.drift,
      pressure: led.pressure,
      deltaOpen: led.weighedDelta,
    };
  },
};
