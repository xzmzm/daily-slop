// Break the Line — a top-down Trafalgar tactics model.
// Units: metres, seconds. x points east (downwind), y points north.
// Fire is expected-value, not dice: every pair that can shoot drains hull
// continuously, so the same settings always give the same battle.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BreakTheLineModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const KNOT = 0.5144;
  const DEG = Math.PI / 180;
  const C = {
    nBritish: 8, nEnemy: 12,
    enemySpacing: 220,     // m between ships of the Combined line
    columnSpacing: 250,    // m between ships of the British column
    startOffset: 1600,     // m east-west from their line when the column starts
    range: 1200,           // m, longest range anything is fired at
    reach: 450,            // m, hit fraction falls by 1/e every `reach`
    arc: 25,               // degrees either side of the beam a broadside can bear
    rakeCone: 30,          // degrees off the keel line that count as a rake
    rakeDamage: 3, rakeHit: 0.6,
    damage: 4,             // hull points per broadside that hits
    baseRate: 1 / 180,     // broadsides per second for a Combined ship (one per 3 min)
    hold: -300,            // x where a "haul" ship turns to run parallel
    cut: 100,              // x where a "cut" ship turns after passing through
    leadHull: 130,         // the column is led by a three-decker, as Victory led hers
    strike: 15,            // hull at which a ship strikes her colours
    flee: 50,              // hull below which a Combined ship bears away downwind
    dt: 10, frameEvery: 3, minutes: 240,
  };
  const PRESETS = {
    nelson: { angle: 90, doctrine: 'cut', wind: 3, rate: 2 },
    line: { angle: 20, doctrine: 'haul', wind: 3, rate: 2 },
  };

  // square-rigger speed as a fraction of wind speed, by angle off the wind
  const POLAR = [[90, 0.40], [120, 0.48], [150, 0.46], [180, 0.42]];
  function polar(offWind) {
    for (let i = 1; i < POLAR.length; i++) {
      const [a0, f0] = POLAR[i - 1], [a1, f1] = POLAR[i];
      if (offWind <= a1) return f0 + (f1 - f0) * (Math.max(a0, offWind) - a0) / (a1 - a0);
    }
    return POLAR.at(-1)[1];
  }
  // wind blows from the west; heading 0 = north, 90 = east (dead run)
  const britishSpeed = (angle, wind) => wind * KNOT * polar(90 + angle);
  const enemySpeed = wind => wind * KNOT * 0.3; // under reduced sail, waiting
  const fleeSpeed = wind => wind * KNOT * polar(180);
  const hitFraction = d => 0.9 * Math.exp(-d / C.reach);
  const dir = h => [Math.sin(h * DEG), Math.cos(h * DEG)];

  function setup(p) {
    const vB = britishSpeed(p.angle, p.wind), vE = enemySpeed(p.wind);
    const ships = [];
    const [hx, hy] = dir(p.angle);
    // aim so the leader reaches its turn point beside the gap at the centre of their line
    const turnX = p.doctrine === 'cut' ? 0 : C.hold;
    const run = (turnX + C.startOffset) / hx;
    const aimY = (C.nEnemy / 2 - 0.5) * C.enemySpacing + vE * run / vB;
    const sx = turnX - hx * run, sy = aimY - hy * run;
    for (let k = 0; k < C.nBritish; k++) {
      ships.push({ side: 'B', id: k, x: sx - hx * C.columnSpacing * k, y: sy - hy * C.columnSpacing * k,
        heading: p.angle, hull: k === 0 ? C.leadHull : 100, status: 'approach', silent: 0, firstReply: null, dealt: 0, raked: 0 });
    }
    for (let i = 0; i < C.nEnemy; i++) {
      ships.push({ side: 'E', id: i, x: 30 * Math.sin(i * 2.3), y: i * C.enemySpacing,
        heading: 0, hull: 100, status: 'line', dealt: 0 });
    }
    return { ships, vB, vE };
  }

  const active = s => s.status !== 'struck' && s.status !== 'escaped';

  // is a friendly ship sitting on the line of fire from s to t?
  function masked(s, t, ships) {
    const dx = t.x - s.x, dy = t.y - s.y, L2 = dx * dx + dy * dy;
    for (const f of ships) {
      if (f === s || f.side !== s.side || f.status === 'escaped') continue;
      const u = ((f.x - s.x) * dx + (f.y - s.y) * dy) / L2;
      if (u <= 0 || u >= 1) continue;
      if (Math.hypot(s.x + u * dx - f.x, s.y + u * dy - f.y) < 40) return true;
    }
    return false;
  }

  // for one broadside (side = +1 starboard, -1 port), the nearest target it bears on
  function target(s, side, ships) {
    const [hx, hy] = dir(s.heading);
    const bx = hy * side, by = -hx * side; // starboard is the heading turned 90° clockwise
    const cosArc = Math.cos(C.arc * DEG);
    let best = null, bestD = Infinity;
    for (const t of ships) {
      if (t.side === s.side || !active(t)) continue;
      const d = Math.hypot(t.x - s.x, t.y - s.y);
      if (d > C.range || d >= bestD) continue;
      if (((t.x - s.x) * bx + (t.y - s.y) * by) / d < cosArc) continue;
      if (masked(s, t, ships)) continue;
      best = t; bestD = d;
    }
    return best && { t: best, d: bestD };
  }

  function blocked(e, ships) {
    return ships.some(b => b.side === 'B' && b.status !== 'struck' &&
      b.x > e.x + 20 && b.x - e.x < 500 && Math.abs(b.y - e.y) < 350);
  }

  function snapshot(time, ships, fire) {
    return {
      t: time,
      ships: ships.map(s => ({ side: s.side, x: s.x, y: s.y, heading: s.heading, hull: s.hull, status: s.status })),
      fire,
      strength: {
        B: ships.filter(s => s.side === 'B' && s.status !== 'struck').reduce((a, s) => a + s.hull, 0),
        E: ships.filter(s => s.side === 'E' && active(s)).reduce((a, s) => a + s.hull, 0),
      },
    };
  }

  function simulate(params) {
    const p = Object.assign({}, PRESETS.nelson, params);
    const { ships, vB, vE } = setup(p);
    const rate = { B: C.baseRate * p.rate, E: C.baseRate };
    const steps = C.minutes * 60 / C.dt;
    const frames = [];
    let lastFire = [];
    let rakeDamage = 0, britishDamage = 0;
    for (let n = 0; n <= steps; n++) {
      const time = n * C.dt;
      // --- fire ---
      const fire = [], hits = new Map();
      const underFire = new Set();
      for (const s of ships) {
        if (!active(s)) continue;
        let replied = false;
        for (const side of [1, -1]) {
          const hit = target(s, side, ships);
          if (!hit) continue;
          replied = true;
          const { t, d } = hit;
          const [kx, ky] = dir(t.heading);
          const along = Math.abs(((t.x - s.x) * kx + (t.y - s.y) * ky) / d);
          const rake = along > Math.cos(C.rakeCone * DEG);
          const dmg = rate[s.side] * C.dt * hitFraction(d) * C.damage * (rake ? C.rakeDamage * C.rakeHit : 1);
          hits.set(t, (hits.get(t) || 0) + dmg);
          s.dealt += dmg;
          if (s.side === 'B') { britishDamage += dmg; if (rake) rakeDamage += dmg; }
          if (s.side === 'E' && rake) t.raked += dmg;
          underFire.add(t);
          fire.push([ships.indexOf(s), ships.indexOf(t), rake ? 1 : 0]);
        }
        if (s.side === 'B' && replied && s.firstReply === null) s.firstReply = time;
        s._replied = replied;
      }
      for (const s of ships) if (s.side === 'B' && underFire.has(s) && !s._replied && s.status !== 'struck') s.silent += C.dt;
      for (const [t, dmg] of hits) {
        t.hull = Math.max(0, t.hull - dmg);
        if (t.hull <= C.strike) t.status = 'struck';
      }
      if (n % C.frameEvery === 0) frames.push(snapshot(time, ships, fire.length ? fire : lastFire));
      lastFire = fire;
      if (n === steps) break;
      // --- move ---
      for (const s of ships) {
        if (s.status === 'struck' || s.status === 'escaped') continue;
        if (s.side === 'B') {
          if (s.status === 'approach') {
            const [hx, hy] = dir(s.heading);
            s.x += hx * vB * C.dt; s.y += hy * vB * C.dt;
            if (s.x >= (p.doctrine === 'cut' ? C.cut : C.hold)) { s.status = 'engaged'; s.heading = 0; }
          } else {
            // lay alongside the nearest Combined ship still in their line
            const side = p.doctrine === 'cut' ? C.cut : C.hold;
            let mate = null, best = Infinity;
            for (const e of ships) {
              if (e.side !== 'E' || e.status !== 'line') continue;
              const d = Math.hypot(e.x + side - s.x, e.y - s.y);
              if (d < best) { best = d; mate = e; }
            }
            const max = (vB + vE) * C.dt;
            const gy = mate ? mate.y + vE * C.dt - s.y : vE * C.dt;
            const gx = mate ? mate.x + side - s.x : 0;
            s.y += Math.max(-max, Math.min(max, gy));
            s.x += Math.max(-max, Math.min(max, gx)) * 0.5;
          }
        } else {
          if (s.status === 'line' && s.hull < C.flee && !blocked(s, ships)) { s.status = 'flee'; s.heading = 90; }
          if (s.status === 'flee') {
            s.x += fleeSpeed(p.wind) * C.dt;
            const near = Math.min(...ships.filter(b => b.side === 'B' && b.status !== 'struck').map(b => Math.hypot(b.x - s.x, b.y - s.y)));
            if (near > C.range) s.status = 'escaped';
          } else s.y += vE * C.dt;
        }
      }
    }
    smoothView(frames);
    const B = ships.filter(s => s.side === 'B'), E = ships.filter(s => s.side === 'E');
    const lead = B[0];
    const summary = {
      leadSilent: lead.silent / 60,
      columnSilent: B.reduce((a, s) => a + s.silent, 0) / B.length / 60,
      leadHull: lead.hull,
      taken: E.filter(s => s.status === 'struck').length,
      escaped: E.filter(s => s.status === 'escaped' || s.status === 'flee').length,
      untouched: E.filter(s => s.hull >= 99.5).length,
      britishLost: B.filter(s => s.status === 'struck').length,
      britishHull: B.reduce((a, s) => a + s.hull, 0) / B.length,
      rakeShare: britishDamage ? rakeDamage / britishDamage : 0,
      firstReply: lead.firstReply === null ? null : lead.firstReply / 60,
    };
    return { params: p, frames, summary, speeds: { british: vB / KNOT, enemy: vE / KNOT } };
  }

  // a camera that follows the fight: centre and span of every ship still on the field, eased
  function smoothView(frames) {
    let v = null;
    for (const f of frames) {
      const pts = f.ships.filter(s => s.status !== 'escaped');
      const xs = pts.map(s => s.x), ys = pts.map(s => s.y);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const want = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, span: Math.max(2600, (x1 - x0) * 1.25, (y1 - y0) * 1.25) };
      if (!v) v = want;
      else for (const k of ['cx', 'cy', 'span']) v[k] += (want[k] - v[k]) * 0.08;
      f.view = { cx: v.cx, cy: v.cy, span: v.span };
    }
  }

  return { C, PRESETS, KNOT, polar, britishSpeed, enemySpeed, hitFraction, simulate };
});
