// Early Returns — a toy 1952 election night.
// Each state is split into ten reporting units (four city, six rural).
// Units report at different times; we project the result two ways.
(() => {
  // [abbr, electoral votes 1952, approx. 1948 GOP two-party %, approx. 1952 GOP two-party %,
  //  time zone (0 ET .. 3 PT), tile column, tile row]
  const STATES = [
    ['ME', 5, 58, 66, 0, 11, 0],
    ['WA', 9, 45, 55, 3, 1, 1], ['ID', 4, 49, 66, 2, 2, 1], ['MT', 4, 41, 59.5, 2, 3, 1],
    ['ND', 4, 54, 71, 1, 4, 1], ['MN', 11, 41, 55.5, 1, 5, 1], ['WI', 12, 48, 61, 1, 7, 1],
    ['MI', 20, 51, 56, 0, 8, 1], ['VT', 3, 63, 72, 0, 10, 1], ['NH', 4, 53, 61, 0, 11, 1],
    ['OR', 6, 51, 61, 3, 1, 2], ['NV', 3, 47, 61, 3, 2, 2], ['WY', 3, 48, 63, 2, 3, 2],
    ['SD', 4, 52, 69, 1, 4, 2], ['IA', 10, 48, 64, 1, 5, 2], ['IL', 27, 49, 55, 1, 6, 2],
    ['IN', 13, 51, 58, 0, 7, 2], ['OH', 25, 49.8, 56.8, 0, 8, 2], ['PA', 32, 52, 53, 0, 9, 2],
    ['NY', 45, 51, 56, 0, 10, 2], ['MA', 16, 44, 54, 0, 11, 2], ['RI', 4, 41, 51, 0, 12, 2],
    ['CA', 32, 49, 56.8, 3, 1, 3], ['UT', 4, 45, 59, 2, 2, 3], ['CO', 6, 47, 61, 2, 3, 3],
    ['NE', 6, 54, 69, 1, 4, 3], ['MO', 13, 42, 50.7, 1, 5, 3], ['KY', 10, 42, 49.8, 0, 6, 3],
    ['WV', 8, 42, 48, 0, 7, 3], ['VA', 12, 44, 56.5, 0, 8, 3], ['MD', 9, 51, 56, 0, 9, 3],
    ['NJ', 16, 52, 58, 0, 10, 3], ['CT', 8, 51, 56, 0, 11, 3],
    ['AZ', 4, 45, 58.4, 2, 2, 4], ['NM', 4, 43, 55.5, 2, 3, 4], ['KS', 8, 55, 69, 1, 4, 4],
    ['AR', 8, 25, 44, 1, 5, 4], ['TN', 11, 39, 50.1, 1, 6, 4], ['NC', 14, 34, 46, 0, 7, 4],
    ['SC', 8, 10, 49.3, 0, 8, 4], ['DE', 3, 51, 52, 0, 9, 4],
    ['OK', 8, 37, 54.6, 1, 4, 5], ['LA', 10, 30, 47, 1, 5, 5], ['MS', 8, 15, 40, 1, 6, 5],
    ['AL', 11, 20, 35, 1, 7, 5], ['GA', 12, 21, 30, 0, 8, 5],
    ['TX', 24, 25, 53, 1, 4, 6], ['FL', 10, 39, 55, 0, 9, 6],
  ].map(([abbr, ev, r48, r52, tz, col, row]) => ({ abbr, ev, r48, r52, tz, col, row }));

  const SOUTH = new Set(['AL', 'AR', 'FL', 'GA', 'LA', 'MS', 'NC', 'SC', 'TN', 'TX', 'VA', 'KY', 'OK']);
  const TOTAL_EV = STATES.reduce((s, x) => s + x.ev, 0);
  const NEEDED = Math.floor(TOTAL_EV / 2) + 1;
  const START = 19, END = 28;          // 7 pm to 4 am Eastern, in hours
  const UNIVAC_CALL = 20.5;            // 8:30 pm
  const CLOSE = [19.5, 20, 21, 22.5];  // poll closing, Eastern time, by zone
  const URBAN = 4, UNITS = 10, URBAN_W = 1.6, RURAL_W = 0.6;
  const URBAN_OFF = -7, RURAL_OFF = 7 * (URBAN * URBAN_W) / ((UNITS - URBAN) * RURAL_W);
  const TYPO_STATE = 'NJ';             // a 1948 figure keyed in with an extra zero

  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function buildNation(seed = 1952) {
    const r = rng(seed);
    const units = [];
    STATES.forEach((st, si) => {
      const votes = (st.ev / TOTAL_EV) * 61e6 * (SOUTH.has(st.abbr) ? 0.65 : 1.2);
      const mine = [];
      for (let k = 0; k < UNITS; k++) {
        const urban = k < URBAN;
        const w = urban ? URBAN_W : RURAL_W;
        const off = urban ? URBAN_OFF : RURAL_OFF;
        const delay = urban ? 0.6 + r() * 2.6 : 1.1 + r() * 4.4;
        mine.push({
          si, urban, w,
          v52: votes * w / 10, v48: votes * w / 10 * 0.82,
          s48: st.r48 + off + gauss(r) * 1.5,
          s52: st.r52 + off + gauss(r) * 1.5,
          at: CLOSE[st.tz] + delay,
        });
      }
      // Shift so each state's weighted shares match its table values exactly.
      for (const key of ['s48', 's52']) {
        const target = key === 's48' ? st.r48 : st.r52;
        const mean = mine.reduce((s, u) => s + u[key] * u.w, 0) / UNITS;
        mine.forEach((u) => { u[key] = clamp(u[key] + target - mean, 2, 98); });
      }
      if (st.abbr === TYPO_STATE) mine.filter((u) => u.urban).sort((a, b) => a.at - b.at)[0].typoTarget = true;
      units.push(...mine);
    });
    return { units };
  }

  // Swing seen in one reporting unit. With the typo, one New Jersey city unit has its
  // 1948 Republican vote multiplied by ten, which makes the swing look hugely negative.
  function measuredSwing(u, typo) {
    let s48 = u.s48;
    if (typo && u.typoTarget) {
      const rep = s48 * 10;
      s48 = (100 * rep) / (rep + (100 - s48));
    }
    return u.s52 - s48;
  }

  function snapshot(nation, t, typo = false, draws = 600) {
    const n = STATES.length;
    const st = STATES.map(() => ({ cntR: 0, cntV: 0, totV: 0, swSum: 0, swW: 0, nRep: 0 }));
    const reg = { south: { s: 0, w: 0 }, north: { s: 0, w: 0 } };
    const all = [];
    let cntR = 0, cntV = 0, totV = 0;
    for (const u of nation.units) {
      const s = st[u.si];
      s.totV += u.v52; totV += u.v52;
      if (u.at > t) continue;
      const sw = measuredSwing(u, typo);
      s.cntR += u.v52 * u.s52 / 100; s.cntV += u.v52; s.nRep++;
      s.swSum += sw * u.v52; s.swW += u.v52;
      const g = SOUTH.has(STATES[u.si].abbr) ? reg.south : reg.north;
      g.s += sw * u.v52; g.w += u.v52;
      all.push([sw, u.v52]);
      cntR += u.v52 * u.s52 / 100; cntV += u.v52;
    }
    const natW = all.reduce((a, x) => a + x[1], 0);
    const natSwing = natW ? all.reduce((a, x) => a + x[0] * x[1], 0) / natW : 0;
    const sd = natW ? Math.sqrt(all.reduce((a, x) => a + (x[0] - natSwing) ** 2 * x[1], 0) / natW) : 10;

    const states = STATES.map((info, i) => {
      const s = st[i];
      const g = SOUTH.has(info.abbr) ? reg.south : reg.north;
      const swing = s.swW ? s.swSum / s.swW : g.w ? g.s / g.w : natSwing;
      let projR = s.cntR;
      for (const u of nation.units) if (u.si === i && u.at > t) projR += u.v52 * clamp(u.s48 + swing, 0, 100) / 100;
      const frac = s.cntV / s.totV;
      return {
        abbr: info.abbr, ev: info.ev, frac, reporting: s.nRep > 0, swing,
        count: s.cntV ? (100 * s.cntR) / s.cntV : null,
        proj: (100 * projR) / s.totV,
        known: !!s.swW,
      };
    });

    // Win odds: a shared national error plus a per-state one, both shrinking as votes come in.
    const r = rng(7);
    const nRep = all.length;
    const sigNat = nRep ? (sd / Math.sqrt(nRep)) * 1.0 + 0.1 : 8;
    let wins = 0, evSum = 0;
    for (let d = 0; d < draws; d++) {
      const nat = gauss(r) * sigNat;
      let ev = 0;
      for (const s of states) {
        const local = gauss(r) * (s.known ? 2 : 2.5);
        if (s.proj + (1 - s.frac) * (nat + local) > 50) ev += s.ev;
      }
      evSum += ev;
      if (ev >= NEEDED) wins++;
    }
    const pIke = wins / draws;

    let leadR = 0, leadD = 0;
    let projEvR = 0;
    for (const s of states) {
      if (s.count !== null) { if (s.count > 50) leadR += s.ev; else leadD += s.ev; }
      if (s.proj > 50) projEvR += s.ev;
    }
    return {
      t, typo, states, pIke,
      counted: cntV / totV,
      countShare: cntV ? (100 * cntR) / cntV : null,
      leadR, leadD, natSwing, sd,
      projEvR, projEvD: TOTAL_EV - projEvR,
      projShare: states.reduce((a, s, i) => a + s.proj * st[i].totV, 0) / totV,
    };
  }

  // Express a probability as "a TO b" odds, the way the teletype printed it.
  function odds(p) {
    const fav = p >= 0.5 ? 'EISENHOWER' : 'STEVENSON';
    const q = Math.max(p, 1 - p);
    if (q >= 0.99) return { a: 100, b: 1, fav };
    const ratio = q / (1 - q);
    if (ratio >= 10) return { a: Math.round(ratio), b: 1, fav };
    // Smallest denominator that lands within 6 % of the true ratio.
    let best = { a: Math.round(ratio), b: 1 };
    for (let b = 1; b <= 9; b++) {
      const a = Math.round(ratio * b);
      if (a >= b && Math.abs(a / b - ratio) / ratio < 0.06) { best = { a, b }; break; }
    }
    return { a: best.a, b: best.b, fav };
  }

  window.EarlyReturns = { STATES, TOTAL_EV, NEEDED, START, END, UNIVAC_CALL, TYPO_STATE, buildNation, snapshot, odds };
})();
