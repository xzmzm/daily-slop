// app.js — wiring: controls, clicks on the draft, redraw, WIF download.

import {
  ENDS, PICKS, PALETTE, LOOMS, makeDraft, analyze, surprise, toWIF,
  THREADINGS, TIEUPS, TREADLINGS, COLORWAYS,
  applyThreading, applyTieup, applyTreadling, applyColors,
} from './draft.js';
import { drawDraft, drawCloth, pick } from './render.js';

const el = (id) => document.getElementById(id);
const draftCanvas = el('draft');
const clothCanvas = el('cloth');

let d = makeDraft(4);
let yarn = 2;            // currently selected palette index
let hover = null;
const DEFAULT_HINT = el('hint').textContent;

/* ------------------------------------------------------------- select boxes */

// Labels are functions of the shaft count: a 2/2 twill on four shafts is the
// same structure as a 4/4 twill on eight, and the menu should say so.
function fillSelect(id, table, selected) {
  const sel = el(id);
  sel.innerHTML = '';
  for (const [key, v] of Object.entries(table)) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = v.label(d.shafts);
    if (key === selected) o.selected = true;
    sel.append(o);
  }
}

function buildSelects() {
  fillSelect('threading', THREADINGS, 'straight');
  fillSelect('tieup', TIEUPS, 'balanced');
  fillSelect('treadling', TREADLINGS, 'straight');
  fillSelect('colorway', COLORWAYS, 'solid');
}

// A hand-edited cell no longer matches the named pattern, so blank the label
// rather than lie about what's on the loom.
function unsetSelect(id) {
  const sel = el(id);
  if (sel.querySelector('option[value=""]')) { sel.value = ''; return; }
  const o = document.createElement('option');
  o.value = '';
  o.textContent = '— edited by hand —';
  sel.prepend(o);
  sel.value = '';
}

function buildSwatches() {
  const box = el('swatches');
  box.innerHTML = '';
  PALETTE.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'sw';
    b.style.background = c;
    b.setAttribute('aria-pressed', String(i === yarn));
    b.setAttribute('aria-label', `yarn colour ${i + 1}`);
    b.addEventListener('click', () => {
      yarn = i;
      [...box.children].forEach((c2, j) => c2.setAttribute('aria-pressed', String(j === i)));
    });
    box.append(b);
  });
}

/* -------------------------------------------------------------------- report */

function pct(x) { return Math.round(x * 100) + '%'; }

function renderReport() {
  const a = analyze(d);
  const box = el('report');
  box.innerHTML = '';

  const stat = document.createElement('div');
  stat.className = 'stat';
  stat.innerHTML = `
    <span>warp float <b>${a.warpFloat}</b></span>
    <span>weft float <b>${a.weftFloat}</b></span>
    <span>warp on face <b>${pct(a.faceWarp)}</b></span>
    <span>shafts used <b>${a.usedShafts}/${d.shafts}</b></span>
    <span>treadles used <b>${a.usedTreadles}/${d.treadles}</b></span>`;
  box.append(stat);

  for (const n of a.notes) {
    const p = document.createElement('div');
    p.className = 'note ' + n.kind;
    p.append(document.createTextNode(n.text));
    box.append(p);
  }
}

function redraw() {
  drawDraft(draftCanvas, d, hover);
  drawCloth(clothCanvas, d, 2);
  renderReport();
}

/* ------------------------------------------------------------ draft editing */

function canvasPos(ev) {
  const r = draftCanvas.getBoundingClientRect();
  return [ev.clientX - r.left, ev.clientY - r.top];
}

draftCanvas.addEventListener('click', (ev) => {
  const [x, y] = canvasPos(ev);
  const p = pick(d, x, y);
  if (!p) return;

  switch (p.zone) {
    case 'threading':
      d.threading[p.end] = p.shaft;
      unsetSelect('threading');
      break;
    case 'tieup':
      d.tieup[p.treadle][p.shaft] = !d.tieup[p.treadle][p.shaft];
      unsetSelect('tieup');
      break;
    case 'treadling':
      d.treadling[p.pick] = p.treadle;
      unsetSelect('treadling');
      break;
    case 'warpBar':
      d.warpColor[p.end] = yarn;
      unsetSelect('colorway');
      break;
    case 'weftBar':
      d.weftColor[p.pick] = yarn;
      unsetSelect('colorway');
      break;
    default:
      return; // drawdown is read-only: it's derived, not authored
  }
  redraw();
  setHint(p); // the cell just changed, so the old hover text is now a lie
});

