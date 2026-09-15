/* ==========================================================================
   Xerox 914 studio — the four machines. All numbers come from engine.js;
   this file only draws and animates them.
   ========================================================================== */

import * as X from './engine.js';

/* ---------- shared state ---------- */
const S = { ...X.DEFAULTS };
const $ = (id) => document.getElementById(id);
const fmt = (v, d = 0) => v.toFixed(d);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- derived physics, recomputed on every change ---------- */
function derived() {
  const MA = X.massPerAreaState(S);
  const d = {
    coronaOn: X.coronaIsOn(S),
    vBg: X.vBackground(S),
    vImg: X.vImage(S),
    Vc: X.contrastPotential(S),
    E: X.devFieldState(S),
    Ebg: X.bgFieldState(S),
    release: X.releaseTotal(S),
    MA,
    MAimg: MA,
    MAbg: X.massPerArea(X.vBackground(S), S.gap, S.d, S.qm),
    regime: X.regime(S),
  };
  d.cImg = X.imageDevelops(S) ? X.coverage(MA, S.tonerR) : 0;
  d.cBg = X.backgroundFogs(S) ? X.coverage(d.MAbg, S.tonerR) : 0;
  d.OD = X.opticalDensity(d.cImg, S.odSolid);
  d.tonerPerCm2 = X.tonerPerCm2(MA, S.tonerR);
  d.tonerPerCopy = X.tonerPerCopyKg(MA);
  d.meltJ = X.fuseEnergy(d.tonerPerCopy);
  d.meltW = X.fusePowerAtCpm(d.tonerPerCopy);
  d.onsetV = X.coronaOnsetVoltage(S.wireR, S.coronaGap);
  d.wireField = X.coronaField(S.wireR, S.coronaGap, S.coronaV);
  d.peek = X.peekOnset(S.wireR);
  d.tau = X.darkTau(S.rhoDark);
  d.capPF = X.capPFcm2(S.d);
  d.sigma = X.surfaceCharge(S.V0, S.d);
  d.perErg = X.photoPerErg(S.lambda, S.eta, S.d);
  d.vBgNoFog = X.vBgNoFog(S);
  d.fluenceNoFog = X.fluenceNoFog(S);
  return d;
}
let D = derived();

/* ---------- slider wiring ---------- */
const SLIDERS = [
  ['wireR', 'in-wireR', 'v-wireR', (v) => `${v} µm`, (el) => el.value * 1e-6],
  ['coronaGap', 'in-coronaGap', 'v-coronaGap', (v) => `${v} mm`, (el) => el.value * 1e-3],
  ['coronaV', 'in-coronaV', 'v-coronaV', (v) => `${(v / 1000).toFixed(1)} kV`, (el) => +el.value],
  ['d', 'in-d', 'v-d', (v) => `${v} µm`, (el) => el.value * 1e-6],
  ['rhoDark', 'in-rhoDark', 'v-rhoDark', (v) => `10^${v} Ω·cm`, (el) => Math.pow(10, +el.value)],
  ['lambda', 'in-lambda', 'v-lambda', (v) => `${v} nm`, (el) => el.value * 1e-9],
  ['eta', 'in-eta', 'v-eta', (v) => v, (el) => +el.value],
  ['fluence', 'in-fluence', 'v-fluence', (v) => `${v} erg/cm²`, (el) => +el.value],
  ['printOD', 'in-printOD', 'v-printOD', (v) => `OD ${v}`, (el) => +el.value],
  ['V0', 'in-V0', 'v-V0', (v) => `${v} V`, (el) => +el.value],
  ['qm', 'in-qm', 'v-qm', (v) => `${v} µC/g`, (el) => el.value * 1e-3],
  ['tonerR', 'in-tonerR', 'v-tonerR', (v) => `${v} µm`, (el) => el.value * 1e-6],
  ['gap', 'in-gap', 'v-gap', (v) => `${v} µm`, (el) => el.value * 1e-6],
];
const INIT = {
  wireR: S.wireR / 1e-6, coronaGap: S.coronaGap / 1e-3, coronaV: S.coronaV, d: S.d / 1e-6,
  rhoDark: Math.log10(S.rhoDark), lambda: S.lambda / 1e-9, eta: S.eta, fluence: S.fluence,
  printOD: S.printOD, V0: S.V0, qm: S.qm / 1e-3, tonerR: S.tonerR / 1e-6, gap: S.gap / 1e-6,
};
for (const [key, inId, vId, show, read] of SLIDERS) {
  const el = $(inId);
  el.value = INIT[key];
  const paint = () => { $(vId).textContent = show(el.value); };
  el.addEventListener('input', () => {
    S[key] = read(el);
    paint();
    D = derived();
    refreshReadouts();
  });
  paint();
}

/* ==========================================================================
   Original documents — rendered to tiny bitmaps, measured for darkness.
   ========================================================================== */
const DOCS = {
  astoria: {
    label: '“10.-22.-38 ASTORIA.”', w: 96, h: 140,
    draw(c) {
      c.fillStyle = '#fff'; c.fillRect(0, 0, 96, 140);
      c.fillStyle = '#111';
      c.font = 'bold 15px monospace'; c.textAlign = 'center';
      c.fillText('10.-22.-38', 48, 62);
      c.fillText('ASTORIA.', 48, 82);
    },
  },
  memo: {
    label: 'interoffice memo', w: 96, h: 140,
    draw(c) {
      c.fillStyle = '#fff'; c.fillRect(0, 0, 96, 140);
      c.fillStyle = '#111'; c.textAlign = 'left';
      c.font = 'bold 9px monospace';
      c.fillText('HALOID-XEROX', 8, 16);
      c.fillText('MEMORANDUM', 8, 30);
      c.font = 'bold 6.5px monospace';
      const lines = [
        'TO: All Branches', 'FROM: J. C. Wilson', 'DATE: Sept 16, 1959', '',
        'The Model 914 will', 'be shown to the press', 'at the Sherry-', 'Netherland today.',
        'Plain paper copies,', 'seven per minute.', '',
        'Treat her gently.', 'She knows when you', 'are afraid of her.',
      ];
      lines.forEach((l, i) => c.fillText(l, 8, 44 + i * 7));
    },
  },
  zeros: {
    label: 'payroll · zeros & O\'s', w: 96, h: 140,
    draw(c) {
      c.fillStyle = '#fff'; c.fillRect(0, 0, 96, 140);
      c.fillStyle = '#111'; c.textAlign = 'center';
      c.font = 'bold 7.5px monospace';
      c.fillText('PAYROLL — SEPT 1959', 48, 10);
      c.font = 'bold 13px monospace';
      for (let row = 0; row < 11; row++) {
        const s = row % 2 ? '0O0O0O0O0O0' : 'OO0O0O0O0O';
        const y = 26 + row * 10.5;
        c.fillText(s, 48, y);
        c.fillText(s, 48.8, y); // double-strike: heavy ink, the notorious fire-starter page
      }
    },
  },
};
for (const [id, doc] of Object.entries(DOCS)) {
  const off = document.createElement('canvas');
  off.width = doc.w; off.height = doc.h;
  const c = off.getContext('2d');
  doc.draw(c);
  const data = c.getImageData(0, 0, doc.w, doc.h).data;
  const lum = (x, y) => {
    const i = (y * doc.w + x) * 4;
    return 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
  };
  let dark = 0;
  doc.colDark = new Array(doc.w).fill(0);
  doc.colCount = new Array(doc.w).fill(0);
  for (let y = 0; y < doc.h; y++) {
    for (let x = 0; x < doc.w; x++) {
      if (lum(x, y) < 150) { dark++; doc.colDark[x]++; }
      doc.colCount[x]++;
    }
  }
  /* sampled 24 × 36 darkness grid for rendering finished copies */
  doc.grid = new Uint8Array(24 * 36);
  for (let j = 0; j < 24; j++) {
    for (let k = 0; k < 36; k++) {
      const sx = Math.min(doc.w - 1, Math.floor(((j + 0.5) / 24) * doc.w));
      const sy = Math.min(doc.h - 1, Math.floor(((k + 0.5) / 36) * doc.h));
      doc.grid[j * 36 + k] = lum(sx, sy) < 150 ? 1 : 0;
    }
  }
  doc.coverage = dark / (doc.w * doc.h);
  doc.canvas = off;
}
let currentDoc = 'memo';
document.querySelectorAll('.doc-btn').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.doc-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    currentDoc = b.dataset.doc;
    refreshReadouts();
  });
});
$('copyCounter').textContent = '0 copies made · 0 fires';

