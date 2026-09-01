// app.js — Eleven Days studio, the living almanac.
// Everything displayed is computed live from cal.js at render time; no date
// string in this file is hardcoded (the tests pin the engine, the engine
// paints the page).

import {
  WEEKDAYS, WEEKDAYS_ZH, MONTHS_EN, MONTHS_ZH,
  serialGregorian, serialJulian, civilGregorian, civilJulian,
  weekdayOfSerial, weekdayGregorian, weekdayJulian,
  julianToGregorian, gapClosedForm, gapAtSerial,
  isLeapJulian, isLeapGregorian, zellerGregorian,
  anchorDay, doomsdayOfYear, oddPlus11, DOOMSDAY_DATES, weekdayByDoomsday,
  goldenNumber, easterGregorian, easterJulian,
  equinoxJulianLabel, julianDriftPerYear, gregorianDriftPerYear,
  metonicGapHours, ADOPTIONS, FOSSILS, PRESETS, september1752,
} from "./cal.js";

const $ = (id) => document.getElementById(id);
const zhDow = (w) => WEEKDAYS_ZH[w];
const fmtCn = (c) => `${c.y} 年 ${c.m} 月 ${c.d} 日`;
const fmtMD = (c) => `${c.m} 月 ${c.d} 日`;

// ── tabs & presets ──────────────────────────────────────────────────────────
function gotoTab(name) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.id === `tab-${name}`));
  if (name === "drift") requestAnimationFrame(drawDriftChart);
  if (name === "computus") requestAnimationFrame(drawMoonWheel);
  if (history.replaceState) history.replaceState(null, "", `#${name}`);
}
document.querySelectorAll(".tabs button").forEach((b) =>
  b.addEventListener("click", () => gotoTab(b.dataset.tab)));

for (const p of PRESETS) {
  const btn = document.createElement("button");
  btn.textContent = p.label;
  btn.addEventListener("click", () => {
    gotoTab(p.tab);
    if (p.id === "jump") resetWall();
    if (p.id === "drift") { $("drift-year").value = 1582; updateDrift(); }
    if (p.id === "doomsday") { setDate(2026, 9, 2); }
    if (p.id === "computus") { setEasterYear(2026); }
  });
  $("presets").appendChild(btn);
}

// ── tab 1 · the night itself ────────────────────────────────────────────────
const S2 = serialJulian(1752, 9, 2);        // Wednesday, the last Julian day
const S14 = serialGregorian(1752, 9, 14);   // Thursday, the first Gregorian day

function showSheet(serial) {
  const julianSide = serial <= S2;
  const c = julianSide ? civilJulian(serial) : civilGregorian(serial);
  $("sheet-month").textContent = `${MONTHS_EN[c.m - 1]} · ${c.y} · ${julianSide ? "儒略旧历" : "格里新历"}`;
  $("sheet-dow").textContent = zhDow(weekdayOfSerial(serial));
  $("sheet-day").textContent = c.d;
  $("sheet-note").textContent = serial === S2 ? "大不列颠 · 儒略历的最后一日"
    : serial === S14 ? "大不列颠 · 格里历的第一日 —— 十一个日期之后"
    : "被删去的日期 —— 从未存在";
}

let wallBusy = false;
let VIDEO_MODE = false;
function nextMorning() {
  if (wallBusy) return;
  const cur = $("sheet-day").textContent === "2" ? S2 : null;
  if (cur === null && $("sheet-day").textContent !== "2") { // already at 14 → replay
    resetWall(); return;
  }
  wallBusy = true;
  $("btn-morning").disabled = true;
  const stack = $("ghost-stack");
  stack.innerHTML = "";
  const base = VIDEO_MODE ? 320 : 240;
  const step = VIDEO_MODE ? 135 : 90;
  // eleven ghost pages, 3 … 13, flutter off in one gust
  for (let i = 3; i <= 13; i += 1) {
    const g = document.createElement("div");
    g.className = "ghostpage";
    g.innerHTML = `<div>九月 ${i} 日</div><div class="never">从未印出</div>`;
    stack.appendChild(g);
    const delay = (i - 3) * step;
    setTimeout(() => g.classList.add("fly"), base + delay);
  }
  const total = base + 11 * step + 750;
  setTimeout(() => {
    showSheet(S14);
    $("torn-count").textContent = "已撕 11 页 · 星期只前进 1 天";
    $("btn-morning").textContent = "回到 9 月 2 日";
    $("btn-morning").disabled = false;
    wallBusy = false;
  }, total);
}
function resetWall() {
  if (wallBusy) return;
  $("ghost-stack").innerHTML = "";
  showSheet(S2);
  $("torn-count").textContent = "已撕 0 页";
  $("btn-morning").textContent = "次日凌晨 —— 翻页";
}
$("btn-morning").addEventListener("click", nextMorning);
$("btn-reset").addEventListener("click", resetWall);
resetWall();

