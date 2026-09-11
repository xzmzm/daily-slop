/* ==========================================================================
   app.js — Kilby's Germanium Bar (1958) studio glue.
   All physics lives in kilby.js; this file renders and animates it.
   ========================================================================== */

import {
  tyrannyStats, transistorsPerChip, chipPlan, MOORE_ANCHORS, MILESTONES,
  oscFrequency, linearLoopDynamics, CRITICAL_GAIN,
  barResistance, junctionCapacitance, depletionWidth,
} from './kilby.js';

const $ = (sel) => document.querySelector(sel);
const fmt = (n, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ------------------------------------------------------------------ tabs */
for (const btn of document.querySelectorAll('.nav-tab')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === btn.dataset.tab));
  });
}
function switchTab(id) {
  $(`.nav-tab[data-tab="${id}"]`).click();
}

/* ------------------------------------------------------------------ audio */
const audio = { ctx: null, osc: null, gain: null, on: true };
function audioTick(freq, level) {
  if (!audio.on || !audio.ctx || freq == null || !isFinite(freq)) return;
  if (!audio.osc) {
    audio.osc = audio.ctx.createOscillator();
    audio.gain = audio.ctx.createGain();
    audio.gain.gain.value = 0;
    audio.osc.connect(audio.gain).connect(audio.ctx.destination);
    audio.osc.start();
  }
  audio.osc.frequency.setTargetAtTime(clamp(freq, 40, 3000), audio.ctx.currentTime, 0.03);
  audio.gain.gain.setTargetAtTime(0.055 * clamp(level, 0, 1), audio.ctx.currentTime, 0.05);
}
function ensureAudio() {
  if (!audio.ctx) {
    try { audio.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* headless */ }
  }
  if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
}
$('#soundToggleBtn').addEventListener('click', () => {
  audio.on = !audio.on;
  $('#soundIcon').textContent = audio.on ? '🔊' : '🔇';
  $('#soundStatus').textContent = audio.on ? 'AUDIO: ON' : 'AUDIO: OFF';
  if (audio.on) ensureAudio();
  if (audio.gain && !audio.on) audio.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.02);
});

/* =====================================================================
   TAB 1 — TYRANNY OF NUMBERS
   ===================================================================== */
const tyranny = {
  gates: 1400, mode: 'discrete', year: 1966,
  progress: 1, lastStats: null, lastChipPlan: null,
};

const gatesSlider = $('#gatesSlider');
function gatesFromSlider(v) { return Math.max(1, Math.round(Math.exp((v / 1000) * Math.log(1e6)))); }
function sliderFromGates(g) { return Math.round((Math.log(g) / Math.log(1e6)) * 1000); }

function tyrannyUpdate() {
  const stats = tyrannyStats(tyranny.gates);
  tyranny.lastStats = stats;
  let plan = null;
  if (tyranny.mode === 'mono') {
    plan = chipPlan(tyranny.gates * 4, tyranny.year);
    tyranny.lastChipPlan = plan;
  }
  tyranny.progress = 0; // restart fill animation

  const mono = tyranny.mode === 'mono';
  $('#boardTitle').textContent = mono
    ? `ASSEMBLY BOARD — IC ${tyranny.year}` : 'ASSEMBLY BOARD — DISCRETE 1958';
  $('#statParts').previousElementSibling.textContent = mono ? 'ICs to place' : 'Parts to place';

  $('#gatesReadout').textContent = fmt(tyranny.gates);
  $('#yearReadout').textContent = tyranny.year;
  $('#perChipReadout').textContent = `≈ ${fmt(Math.round(transistorsPerChip(tyranny.year)))} transistors per chip`;

  if (mono) {
    $('#statParts').textContent = fmt(plan.chips);
    $('#statJoints').textContent = fmt(plan.joints);
    $('#statWires').textContent = fmt(plan.joints);
    $('#statArea').textContent = `${fmt(plan.chips * 0.12, 1)} in²`;
    $('#statAssembly').textContent = `${fmt(plan.joints * 30 / 3600, 1)} h`;
    const days = plan.mtbfHours / 24;
    $('#statMtbf').textContent = days > 3650 ? `${fmt(plan.mtbfHours / 8760)} yr` : `${fmt(days, 1)} d`;
    $('#statFootnote').textContent = 'Internal connections are free — made by the same process that makes the parts. You solder pins, not circuits.';
  } else {
    $('#statParts').textContent = fmt(stats.parts);
    $('#statJoints').textContent = fmt(stats.joints);
    $('#statWires').textContent = fmt(stats.wires);
    $('#statArea').textContent = `${fmt(stats.boardAreaIn2)} in²`;
    const days = stats.assemblyPersonDays;
    $('#statAssembly').textContent = days > 400 ? `${fmt(days / 250, 1)} person-yr` : `${fmt(days, 1)} person-d`;
    const mtbfD = stats.mtbfDays;
    $('#statMtbf').textContent = mtbfD > 3650 ? `${fmt(stats.mtbfHours / 8760)} yr` : `${fmt(mtbfD, 1)} d`;
    $('#statFootnote').textContent = 'Series reliability: MTBF = 1/(N·λ). Every joint is a chance to fail.';
  }
}

gatesSlider.addEventListener('input', () => { tyranny.gates = gatesFromSlider(+gatesSlider.value); tyrannyUpdate(); });
$('#yearSlider').addEventListener('input', (e) => { tyranny.year = +e.target.value; tyrannyUpdate(); });
$('#modeDiscrete').addEventListener('click', () => setTyrannyMode('discrete'));
$('#modeMono').addEventListener('click', () => setTyrannyMode('mono'));
function setTyrannyMode(mode) {
  tyranny.mode = mode;
  $('#modeDiscrete').classList.toggle('active', mode === 'discrete');
  $('#modeMono').classList.toggle('active', mode === 'mono');
  $('#yearBlock').classList.toggle('hidden', mode !== 'mono');
  tyrannyUpdate();
}
for (const btn of document.querySelectorAll('.btn-preset')) {
  btn.addEventListener('click', () => {
    tyranny.gates = +btn.dataset.gates;
    tyranny.year = +btn.dataset.year;
    gatesSlider.value = sliderFromGates(tyranny.gates);
    $('#yearSlider').value = tyranny.year;
    setTyrannyMode(+btn.dataset.year >= 1958 && btn.dataset.gates > 100 ? 'mono' : tyranny.mode);
    tyrannyUpdate();
  });
}