/* ==========================================================================
   MACHINE Ⅰ — the process line.
   ========================================================================== */
const pCanvas = $('processCanvas'), pc = pCanvas.getContext('2d');
const CYCLE = X.copyCycleSeconds();
const SLOTS = 28;
const DRUM = { cx: 430, cy: 330, r: 92 };
const STATIONS = { clean: 310, charge: 245, expose: 190, develop: 130, transfer: 90, separate: 50 };
const slots = Array.from({ length: SLOTS }, (_, i) => ({
  base: (i / SLOTS) * 360, state: 'bare', dark: false, V: 0, cov: 0, seed: i * 7919 + 13,
}));
let drumAngle = 0;            // degrees, decreasing (slots flow clean→charge→expose→…)
let running = false, cycleT = 0, copies = 0, fires = 0, fireNow = false, smoke = [], copiesStack = [];
let paperCols = null;         // per-slot captured coverage → becomes the output copy
$('copyBtn').addEventListener('click', () => {
  if (running) return;
  running = true; cycleT = 0; fireNow = false; paperCols = new Array(SLOTS).fill(0);
});

function slotAngle(slot) { return ((slot.base + drumAngle) % 360 + 360) % 360; }
function crossed(prev, cur, target) {
  // did a slot moving from angle prev to angle cur (decreasing, modulo) pass `target`?
  const p = ((prev % 360) + 360) % 360, c = ((cur % 360) + 360) % 360;
  if (p >= c) return target <= p && target > c;
  return target <= p || target > c; // wrapped
}
function slotXY(slot, extra = 0) {
  const a = ((slot.base + drumAngle + extra) * Math.PI) / 180;
  return [DRUM.cx + (DRUM.r + extra) * Math.cos(a), DRUM.cy + (DRUM.r + extra) * Math.sin(a)];
}

function updateProcess(dt) {
  if (!running) return;
  const dAng = (dt / CYCLE) * 360;
  const prev = drumAngle;
  drumAngle -= dAng;
  cycleT += dt;
  const lampP = clamp(cycleT / (CYCLE * 0.55), 0, 1);
  for (const s of slots) {
    const pv = ((s.base + prev) % 360 + 360) % 360, cu = ((s.base + drumAngle) % 360 + 360) % 360;
    if (crossed(pv, cu, STATIONS.charge)) {
      s.state = D.coronaOn ? 'charged' : 'bare'; s.V = D.coronaOn ? S.V0 : 0; s.cov = 0; s.dark = false;
    }
    if (crossed(pv, cu, STATIONS.expose) && s.state === 'charged') {
      const col = clamp(Math.floor(lampP * DOCS[currentDoc].w), 0, DOCS[currentDoc].w - 1);
      const frac = DOCS[currentDoc].colDark[col] / Math.max(1, DOCS[currentDoc].colCount[col]);
      s.dark = frac > 0.5;
      s.V = s.dark ? D.vImg : D.vBg;
      s.col = Math.floor((s.base / 360) * SLOTS);
    }
    if (crossed(pv, cu, STATIONS.develop) && s.state === 'charged') {
      s.state = 'toner';
      const c = s.dark ? D.cImg : D.cBg;
      s.cov = c;
    }
    if (crossed(pv, cu, STATIONS.transfer) && s.state === 'toner' && paperCols) {
      paperCols[s.col ?? 0] = s.cov;
      s.cov *= 0.2; // 80 % transfers to paper
    }
    if (crossed(pv, cu, STATIONS.clean)) { s.state = 'bare'; s.V = 0; s.cov = 0; }
  }
  if (!fireNow && cycleT > CYCLE * 0.7 && X.catchesFire(DOCS[currentDoc].coverage, D.MA)) fireNow = true;
  if (fireNow && Math.random() < dt * 26) {
    smoke.push({ x: 566 + Math.random() * 26, y: 300 + Math.random() * 16, vx: (Math.random() - 0.2) * 14, vy: -34 - Math.random() * 30, life: 1 });
  }
  smoke.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.45; });
  smoke = smoke.filter((p) => p.life > 0);
  if (cycleT >= CYCLE) {
    running = false;
    copies++;
    if (fireNow) fires++;
    copiesStack.unshift({ cols: paperCols.slice(), doc: currentDoc, id: copies });
    if (copiesStack.length > 3) copiesStack.pop();
    $('copyCounter').textContent = `${copies} cop${copies === 1 ? 'y' : 'ies'} made · ${fires} fire${fires === 1 ? '' : 's'}`;
  }
}

function drawDocMini(x, y, w, h, id, sepia = false) {
  const doc = DOCS[id];
  pc.save();
  pc.globalAlpha = sepia ? 0.9 : 1;
  if (sepia) { pc.filter = 'sepia(0.5)'; }
  pc.drawImage(doc.canvas, x, y, w, h);
  pc.restore();
}

