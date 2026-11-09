// Set Point: a small DC power-flow model of the 9 November 1965 cascade.
// Buses, lines and dispatch are invented round numbers chosen to echo the
// real event, not a reconstruction of the 1965 network.
(function (root) {
  'use strict';

  // gen / load in MW; pop in millions of people (rough, for the readout only).
  const BUSES = [
    { id: 'beck', name: 'Sir Adam Beck', short: 'BECK', gen: 1600, load: 100, pop: 0.3, x: 175, y: 300 },
    { id: 'tor', name: 'Toronto', short: 'TORONTO', gen: 300, load: 2015, pop: 3.0, x: 120, y: 80 },
    { id: 'nia', name: 'Niagara (NY)', short: 'NIAGARA', gen: 1900, load: 500, pop: 1.3, x: 255, y: 375 },
    { id: 'roc', name: 'Rochester', short: 'ROCHESTER', gen: 200, load: 600, pop: 1.0, x: 430, y: 300 },
    { id: 'syr', name: 'Syracuse', short: 'SYRACUSE', gen: 400, load: 700, pop: 1.2, x: 580, y: 265 },
    { id: 'alb', name: 'Albany', short: 'ALBANY', gen: 600, load: 800, pop: 1.5, x: 745, y: 300 },
    { id: 'nyc', name: 'New York City', short: 'NEW YORK', gen: 3935, load: 4000, pop: 10.5, x: 735, y: 480 },
    { id: 'bos', name: 'New England', short: 'NEW ENGLAND', gen: 2700, load: 2920, pop: 11.0, x: 895, y: 345 },
  ];
  const TOTAL_POP = BUSES.reduce((a, b) => a + b.pop, 0);

  // x = reactance (per unit, relative); limit in MW. The five Beck–Toronto
  // lines carry `relay: true`: their backup relays use the set point slider.
  const LINES = [
    { a: 'beck', b: 'tor', x: 0.97, relay: true, name: 'Beck–Toronto 1' },
    { a: 'beck', b: 'tor', x: 1.00, relay: true, name: 'Beck–Toronto 2' },
    { a: 'beck', b: 'tor', x: 1.01, relay: true, name: 'Beck–Toronto 3' },
    { a: 'beck', b: 'tor', x: 1.02, relay: true, name: 'Beck–Toronto 4' },
    { a: 'beck', b: 'tor', x: 1.03, relay: true, name: 'Beck–Toronto 5' },
    { a: 'beck', b: 'nia', x: 0.25, limit: 1500, name: 'Niagara River tie' },
    { a: 'nia', b: 'roc', x: 0.9, limit: 900, name: 'Niagara–Rochester' },
    { a: 'roc', b: 'syr', x: 0.9, limit: 900, name: 'Rochester–Syracuse' },
    { a: 'nia', b: 'syr', x: 1.6, limit: 700, name: 'Niagara–Syracuse (south)', bend: [450, 420] },
    { a: 'syr', b: 'alb', x: 0.8, limit: 1000, name: 'Syracuse–Albany' },
    { a: 'alb', b: 'nyc', x: 0.7, limit: 1100, name: 'Albany–New York' },
    { a: 'alb', b: 'bos', x: 0.9, limit: 800, name: 'Albany–New England' },
    { a: 'nyc', b: 'bos', x: 0.8, limit: 800, name: 'New York–New England' },
  ];
  const IDX = Object.fromEntries(BUSES.map((b, i) => [b.id, i]));
  LINES.forEach(l => { l.i = IDX[l.a]; l.j = IDX[l.b]; });

  // An island whose load exceeds its generation by more than this share
  // loses frequency and goes dark.
  const DEFICIT_LIMIT = 0.08;

  function solve(A, b) { // Gaussian elimination with partial pivoting
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let s = M[r][n];
      for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
      x[r] = s / M[r][r];
    }
    return x;
  }

  function islands(up, dark) {
    const seen = new Array(BUSES.length).fill(false), out = [];
    for (let s = 0; s < BUSES.length; s++) {
      if (seen[s] || dark[s]) continue;
      const group = [], stack = [s];
      seen[s] = true;
      while (stack.length) {
        const u = stack.pop();
        group.push(u);
        LINES.forEach((l, k) => {
          if (!up[k]) return;
          const v = l.i === u ? l.j : l.j === u ? l.i : -1;
          if (v >= 0 && !seen[v] && !dark[v]) { seen[v] = true; stack.push(v); }
        });
      }
      out.push(group.sort((a, b) => a - b));
    }
    return out;
  }

  // Balance one island (governors share any mismatch in proportion to
  // generation) and return the DC line flows inside it.
  function flowIsland(group, up, loads, flows) {
    const gen = group.reduce((a, i) => a + BUSES[i].gen, 0);
    const load = group.reduce((a, i) => a + loads[i], 0);
    const scale = gen > 0 ? load / gen : 0;
    if (group.length < 2) return;
    const slack = group[0], rest = group.slice(1), pos = new Map(rest.map((b, k) => [b, k]));
    const B = rest.map(() => new Array(rest.length).fill(0));
    const P = rest.map(i => BUSES[i].gen * scale - loads[i]);
    LINES.forEach((l, k) => {
      if (!up[k] || !group.includes(l.i)) return;
      const y = 1 / l.x, a = pos.get(l.i), b = pos.get(l.j);
      if (a !== undefined) B[a][a] += y;
      if (b !== undefined) B[b][b] += y;
      if (a !== undefined && b !== undefined) { B[a][b] -= y; B[b][a] -= y; }
    });
    const th = solve(B, P), theta = i => (i === slack ? 0 : th[pos.get(i)]);
    LINES.forEach((l, k) => { if (up[k] && group.includes(l.i)) flows[k] = (theta(l.i) - theta(l.j)) / l.x; });
  }

  function flowsFor(up, dark, loads) {
    const flows = new Array(LINES.length).fill(0);
    islands(up, dark).forEach(g => flowIsland(g, up, loads, flows));
    return flows;
  }

  function limitOf(line, setPoint) { return line.relay ? setPoint : line.limit; }

  function baseLoads(surge) {
    return BUSES.map(b => b.load + (b.id === 'tor' ? surge : 0));
  }

  // Run the cascade. `surge` is the extra Toronto evening load (MW) that
  // arrives at 5:16:11 pm. Returns the before/after states plus every event.
  function cascade(setPoint, surge) {
    const up = LINES.map(() => true), dark = BUSES.map(() => false);
    const before = flowsFor(up, dark, baseLoads(0));
    const loads = baseLoads(surge);
    const events = [], frames = [];
    let t = 0;
    let logged = 0;
    const snap = () => {
      frames.push({ t, up: [...up], dark: [...dark], flows: flowsFor(up, dark, loads), events: events.slice(logged) });
      logged = events.length;
    };
    snap();
    for (let guard = 0; guard < 40; guard++) {
      // 1. islands that cannot meet their load collapse
      let collapsed = false;
      for (const g of islands(up, dark)) {
        const gen = g.reduce((a, i) => a + BUSES[i].gen, 0);
        const load = g.reduce((a, i) => a + loads[i], 0);
        if (load > 0 && (load - gen) / load > DEFICIT_LIMIT) {
          t += g.length > 2 ? 4.0 : 1.2;
          g.forEach(i => { dark[i] = true; });
          events.push({ t, kind: 'dark', buses: g.map(i => BUSES[i].id), deficit: Math.round(load - gen),
            pop: g.reduce((a, i) => a + BUSES[i].pop, 0) });
          collapsed = true;
        }
      }
      if (collapsed) { snap(); continue; }
      // 2. the most overloaded line trips (one relay at a time)
      const flows = flowsFor(up, dark, loads);
      let worst = -1, ratio = 1;
      LINES.forEach((l, k) => {
        const r = Math.abs(flows[k]) / limitOf(l, setPoint);
        if (up[k] && r > ratio + 1e-9) { ratio = r; worst = k; }
      });
      if (worst < 0) break;
      t += events.length ? 0.6 : 0;
      up[worst] = false;
      events.push({ t, kind: 'trip', line: worst, flow: Math.round(Math.abs(flows[worst])), limit: limitOf(LINES[worst], setPoint) });
      snap();
    }
    const last = frames[frames.length - 1];
    return {
      before, events, frames, final: last,
      darkPop: BUSES.reduce((a, b, i) => a + (last.dark[i] ? b.pop : 0), 0),
      tripped: last.up.filter(x => !x).length,
    };
  }

  // The relay setting that the first Beck–Toronto line needs to ride
  // through a given surge.
  function rideThrough(surge) {
    const up = LINES.map(() => true), dark = BUSES.map(() => false);
    const f = flowsFor(up, dark, baseLoads(surge));
    return Math.max(...LINES.map((l, k) => (l.relay ? Math.abs(f[k]) : 0)));
  }

  function clock(t) { // seconds after 5:16:11.0 pm
    const s = 11 + t, m = 16 + Math.floor(s / 60);
    return `5:${String(m).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')} PM`;
  }

  root.SetPoint = { BUSES, LINES, TOTAL_POP, DEFICIT_LIMIT, cascade, rideThrough, flowsFor, baseLoads, clock, limitOf };
})(typeof window !== 'undefined' ? window : globalThis);