/* --- board drawing ------------------------------------------------ */
const boardCanvas = $('#tyrannyBoard');
const bctx = boardCanvas.getContext('2d');

function drawDiscreteGlyph(ctx, x, y, kind, s) {
  ctx.strokeStyle = 'rgba(236, 229, 211, 0.75)';
  ctx.lineWidth = 1;
  if (kind === 0) { // resistor: zigzag
    ctx.strokeRect(x, y + s * 0.35, s, s * 0.3);
    ctx.beginPath();
    ctx.moveTo(x, y + s / 2);
    for (let i = 0; i <= 6; i++) ctx.lineTo(x + (s * i) / 6, y + s / 2 + (i % 2 ? -s * 0.12 : s * 0.12));
    ctx.stroke();
  } else if (kind === 1) { // capacitor
    ctx.beginPath();
    ctx.moveTo(x + s * 0.5, y + s * 0.25); ctx.lineTo(x + s * 0.5, y + s * 0.75);
    ctx.moveTo(x + s * 0.68, y + s * 0.25); ctx.lineTo(x + s * 0.68, y + s * 0.75);
    ctx.moveTo(x, y + s / 2); ctx.lineTo(x + s * 0.5, y + s / 2);
    ctx.moveTo(x + s * 0.68, y + s / 2); ctx.lineTo(x + s, y + s / 2);
    ctx.stroke();
  } else { // transistor
    ctx.beginPath();
    ctx.arc(x + s * 0.55, y + s * 0.4, s * 0.26, 0, Math.PI * 2);
    ctx.moveTo(x + s * 0.55, y + s * 0.14); ctx.lineTo(x + s * 0.55, y + s * 0.85);
    ctx.moveTo(x + s * 0.42, y + s * 0.5); ctx.lineTo(x + s * 0.1, y + s * 0.5);
    ctx.moveTo(x + s * 0.68, y + s * 0.52); ctx.lineTo(x + s * 0.95, y + s * 0.52);
    ctx.stroke();
  }
}
function drawChip(ctx, x, y, s) {
  ctx.fillStyle = '#14161a';
  ctx.strokeStyle = '#2c3138';
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, s, s * 0.62);
  ctx.strokeRect(x, y, s, s * 0.62);
  ctx.fillStyle = '#e8b84b';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x + 1 + i * (s / 4), y - 3, 2, 3);
    ctx.fillRect(x + 1 + i * (s / 4), y + s * 0.62, 2, 3);
  }
  ctx.fillStyle = '#3b414a';
  ctx.fillRect(x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.1);
}

function drawTyrannyBoard() {
  const W = boardCanvas.width, H = boardCanvas.height;
  bctx.fillStyle = '#0d0b08';
  bctx.fillRect(0, 0, W, H);
  // board substrate
  bctx.fillStyle = '#171310';
  bctx.strokeStyle = '#2b2419';
  bctx.lineWidth = 2;
  bctx.fillRect(18, 18, W - 36, H - 36);
  bctx.strokeRect(18, 18, W - 36, H - 36);
  // screw holes
  bctx.fillStyle = '#0a0806';
  for (const [x, y] of [[30, 30], [W - 30, 30], [30, H - 30], [W - 30, H - 30]]) {
    bctx.beginPath(); bctx.arc(x, y, 5, 0, Math.PI * 2); bctx.fill();
  }

  tyranny.progress = Math.min(1, tyranny.progress + 0.02);
  const shown = tyranny.progress;
  const mono = tyranny.mode === 'mono';
  const count = mono ? tyranny.lastChipPlan.chips : tyranny.lastStats.parts;
  const s = mono ? 46 : 22;
  const cols = Math.floor((W - 60) / (s + 4));
  const rows = Math.floor((H - 60) / (s + 4));
  const capacity = cols * rows;
  const drawN = Math.min(capacity, Math.floor(count * shown));

  for (let i = 0; i < drawN; i++) {
    const cx = 32 + (i % cols) * (s + 4);
    const cy = 32 + Math.floor(i / cols) * (s + 4);
    if (mono) {
      drawChip(bctx, cx, cy, s);
    } else {
      // part mix: 3/8 transistors, 4/8 resistors, 1/8 capacitors (per gate mix)
      const r = (i * 2654435761) % 8;
      const kind = r < 3 ? 2 : r < 7 ? 0 : 1;
      bctx.strokeStyle = kind === 2 ? 'rgba(232,184,75,0.85)' : kind === 0 ? 'rgba(236,229,211,0.7)' : 'rgba(106,166,216,0.8)';
      drawDiscreteGlyph(bctx, cx, cy, kind, s);
    }
  }
  if (count > capacity) {
    bctx.fillStyle = 'rgba(236, 229, 211, 0.85)';
    bctx.font = '13px "SF Mono", Monaco, monospace';
    bctx.fillText(`showing ${fmt(capacity)} of ${fmt(count)} — the board ran out of room`, 32, H - 24);
  }
  $('#boardFill').textContent = `${Math.round(shown * 100)}%`;
}

/* =====================================================================
   TAB 2 — THE GERMANIUM BAR
   ===================================================================== */
const bar = { rho: 12, neck: 0.36, jarea: 0.32, vr: 2, selected: 'transistor' };

const REGION_INFO = {
  transistor: {
    title: 'Mesa transistor — the amplifier',
    html: `The bar's left end carries a grown-junction transistor: emitter, base, and a collector that is simply the rest of the bar.
      <br><br>The inverting gain of this one device, multiplied by the RC ladder's phase shift, closes the loop that made the scope trace move.`,
    formula: 'vo = −K · v(base)',
  },
  resistor: {
    title: 'Bulk resistor — ρL/A',
    html: `No carbon film here: a resistor is just a narrow neck of the same germanium. Halve the cross-section, double the resistance.
      <br><br>Kilby's insight in one shape — the resistor is not a part placed on the material, it is the material.`,
    formula: 'R = ρ · L / (w · t)',
  },
  capacitor: {
    title: 'Junction capacitor — εA/W',
    html: `A reverse-biased p–n junction stores charge in its depletion region: two plates that nature draws for you.
      <br><br>More reverse bias widens W and shrinks the capacitance — a trimmer for free.`,
    formula: 'C = ε·A / W,  W = √(2ε(Vbi+VR)/qNd)',
  },
  wires: {
    title: 'Gold flying wires — the honest part',
    html: `TI could not yet put interconnections inside the chip. Every connection that crossing parts needed was a hand-soldered gold wire arching over the bar.
      <br><br>This is why Noyce's oxide-insulated aluminum traces, three years later, is the version the world actually manufactured.`,
    formula: 'connections outside the process',
  },
};