// the printed month
function renderSeptember() {
  const grid = $("sep1752");
  grid.innerHTML = "";
  const heads = ["日", "一", "二", "三", "四", "五", "六"];
  for (const h of heads) {
    const el = document.createElement("div");
    el.className = "hd" + (h === "日" ? " sun" : "");
    el.textContent = h;
    grid.appendChild(el);
  }
  const first = september1752()[0]; // Julian 1 September 1752, a Tuesday
  for (let i = 0; i < weekdayOfSerial(first); i += 1) {
    grid.appendChild(Object.assign(document.createElement("div"), { className: "cell empty" }));
  }
  for (const s of september1752()) {
    const cell = document.createElement("div");
    const w = weekdayOfSerial(s);
    if (s <= S2) {
      const c = civilJulian(s);
      cell.className = "cell" + (w === 0 ? " sun" : "") + (s === S2 ? " last-j" : "");
      cell.innerHTML = `${c.d}<span class="wk">儒略</span>`;
    } else if (s >= S14) {
      const c = civilGregorian(s);
      cell.className = "cell" + (w === 0 ? " sun" : "") + (s === S14 ? " first-g" : "");
      cell.innerHTML = `${c.d}<span class="wk">&nbsp;</span>`;
    } else {
      cell.className = "cell hole";
      cell.innerHTML = "&nbsp;";
    }
    grid.appendChild(cell);
  }
}
renderSeptember();

// today, 274 years on
(function todayLine() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
  const s = serialGregorian(y, m, d);
  const jl = civilJulian(s);
  const gap = gapAtSerial(s);
  const yrs = y - 1752;
  $("today-line").innerHTML =
    `${yrs} 年后的今天，${fmtCn({ y, m, d })}，${zhDow(weekdayOfSerial(s))} —— ` +
    `与 1752 年 9 月 2 日同为星期三的巧合${weekdayOfSerial(s) === 3 ? "正在发生" : "已过去"}。` +
    `儒略历把今天叫作 ${fmtCn(jl)}：两历相差 ${gap} 天。`;
})();