function drawProcess(t) {
  pc.clearRect(0, 0, 980, 600);
  const lampP = running ? clamp(cycleT / (CYCLE * 0.55), 0, 1) : 0;

  /* machine body */
  pc.fillStyle = '#26201a';
  roundRect(pc, 30, 64, 660, 500, 18); pc.fill();
  pc.strokeStyle = '#3d332a'; pc.lineWidth = 2; pc.stroke();
  /* enamel face */
  pc.fillStyle = '#efe4cb';
  roundRect(pc, 44, 78, 632, 200, 12); pc.fill();
  pc.strokeStyle = '#c9b995'; pc.stroke();
  pc.fillStyle = '#efe4cb';
  roundRect(pc, 44, 296, 632, 252, 12); pc.fill();
  pc.strokeStyle = '#c9b995'; pc.stroke();

  /* platen + document */
  pc.fillStyle = '#9db2c4';
  roundRect(pc, 70, 92, 560, 40, 4); pc.fill();
  pc.strokeStyle = '#5f7386'; pc.stroke();
  pc.fillStyle = '#2a221a';
  roundRect(pc, 76, 84, 548, 12, 3); pc.fill(); // platen cover
  const doc = DOCS[currentDoc];
  const dw = 88, dh = Math.round((88 * doc.h) / doc.w);
  drawDocMini(96, 96, dw, dh, currentDoc);
  /* scan lamp under the platen */
  const lampX = 90 + lampP * 520;
  pc.fillStyle = '#ffe9b0';
  pc.shadowColor = '#ffce5a'; pc.shadowBlur = 16;
  pc.fillRect(lampX - 26, 136, 52, 7);
  pc.shadowBlur = 0;
  pc.fillStyle = '#6f6353'; pc.font = '10px monospace';
  pc.fillText('PLATEN — LAMP SLIT-SCANS THE ORIGINAL', 84, 152);

  /* optics: beam from the slit down to the drum's exposure station */
  const [ex, ey] = slotXYAt(STATIONS.expose);
  pc.strokeStyle = 'rgba(255,224,150,0.30)'; pc.lineWidth = 6;
  pc.beginPath(); pc.moveTo(lampX, 143); pc.lineTo(lampX + 40, 200); pc.lineTo(ex, ey - 6); pc.stroke();
  pc.strokeStyle = 'rgba(255,224,150,0.55)'; pc.lineWidth = 1.5;
  pc.beginPath(); pc.moveTo(lampX, 143); pc.lineTo(lampX + 40, 200); pc.lineTo(ex, ey - 6); pc.stroke();
  pc.fillStyle = '#c9b995'; pc.beginPath(); pc.arc(lampX + 40, 200, 7, 0, 7); pc.fill();
  pc.fillStyle = '#6f6353'; pc.font = '9px monospace'; pc.fillText('lens', lampX + 50, 203);

  /* drum */
  const g = pc.createRadialGradient(DRUM.cx - 30, DRUM.cy - 40, 10, DRUM.cx, DRUM.cy, DRUM.r);
  g.addColorStop(0, '#b9c6d4'); g.addColorStop(0.75, '#8fa3b8'); g.addColorStop(1, '#5f7386');
  pc.beginPath(); pc.arc(DRUM.cx, DRUM.cy, DRUM.r, 0, 7); pc.fillStyle = g; pc.fill();
  pc.lineWidth = 3; pc.strokeStyle = '#43536b'; pc.stroke();
  pc.fillStyle = '#43536b'; pc.beginPath(); pc.arc(DRUM.cx, DRUM.cy, 10, 0, 7); pc.fill();
  /* axle spoke showing rotation */
  const a0 = (drumAngle * Math.PI) / 180;
  pc.strokeStyle = '#43536b'; pc.lineWidth = 4;
  pc.beginPath(); pc.moveTo(DRUM.cx, DRUM.cy);
  pc.lineTo(DRUM.cx + 70 * Math.cos(a0), DRUM.cy + 70 * Math.sin(a0)); pc.stroke();

  /* slot states around the drum */
  for (const s of slots) {
    const a = slotAngle(s);
    const shade = s.state === 'bare' ? null : s.V / Math.max(1, S.V0);
    if (s.state !== 'bare') {
      const col = shade > 0.5 ? `rgba(224,86,78,${0.25 + 0.55 * shade})` : 'rgba(70,60,50,0.5)';
      pc.strokeStyle = col; pc.lineWidth = 7;
      pc.beginPath(); pc.arc(DRUM.cx, DRUM.cy, DRUM.r - 4, ((a - 360 / SLOTS / 2) * Math.PI) / 180, ((a + 360 / SLOTS / 2) * Math.PI) / 180); pc.stroke();
    }
    if (s.cov > 0.02) {
      const rnd = mulberry32(s.seed + Math.floor(t * 2));
      const n = Math.round(s.cov * 7);
      for (let k = 0; k < n; k++) {
        const ang = a + (rnd() - 0.5) * (360 / SLOTS) * 0.8;
        const rr = DRUM.r - 2 - rnd() * 3;
        pc.fillStyle = 'rgba(28,22,16,0.9)';
        pc.beginPath(); pc.arc(DRUM.cx + rr * Math.cos((ang * Math.PI) / 180), DRUM.cy + rr * Math.sin((ang * Math.PI) / 180), 1.7, 0, 7); pc.fill();
      }
    }
  }

  /* stations */
  stationLabel('CHARGE · corona', STATIONS.charge, 52);
  stationLabel('EXPOSE', STATIONS.expose, 40);
  stationLabel('DEVELOP · cascade', STATIONS.develop, 66);
  stationLabel('TRANSFER', STATIONS.transfer, 56);
  stationLabel('SEPARATE', STATIONS.separate, 46);

  /* corona wire + sparks */
  {
    const [cx, cy] = slotXYAt(STATIONS.charge, 26);
    pc.strokeStyle = '#d8c9a8'; pc.lineWidth = 2;
    pc.beginPath(); pc.moveTo(cx - 22, cy - 22); pc.lineTo(cx + 22, cy - 22); pc.stroke();
    if (D.coronaOn) {
      const rnd = mulberry32(1000 + Math.floor(t * 14));
      pc.strokeStyle = '#ffd9a0'; pc.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const sx = cx - 18 + rnd() * 36;
        pc.beginPath(); pc.moveTo(sx, cy - 20);
        pc.lineTo(sx + (rnd() - 0.5) * 10, cy - 10 + rnd() * 8); pc.stroke();
      }
      pc.fillStyle = 'rgba(255,217,160,0.8)';
      for (let k = 0; k < 5; k++) {
        const ph = (t * 1.4 + k * 0.37) % 1;
        pc.beginPath(); pc.arc(cx - 18 + k * 9, cy - 20 + ph * 16, 1.6, 0, 7); pc.fill();
      }
    } else {
      pc.fillStyle = '#e0564e'; pc.font = 'bold 10px monospace';
      pc.fillText('CORONA OFF', cx - 34, cy - 28);
    }
  }

  /* cascade developer: beads pouring over the drum */
  {
    const [dx, dy] = slotXYAt(STATIONS.develop, 24);
    pc.fillStyle = '#6b5637';
    roundRect(pc, dx - 46, dy - 6, 34, 46, 5); pc.fill();
    pc.strokeStyle = '#43536b'; pc.stroke();
    pc.fillStyle = '#6f6353'; pc.font = '9px monospace';
    pc.fillText('beads +', dx - 46, dy + 58); pc.fillText('toner', dx - 46, dy + 68);
    for (let k = 0; k < 9; k++) {
      const ph = ((t * 0.5 + k / 9) % 1);
      const ang = STATIONS.develop + 18 - ph * 46;
      const [bx, by] = slotXYAt(ang, 14 + Math.sin(ph * 9 + k) * 2.5);
      pc.fillStyle = '#c9b995';
      pc.beginPath(); pc.arc(bx, by, 6.5, 0, 7); pc.fill();
      pc.strokeStyle = '#8a7a5a'; pc.lineWidth = 1; pc.stroke();
      const rnd = mulberry32(77 * k + 3);
      for (let j = 0; j < 4; j++) {
        pc.fillStyle = 'rgba(28,22,16,0.95)';
        pc.beginPath(); pc.arc(bx + (rnd() - 0.5) * 11, by + (rnd() - 0.5) * 11, 1.3, 0, 7); pc.fill();
      }
    }
  }

  /* transfer: paper from the tray wrapping the drum */
  {
    const trayX = 240, trayY = 508;
    pc.fillStyle = '#8a7a5a';
    roundRect(pc, trayX, trayY, 160, 30, 5); pc.fill();
    pc.strokeStyle = '#43536b'; pc.stroke();
    pc.fillStyle = '#efe4cb';
    for (let k = 0; k < 3; k++) pc.fillRect(trayX + 14 + k * 3, trayY - 14 - k * 4, 100, 4);
    pc.fillStyle = '#6f6353'; pc.font = '10px monospace';
    pc.fillText('PLAIN PAPER (no master, no negative)', trayX - 6, trayY + 46);

    /* the sheet itself during a run */
    if (running) {
      const p = clamp((cycleT - CYCLE * 0.1) / (CYCLE * 0.8), 0, 1);
      const path = paperPath();
      const total = path.length;
      const front = p * (total - 1);
      pc.strokeStyle = '#f6efdc'; pc.lineWidth = 7; pc.lineCap = 'round';
      pc.beginPath();
      const from = Math.max(0, front - 34);
      pc.moveTo(...path[Math.floor(from)]);
      for (let i = Math.floor(from) + 1; i <= Math.floor(front); i++) pc.lineTo(...path[i]);
      pc.stroke();
      /* toner arriving on the sheet where it touches the drum */
      const [tx, ty] = slotXYAt(STATIONS.transfer, -DRUM.r + 6);
      pc.fillStyle = 'rgba(255,214,140,0.25)';
      pc.beginPath(); pc.arc(tx, ty, 20, 0, 7); pc.fill();
    }
  }

  /* fuser rollers + heat */
  {
    const fx = 566, fy = 316;
    const heat = fireNow ? 1 : clamp((scorchLevel() - 0.2) / 0.5, 0, 1);
    for (const [ox, oy] of [[0, -14], [0, 14]]) {
      const rg = pc.createRadialGradient(fx + ox, fy + oy - 4, 2, fx + ox, fy + oy, 15);
      rg.addColorStop(0, fireNow ? '#ffcf8a' : '#7d6b52');
      rg.addColorStop(1, '#4a3d2d');
      pc.beginPath(); pc.arc(fx + ox, fy + oy, 14, 0, 7); pc.fillStyle = rg; pc.fill();
    }
    if (heat > 0.02 || fireNow) {
      pc.fillStyle = `rgba(242,161,60,${0.10 + 0.25 * heat})`;
      pc.beginPath(); pc.arc(fx, fy, 30 + heat * 10, 0, 7); pc.fill();
    }
    pc.fillStyle = '#6f6353'; pc.font = '10px monospace';
    pc.fillText('FUSER 165 °C', fx - 30, fy + 40);
    if (fireNow) {
      const rnd = mulberry32(55 + Math.floor(t * 16));
      for (let k = 0; k < 5; k++) {
        const fh = 10 + rnd() * 16, fxp = fx - 12 + rnd() * 24;
        const grd = pc.createLinearGradient(0, fy - fh, 0, fy + 8);
        grd.addColorStop(0, 'rgba(255,120,40,0)');
        grd.addColorStop(0.6, 'rgba(255,150,50,0.85)');
        grd.addColorStop(1, 'rgba(255,220,120,0.95)');
        pc.fillStyle = grd;
        pc.beginPath();
        pc.moveTo(fxp - 4, fy + 6);
        pc.quadraticCurveTo(fxp + (rnd() - 0.5) * 10, fy - fh * 0.5, fxp, fy - fh);
        pc.quadraticCurveTo(fxp + (rnd() - 0.5) * 10, fy - fh * 0.5, fxp + 4, fy + 6);
        pc.fill();
      }
    }
    /* smoke */
    for (const p of smoke) {
      pc.fillStyle = `rgba(120,110,100,${0.30 * p.life})`;
      pc.beginPath(); pc.arc(p.x, p.y, 5 + (1 - p.life) * 7, 0, 7); pc.fill();
    }
    /* scorch eliminator */
    if (fireNow) {
      pc.fillStyle = '#c0392b';
      roundRect(pc, 612, 372, 16, 34, 4); pc.fill();
      pc.fillStyle = '#2a221a'; pc.fillRect(616, 366, 8, 7);
      pc.fillStyle = '#ffd9a0'; pc.font = 'bold 9px monospace';
      pc.fillText('SCORCH', 596, 418); pc.fillText('ELIMINATOR', 596, 428);
    }
  }

  /* erase lamp + cleaner blade */
  {
    const [cx, cy] = slotXYAt(STATIONS.clean, 22);
    pc.fillStyle = '#8a7a5a'; pc.fillRect(cx - 3, cy - 16, 20, 5);
    pc.strokeStyle = 'rgba(255,240,190,0.7)'; pc.lineWidth = 2;
    pc.beginPath(); pc.moveTo(cx + 14, cy - 20); pc.lineTo(cx + 20, cy + 2); pc.stroke();
    stationLabel('CLEAN + ERASE', STATIONS.clean, 48);
  }

  /* output tray with finished copies */
  pc.fillStyle = '#8a7a5a';
  roundRect(pc, 668, 250, 172, 60, 6); pc.fill();
  pc.strokeStyle = '#43536b'; pc.lineWidth = 2; pc.stroke();
  pc.fillStyle = '#6f6353'; pc.font = '10px monospace';
  pc.fillText('OUTPUT', 674, 326);
  copiesStack.forEach((cp, i) => {
    const cw = 74, ch = Math.round((74 * DOCS[cp.doc].h) / DOCS[cp.doc].w);
    const x = 846 - i * 8 - cw / 2, y = 292 - ch - i * 5;
    pc.save();
    pc.translate(x + cw / 2, y + ch / 2); pc.rotate((i * 2 - 2) * 0.012);
    drawCopyPage(pc, -cw / 2, -ch / 2, cw, ch, cp);
    pc.restore();
  });

  /* caption strip */
  pc.fillStyle = '#6f6353'; pc.font = '11px monospace';
  pc.fillText(`HALOID-XEROX MODEL 914 · 9 × 14 IN · ${X.M914.weightLb} LB · 7 COPIES/MIN · ONE SELENIUM REVOLUTION PER COPY`, 44, 588);
}
function slotXYAt(deg, extra = 0) {
  const a = (deg * Math.PI) / 180;
  return [DRUM.cx + (DRUM.r + extra) * Math.cos(a), DRUM.cy + (DRUM.r + extra) * Math.sin(a)];
}
function stationLabel(text, deg, off) {
  const [x, y] = slotXYAt(deg, off);
  pc.fillStyle = '#e0564e'; pc.font = 'bold 10px monospace';
  pc.save();
  pc.shadowColor = '#000'; pc.shadowBlur = 4;
  pc.fillText(text, x - text.length * 2.6, y);
  pc.restore();
}
function paperPath() {
  const pts = [];
  const push = (x, y) => pts.push([x, y]);
  push(255, 490); push(285, 452); push(315, 424);
  for (let a = 104; a >= 58; a -= 2) {
    const [x, y] = slotXYAt(a, 4);
    push(x, y);
  }
  push(488, 400); push(532, 362); push(566, 330); push(596, 316); push(650, 300); push(716, 288);
  return pts;
}
function scorchLevel() {
  return X.scorchLoad(DOCS[currentDoc].coverage, D.MA);
}
/* Draw a finished copy: toner speckles at the live coverage. */
function drawCopyPage(c, x, y, w, h, cp) {
  c.fillStyle = '#f6efdc';
  c.fillRect(x, y, w, h);
  c.strokeStyle = '#c9b995'; c.lineWidth = 1; c.strokeRect(x, y, w, h);
  const doc = DOCS[cp.doc];
  const rnd = mulberry32(cp.id * 104729);
  const dotR = Math.max(0.7, w / 24 / 2.6);
  for (let j = 0; j < 24; j++) {
    for (let k = 0; k < 36; k++) {
      const isDark = doc.grid[j * 36 + k] === 1;
      const p = isDark ? (D.regime === 'blank' ? 0 : D.cImg) : D.cBg;
      if (p > 0.01 && rnd() < p) {
        c.fillStyle = isDark ? `rgba(30,24,18,${0.55 + 0.4 * rnd()})` : 'rgba(60,54,46,0.5)';
        c.beginPath();
        c.arc(x + ((j + 0.3 + rnd() * 0.4) / 24) * w, y + ((k + 0.3 + rnd() * 0.4) / 36) * h, dotR, 0, 7);
        c.fill();
      }
    }
  }
}