const barSvg = $('#barSvg');
const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(name, attrs, parent) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

function buildBar() {
  const posts = $('#headerPosts');
  const regions = $('#barRegions');
  const wires = $('#flyingWires');
  posts.innerHTML = ''; regions.innerHTML = ''; wires.innerHTML = '';

  // header terminal posts along the top
  const postXs = [120, 250, 380, 510, 640, 770, 880];
  postXs.forEach((x, i) => {
    svgEl('rect', { x: x - 5, y: 120, width: 10, height: 26, rx: 2, class: 'post' }, posts);
    svgEl('text', { x, y: 110, 'text-anchor': 'middle', class: 'post-label' }, posts).textContent = `T${i + 1}`;
  });

  // transistor region (left end)
  const tr = svgEl('g', { class: 'bar-region', 'data-region': 'transistor' }, regions);
  svgEl('path', { d: 'M 70 300 L 210 300 L 210 290 L 250 290 L 250 340 L 210 340 L 210 330 L 70 330 Z', fill: '#3a4148', stroke: '#6a7079', 'stroke-width': 1.5 }, tr);
  svgEl('rect', { x: 96, y: 316, width: 26, height: 10, fill: '#e8b84b', stroke: '#a3822a' }, tr); // emitter
  svgEl('rect', { x: 150, y: 306, width: 18, height: 42, fill: '#454b52', stroke: '#8b8f96' }, tr); // base
  svgEl('rect', { x: 186, y: 306, width: 14, height: 42, fill: '#96622c', stroke: '#b37400' }, tr); // collector contact
  svgEl('text', { x: 140, y: 282, 'text-anchor': 'middle', class: 'region-label' }, tr).textContent = 'TRANSISTOR';

  // two resistor necks
  for (const [x0, w0] of [[300, 120], [470, 120]]) {
    const g = svgEl('g', { class: 'bar-region', 'data-region': 'resistor' }, regions);
    svgEl('path', { d: `M ${x0} 300 L ${x0 + w0} 300 L ${x0 + w0} 318 L ${x0} 318 L ${x0} 330 L ${x0 - 14} 330 L ${x0 - 14} 360 L ${x0} 360 L ${x0} 390 L ${x0 + w0} 390 L ${x0 + w0} 360 L ${x0 + w0 + 14} 360 L ${x0 + w0 + 14} 330 L ${x0 + w0} 330 Z`, fill: '#33383e', stroke: '#6a7079', 'stroke-width': 1.5 }, g);
    // hatch marks on the neck
    for (let i = 1; i < 6; i++) {
      svgEl('line', { x1: x0 + (w0 * i) / 6, y1: 300, x2: x0 + (w0 * i) / 6 - 8, y2: 330, stroke: '#545a61', 'stroke-width': 1 }, g);
    }
    svgEl('text', { x: x0 + w0 / 2, y: 282, 'text-anchor': 'middle', class: 'region-label' }, g).textContent = 'R (BULK)';
  }

  // junction capacitor region
  const cj = svgEl('g', { class: 'bar-region', 'data-region': 'capacitor' }, regions);
  svgEl('rect', { x: 650, y: 306, width: 120, height: 78, fill: '#3a4148', stroke: '#6a7079', 'stroke-width': 1.5 }, cj);
  svgEl('rect', { x: 686, y: 306, width: 48, height: 34, fill: '#6d4b8f', opacity: 0.75, stroke: '#8f6bb5' }, cj);
  svgEl('rect', { x: 686, y: 340, width: 48, height: 6, fill: '#49f2a0', opacity: 0.55 }, cj); // depletion
  for (let i = 0; i < 7; i++) svgEl('circle', { cx: 690 + i * 7, cy: 343, r: 1.6, fill: '#49f2a0', opacity: 0.8 }, cj);
  svgEl('text', { x: 710, y: 282, 'text-anchor': 'middle', class: 'region-label' }, cj).textContent = 'C (PN JUNCTION)';

  // gold flying wires: arcs from contact dots to header posts
  const wireSpecs = [
    { from: [109, 316], to: [120, 146] },   // emitter
    { from: [159, 306], to: [250, 146] },   // base
    { from: [193, 306], to: [380, 146] },   // collector
    { from: [360, 300], to: [510, 146] },   // resistor tap
    { from: [530, 300], to: [640, 146] },   // resistor tap
    { from: [710, 306], to: [770, 146] },   // cap top plate
    { from: [760, 390], to: [880, 146] },   // cap bottom
  ];
  const wireGroup = svgEl('g', { class: 'bar-region', 'data-region': 'wires' }, regions);
  for (const w of wireSpecs) {
    const [x1, y1] = w.from, [x2, y2] = w.to;
    const mx = (x1 + x2) / 2, lift = 150;
    const d = `M ${x1} ${y1} C ${x1} ${y1 - lift}, ${x2} ${y2 - lift}, ${x2} ${y2}`;
    const arc = svgEl('path', { d, class: 'flying-wire' }, wires);
    svgEl('circle', { cx: x1, cy: y1, r: 4, class: 'wire-dot' }, wires);
    svgEl('circle', { cx: x2, cy: y2, r: 4, class: 'wire-dot' }, wires);
    // wide invisible hit area
    svgEl('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 16, style: 'cursor:pointer', 'data-region': 'wires' }, wireGroup);
    arc.dataset.region = 'wires';
    arc.style.cursor = 'pointer';
    arc.addEventListener('click', () => selectBarRegion('wires'));
  }
  svgEl('text', { x: 500, y: 96, 'text-anchor': 'middle', class: 'region-label', fill: '#e8b84b' }, wires).textContent = 'GOLD FLYING WIRES — HAND-SOLDERED';

  for (const g of regions.querySelectorAll('.bar-region')) {
    g.addEventListener('click', () => selectBarRegion(g.dataset.region));
  }
}

function selectBarRegion(region) {
  bar.selected = region;
  for (const g of $('#barRegions').querySelectorAll('.bar-region')) {
    g.classList.toggle('selected', g.dataset.region === region);
  }
  const info = REGION_INFO[region] || REGION_INFO.transistor;
  $('#barInfoTitle').textContent = info.title;
  $('#barInfoBody').innerHTML = `<p class="card-blurb">${info.html}</p><p class="mono formula-line">${info.formula}</p>`;
  barUpdateDerived();
}

function neckDims() {
  // slider 10..100 -> neck width 0.6..2.0 mm; thickness fixed by etch depth
  const wmm = 0.6 + ((bar.neck - 10) / 90) * 1.4;
  const tmm = 0.35;
  return { wmm: clamp(wmm, 0.6, 2.0), tmm };
}

function barUpdateDerived() {
  const { wmm, tmm } = neckDims();
  $('#rhoReadout').textContent = `${bar.rho.toFixed(1)} Ω·cm`;
  $('#neckReadout').textContent = `${wmm.toFixed(1)} × ${tmm.toFixed(1)} mm`;
  const jareaMm2 = 0.2 + bar.jarea * 0.05; // slider -> 0.2..4.2 mm^2
  $('#jareaReadout').textContent = `${jareaMm2.toFixed(1)} mm²`;
  $('#vrReadout').textContent = `${bar.vr.toFixed(1)} V`;

  const Lcm = 0.30;                        // each neck is 3 mm long
  const wcm = wmm / 10, tcm = tmm / 10;    // mm -> cm
  const R = barResistance(bar.rho, Lcm, wcm, tcm);
  const C = junctionCapacitance(jareaMm2 / 100, 0.3, bar.vr, 1e15);
  const W = depletionWidth(0.3, bar.vr, 1e15);
  $('#derivedR').textContent = `${fmt(R, 0)} Ω`;
  $('#derivedC').textContent = `${fmt(C * 1e12, 0)} pF`;
  $('#derivedW').textContent = `${fmt(W * 1e4, 2)} µm`;
  $('#derivedF').textContent = C > 0 ? `${fmt(oscFrequency(R, C), 0)} Hz` : '—';
  bar.derived = { R, C };
}

for (const [sel, key] of [['#rhoSlider', 'rho'], ['#neckSlider', 'neck'], ['#jareaSlider', 'jarea'], ['#vrSlider', 'vr']]) {
  $(sel).addEventListener('input', (e) => { bar[key] = +e.target.value; barUpdateDerived(); });
}

$('#sendToOscBtn').addEventListener('click', () => {
  const { R, C } = bar.derived;
  oscSetParams({ R: clamp(R, 100, 100000), C: clamp(C, 50e-12, 1e-6) });
  switchTab('tab-osc');
  if (!osc.power) togglePower();
});

/* =====================================================================
   TAB 3 — PHASE-SHIFT OSCILLATOR
   ===================================================================== */
const osc = {
  power: false,
  R: 4700, C: 220e-9, K: 35, Vlim: 5,
  p1: 0, p2: 0, p3: 1e-3,   // series-capacitor states (volts)
  v3: 0, vo: 0,
  buffer: [],               // {t, v3, vo}
  simClock: 0,
  measuredF: null, measuredAmp: null,
};

/* log-scaled sliders */
const R_SL = { min: 100, max: 100000 };
const C_SL = { min: 50e-12, max: 1e-6 };
function rSliderVal(R) { return Math.round(((Math.log(R) - Math.log(R_SL.min)) / (Math.log(R_SL.max) - Math.log(R_SL.min))) * 1000); }
function rFromSlider(v) { return Math.exp(Math.log(R_SL.min) + (v / 1000) * (Math.log(R_SL.max) - Math.log(R_SL.min))); }
function cSliderVal(C) { return Math.round(((Math.log(C) - Math.log(C_SL.min)) / (Math.log(C_SL.max) - Math.log(C_SL.min))) * 1000); }
function cFromSlider(v) { return Math.exp(Math.log(C_SL.min) + (v / 1000) * (Math.log(C_SL.max) - Math.log(C_SL.min))); }

function fmtR(R) { return R >= 1000 ? `${(R / 1000).toFixed(1)} kΩ` : `${Math.round(R)} Ω`; }
function fmtC(C) {
  if (C >= 1e-6) return `${(C * 1e6).toFixed(2)} µF`;
  if (C >= 1e-9) return `${(C * 1e9).toFixed(0)} nF`;
  return `${(C * 1e12).toFixed(0)} pF`;
}

function oscUpdateReadouts() {
  $('#oscrReadout').textContent = fmtR(osc.R);
  $('#osccReadout').textContent = fmtC(osc.C);
  $('#osckReadout').textContent = osc.K.toFixed(1);
  const f0 = oscFrequency(osc.R, osc.C);
  $('#roTheory').textContent = f0 >= 1000 ? `${fmt(f0 / 1000, 2)} kHz` : `${fmt(f0, 0)} Hz`;
  $('#scopeTimebase').textContent = `${fmt(5 / f0 * 200, 1)} ms full scale`;

  const ratio = osc.K / CRITICAL_GAIN;
  $('#bhRatio').textContent = ratio.toFixed(2);
  $('#bhFill').style.width = `${clamp(ratio / 2, 0.02, 1) * 100}%`;
  const st = $('#bhState');
  if (osc.K < 28.9) { st.textContent = 'DECAYS — below Barkhausen'; st.className = 'bh-state warn'; }
  else if (osc.K < 29.15) { st.textContent = 'MARGINAL — pure sine, eternal startup'; st.className = 'bh-state marginal'; }
  else { st.textContent = 'OSCILLATES — |Aβ| > 1, amplitude grows'; st.className = 'bh-state ok'; }

  const dyn = linearLoopDynamics(osc.R, osc.C, osc.K);
  $('#roSigma').textContent = dyn.sigma > 0 ? `+${dyn.sigma.toFixed(1)} / − / s` : `${dyn.sigma.toFixed(1)} / s`;
}

function oscSetParams({ R, C, K } = {}) {
  if (R != null) { osc.R = R; $('#oscrSlider').value = rSliderVal(R); }
  if (C != null) { osc.C = C; $('#osccSlider').value = cSliderVal(C); }
  if (K != null) { osc.K = K; $('#osckSlider').value = K; }
  oscUpdateReadouts();
}
$('#oscrSlider').addEventListener('input', (e) => oscSetParams({ R: rFromSlider(+e.target.value) }));
$('#osccSlider').addEventListener('input', (e) => oscSetParams({ C: cFromSlider(+e.target.value) }));
$('#osckSlider').addEventListener('input', (e) => oscSetParams({ K: +e.target.value }));

function togglePower() {
  osc.power = !osc.power;
  ensureAudio();
  if (osc.power) {
    // seed the loop with circuit noise: a millivolt on the base capacitor
    osc.p1 = 0; osc.p2 = 0; osc.p3 = (Math.random() * 0.4 + 0.8) * 1e-3;
    osc.buffer = [];
    osc.simClock = 0;
  } else {
    osc.buffer = [];
    osc.measuredF = null;
    osc.measuredAmp = null;
  }
  const btn = $('#powerBtn');
  btn.classList.toggle('on', osc.power);
  btn.classList.toggle('off', !osc.power);
  btn.setAttribute('aria-pressed', osc.power);
  btn.querySelector('.power-state').textContent = osc.power ? 'ON' : 'OFF';
}
$('#powerBtn').addEventListener('click', togglePower);

/* --- stepper (same physics as kilby.js, kept live across param changes) */
function oscSolveV3(P) {
  const linear = -P / (1 + osc.K);
  if (Math.abs(linear) <= osc.Vlim) return linear;
  const hi = -P - osc.K * osc.Vlim;
  const lo = -P + osc.K * osc.Vlim;
  if (hi > osc.Vlim) return hi;
  if (lo < -osc.Vlim) return lo;
  return Math.sign(linear) * osc.Vlim;
}
function oscStep(h) {
  const RC = osc.R * osc.C;
  const dv = (p1, p2, p3) => {
    const P = p1 + p2 + p3;
    const v3 = oscSolveV3(P);
    const vo = v3 + P;
    const r1 = (vo - p1) / RC, r2 = p2 / RC, r3 = p3 / RC;
    return [3 * r1 - 2 * r2 - r3, 2 * r1 - 2 * r2 - r3, r1 - r2 - r3];
  };
  const k1 = dv(osc.p1, osc.p2, osc.p3);
  const k2 = dv(osc.p1 + 0.5 * h * k1[0], osc.p2 + 0.5 * h * k1[1], osc.p3 + 0.5 * h * k1[2]);
  const k3 = dv(osc.p1 + 0.5 * h * k2[0], osc.p2 + 0.5 * h * k2[1], osc.p3 + 0.5 * h * k2[2]);
  const k4 = dv(osc.p1 + h * k3[0], osc.p2 + h * k3[1], osc.p3 + h * k3[2]);
  osc.p1 += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
  osc.p2 += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  osc.p3 += (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
  const P = osc.p1 + osc.p2 + osc.p3;
  osc.v3 = oscSolveV3(P);
  osc.vo = osc.v3 + P;
}

function oscAdvance(realDt) {
  if (!osc.power) {
    // leakage: everything relaxes toward zero
    const tau = 0.6;
    const decay = Math.exp(-realDt / tau);
    osc.p1 *= decay; osc.p2 *= decay; osc.p3 *= decay;
    const P = osc.p1 + osc.p2 + osc.p3;
    osc.v3 = oscSolveV3(P);
    osc.vo = osc.v3 + P;
    return;
  }
  const f0 = oscFrequency(osc.R, osc.C);
  const h = (1 / f0) / 48;                        // integration step
  const dyn = linearLoopDynamics(osc.R, osc.C, osc.K);
  // pace the wall clock so the envelope e-folds in ~0.7 s of viewing; the
  // scope is effectively triggered (full last-6-period window), so the sine
  // looks stationary while its amplitude grows
  const sigmaVis = Math.abs(dyn.sigma) > 0.3 ? clamp(1.5 / Math.abs(dyn.sigma), 5e-4, 50) : 0.002;
  let simDt = Math.min(realDt, 0.05) * sigmaVis;
  const windowT = 6 / f0;
  let steps = Math.max(1, Math.round(simDt / h));
  steps = Math.min(steps, 3000);
  const hUse = simDt / steps;
  for (let i = 0; i < steps; i++) {
    oscStep(hUse);
    osc.simClock += hUse;
    osc.buffer.push({ t: osc.simClock, v3: osc.v3, vo: osc.vo });
  }
  while (osc.buffer.length && osc.buffer[0].t < osc.simClock - windowT) osc.buffer.shift();

  // measured frequency from the last ~4 periods
  if (osc.buffer.length > 100) {
    const arr = osc.buffer;
    const dt = arr[1].t - arr[0].t;
    const crossings = [];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i - 1].vo <= 0 && arr[i].vo > 0) crossings.push(arr[i].t);
    }
    if (crossings.length >= 3) {
      let sum = 0;
      for (let i = 1; i < crossings.length; i++) sum += crossings[i] - crossings[i - 1];
      osc.measuredF = 1 / (sum / (crossings.length - 1));
    }
    let peak = 0;
    for (const s of arr) peak = Math.max(peak, Math.abs(s.vo));
    osc.measuredAmp = peak;
  }
}