// ── tab 2 · the drift ───────────────────────────────────────────────────────
function drawDriftChart() {
  const cv = $("drift-chart");
  const W = 640, H = 340;
  const dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  const mL = 52, mR = 16, mT = 30, mB = 34;
  const X = (yr) => mL + ((yr - 250) / (3000 - 250)) * (W - mL - mR);
  // y: day of March, from 25 (top) to 5 (bottom) → equinox slides downward
  const Y = (marDay) => mT + ((25 - marDay) / 20) * (H - mT - mB);

  ctx.font = "12px Georgia, serif";
  ctx.fillStyle = "#5a4a30";
  ctx.strokeStyle = "#b9a679";
  ctx.lineWidth = 1;
  ctx.textAlign = "right";
  for (const md of [25, 20, 15, 10, 5]) {
    ctx.beginPath(); ctx.moveTo(mL, Y(md)); ctx.lineTo(W - mR, Y(md)); ctx.stroke();
    ctx.fillText(`3/${md}`, mL - 6, Y(md) + 4);
  }
  ctx.textAlign = "center";
  for (const yr of [325, 1000, 1582, 1752, 2100, 2600, 3000]) {
    ctx.fillText(String(yr), Math.max(mL + 12, X(yr)), H - 12);
  }
  ctx.textAlign = "left";

  // Julian unreformed: 21 March at Nicaea, sliding 0.0078 d/yr
  ctx.strokeStyle = "#1f4f6d"; ctx.lineWidth = 2.2; ctx.setLineDash([]);
  ctx.beginPath();
  for (let yr = 250; yr <= 3000; yr += 2) {
    const yv = equinoxJulianLabel(yr);
    if (yr === 250) ctx.moveTo(X(yr), Y(yv)); else ctx.lineTo(X(yr), Y(yv));
  }
  ctx.stroke();

  // the actual civil calendar: Julian until 1582, then the Gregorian reset
  ctx.strokeStyle = "#a3282a"; ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let yr = 250; yr <= 1582; yr += 2) {
    const yv = equinoxJulianLabel(yr);
    if (yr === 250) ctx.moveTo(X(yr), Y(yv)); else ctx.lineTo(X(yr), Y(yv));
  }
  ctx.stroke();
  ctx.beginPath();
  for (let yr = 1583; yr <= 3000; yr += 2) {
    const yv = 21 - (yr - 1583) * 0.0003;
    if (yr === 1583) ctx.moveTo(X(yr), Y(yv)); else ctx.lineTo(X(yr), Y(yv));
  }
  ctx.stroke();

  // the +10 day jump of 1582
  ctx.strokeStyle = "#a3282a"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(X(1582), Y(equinoxJulianLabel(1582)));
  ctx.lineTo(X(1583), Y(21));
  ctx.stroke();
  ctx.setLineDash([]);

  // markers, labels staggered horizontally under the top edge
  const marks = [[325, "尼西亚"], [1582, "格里高利"], [1752, "英国"], [2026, "今天"]];
  marks.forEach(([yr, label], i) => {
    ctx.strokeStyle = "rgba(43,33,19,0.35)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(yr), mT); ctx.lineTo(X(yr), H - mB); ctx.stroke();
    ctx.fillStyle = "#2b2113"; ctx.font = "bold 11.5px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(label, Math.max(mL + 22, X(yr)), mT - 18 + (i % 2) * 13);
  });
  ctx.textAlign = "left";

  // legend, boxed in the lower right where the lines have flattened out
  const lgX = W - mR - 190, lgY = H - mB - 74;
  ctx.fillStyle = "rgba(241,232,210,0.85)";
  ctx.strokeStyle = "#b9a679";
  ctx.fillRect(lgX, lgY, 176, 52); ctx.strokeRect(lgX, lgY, 176, 52);
  ctx.font = "12.5px Georgia, serif";
  ctx.fillStyle = "#1f4f6d"; ctx.fillText("—— 不改革（儒略标签）", lgX + 10, lgY + 20);
  ctx.fillStyle = "#a3282a"; ctx.fillText("—— 实际民用历", lgX + 10, lgY + 38);
}

function updateDrift() {
  const y = +$("drift-year").value;
  $("drift-year-out").textContent = y;
  const gap = y >= 300 ? gapClosedForm(y) : 0;
  $("d-gap").textContent = y >= 300 ? gap : "—";
  const eq = equinoxJulianLabel(y);
  const eqShown = eq < 1 ? `2 月 ${(28 + eq).toFixed(1)} 日` : `3 月 ${eq.toFixed(1)} 日`;
  $("d-equij").textContent = eqShown;
  const jl = isLeapJulian(y), gl = isLeapGregorian(y);
  $("d-leap").textContent = jl && gl ? "双闰" : jl ? "儒略闰·格里平" : gl ? "格里闰·儒略平" : "双平";
  const jlLabel = civilJulian(serialGregorian(y, 3, 21));
  $("d-readout").innerHTML =
    `<b>${y} 年</b>：格里历的 3 月 21 日，儒略历记作 <b>${fmtMD(jlLabel)}</b>（差 ${y >= 300 ? gap : "—"} 天）。` +
    `若没有 1582 年的手术，春分此刻已滑到儒略历的 <b>${eqShown}</b> —— 每年 ${ (julianDriftPerYear * 1440).toFixed(1) } 分钟，` +
    `每 ${Math.round(1 / julianDriftPerYear)} 年偷走一天；格里历把这个速度放慢到每 ${Math.round(1 / gregorianDriftPerYear)} 年一天。`;
}
$("drift-year").addEventListener("input", updateDrift);
window.addEventListener("resize", () => {
  if (document.getElementById("tab-drift").classList.contains("on")) drawDriftChart();
  if (document.getElementById("tab-computus").classList.contains("on")) drawMoonWheel();
});
updateDrift();

