// A turkey cross-section on a grid: heat conduction, Salmonella kill, and moisture loss.
(function (root) {
  const K = 0.45;            // meat conductivity, W/m·K
  const RHO_C = 1050 * 3500; // volumetric heat capacity, J/m³·K
  const DX = 0.005;          // 5 mm cells
  const DT = 10;             // seconds per step
  const H_OVEN = 11;         // oven: convection + radiation, W/m²·K (tuned to ~13 min/lb at 325°F)
  const SKIN_MAX_C = 90;     // evaporation holds wet skin near this while it roasts
  const H_REST = 6;          // loosely tented on the counter
  const CAVITY_TAU = 50 * 60; // seconds for the cavity air to follow the outside air
  const H_CAVITY = 6;
  const ROOM_F = 70;
  const FRIDGE_F = 40;

  // Salmonella: 7-log time is 2.7 min at 150°F and changes tenfold every 10°F (z = 10°F).
  const D150 = 2.7 * 60 / 7;
  const Z_F = 10;
  const NO_KILL_BELOW_F = 130;
  const TARGET_LOG = 7;

  const fToC = (f) => (f - 32) * 5 / 9;
  const cToF = (c) => c * 9 / 5 + 32;

  // Seconds per one log of kill at temperature T (°F).
  function dValue(tempF) {
    if (tempF < NO_KILL_BELOW_F) return Infinity;
    return D150 * Math.pow(10, (150 - tempF) / Z_F);
  }

  // Share of a cell's water squeezed out, from the hottest it ever got (°F).
  function moistureLoss(peakF) {
    return Math.min(0.30, Math.max(0, (peakF - 120) * 0.004));
  }

  // Outer ellipse is the body; the inner one is the empty cavity, sitting low like in a real bird.
  function createBird(pounds) {
    const s = Math.cbrt(pounds / 14);
    const a = 0.125 * s, b = 0.090 * s;
    const ca = 0.060 * s, cb = 0.045 * s, cy = 0.015 * s;
    const nx = Math.ceil((2 * a) / DX) + 4;
    const ny = Math.ceil((2 * b) / DX) + 4;
    const mask = new Uint8Array(nx * ny);
    const x0 = nx / 2, y0 = ny / 2;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x = (i + 0.5 - x0) * DX, y = (j + 0.5 - y0) * DX;
        if ((x / a) ** 2 + (y / b) ** 2 > 1) continue;
        mask[j * nx + i] = (x / ca) ** 2 + ((y - cy) / cb) ** 2 <= 1 ? 2 : 1;
      }
    }
    const start = fToC(FRIDGE_F);
    const T = new Float64Array(nx * ny).fill(start);
    const peak = new Float64Array(nx * ny).fill(start);
    const kill = new Float64Array(nx * ny);
    const meat = [];
    for (let k = 0; k < mask.length; k++) if (mask[k] === 1) meat.push(k);
    // Default probe: the thickest breast meat, halfway between the skin and the cavity roof.
    const top = Math.round(y0 - b / DX), roof = Math.round(y0 + (cy - cb) / DX);
    const probe = Math.round((top + roof) / 2) * nx + Math.floor(x0);
    return { pounds, nx, ny, mask, T, peak, kill, meat, cavity: start, probe, scratch: new Float64Array(nx * ny) };
  }

  // Series conductance (per metre of face) between a cell centre and the air across a face.
  const faceG = (h) => 1 / (1 / h + DX / (2 * K));

  function step(bird, airC, h, dt = DT) {
    const { nx, ny, mask, T, scratch: next } = bird;
    const gOut = faceG(h) * DX, gCav = faceG(H_CAVITY) * DX;
    const cap = RHO_C * DX * DX;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (mask[k] !== 1) continue;
        const t = T[k];
        let q = 0, edge = false;
        for (const n of [k - 1, k + 1, k - nx, k + nx]) {
          const m = mask[n];
          if (m === 1) q += K * (T[n] - t);
          else if (m === 2) q += gCav * (bird.cavity - t);
          else { q += gOut * (airC - t); edge = true; }
        }
        next[k] = t + dt * q / cap;
        if (edge && next[k] > SKIN_MAX_C) next[k] = SKIN_MAX_C;
      }
    }
    for (const k of bird.meat) {
      T[k] = next[k];
      if (T[k] > bird.peak[k]) bird.peak[k] = T[k];
      bird.kill[k] += dt / dValue(cToF(T[k]));
    }
    bird.cavity += (airC - bird.cavity) * (dt / CAVITY_TAU);
  }

  function stats(bird) {
    let coldK = bird.meat[0], leastK = bird.meat[0], loss = 0;
    for (const k of bird.meat) {
      if (bird.T[k] < bird.T[coldK]) coldK = k;
      // Least-killed spot; ties (nothing killed yet) go to the colder cell.
      if (bird.kill[k] < bird.kill[leastK] || (bird.kill[k] === bird.kill[leastK] && bird.T[k] < bird.T[leastK])) leastK = k;
      loss += moistureLoss(cToF(bird.peak[k]));
    }
    return {
      probeF: cToF(bird.T[bird.probe]),
      coldF: cToF(bird.T[coldK]),
      coldK,
      leastKill: bird.kill[leastK],
      slowF: cToF(bird.T[leastK]),
      leastK,
      loss: loss / bird.meat.length,
    };
  }

  // Whole plan, start to carve: roast until the probe reads pullF, then rest.
  function cook({ pounds = 14, ovenF = 325, pullF = 165, restMin = 30, probe = null, maxHours = 8 }) {
    const bird = createBird(pounds);
    if (probe != null) bird.probe = probe;
    const oven = fToC(ovenF), room = fToC(ROOM_F);
    let t = 0;
    while (stats(bird).probeF < pullF && t < maxHours * 3600) { step(bird, oven, H_OVEN); t += DT; }
    const pulledAt = t;
    let restPeakF = -Infinity;
    for (let r = 0; r < restMin * 60; r += DT) {
      step(bird, room, H_REST); t += DT;
      restPeakF = Math.max(restPeakF, stats(bird).probeF);
    }
    return { bird, pulledAt, total: t, restPeakF, ...stats(bird) };
  }

  const api = {
    DX, DT, H_OVEN, H_REST, ROOM_F, FRIDGE_F, TARGET_LOG,
    fToC, cToF, dValue, moistureLoss, createBird, step, stats, cook,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Carryover = api;
})(this);