/* roundRect helper (avoid depending on ctx.roundRect availability) */
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/* ==========================================================================
   MACHINE Ⅱ — corona cell + selenium slab.
   ========================================================================== */
const coCanvas = $('coronaCanvas'), coc = coCanvas.getContext('2d');
const seCan = $('seCanvas'), sec = seCan.getContext('2d');

function drawCorona(t) {
  coc.clearRect(0, 0, 560, 380);
  coc.fillStyle = '#100d0a'; coc.fillRect(0, 0, 560, 380);
  const wireX = 150, wireY = 78;
  const gapPx = (S.coronaGap * 1000) * 13;
  const planeY = wireY + gapPx;

  coc.fillStyle = '#6f6353'; coc.font = '11px monospace';
  coc.fillText('CORONA CELL — wire above the drum', 14, 20);

  /* drum surface */
  coc.strokeStyle = '#8fa3b8'; coc.lineWidth = 7;
  coc.beginPath(); coc.moveTo(30, planeY); coc.lineTo(340, planeY); coc.stroke();
  coc.strokeStyle = '#43536b'; coc.lineWidth = 1;
  coc.strokeRect(30, planeY, 310, 16);
  coc.fillStyle = '#6f6353';
  coc.fillText('selenium drum surface', 34, planeY + 30);
  coc.fillText(`h = ${fmt(S.coronaGap * 1000, 1)} mm`, 344, planeY + 4);

  /* field lines: circles through the wire, centred on the ground plane */
  coc.strokeStyle = 'rgba(143,163,184,0.30)'; coc.lineWidth = 1;
  for (const ci of [-110, -70, -38, 0, 38, 70, 110]) {
    const cx = wireX + ci, cy = planeY;
    const r = Math.hypot(ci, planeY - wireY);
    coc.beginPath();
    coc.arc(cx, cy, r, Math.PI + Math.atan2(-(planeY - wireY), ci), Math.atan2(-(planeY - wireY), ci) + 2 * Math.PI, false);
    coc.stroke();
  }
  /* the wire, glowing if past Peek onset */
  if (D.coronaOn) {
    const rg = coc.createRadialGradient(wireX, wireY, 1, wireX, wireY, 26);
    rg.addColorStop(0, 'rgba(255,224,150,0.95)'); rg.addColorStop(1, 'rgba(255,224,150,0)');
    coc.fillStyle = rg;
    coc.beginPath(); coc.arc(wireX, wireY, 26, 0, 7); coc.fill();
  }
  coc.strokeStyle = '#ffd9a0'; coc.lineWidth = 2.5;
  coc.beginPath(); coc.moveTo(wireX - 26, wireY); coc.lineTo(wireX + 26, wireY); coc.stroke();
  coc.fillStyle = '#6f6353';
  coc.fillText(`wire r = ${fmt(S.wireR * 1e6)} µm @ ${fmt(S.coronaV)} V`, 40, wireY - 12);

  /* ions drifting from the wire to the drum */
  if (D.coronaOn) {
    const rnd = mulberry32(31 + Math.floor(t * 10));
    coc.fillStyle = 'rgba(255,217,160,0.85)';
    for (let k = 0; k < 12; k++) {
      const ci = [-90, -55, -26, 0, 26, 55, 90][k % 7];
      const ph = (t * 0.55 + rnd()) % 1;
      const px = wireX + ci * ph * 0.7 + (rnd() - 0.5) * 4;
      const py = wireY + 8 + ph * (planeY - wireY - 16);
      if (px > 20 && px < 350) { coc.beginPath(); coc.arc(px, py, 1.7, 0, 7); coc.fill(); }
    }
  } else {
    coc.fillStyle = '#e0564e'; coc.font = 'bold 11px monospace';
    coc.fillText('BELOW PEEK ONSET — NO CORONA, NO CHARGE', 40, wireY + 34);
  }

  /* meters */
  const mx = 370, mw = 170;
  coc.fillStyle = '#ece4d4'; coc.font = 'bold 11px monospace';
  coc.fillText('WIRE SURFACE', mx, 52);
  meter(coc, mx, 62, mw, D.wireField / 1e6, 25, `${fmt(D.wireField / 1e6, 1)} V/µm`, '#ffd9a0');
  meter(coc, mx, 92, mw, D.peek / 1e6, 25, `Peek onset ${fmt(D.peek / 1e6, 1)}`, '#e0564e');
  coc.fillStyle = D.coronaOn ? '#57d9a3' : '#e0564e';
  coc.fillText(D.coronaOn ? '✓ air breaks down — ions spray' : '✗ dark: field below onset', mx, 128);

  coc.fillStyle = '#ece4d4'; coc.font = 'bold 11px monospace';
  coc.fillText('VOLTAGE', mx, 172);
  meter(coc, mx, 182, mw, D.onsetV / 8000, 1, `ignites at ${fmt(D.onsetV)} V`, '#e0564e');
  meter(coc, mx, 212, mw, S.coronaV / 8000, 1, `supply ${fmt(S.coronaV)} V`, '#ffd9a0');

  coc.fillStyle = '#a99b86'; coc.font = '10px monospace';
  coc.fillText('E(r) = V / (r·ln 2h/r)', mx, 250);
  coc.fillText('E₀ = 30(1+0.301/√r) kV/cm', mx, 266);
  coc.fillText('→ thin wire, mild volts,', mx, 288);
  coc.fillText('  violent surface field', mx, 302);
}
function meter(c, x, y, w, frac, _, label, color) {
  c.fillStyle = '#2e251c';
  roundRect(c, x, y, w, 12, 6); c.fill();
  c.fillStyle = color;
  roundRect(c, x, y, Math.max(3, clamp(frac, 0, 1) * w), 12, 6); c.fill();
  c.fillStyle = '#a99b86'; c.font = '10px monospace';
  c.fillText(label, x, y + 26);
}

