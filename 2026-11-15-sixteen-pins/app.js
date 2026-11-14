'use strict';

/* Sixteen Pins — the Intel 4004's crowded bus.
   Nov 15, 1971: the Electronic News ad. The 4004 pushed a 12-bit address,
   8-bit instructions and 4-bit data through the same four pins, so every
   memory fetch started by dribbling the address out in chunks.

   Timing model: one memory fetch costs ceil(12/w) address periods +
   ceil(8/w) data periods + 3 execution periods. At w = 4 that is exactly
   the datasheet's 8-period, 10.8 µs instruction cycle (A1 A2 A3 M1 M2 X1 X2 X3). */

const CLOCK_KHZ = 740;
const PERIOD_US = 1000 / CLOCK_KHZ; // 1.351 µs per clock period
const EXEC_PAD = 3;                 // X phases after every fetch
const FETCH_BITS = 8;               // a ROM word: opcode or operand
const ADDR_BITS = 12;
const CW = 30;                      // timeline cell width, px
const CHIP_BASE = 0x200;            // the chore lives in ROM chip 2
const CANVAS_H = 124;

const PACKAGES = [
  { width: 4, pins: 16, name: '16 pins', tag: 'AS BUILT', blurb: 'One 4-bit bus does everything: address, instructions, data.' },
  { width: 8, pins: 20, name: '20 pins', tag: 'FANTASY', blurb: 'Four more data leads; the address goes out in two chunks.' },
  { width: 12, pins: 24, name: '24 pins', tag: 'FANTASY', blurb: 'The whole 12-bit address in a single period.' },
  { width: 16, pins: 28, name: '28 pins', tag: 'FANTASY', blurb: 'A word per period — but the fetch floor stays put.' },
];

/* Two-word MCS-4 instructions (JUN, JMS, FIM, BBL, JCN) take two ROM words.
   Mnemonics follow the MCS-4 sheet; opcode hex is decorative. */
const CHORES = [
  {
    id: 'add', name: 'Add two numbers', tag: '6 INSTR',
    blurb: 'The calculator\'s most common moment: load both, add, send it out.',
    instructions: [
      { text: 'FIM 0P,$2F', opcode: 0x20, operand: 0x2F },
      { text: 'FIM 1P,$17', opcode: 0x22, operand: 0x17 },
      { text: 'LD 0', opcode: 0xA0 },
      { text: 'ADD 1', opcode: 0x81 },
      { text: 'WRR', opcode: 0xE4 },
      { text: 'BBL 0', opcode: 0x30, operand: 0x00 },
    ],
  },
  {
    id: 'mul', name: 'Multiply 7 × 5', tag: '10 INSTR',
    blurb: 'Shift and add, with a call into the loop body and a jump back.',
    instructions: [
      { text: 'FIM 0P,$07', opcode: 0x20, operand: 0x07 },
      { text: 'FIM 1P,$05', opcode: 0x22, operand: 0x05 },
      { text: 'LDM 0', opcode: 0xD0 },
      { text: 'JMS mul', opcode: 0x50, operand: 0x0A },
      { text: 'WMP', opcode: 0xE0 },
      { text: 'BBL 0', opcode: 0x30, operand: 0x00 },
      { text: 'mul: INC 1', opcode: 0x61 },
      { text: 'ADD 0', opcode: 0x80 },
      { text: 'RAL', opcode: 0xF0 },
      { text: 'JUN mul', opcode: 0x40, operand: 0x0A },
    ],
  },
  {
    id: 'scan', name: 'Refresh the register display', tag: '17 INSTR',
    blurb: 'Four digits of the 4002 RAM, written one nibble at a time.',
    instructions: [
      { text: 'FIM 0P,$A0', opcode: 0x20, operand: 0xA0 },
      { text: 'LDM 3', opcode: 0xD3 },
      { text: 'SRC 0', opcode: 0x21 },
      { text: 'WRM', opcode: 0xE1 },
      { text: 'INC 0', opcode: 0x60 },
      { text: 'LDM 3', opcode: 0xD3 },
      { text: 'SRC 0', opcode: 0x21 },
      { text: 'WRM', opcode: 0xE1 },
      { text: 'INC 0', opcode: 0x60 },
      { text: 'LDM 3', opcode: 0xD3 },
      { text: 'SRC 0', opcode: 0x21 },
      { text: 'WRM', opcode: 0xE1 },
      { text: 'INC 0', opcode: 0x60 },
      { text: 'LDM 3', opcode: 0xD3 },
      { text: 'SRC 0', opcode: 0x21 },
      { text: 'WRM', opcode: 0xE1 },
      { text: 'INC 0', opcode: 0x60 },
    ],
  },
];

