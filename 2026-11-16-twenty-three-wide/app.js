'use strict';
/* Twenty-Three Wide — the real 1,679 bits of the Arecibo message (Nov 16, 1974).
   Wrap them at any width; only 23 (of the two prime factors) draws the picture. */

const BITS = ('00000010101010000000000' + '00101000001010000000100' + '10001000100010010110010' + '10101010101010100100100' +
  '00000000000000000000000' + '00000000000011000000000' + '00000000001101000000000' + '00000000001101000000000' +
  '00000000010101000000000' + '00000000011111000000000' + '00000000000000000000000' + '11000011100011000011000' +
  '10000000000000110010000' + '11010001100011000011010' + '11111011111011111011111' + '00000000000000000000000' +
  '00010000000000000000010' + '00000000000000000000000' + '00001000000000000000001' + '11111000000000000011111' +
  '00000000000000000000000' + '11000011000011100011000' + '10000000100000000010000' + '11010000110001110011010' +
  '11111011111011111011111' + '00000000000000000000000' + '00010000001100000000010' + '00000000001100000000000' +
  '00001000001100000000001' + '11111000001100000011111' + '00000000001100000000000' + '00100000000100000000100' +
  '00010000001100000001000' + '00001100001100000010000' + '00000011000100001100000' + '00000000001100110000000' +
  '00000011000100001100000' + '00001100001100000010000' + '00010000001000000001000' + '00100000001100000000100' +
  '01000000001100000000100' + '01000000000100000001000' + '00100000001000000010000' + '00010000000000001100000' +
  '00001100000000110000000' + '00100011101011000000000' + '00100000001000000000000' + '00100000111110000000000' +
  '00100001011101001011011' + '00000010011100100111111' + '10111000011100000110111' + '00000000010100000111011' +
  '00100000010100000111111' + '00100000010100000110000' + '00100000110110000000000' + '00000000000000000000000' +
  '00111000001000000000000' + '00111010100010101010101' + '00111000000000101010100' + '00000000000000101000000' +
  '00000000111110000000000' + '00000011111111100000000' + '00001110000000111000000' + '00011000000000001100000' +
  '00110100000000010110000' + '01100110000000110011000' + '01000101000001010001000' + '01000100100010010001000' +
  '00000100010100010000000' + '00000100001000010000000' + '00000100000000010000000' + '00000001001010000000000' +
  '01111001111101001111000');
const N = BITS.length;                       // 1,679
const ORIGINAL = BITS.split('').map(Number);
const C_KMS = 299792.458;
const YEAR_S = 365.25 * 86400;
const BIT_RATE = 10;                         // bits per second, as transmitted
const ARRIVAL_YEAR = 1974 + 25000;

const COL = { white:'#ece5cf', purple:'#b39ddb', green:'#7fc97f', blue:'#6fb1e0', red:'#e58a8a', yellow:'#f2cf5b' };
const AMBER = '#f2b34c';

/* The seven sections of the decoded message, top to bottom. Boxes are
   [row0, row1, col0, col1] in the 73 × 23 frame; boxes tint every set cell
   they cover, so generous edges are harmless. */