function drawSelenium(t) {
  sec.clearRect(0, 0, 560, 380);
  sec.fillStyle = '#100d0a'; sec.fillRect(0, 0, 560, 380);
  sec.fillStyle = '#6f6353'; sec.font = '11px monospace';
  sec.fillText('THE SELENIUM LAYER — a capacitor that light can erase', 14, 20);

  /* slab */
  const sx = 40, sw = 300, subY = 250, seH = 26 + (S.d / 60e-6) * 46;
  sec.fillStyle = '#3b3129'; sec.fillRect(sx, subY, sw, 14); /* substrate hatch */
  sec.strokeStyle = '#6f6353';
  for (let i = 0; i < 24; i++) { sec.beginPath(); sec.moveTo(sx + i * 12, subY + 14); sec.lineTo(sx + i * 12 + 8, subY); sec.stroke(); }
  sec.fillStyle = 'rgba(143,163,184,0.5)';
  sec.fillRect(sx, subY - seH, sw, seH);
  sec.strokeStyle = '#8fa3b8'; sec.strokeRect(sx, subY - seH, sw, seH);
  sec.fillStyle = '#a99b86'; sec.font = '10px monospace';
  sec.fillText(`a-Se  d = ${fmt(S.d * 1e6)} µm   (${fmt(D.capPF)} pF/cm², σ = ${fmt(D.sigma * 1e3, 2)} mC/m²)`, sx, subY + 30);
  sec.fillText('aluminium drum', sx, subY + 44);

  /* surface charge row */
  const on = D.coronaOn;
  const nPlus = on ? 14 : 0;
  for (let i = 0; i < 14; i++) {
    const px = sx + 12 + i * 20, py = subY - seH - 8;
    sec.fillStyle = on ? '#e0564e' : '#4a3d2d';
    sec.font = 'bold 12px monospace';
    sec.fillText('+', px, py);
  }
  sec.fillStyle = '#a99b86'; sec.font = '10px monospace';
  sec.fillText(on ? `charged to ${fmt(S.V0)} V` : 'uncharged', sx + 220, subY - seH - 12);

  /* the light */
  const lamColor = lambdaColor(S.lambda);
  const sees = X.spectralResponse(S.lambda) === 1;
  const beamX = 120;
  sec.strokeStyle = lamColor; sec.lineWidth = sees ? 5 : 3;
  sec.globalAlpha = sees ? 0.55 : 0.25;
  sec.beginPath(); sec.moveTo(beamX, 96); sec.lineTo(beamX, subY - seH - 4); sec.stroke();
  sec.globalAlpha = 1;
  sec.fillStyle = lamColor; sec.font = '10px monospace';
  sec.fillText(`λ = ${fmt(S.lambda * 1e9)} nm`, beamX + 8, 104);
  if (!sees) {
    sec.fillStyle = '#e0564e'; sec.font = 'bold 10px monospace';
    sec.fillText('past the 610 nm band edge — not absorbed, does nothing', beamX + 8, subY - seH - 26);
  } else {
    /* discharging: minus symbols flowing, charge row fading on the lit patch */
    sec.fillStyle = '#ffd9a0';
    const rnd = mulberry32(9 + Math.floor(t * 12));
    for (let k = 0; k < 6; k++) {
      const ph = (t * 0.8 + k / 6) % 1;
      sec.globalAlpha = 1 - ph;
      sec.fillText('−', beamX - 8 + (rnd() - 0.5) * 18, 100 + ph * (subY - seH - 110));
      sec.globalAlpha = 1;
    }
  }

  /* dark decay mini-plot */
  plotFrame(sec, 356, 60, 190, 120, 'dark decay V(t)');
  sec.strokeStyle = '#e0564e'; sec.lineWidth = 2;
  sec.beginPath();
  for (let i = 0; i <= 40; i++) {
    const tt = (i / 40) * 10;
    const v = X.darkDecay(S.V0, tt, D.tau);
    const px = 356 + (i / 40) * 190, py = 180 - clamp(v / 1100, 0, 1) * 120;
    i ? sec.lineTo(px, py) : sec.moveTo(px, py);
  }
  sec.stroke();
  const halfX = 356 + (X.halfRotationSeconds() / 10) * 190;
  sec.strokeStyle = '#57d9a3'; sec.setLineDash([3, 3]);
  sec.beginPath(); sec.moveTo(halfX, 56); sec.lineTo(halfX, 182); sec.stroke(); sec.setLineDash([]);
  sec.fillStyle = '#a99b86'; sec.font = '9px monospace';
  sec.fillText(`τ = ρε = ${fmt(D.tau, 1)} s`, 360, 196);
  sec.fillText('half-rev', halfX + 3, 68);

  /* PIDC mini-plot */
  plotFrame(sec, 356, 216, 190, 120, 'discharge vs exposure');
  const fogV = D.vBgNoFog;
  sec.strokeStyle = '#e0564e'; sec.lineWidth = 2;
  sec.beginPath();
  for (let i = 0; i <= 40; i++) {
    const f = (i / 40) * 6;
    const v = X.pid(f, S.V0, S.Vr, S.lambda, S.eta, S.d);
    const px = 356 + (i / 40) * 190, py = 336 - clamp(v / 1100, 0, 1) * 120;
    i ? sec.lineTo(px, py) : sec.moveTo(px, py);
  }
  sec.stroke();
  const fogY = 336 - clamp(fogV / 1100, 0, 1) * 120;
  sec.strokeStyle = '#57d9a3'; sec.setLineDash([3, 3]);
  sec.beginPath(); sec.moveTo(356, fogY); sec.lineTo(546, fogY); sec.stroke(); sec.setLineDash([]);
  sec.fillStyle = '#a99b86'; sec.font = '9px monospace';
  sec.fillText(`white areas: ${fmt(D.vBg)} V`, 360, 350);
  sec.fillText(`must drop below ${fmt(fogV)} V or it fogs (machine Ⅲ)`, 356, 362);
  sec.fillText(`1 erg/cm² ⇒ ${fmt(D.perErg, 0)} V`, 448, 230);
}
function plotFrame(c, x, y, w, h, title) {
  c.fillStyle = '#1a1510';
  roundRect(c, x, y - 16, w, h + 22, 6); c.fill();
  c.strokeStyle = '#3d332a'; c.stroke();
  c.fillStyle = '#a99b86'; c.font = '9px monospace';
  c.fillText(title, x + 4, y - 3);
}
function lambdaColor(l) {
  const nm = l * 1e9;
  if (nm < 450) return '#9d7bff';
  if (nm < 500) return '#6aa6f0';
  if (nm < 550) return '#57d9a3';
  if (nm < 590) return '#f2c14e';
  return '#e0564e';
}

