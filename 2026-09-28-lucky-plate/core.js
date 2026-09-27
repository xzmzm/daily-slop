/* core.js — the plate Fleming leaned over on 28 September 1928.
 *
 * Everything the UI shows is computed here so tests can pin it down:
 *  - temperature-gated growth of Staphylococcus (loves 35 °C) and of
 *    Penicillium (loves 23 °C, and stops making penicillin above ~30 °C),
 *  - penicillin secreted by the mold, diffusing and decaying in the agar,
 *  - bacteria killed wherever local drug beats their tolerance — the clear
 *    halo Fleming noticed,
 *  - tolerance mutation under drug stress, so resistant colonies can
 *    re-colonise the halo (the 1940s problem, already visible in 1928).
 *
 * Units: lengths in cells (GRID across a 90 mm dish), time in days.
 * The numbers that matter most are the two diffusion lengths:
 *   penicillin  λ_p = √(D/decay) ≈ 10 cells ≈ 7 mm — set by real agar
 *   diffusivity (~6 mm²/day), it fixes how wide the halo can ever get;
 *   the mold wave 2√(D_m·μ) ≈ 0.45 cells/day ≈ 0.3 mm/day — the pace of
 *   the colony that made Fleming's month.
 */

'use strict';

const GRID = 128;                 // cells across the dish
const PLATE_MM = 90;              // petri dish diameter
const CELL_MM = PLATE_MM / GRID;  // ≈ 0.703 mm per cell
const RADIUS_C = 62;              // agar radius in cells (rim margin)

// Growth-rate curves, per day. Gaussians in temperature are honest enough:
// S. aureus grows 7–48 °C with an optimum at 35; P. rubens manages 20–25
// on a bench and folds above ~30; penicillin secretion peaks near 20.
const STAPH = { tOpt: 35, sigma: 9, muMax: 3.2 };
const MOLD = { tOpt: 23, sigma: 7, muMax: 1.5, D: 0.035, lagDays: 2 };
const PEN = { tOpt: 20, sigma: 8, kMax: 2.2 };
const PEN_FIELD = { D: 12.55, decay: 0.12, maxMicro: 0.019 }; // D ≈ 6.2 mm²/day in agar
const BACT_SPREAD = 0.16;         // lawn edge creeps ~0.5 mm/day once dense
const KILL_RATE = 1.2;            // per day, per unit of (p − tolerance)
const CROWD_RATE = 1.5;           // mold overgrows the lawn beneath it
const TOL_BASE = 1.0;             // wild-type tolerance, drug units
// One simulated cell stands for ~10^7 bacteria, so a per-cell-day mutation
// rate of a few percent is in the honest range for selection demos.
const MUTATION = { chancePerDay: 0.05, sigma: 0.6, lo: 0.5, hi: 8 };

function gauss(T, tOpt, sigma) {
  const d = (T - tOpt) / sigma;
  return Math.exp(-d * d);
}
function staphRate(T) { return STAPH.muMax * gauss(T, STAPH.tOpt, STAPH.sigma); }
function moldRate(T) { return MOLD.muMax * gauss(T, MOLD.tOpt, MOLD.sigma); }
function penicillinRate(T) { return PEN.kMax * gauss(T, PEN.tOpt, PEN.sigma); }

