/* Digital-audio math for the October 1, 1982 compact-disc launch. Pure stateless functions. */
(function (root) {
  'use strict';

  const CD = {
    rate: 44100, bits: 16, channels: 2, minutes: 74,
    innerMM: 25, outerMM: 58, diameter: 120,
    pitchUm: 1.6, clv: 1.2,            // track pitch (µm), constant linear velocity (m/s)
    laserNm: 780, na: 0.45,            // infrared laser, objective numerical aperture
    channelRate: 4321800,              // EFM channel bits per second
  };
  const TV = {
    NTSC: {name: 'NTSC 525/60', lines: 245, fieldLines: 262, fields: 60, perLine: 3},
    PAL:  {name: 'PAL 625/50',  lines: 294, fieldLines: 313, fields: 50, perLine: 3},
  };

  /* Frequency heard after sampling f at fs and replaying through the ideal low-pass:
     everything above Nyquist reflects back at multiples of fs/2. */
  function aliasFrequency(f, fs) {
    const nyq = fs / 2;
    const k = Math.round(f / fs);
    const a = Math.abs(f - k * fs);
    return a <= nyq ? a : fs - a;
  }
  const isAliasing = (f, fs) => aliasFrequency(f, fs) !== f;

  /* Two's-complement quantization like the CD: codes −2^(b−1) … 2^(b−1)−1. */
  function quantCode(x, bits) {
    const half = 1 << (bits - 1);
    const v = Math.round(Math.max(-1, Math.min(1, x)) * half);
    return Math.max(-half, Math.min(half - 1, v));
  }
  const codeValue = (code, bits) => code / (1 << (bits - 1));
  const quantize = (x, bits) => codeValue(quantCode(x, bits), bits);
  const snrDb = (bits) => 6.02 * bits + 1.76;
  const steps = (bits) => 1 << bits;

  function toTwos(code, bits) {
    const mask = (1 << bits) - 1;
    return (code & mask).toString(2).padStart(bits, '0').split('').map(Number);
  }
  const hexCode = (code) => '0x' + (code & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const dataRateMbits = (rate, bits, channels) => rate * bits * channels / 1e6;

  /* Constant linear velocity: the disc slows down as the laser moves outwards. */
  const rpmAt = (radiusMM, clv) => (clv || CD.clv) / (2 * Math.PI * radiusMM / 1000) * 60;
  const spiralTurns = () => Math.round((CD.outerMM - CD.innerMM) * 1000 / CD.pitchUm);
  const spiralKm = () => {
    const rAvgM = (CD.innerMM + CD.outerMM) / 2 / 1000;
    return 2 * Math.PI * rAvgM * spiralTurns() / 1000;
  };
  const spotUm = () => CD.laserNm / 1000 / CD.na;

  /* ---- Error-correction toy: rows of data bytes, one XOR parity byte each.
     The disc stores a physical order; interleaving writes down-then-across
     (column-major) so a physical burst lands one hit per logical row. ---- */

  function frameBytes(rows, cols, seed) {
    let s = (seed >>> 0) || 0x2a6f14;
    const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 16) & 255; };
    return Array.from({length: rows}, () => Array.from({length: cols}, rnd));
  }
  const parityOf = (row) => row.reduce((a, b) => a ^ b, 0);

  function scratchPhysical(start, length, rows, cols, interleaved) {
    const total = rows * (cols + 1);
    const out = [];
    for (let i = 0; i < length; i++) {
      const p = start + i;
      if (p >= 0 && p < total) out.push(p);
    }
    return out;
  }

  function woundToLogical(wound, rows, cols, interleaved) {
    // returns array of [row, col] with col === cols meaning the parity byte
    return wound.map((p) => {
      if (interleaved) return [p % rows, Math.floor(p / rows)];
      const w = cols + 1;
      return [Math.floor(p / w), p % w];
    });
  }

  function repairFrame(frame, wound, interleaved) {
    const rows = frame.length, cols = frame[0].length;
    const hurt = new Set(woundToLogical(wound, rows, cols, interleaved)
      .map(([r, c]) => r * (cols + 1) + c));
    const data = [], parity = [];
    let recovered = 0, lost = 0, wounded = 0;
    for (let r = 0; r < rows; r++) {
      const hits = [];
      for (let c = 0; c < cols; c++) if (hurt.has(r * (cols + 1) + c)) hits.push(c);
      const parityHit = hurt.has(r * (cols + 1) + cols);
      wounded += hits.length + (parityHit ? 1 : 0);
      const row = frame[r].map(() => 'ok');
      if (hits.length === 0) {
        parity.push(parityHit ? 'damaged' : 'ok');
      } else if (hits.length === 1 && !parityHit) {
        row[hits[0]] = 'repaired';
        recovered += 1;
        parity.push('spent');
      } else {
        hits.forEach((c) => { row[c] = 'lost'; });
        lost += hits.length;
        parity.push(parityHit ? 'damaged' : 'idle');
      }
      data.push(row);
    }
    return {data, parity, recovered, lost, wounded};
  }

  const api = {
    CD, TV, aliasFrequency, isAliasing,
    quantCode, codeValue, quantize, snrDb, steps, toTwos, hexCode, dataRateMbits,
    rpmAt, spiralTurns, spiralKm, spotUm,
    frameBytes, parityOf, scratchPhysical, woundToLogical, repairFrame,
  };
  root.cdCore = api;
  return api;
})(typeof self !== 'undefined' ? self : globalThis);