/* ==========================================================================
   MACHINE Ⅲ — cascade development.
   ========================================================================== */
const caCanvas = $('cascadeCanvas'), cac = caCanvas.getContext('2d');
function drawCascade(t) {
  cac.clearRect(0, 0, 660, 430);
  cac.fillStyle = '#100d0a'; cac.fillRect(0, 0, 660, 430);
  cac.fillStyle = '#6f6353'; cac.font = '11px monospace';
  cac.fillText('BEAD CURTAIN OVER THE LATENT IMAGE — zoomed to the development zone', 14, 20);

  const surfY = 320;
  /* drum surface strip: image zone (charged) in the middle */
  cac.fillStyle = '#3b3129'; cac.fillRect(0, surfY + 8, 660, 110);
  const imgX0 = 210, imgX1 = 430;
  /* background zones: residual charge (few +) */
  for (const [zx0, zx1, dens] of [[20, imgX0, 0.12], [imgX1, 640, 0.12]]) {
    for (let x = zx0; x < zx1; x += 26) {
      if (Math.random() < 0.5) continue;
      cac.fillStyle = 'rgba(224,86,78,0.4)';
      cac.font = 'bold 11px monospace';
      cac.fillText('+', x, surfY);
    }
  }
  for (let x = imgX0; x < imgX1; x += 16) {
    cac.fillStyle = '#e0564e';
    cac.font = 'bold 12px monospace';
    cac.fillText('+', x, surfY);
  }
  cac.fillStyle = '#e0564e'; cac.font = 'bold 10px monospace';
  cac.fillText('IMAGE AREA (dark on the original) — still charged', imgX0, surfY + 26);
  cac.fillStyle = '#a99b86';
  cac.fillText('white areas discharged', 24, surfY + 26);

  /* beads rolling right→left over the surface */
  const beadR = 24;
  for (let k = 0; k < 10; k++) {
    const ph = ((t * 0.16 + k / 10) % 1);
    const bx = 660 - ph * 680;
    const hop = Math.abs(Math.sin(ph * 22 + k * 1.7)) * 6;
    const by = surfY - beadR - 4 - hop;
    cac.fillStyle = 'rgba(201,185,149,0.95)';
    cac.beginPath(); cac.arc(bx, by, beadR, 0, 7); cac.fill();
    cac.strokeStyle = '#8a7a5a'; cac.lineWidth = 1.5; cac.stroke();
    cac.strokeStyle = '#43536b'; cac.beginPath(); cac.moveTo(bx, by - beadR); cac.lineTo(bx, by + beadR); cac.stroke();
    /* toner fur: dots clinging to the bead */
    const rnd = mulberry32(500 + k * 31);
    for (let j = 0; j < 9; j++) {
      const a = rnd() * Math.PI * 2;
      const rr = beadR + 2 + rnd() * 2;
      cac.fillStyle = 'rgba(28,22,16,0.95)';
      cac.beginPath(); cac.arc(bx + rr * Math.cos(a), by + rr * Math.sin(a), 2.2, 0, 7); cac.fill();
    }
    /* toner jumping onto the image area */
    const overImage = bx > imgX0 + beadR * 0.5 && bx < imgX1 - beadR * 0.5;
    if (overImage && D.cImg > 0.02 && D.regime !== 'blank') {
      const jr = mulberry32(900 + k * 7 + Math.floor(t * 3));
      for (let j = 0; j < 3; j++) {
        const ph2 = jr();
        const jx = bx + (jr() - 0.5) * beadR * 1.6;
        cac.fillStyle = `rgba(28,22,16,${0.9})`;
        cac.beginPath();
        cac.arc(jx, by + beadR + ph2 * (surfY - by - beadR) * 0.9, 2, 0, 7);
        cac.fill();
      }
      /* deposited dust on the surface */
      const dr = mulberry32(80 + k * 3 + Math.floor(t * 2));
      for (let j = 0; j < Math.round(D.cImg * 8); j++) {
        cac.fillStyle = 'rgba(28,22,16,0.85)';
        cac.beginPath();
        cac.arc(imgX0 + dr() * (imgX1 - imgX0), surfY + 4 + dr() * 6, 1.6, 0, 7);
        cac.fill();
      }
    }
  }
  /* background fog dust */
  if (D.cBg > 0.02) {
    const fr = mulberry32(31337 + Math.floor(t * 2));
    for (let j = 0; j < Math.round(D.cBg * 40); j++) {
      cac.fillStyle = 'rgba(60,54,46,0.6)';
      cac.beginPath();
      cac.arc(fr() < 0.5 ? 20 + fr() * (imgX0 - 20) : imgX1 + fr() * (640 - imgX1), surfY + 4 + fr() * 6, 1.5, 0, 7);
      cac.fill();
    }
    cac.fillStyle = '#9aa0a6'; cac.font = 'bold 10px monospace';
    cac.fillText('BACKGROUND FOG', 24, surfY + 44);
  }
  if (D.regime === 'blank') {
    cac.fillStyle = '#e0564e'; cac.font = 'bold 11px monospace';
    cac.fillText('NOTHING RELEASES — the toner is held too hard, the copy comes out white', 150, surfY + 58);
  }

  /* copy swatch */
  cac.fillStyle = '#6f6353'; cac.font = '10px monospace';
  cac.fillText('RESULTING COPY', 18, 52);
  const swx = 18, swy = 60, sww = 120, swh = 176;
  cac.fillStyle = '#f6efdc';
  roundRect(cac, swx, swy, sww, swh, 3); cac.fill();
  const rnd = mulberry32(4242);
  /* image block = the word 914 big */
  cac.save();
  for (let j = 0; j < 300; j++) {
    const px = swx + 10 + rnd() * (sww - 20), py = swy + 12 + rnd() * (swh - 24);
    const inImage = px > swx + 18 && px < swx + sww - 18 && py > swy + 34 && py < swy + swh - 60;
    const p = inImage ? D.cImg : D.cBg;
    if (rnd() < p) {
      cac.fillStyle = inImage ? 'rgba(28,22,16,0.92)' : 'rgba(60,54,46,0.55)';
      cac.beginPath(); cac.arc(px, py, 1.4, 0, 7); cac.fill();
    }
  }
  cac.fillStyle = '#3b3129'; cac.font = 'bold 26px monospace';
  cac.fillText('914', swx + 30, swy + 120);
  cac.fillStyle = '#6f6353'; cac.font = '9px monospace';
  cac.fillText('image ⇢ coverage ' + fmt(D.cImg * 100) + '%', swx + 6, swh + swy + 14);
  cac.restore();

  /* force balance sketch */
  const fx = 180, fy = 110;
  cac.fillStyle = '#6f6353'; cac.font = '10px monospace';
  cac.fillText('ONE TONER PARTICLE ON A BEAD', fx, fy - 26);
  cac.strokeStyle = '#c9b995'; cac.lineWidth = 1.5;
  cac.beginPath(); cac.arc(fx, fy + 34, 30, Math.PI, 2 * Math.PI); cac.stroke();
  cac.fillStyle = '#281c10';
  cac.beginPath(); cac.arc(fx, fy + 2, 5, 0, 7); cac.fill();
  const Efrac = clamp(D.E / Math.max(D.release, D.E) / 1, 0.05, 1);
  arrow(cac, fx, fy, fx + Efrac * 74, fy, '#57d9a3', `qE = q·${fmt(D.E / 1e6, 2)} V/µm`);
  arrow(cac, fx, fy, fx - 46 * (D.release / Math.max(D.release, D.E)), fy, '#e0564e', `adhesion ${fmt(D.release / 1e6, 2)} V/µm-equiv`);
  cac.fillStyle = '#a99b86'; cac.font = '9px monospace';
  cac.fillText('adhesion grows with toner radius — that is why toner is ~10 µm, not dust, not sand', fx - 20, fy + 64);
  cac.fillStyle = D.regime === 'good' ? '#57d9a3' : '#e0564e';
  cac.font = 'bold 11px monospace';
  cac.fillText(D.regime === 'good' ? '✓ qE wins — toner flies to the image' : D.regime === 'fog' ? '✗ background pulls toner too — grey wash' : '✗ adhesion wins — white copy', fx - 20, fy + 84);

  /* spectral note */
  cac.fillStyle = '#6f6353'; cac.font = '9.5px monospace';
  cac.fillText(`qm ${fmt(S.qm * 1e6, 1)} µC/g · toner r ${fmt(S.tonerR * 1e6, 1)} µm · gap ${fmt(S.gap * 1e6)} µm`, 200, 416);
}
function arrow(c, x0, y0, x1, y1, color, label) {
  c.strokeStyle = color; c.lineWidth = 2.4;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x1 - 8 * Math.cos(a - 0.4), y1 - 8 * Math.sin(a - 0.4));
  c.lineTo(x1 - 8 * Math.cos(a + 0.4), y1 - 8 * Math.sin(a + 0.4));
  c.fill();
  c.font = '9px monospace';
  c.fillText(label, x1 + (x1 > x0 ? 4 : -4) - (x1 > x0 ? 0 : 60), y1 - 5);
}