const SECTIONS = [
  { key:'numbers', name:'The numbers 1–10', box:[0, 3, 0, 21], color:'white',
    blurb:'Binary, top-down, marker row beneath.',
    detail:'Each column is a 3-bit number, most significant bit at the top; the bottom row marks where each number starts. Eight, nine and ten do not fit in one column, so they borrow the next one to the right — read the right-hand column top-down first. Every bigger number later in the message reuses this trick.' },
  { key:'elements', name:'The elements of DNA', box:[4, 9, 8, 14], color:'purple',
    blurb:'1 · 6 · 7 · 8 · 15 — H, C, N, O, P.',
    detail:'Five 4-bit numbers: the atomic numbers of hydrogen, carbon, nitrogen, oxygen and phosphorus. From here on, every chemical in the message is written as counts of these five elements, always in this order.' },
  { key:'nucleotides', name:'The nucleotides', box:[10, 29, 0, 22], color:'green',
    blurb:'Sugars, phosphates and bases as element counts.',
    detail:'The parts DNA is assembled from, each a small stack of five numbers in H C N O P order: deoxyribose (C₅H₇O), phosphate (PO₄) and the four bases — adenine C₅H₄N₅, thymine C₅H₅N₂O₂, cytosine C₄H₄N₃O, guanine C₅H₄N₅O. Two rungs, A–T then C–G, with a phosphate under each sugar.' },
  { key:'helix', name:'The double helix', box:[25, 45, 0, 22], color:'blue',
    blurb:'4,294,441,822 base pairs — the 1974 estimate.',
    detail:'The woven strands frame a two-column 32-bit number riding the middle gap: 4,294,441,822 nucleotide base pairs, read right column first, top-down. Today’s genome is measured at about 3.2 billion — 1974 overshot by roughly a third.' },
  { key:'human', name:'The human', box:[46, 54, 0, 22], color:'red',
    blurb:'1,764 mm tall · 4,292,853,750 of us.',
    detail:'A figure of a human being. To its left, the height: 14 × the message’s 126 mm wavelength = 1,764 mm (5′ 9″). To its right, the 1974 population, 4,292,853,750, written horizontally with the least-significant bit at the upper left. Both rulers are the wavelength itself — the message calibrates itself.' },
  { key:'solar', name:'The solar system', box:[55, 59, 0, 22], color:'yellow',
    blurb:'Sun plus nine planets; the third is lifted out of line.',
    detail:'The Sun and the nine planets of 1974 — Pluto still counted — drawn roughly to size. Earth, third from the Sun, is raised above the row: you are here, and this is where the beam started.' },
  { key:'dish', name:'The transmitter', box:[60, 72, 0, 22], color:'purple',
    blurb:'2,430 × 126 mm = 306.18 m — Arecibo itself.',
    detail:'A drawing of the Arecibo antenna: the bowl, the feed structure, and the “M” that demonstrates the curved line is a concave mirror. The diameter below, 2,430 × 126 mm = 306.18 m (1,004 ft), ends the message by pointing at the machine that sent it.' },
];

/* Tint rules, first match wins. Only meaningful at the 23-wide wrap. */
function tint(r, c) {
  if (r <= 3) return COL.white;
  if (r <= 9) return COL.purple;
  if (r <= 29) return COL.green;
  if (r <= 45) return (c >= 10 && c <= 11) ? COL.white : COL.blue;
  if (r <= 54) {
    if (r >= 48 && c >= 17) return COL.white;            // population
    if (r === 50 && c >= 2 && c <= 5) return COL.white;  // height 1110
    return COL.red;
  }
  if (r <= 59) return COL.yellow;
  if (r <= 70) return COL.purple;
  return COL.white;                                      // the 2,430 rows
}
function inBox(r, c, b) { return r >= b[0] && r <= b[1] && c >= b[2] && c <= b[3]; }

const state = {
  stride: 23,
  colorize: false,
  section: null,        // SECTIONS index or null
  paint: false,
  edited: false,
  bits: ORIGINAL.slice(),
  ones: ORIGINAL.reduce((a, b) => a + b, 0),
  phase: 'idle',        // idle | sending | flight | arrived
  sent: 0,
  speed: 100,
  sound: false,
  hover: null,          // {row, col}
  flightKm: 0,
  frozen: false,        // prefers-reduced-motion: freeze the flight clock
};
state.frozen = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = s => document.querySelector(s);
const feedEl = $('#feed'), canvas = $('#grid'), ctx = canvas.getContext('2d');
const holder = $('.canvas-holder');
const fmt = n => n.toLocaleString('en-US');
const geoms = { cell: 7, pad: 6 };

/* ---------- the feed ---------- */
const feedSpans = [];
{
  const frag = document.createDocumentFragment();
  for (let i = 0; i < N; i++) {
    const s = document.createElement('span');
    s.className = ORIGINAL[i] ? 'b1' : 'b0';
    s.textContent = BITS[i];
    if (i < N - 1 && (i + 1) % 73 === 0) s.textContent += '\n';
    frag.appendChild(s);
    feedSpans.push(s);
  }
  feedEl.appendChild(frag);
}
function paintFeed(i) { feedSpans[i].className = (state.bits[i] ? 'b1' : 'b0') + (feedSpans[i].classList.contains('head') ? ' head' : ''); }
function setHead(prev, cur) {
  if (prev >= 0) feedSpans[prev].classList.remove('head');
  if (cur >= 0) feedSpans[cur].classList.add('head');
}

