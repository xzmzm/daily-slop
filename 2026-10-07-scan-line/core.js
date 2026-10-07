/* Scan Line — UPC-A encode / sample / decode core. Shared by app.js and `node --test`.
 * Module convention: 1 = dark (bar), 0 = light (space). Coordinates are in module
 * units: a label spans QUIET + 95 + QUIET modules; x=0 is the left edge of the
 * leading quiet zone in PRINTED space (display space flips when the label is). */
(function (root) {
  'use strict';

  const QUIET = 9;                 // quiet-zone modules per side (UPC-A spec)
  // A pass must show the full nominal quiet zone on each end (the sampling pad
  // adds one, so a clean edge measures 10); less and the decoder never syncs.
  const MIN_QUIET = QUIET;
  const TOTAL = 2 * QUIET + 95;    // full label span, 113 modules
  const GUARD = [1, 0, 1];
  const CENTER = [0, 1, 0, 1, 0];
  const L_PATTERNS = [
    [0, 0, 0, 1, 1, 0, 1], [0, 0, 1, 1, 0, 0, 1], [0, 0, 1, 0, 0, 1, 1], [0, 1, 1, 1, 1, 0, 1],
    [0, 1, 0, 0, 0, 1, 1], [0, 1, 1, 0, 0, 0, 1], [0, 1, 0, 1, 1, 1, 1], [0, 1, 1, 1, 0, 1, 1],
    [0, 1, 1, 0, 1, 1, 1], [0, 0, 0, 1, 0, 1, 1]
  ];
  const R_PATTERNS = L_PATTERNS.map(p => p.map(b => 1 - b));
  const key = p => p.join('');
  const L_INDEX = new Map(L_PATTERNS.map((p, d) => [key(p), d]));
  const R_INDEX = new Map(R_PATTERNS.map((p, d) => [key(p), d]));
  const EDGE = 0.30;               // edge softening half-width, modules

  function checkDigit(first11) {
    let sum = 0;
    for (let i = 0; i < 11; i++) sum += (i % 2 === 0 ? 3 : 1) * Number(first11[i]);
    return (10 - sum % 10) % 10;
  }

  function encodeUpcA(digits12) {
    const d = [...digits12].map(Number);
    if (d.length !== 12 || d.some(x => !Number.isInteger(x) || x < 0 || x > 9)) return null;
    const mods = [];
    const push = bits => { for (const b of bits) mods.push(b); };
    push(GUARD);
    for (let i = 0; i < 6; i++) push(L_PATTERNS[d[i]]);
    push(CENTER);
    for (let i = 6; i < 12; i++) push(R_PATTERNS[d[i]]);
    push(GUARD);
    return mods;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Printed-space darkness at fractional module coordinate x.
  function darkAt(modules, smudges, xPrint) {
    if (xPrint < 0 || xPrint >= TOTAL) return false;
    for (const s of smudges) if (xPrint >= s.a && xPrint <= s.b) return true;
    const m = Math.floor(xPrint) - QUIET;
    return m >= 0 && m < 95 && modules[m] === 1;
  }

  // Diode output 0..1 at display coordinate xDisp (the laser always travels left
  // to right over whatever face of the label it sees).
  function reflectance(modules, smudges, xDisp, flipped) {
    const x = flipped ? TOTAL - xDisp : xDisp;
    const dark = darkAt(modules, smudges, x - EDGE) + darkAt(modules, smudges, x + EDGE);
    return 1 - dark / 2;
  }

  // Samples the diode every dx modules from x0 to x1. `noise` maps i -> [-1,1].
  function sampleWave(modules, smudges, opts) {
    const {x0, x1, dx = 0.06, flipped = false, noise = null} = opts;
    const count = Math.max(1, Math.round((x1 - x0) / dx) + 1);
    const out = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      const v = reflectance(modules, smudges, x0 + i * dx, flipped);
      out[i] = Math.min(1, Math.max(0, v + (noise ? noise(i) : 0)));
    }
    return {samples: out, x0, dx};
  }

  // Thresholds a wave into runs with hysteresis (a Schmitt trigger, like a real
  // decoder front-end): enter dark below LO, return to light above HI. Plain
  // mid-level thresholding would chatter on every noise wiggle at an edge.
  // Durations are in module units; the first run starts at the first sample,
  // whatever its level (a dark first sample means the leading quiet zone is
  // already violated).
  const LO = 0.4, HI = 0.6;
  function waveToRuns(samples, dx) {
    const runs = [];
    const n = samples.length;
    if (!n) return runs;
    let light = samples[0] >= LO, start = 0;
    for (let j = 1; j < n; j++) {
      const l = light ? samples[j] >= LO : samples[j] > HI;
      if (l !== light) {
        runs.push({dark: !light, n: (j - start) * dx});
        light = l; start = j;
      }
    }
    runs.push({dark: !light, n: (n - start) * dx});
    return runs;
  }

  // Scales runs to whole modules (cheapest real-decoder trick: the narrowest run
  // anywhere is one module) and expands them to a module bit list.
  function runsToBits(runs) {
    let min = Infinity;
    for (const r of runs) if (r.n > 1e-6 && r.n < min) min = r.n;
    if (!isFinite(min)) return [];
    const bits = [];
    for (const r of runs) {
      const m = Math.round(r.n / min);
      for (let k = 0; k < m; k++) bits.push(r.dark ? 1 : 0);
    }
    return bits;
  }

  function reverseRuns(runs) {
    return runs.slice().reverse();
  }

  // Walks a module bit list (leading and trailing quiet included) through the
  // UPC-A grammar. With partial=true a truncated tail is reported as a stage
  // instead of a reject; structural damage is a reject either way.
  function parseScan(bits, partial) {
    const digits = [];
    const fail = reason => ({stage: 'reject', reason, digits, complete: false});
    let i = 0;
    while (i < bits.length && bits[i] === 0) i++;
    if (i === bits.length) return {stage: 'quiet', digits, complete: false};
    if (i < MIN_QUIET) return fail('QUIET ZONE VIOLATION');
    const at = (pos, len) => bits.slice(pos, pos + len).join('');
    if (bits.length - i < 3) return partial ? {stage: 'guard', digits, complete: false} : fail('NO GUARD FOUND');
    if (at(i, 3) !== '101') return fail('NO GUARD FOUND');
    let p = i + 3;
    for (let side = 0; side < 2; side++) {
      for (let k = 0; k < 6; k++) {
        if (bits.length - p < 7) {
          if (partial) return {stage: side === 0 ? 'left' : 'right', digits, complete: false};
          return fail('UNREADABLE DIGIT');
        }
        const d = (side === 0 ? L_INDEX : R_INDEX).get(at(p, 7));
        if (d === undefined) return fail('UNREADABLE DIGIT');
        digits.push(d);
        p += 7;
      }
      const after = side === 0 ? ['01010', 5, 'center'] : ['101', 3, 'end'];
      if (bits.length - p < after[1]) {
        if (partial) return {stage: after[2], digits, complete: false};
        return fail('NO GUARD FOUND');
      }
      if (at(p, after[1]) !== after[0]) return fail('NO GUARD FOUND');
      p += after[1];
    }
    let q = p;
    while (q < bits.length && bits[q] === 0) q++;
    if (q < bits.length) return fail('QUIET ZONE VIOLATION');
    if (q - p < MIN_QUIET) {
      if (partial) return {stage: 'trailing', digits, complete: false};
      return fail('QUIET ZONE VIOLATION');
    }
    return {stage: 'ok', digits, complete: true};
  }

  function verdictOf(digits, direction) {
    const expected = checkDigit(digits.slice(0, 11));
    const read = digits[11];
    return expected === read
      ? {ok: true, digits: digits.slice(), direction, expected}
      : {ok: false, reason: 'CHECK DIGIT MISMATCH', direction, expected, read};
  }

  // Full-pass decode. A pass that parses neither forward nor reversed is
  // damaged; one that parses reversed is an upside-down label (the L/R parity
  // split is what lets a scanner pick its own direction).
  function decodeRuns(runs) {
    if (!runs.length || !runs.some(r => r.dark)) {
      return {ok: false, reason: 'NO SIGNAL', direction: null};
    }
    const fwd = parseScan(runsToBits(runs), false);
    if (fwd.stage === 'ok') return verdictOf(fwd.digits, 'FWD');
    const rev = parseScan(runsToBits(reverseRuns(runs)), false);
    if (rev.stage === 'ok') return verdictOf(rev.digits, 'REV');
    return {ok: false, reason: fwd.reason, direction: null, expected: null, read: null};
  }

  // Mid-sweep decode of the runs completed so far. The final run is still
  // under the laser and is dropped whole — a digit resolves only once the
  // laser has crossed past its last module. Reversed labels cannot resolve
  // incrementally; they parse once the whole pass exists.
  function decodePartial(runs) {
    const rs = runs.slice();
    rs.pop();
    const out = parseScan(runsToBits(rs), true);
    return {stage: out.stage, digits: out.digits, complete: !!out.complete, reason: out.reason || null};
  }

  root.ScanLineCore = {
    QUIET, MIN_QUIET, TOTAL, GUARD, CENTER, EDGE, L_PATTERNS, R_PATTERNS,
    checkDigit, encodeUpcA, mulberry32, reflectance, sampleWave, waveToRuns,
    runsToBits, reverseRuns, parseScan, decodeRuns, decodePartial
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ScanLineCore;
})(typeof window !== 'undefined' ? window : globalThis);
