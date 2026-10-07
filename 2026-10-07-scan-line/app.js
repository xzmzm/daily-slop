(() => {
  'use strict';
  const C = window.ScanLineCore, $ = id => document.getElementById(id);
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SWEEP_S = {normal: 2.2, slow: 5.4};   // seconds for one pass of 113 modules
  const HOLD_S = 1.7;                         // verdict dwell before the next pass
  const DX = 0.06, PAD = 1;                   // waveform sampling (modules)

  const state = {
    digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 5],
    flipped: false,
    smudges: [],                // printed-module ranges {a, b} of ink
    playing: !calm,
    slow: false,
    sweepX: 0,                  // laser position in display modules, 0..113
    phase: 'sweep',             // 'sweep' | 'hold'
    holdT: 0,
    sweepIndex: 0,
    result: null                // last completed pass
  };

  let modules = C.encodeUpcA(state.digits);
  let wave = null;              // {samples, x0, dx} for the current pass
  let live = null;              // decodePartial of the runs so far
  let pending = null;           // ink stroke in progress {a, b}

  function rebuildWave() {
    const rng = C.mulberry32(0x9E3779B9 ^ Math.imul(state.sweepIndex + 1, 2654435761));
    wave = C.sampleWave(modules, state.smudges.concat(pending ? [pending] : []), {
      x0: -PAD, x1: C.TOTAL + PAD, dx: DX, flipped: state.flipped,
      noise: () => (rng() - 0.5) * 0.07
    });
  }

  function structuralChange() {
    modules = C.encodeUpcA(state.digits) || modules;
    state.result = null;
    // Any edit restarts the pass from the leading quiet zone.
    state.phase = 'sweep';
    state.sweepX = 0;
    state.holdT = 0;
    state.sweepIndex++;
    live = null;
    rebuildWave();
    rebuildBullseye();
    renderCheckPanel();
    renderAll();
  }

  // ---------- clock ----------
  let manual = false, prev = performance.now();

  function step(dt) {
    if (!state.playing || !(dt > 0)) return;
    let t = Math.min(dt, 30);
    while (t > 1e-9) {
      if (state.phase === 'sweep') {
        const rate = C.TOTAL / SWEEP_S[state.slow ? 'slow' : 'normal'];
        const need = (C.TOTAL - state.sweepX) / rate;
        const use = Math.min(t, need);
        state.sweepX += rate * use;
        t -= use;
        if (use >= need - 1e-9) {
          state.sweepX = C.TOTAL;
          state.result = C.decodeRuns(C.waveToRuns(wave.samples, DX));
          live = C.decodePartial(C.waveToRuns(wave.samples, DX));
          state.phase = 'hold';
          state.holdT = 0;
          sound(state.result.ok);
        }
      } else {
        const use = Math.min(t, HOLD_S - state.holdT);
        state.holdT += use;
        t -= use;
        if (state.holdT >= HOLD_S - 1e-9) {
          state.phase = 'sweep';
          state.sweepX = 0;
          state.sweepIndex++;
          live = null;
          rebuildWave();
        }
      }
    }
  }

  function runsUpTo(x) {
    const i = Math.max(1, Math.min(wave.samples.length,
      Math.round((x - wave.x0) / DX) + 1));
    return C.waveToRuns(wave.samples.subarray(0, i), DX);
  }

  // ---------- sound ----------
  let audio = null;
  function primeAudio() {
    if (!audio) {
      try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* stay silent */ }
    }
    if (audio && audio.state === 'suspended') audio.resume();
  }
  function tone(freq, dur, type) {
    if (!audio || audio.state !== 'running') return;
    const t = audio.currentTime;
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t); osc.stop(t + dur);
  }
  function sound(ok) { ok ? tone(1760, 0.09, 'sine') : tone(170, 0.16, 'sawtooth'); }

  // ---------- label canvas ----------
  const label = $('label-canvas'), lctx = label.getContext('2d');

  function sizeCanvas(canvas, fallbackHeight) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600;
    const h = canvas.clientHeight || fallbackHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    return [canvas.width, canvas.height, dpr];
  }

  function drawLabel() {
    const [w, h, dpr] = sizeCanvas(label, 320);
    const ctx = lctx;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (state.flipped) { ctx.translate(w, h); ctx.rotate(Math.PI); }
    const m = 14 * dpr;
    const cardW = w - 2 * m, cardH = h - 2 * m;
    ctx.fillStyle = '#f2ead8';
    ctx.strokeStyle = '#cdbd97';
    ctx.lineWidth = dpr;
    roundRect(ctx, m, m, cardW, cardH, 6 * dpr);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#7a6c4c';
    ctx.font = `${9 * dpr}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('DAILY SLOP · PANTRY', 30 * dpr, 42 * dpr);
    ctx.fillStyle = '#2a2416';
    ctx.font = `${Math.min(26, (w / dpr) * 0.045) * dpr}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText('STONE-GROUND OAT CRACKERS', w / 2, 86 * dpr);
    ctx.fillStyle = '#7a6c4c';
    ctx.font = `${9 * dpr}px monospace`;
    ctx.fillText('NET WT 12 OZ (340 g)', w / 2, 108 * dpr);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#2a2416';
    ctx.font = `${22 * dpr}px Georgia, serif`;
    ctx.fillText('$3.29', w - 30 * dpr, 44 * dpr);

    // Bar code, in printed module space (the ctx rotation handles flips).
    const codeX0 = 52 * dpr, mw = (w - 104 * dpr) / C.TOTAL;
    const barTop = 148 * dpr, barBot = 240 * dpr;
    ctx.fillStyle = '#2a2416';
    let run = 0;
    for (let i = 0; i < 95; i++) {
      if (modules[i]) run++;
      if ((i === 94 || !modules[i + 1]) && run) {
        ctx.fillRect(codeX0 + (C.QUIET + i + 1 - run) * mw, barTop, run * mw, barBot - barTop);
        run = 0;
      }
    }
    // Quiet-zone marks.
    ctx.fillStyle = '#7a6c4c';
    ctx.font = `${11 * dpr}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('<', codeX0 + C.QUIET * mw + 3 * dpr, barBot + 4 * dpr);
    ctx.textAlign = 'right';
    ctx.fillText('>', codeX0 + (C.QUIET + 95) * mw - 3 * dpr, barBot + 4 * dpr);
    // Human-readable digits, grouped 1-5-5-1.
    ctx.fillStyle = '#2a2416';
    ctx.font = `${13 * dpr}px monospace`;
    ctx.textAlign = 'center';
    const d = state.digits;
    const groups = [[d[0]], d.slice(1, 6), d.slice(6, 11), [d[11]]];
    const spans = [18, 41, 41, 18];
    let gx = 0;
    groups.forEach((g, gi) => {
      const cx = codeX0 + (C.QUIET + gx + spans[gi] / 2) * mw;
      ctx.fillText(g.join(''), cx, 262 * dpr);
      gx += spans[gi] + 2;
    });

    // Ink smears: vertical blotchy bands in printed space.
    const all = state.smudges.concat(pending ? [pending] : []);
    all.forEach((s, idx) => {
      const rng = C.mulberry32(1234 + idx);
      const x0 = codeX0 + s.a * mw, x1 = codeX0 + s.b * mw;
      ctx.fillStyle = 'rgba(23,18,14,.93)';
      roundRect(ctx, x0, 142 * dpr, Math.max(2 * dpr, x1 - x0), 120 * dpr, 4 * dpr);
      ctx.fill();
      for (let k = 0; k < 7; k++) {
        const bx = x0 + rng() * (x1 - x0), by = (144 + rng() * 116) * dpr;
        ctx.beginPath();
        ctx.arc(bx, by, (1.5 + rng() * 3.5) * dpr, 0, 7);
        ctx.fill();
      }
    });
    ctx.restore();
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

  // Pointer painting: any drag on the label becomes a full-height ink band.
  function paintAt(event) {
    const rect = label.getBoundingClientRect();
    let x = event.clientX - rect.left, y = event.clientY - rect.top;
    const w = rect.width, h = rect.height;
    if (state.flipped) { x = w - x; y = h - y; }
    const mw = (w - 104) / C.TOTAL;
    const pm = (x - 52) / mw;
    if (pm < -1 || pm > C.TOTAL + 1 || y < 0 || y > h) return;
    if (!pending) pending = {a: Math.max(0, pm), b: Math.max(0, pm)};
    pending.a = Math.min(pending.a, Math.max(0, pm));
    pending.b = Math.max(pending.b, Math.min(C.TOTAL, pm));
  }
  label.addEventListener('pointerdown', e => {
    primeAudio();
    label.setPointerCapture(e.pointerId);
    pending = null;
    paintAt(e);
    rebuildWave();
    drawLabel();
  });
  label.addEventListener('pointermove', e => {
    if (!pending) return;
    paintAt(e);
    rebuildWave();
    drawLabel();
  });
  const endStroke = () => {
    if (!pending) return;
    if (pending.b - pending.a > 0.12) {
      state.smudges.push({a: pending.a - 0.15, b: pending.b + 0.15});
      state.smudges.sort((p, q) => p.a - q.a);
    }
    pending = null;
    structuralChange();
  };
  label.addEventListener('pointerup', endStroke);
  label.addEventListener('pointercancel', endStroke);

  // ---------- scan canvas ----------
  const scan = $('scan-canvas'), sctx = scan.getContext('2d');

  const dispMods = [];   // module darkness by display index (rebuilt when needed)
  function rebuildDisp() {
    dispMods.length = 0;
    for (let dm = 0; dm < C.TOTAL; dm++) {
      const pm = state.flipped ? C.TOTAL - dm - 1 : dm;
      const mi = Math.floor(pm) - C.QUIET;
      dispMods.push(mi >= 0 && mi < 95 && modules[mi] === 1);
    }
  }

  function drawScan() {
    const [w, h, dpr] = sizeCanvas(scan, 330);
    const ctx = sctx;
    ctx.clearRect(0, 0, w, h);
    rebuildDisp();
    const padX = 24 * dpr, innerW = w - 2 * padX;
    const xOf = dm => padX + dm / C.TOTAL * innerW;

    // Label strip under the laser.
    const stripY = 16 * dpr, stripH = 104 * dpr;
    ctx.fillStyle = '#f2ead8';
    roundRect(ctx, padX, stripY, innerW, stripH, 4 * dpr);
    ctx.fill();
    ctx.strokeStyle = '#3a4754';
    ctx.lineWidth = dpr;
    ctx.stroke();
    let run = 0;
    ctx.fillStyle = '#2a2416';
    for (let dm = C.QUIET; dm < C.QUIET + 95; dm++) {
      if (dispMods[dm]) run++;
      if ((dm === C.QUIET + 94 || !dispMods[dm + 1]) && run) {
        ctx.fillRect(xOf(dm + 1 - run), stripY + 10 * dpr, (xOf(dm + 1) - xOf(dm + 1 - run)), stripH - 20 * dpr);
        run = 0;
      }
    }
    state.smudges.concat(pending ? [pending] : []).forEach(s => {
      const da = state.flipped ? C.TOTAL - s.b : s.a, db = state.flipped ? C.TOTAL - s.a : s.b;
      ctx.fillStyle = 'rgba(23,18,14,.93)';
      roundRect(ctx, xOf(da), stripY + 6 * dpr, xOf(db) - xOf(da), stripH - 12 * dpr, 3 * dpr);
      ctx.fill();
    });
    ctx.fillStyle = '#7a6c4c';
    ctx.font = `${10 * dpr}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('<', xOf(C.QUIET) + 2 * dpr, stripY + stripH - 7 * dpr);
    ctx.textAlign = 'right';
    ctx.fillText('>', xOf(C.QUIET + 95) - 2 * dpr, stripY + stripH - 7 * dpr);

    // Laser.
    if (state.phase === 'sweep' && state.playing) {
      const lx = xOf(state.sweepX);
      const grad = ctx.createLinearGradient(lx - 26 * dpr, 0, lx + 26 * dpr, 0);
      grad.addColorStop(0, 'rgba(255,75,62,0)');
      grad.addColorStop(0.5, 'rgba(255,75,62,.30)');
      grad.addColorStop(1, 'rgba(255,75,62,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(lx - 26 * dpr, stripY, 52 * dpr, stripH);
    }
    if (state.phase === 'sweep') {
      const lx = xOf(state.sweepX);
      ctx.strokeStyle = '#ff4b3e';
      ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath();
      ctx.moveTo(lx, stripY - 6 * dpr);
      ctx.lineTo(lx, stripY + stripH + 6 * dpr);
      ctx.stroke();
    }

    // Waveform panel.
    const waveY = 148 * dpr, waveH = h - waveY - 26 * dpr;
    ctx.fillStyle = '#0d1117';
    roundRect(ctx, padX, waveY, innerW, waveH, 4 * dpr);
    ctx.fill();
    ctx.strokeStyle = '#3a4754';
    ctx.lineWidth = dpr;
    ctx.stroke();
    const midY = waveY + waveH / 2;
    ctx.strokeStyle = '#39b9e8';
    ctx.globalAlpha = 0.25;
    ctx.setLineDash([3 * dpr, 5 * dpr]);
    ctx.beginPath();
    ctx.moveTo(padX + 4 * dpr, midY);
    ctx.lineTo(padX + innerW - 4 * dpr, midY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    const sampleX = i => padX + (wave.x0 + i * DX) / C.TOTAL * innerW;
    const sampleY = v => waveY + 8 * dpr + (1 - v) * (waveH - 16 * dpr);
    const laserIdx = Math.max(1, Math.min(wave.samples.length,
      Math.round((state.sweepX - wave.x0) / DX)));
    // Ghost of the whole pass, then the revealed part in gold.
    ctx.strokeStyle = '#8b93a0';
    ctx.globalAlpha = 0.22;
    traceWave(ctx, 0, wave.samples.length, sampleX, sampleY, dpr);
    ctx.globalAlpha = 1;
    if (state.phase === 'hold' || !state.playing) {
      ctx.strokeStyle = '#e9c46a';
      traceWave(ctx, 0, wave.samples.length, sampleX, sampleY, dpr);
    } else {
      ctx.strokeStyle = '#e9c46a';
      traceWave(ctx, 0, laserIdx, sampleX, sampleY, dpr);
      ctx.strokeStyle = 'rgba(255,75,62,.75)';
      ctx.lineWidth = 1.4 * dpr;
      ctx.beginPath();
      ctx.moveTo(sampleX(laserIdx), waveY);
      ctx.lineTo(sampleX(laserIdx), waveY + waveH);
      ctx.stroke();
    }
    ctx.fillStyle = '#39b9e8';
    ctx.globalAlpha = 0.8;
    ctx.font = `${8 * dpr}px monospace`;
    ctx.textAlign = 'right';
    ctx.fillText('DIODE OUTPUT · 0.5 THRESHOLD', padX + innerW - 8 * dpr, waveY + 12 * dpr);
    ctx.globalAlpha = 1;

    // Module ruler with guard landmarks (display space).
    ctx.strokeStyle = '#2a3542';
    ctx.lineWidth = dpr;
    for (let dm = 0; dm <= C.TOTAL; dm++) {
      const x = xOf(dm);
      const guard = dm === C.QUIET || dm === C.QUIET + 3 || dm === C.QUIET + 45 ||
        dm === C.QUIET + 50 || dm === C.QUIET + 92 || dm === C.TOTAL;
      ctx.beginPath();
      ctx.moveTo(x, waveY + waveH);
      ctx.lineTo(x, waveY + waveH + (guard ? 7 : 3) * dpr);
      ctx.stroke();
    }
    ctx.fillStyle = '#e9c46a';
    ctx.font = `${8 * dpr}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('L', xOf(C.QUIET + 1.5), waveY + waveH + 16 * dpr);
    ctx.fillText('C', xOf(C.QUIET + 47.5), waveY + waveH + 16 * dpr);
    ctx.fillText('R', xOf(C.QUIET + 93.5), waveY + waveH + 16 * dpr);
    ctx.fillStyle = '#5f6b79';
    ctx.textAlign = 'left';
    ctx.fillText('9', xOf(0) + 2 * dpr, waveY + waveH + 16 * dpr);
    ctx.textAlign = 'right';
    ctx.fillText('9', xOf(C.TOTAL) - 2 * dpr, waveY + waveH + 16 * dpr);
  }

  function traceWave(ctx, i0, i1, sampleX, sampleY, dpr) {
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(sampleX(i0), sampleY(wave.samples[i0]));
    for (let i = i0 + 1; i < i1; i++) ctx.lineTo(sampleX(i), sampleY(wave.samples[i]));
    ctx.stroke();
  }

  // ---------- readout / verdict / check digit ----------
  const boxes = [];
  function buildBoxes() {
    const holder = $('digit-boxes');
    state.digits.forEach((_, i) => {
      const box = document.createElement('span');
      box.className = 'digit-box' + (i === 11 ? ' check' : '');
      box.id = 'r' + i;
      box.textContent = '·';
      holder.appendChild(box);
      boxes.push(box);
      if (i === 0 || i === 5) {
        const gap = document.createElement('span');
        gap.className = 'digit-box gap';
        holder.appendChild(gap);
      }
    });
  }

  const STAGE_TEXT = {
    quiet: 'The laser is still in the leading quiet zone.',
    guard: 'Crossing the start guard…',
    left: 'Reading the maker half, one digit at a time.',
    center: 'Crossing the centre guard…',
    right: 'Reading the item half.',
    end: 'Crossing the end guard…',
    trailing: 'Measuring the trailing quiet zone…'
  };
  const REJECT_HINTS = {
    'CHECK DIGIT MISMATCH': r => `Reads ${r.read}, but the sums expect ${r.expected}. The whole label is refused.`,
    'QUIET ZONE VIOLATION': () => 'Ink has eaten the quiet margin the decoder needs before it will even try to sync.',
    'NO GUARD FOUND': () => 'The three-bar start guard never arrived intact — bars are merged or torn apart.',
    'UNREADABLE DIGIT': () => 'A seven-module pattern that exists in no UPC table. The pass is refused.',
    'NO SIGNAL': () => 'The diode never went dark at all.'
  };

  function renderReadout() {
    let digits = [], stage = null;
    if (state.phase === 'sweep') {
      live = C.decodePartial(runsUpTo(state.sweepX));
      digits = live.digits;
      stage = live.stage;
    } else if (state.result) {
      digits = state.result.ok ? state.result.digits : (live ? live.digits : []);
    }
    boxes.forEach((box, i) => {
      const known = i < digits.length;
      box.textContent = known ? digits[i] : '·';
      box.classList.toggle('known', known);
      const bad = state.result && !state.result.ok &&
        state.result.reason === 'CHECK DIGIT MISMATCH' && i === 11;
      box.classList.toggle('bad', !!bad && known);
    });
    const chip = $('direction-chip').querySelector('b');
    const dir = state.result && state.result.direction;
    chip.textContent = dir === 'REV' ? 'R→L · UPSIDE DOWN' : dir === 'FWD' ? 'L→R' : '—';
    chip.className = dir === 'REV' ? 'rev' : '';

    const verdict = $('verdict');
    const icon = $('verdict-icon'), status = $('verdict-status'), hint = $('verdict-hint');
    if (state.result) {
      if (state.result.ok) {
        verdict.className = 'scan-verdict ok';
        icon.textContent = '▮';
        status.textContent = 'ACCEPTED';
        hint.textContent = `${state.result.digits.slice(0, 11).join('')} ${state.result.digits[11]} — check digit ${state.result.expected} agrees. Beep.`;
      } else {
        verdict.className = 'scan-verdict bad';
        icon.textContent = '✕';
        status.textContent = `REJECTED — ${state.result.reason}`;
        hint.textContent = (REJECT_HINTS[state.result.reason] || (() => ''))(state.result);
      }
    } else {
      verdict.className = 'scan-verdict';
      icon.textContent = '≡';
      status.textContent = 'AWAITING SWEEP';
      hint.textContent = STAGE_TEXT[stage] || 'The laser is crossing the label.';
    }
  }

  function renderCheckPanel() {
    const d = state.digits;
    const odd = [d[0], d[2], d[4], d[6], d[8], d[10]];
    const even = [d[1], d[3], d[5], d[7], d[9]];
    const sum3 = 3 * odd.reduce((a, b) => a + b, 0);
    const sum1 = even.reduce((a, b) => a + b, 0);
    const total = sum3 + sum1;
    const expected = C.checkDigit(d.slice(0, 11));
    const read = d[11];
    const html =
      `3 × (<b>${odd.join('+')}</b>) + (<i>${even.join('+')}</i>) = ` +
      `<b>${sum3}</b> + <i>${sum1}</i> = ${total}` +
      (total % 10 === 0 ? '' : ` → ${total} + <b>${expected}</b> = ${total + expected} (next ten)`);
    $('check-line').innerHTML = html;
    const stamp = $('check-stamp');
    if (expected === read) {
      stamp.textContent = `CHECK DIGIT ${read} — VALID`;
      stamp.className = 'check-stamp';
    } else {
      stamp.textContent = `PRINTED ${read} · SUMS EXPECT ${expected}`;
      stamp.className = 'check-stamp bad';
    }
  }

  // ---------- 1952 bullseye ----------
  const RING_MIN = 7, RING_MAX = 126;
  function rebuildBullseye() {
    const step = (RING_MAX - RING_MIN) / C.TOTAL;
    const dark = '#241f16', light = '#f2ead8';
    let svg = '';
    for (let k = C.TOTAL - 1; k >= 0; k--) {
      const isDark = k < 95 && modules[k] === 1;
      svg += `<circle cx="130" cy="130" r="${(RING_MIN + (k + 1) * step).toFixed(2)}" fill="${isDark ? dark : light}"/>`;
    }
    $('bull-rings').innerHTML = svg;
    drawBullWave();
  }

  function drawBullWave() {
    const deg = Number($('angle').value);
    $('angle-value').textContent = deg + '°';
    const rad = deg * Math.PI / 180;
    $('bull-ray').setAttribute('x2', 130 + Math.cos(rad) * 118);
    $('bull-ray').setAttribute('y2', 130 - Math.sin(rad) * 118);
    const canvas = $('bull-wave');
    const [w, h, dpr] = sizeCanvas(canvas, 96);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const darkAt = r => r >= 0 && r < 95 && modules[Math.floor(r)] === 1;
    const padX = 10 * dpr;
    const xOf = r => padX + r / C.TOTAL * (w - 2 * padX);
    const yOf = v => 10 * dpr + (1 - v) * (h - 20 * dpr);
    ctx.strokeStyle = '#39b9e8';
    ctx.globalAlpha = 0.25;
    ctx.setLineDash([3 * dpr, 5 * dpr]);
    ctx.beginPath();
    ctx.moveTo(padX, (yOf(0) + yOf(1)) / 2);
    ctx.lineTo(w - padX, (yOf(0) + yOf(1)) / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#e9c46a';
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const r = i / 200 * 95;
      const v = 1 - (darkAt(r - 0.3) + darkAt(r + 0.3)) / 2;
      if (i === 0) ctx.moveTo(xOf(r), yOf(v));
      else ctx.lineTo(xOf(r), yOf(v));
    }
    ctx.stroke();
    let runs = 1;
    for (let k = 1; k < 95; k++) if (modules[k] !== modules[k - 1]) runs++;
    $('runs-note').textContent = `θ = ${deg}° — ${runs} runs · the same at every angle`;
  }
  $('angle').addEventListener('input', drawBullWave);

  // ---------- controls ----------
  state.digits.forEach((_, i) => {
    const input = $('d' + i);
    input.addEventListener('input', () => {
      const v = input.value.replace(/[^0-9]/g, '');
      if (!v) { input.value = state.digits[i]; return; }
      state.digits[i] = Number(v);
      structuralChange();
      const next = $('d' + (i + 1));
      if (next) next.focus();
    });
    input.addEventListener('focus', () => input.select());
  });

  $('flip').addEventListener('click', () => {
    state.flipped = !state.flipped;
    $('flip').setAttribute('aria-pressed', state.flipped);
    structuralChange();
  });
  $('clean').addEventListener('click', () => {
    state.smudges = [];
    $('clean').setAttribute('aria-pressed', 'false');
    structuralChange();
  });
  $('fix-check').addEventListener('click', () => {
    state.digits[11] = C.checkDigit(state.digits.slice(0, 11));
    $('d11').value = state.digits[11];
    structuralChange();
  });
  $('play').addEventListener('click', () => {
    state.playing = !state.playing;
    $('play').setAttribute('aria-pressed', state.playing);
    $('play').innerHTML = state.playing
      ? '<span aria-hidden="true">Ⅱ</span> Pause the laser'
      : '<span aria-hidden="true">▶</span> Release the laser';
    renderAll();
  });
  $('speed-normal').addEventListener('click', () => setSlow(false));
  $('speed-slow').addEventListener('click', () => setSlow(true));
  function setSlow(slow) {
    state.slow = slow;
    $('speed-normal').setAttribute('aria-pressed', !slow);
    $('speed-slow').setAttribute('aria-pressed', slow);
  }
  window.addEventListener('pointerdown', primeAudio, {once: true});
  window.addEventListener('keydown', primeAudio, {once: true});

  function renderAll() {
    rebuildDisp();
    drawLabel();
    drawScan();
    renderReadout();
  }

  // ---------- public handle ----------
  window.scanLine = {
    useManualClock() { manual = true; },
    tick(dt) { step(dt); renderAll(); },
    set(patch) {
      let structural = false;
      if (Array.isArray(patch.digits) && patch.digits.length === 12 &&
          patch.digits.every(x => Number.isInteger(x) && x >= 0 && x <= 9)) {
        state.digits = patch.digits.slice();
        state.digits.forEach((v, i) => { $('d' + i).value = v; });
        structural = true;
      }
      if (Array.isArray(patch.smudges)) {
        state.smudges = patch.smudges
          .filter(s => Number.isFinite(s.a) && Number.isFinite(s.b))
          .map(s => ({a: Math.min(s.a, s.b), b: Math.max(s.a, s.b)}));
        structural = true;
      }
      if (typeof patch.flipped === 'boolean') {
        state.flipped = patch.flipped;
        $('flip').setAttribute('aria-pressed', state.flipped);
        structural = true;
      }
      if (typeof patch.playing === 'boolean') {
        state.playing = patch.playing;
        $('play').setAttribute('aria-pressed', state.playing);
        $('play').innerHTML = state.playing
          ? '<span aria-hidden="true">Ⅱ</span> Pause the laser'
          : '<span aria-hidden="true">▶</span> Release the laser';
      }
      if (typeof patch.slow === 'boolean') setSlow(patch.slow);
      if (structural) structuralChange();
      else renderAll();
    },
    getState() {
      return {
        digits: state.digits.slice(),
        flipped: state.flipped,
        smudges: state.smudges.map(s => ({a: s.a, b: s.b})),
        playing: state.playing,
        slow: state.slow,
        sweepX: state.sweepX,
        phase: state.phase,
        sweepIndex: state.sweepIndex,
        liveDigits: live ? live.digits.slice() : [],
        liveStage: live ? live.stage : null,
        result: state.result && Object.assign({}, state.result)
      };
    }
  };

  // ---------- boot ----------
  buildBoxes();
  if (!state.playing) {
    $('play').setAttribute('aria-pressed', 'false');
    $('play').innerHTML = '<span aria-hidden="true">▶</span> Release the laser';
  }
  rebuildBullseye();
  renderCheckPanel();
  rebuildWave();
  renderAll();
  function frame(now) {
    if (!manual) {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      step(dt);
      renderAll();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (window.ResizeObserver) {
    new ResizeObserver(() => renderAll()).observe(scan);
    new ResizeObserver(() => renderAll()).observe(label);
    new ResizeObserver(drawBullWave).observe($('bull-wave'));
  }
})();
