/* Firebreak — 1871 Chicago wind-and-ember spread core.
 * Shared by app.js and `node --test test.cjs`.
 *
 * The city is a grid; one cell ≈ one city lot (a 3×3 block of buildings plus
 * the streets around it). Fire spreads cell-to-cell with a probability that
 * leans hard downwind, and — the part that actually killed Chicago — a
 * convective column lofts embers that land Rayleigh-distributed downwind and
 * start spot fires beyond any gap, including the river. */
(function (root) {
  'use strict';

  const GRID_W = 64, GRID_H = 44;
  const STREET = 0, WOOD = 1, BRICK = 2, WATER = 3, CINDER = 4, RUBBLE = 5;
  // Chicago's streets and sidewalks were wooden plank too — fuel, if poor fuel
  const FUEL = { [STREET]: 0.35, [WOOD]: 1.0, [BRICK]: 0.42 };
  const TPS = 6;                                     // sim minutes per real second at 1×
  const START_MIN = 21 * 60;                         // 9:00 PM, Sunday 8 Oct 1871
  const RAIN_MIN = START_MIN + 26 * 60 + 30;          // the real rain, late Monday night
  const RIVER_CELLS = 3.1;                           // mean river width in cells
  const MAX_BLASTS = 32;
  const ORIGIN = { x: 8, y: 36 };                    // De Koven Street barn

  // ---- seeded RNG -----------------------------------------------------------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gaussian(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ---- geography (stylized 1871 Chicago: the river Y + the lake) ------------
  // Screen space: +x east, +y south. Wind dir is a screen-space angle the wind
  // blows TOWARD, so the historic SW gale is -45°.
  const RIVERS = [
    { a: [30, 15.5], b: [57.5, 14.0], w: 3.4 },            // main stem → the lake
    { a: [30.8, 15.5], b: [33.5, -1], w: 2.6 },            // north branch
    { a: [30, 15.5], c: [25, 26], b: [13, 41.5], w: 2.6 }, // south branch (bezier)
  ];
  const SOUTH_SAMPLES = (() => {
    const r = RIVERS[2], pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, u = 1 - t;
      pts.push([
        u * u * r.a[0] + 2 * u * t * r.c[0] + t * t * r.b[0],
        u * u * r.a[1] + 2 * u * t * r.c[1] + t * t * r.b[1],
      ]);
    }
    return pts;
  })();

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  // distance to the nearest river arm (the sampled bezier counts as a polyline)
  function waterDist(x, y) {
    let best = Infinity;
    for (const r of RIVERS) {
      if (r.c) {
        for (let i = 0; i < SOUTH_SAMPLES.length - 1; i++) {
          const p = SOUTH_SAMPLES[i], q = SOUTH_SAMPLES[i + 1];
          best = Math.min(best, segDist(x, y, p[0], p[1], q[0], q[1]));
        }
      } else {
        best = Math.min(best, segDist(x, y, r.a[0], r.a[1], r.b[0], r.b[1]));
      }
    }
    return best;
  }
  function onWater(x, y) {
    if (x >= 57.2 + Math.sin(y * 0.31) * 1.3) return true;         // Lake Michigan
    for (const r of RIVERS) if (waterDist(x, y) <= r.w / 2) return true;
    return false;
  }

  function makeCity(seed) {
    const rng = mulberry32((seed ^ 0x9E3779B9) >>> 0);
    const cells = new Uint8Array(GRID_W * GRID_H);
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const i = y * GRID_W + x;
        if (onWater(x + 0.5, y + 0.5)) { cells[i] = WATER; continue; }
        if (x % 4 === 0 || y % 4 === 0) { cells[i] = STREET; continue; }
        const downtown = x >= 33 && x <= 53 && y >= 6 && y <= 13;
        if (downtown && rng() < 0.55) cells[i] = BRICK;
        else if (rng() < 0.82) cells[i] = WOOD;
        else cells[i] = STREET;                       // an empty lot
      }
    }
    // the O'Leary barn and yard: a solid wood compound
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = ORIGIN.x + dx, y = ORIGIN.y + dy;
      if (x >= 0 && y >= 0 && x < GRID_W && y < GRID_H) cells[y * GRID_W + x] = WOOD;
    }
    // the Water Works survived the fire — mark it as brick
    for (const [x, y] of [[45, 3], [46, 3], [45, 4], [46, 4]]) {
      if (!onWater(x + 0.5, y + 0.5)) cells[y * GRID_W + x] = BRICK;
    }
    let fuel = 0, capacity = 0;
    for (const t of cells) {
      if (t === WOOD || t === BRICK) { fuel++; capacity++; }
      else if (t === STREET) capacity++;
    }
    return { cells, fuel, capacity, origin: ORIGIN };
  }

  // ---- ember statistics (the chart the UI shows) -----------------------------
  function emberProfile(speed) {
    const sigma = 0.6 + speed * 0.115;               // cells; measured gale lofting
    const mean = sigma * Math.sqrt(Math.PI / 2);
    const bars = [];
    for (let i = 0; i < 12; i++) {
      const d = i + 0.5;
      bars.push((d / (sigma * sigma)) * Math.exp(-d * d / (2 * sigma * sigma)));
    }
    const top = Math.max(...bars);
    const crossP = Math.exp(-(RIVER_CELLS * RIVER_CELLS) / (2 * sigma * sigma));
    return {
      sigma, mean, crossP,
      bars: bars.map(b => top > 0 ? b / top : 0),
    };
  }

  // ---- the simulation --------------------------------------------------------
  function createSim(opts = {}) {
    const seed = opts.seed ?? 7;
    const emberScale = opts.emberScale ?? 1;         // 0 in tests: no lofting
    let rng = mulberry32(seed);
    const city = makeCity(seed);
    const cells = Uint8Array.from(city.cells);
    const W = GRID_W, H = GRID_H, N = W * H;
    const fire = new Float32Array(N);                // minutes of burn left; 0 = not burning
    const everBurned = new Uint8Array(N);            // every cell the fire ever touched
    const smolder = new Map();                       // idx → {t, spot}
    const burning = new Set();
    let burningArr = [], arrDirty = true;

    let phase = 'ready';                             // ready | burning | ended
    let clockMin = START_MIN, acc = 0, speedMult = 1;
    let burned = 0, blasted = 0, spotFires = 0, backfires = 0, blasts = 0;
    let storm = false, stormEver = false, rained = false;

    const wind = { speed: clampWind(opts.windSpeed ?? 32), dir: normDir(opts.windDir ?? -Math.PI / 4) };
    function clampWind(v) { return Math.max(0, Math.min(50, v)); }
    function normDir(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
    let embers = [];

    const idx = (x, y) => y * W + x;
    function igniteCell(i, viaSpot) {
      const kind = cells[i];
      if (kind !== WOOD && kind !== BRICK && kind !== STREET) return false;
      if (fire[i] > 0 || smolder.has(i)) return false;
      fire[i] = (kind === WOOD ? 40 : kind === BRICK ? 52 : 14) * (0.7 + rng() * 0.6);
      burning.add(i); arrDirty = true; everBurned[i] = 1;
      if (viaSpot) spotFires++;
      return true;
    }

    function step() {
      if (phase !== 'burning') return;
      clockMin += 1;
      const w = wind.speed, cosA = Math.cos(wind.dir), sinA = Math.sin(wind.dir);
      const rate = 0.35 + w / 30;                    // wind fans the flames
      const alignK = 0.35 + w / 26;                  // and focuses them downwind

      // 1. cell-to-cell spread — radiation and flame reach across the narrow
      //    streets (kernel out to 2 cells), but never across open water
      for (const i of burning) {
        const x = i % W, y = (i / W) | 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          const d = Math.hypot(dx, dy);
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = idx(nx, ny), t = cells[n];
          if (FUEL[t] === undefined || fire[n] > 0 || smolder.has(n)) continue;
          if (d > 1.5) {          // fire never jumps open water — check the path
            let wet = false;
            for (const f of [1 / 3, 1 / 2, 2 / 3]) {
              const mi = idx(Math.round(x + dx * f), Math.round(y + dy * f));
              if (cells[mi] === WATER) { wet = true; break; }
            }
            if (wet) continue;
          }
          const cos = (dx * cosA + dy * sinA) / d;
          const p = 0.014 * FUEL[t] * rate * Math.exp(alignK * (cos - 1)) * Math.exp(-0.85 * (d - 1));
          if (rng() < p) igniteCell(n, false);
        }
      }

      // 2. burn-out — only buildings count toward the city's losses
      for (const i of Array.from(burning)) {
        fire[i] -= 1;
        if (fire[i] <= 0) {
          if (cells[i] === WOOD || cells[i] === BRICK) burned++;
          cells[i] = CINDER; burning.delete(i); arrDirty = true;
        }
      }

      // 3. smoldering spot fires catch (or die if the ember landed on dross)
      for (const [n, s] of Array.from(smolder)) {
        s.t -= 1;
        if (s.t <= 0) {
          smolder.delete(n);
          if (s.spot) igniteCell(n, true);
        }
      }

      // 4. the ember storm — the fire's real long game
      let emberN = 0;
      if (w >= 5) emberN = emberScale * 0.5 * Math.sqrt(burning.size) * Math.pow(w / 30, 1.35);
      if (!storm && burning.size > 0.06 * city.capacity) { storm = true; stormEver = true; }
      if (storm && burning.size < 0.03 * city.capacity) storm = false;
      if (storm) emberN *= 1.6;
      let count = Math.floor(emberN) + (rng() < emberN % 1 ? 1 : 0);
      count = Math.min(count, 90);
      if (count > 0) {
        if (arrDirty) { burningArr = Array.from(burning); arrDirty = false; }
        let sigma = (0.6 + w * 0.115) * (storm ? 1.45 : 1);
        for (let e = 0; e < count && burningArr.length; e++) {
          const src = burningArr[(rng() * burningArr.length) | 0];
          const a = wind.dir + gaussian(rng) * 0.38;
          const d = sigma * Math.sqrt(-2 * Math.log(1 - rng()));
          const sx = src % W, sy = (src / W) | 0;
          const tx = Math.round(sx + d * Math.cos(a)), ty = Math.round(sy + d * Math.sin(a));
          let landed = false;
          if (tx >= 0 && ty >= 0 && tx < W && ty < H) {
            const ti = idx(tx, ty), t = cells[ti];
            const pCatch = t === WOOD ? 0.6 : t === BRICK ? 0.22 : t === STREET ? 0.35 : 0;
            if (pCatch && rng() < pCatch) {
              if (fire[ti] === 0 && !smolder.has(ti)) {
                smolder.set(ti, { t: 3 + Math.floor(rng() * 6), spot: true });
                landed = true;
              }
            }
          }
          embers.push({ x0: sx + 0.5, y0: sy + 0.5, x1: tx + 0.5, y1: ty + 0.5, born: clockMin, flight: 1.5, spot: landed });
        }
        embers = embers.filter(e => e.born + e.flight + 0.8 > clockMin);
      }

      // 5. rain and endings
      if (clockMin >= RAIN_MIN) { doRain(); return; }
      if (burning.size === 0 && smolder.size === 0) end();
    }

    function doRain() {
      for (const i of burning) {
        if (cells[i] === WOOD || cells[i] === BRICK) burned++;
        cells[i] = CINDER;
      }
      burning.clear(); arrDirty = true; smolder.clear(); embers = [];
      rained = true; phase = 'ended';
    }
    function end() { phase = 'ended'; }

    const api = {
      GRID_W, GRID_H, ORIGIN, RIVER_CELLS,
      ignite() {
        if (phase !== 'ready') return false;
        // the barn and its yard catch together — a fire that starts as one lot
        // has a real chance of burning out before it finds the neighbors
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = ORIGIN.x + dx, y = ORIGIN.y + dy;
          if (x >= 0 && y >= 0 && x < W && y < H) igniteCell(idx(x, y), false);
        }
        phase = 'burning';
        return true;
      },
      blast(cx, cy) {
        if (phase === 'ended') return { ok: false, reason: 'ended' };
        if (blasts >= MAX_BLASTS) return { ok: false, reason: 'powder' };
        let cleared = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          if (dx * dx + dy * dy > 3.2) continue;
          const x = Math.round(cx) + dx, y = Math.round(cy) + dy;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = idx(x, y), t = cells[i];
          if (t === WOOD || t === BRICK || t === STREET) {
            if (t === WOOD || t === BRICK) blasted++;   // buildings lost on purpose
            cells[i] = RUBBLE; cleared++;
            if (burning.delete(i)) { fire[i] = 0; arrDirty = true; }
            smolder.delete(i);
          }
        }
        blasts++;
        let backfire = false;
        const p = Math.min(0.5, 0.08 + wind.speed / 150);
        if (rng() < p) {
          const candidates = [];
          for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
            const x = Math.round(cx) + dx, y = Math.round(cy) + dy;
            if (x < 0 || y < 0 || x >= W || y >= H) continue;
            const i = idx(x, y);
            if (FUEL[cells[i]] !== undefined && fire[i] === 0 && !smolder.has(i)) candidates.push(i);
          }
          if (candidates.length) {
            igniteCell(candidates[(rng() * candidates.length) | 0], false);
            backfires++;
            backfire = true;
          }
        }
        return { ok: true, cleared, backfire };
      },
      rainNow() {
        if (phase !== 'burning') return false;
        doRain();
        return true;
      },
      reset(nextSeed) {
        const s = createSim({ ...opts, seed: nextSeed ?? seed });
        return s;
      },
      set(patch = {}) {
        if (patch.windSpeed !== undefined) wind.speed = clampWind(patch.windSpeed);
        if (patch.windDir !== undefined) wind.dir = normDir(patch.windDir);
        if (patch.speed !== undefined) speedMult = Math.max(0, Math.min(3, patch.speed));
        return api.state();
      },
      tick(dtSec) {
        if (phase === 'burning') {
          acc += dtSec * TPS * speedMult;
          const steps = Math.floor(acc);
          acc -= steps;
          for (let s = 0; s < steps && phase === 'burning'; s++) step();
        }
        return api.state();
      },
      state() {
        const destroyed = burned + blasted;
        return {
          seed, phase, clockMin, rained,
          playing: phase === 'burning' && speedMult > 0,
          speed: speedMult,
          windSpeed: wind.speed, windDir: wind.dir,
          firestorm: storm, firestormEver: stormEver,
          burned, blasted, destroyed,
          percent: destroyed / city.fuel,
          spotFires, backfires, blasts, blastsLeft: MAX_BLASTS - blasts,
          emberSigma: emberProfile(wind.speed).sigma,
          emberCrossP: emberProfile(wind.speed).crossP,
        };
      },
      view() {                                       // snapshot for the renderer
        return { cells, fire, smolder, embers, burning: Array.from(burning), phase };
      },
      city, everBurned,
      emberProfile,
    };
    return api;
  }

  function clockLabel(min) {
    let m = Math.floor(min);
    const day = Math.floor(m / 1440), tod = m % 1440;
    const h24 = Math.floor(tod / 60), mm = String(tod % 60).padStart(2, '0');
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12; if (h12 === 0) h12 = 12;
    const dayName = ['SUN', 'MON', 'TUE'][Math.min(day, 2)];
    return `${dayName} ${String(h12).padStart(2, '0')}:${mm} ${ampm}`;
  }

  const exported = {
    GRID_W, GRID_H, TPS, START_MIN, RAIN_MIN, RIVER_CELLS, MAX_BLASTS, ORIGIN,
    STREET, WOOD, BRICK, WATER, CINDER, RUBBLE,
    mulberry32, makeCity, emberProfile, createSim, clockLabel,
    onWater, waterDist,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.firebreakCore = exported;
})(typeof self !== 'undefined' ? self : this);
