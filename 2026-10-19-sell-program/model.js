/* Minute-by-minute toy of 19 October 1987: portfolio insurers sell into a falling market.
   Flows are in $bn; price impact is permanent and linear in net flow. */
(function (root) {
  'use strict';
  const FRIDAY_CLOSE = 2246.74;   // Dow, Friday 16 October 1987
  const REAL_CLOSE = 1738.74;     // Dow, Monday 19 October 1987 (−22.6%)
  const MINUTES = 390;            // 9:30 → 16:00
  const CAP_BN = 3000;            // rough US equity market value, $bn
  const FLOOR = 0.85;             // insurers promise never to fall below 85% of Friday's wealth
  const MULT = 5;                 // CPPI multiplier: stock exposure = 5 × cushion above the floor
  const TUNING = {
    DEPTH: 20,      // $bn of net selling that moves the market by one unit of log-price
    PACE: 0.00025,  // share of the insured book a desk can push through per minute
    VALUE: 0.1,     // bargain hunters: $bn per minute per unit discount below Friday
    FEAR: 10,       // bargain hunters step back while the tape is falling fast
  };
  const HALTS = [0.07, 0.13, 0.20];
  const HALT_MIN = 15;

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; };
  }

  function simulate(opts = {}) {
    const insured = opts.insured ?? 0.03;   // share of the market run by portfolio insurance
    const shock = opts.shock ?? 0.05;       // opening gap from weekend selling
    const breaker = !!opts.breaker;
    const liquidity = opts.liquidity ?? 1;
    const { DEPTH, PACE, VALUE, FEAR } = { ...TUNING, ...(opts.tuning || {}) };
    const noise = rng(19101987);
    const W0 = insured * CAP_BN;
    let E = Math.min(W0, MULT * (1 - FLOOR) * W0), C = W0 - E;
    let P = 1 - shock;
    E *= P;
    const depth = DEPTH * liquidity;
    const gapOf = () => Math.max(0, E - Math.max(0, Math.min(E + C, MULT * (E + C - FLOOR * W0))));
    let haltLeft = 0, haltsHit = 0, closed = false, queued = 0, speed = 0;
    let soldTotal = 0, peakBacklog = 0;
    const out = [{ m: 0, p: P, sold: 0, backlog: gapOf(), halted: false }];
    for (let m = 1; m <= MINUTES; m++) {
      const backlog = gapOf();
      peakBacklog = Math.max(peakBacklog, backlog);
      const value = VALUE * liquidity * Math.max(0, 1 - P);
      if (closed || haltLeft > 0) {
        if (haltLeft > 0) haltLeft--;
        queued += value;            // bargain orders pile up while the floor is quiet
        speed *= 0.8;
        out.push({ m, p: P, sold: 0, backlog, halted: true });
        continue;
      }
      const sell = Math.min(backlog, PACE * W0);
      E -= sell; C += sell; soldTotal += sell;
      const buy = value / (1 + FEAR * speed * 100) + queued;
      queued = 0;
      const next = P * Math.exp((buy - sell + noise() * 0.12) / depth);
      speed = speed * 0.9 + Math.max(0, P - next) * 0.1;
      E *= next / P;
      P = next;
      if (breaker && haltsHit < HALTS.length && 1 - P >= HALTS[haltsHit]) {
        haltsHit++;
        if (haltsHit === HALTS.length) closed = true; else haltLeft = HALT_MIN;
      }
      out.push({ m, p: P, sold: sell, backlog: gapOf(), halted: false });
    }
    const low = Math.min(...out.map(d => d.p));
    return {
      path: out, close: P, low, soldBn: soldTotal, insuredBn: W0, haltsHit, closedEarly: closed,
      backlogBn: gapOf(), peakBacklogBn: peakBacklog,
      exposure: W0 ? E / (E + C) : 0,
    };
  }

  const dow = p => FRIDAY_CLOSE * p;
  const clock = m => {
    const t = 9 * 60 + 30 + Math.round(m);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };

  const api = { FRIDAY_CLOSE, REAL_CLOSE, MINUTES, CAP_BN, FLOOR, MULT, HALTS, HALT_MIN, TUNING, simulate, dow, clock };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SellModel = api;
})(this);