// ── tab 3 · doomsday ────────────────────────────────────────────────────────
let ddY = 1752, ddM = 9, ddD = 14;
function daysInMonth(y, m) {
  return civilGregorian(serialGregorian(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - 1).d;
}
function setDate(y, m, d) {
  ddY = y; ddM = m; ddD = Math.min(d, daysInMonth(y, m));
  $("dd-year").value = ddY; $("dd-month").value = ddM; $("dd-day").value = ddD;
  renderDoomsday();
}
function renderDoomsday() {
  ddY = +$("dd-year").value || ddY; ddM = Math.max(1, Math.min(12, +$("dd-month").value || ddM));
  ddD = Math.max(1, Math.min(daysInMonth(ddY, ddM), +$("dd-day").value || ddD));
  $("dd-year").value = ddY; $("dd-month").value = ddM; $("dd-day").value = ddD;

  const w = weekdayGregorian(ddY, ddM, ddD);
  $("dd-result").textContent = `${fmtCn({ y: ddY, m: ddM, d: ddD })} 是 ${zhDow(w)}（${WEEKDAYS[w]}）`;

  const anchor = anchorDay(ddY);
  const yy = ddY % 100;
  const doom = doomsdayOfYear(ddY);
  const mnemonic = DOOMSDAY_DATES.find((x) => x.m === ddM);
  const leap = isLeapGregorian(ddY);
  const anchorD = leap ? mnemonic.leapD : mnemonic.d;
  const off = ((ddD - anchorD) % 7 + 7) % 7;
  const z = zellerGregorian(ddY, ddM, ddD);
  const okSerial = weekdayByDoomsday(ddY, ddM, ddD) === w && z === w;

  $("dd-steps").innerHTML = [
    `<div class="step"><span class="no">1</span><span>世纪锚日：c = ⌊${ddY}/100⌋ = ${Math.floor(ddY / 100)}，<b>(5(c mod 4)+2) mod 7 = ${anchor}</b> → <b>${zhDow(anchor)}</b>（1800s 周五 · 1900s 周三 · 2000s 周二 · 2100s 周日）</span></div>`,
    `<div class="step"><span class="no">2</span><span>年份后两位：${yy} + ⌊${yy}/4⌋ = ${yy} + ${Math.floor(yy / 4)} = ${yy + Math.floor(yy / 4)}，加到锚日上（mod 7）→ 今年的「末日」是 <b>${zhDow(doom)}</b></span></div>`,
    `<div class="step"><span class="no">3</span><span>Odd+11 捷径：${yy}${yy % 2 ? " → +11" : "（偶）"} → ⌊÷2⌋ → ${Math.floor((yy % 2 ? yy + 11 : yy) / 2)}${Math.floor((yy % 2 ? yy + 11 : yy) / 2) % 2 ? " → +11" : ""} → mod 7 = ${oddPlus11(ddY)}，锚日 + 7 − ${oddPlus11(ddY)} = ${zhDow(doom)} ✓</span></div>`,
    `<div class="step"><span class="no">4</span><span>本月锚点 ${mnemonic.label}（${zhDow(doom)}），${ddM} 月 ${ddD} 日沿星期轮与它相差 ${off} 格（mod 7）→ ${zhDow(doom)} + ${off} = <b>${zhDow(w)}</b></span></div>`,
    `<div class="step"><span class="no">✓</span><span>三台引擎对照：序列日 ✓ · Zeller ${z === w ? "✓" : "✗"} · doomsday ${weekdayByDoomsday(ddY, ddM, ddD) === w ? "✓" : "✗"} ${okSerial ? "—— 全部一致" : ""}</span></div>`,
  ].join("");

  // the mnemonic table, live for the chosen year
  const grid = $("doomsgrid");
  grid.innerHTML = "";
  for (const dd of DOOMSDAY_DATES) {
    const el = document.createElement("div");
    el.className = "dcell";
    el.innerHTML = `${dd.label}<span class="sub">${zhDow(doom)}</span>`;
    grid.appendChild(el);
  }
}
["dd-year", "dd-month", "dd-day"].forEach((id) => $(id).addEventListener("input", renderDoomsday));
$("dd-random").addEventListener("click", () => {
  const y = 1583 + Math.floor(Math.random() * (2400 - 1583 + 1));
  const m = 1 + Math.floor(Math.random() * 12);
  setDate(y, m, 1 + Math.floor(Math.random() * daysInMonth(y, m)));
});

// quiz
let quizStreak = 0, quizTotal = 0, quizActive = null;
function newQuiz() {
  const y = 1583 + Math.floor(Math.random() * (2400 - 1583 + 1));
  const m = 1 + Math.floor(Math.random() * 12);
  const d = 1 + Math.floor(Math.random() * daysInMonth(y, m));
  quizActive = { y, m, d };
  $("quiz-q").dataset.truth = weekdayGregorian(y, m, d);
  $("quiz-q").innerHTML = `<b>${y} 年 ${m} 月 ${d} 日</b> 是星期几？`;
  const box = $("quiz-choices");
  box.innerHTML = "";
  for (let i = 0; i < 7; i += 1) {
    const b = document.createElement("button");
    b.textContent = zhDow(i);
    b.addEventListener("click", () => answerQuiz(i, b));
    box.appendChild(b);
  }
  $("quiz-score").textContent = `连对 ${quizStreak} · 共答 ${quizTotal}`;
}
function answerQuiz(pick, btn) {
  if (!quizActive) return;
  const truth = weekdayGregorian(quizActive.y, quizActive.m, quizActive.d);
  quizTotal += 1;
  const right = pick === truth;
  quizStreak = right ? quizStreak + 1 : 0;
  for (const b of $("quiz-choices").children) {
    b.disabled = true;
    const i = [...$("quiz-choices").children].indexOf(b);
    if (i === truth) b.classList.add("right");
    else if (i === pick && !right) b.classList.add("wrong");
  }
  const doom = doomsdayOfYear(quizActive.y);
  $("quiz-q").innerHTML =
    `<b>${quizActive.y} 年 ${quizActive.m} 月 ${quizActive.d} 日</b> 是${right ? "——答对了，" : "——"}<b>${zhDow(truth)}</b>` +
    `<div class="quiz-explain">末日法：${quizActive.y} 的末日是 ${zhDow(doom)}；${quizActive.m} 月 ${quizActive.d} 日与本月锚点差 ` +
    `${((quizActive.d - (isLeapGregorian(quizActive.y) ? DOOMSDAY_DATES[quizActive.m - 1].leapD : DOOMSDAY_DATES[quizActive.m - 1].d)) % 7 + 7) % 7} 天。</div>`;
  $("quiz-score").textContent = `连对 ${quizStreak} · 共答 ${quizTotal}`;
  const again = document.createElement("button");
  again.textContent = "再出一题";
  again.className = "ink-btn ghost";
  again.addEventListener("click", newQuiz);
  $("quiz-choices").appendChild(again);
  quizActive = null;
}
newQuiz();
setDate(2026, 9, 2);

// ── tab 4 · computus ────────────────────────────────────────────────────────
let ecYear = 2026;
function setEasterYear(y) { ecYear = Math.min(9999, Math.max(1583, y)); $("ec-year").textContent = ecYear; renderComputus(); }
$("ec-minus").addEventListener("click", () => setEasterYear(ecYear - 1));
$("ec-plus").addEventListener("click", () => setEasterYear(ecYear + 1));

function renderComputus() {
  const y = ecYear;
  const g = goldenNumber(y);
  const w = easterGregorian(y);
  const je = easterJulian(y);
  const jg = julianToGregorian(je.y, je.m, je.d);
  const pfmG = julianToGregorian(je.pfm.y, je.pfm.m, je.pfm.d);

  $("ec-golden").textContent = `黄金数 ${g} · 默冬轮第 ${g} 格`;
  $("ec-west").textContent = `${fmtMD(w)} · ${zhDow(0)}`;
  $("ec-west-sub").textContent = `Meeus 匿名算法（即教会表）；窗口 3 月 22 – 4 月 25 内第 ${w.m === 3 ? w.d - 21 : w.d + 10} 天`;
  $("ec-east").textContent = `${fmtMD(jg)} · ${zhDow(0)}`;
  $("ec-east-sub").textContent = `儒略齿轮：教会满月 ${fmtMD(je.pfm)}（儒略）= 民用历 ${fmtMD(pfmG)}，其后的第一个星期日`;

  const sW = serialGregorian(w.y, w.m, w.d);
  const sE = serialJulian(je.y, je.m, je.d);
  const weeks = Math.round((sE - sW) / 7);
  $("ec-remark").innerHTML = weeks === 0
    ? `今年两套齿轮咬合在同一天：<b>${fmtMD(w)}</b> —— 东西教会同年庆复活节。`
    : `今年相差 <b>${weeks} 周</b>（东方晚）。差距 = ${gapClosedForm(y)} 天历差 + 月轮相位，再对齐到星期日。`;

  // comparison table 2018–2034
  const rows = [];
  for (let yy = 2018; yy <= 2034; yy += 1) {
    const a = easterGregorian(yy);
    const b = easterJulian(yy);
    const bg = julianToGregorian(b.y, b.m, b.d);
    const wk = Math.round((serialJulian(b.y, b.m, b.d) - serialGregorian(a.y, a.m, a.d)) / 7);
    rows.push(`<tr><td class="y">${yy}</td><td>${fmtMD(a)}</td><td>${fmtMD(bg)}</td>` +
      `<td class="${wk === 0 ? "same" : ""}">${wk === 0 ? "同日 ✦" : `+${wk} 周`}</td></tr>`);
  }
  $("etable").innerHTML =
    "<tr><th>年份</th><th>西方</th><th>东方（民用历）</th><th>差</th></tr>" + rows.join("");
  drawMoonWheel();
}

function drawMoonWheel() {
  const cv = $("moon-wheel");
  const W = 460, H = 300;
  const dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 26;
  const g = goldenNumber(ecYear);

  for (let i = 0; i < 19; i += 1) {
    const a0 = (i / 19) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / 19) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, a0, a1);
    ctx.closePath();
    ctx.fillStyle = i === g - 1 ? "rgba(163,40,42,0.28)" : "rgba(185,166,121,0.16)";
    ctx.fill();
    ctx.strokeStyle = "#b9a679";
    ctx.stroke();
    const am = (a0 + a1) / 2;
    ctx.fillStyle = i === g - 1 ? "#7e1f21" : "#5a4a30";
    ctx.font = i === g - 1 ? "bold 15px Georgia, serif" : "13px Georgia, serif";
    ctx.fillText(String(i + 1), cx + Math.cos(am) * (R - 18) - 5, cy + Math.sin(am) * (R - 18) + 5);
  }
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,252,243,0.9)"; ctx.fill();
  ctx.strokeStyle = "#b9a679"; ctx.stroke();
  ctx.fillStyle = "#2b2113"; ctx.textAlign = "center";
  ctx.font = "14px Georgia, serif";
  ctx.fillText("235 个朔望月", cx, cy - 12);
  ctx.fillText("≈ 19 个回归年", cx, cy + 8);
  ctx.fillStyle = "#7e1f21";
  ctx.fillText(`差 ${metonicGapHours.toFixed(2)} 小时/轮`, cx, cy + 30);
  ctx.textAlign = "start";
}
setEasterYear(2026);

