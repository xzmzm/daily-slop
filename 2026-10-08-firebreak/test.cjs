/* Independent spec checks. Run: node --test test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./core.js');

function run(sim, minutes, stepCap = 4000) {
  let left = minutes;
  while (left > 0 && sim.state().phase === 'burning') {
    sim.tick(Math.min(60, left) / C.TPS);   // chunked like a real frame loop
    left -= 60;
  }
  return sim.state();
}

test('city geography: fuel exists, rivers carve, origin is the barn', () => {
  for (const seed of [1, 7, 99]) {
    const city = C.makeCity(seed);
    assert.ok(city.fuel > 900 && city.fuel < 2200, `fuel ${city.fuel}`);
    let water = 0;
    for (const t of city.cells) if (t === C.WATER) water++;
    assert.ok(water > 150, `water ${water}`);
    const at = (x, y) => city.cells[y * C.GRID_W + x];
    assert.equal(at(C.ORIGIN.x, C.ORIGIN.y), C.WOOD);
    assert.ok(C.onWater(60, 20));                    // in the lake
    assert.ok(C.onWater(43, 15));                    // main stem
    assert.ok(!C.onWater(40, 10));                   // the Loop is dry
  }
});

test('ember profile: reach and river-crossing grow with wind', () => {
  const calm = C.emberProfile(5), gale = C.emberProfile(32), storm = C.emberProfile(50);
  assert.ok(gale.sigma > calm.sigma);
  assert.ok(storm.sigma > gale.sigma);
  assert.ok(gale.crossP > calm.crossP);
  assert.ok(storm.crossP > gale.crossP);
  assert.ok(gale.crossP > 0.3 && gale.crossP < 1);
  for (const p of [calm, gale, storm]) {
    assert.equal(p.bars.length, 12);
    assert.ok(Math.max(...p.bars) > 0.99 && Math.max(...p.bars) <= 1.0001);
    assert.ok(p.mean > 0);
  }
});

test('wind leans the fire hard: gale front outruns the calm burn', () => {
  const gale = C.createSim({ seed: 7, windSpeed: 40, emberScale: 0 });
  gale.ignite();
  const g = run(gale, 420);
  const calm = C.createSim({ seed: 7, windSpeed: 0, emberScale: 0 });
  calm.ignite();
  const c = run(calm, 420);
  assert.ok(g.percent > c.percent * 1.5, `gale ${g.percent} vs calm ${c.percent}`);
  // and the gale burn is displaced downwind of the barn
  const cx = (i) => i % C.GRID_W;
  let mx = 0, n = 0;
  const view = gale.view();
  for (let i = 0; i < view.cells.length; i++) {
    if (view.cells[i] === C.CINDER || view.fire[i] > 0) { mx += cx(i); n++; }
  }
  mx /= n;
  assert.ok(mx > C.ORIGIN.x + 4, `centroid x ${mx.toFixed(1)} vs origin ${C.ORIGIN.x}`);
});

test('without embers, water is a wall: destroyed cells stay connected', () => {
  const sim = C.createSim({ seed: 7, windSpeed: 32, emberScale: 0 });
  sim.ignite();
  run(sim, 500);
  const view = sim.view();
  const destroyed = new Set();
  for (let i = 0; i < view.cells.length; i++) {
    if (view.cells[i] === C.CINDER || view.fire[i] > 0) destroyed.add(i);
  }
  assert.ok(destroyed.size > 50);
  // the spread kernel reaches ≤2 cells away: flood over exactly that graph
  const seen = new Set([C.ORIGIN.y * C.GRID_W + C.ORIGIN.x]);
  const stack = [...seen];
  while (stack.length) {
    const i = stack.pop(), x = i % C.GRID_W, y = (i / C.GRID_W) | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= C.GRID_W || ny >= C.GRID_H) continue;
      const n = ny * C.GRID_W + nx;
      if (!seen.has(n) && destroyed.has(n)) { seen.add(n); stack.push(n); }
    }
  }
  assert.equal(seen.size, destroyed.size, 'emberless fire jumped water');
});

test('with embers, the river crossing is spot fires', () => {
  const sim = C.createSim({ seed: 7, windSpeed: 34 });
  sim.ignite();
  const s = run(sim, 900);
  assert.ok(s.spotFires > 3, `spot fires ${s.spotFires}`);
  assert.ok(s.percent > 0.02, `percent ${s.percent}`);
});

test('a blast ring holds an emberless fire — unless a blast backfires', () => {
  const R = 6, o = C.ORIGIN;
  const ring = (sim) => {
    let backfires = 0;
    for (let a = 0; a < 360; a += 12) {   // 30 charges — the whole powder budget
      if (sim.blast(o.x + Math.cos(a * Math.PI / 180) * R, o.y + Math.sin(a * Math.PI / 180) * R).backfire) backfires++;
    }
    return backfires;
  };
  const outsideCount = (sim) => {
    const view = sim.view();
    let outside = 0;
    for (let i = 0; i < view.cells.length; i++) {
      if (view.cells[i] === C.CINDER || view.fire[i] > 0) {
        const x = i % C.GRID_W, y = (i / C.GRID_W) | 0;
        if (Math.hypot(x - o.x, y - o.y) > R + 3.5) outside++;
      }
    }
    return outside;
  };
  // find a calm seed whose ring goes up without a single backfire
  let clean = null;
  for (let seed = 1; seed < 40 && clean === null; seed++) {
    const sim = C.createSim({ seed, windSpeed: 0, emberScale: 0 });
    if (ring(sim) === 0) clean = sim;
  }
  assert.ok(clean, 'no backfire-free ring in 40 seeds');
  clean.ignite();
  run(clean, 700);
  assert.equal(outsideCount(clean), 0, 'emberless fire escaped an intact ring');

  // and in a gale, embers (or the ring crew's own bad luck) break out
  const storm = C.createSim({ seed: 3, windSpeed: 40 });
  storm.ignite();
  ring(storm);
  const s = run(storm, 400);
  assert.ok(s.spotFires > 0, 'gale embers never cleared the ring');
});

test('blasts cost powder, clear buildings, and gamble on backfires', () => {
  const sim = C.createSim({ seed: 7 });
  const countFuel = () => sim.view().cells.filter((t) => t === C.WOOD || t === C.BRICK).length;
  const before = countFuel();
  const r = sim.blast(40, 10);                        // into the built-up Loop
  assert.equal(r.ok, true);
  assert.ok(r.cleared > 2, `cleared ${r.cleared}`);
  assert.equal(sim.state().blasts, 1);
  assert.equal(sim.state().blastsLeft, C.MAX_BLASTS - 1);
  const buildingsLost = before - countFuel();         // streets are cleared too, but
  assert.equal(buildingsLost, sim.state().blasted);   // only buildings are "blasted"
  assert.ok(r.cleared >= buildingsLost);
  assert.equal(sim.blast(60, 20).cleared, 0);         // the lake: wasted charge
  // over many gale blasts, the gunpowder itself starts fires
  sim.set({ windSpeed: 45 });
  const baseBackfires = sim.state().backfires;
  let backfires = 0, used = 2;
  for (let k = 0; used < C.MAX_BLASTS; k++, used++) {
    if (sim.blast(12 + (k % 20), 22).backfire) backfires++;
  }
  assert.ok(backfires > 0, `no backfires in ${used} gale blasts`);
  assert.equal(sim.state().backfires - baseBackfires, backfires);
  assert.equal(sim.blast(40, 10).ok, false);          // powder keg is empty
  assert.equal(sim.blast(40, 10).reason, 'powder');
});

test('rain ends the night and freezes the books', () => {
  const sim = C.createSim({ seed: 7, windSpeed: 30 });
  sim.ignite();
  run(sim, 90);
  assert.ok(sim.state().phase === 'burning');
  sim.set({ speed: 3 });
  assert.equal(sim.rainNow(), true);
  const s = sim.state();
  assert.equal(s.phase, 'ended');
  assert.equal(s.rained, true);
  sim.tick(5);
  assert.equal(sim.state().destroyed, s.destroyed);
  assert.equal(sim.rainNow(), false);                 // once is enough
});

test('the night always ends — by rain at 27 hours, or by running out of city', () => {
  const sim = C.createSim({ seed: 7, windSpeed: 45 });
  sim.ignite();
  let s = sim.state();
  let guard = 0;
  while (s.phase === 'burning' && guard++ < 20000) { sim.tick(5); s = sim.state(); }
  assert.equal(s.phase, 'ended');
  if (s.rained) assert.ok(s.clockMin >= C.RAIN_MIN, s.clockMin);
  else assert.ok(s.clockMin < C.RAIN_MIN, `burnout at ${s.clockMin} should precede the rain`);
  assert.equal(C.clockLabel(C.START_MIN), 'SUN 09:00 PM');
  assert.equal(C.clockLabel(C.RAIN_MIN), 'MON 11:30 PM');
});

test('determinism: same seed and ops, same night', () => {
  const ops = (sim) => {
    sim.ignite(); sim.blast(20, 26); sim.blast(24, 20);
    run(sim, 300);
    return sim.state();
  };
  const a = ops(C.createSim({ seed: 7 }));
  const b = ops(C.createSim({ seed: 7 }));
  assert.deepEqual(a, b);
  assert.notEqual(ops(C.createSim({ seed: 8 })).destroyed, a.destroyed);
});

test('clock label renders the 1871 timeline', () => {
  assert.equal(C.clockLabel(C.START_MIN + 60), 'SUN 10:00 PM');
  assert.equal(C.clockLabel(C.START_MIN + 180), 'MON 12:00 AM');
  assert.equal(C.clockLabel(C.START_MIN + 1440 + 3 * 60), 'TUE 12:00 AM');
});