const scopeCanvas = $('#oscScope');
const sctx = scopeCanvas.getContext('2d');
function drawScope() {
  const W = scopeCanvas.width, H = scopeCanvas.height;
  sctx.fillStyle = '#07120c';
  sctx.fillRect(0, 0, W, H);
  // graticule
  sctx.strokeStyle = 'rgba(73, 242, 160, 0.10)';
  sctx.lineWidth = 1;
  for (let x = 0; x <= W; x += W / 10) { sctx.beginPath(); sctx.moveTo(x, 0); sctx.lineTo(x, H); sctx.stroke(); }
  for (let y = 0; y <= H; y += H / 8) { sctx.beginPath(); sctx.moveTo(0, y); sctx.lineTo(W, y); sctx.stroke(); }
  sctx.strokeStyle = 'rgba(73, 242, 160, 0.25)';
  sctx.beginPath(); sctx.moveTo(0, H / 2); sctx.lineTo(W, H / 2); sctx.stroke();

  const arr = osc.buffer;
  if (arr.length < 4) {
    sctx.fillStyle = 'rgba(73, 242, 160, 0.45)';
    sctx.font = '13px "SF Mono", Monaco, monospace';
    sctx.fillText(osc.power ? 'waiting for the loop to build…' : 'power off — press POWER to start the 1958 demo', 26, 30);
    return;
  }
  const t1 = arr[arr.length - 1].t, t0 = arr[0].t;
  let peak = 0.02;
  for (const s of arr) peak = Math.max(peak, Math.abs(s.vo), Math.abs(s.v3) * 29);
  const x = (t) => ((t - t0) / (t1 - t0)) * W;
  const y = (v) => H / 2 - (v / peak) * (H * 0.42);

  // v3 trace (cyan), scaled up by 29 to compare against vo
  sctx.strokeStyle = '#6ae0f2';
  sctx.lineWidth = 1.6;
  sctx.beginPath();
  arr.forEach((s, i) => { const px = x(s.t), py = y(s.v3 * 29); i ? sctx.lineTo(px, py) : sctx.moveTo(px, py); });
  sctx.stroke();
  // vo trace (gold) with phosphor glow
  sctx.save();
  sctx.shadowColor = 'rgba(73, 242, 160, 0.8)';
  sctx.shadowBlur = 8;
  sctx.strokeStyle = '#e8b84b';
  sctx.lineWidth = 2.2;
  sctx.beginPath();
  arr.forEach((s, i) => { const px = x(s.t), py = y(s.vo); i ? sctx.lineTo(px, py) : sctx.moveTo(px, py); });
  sctx.stroke();
  sctx.restore();

  // readout
  const mF = osc.measuredF;
  const el = $('#roMeasured');
  el.textContent = mF ? (mF >= 1000 ? `${(mF / 1000).toFixed(2)} kHz` : `${mF.toFixed(0)} Hz`) : '— Hz';
  el.classList.toggle('good', !!mF && Math.abs(mF / oscFrequency(osc.R, osc.C) - 1) < 0.05);

  audioTick(mF, osc.power ? clamp((osc.measuredAmp || 0) / osc.Vlim, 0, 1) * 0.9 : 0);
}