function mask(bits) { return (1 << bits) - 1; }
function hex(value, bits) {
  const digits = Math.max(1, Math.ceil(bits / 4));
  return value.toString(16).toUpperCase().padStart(digits, '0');
}

function periodsPerFetch(width) {
  return Math.ceil(ADDR_BITS / width) + Math.ceil(FETCH_BITS / width) + EXEC_PAD;
}

/* One memory access: its address chunks, word chunks, then the execution pad. */
function fetchPhases(fetch, width) {
  const phases = [];
  const addrChunks = Math.ceil(ADDR_BITS / width);
  for (let i = 0; i < addrChunks; i++) {
    const lo = i * width;
    const bits = Math.min(ADDR_BITS, lo + width) - lo;
    phases.push({ kind: 'addr', label: 'A' + (i + 1), text: hex((fetch.addr >> lo) & mask(bits), bits) });
  }
  const dataChunks = Math.ceil(FETCH_BITS / width);
  for (let i = 0; i < dataChunks; i++) {
    const lo = i * width;
    const bits = Math.min(FETCH_BITS, lo + width) - lo;
    phases.push({ kind: 'data', label: 'M' + (i + 1), text: hex((fetch.value >> lo) & mask(bits), bits) });
  }
  for (let i = 0; i < EXEC_PAD; i++) phases.push({ kind: 'exec', label: 'X' + (i + 1), text: '—' });
  return phases;
}

/* Build everything the canvas needs for one (package, chore) pair. */
function buildModel(width, chore) {
  const phases = [];
  const bands = [];
  const syncAt = [];
  let addr = CHIP_BASE;
  let period = 0;
  for (const ins of chore.instructions) {
    const start = period;
    const words = ins.operand !== undefined
      ? [{ kind: 'opcode', value: ins.opcode }, { kind: 'operand', value: ins.operand }]
      : [{ kind: 'opcode', value: ins.opcode }];
    for (const word of words) {
      for (const phase of fetchPhases({ kind: word.kind, addr, value: word.value }, width)) {
        phases.push(phase);
        period += 1;
      }
      addr += 1;
    }
    bands.push({ start, end: period, text: ins.text, twoWord: ins.operand !== undefined });
    syncAt.push(start);
  }
  return { phases, bands, syncAt, periods: period };
}

/* — rendering — */

const COLORS = {
  addr: { fill: '#f3d9c3', edge: '#e8793a', text: '#8a4a17' },
  data: { fill: '#dfe9de', edge: '#527553', text: '#2e4a30' },
  exec: { fill: '#eef0e5', edge: '#a8b0a2', text: '#8a938c' },
};