/* ---------- the grid ---------- */
function layout() {
  const rows = Math.ceil(N / state.stride);
  const availW = holder.clientWidth - 12, availH = holder.clientHeight - 12;
  const cell = Math.max(3, Math.min(18, Math.floor(Math.min(availW / state.stride, availH / rows))));
  const pad = 4;
  const w = state.stride * cell + pad * 2, h = rows * cell + pad * 2;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  geoms.cell = cell; geoms.pad = pad; geoms.rows = rows;
}
function drawGrid() {
  const { cell, pad, rows } = geoms;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gap = cell > 8 ? 1 : 0;
  const box = state.section != null ? SECTIONS[state.section].box : null;
  for (let i = 0; i < N; i++) {
    const r = Math.floor(i / state.stride), c = i % state.stride;
    const x = pad + c * cell, y = pad + r * cell;
    const on = state.bits[i];
    let fill = on ? AMBER : 'rgba(224,236,220,0.055)';
    if (on && state.colorize && state.stride === 23) fill = tint(r, c);
    if (box && state.stride === 23 && !(r >= box[0] && r <= box[1] && c >= box[2] && c <= box[3])) {
      ctx.globalAlpha = 0.16;
    } else ctx.globalAlpha = 1;
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, cell - gap, cell - gap);
  }
  ctx.globalAlpha = 1;
  if (state.phase !== 'idle' && state.sent > 0) {
    const i = Math.min(state.sent, N) - 1;
    const r = Math.floor(i / state.stride), c = i % state.stride;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(pad + c * cell - 1.5, pad + r * cell - 1.5, cell + 2, cell + 2);
  }
  if (state.hover && state.stride === 23) {
    const { row, col } = state.hover;
    ctx.strokeStyle = '#e7e4d6'; ctx.lineWidth = 1;
    ctx.strokeRect(pad + col * cell - .5, pad + row * cell - .5, cell + 1, cell + 1);
  }
}

/* ---------- transmitter ---------- */
const MILESTONES = [
  [1.28 * 1, 'past the Moon’s orbit (1.3 light-seconds)'],
  [499, 'one astronomical unit out — 8.3 light-minutes'],
  [5.5 * 3600, 'past Pluto’s orbit, 5½ light-hours'],
  [23.6 * 3600, 'past Voyager 1’s 2026 distance (~23½ light-hours)'],
  [YEAR_S, 'a full light-year away'],
  [4.25 * YEAR_S, 'beyond Proxima Centauri’s distance (not headed there)'],
];
function lightTime(s) {
  if (s < 90) return s.toFixed(1) + ' light-seconds';
  if (s < 5400) return (s / 60).toFixed(1) + ' light-minutes';
  if (s < 48 * 3600) return (s / 3600).toFixed(1) + ' light-hours';
  if (s < 730 * 86400) return (s / 86400).toFixed(1) + ' light-days';
  return fmt(Math.round(s / YEAR_S)) + ' light-years';
}
let audio = null;
function blip(bit) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = bit ? 670 : 660;   // the ±10 Hz FSK, dropped 3½ octaves for human ears
    g.gain.setValueAtTime(.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(.07, audio.currentTime + .012);
    g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .1);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + .11);
  } catch (e) { /* audio is a garnish, never a failure */ }
}

let raf = null, t0 = 0, flight0 = 0, lastBit = -1, lastAnnounced = -1;
function tick(now) {
  raf = null;
  if (state.phase === 'sending') {
    const target = state.frozen ? N : Math.min(N, Math.floor(((now - t0) / 1000) * state.speed * BIT_RATE));
    while (state.sent < target) {
      state.sent++;
      paintFeed(state.sent - 1);
      if (state.sound && state.speed <= 10) blip(state.bits[state.sent - 1]);
    }
    if (state.sent - 1 !== lastBit || lastBit < 0) { setHead(lastBit, state.sent - 1); lastBit = state.sent - 1; }
    updateTx();
    if (state.sent >= N) {
      state.phase = 'flight'; flight0 = now;
      state.flightKm = (N / BIT_RATE) * C_KMS;   // the front leads the last bit out by 167.9 light-seconds
      $('#run').textContent = 'Transmit '; $('#run').disabled = false;
      $('#skip').hidden = false;
      line('<strong>Broadcast complete.</strong> 1,679 bits, 167.9 seconds of airtime, one shot, never repeated. The beam front is already about 50 million km out and climbing at lightspeed — the flight clock is scaled ×' + state.speed + '.');
    }
  } else if (state.phase === 'flight') {
    if (!state.frozen) state.flightKm = (N / BIT_RATE) * C_KMS + ((now - flight0) / 1000) * state.speed * C_KMS;
    updateTx();
    const ls = state.flightKm / C_KMS;
    let passed = -1;
    for (let i = 0; i < MILESTONES.length; i++) if (ls >= MILESTONES[i][0]) passed = i;
    if (passed > lastAnnounced) {
      lastAnnounced = passed;
      if (passed >= 0) line('Signal front ' + MILESTONES[passed][1] + '.');
    }
  }
  if (state.phase === 'sending' || state.phase === 'flight') raf = requestAnimationFrame(tick);
}
function startSend() {
  if (state.phase === 'sending') return;
  resetRun();
  state.phase = 'sending';
  $('#run').disabled = true;
  line('<strong>Transmitting…</strong> 1 = 2,380.000010 MHz, 0 = 2,380.000000 MHz, 10 bits/s' + (state.frozen ? ' — reduced-motion mode, the tape fills at once.' : ' (clock ×' + state.speed + ').'));
  t0 = performance.now();
  raf = requestAnimationFrame(tick);
}
function resetRun() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  state.phase = 'idle'; state.sent = 0; state.flightKm = 0; lastBit = -1; lastAnnounced = -1;
  feedSpans.forEach(s => s.classList.remove('head'));
  $('#skip').hidden = true; $('#run').disabled = false;
  updateTx();
}
function arrive() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  state.phase = 'arrived';
  $('#skip').hidden = true;
  updateTx();
  line('<strong>Arrival, around year ' + fmt(ARRIVAL_YEAR) + '.</strong> 25,000 years after leaving, the front reaches M13’s 1974 position. The cluster has drifted since — but its core still catches most of the beam, and 300,000 stars wait behind it. Anyone pointing a 306 m dish at Hercules hears 1,679 bits repeat.');
}