/* phasor diagram (static) */
function buildPhasors() {
  const svg = $('#phaseSvg');
  const cx = 160, cy = 150, r = 100;
  const cols = ['#e8b84b', '#6ae0f2', '#9d8cff', '#49f2a0'];
  svg.innerHTML = `
    <defs>
      <marker id="arrowG" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${cols[0]}"/></marker>
      <marker id="arrowC" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${cols[1]}"/></marker>
      <marker id="arrowV" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${cols[2]}"/></marker>
      <marker id="arrowP" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${cols[3]}"/></marker>
    </defs>
    <line x1="${cx}" y1="${cy}" x2="${cx + r}" y2="${cy}" class="phasor-line" stroke="${cols[0]}" marker-end="url(#arrowG)"/>
    <text x="${cx + r + 6}" y="${cy + 4}" class="phasor-text" fill="${cols[0]}">Vo</text>
    <path d="M ${cx + 34} ${cy} A 34 34 0 0 0 ${cx + 34 * Math.cos(-Math.PI / 3)} ${cy + 34 * Math.sin(-Math.PI / 3)}" class="phasor-arc" stroke="${cols[0]}"/>
    <text x="${cx + 44}" y="${cy - 12}" class="phasor-text" fill="${cols[0]}">60°</text>
    <line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(-Math.PI / 3)}" y2="${cy + r * Math.sin(-Math.PI / 3)}" class="phasor-line" stroke="${cols[1]}" marker-end="url(#arrowC)"/>
    <text x="${cx + r * Math.cos(-Math.PI / 3) - 10}" y="${cy + r * Math.sin(-Math.PI / 3) - 8}" class="phasor-text" fill="${cols[1]}">V1</text>
    <line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(-2 * Math.PI / 3)}" y2="${cy + r * Math.sin(-2 * Math.PI / 3)}" class="phasor-line" stroke="${cols[2]}" marker-end="url(#arrowV)"/>
    <text x="${cx + r * Math.cos(-2 * Math.PI / 3) - 20}" y="${cy + r * Math.sin(-2 * Math.PI / 3) - 10}" class="phasor-text" fill="${cols[2]}">V2</text>
    <line x1="${cx}" y1="${cy}" x2="${cx - r}" y2="${cy}" class="phasor-line" stroke="${cols[3]}" marker-end="url(#arrowP)"/>
    <text x="${cx - r - 34}" y="${cy + 4}" class="phasor-text" fill="${cols[3]}">V3</text>
    <text x="${cx - r - 34}" y="${cy + 22}" class="phasor-text" fill="#a89b80" font-size="11">180° from Vo</text>
    <circle cx="${cx}" cy="${cy}" r="3.5" fill="#ece5d3"/>
    <text x="${cx - 20}" y="${cy + 130}" class="phasor-text" fill="#a89b80" font-size="11.5">3 sections × 60° = 180°</text>
    <text x="${cx - 34}" y="${cy + 148}" class="phasor-text" fill="#49f2a0" font-size="11.5">amp adds 180° → loop = 360°</text>
  `;
}

