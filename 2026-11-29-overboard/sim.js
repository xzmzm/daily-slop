// Overboard — toy climb model for the Floyd Bennett on Liv Glacier, 29 Nov 1929.
// Distances in statute miles from the glacier mouth, heights in feet, weights in pounds, time in minutes.
(function (root) {
  const SPEED = 1.5;          // ground speed, miles per minute (90 mph)
  const START_X = -6;         // start out over the Ross Ice Shelf
  const PASS_X = 50;          // head of the glacier
  const END_X = 58;           // out onto the polar plateau
  const PASS_ICE = 9600;      // ice under the pass
  const MOUTH_ICE = 300;
  const BAG = 150;            // one food sack
  const BAGS = 5;
  const FUEL_DUMP = 150;      // 25 gallons of gasoline
  const BURN = 6.5;           // fuel burn, lb per minute at climb power
  const CEIL_BASE = 9750;     // ceiling at REF_W with full climb power
  const REF_W = 15000;
  const CEIL_PER_LB = 2.2;    // feet of ceiling per pound shed
  const ROC0 = 1000;          // sea-level climb rate, ft/min, scales with how far below the ceiling you are
  const FUEL_NEED = 3060;     // fuel that must be left at mile 0 to reach the pole and get back to the depot
  const RATION = 8;           // lb of food per day for four men

  // Ice under the aircraft: shelf, then a glacier that steepens into the pass, then plateau.
  function ice(x) {
    if (x <= 0) return MOUTH_ICE;
    if (x >= PASS_X) return PASS_ICE + Math.min(x - PASS_X, 8) * 15;
    const t = x / PASS_X;
    return MOUTH_ICE + (PASS_ICE - MOUTH_ICE) * (0.25 * t + 0.75 * t * t * t);
  }

  // Air spilling down the glacier: a sink that builds toward the pass.
  function sink(x) {
    if (x < 34 || x > PASS_X + 2) return 0;
    const t = Math.min(1, (x - 34) / 12);
    return 230 * t * (x > PASS_X ? (PASS_X + 2 - x) / 2 : 1);
  }

  const ceiling = (w) => CEIL_BASE + (REF_W - w) * CEIL_PER_LB;
  const climbRate = (h, w, x) => ROC0 * (1 - h / ceiling(w)) * (1 + h / 12000) - sink(x);

  function createFlight() {
    return {
      t: 0, x: START_X, h: 7400, fuel: 3300, food: BAGS, dryW: 15000 - 3300 - BAGS * BAG,
      fuelDumps: 0, drops: [], outcome: null, log: [{ t: 0, x: START_X, text: 'Over the Ross Ice Shelf, climbing for Liv Glacier' }],
    };
  }
  const weight = (f) => f.dryW + f.fuel + f.food * BAG;
  // Fuel left over at the depot on the way home, given fuel now and fuel still to burn before mile 0.
  const fuelMargin = (f) => f.fuel - FUEL_NEED + (f.x - 0) / SPEED * BURN;

  function say(f, text, cls) { f.log.push({ t: f.t, x: f.x, text, cls }); }

  function step(f, minutes) {
    const dt = 1 / 60;
    while (minutes > 1e-9 && !f.outcome) {
      const d = Math.min(dt, minutes);
      minutes -= d;
      f.h += climbRate(f.h, weight(f), f.x) * d;
      f.fuel -= BURN * d;
      f.x += SPEED * d;
      f.t += d;
      if (f.h <= ice(f.x) + 50) {
        f.outcome = { ok: false, kind: 'ice', x: f.x };
        say(f, `Into the ice at mile ${f.x.toFixed(1)}`, 'bad');
      } else if (f.x >= PASS_X && !f.cleared) {
        f.cleared = f.h - ice(PASS_X);
        say(f, `Over the pass with ${Math.round(f.cleared)} ft to spare`, 'good');
      } else if (f.x >= END_X) {
        const margin = fuelMargin(f);
        f.outcome = { ok: margin >= 0, kind: margin >= 0 ? 'plateau' : 'fuel', x: f.x, clearance: f.cleared, margin, food: f.food };
        say(f, margin >= 0 ? 'On the polar plateau, course for the Pole' : 'On the plateau, but too little fuel to get home', margin >= 0 ? 'good' : 'bad');
      }
    }
    return f;
  }

  function command(f, type) {
    if (f.outcome) return false;
    if (type === 'food' && f.food > 0) {
      f.food -= 1; f.drops.push({ x: f.x, h: f.h, what: 'food' });
      say(f, `Food sack overboard (${BAG} lb), ${f.food} left`);
      return true;
    }
    if (type === 'fuel') {
      f.fuel -= FUEL_DUMP; f.fuelDumps += 1; f.drops.push({ x: f.x, h: f.h, what: 'fuel' });
      say(f, `Dumped 25 gal of gasoline (${FUEL_DUMP} lb)`, fuelMargin(f) < 0 ? 'bad' : '');
      return true;
    }
    if (type === 'turn') {
      f.outcome = { ok: false, kind: 'turn', x: f.x, food: f.food };
      say(f, `Turned back at mile ${f.x.toFixed(1)}`, 'bad');
      return true;
    }
    return false;
  }

  // Where the current aircraft would be at the pass, with `extra` lb shed now and no further drops.
  function project(f, extra = 0) {
    const g = { ...f, dryW: f.dryW - extra, outcome: null, log: [], drops: [], cleared: undefined };
    const path = [[g.x, g.h]];
    let hit = null;
    while (g.x < PASS_X + 2) {
      const before = g.x;
      g.h += climbRate(g.h, weight(g), g.x) * 0.1;
      g.fuel -= BURN * 0.1; g.x += SPEED * 0.1; g.t += 0.1;
      path.push([g.x, g.h]);
      if (g.h <= ice(g.x) + 50 && hit === null) hit = g.x;
      if (before < PASS_X && g.x >= PASS_X) g.atPass = g.h - ice(PASS_X);
    }
    return { path, clearance: g.atPass, hit };
  }

  const P = { SPEED, START_X, PASS_X, END_X, PASS_ICE, BAG, BAGS, FUEL_DUMP, BURN, RATION, ice, sink, ceiling, climbRate, createFlight, weight, fuelMargin, step, command, project };
  if (typeof module !== 'undefined') module.exports = P; else root.Overboard = P;
})(this);