// ── tab 5 · fossils ─────────────────────────────────────────────────────────
(function renderTimeline() {
  const tl = $("timeline");
  const Y0 = 1570, Y1 = 1935;
  ADOPTIONS.forEach((a, i) => {
    const pin = document.createElement("div");
    pin.className = "pin";
    pin.style.left = `${((a.y - Y0) / (Y1 - Y0)) * 100}%`;
    pin.style.setProperty("--h", `${38 + (i % 4) * 14}px`);
    pin.innerHTML = `<span class="who">${a.who}</span><span class="stem" style="height:var(--h)"></span><span class="head"></span>`;
    pin.addEventListener("click", () => showJump(a, pin));
    tl.appendChild(pin);
  });
  for (const yr of [1600, 1700, 1800, 1900]) {
    const el = document.createElement("div");
    el.className = "tl-year";
    el.style.left = `${((yr - Y0) / (Y1 - Y0)) * 100}%`;
    el.textContent = yr;
    tl.appendChild(el);
  }
})();

function showJump(a, pin) {
  document.querySelectorAll(".pin").forEach((p) => p.classList.remove("on"));
  pin.classList.add("on");
  const sOld = serialJulian(a.old.y, a.old.m, a.old.d);
  const sNew = serialGregorian(a.newG.y, a.newG.m, a.newG.d);
  let dates;
  if (a.en === "Russian Alaska") {
    dates = `<span class="to">同一夜两套标签</span>：周五 ${a.old.y} 年 ${a.old.m} 月 ${a.old.d} 日（儒略）＝ 周五 ${a.newG.y} 年 ${a.newG.m} 月 ${a.newG.d} 日（格里）`;
  } else if (a.en === "Japan") {
    dates = `${a.old.y} 年 ${a.old.m} 月 ${a.old.d} 日 → <span class="to">${a.newG.y} 年 ${a.newG.m} 月 ${a.newG.d} 日</span>（抹去 29 天）`;
  } else {
    const skipped = sNew - sOld - 1;
    dates = `${zhDow(weekdayOfSerial(sOld))} ${a.old.y} 年 ${a.old.m} 月 ${a.old.d} 日 → ` +
      `<span class="to">${zhDow(weekdayOfSerial(sNew))} ${a.newG.y} 年 ${a.newG.m} 月 ${a.newG.d} 日</span> · 跳过 ${skipped} 天`;
  }
  $("jumpcard").innerHTML = `<div class="j-who">${a.who}<div class="dim" style="font-size:13px;font-weight:400">${a.en} · ${a.y}</div></div>` +
    `<div class="j-dates">${dates}</div><div class="j-note">${a.note}</div>`;
  $("jumpcard").classList.add("show");
}