/* =====================================================================
   TAB 4 — FLYING WIRES → PLANAR → MOORE
   ===================================================================== */
function buildStacks() {
  const kilby = $('#kilbyStack');
  kilby.innerHTML = `
    <g>
      <rect x="30" y="150" width="400" height="46" rx="4" fill="#23262b" stroke="#4a4f57" stroke-width="1.5"/>
      <text x="230" y="178" text-anchor="middle" font-family="SF Mono, Monaco, monospace" font-size="11" fill="#6a7079" letter-spacing="3">GERMANIUM</text>
      <rect x="70" y="150" width="18" height="24" fill="#e8b84b"/>
      <rect x="180" y="150" width="18" height="24" fill="#96622c"/>
      <rect x="300" y="150" width="18" height="24" fill="#454b52"/>
      <rect x="390" y="150" width="18" height="24" fill="#6d4b8f"/>
      <g stroke="#e8b84b" stroke-width="2.4" fill="none">
        <path d="M 79 150 C 79 70, 189 70, 189 150"/>
        <path d="M 309 150 C 309 60, 399 60, 399 150"/>
        <path d="M 189 150 C 199 110, 299 110, 309 150" stroke-dasharray="0"/>
      </g>
      <circle cx="79" cy="150" r="4" fill="#e8b84b"/><circle cx="189" cy="150" r="4" fill="#e8b84b"/>
      <circle cx="309" cy="150" r="4" fill="#e8b84b"/><circle cx="399" cy="150" r="4" fill="#e8b84b"/>
      <text x="230" y="36" text-anchor="middle" font-family="SF Mono, Monaco, monospace" font-size="12" fill="#e8b84b">wires live ABOVE the chip</text>
      <text x="230" y="225" text-anchor="middle" font-family="SF Mono, Monaco, monospace" font-size="11" fill="#a89b80">every crossing = a hand-soldered arc</text>
    </g>`;
  // flowing dashes on the wires
  kilby.querySelectorAll('path').forEach(p => {
    if (p.getAttribute('stroke') === '#e8b84b') {
      p.setAttribute('stroke-dasharray', '7 5');
      const a = document.createElementNS(SVG_NS, 'animate');
      a.setAttribute('attributeName', 'stroke-dashoffset');
      a.setAttribute('from', '0'); a.setAttribute('to', '24');
      a.setAttribute('dur', '1.2s'); a.setAttribute('repeatCount', 'indefinite');
      p.appendChild(a);
    }
  });

  const noyce = $('#noyceStack');
  noyce.innerHTML = `
    <g>
      <rect x="30" y="160" width="400" height="42" rx="4" fill="#23262b" stroke="#4a4f57" stroke-width="1.5"/>
      <text x="230" y="186" text-anchor="middle" font-family="SF Mono, Monaco, monospace" font-size="11" fill="#6a7079" letter-spacing="3">SILICON SUBSTRATE</text>
      <rect x="30" y="140" width="400" height="20" fill="#2c5f43" opacity="0.85"/>
      <text x="230" y="154" text-anchor="middle" font-family="SF Mono, Monaco, monospace" font-size="9.5" fill="#8fe6bb" letter-spacing="2">SiO₂ — seals junctions, insulates traces</text>
      <g stroke="#cfd6de" stroke-width="5" fill="none" stroke-linecap="round">
        <path d="M 50 128 C 150 96, 300 96, 420 128"/>
        <path d="M 50 172 L 420 172" opacity="0" />
      </g>
      <g stroke="#cfd6de" stroke-width="5" fill="none" stroke-linecap="round">
        <path d="M 90 176 C 90 176, 90 150, 110 150 L 330 150 C 350 150, 350 176, 350 176"/>
      </g>
      <rect x="140" y="140" width="14" height="20" fill="#cfd6de"/>
      <rect x="300" y="140" width="14" height="20" fill="#cfd6de"/>
      <text x="230" y="40" text-anchor="middle" font-family="SF Mono, Monaco, monospace" font-size="12" fill="#8fe6bb">traces cross INSIDE the process</text>
      <text x="230" y="225" text-anchor="middle" font-family="SF Mono, Monaco, monospace" font-size="11" fill="#a89b80">crossings are free — oxide does the insulating</text>
    </g>`;
  noyce.querySelectorAll('path').forEach(p => {
    if (p.getAttribute('stroke') === '#cfd6de' && p.getAttribute('opacity') !== '0') {
      p.setAttribute('stroke-dasharray', '9 7');
      const a = document.createElementNS(SVG_NS, 'animate');
      a.setAttribute('attributeName', 'stroke-dashoffset');
      a.setAttribute('from', '0'); a.setAttribute('to', '32');
      a.setAttribute('dur', '1.2s'); a.setAttribute('repeatCount', 'indefinite');
      p.appendChild(a);
    }
  });
}