const ZONE_HINT = {
  threading: (p) => `Threading — warp end ${p.end + 1} on shaft ${p.shaft + 1}. Click to move it here.`,
  tieup: (p) => `Tie-up — treadle ${p.treadle + 1} ${d.tieup[p.treadle][p.shaft] ? 'raises' : 'does not raise'} shaft ${p.shaft + 1}. Click to toggle.`,
  treadling: (p) => `Treadling — pick ${p.pick + 1}, treadle ${p.treadle + 1}. Click to use this treadle.`,
  drawdown: (p) => {
    const up = d.tieup[d.treadling[p.pick]][d.threading[p.end]];
    return `Drawdown — end ${p.end + 1} (shaft ${d.threading[p.end] + 1}) on pick ${p.pick + 1} (treadle ${d.treadling[p.pick] + 1}): ${up ? 'warp over weft' : 'weft over warp'}.`;
  },
  warpBar: (p) => `Warp end ${p.end + 1}. Click to dye it the selected colour.`,
  weftBar: (p) => `Weft pick ${p.pick + 1}. Click to dye it the selected colour.`,
};

function setHint(p) {
  el('hint').textContent = p && ZONE_HINT[p.zone] ? ZONE_HINT[p.zone](p) : DEFAULT_HINT;
}

draftCanvas.addEventListener('mousemove', (ev) => {
  const [x, y] = canvasPos(ev);
  const p = pick(d, x, y);
  const same = JSON.stringify(p) === JSON.stringify(hover);
  hover = p;
  setHint(p);
  if (!same) drawDraft(draftCanvas, d, hover);
});

draftCanvas.addEventListener('mouseleave', () => {
  hover = null;
  el('hint').textContent = DEFAULT_HINT;
  drawDraft(draftCanvas, d, hover);
});

/* ------------------------------------------------------------------ controls */

el('shafts').addEventListener('change', (e) => {
  const shafts = Number(e.target.value);
  const keep = {
    threading: el('threading').value || 'straight',
    tieup: el('tieup').value || 'balanced',
    treadling: el('treadling').value || 'straight',
    colorway: el('colorway').value || 'solid',
  };
  d = makeDraft(shafts);
  applyThreading(d, keep.threading);
  applyTieup(d, keep.tieup);
  applyTreadling(d, keep.treadling);
  applyColors(d, keep.colorway);
  buildSelects();
  el('threading').value = keep.threading;
  el('tieup').value = keep.tieup;
  el('treadling').value = keep.treadling;
  el('colorway').value = keep.colorway;
  el('seed').textContent = '';
  redraw();
});

el('threading').addEventListener('change', (e) => {
  applyThreading(d, e.target.value);
  // Tromp-as-writ reads the threading, so it must follow it.
  if (el('treadling').value === 'writ') applyTreadling(d, 'writ');
  redraw();
});
el('tieup').addEventListener('change', (e) => { applyTieup(d, e.target.value); redraw(); });
el('treadling').addEventListener('change', (e) => { applyTreadling(d, e.target.value); redraw(); });
el('colorway').addEventListener('change', (e) => { applyColors(d, e.target.value); redraw(); });

el('surprise').addEventListener('click', () => {
  const seed = (Math.random() * 0xffffffff) >>> 0;
  surprise(d, seed);
  buildSelects();
  ['threading', 'tieup', 'treadling', 'colorway'].forEach(unsetSelect);
  el('seed').textContent = `seed ${seed.toString(16).padStart(8, '0')}`;
  redraw();
});

el('wif').addEventListener('click', () => {
  const blob = new Blob([toWIF(d)], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'loom-drafter.wif';
  a.click();
  URL.revokeObjectURL(a.href);
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => drawCloth(clothCanvas, d, 2), 120);
});

buildSelects();
buildSwatches();
redraw();