/* ==========================================================================
   MACHINE Ⅳ — the copy economy.
   ========================================================================== */
const costCanvas = $('costCanvas'), cc = costCanvas.getContext('2d');
let volume = 5000, originals = 10;
$('in-volume').value = volume; $('v-volume').textContent = `${volume.toLocaleString()}/mo`;
$('in-originals').value = originals; $('v-originals').textContent = `${originals}`;
$('in-volume').addEventListener('input', (e) => { volume = +e.target.value; $('v-volume').textContent = `${volume.toLocaleString()}/mo`; refreshReadouts(); });
$('in-originals').addEventListener('input', (e) => { originals = +e.target.value; $('v-originals').textContent = `${originals}`; refreshReadouts(); });

const COST_COLORS = { lease: '#e0564e', rent: '#f2a13c', Photostat: '#9aa0a6', Verifax: '#8fa3b8', Thermofax: '#6aa6f0', Mimeograph: '#9d7bff' };
function drawCost() {
  cc.clearRect(0, 0, 700, 430);
  cc.fillStyle = '#100d0a'; cc.fillRect(0, 0, 700, 430);
  const L = 62, R = 545, T = 30, B = 352;
  const xOf = (n) => L + ((Math.log10(n) - 2) / 3) * (R - L);
  const yOf = (cents) => T + (1 - (Math.log10(cents) - 0) / Math.log10(60)) * (B - T);

  cc.strokeStyle = '#3d332a'; cc.fillStyle = '#6f6353'; cc.font = '10px monospace';
  for (const c of [1, 2, 5, 10, 20, 50]) {
    const y = yOf(c);
    cc.beginPath(); cc.moveTo(L, y); cc.lineTo(R, y); cc.stroke();
    cc.fillText(`${c}¢`, 38, y + 3);
  }
  for (const n of [100, 1000, 10000, 100000]) {
    const x = xOf(n);
    cc.beginPath(); cc.moveTo(x, T); cc.lineTo(x, B); cc.stroke();
    cc.fillText(n >= 1000 ? `${n / 1000}k` : `${n}`, x - 8, B + 16);
  }
  cc.fillText('copies per month (log)', 220, B + 34);
  cc.save(); cc.translate(16, 230); cc.rotate(-Math.PI / 2);
  cc.fillText('cost per copy (¢, log)', 0, 0);
  cc.restore();

  const curves = [
    ['lease', '914 lease $95/mo', (n) => X.perCopy(X.leaseMonthly(n), n) * 100],
    ['rent', '1965 meter', (n) => X.perCopy(X.rentMonthly(n), n) * 100],
    ['Photostat', 'Photostat 35¢', () => 35],
    ['Verifax', 'Verifax 15¢', () => 15],
    ['Thermofax', 'Thermofax 7.5¢', () => 7.5],
    ['Mimeograph', `mimeo, ${originals} masters`, (n) => X.perCopy(X.mimeoMonthly(n, originals), n) * 100],
  ];
  let ly = 52;
  for (const [key, label, f] of curves) {
    cc.strokeStyle = COST_COLORS[key]; cc.lineWidth = key === 'lease' ? 3 : 2;
    if (key === 'rent') cc.setLineDash([6, 4]);
    cc.beginPath();
    let started = false;
    for (let i = 0; i <= 160; i++) {
      const n = Math.pow(10, 2 + (i / 160) * 3);
      const v = f(n);
      if (v <= 0.8 || v > 58) { started = false; continue; }
      const px = xOf(n), py = yOf(v);
      started ? cc.lineTo(px, py) : cc.moveTo(px, py);
      started = true;
    }
    cc.stroke(); cc.setLineDash([]);
    cc.strokeStyle = COST_COLORS[key]; cc.lineWidth = 6;
    if (key === 'rent') cc.setLineDash([5, 3]);
    cc.beginPath(); cc.moveTo(560, ly - 3); cc.lineTo(574, ly - 3); cc.stroke(); cc.setLineDash([]);
    cc.fillStyle = '#ece4d4'; cc.font = '10px monospace';
    cc.fillText(label, 580, ly);
    ly += 19;
  }

  /* break-even markers */
  const bes = [
    ['Photostat', 0.35], ['Verifax', 0.15], ['Thermofax', 0.075],
  ].map(([k, r]) => [k, X.crossoverFlat(r)]).filter(([, n]) => n && n >= 100);
  for (const [k, n] of bes) {
    cc.fillStyle = COST_COLORS[k];
    cc.beginPath(); cc.arc(xOf(n), yOf(X.perCopy(X.leaseMonthly(n), n) * 100), 4, 0, 7); cc.fill();
    cc.font = '9px monospace';
    cc.fillText(`${k} loses at ${Math.round(n)}/mo`, xOf(n) - 24, yOf(X.perCopy(X.leaseMonthly(n), n) * 100) - 8);
  }
  const xm = X.crossoverMimeo(originals);
  if (xm && xm >= 100 && xm <= 100000) {
    cc.fillStyle = COST_COLORS.Mimeograph;
    cc.beginPath(); cc.arc(xOf(xm), yOf(X.perCopy(X.mimeoMonthly(xm, originals), xm) * 100), 4, 0, 7); cc.fill();
  }

  /* current volume marker */
  const mv = xOf(volume);
  cc.strokeStyle = '#ece4d4'; cc.setLineDash([4, 4]);
  cc.beginPath(); cc.moveTo(mv, T); cc.lineTo(mv, B); cc.stroke(); cc.setLineDash([]);
  cc.fillStyle = '#ece4d4'; cc.font = 'bold 10px monospace';
  cc.fillText(`${volume.toLocaleString()}/mo`, mv - 26, T + 12);

  cc.fillStyle = '#6f6353'; cc.font = '9.5px monospace';
  cc.fillText('flat-rate rivals lose to the lease almost immediately; the mimeograph only wins on long runs of few originals', 62, 396);
  cc.fillText('the 914 never beat the mimeograph on pennies — it beat the 39 steps and the stencil', 62, 412);
}

function buildTimeline() {
  const track = document.querySelector('#timeline .tl-track');
  for (const [date, title, text] of X.TIMELINE) {
    const el = document.createElement('div');
    el.className = 'tl-item' + (date === '1959-09-16' ? ' fire' : '');
    el.innerHTML = `<div class="tl-date">${date}</div><div class="tl-title">${title}</div>${text}`;
    track.appendChild(el);
  }
}
buildTimeline();