/* ---------- panel updates ---------- */
function line(html) { $('#tx-line').innerHTML = html; }
function updateTx() {
  $('#st-bits').textContent = fmt(state.sent) + ' / 1,679';
  $('#st-air').textContent = (state.sent / BIT_RATE).toFixed(1) + ' s';
  const el = $('#st-front');
  if (state.phase === 'idle') el.textContent = '—';
  else if (state.phase === 'sending') el.textContent = 'in the dish';
  else {
    el.textContent = fmt(Math.round(state.flightKm)) + ' km';
    if (state.flightKm > 1e6) el.textContent += ' · ' + lightTime(state.flightKm / C_KMS);
  }
  if (state.phase === 'arrived') el.textContent = '25,000 ly · M13';
  $('#skip').hidden = state.phase !== 'flight';
}
function updateWidth() {
  const rows = Math.ceil(N / state.stride);
  $('#stride-label').textContent = state.stride;
  $('#stride-val').textContent = state.stride;
  const f = $('#factor');
  if (state.stride === 23) f.innerHTML = '<strong>73 rows × 23 columns — the message.</strong> 1,679 = 23 × 73, both prime: a semiprime has exactly two rectangles, and only this one says anything.';
  else if (state.stride === 73) f.innerHTML = '<strong>23 rows × 73 columns — the slab.</strong> Same 1,679 bits, the other prime factor. To any 1974 receiver, this was the noise.';
  else f.innerHTML = fmt(rows) + ' rows × ' + state.stride + ' columns. 1,679 refuses to divide by ' + state.stride + ' — the last row runs ragged. Only 23 and 73 tile it cleanly.';
}
function updatePaint() {
  $('#st-ones').textContent = fmt(state.ones);
  $('#reset').hidden = !state.edited;
  $('#paint-note').textContent = state.stride !== 23
    ? 'Re-wrap at 23 before lifting the pen — the picture only exists there.'
    : state.paint
      ? 'Click any cell to flip its bit. The rectangle survives every edit — that is the semiprime trick: cell count never changes, so the wrap never breaks.'
      : 'Re-wrap at 23, lift the pen, click any cell. The rectangle survives every edit — that is the semiprime trick.';
}
function renderPicks() {
  const wrap = $('#picks');
  SECTIONS.forEach((s, i) => {
    const p = document.createElement('div');
    p.className = 'pick'; p.dataset.key = s.key;
    p.innerHTML = '<button><span class="head"><i></i><strong>' + s.name + '</strong></span><span class="blurb">' + s.blurb + '</span></button>';
    p.querySelector('button').addEventListener('click', () => selectSection(i));
    wrap.appendChild(p);
  });
}
function selectSection(i) {
  state.section = (state.section === i || i == null) ? null : i;
  document.querySelectorAll('.pick').forEach((p, j) => p.classList.toggle('on', state.section === j));
  $('#detail').textContent = state.section == null ? '' : SECTIONS[state.section].detail;
  drawGrid();
}
function stopEverything() {
  if (state.phase !== 'idle') resetRun();
  line('450 kW into the dish, pointed at M13 in Hercules. Press Transmit — the real beam ran 167.9 s and never repeated.');
}