/* --- Moore plot ---------------------------------------------------- */
const mooreCanvas = $('#mooreCanvas');
const mctx = mooreCanvas.getContext('2d');
const mooreSel = [];
let moorePts = [];

function buildMoore() {
  const W = mooreCanvas.width, H = mooreCanvas.height;
  const mL = 86, mR = 30, mT = 42, mB = 60;
  const xOf = (y) => mL + ((y - 1958) / (2026 - 1958)) * (W - mL - mR);
  const yOf = (n) => H - mB - ((Math.log10(n)) / 13) * (H - mT - mB);
  moorePts = MOORE_ANCHORS.map(a => ({ ...a, x: xOf(a.year), y: yOf(a.count) }));

  mctx.fillStyle = '#0d0b08';
  mctx.fillRect(0, 0, W, H);
  mctx.font = '11px "SF Mono", Monaco, monospace';

  // decade grid
  mctx.strokeStyle = 'rgba(232, 184, 75, 0.08)';
  mctx.fillStyle = '#6f6552';
  for (let d = 0; d <= 13; d++) {
    const y = H - mB - (d / 13) * (H - mT - mB);
    mctx.beginPath(); mctx.moveTo(mL, y); mctx.lineTo(W - mR, y); mctx.stroke();
    mctx.fillText(d === 0 ? '1' : `1e${d}`, 40, y + 4);
  }
  for (let yr = 1960; yr <= 2020; yr += 10) {
    const x = xOf(yr);
    mctx.beginPath(); mctx.moveTo(x, mT); mctx.lineTo(x, H - mB); mctx.stroke();
    mctx.fillText(String(yr), x - 14, H - mB + 20);
  }

  // curve
  mctx.strokeStyle = 'rgba(232, 184, 75, 0.85)';
  mctx.lineWidth = 2.4;
  mctx.beginPath();
  let started = false;
  for (let yr = 1958; yr <= 2026; yr++) {
    const n = transistorsPerChip(yr);
    const x = xOf(yr), y = yOf(n);
    started ? mctx.lineTo(x, y) : mctx.moveTo(x, y);
    started = true;
  }
  mctx.stroke();

  // anchor dots
  for (const p of moorePts) {
    const sel = mooreSel.includes(p);
    mctx.beginPath();
    mctx.arc(p.x, p.y, sel ? 8 : 5, 0, Math.PI * 2);
    mctx.fillStyle = sel ? '#49f2a0' : '#e8b84b';
    mctx.fill();
    mctx.strokeStyle = '#0d0b08';
    mctx.lineWidth = 2;
    mctx.stroke();
  }
  // selected chord
  if (mooreSel.length === 2) {
    mctx.strokeStyle = '#49f2a0';
    mctx.lineWidth = 1.8;
    mctx.setLineDash([6, 5]);
    mctx.beginPath();
    mctx.moveTo(mooreSel[0].x, mooreSel[0].y);
    mctx.lineTo(mooreSel[1].x, mooreSel[1].y);
    mctx.stroke();
    mctx.setLineDash([]);
  }

  // labels for anchors (alternate up/down to avoid overlap)
  MOORE_ANCHORS.forEach((a, i) => {
    const p = moorePts[i];
    mctx.fillStyle = mooreSel.includes(p) ? '#49f2a0' : '#a89b80';
    const up = i % 2 === 0;
    mctx.fillText(a.year, p.x - 14, up ? p.y - 14 : p.y + 22);
    mctx.fillText(compactCount(a.count), p.x - 14, up ? p.y - 26 : p.y + 34);
  });

  mctx.fillStyle = '#6f6552';
  mctx.font = '12px "SF Mono", Monaco, monospace';
  mctx.fillText('Kilby → 4 T (Cerebras-class), 68 years', mL + 8, mT - 12);
}