// The single temperature where the two organisms keep pace (≈ 25.6 °C).
// Below it the mold outruns the lawn; above it the lawn drowns the plate.
function crossoverTemp() {
  let lo = 16, hi = 35;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (staphRate(mid) > moldRate(mid)) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

// The stylised London summer of 1928: a cold snap while Fleming was on
// holiday in Suffolk, then the warm spell that finally woke the staph.
const SCRIPT_1928 = {
  sporeDay: 5,        // ~6 Aug: the spore drifts up from the stairwell
  returnDay: 33,      // 3 Sep: Fleming back from vacation
  observeDay: 58,     // 28 Sep: the famous look at the plate
  keyframes: [
    [0, 19], [4, 17.5], [12, 17], [16, 17.5], [22, 23],
    [28, 26], [34, 25], [40, 26], [47, 22], [53, 20.5], [58, 20],
  ],
  tempAt(day) {
    const k = this.keyframes;
    if (day <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) {
      if (day <= k[i][0]) {
        const [d0, t0] = k[i - 1], [d1, t1] = k[i];
        const u = (day - d0) / (d1 - d0);
        const s = 0.5 - 0.5 * Math.cos(Math.PI * u); // smooth in time
        return t0 + (t1 - t0) * s;
      }
    }
    return k[k.length - 1][1];
  },
  events: [
    { day: 0, label: '8月1日 弗莱明去萨福克度假，这只皿没进孵箱，留在了长凳上' },
    { day: 5, label: '8月6日 一颗青霉孢子从楼下的霉菌室飘了进来' },
    { day: 16, label: '8月17日 冷锋还在——霉菌悄悄长了十几天，葡萄球菌几乎没动' },
    { day: 28, label: '8月29日 转暖：葡萄球菌铺开，霉菌周围却清出一圈' },
    { day: 33, label: '9月3日 弗莱明回实验室' },
    { day: 58, label: '9月28日 “霉菌周围……葡萄球菌在消融”' },
  ],
};

const MONTHS = [31, 31, 30, 31]; // Aug, Sep, Oct, Nov (day 0 = 1 Aug 1928)
function dateForDay(day) {
  let d = Math.floor(day), m = 8;
  for (const len of MONTHS) {
    if (d < len) return m + '月' + (d + 1) + '日';
    d -= len; m += 1;
  }
  return m + '月' + (d + 1) + '日';
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSim(opts) {
  const o = Object.assign({ temp: 20, seed: 7, mutations: true, script: null, decay: PEN_FIELD.decay }, opts);
  const N = GRID, size = N * N;
  const rand = mulberry32(o.seed);
  const inDish = new Uint8Array(size);
  const b = new Float32Array(size);   // bacteria density 0..1
  const tol = new Float32Array(size); // local drug tolerance
  const m = new Float32Array(size);   // mold biomass 0..1
  const p = new Float32Array(size);   // penicillin concentration
  const bNew = new Float32Array(size);
  const cNew = new Float32Array(size); // tol·b, advected with the lawn
  const scratch = new Float32Array(size);
  const grain = new Float32Array(size); // static agar texture

  let day = 0, temp = o.temp, script = o.script, spore = null, germinated = false;
  let headStart = false, peakZoneMm = 0;

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i, dx = i - N / 2 + 0.5, dy = j - N / 2 + 0.5;
      inDish[k] = dx * dx + dy * dy <= RADIUS_C * RADIUS_C ? 1 : 0;
      grain[k] = rand();
    }
  }

  function randn() {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function inoculate() {
    for (let k = 0; k < size; k++) {
      b[k] = inDish[k] ? 0.05 * (0.5 + rand()) : 0;
      tol[k] = TOL_BASE; m[k] = 0; p[k] = 0;
    }
    day = 0; spore = null; germinated = false; headStart = false; peakZoneMm = 0;
  }

  function dropSpore(i, j, atDay) {
    const ii = Math.max(1, Math.min(N - 2, Math.round(i)));
    const jj = Math.max(1, Math.min(N - 2, Math.round(j)));
    const k = jj * N + ii;
    if (!inDish[k]) return false;
    spore = { i: ii, j: jj, day: atDay !== undefined ? atDay : day };
    germinated = day >= spore.day + MOLD.lagDays;
    if (germinated) m[k] = Math.max(m[k], 0.05);
    return true;
  }

  // explicit 5-point stencil in micro-steps for stability (no-flux rim)
  function diffuse(field, dt, D) {
    const micro = Math.max(1, Math.ceil(dt / PEN_FIELD.maxMicro));
    const h = dt / micro;
    const f = D * h;
    for (let s = 0; s < micro; s++) {
      scratch.set(field);
      for (let j = 1; j < N - 1; j++) {
        const row = j * N;
        for (let i = 1; i < N - 1; i++) {
          const k = row + i;
          if (!inDish[k]) continue;
          const c = scratch[k];
          const sL = inDish[k - 1] ? scratch[k - 1] : c;
          const sR = inDish[k + 1] ? scratch[k + 1] : c;
          const sD = inDish[k - N] ? scratch[k - N] : c;
          const sU = inDish[k + N] ? scratch[k + N] : c;
          field[k] = c + f * (sL + sR + sD + sU - 4 * c);
        }
      }
    }
  }

  function step(dt) {
    const SUB = 0.25;
    for (let done = 0; done < dt; done += SUB) {
      const h = Math.min(SUB, dt - done);
      if (script) temp = script.tempAt(day);
      if (spore && !germinated && day >= spore.day + MOLD.lagDays) {
        germinated = true;
        m[spore.j * N + spore.i] = 0.05;
      }
      const muS = staphRate(temp), muM = moldRate(temp), kP = penicillinRate(temp);

      // mold: diffusion–logistic wave out of the spore. Runs over every
      // cell — the front advances INTO zero cells, which only gain biomass
      // if the stencil is evaluated there too.
      for (let j = 1; j < N - 1; j++) {
        const row = j * N;
        for (let i = 1; i < N - 1; i++) {
          const k = row + i;
          if (!inDish[k]) continue;
          const lap = m[k - 1] + m[k + 1] + m[k - N] + m[k + N] - 4 * m[k];
          m[k] += h * (MOLD.D * lap + muM * m[k] * (1 - m[k]));
          if (m[k] < 0) m[k] = 0;
        }
      }

      // bacteria: logistic growth where the mold hasn't taken the agar,
      // tolerance mutating under sub-lethal drug stress
      for (let k = 0; k < size; k++) {
        if (!inDish[k] || b[k] === 0) continue;
        const room = 1 - Math.min(1, m[k] * 2);
        b[k] += h * muS * b[k] * (1 - b[k] / room);
        if (b[k] > room) b[k] = room;
        if (b[k] < 1e-4) { b[k] = 0; continue; }
        if (o.mutations && p[k] > 0.35 && p[k] < 9 && rand() < MUTATION.chancePerDay * h) {
          tol[k] = Math.min(MUTATION.hi, Math.max(MUTATION.lo, tol[k] * (1 + MUTATION.sigma * randn())));
        }
      }

      // penicillin: secreted by live mold, decays everywhere
      for (let k = 0; k < size; k++) {
        if (!inDish[k]) { p[k] = 0; continue; }
        p[k] += h * (kP * m[k] - o.decay * p[k]);
        if (p[k] < 0) p[k] = 0;
      }
      diffuse(p, h, PEN_FIELD.D);

      // drug kills bacteria past their tolerance; mold buries the rest
      for (let k = 0; k < size; k++) {
        if (!inDish[k] || b[k] === 0) continue;
        const over = p[k] - tol[k];
        if (over > 0) b[k] -= h * KILL_RATE * over * b[k];
        b[k] -= h * CROWD_RATE * m[k] * b[k];
        if (b[k] < 1e-4) b[k] = 0;
      }

      // the lawn itself creeps, carrying its tolerance with it — this is
      // how a resistant survivor inside the halo becomes a resistant colony
      for (let j = 1; j < N - 1; j++) {
        const row = j * N;
        for (let i = 1; i < N - 1; i++) {
          const k = row + i;
          if (!inDish[k]) { bNew[k] = 0; cNew[k] = 0; continue; }
          const lap = b[k - 1] + b[k + 1] + b[k - N] + b[k + N] - 4 * b[k];
          const flux = h * BACT_SPREAD * lap;
          const nb = b[k] + flux;
          if (nb <= 1e-4) { bNew[k] = 0; cNew[k] = 0; continue; }
          const lapC = (b[k - 1] * tol[k - 1]) + (b[k + 1] * tol[k + 1])
            + (b[k - N] * tol[k - N]) + (b[k + N] * tol[k + N]) - 4 * b[k] * tol[k];
          bNew[k] = nb;
          cNew[k] = b[k] * tol[k] + h * BACT_SPREAD * lapC;
        }
      }
      b.set(bNew); // c kept only where the lawn lives; tol from c/b below.
      // The threshold must sit near zero: resetting tol at low density would
      // erase a mutant's identity exactly at its colony frontier.
      for (let k = 0; k < size; k++) tol[k] = b[k] > 1e-3 ? cNew[k] / b[k] : TOL_BASE;

      day += h;
    }
  }

  function moldRadius() {
    if (!spore || !germinated) return 0;
    let r = 0;
    for (let j = 0; j < N; j++) {
      const row = j * N;
      for (let i = 0; i < N; i++) {
        if (m[row + i] < 0.35) continue;
        const dx = i - spore.i, dy = j - spore.j;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) r = d;
      }
    }
    return r;
  }

  function zoneRadius(moldR) {
    // median distance, over 72 rays from the spore, to the first live lawn
    if (!spore) return 0;
    const hits = [];
    for (let a = 0; a < 72; a++) {
      const th = (a / 72) * 2 * Math.PI, cs = Math.cos(th), sn = Math.sin(th);
      let far = moldR;
      for (let r = Math.ceil(moldR); r < RADIUS_C; r++) {
        const i = Math.round(spore.i + cs * r), j = Math.round(spore.j + sn * r);
        if (i < 0 || j < 0 || i >= N || j >= N) break;
        if (b[j * N + i] > 0.45) { far = r; break; }
      }
      if (far < RADIUS_C) hits.push(far);
    }
    if (!hits.length) return RADIUS_C;
    hits.sort((x, y) => x - y);
    return hits[Math.floor(hits.length / 2)];
  }

  function stats() {
    let cov = 0, cells = 0, tolSum = 0, bSum = 0, resistantCells = 0;
    for (let k = 0; k < size; k++) {
      if (!inDish[k]) continue;
      cells++;
      if (b[k] > 0.45) cov++;
      if (b[k] > 0.05) { tolSum += tol[k]; bSum++; }
      if (tol[k] >= 1.8 && b[k] >= 0.3) resistantCells++;
    }
    const moldR = moldRadius();
    const zoneR = zoneRadius(moldR);
    const zoneMm = (spore && germinated) ? zoneR * 2 * CELL_MM : 0;
    if (zoneMm > peakZoneMm) peakZoneMm = zoneMm;
    return {
      day, temp, spore, germinated, headStart, peakZoneMm,
      dateLabel: dateForDay(day),
      moldMm: moldR * 2 * CELL_MM,
      zoneMm,
      haloMm: zoneMm - moldR * 2 * CELL_MM,
      coverage: cov / cells,
      meanTol: bSum ? tolSum / bSum : TOL_BASE,
      resistantCells,
    };
  }

  function noteHeadStart(s) {
    if (!headStart && s.germinated && s.moldMm >= 4 && s.coverage < 0.55) headStart = true;
    return headStart;
  }

  inoculate();
  return {
    GRID, CELL_MM, inDish, grain,
    get day() { return day; }, get temp() { return temp; },
    get spore() { return spore; }, get script() { return script; },
    set script(s) { script = s; }, set temp(t) { temp = t; },
    get mutations() { return o.mutations; }, set mutations(v) { o.mutations = v; },
    inoculate, dropSpore, step, stats, noteHeadStart,
    fields: { b, tol, m, p },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GRID, PLATE_MM, CELL_MM, RADIUS_C, TOL_BASE, SCRIPT_1928,
    staphRate, moldRate, penicillinRate, crossoverTemp, dateForDay,
    createSim, mulberry32,
  };
}
