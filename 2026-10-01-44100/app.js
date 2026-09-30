/* UI wiring for the CD audio workbench. All math lives in core.js. */
(function () {
  'use strict';
  const C = cdCore;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const fmt = (n) => n.toLocaleString('en-US');

  const state = {
    tone: 1000, rate: 44100, bits: 16,
    radius: 32, tv: 'NTSC',
    interleave: true, wound: [], repaired: null,
  };
  const ROWS = 8, COLS = 9;
  const frame = C.frameBytes(ROWS, COLS, 20261001);

  /* ---------- canvas plumbing ---------- */
  function fit(cv) {
    const rect = cv.getBoundingClientRect();
    const d = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(10, Math.round(rect.width * d));
    if (cv.width !== w) cv.width = w;
    const h = Math.max(10, Math.round(rect.height * d));
    if (cv.height !== h) cv.height = h;
    const g = cv.getContext('2d');
    g.setTransform(d, 0, 0, d, 0, 0);
    return [g, rect.width, rect.height];
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function legend(g, x, y, entries) {
    g.font = '12px ' + getComputedStyle(document.body).getPropertyValue('--mono');
    g.textAlign = 'left'; g.textBaseline = 'middle';
    entries.forEach(([color, label, dash]) => {
      g.strokeStyle = color; g.lineWidth = 2;
      if (dash) g.setLineDash([5, 4]); else g.setLineDash([]);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 22, y); g.stroke();
      g.setLineDash([]);
      g.fillStyle = color;
      g.fillText(label, x + 28, y);
      x += 28 + g.measureText(label).width + 22;
    });
  }

  /* ---------- 01 sampler ---------- */
  function drawSampler() {
    const cv = $('#sampler-canvas');
    const [g, W, H] = fit(cv);
    g.clearRect(0, 0, W, H);
    const f = state.tone, fs = state.rate;
    const fa = C.aliasFrequency(f, fs);
    const aliasing = fa !== f;
    const T = 10 / f;                       // show ten cycles of the true tone
    const nSamples = Math.max(2, Math.round(T * fs));
    const padL = 18, padR = 18, padT = 34, padB = 22;
    const x0 = padL, x1 = W - padR, yMid = padT + (H - padT - padB) / 2;
    const amp = (H - padT - padB) / 2 - 12;
    const X = (t) => x0 + (x1 - x0) * t / T;

    g.strokeStyle = 'rgba(138,163,196,.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, yMid); g.lineTo(x1, yMid); g.stroke();

    // samples: stems + dots when sparse, faint bars when dense
    const dense = nSamples > 260;
    g.fillStyle = 'rgba(232,163,61,.28)';
    if (dense) {
      for (let k = 0; k <= nSamples; k++) {
        const t = k / fs;
        if (t > T) break;
        const y = yMid - Math.sin(2 * Math.PI * f * t) * amp;
        g.fillRect(X(t) - .5, Math.min(y, yMid), 1.2, Math.abs(y - yMid));
      }
    }
    // zero-order-hold staircase
    g.strokeStyle = dense ? 'rgba(232,163,61,.55)' : 'rgba(232,163,61,.8)';
    g.lineWidth = dense ? 1 : 1.5;
    g.beginPath();
    for (let k = 0; k <= nSamples; k++) {
      const t = k / fs;
      if (t > T) break;
      const y = yMid - Math.sin(2 * Math.PI * f * t) * amp;
      const xa = X(t), xb = X(Math.min(T, (k + 1) / fs));
      if (k === 0) g.moveTo(xa, y);
      else g.lineTo(xa, y);
      g.lineTo(xb, y);
    }
    g.stroke();
    if (!dense) {
      g.fillStyle = '#e8a33d';
      for (let k = 0; k <= nSamples; k++) {
        const t = k / fs;
        if (t > T) break;
        const y = yMid - Math.sin(2 * Math.PI * f * t) * amp;
        g.beginPath(); g.arc(X(t), y, 3, 0, 2 * Math.PI); g.fill();
      }
    }

    // the true wave
    g.strokeStyle = 'rgba(127,208,232,.75)'; g.lineWidth = 1.6;
    g.beginPath();
    for (let px = x0; px <= x1; px += 1) {
      const t = (px - x0) / (x1 - x0) * T;
      const y = yMid - Math.sin(2 * Math.PI * f * t) * amp;
      px === x0 ? g.moveTo(px, y) : g.lineTo(px, y);
    }
    g.stroke();

    // what actually plays back: through the same dots when aliasing
    if (aliasing) {
      g.strokeStyle = '#e2654f'; g.lineWidth = 2.4;
      g.beginPath();
      for (let px = x0; px <= x1; px += 1) {
        const t = (px - x0) / (x1 - x0) * T;
        const y = yMid - Math.sin(2 * Math.PI * fa * t) * amp;
        px === x0 ? g.moveTo(px, y) : g.lineTo(px, y);
      }
      g.stroke();
    }

    const entries = [['rgba(127,208,232,.9)', `true tone ${fmt(f)} Hz`]];
    if (!dense) entries.push(['#e8a33d', 'samples + hold']);
    if (aliasing) entries.push(['#e2654f', `reconstructed ${fmt(fa)} Hz`, true]);
    legend(g, x0, 16, entries);

    $('#sampler-state').textContent = aliasing ? 'ALIASING' : 'CLEAN';
    $('#sampler-state').classList.toggle('bad', aliasing);
    $('#nyquist').textContent = fmt(fs / 2) + ' Hz';
    const pb = $('#playback');
    pb.textContent = fmt(fa) + ' Hz';
    pb.classList.toggle('bad', aliasing);
    $('#sampler-note').textContent = aliasing
      ? `${fmt(f)} Hz cannot exist at a ${fmt(fs)} Hz sample rate — it folds back as ${fmt(fa)} Hz through exactly the same dots.`
      : 'Every cycle is measured more than twice — the original wave is the only one that fits the dots.';
  }

  /* ---------- 02 bits ---------- */
  function drawBits() {
    const cv = $('#bits-canvas');
    const [g, W, H] = fit(cv);
    g.clearRect(0, 0, W, H);
    const bits = state.bits;
    const split = H - 74;                    // wave above, error below
    const padL = 18, padR = 18, padT = 34, padB = 16;
    const x0 = padL, x1 = W - padR;
    const yMid = padT + (split - padT) / 2;
    const amp = (split - padT) / 2 - 10;
    const CYCLES = 3, N = 240;               // 240 staircase steps across three cycles
    const wave = (u) => Math.sin(2 * Math.PI * u);
    const X = (u) => x0 + (x1 - x0) * u / CYCLES;

    // level ladder for shallow depths
    if (bits <= 6) {
      g.strokeStyle = 'rgba(138,163,196,.18)';
      g.lineWidth = 1;
      for (let l = 0; l <= 1 << bits; l++) {
        const v = -1 + 2 * l / (1 << bits);
        const y = yMid - v * amp;
        g.setLineDash([3, 4]);
        g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
      }
      g.setLineDash([]);
    }
    g.strokeStyle = 'rgba(138,163,196,.3)';
    g.beginPath(); g.moveTo(x0, yMid - amp); g.lineTo(x1, yMid - amp);
    g.moveTo(x0, yMid + amp); g.lineTo(x1, yMid + amp); g.stroke();

    g.strokeStyle = 'rgba(127,208,232,.7)'; g.lineWidth = 1.5;
    g.beginPath();
    for (let px = x0; px <= x1; px++) {
      const u = (px - x0) / (x1 - x0) * CYCLES;
      px === x0 ? g.moveTo(px, yMid - wave(u) * amp) : g.lineTo(px, yMid - wave(u) * amp);
    }
    g.stroke();

    g.strokeStyle = '#e8a33d'; g.lineWidth = 1.8;
    g.beginPath();
    for (let k = 0; k < N; k++) {
      const q0 = C.quantize(wave(k / N), bits), q1 = C.quantize(wave((k + 1) / N), bits);
      const xa = X(k / N), xb = X((k + 1) / N);
      k === 0 ? g.moveTo(xa, yMid - q0 * amp) : g.lineTo(xa, yMid - q0 * amp);
      g.lineTo(xb, yMid - q0 * amp);
      g.lineTo(xb, yMid - q1 * amp);
    }
    g.stroke();

    // error strip: q(x) − x, magnified
    const eMid = split + 34, eAmp = 24, mag = 1 << Math.max(0, 8 - bits) ;
    g.strokeStyle = 'rgba(138,163,196,.3)';
    g.beginPath(); g.moveTo(x0, eMid); g.lineTo(x1, eMid); g.stroke();
    g.fillStyle = 'rgba(226,101,79,.55)';
    g.beginPath();
    for (let k = 0; k < N; k++) {
      const e0 = C.quantize(wave(k / N), bits) - wave(k / N);
      const e1 = C.quantize(wave((k + 1) / N), bits) - wave((k + 1) / N);
      const xa = X(k / N), xb = X((k + 1) / N);
      const y0 = eMid - Math.max(-1, Math.min(1, e0 * mag)) * eAmp;
      const y1 = eMid - Math.max(-1, Math.min(1, e1 * mag)) * eAmp;
      if (k === 0) g.moveTo(xa, eMid);
      g.lineTo(xa, y0); g.lineTo(xb, y0); g.lineTo(xb, y1);
    }
    g.lineTo(x1, eMid); g.closePath(); g.fill();
    g.font = '11px ' + getComputedStyle(document.body).getPropertyValue('--mono');
    g.fillStyle = '#8aa3c4'; g.textAlign = 'left';
    g.fillText(`rounding error, ×${fmt(mag)} magnified`, x0, split + 8);

    legend(g, x0, 16, [
      ['rgba(127,208,232,.9)', 'the real wave'],
      ['#e8a33d', `${bits}-bit staircase`],
    ]);

    const snr = C.snrDb(bits);
    $('#bits-state').textContent = `${bits} BIT · ${snr.toFixed(1)} dB`;
    $('#bits-state').classList.toggle('bad', bits < 12);
    $('#bits-readout').textContent = `${bits} bits`;
    $('#steps').textContent = fmt(C.steps(bits));
    $('#snr').textContent = snr.toFixed(1) + ' dB';
    $('#snr').classList.toggle('bad', bits < 12);
    $('#datarate').textContent = C.dataRateMbits(44100, bits, 2).toFixed(4) + ' Mbit/s';

    // lamps: the +0.6 sample written in b-bit two's complement, shown on the 16-lamp ladder
    const code = C.quantCode(0.6, bits);
    const bits16 = C.toTwos(code, 16);
    const row = $('#lamp-row');
    row.innerHTML = '';
    bits16.forEach((b, i) => {
      const lamp = document.createElement('span');
      lamp.className = 'lamp' + (i < 16 - bits ? ' dead' : b ? ' on' : '');
      lamp.textContent = b;
      row.appendChild(lamp);
    });
    $('#lamp-value').textContent = `code ${code >= 0 ? '+' : ''}${fmt(code)} · ${C.hexCode(code)} · ${bits}-bit`;
  }

  /* ---------- 03 TV field ---------- */
  function drawTv() {
    const cv = $('#tv-canvas');
    const [g, W, H] = fit(cv);
    g.clearRect(0, 0, W, H);
    const tv = C.TV[state.tv];
    const padL = 20, padR = 20, padT = 26, padB = 40;
    const fw = W - padL - padR, fh = H - padT - padB;
    const rowH = fh / tv.fieldLines;

    g.fillStyle = '#0e1828';
    g.fillRect(padL, padT, fw, fh);
    g.strokeStyle = 'rgba(36,57,90,.8)';
    g.strokeRect(padL, padT, fw, fh);

    let usable = 0;
    for (let i = 0; i < tv.fieldLines; i++) {
      const y = padT + rowH * i;
      if (i < tv.lines) {
        usable++;
        g.strokeStyle = 'rgba(127,208,232,.30)';
        g.beginPath(); g.moveTo(padL + 1, y + rowH / 2); g.lineTo(padL + fw * .56, y + rowH / 2); g.stroke();
      } else {
        g.strokeStyle = 'rgba(138,163,196,.10)';
        g.beginPath(); g.moveTo(padL + 1, y + rowH / 2); g.lineTo(padL + fw * .30, y + rowH / 2); g.stroke();
      }
    }

    // zoom inset: five usable lines with their three samples
    const zx = padL + fw * .60, zw = fw * .40 - 8;
    const zy = padT + 6, zh = fh - 30;
    g.fillStyle = '#0c1422';
    g.fillRect(zx, zy, zw, zh);
    g.strokeStyle = 'rgba(36,57,90,.8)'; g.strokeRect(zx, zy, zw, zh);
    for (let i = 0; i < 5; i++) {
      const y = zy + 12 + i * (zh - 24) / 4;
      g.strokeStyle = 'rgba(127,208,232,.8)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(zx + 10, y); g.lineTo(zx + zw - 34, y); g.stroke();
      for (let s = 0; s < 3; s++) {
        const x = zx + 22 + (zw - 70) * s / 2;
        g.fillStyle = '#e8a33d';
        g.beginPath(); g.arc(x, y, 4, 0, 2 * Math.PI); g.fill();
      }
    }
    g.font = '11px ' + getComputedStyle(document.body).getPropertyValue('--mono');
    g.fillStyle = '#8aa3c4'; g.textAlign = 'left';
    g.fillText('five lines, ×3 samples', zx + 10, zy + zh - 6);

    g.fillStyle = '#8aa3c4'; g.textAlign = 'left';
    g.fillText(`one field — ${tv.lines} usable of ~${tv.fieldLines} scan lines (rest blank & sync)`, padL, H - 14);
    g.fillText(`${tv.name}`, padL + fw - g.measureText(`${tv.name}`).width, padT - 8);

    $('#tile-lines').textContent = tv.lines;
    $('#tile-lines-note').textContent = `usable lines per field`;
    $('#tile-fields').textContent = tv.fields;
  }

  /* ---------- 03 disc ---------- */
  let discAngle = 0;
  function drawDisc(dtMs) {
    const cv = $('#disc-canvas');
    const [g, W, H] = fit(cv);
    g.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 + 4;
    const scale = Math.min(W, H) / 2 / (C.CD.outerMM + 6);      // px per mm
    const rpm = C.rpmAt(state.radius);
    if (!reduced) discAngle += rpm / 60 * 2 * Math.PI * dtMs / 1000 / 24;  // ×1/24 slow motion

    let fill;
    if (g.createConicGradient) {
      fill = g.createConicGradient(discAngle, cx, cy);
      fill.addColorStop(0, '#5a6d8c'); fill.addColorStop(.18, '#cfd9e8');
      fill.addColorStop(.38, '#8fb8d8'); fill.addColorStop(.55, '#e6e0ea');
      fill.addColorStop(.72, '#b58ce0'); fill.addColorStop(.9, '#7fd0e8'); fill.addColorStop(1, '#5a6d8c');
    } else {
      fill = g.createRadialGradient(cx, cy, 8, cx, cy, C.CD.outerMM * scale);
      fill.addColorStop(0, '#8fb8d8'); fill.addColorStop(1, '#5a6d8c');
    }
    g.fillStyle = fill;
    g.beginPath(); g.arc(cx, cy, C.CD.outerMM * scale, 0, 2 * Math.PI); g.fill();

    // program area, clamping ring, hole
    g.strokeStyle = 'rgba(12,20,34,.55)'; g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, C.CD.innerMM * scale, 0, 2 * Math.PI); g.stroke();
    g.beginPath(); g.arc(cx, cy, (C.CD.innerMM + C.CD.outerMM) / 2 * scale, 0, 2 * Math.PI); g.stroke();
    g.fillStyle = '#0c1422';
    g.beginPath(); g.arc(cx, cy, 7.5 * scale, 0, 2 * Math.PI); g.fill();
    g.strokeStyle = '#24395a';
    g.beginPath(); g.arc(cx, cy, 7.5 * scale, 0, 2 * Math.PI); g.stroke();

    // the pits riding under the laser at the chosen radius
    const r = state.radius * scale;
    g.strokeStyle = '#e8a33d'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, r, discAngle, discAngle + 1.15); g.stroke();

    // laser
    const lx = cx + r, ly = cy;
    g.strokeStyle = 'rgba(226,101,79,.9)'; g.lineWidth = 2;
    g.setLineDash([4, 3]);
    g.beginPath(); g.moveTo(lx + 60, ly - 60); g.lineTo(lx, ly); g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#e2654f';
    g.beginPath(); g.arc(lx, ly, 4.5, 0, 2 * Math.PI); g.fill();

    g.font = '11px ' + getComputedStyle(document.body).getPropertyValue('--mono');
    g.fillStyle = '#8aa3c4'; g.textAlign = 'left';
    g.fillText('rotation ×1/24 speed', 10, H - 8);
    g.textAlign = 'right';
    g.fillText(`r = ${state.radius.toFixed(1)} mm`, W - 10, H - 8);

    $('#rpm').textContent = Math.round(rpm) + ' rpm';
    $('#lap').textContent = Math.round(60000 / rpm) + ' ms';
    $('#radius-readout').textContent = state.radius.toFixed(1) + ' mm';
  }

  /* ---------- 04 scratch ---------- */
  function byteEl(cls, text) {
    const d = document.createElement('span');
    d.className = 'byte' + (cls ? ' ' + cls : '');
    d.textContent = text;
    return d;
  }
  function buildScratchDom() {
    const grid = $('#logic-grid');
    grid.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
      const row = document.createElement('div');
      row.className = 'logic-row';
      for (let c = 0; c < COLS; c++) row.appendChild(byteEl('', frame[r][c].toString(16).padStart(2, '0').toUpperCase()));
      const gap = document.createElement('span');
      row.appendChild(gap);
      row.appendChild(byteEl('parity', C.parityOf(frame[r]).toString(16).padStart(2, '0').toUpperCase()));
      grid.appendChild(row);
    }
    const strip = $('#physical-strip');
    strip.innerHTML = '';
    for (let p = 0; p < ROWS * (COLS + 1); p++) {
      const cell = document.createElement('span');
      cell.className = 'ph';
      cell.dataset.p = p;
      strip.appendChild(cell);
    }
  }

  function renderScratch() {
    const inter = state.interleave;
    $$('#physical-strip .ph').forEach((el) => {
      el.classList.toggle('wound', state.wound.includes(+el.dataset.p));
    });
    const logical = new Map();   // "r-c" -> status
    if (state.repaired) {
      state.repaired.data.forEach((row, r) => row.forEach((s, c) => { if (s !== 'ok') logical.set(`${r}-${c}`, s); }));
      state.repaired.parity.forEach((s, r) => { if (s === 'damaged') logical.set(`${r}-P`, 'damaged'); });
    } else {
      C.woundToLogical(state.wound, ROWS, COLS, inter)
        .forEach(([r, c]) => logical.set(c === COLS ? `${r}-P` : `${r}-${c}`, 'damaged'));
    }
    $$('#logic-grid .logic-row').forEach((row, r) => {
      Array.from(row.children).forEach((el, i) => {
        if (i < COLS) {
          const s = logical.get(`${r}-${i}`);
          el.className = 'byte' + (s ? ' ' + s : '');
        } else if (i === COLS + 1) {
          const s = logical.get(`${r}-P`);
          el.className = 'byte parity' + (s ? ' ' + s : '');
        }
      });
    });

    const pill = $('#scratch-state');
    const verdict = $('#scratch-verdict');
    if (state.repaired) {
      const {wounded, recovered, lost} = state.repaired;
      if (lost === 0) {
        pill.textContent = 'PLAYING CLEAN';
        pill.classList.remove('bad');
        verdict.className = 'verdict ok';
        verdict.textContent = `${wounded} bytes wounded → ${recovered} rebuilt by row parity, 0 lost. The laser sails over the wound and the track plays clean.`;
      } else {
        pill.textContent = 'CLICK';
        pill.classList.add('bad');
        verdict.className = 'verdict bad';
        verdict.textContent = `${wounded} bytes wounded → ${recovered} rebuilt, ${lost} lost beyond one-per-row. That is an audible click, maybe a skip.`;
      }
    } else if (state.wound.length) {
      pill.textContent = 'SCRATCHED';
      pill.classList.add('bad');
      verdict.className = 'verdict';
      verdict.textContent = `${state.wound.length} bytes wounded${inter ? ' — scattered one hit per row' : ' — all in a row'}. Polish & replay to hear the outcome.`;
    } else {
      pill.textContent = 'PRISTINE';
      pill.classList.remove('bad');
      verdict.className = 'verdict';
      verdict.textContent = 'Pristine disc. Drag across the strip to wound it.';
    }
  }

  function setWound(list) {
    state.wound = list.slice(0, 16);
    state.repaired = null;
    renderScratch();
  }

  function wireScratch() {
    const strip = $('#physical-strip');
    let anchor = null;
    const cellAt = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      return el && el.dataset && el.dataset.p !== undefined ? +el.dataset.p : null;
    };
    strip.addEventListener('pointerdown', (ev) => {
      const p = cellAt(ev);
      if (p === null) return;
      anchor = p;
      strip.setPointerCapture(ev.pointerId);
      setWound([p]);
      ev.preventDefault();
    });
    strip.addEventListener('pointermove', (ev) => {
      if (anchor === null) return;
      const p = cellAt(ev);
      if (p === null) return;
      const a = Math.min(anchor, p), b = Math.max(anchor, p);
      const list = [];
      for (let i = a; i <= Math.min(b, a + 15); i++) list.push(i);
      setWound(list);
    });
    const end = () => { anchor = null; };
    strip.addEventListener('pointerup', end);
    strip.addEventListener('pointercancel', end);

    $('#polish').addEventListener('click', () => {
      if (!state.wound.length) return;
      state.repaired = C.repairFrame(frame, state.wound, state.interleave);
      renderScratch();
    });
    $('#wipe').addEventListener('click', () => { setWound([]); });
    $('#interleave-toggle').addEventListener('click', () => {
      setInterleave(!state.interleave);
    });
  }

  function setInterleave(on) {
    state.interleave = on;
    const btn = $('#interleave-toggle');
    btn.textContent = `Interleave: ${on ? 'on' : 'off'}`;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    state.repaired = null;
    if (state.wound.length) setWound(state.wound);
    else renderScratch();
  }

  /* ---------- audio ---------- */
  let actx = null, live = null;
  function audio() { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); return actx; }
  function stopAudio() {
    if (live) { try { live.stop(); } catch (e) {} live = null; }
    $$('.audio-control button').forEach((b) => { b.classList.remove('on'); b.dataset.playing = ''; });
  }
  function playBuffer(fill, seconds, btn) {
    stopAudio();
    const c = audio();
    if (c.state === 'suspended') c.resume();
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
    fill(buf.getChannelData(0), c.sampleRate);
    const node = c.createBufferSource();
    node.buffer = buf;
    const gain = c.createGain();
    gain.gain.value = 0.18;
    node.connect(gain).connect(c.destination);
    node.onended = () => { if (live === node) stopAudio(); };
    node.start();
    live = node;
    btn.classList.add('on');
    setTimeout(() => { if (live === node) stopAudio(); }, seconds * 1000 + 120);
  }
  function sampledSine(data, sr, f, fs) {
    // sample-and-hold grid at fs, linear interpolation between samples on replay
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const k = Math.floor(t * fs);
      const t0 = k / fs, t1 = (k + 1) / fs;
      const x0 = Math.sin(2 * Math.PI * f * t0), x1 = Math.sin(2 * Math.PI * f * t1);
      data[i] = x0 + (x1 - x0) * (t - t0) / (t1 - t0);
    }
  }
  function sampledSweep(data, sr, fs, seconds) {
    // exponential chirp 30 Hz → 20 kHz, sampled at fs, linear phase interpolation on replay
    const phaseAt = (t) => {
      const f0 = 30, f1 = 20000, r = f1 / f0;
      return 2 * Math.PI * f0 * seconds / Math.log(r) * (Math.pow(r, t / seconds) - 1);
    };
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const k = Math.floor(t * fs);
      const t0 = k / fs, t1 = (k + 1) / fs;
      const p0 = phaseAt(t0), p1 = phaseAt(t1);
      const p = p0 + (p1 - p0) * (t - t0) / (t1 - t0);
      data[i] = Math.sin(p);
    }
  }
  function wireAudio() {
    $('#play-original').addEventListener('click', (ev) => {
      if (ev.currentTarget.classList.contains('on')) return stopAudio();
      const f = state.tone;
      playBuffer((data, sr) => {
        for (let i = 0; i < data.length; i++) data[i] = Math.sin(2 * Math.PI * f * i / sr);
      }, 1.2, ev.currentTarget);
    });
    $('#play-sampled').addEventListener('click', (ev) => {
      if (ev.currentTarget.classList.contains('on')) return stopAudio();
      const f = state.tone, fs = state.rate;
      playBuffer((data, sr) => sampledSine(data, sr, f, fs), 1.2, ev.currentTarget);
    });
    $('#play-sweep').addEventListener('click', (ev) => {
      if (ev.currentTarget.classList.contains('on')) return stopAudio();
      const fs = state.rate;
      playBuffer((data, sr) => sampledSweep(data, sr, fs, 3), 3, ev.currentTarget);
    });
  }

  /* ---------- wiring ---------- */
  function syncChips() {
    $$('.chips [data-tone]').forEach((b) => b.classList.toggle('on', +b.dataset.tone === state.tone));
    $$('.chips [data-rate]').forEach((b) => b.classList.toggle('on', +b.dataset.rate === state.rate));
    $$('.chips [data-bits]').forEach((b) => b.classList.toggle('on', +b.dataset.bits === state.bits));
    $$('.chips [data-radius]').forEach((b) => b.classList.toggle('on', +b.dataset.radius === state.radius));
    $('#tv-ntsc').classList.toggle('on', state.tv === 'NTSC');
    $('#tv-pal').classList.toggle('on', state.tv === 'PAL');
  }

  function setTone(v) {
    state.tone = Math.max(200, Math.min(4000, Math.round(v / 25) * 25));
    $('#tone').value = state.tone;
    $('#tone-readout').textContent = fmt(state.tone) + ' Hz';
    syncChips(); drawSampler();
  }
  function setRate(v) {
    state.rate = Math.max(600, Math.min(48000, Math.round(v / 100) * 100));
    $('#rate').value = state.rate;
    $('#rate-readout').textContent = fmt(state.rate) + ' Hz';
    syncChips(); drawSampler();
  }
  function setBits(v) {
    state.bits = Math.max(1, Math.min(16, Math.round(v)));
    $('#bits').value = state.bits;
    syncChips(); drawBits();
  }
  function setRadius(v) {
    state.radius = Math.max(25, Math.min(58, Math.round(v * 2) / 2));
    $('#radius').value = state.radius;
    syncChips(); drawDisc(0);
  }
  function setTv(name) {
    state.tv = name === 'PAL' ? 'PAL' : 'NTSC';
    syncChips(); drawTv();
  }

  function wire() {
    $('#tone').addEventListener('input', (ev) => setTone(+ev.target.value));
    $('#rate').addEventListener('input', (ev) => setRate(+ev.target.value));
    $('#bits').addEventListener('input', (ev) => setBits(+ev.target.value));
    $('#radius').addEventListener('input', (ev) => setRadius(+ev.target.value));
    $$('.chips [data-tone]').forEach((b) => b.addEventListener('click', () => setTone(+b.dataset.tone)));
    $$('.chips [data-rate]').forEach((b) => b.addEventListener('click', () => setRate(+b.dataset.rate)));
    $$('.chips [data-bits]').forEach((b) => b.addEventListener('click', () => setBits(+b.dataset.bits)));
    $$('.chips [data-radius]').forEach((b) => b.addEventListener('click', () => setRadius(+b.dataset.radius)));
    $('#tv-ntsc').addEventListener('click', () => setTv('NTSC'));
    $('#tv-pal').addEventListener('click', () => setTv('PAL'));
    wireAudio();
    wireScratch();
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { drawSampler(); drawBits(); drawTv(); drawDisc(0); }, 120);
    });
  }

  /* ---------- boot ---------- */
  buildScratchDom();
  wire();
  setTone(1000); setRate(44100); setBits(16); setRadius(32); setTv('NTSC');
  renderScratch();
  let last = performance.now();
  function loop(now) {
    drawDisc(now - last);
    last = now;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* programmatic interface for tests and the video walkthrough */
  window.cdLab = {
    state,
    setTone, setRate, setBits, setRadius, setTv, setInterleave,
    scratch: (start, len) => setWound(C.scratchPhysical(start, len, ROWS, COLS, state.interleave)),
    polish: () => { if (state.wound.length) { state.repaired = C.repairFrame(frame, state.wound, state.interleave); renderScratch(); } },
    wipe: () => setWound([]),
    play: (mode) => {
      const map = {original: '#play-original', sampled: '#play-sampled', sweep: '#play-sweep'};
      $(map[mode] || '#play-sweep').click();
    },
    getState: () => ({
      tone: state.tone, rate: state.rate, bits: state.bits,
      alias: C.aliasFrequency(state.tone, state.rate),
      aliasing: C.isAliasing(state.tone, state.rate),
      snr: C.snrDb(state.bits),
      rpm: C.rpmAt(state.radius), radius: state.radius, tv: state.tv,
      interleave: state.interleave, wound: state.wound.slice(),
      recovered: state.repaired ? state.repaired.recovered : null,
      lost: state.repaired ? state.repaired.lost : null,
    }),
  };
})();