/* ---------- wiring ---------- */
function setStride(v) {
  state.stride = v;
  state.section = null;
  document.querySelectorAll('.pick').forEach(p => p.classList.remove('on'));
  $('#detail').textContent = '';
  if (state.phase !== 'idle') { resetRun(); line('Re-wrapped mid-flight — the tape resets.'); }
  updateWidth(); updatePaint(); layout(); drawGrid();
}
$('#stride').addEventListener('input', e => setStride(+e.target.value));
document.querySelectorAll('.snap').forEach(b => b.addEventListener('click', () => {
  setStride(+b.dataset.stride);
  $('#stride').value = b.dataset.stride;
}));
$('#colorize').addEventListener('click', () => {
  state.colorize = !state.colorize;
  $('#colorize').classList.toggle('on', state.colorize);
  $('#colorize').setAttribute('aria-pressed', state.colorize);
  $('#legend-on').textContent = state.colorize ? 'section colors' : 'a 1 bit';
  $('#legend').classList.toggle('on', state.colorize);
  drawGrid();
});
$('#paint').addEventListener('click', () => {
  state.paint = !state.paint;
  $('#paint').classList.toggle('on', state.paint);
  $('#paint').setAttribute('aria-pressed', state.paint);
  $('#paint').textContent = state.paint ? 'PEN DOWN' : 'LIFT THE PEN';
  $('#grid-note').textContent = state.paint ? 'CLICK A CELL TO FLIP' : 'HOVER A CELL';
  updatePaint();
});
$('#reset').addEventListener('click', () => {
  state.bits = ORIGINAL.slice();
  for (let i = 0; i < N; i++) paintFeed(i);
  state.ones = ORIGINAL.reduce((a, b) => a + b, 0);
  state.edited = false;
  updatePaint(); drawGrid();
});
$('#run').addEventListener('click', startSend);
$('#skip').addEventListener('click', arrive);
document.querySelectorAll('#speeds .chip').forEach(b => b.addEventListener('click', () => {
  state.speed = +b.dataset.speed;
  document.querySelectorAll('#speeds .chip').forEach(x => x.classList.toggle('on', x === b));
  if (state.phase !== 'idle') stopEverything();
}));
$('#sound').addEventListener('click', () => {
  state.sound = !state.sound;
  const b = $('#sound');
  b.classList.toggle('on', state.sound);
  b.setAttribute('aria-pressed', state.sound);
  b.textContent = state.sound ? 'SOUND ON' : 'SOUND OFF';
});
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const col = Math.floor((e.clientX - rect.left - geoms.pad) / geoms.cell);
  const row = Math.floor((e.clientY - rect.top - geoms.pad) / geoms.cell);
  if (col < 0 || row < 0 || col >= state.stride || row >= geoms.rows) { state.hover = null; if (!state.paint) $('#grid-note').textContent = 'HOVER A CELL'; drawGrid(); return; }
  state.hover = { row, col };
  const i = row * state.stride + col;
  $('#grid-note').textContent = (state.paint && state.stride === 23 ? 'CLICK TO FLIP · ' : 'BIT ' + (i + 1) + ' · ') + 'R' + (row + 1) + ' C' + (col + 1) + ' · ' + (state.bits[i] ?? 0);
  drawGrid();
});
canvas.addEventListener('mouseleave', () => { state.hover = null; if (!state.paint) $('#grid-note').textContent = 'HOVER A CELL'; drawGrid(); });
canvas.addEventListener('click', e => {
  if (!state.paint || state.stride !== 23) return;
  const rect = canvas.getBoundingClientRect();
  const col = Math.floor((e.clientX - rect.left - geoms.pad) / geoms.cell);
  const row = Math.floor((e.clientY - rect.top - geoms.pad) / geoms.cell);
  if (col < 0 || row < 0 || col >= 23 || row >= 73) return;
  const i = row * 23 + col;
  state.bits[i] ^= 1;
  state.ones += state.bits[i] ? 1 : -1;
  state.edited = true;
  paintFeed(i);
  updatePaint(); drawGrid();
});
window.addEventListener('resize', () => { layout(); drawGrid(); });

/* ---------- boot ---------- */
renderPicks();
updateWidth(); updatePaint(); updateTx();
layout(); drawGrid();

window.Arecibo = {
  getState() {
    return {
      stride: state.stride, rows: Math.ceil(N / state.stride), colorize: state.colorize,
      section: state.section, paint: state.paint, edited: state.edited, ones: state.ones,
      phase: state.phase, sent: state.sent, speed: state.speed, sound: state.sound,
      flightKm: Math.round(state.flightKm), arrivalYear: ARRIVAL_YEAR, bits: N, totalOnes: state.ones,
    };
  },
  _geom() { return { pad: geoms.pad, cell: geoms.cell, rows: geoms.rows }; },
  _bits2d() {
    const g = [];
    for (let r = 0; r < 73; r++) g.push(state.bits.slice(r * 23, r * 23 + 23));
    return g;
  },
};