function compactCount(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 ? 1 : 0)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n % 1e3 ? 1 : 0)}k`;
  return String(n);
}

mooreCanvas.addEventListener('click', (e) => {
  const rect = mooreCanvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (mooreCanvas.width / rect.width);
  const sy = (e.clientY - rect.top) * (mooreCanvas.height / rect.height);
  let best = null, bd = 30;
  for (const p of moorePts) {
    const d = Math.hypot(p.x - sx, p.y - sy);
    if (d < bd) { bd = d; best = p; }
  }
  if (!best) return;
  const idx = mooreSel.indexOf(best);
  if (idx >= 0) mooreSel.splice(idx, 1);
  else mooreSel.push(best);
  if (mooreSel.length > 2) mooreSel.shift();
  updateDoubling();
  buildMoore();
});

function updateDoubling() {
  const box = $('#doublingBox');
  if (mooreSel.length < 2) {
    box.innerHTML = '<span class="doubling-hint">Pick two anchor points to compute the implied doubling time.</span>';
    return;
  }
  const [a, b] = mooreSel;
  const dt = doublingTimeYears(a, b);
  const ratio = b.count / a.count;
  const bits = Math.log2(ratio);
  box.innerHTML = `
    <span><strong class="mono" style="color:#e8b84b">${a.year}</strong> ${a.label} — ${compactCount(a.count)}</span>
    <span>→</span>
    <span><strong class="mono" style="color:#e8b84b">${b.year}</strong> ${b.label} — ${compactCount(b.count)}</span>
    <span>×${compactCount(ratio)} = 2<sup>${bits.toFixed(1)}</sup> in ${b.year - a.year} yr</span>
    <span class="mono">doubling every ${dt.toFixed(2)} yr</span>`;
}
function doublingTimeYears(a, b) {
  return (b.year - a.year) / Math.log2(b.count / a.count);
}

function buildTimeline() {
  const strip = $('#timelineStrip');
  strip.innerHTML = '';
  for (const m of MILESTONES) {
    const card = document.createElement('div');
    card.className = 'milestone-card' + (m.year === '2026-09-12' ? ' today' : '');
    card.innerHTML = `
      <div class="milestone-date">${m.year}</div>
      <div class="milestone-title">${m.title}</div>
      <div class="milestone-text">${m.text}</div>`;
    strip.appendChild(card);
  }
}

/* =====================================================================
   main loop + demo API
   ===================================================================== */
let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.06, (now - lastFrame) / 1000);
  lastFrame = now;
  const activeTab = document.querySelector('.tab-panel.active').id;
  if (activeTab === 'tab-tyranny') drawTyrannyBoard();
  if (activeTab === 'tab-osc') { oscAdvance(dt); drawScope(); }
  else if (audio.gain && audio.gain.gain.value > 0.001) {
    audio.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.15);
  }
  requestAnimationFrame(frame);
}

function init() {
  gatesSlider.value = sliderFromGates(tyranny.gates);
  tyrannyUpdate();
  buildBar();
  selectBarRegion('transistor');
  barUpdateDerived();
  buildPhasors();
  buildStacks();
  buildMoore();
  buildTimeline();
  oscSetParams({});
  requestAnimationFrame(frame);
}
init();

/* video / test hook */
window.__demo = {
  setTyranny({ gates, mode, year } = {}) {
    if (gates != null) { tyranny.gates = gates; gatesSlider.value = sliderFromGates(gates); }
    if (year != null) { tyranny.year = year; $('#yearSlider').value = year; }
    if (mode != null) setTyrannyMode(mode);
    tyrannyUpdate();
  },
  setBar(params) {
    if (params.rho != null) { bar.rho = params.rho; $('#rhoSlider').value = params.rho; }
    if (params.vr != null) { bar.vr = params.vr; $('#vrSlider').value = params.vr; }
    barUpdateDerived();
  },
  selectBarRegion,
  setOsc(params) { oscSetParams(params); },
  power: (on) => { if (osc.power !== on) togglePower(); },
  isPowered: () => osc.power,
  measuredFrequency: () => osc.measuredF,
  selectMoore: (...years) => {
    mooreSel.length = 0;
    for (const y of years) {
      const p = moorePts.find(q => q.year === y);
      if (p) mooreSel.push(p);
    }
    updateDoubling();
    buildMoore();
  },
  setAudio(on) {
    audio.on = !!on;
    $('#soundIcon').textContent = audio.on ? '🔊' : '🔇';
    $('#soundStatus').textContent = audio.on ? 'AUDIO: ON' : 'AUDIO: OFF';
  },
};