/* ==========================================================================
   Readouts.
   ========================================================================== */
function refreshReadouts() {
  const fire = X.scorchLoad(DOCS[currentDoc].coverage, D.MA);
  const chip = fire > X.SCORCH_FIRE ? ['ON FIRE 🔥', 'off'] : fire > X.SCORCH_SMOKE ? ['SMOKING', 'warm'] : ['COLD', 'on'];
  $('processReadout').innerHTML = `
    <h3>Live stations</h3>
    <div class="kv"><span class="k">① corona charge</span><span class="v ${D.coronaOn ? 'ok' : 'hot'}">${D.coronaOn ? '+' + fmt(S.V0) + ' V' : 'no corona'}</span></div>
    <div class="kv"><span class="k">② exposure · image</span><span class="v">${fmt(D.vImg)} V</span></div>
    <div class="kv"><span class="k">② exposure · white</span><span class="v">${fmt(D.vBg)} V</span></div>
    <div class="kv"><span class="k">② contrast potential</span><span class="v">${fmt(D.Vc)} V</span></div>
    <div class="kv"><span class="k">③ developed mass</span><span class="v">${fmt(X.mgPerCm2(D.MA), 2)} mg/cm²</span></div>
    <div class="kv"><span class="k">③ coverage</span><span class="v">${fmt(D.cImg * 100)} %</span></div>
    <div class="kv"><span class="k">④ transfer to paper</span><span class="v">80 %</span></div>
    <div class="kv"><span class="k">⑤ fuser</span><span class="v warm">165 °C</span></div>
    <div class="kv"><span class="k">⑤ toner per copy</span><span class="v">${fmt(D.tonerPerCopy * 1e3, 2)} g</span></div>
    <div class="kv"><span class="k">⑤ melt energy</span><span class="v">${fmt(D.meltJ, 1)} J · ${fmt(D.meltW, 1)} W</span></div>
    <div class="formula">V(f) = V₀ − (e·η·λ/hc)·(d/ε)·f<br>until the trapping residual V<sub>r</sub></div>
    <h3>Scorch gauge</h3>
    <div class="kv"><span class="k">this original</span><span class="v">${fmt(DOCS[currentDoc].coverage * 100)} % dark</span></div>
    <div class="kv"><span class="k">fuser load</span><span class="v ${chip[1]}">${chip[0]}</span></div>
    <div class="note">The 914 had a documented taste for catching fire on copy-heavy originals — pages of zeros and O's — and Xerox shipped a little extinguisher with each machine, informally the <b>scorch eliminator</b>. Ralph Nader's office reported three fires in four months.</div>`;

  const reg = D.regime;
  const regChip = reg === 'good' ? ['GOOD COPY', 'on'] : reg === 'fog' ? ['GREY FOG', 'warm'] : ['WHITE COPY', 'off'];
  $('devReadout').innerHTML = `
    <h3>The development chain</h3>
    <div class="kv"><span class="k">contrast potential</span><span class="v">${fmt(D.Vc)} V</span></div>
    <div class="kv"><span class="k">gap + d/εr</span><span class="v">${fmt(X.gapEffective(S) * 1e6)} µm</span></div>
    <div class="kv"><span class="k">field E = V/gap</span><span class="v ${D.E < X.E_AIR ? 'ok' : 'hot'}">${fmt(D.E / 1e6, 2)} V/µm</span></div>
    <div class="kv"><span class="k">release threshold</span><span class="v">${fmt(D.release / 1e6, 2)} V/µm</span></div>
    <div class="kv"><span class="k">background field</span><span class="v ${D.Ebg < D.release ? 'ok' : 'hot'}">${fmt(D.Ebg / 1e6, 2)} V/µm</span></div>
    <div class="formula">M/A = ε₀·E / (q/m)<br>= ${D.MA.toExponential(2)} kg/m² = ${fmt(X.mgPerCm2(D.MA), 2)} mg/cm²</div>
    <div class="kv"><span class="k">monolayers deposited</span><span class="v">${fmt(D.MA / X.monolayerMass(S.tonerR), 2)}</span></div>
    <div class="kv"><span class="k">area coverage</span><span class="v">${fmt(D.cImg * 100)} %</span></div>
    <div class="kv"><span class="k">print density</span><span class="v">OD ${fmt(D.OD, 2)}</span></div>
    <div class="kv"><span class="k">toner per cm²</span><span class="v">${fmt(D.tonerPerCm2 / 1e6, 2)} million</span></div>
    <div class="kv"><span class="k">verdict</span><span class="v ${regChip[1]}">${regChip[0]}</span></div>
    <h3>Failure modes</h3>
    <div class="kv"><span class="k">toner charge ↑ / radius ↑</span><span class="v">white copy</span></div>
    <div class="kv"><span class="k">exposure starved</span><span class="v">grey fog</span></div>
    <div class="note">Exposure must drop the white areas below ${fmt(D.vBgNoFog)} V — that takes at least ${fmt(D.fluenceNoFog, 2)} erg/cm² at the current η and λ. The 1938 original used a handkerchief for exactly this triboelectric step.</div>`;

  const lease = X.leaseMonthly(volume), rent = X.rentMonthly(volume), mimeo = X.mimeoMonthly(volume, originals);
  const xm = X.crossoverMimeo(originals);
  $('econReadout').innerHTML = `
    <h3>At ${volume.toLocaleString()} copies / month</h3>
    <div class="kv"><span class="k">914 lease (1959)</span><span class="v">$${fmt(lease)} · ${fmt(X.perCopy(lease, volume) * 100, 1)}¢</span></div>
    <div class="kv"><span class="k">914 meter (1965)</span><span class="v">$${fmt(rent)} · ${fmt(X.perCopy(rent, volume) * 100, 1)}¢</span></div>
    <div class="kv"><span class="k">mimeograph (${originals} orig.)</span><span class="v">$${fmt(mimeo, 0)} · ${fmt(X.perCopy(mimeo, volume) * 100, 1)}¢</span></div>
    <div class="kv"><span class="k">Photostat</span><span class="v">$${fmt(volume * 0.35)} · 35¢</span></div>
    <h3>Break-evens vs the lease</h3>
    <div class="kv"><span class="k">Photostat 35¢</span><span class="v">${Math.round(X.crossoverFlat(0.35))}/mo</span></div>
    <div class="kv"><span class="k">Verifax 15¢</span><span class="v">${Math.round(X.crossoverFlat(0.15))}/mo</span></div>
    <div class="kv"><span class="k">Thermofax 7.5¢</span><span class="v">${Math.round(X.crossoverFlat(0.075))}/mo</span></div>
    <div class="kv"><span class="k">mimeograph</span><span class="v">${xm ? `${Math.round(xm)}/mo` : 'never (few originals)'}</span></div>
    <div class="formula">$95 + $0.04·max(0, n − 2000)<br>= $${fmt(lease)} at n = ${volume.toLocaleString()}</div>
    <h3>Anchors</h3>
    <div class="note">Sticker $27,500 — the US government buys, never rents. The 914 was credited with roughly two-thirds of Xerox's 1965 revenue (~$243 M). Carlson's royalty ran about a sixteenth of a cent per copy, 1956–65; he gave away more than $150 M and aimed to die a poor man. Kornei, who left in 1939 forgoing 10 %, later got 100 shares — over $1 M by 1972.</div>`;
}

/* video / debug hook */
window.__x914 = {
  get state() { return S; },
  get derived() { return D; },
  docs: DOCS,
  get currentDoc() { return currentDoc; },
  setDoc(id) {
    currentDoc = id;
    document.querySelectorAll('.doc-btn').forEach((b) => b.classList.toggle('active', b.dataset.doc === id));
    refreshReadouts();
  },
  makeCopy() { $('copyBtn').click(); },
};

/* ==========================================================================
   Master loop.
   ========================================================================== */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updateProcess(dt);
  drawProcess(now / 1000);
  drawCorona(now / 1000);
  drawSelenium(now / 1000);
  drawCascade(now / 1000);
  drawCost();
  requestAnimationFrame(frame);
}
refreshReadouts();
requestAnimationFrame(frame);