function draw(canvas, model, revealed) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = model.periods * CW + 24;
  canvas.width = width * dpr;
  canvas.height = CANVAS_H * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = CANVAS_H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, CANVAS_H);
  const shown = Math.min(revealed, model.periods);

  // clock row with SYNC pulses at instruction starts
  ctx.fillStyle = '#8a938c';
  ctx.font = '8px Arial';
  ctx.fillText('CLK', 2, 11);
  const syncSet = new Set(model.syncAt);
  for (let i = 0; i < shown; i++) {
    const x = 12 + i * CW;
    if (syncSet.has(i)) {
      ctx.fillStyle = '#e8793a';
      ctx.fillRect(x + 2, 4, CW - 4, 8);
    } else {
      ctx.fillStyle = '#9aa39c';
      ctx.fillRect(x + 2, 9, CW - 4, 3);
    }
  }

  // bus cells
  ctx.fillStyle = '#8a938c';
  ctx.font = '8px Arial';
  ctx.fillText('BUS', 2, 43);
  for (let i = 0; i < shown; i++) {
    const phase = model.phases[i];
    const color = COLORS[phase.kind];
    const x = 12 + i * CW;
    ctx.fillStyle = color.fill;
    ctx.strokeStyle = color.edge;
    ctx.lineWidth = 1;
    if (phase.kind === 'exec') ctx.setLineDash([3, 2]);
    roundRect(ctx, x + 2, 24, CW - 4, 26, 4);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color.text;
    ctx.font = phase.kind === 'exec' ? '9px Arial' : 'bold 11px "SF Mono",Menlo,monospace';
    ctx.textAlign = 'center';
    ctx.fillText(phase.text, x + CW / 2, 41);
    ctx.textAlign = 'left';
  }

  // phase labels
  ctx.font = '8px Arial';
  ctx.fillStyle = '#8a938c';
  for (let i = 0; i < shown; i++) {
    ctx.fillText(model.phases[i].label, 12 + i * CW + CW / 2 - 4, 66);
  }

  // instruction bands
  for (const band of model.bands) {
    if (band.start >= shown) continue;
    const end = Math.min(band.end, shown);
    const w = (end - band.start) * CW;
    const x = 12 + band.start * CW;
    ctx.fillStyle = band.twoWord ? '#f6e7d2' : '#eef0e5';
    ctx.strokeStyle = band.twoWord ? '#d8a86a' : '#b8c0b4';
    ctx.lineWidth = 1;
    roundRect(ctx, x + 1, 74, Math.max(w - 3, 4), 40, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = band.twoWord ? '#8a4a17' : '#5a6859';
    ctx.font = 'bold 10px "SF Mono",Menlo,monospace';
    const maxChars = Math.floor(w / 6.2) - 1;
    const label = band.text.length > maxChars ? band.text.slice(0, Math.max(1, maxChars)) + '…' : band.text;
    ctx.fillText(label, x + 8, 90);
    ctx.fillStyle = '#9aa39c';
    ctx.font = '7px Arial';
    ctx.fillText(band.twoWord ? '2-WORD · 2 FETCHES' : '1 WORD · 1 FETCH', x + 8, 106);
  }
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

/* — package diagram — */

const PIN_NAMES = ['D0', 'D1', 'D2', 'D3', 'VSS', 'CLK1', 'CLK2', 'SYNC',
  'TEST', 'RESET', 'CM-ROM', 'VDD', 'CM-RAM0', 'CM-RAM1', 'CM-RAM2', 'CM-RAM3'];

function packageSvg(width) {
  const fantasy = Math.max(0, width - 4);
  const rows = 8, rowH = 18, top = 24;
  const bodyH = rows * rowH + 24;
  const bayRows = Math.max(rows, fantasy);
  const svgH = top + bayRows * rowH + 42;
  let out = `<svg viewBox="0 0 560 ${svgH}" role="img" aria-label="Package pinout">`;
  out += `<rect x="120" y="14" width="200" height="${bodyH}" rx="9" fill="#3a4544"/>`;
  out += `<circle cx="130" cy="27" r="5" fill="#e4e8db"/>`;
  out += `<text x="220" y="48" text-anchor="middle" fill="#c8d2c6" font-family="Georgia,serif" font-size="13">4004</text>`;
  out += `<text x="220" y="66" text-anchor="middle" fill="#8a938c" font-family="Arial" font-size="8" letter-spacing="1">${width} DATA LEADS</text>`;
  for (let i = 0; i < rows; i++) {
    const y = top + i * rowH;
    const left = PIN_NAMES[i];
    const hotL = left.startsWith('D') && parseInt(left.slice(1), 10) < width;
    out += `<rect x="86" y="${y}" width="34" height="7" rx="2" fill="${hotL ? '#e8793a' : '#a8b0a2'}"/>`;
    out += `<text x="80" y="${y + 7}" text-anchor="end" font-family="Arial" font-size="8.5" fill="${hotL ? '#a4571f' : '#6e7770'}" font-weight="${hotL ? 700 : 400}">${left}</text>`;
    const right = PIN_NAMES[i + rows];
    const hotR = right.startsWith('D') && parseInt(right.slice(1), 10) < width;
    out += `<rect x="320" y="${y}" width="34" height="7" rx="2" fill="${hotR ? '#e8793a' : '#a8b0a2'}"/>`;
    out += `<text x="360" y="${y + 7}" font-family="Arial" font-size="8.5" fill="${hotR ? '#a4571f' : '#6e7770'}" font-weight="${hotR ? 700 : 400}">${right}</text>`;
  }
  if (fantasy > 0) {
    const bayX = 420;
    const bayH = fantasy * rowH + 14;
    out += `<rect x="${bayX - 8}" y="10" width="130" height="${bayH}" rx="9" fill="none" stroke="#b8c0b4" stroke-dasharray="5 4"/>`;
    for (let i = 0; i < fantasy; i++) {
      const y = top + i * rowH;
      out += `<rect x="${bayX}" y="${y}" width="34" height="7" rx="2" fill="none" stroke="#e8793a" stroke-dasharray="4 3"/>`;
      out += `<text x="${bayX + 42}" y="${y + 7}" font-family="Arial" font-size="8.5" fill="#a4571f">D${4 + i} <tspan fill="#9aa39c">fantasy lead</tspan></text>`;
    }
    out += `<text x="${bayX}" y="${10 + bayH + 14}" font-family="Arial" font-size="8" fill="#8a938c">+${fantasy} leads you'd have to invent</text>`;
  }
  out += `<text x="120" y="${14 + bodyH + 18}" font-family="Arial" font-size="8" fill="#8a938c">pin 1 · notch up · the amber leads are the whole 4-bit bus</text>`;
  out += '</svg>';
  return out;
}

/* — state & UI wiring — */

const state = { width: 4, chore: CHORES[0].id, model: null, revealed: 0, runCount: 0, timer: null };

const $ = (sel) => document.querySelector(sel);
const choreById = (id) => CHORES.find((c) => c.id === id);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fetchCount = (model) => model.bands.reduce((n, b) => n + (b.twoWord ? 2 : 1), 0);
const addrPeriods = (model) => fetchCount(model) * Math.ceil(ADDR_BITS / state.width);

function render(revealed) {
  state.revealed = revealed;
  draw($('#bus'), state.model, revealed);
  const done = revealed >= state.model.periods;
  const per = periodsPerFetch(state.width);
  const fetches = fetchCount(state.model);
  $('#st-fetches').textContent = done ? String(fetches) : String(Math.min(fetches, Math.floor(revealed / per)));
  $('#st-periods').textContent = String(revealed);
  $('#st-us').textContent = (revealed * PERIOD_US).toFixed(1) + ' µs';
  $('#st-share').textContent = done ? Math.round(addrPeriods(state.model) / state.model.periods * 100) + '%' : '…';
  if (done) {
    $('#st-note').textContent = state.width === 4
      ? 'At four data leads this is the datasheet\'s cycle: 3 of every 8 periods are address dribble.'
      : 'Wider bus: the address chunks shrank. The 3-period execution pad never does.';
    $('#bus-note').textContent = `${state.width} data leads · address in ${Math.ceil(ADDR_BITS / state.width)} chunk${Math.ceil(ADDR_BITS / state.width) > 1 ? 's' : ''} · word fetches unchanged`;
  }
}

function renderCompare() {
  const chore = choreById(state.chore);
  const fetches = chore.instructions.reduce((n, i) => n + (i.operand !== undefined ? 2 : 1), 0);
  const values = PACKAGES.map((p) => ({ pins: p.pins, periods: fetches * periodsPerFetch(p.width) }));
  const max = values[0].periods;
  $('#compare').innerHTML = values.map((v) => `
    <div class="bar-row${v.pins === state.width + 12 ? ' on' : ''}">
      <div class="bar-label"><strong>${v.pins} pins</strong><span>${(v.periods * PERIOD_US).toFixed(1)} µs</span></div>
      <div class="bar"><i style="width:${Math.max(6, Math.round(v.periods / max * 100))}%"></i></div>
    </div>`).join('');
  $('#compare-note').textContent = values[2].periods === values[3].periods
    ? 'The last four leads buy nothing: once the address fits in one period, the word fetch sets the floor.'
    : 'Same chore, same clock — only the bus width changed.';
}

function renderPackage() {
  $('#package').innerHTML = packageSvg(state.width);
}

function renderChoreListing() {
  $('#listing').innerHTML = choreById(state.chore).instructions
    .map((i) => `<span class="${i.operand !== undefined ? 'c2' : ''}">${i.text}</span>`).join('\n');
}

function rebuild() {
  if (state.timer) { clearInterval(state.timer); state.timer = null; }
  state.model = buildModel(state.width, choreById(state.chore));
  render(state.model.periods);
  renderCompare();
  renderPackage();
  renderChoreListing();
  document.querySelectorAll('.pkg').forEach((el) => {
    el.classList.toggle('on', Number(el.dataset.width) === state.width);
    el.querySelector('button').setAttribute('aria-pressed', String(Number(el.dataset.width) === state.width));
  });
  document.querySelectorAll('.chore').forEach((el) => {
    el.classList.toggle('on', el.dataset.chore === state.chore);
    el.querySelector('button').setAttribute('aria-pressed', String(el.dataset.chore === state.chore));
  });
  $('.timeline-wrap').scrollTo({ left: 0, behavior: 'auto' });
}

function sweep() {
  state.runCount += 1;
  if (reducedMotion()) { render(state.model.periods); return; }
  $('.timeline-wrap').scrollTo({ left: 0, behavior: 'auto' });
  let revealed = 0;
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(() => {
    revealed = Math.min(state.model.periods, revealed + 4);
    render(revealed);
    const wrap = $('.timeline-wrap');
    const cursorX = 12 + revealed * CW;
    if (cursorX > wrap.scrollLeft + wrap.clientWidth - 60 && revealed < state.model.periods) {
      wrap.scrollTo({ left: cursorX - 120, behavior: 'auto' });
    }
    if (revealed >= state.model.periods) {
      clearInterval(state.timer);
      state.timer = null;
      wrap.scrollTo({ left: 0, behavior: 'auto' });
    }
  }, 40);
}

function buildSidebar() {
  $('#packages').innerHTML = PACKAGES.map((p) => `
    <div class="pick pkg" data-width="${p.width}">
      <button aria-pressed="false"><span class="head"><strong>${p.name}</strong><span class="tag${p.width === 4 ? ' hot' : ''}">${p.tag}</span></span>
      <span class="blurb">${p.blurb}</span></button>
    </div>`).join('');
  document.querySelectorAll('.pkg button').forEach((el, i) => {
    el.addEventListener('click', () => { state.width = PACKAGES[i].width; rebuild(); });
  });
  $('#chores').innerHTML = CHORES.map((c) => `
    <div class="pick chore" data-chore="${c.id}">
      <button aria-pressed="false"><span class="head"><strong>${c.name}</strong><span class="tag">${c.tag}</span></span>
      <span class="blurb">${c.blurb}</span></button>
    </div>`).join('');
  document.querySelectorAll('.chore button').forEach((el) => {
    el.addEventListener('click', () => { state.chore = el.closest('.chore').dataset.chore; rebuild(); });
  });
  $('#run').addEventListener('click', sweep);
}

/* — for the test harness and the video adapter — */

function getState() {
  const model = state.model;
  return {
    width: state.width,
    chore: state.chore,
    fetches: model ? fetchCount(model) : 0,
    periods: model ? model.periods : 0,
    revealed: state.revealed,
    runCount: state.runCount,
    sweeping: state.timer !== null,
    microseconds: model ? model.periods * PERIOD_US : 0,
    addrShare: model ? addrPeriods(model) / model.periods : 0,
  };
}

window.SixteenPins = { getState, PERIOD_US, PACKAGES, CHORES, periodsPerFetch };

buildSidebar();
rebuild();