(function renderFossils() {
  const box = $("fossils");
  for (const f of FOSSILS) {
    const el = document.createElement("div");
    el.className = "fossil";
    el.innerHTML = `<div class="f-head"><span class="f-icon">${f.icon}</span><span class="f-title">${f.title}</span></div><p>${f.body}</p>`;
    box.appendChild(el);
  }
})();

// start on the star of the show — or wherever the #hash points
window.addEventListener("hashchange", () => {
  const h = location.hash.slice(1);
  if (document.getElementById(`tab-${h}`)) gotoTab(h);
});
if (location.hash && document.getElementById(`tab-${location.hash.slice(1)}`)) gotoTab(location.hash.slice(1));
else gotoTab("jump");

// ── video-control API (headless narration drives the studio) ────────────────
window.__demo = {
  setTab: gotoTab,
  setVideoMode(on) {
    VIDEO_MODE = !!on;
    document.getElementById("video-mode-style")?.remove();
    if (on) {
      const style = document.createElement("style");
      style.id = "video-mode-style";
      style.textContent = ".ghostpage.fly { animation-duration: 1.55s; }";
      document.head.appendChild(style);
    }
  },
  resetWall,
  tear: nextMorning,
  setDriftYear(y) { $("drift-year").value = y; updateDrift(); },
  setDate,
  setEasterYear,
  quizNew: newQuiz,
  quizSolve() { // answer the live quiz correctly
    const kids = [...$("quiz-choices").children];
    const truth = Number($("quiz-q").dataset.truth);
    const pick = kids.findIndex((b) => WEEKDAYS_ZH.indexOf(b.textContent) === truth);
    if (pick >= 0 && !kids[pick].disabled) kids[pick].click();
  },
  selectAdoption(i) { document.querySelectorAll(".timeline .pin")[i]?.click(); },
  scrollToTop() { window.scrollTo(0, 0); },
};
