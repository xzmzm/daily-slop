const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('./core.js');

test('cable physics: 18.5 ms one way, 37 ms round trip at 0.67c', () => {
  assert.equal(T.oneWayMs(), 18.5);
  assert.equal(T.roundTripMs(), 37);
  assert.equal(T.oneWayMs(1850), 9.25);
});

test('51 repeaters tile the crossing exactly', () => {
  assert.equal(T.REPEATERS, 51);
  assert.equal(T.spanKm(), 74);
  assert.equal((T.REPEATERS - 1) * T.spanKm(), T.ROUTE_KM);
});

test('call pairs: 72 real exchanges, exactly the TASI-era speech-circuit count', () => {
  assert.equal(T.CALL_PAIRS.length, 72);
  assert.deepEqual(T.CALL_PAIRS[0], ['New York', 'London']);
  assert.equal(new Set(T.CALL_PAIRS.map((p) => p.join())).size, 72);
});

test('seeded RNG streams are deterministic and per-caller stable', () => {
  const a = T.rng(7), b = T.rng(7), c = T.rng(8);
  const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
});

test('binomial tail: 72 callers at 35% activity rarely exceed 37 circuits', () => {
  const tail = T.binomialTail(72, 37, 0.35);
  assert.ok(tail > 0 && tail < 0.01, String(tail));
  assert.ok(T.binomialTail(72, 37, 0.5) > tail);
  assert.equal(T.binomialTail(72, 72, 0.35), 0);
});

function run(sim, seconds) {
  for (let t = 0; t < seconds; t += 0.05) sim.step(50);
  return sim.stats();
}

test('TASI on: 72 calls ride 37 circuits with barely any clipping', () => {
  const s = run(new T.TasiSim({ conversations: 72, circuits: 37, activity: 0.35, tasi: true, seed: 4 }), 600);
  assert.equal(s.blocked, 0);
  assert.ok(s.active > 15 && s.active < 40, 'mean demand ≈ 25 spurts, got ' + s.active);
  assert.ok(s.clippedPct < 0.02, 'expected < 2% clipped speech, got ' + s.clippedPct);
});

test('rush hour: 24 circuits for 72 callers clips plainly', () => {
  const s = run(new T.TasiSim({ conversations: 72, circuits: 24, activity: 0.35, tasi: true, seed: 4 }), 300);
  assert.ok(s.clippedPct > 0.05, 'expected > 5% clipped speech, got ' + s.clippedPct);
  assert.ok(s.clipCount > 20);
});

test('opening day 1956: 35 calls on 36 circuits, silence holds the line', () => {
  const sim = new T.TasiSim({ conversations: 35, circuits: 36, activity: 0.35, tasi: false, seed: 11 });
  const s = run(sim, 300);
  assert.equal(s.blocked, 0);
  assert.equal(s.clipCount, 0);
  assert.equal(sim.conversations[0].circuit, 0);
  assert.ok(s.occupancy < 0.45, 'idle circuits dominate, occupancy ' + s.occupancy);
});

test('without TASI, calls beyond the circuit count cannot be placed', () => {
  const sim = new T.TasiSim({ conversations: 72, circuits: 37, activity: 0.35, tasi: false, seed: 11 });
  const s = run(sim, 200);
  assert.equal(s.blocked, 35);
  assert.equal(sim.conversations[40].circuit, -1);
  assert.equal(s.clipCount, 0); // blocked is not clipped
});

test('with TASI, silence is the spare pool: 72/37 doubles the gain', () => {
  const sim = new T.TasiSim({ conversations: 72, circuits: 37, activity: 0.35, tasi: true, seed: 11 });
  const s = run(sim, 400);
  assert.ok(Math.abs(s.gain - 72 / 37) < 1e-9);
  assert.ok(s.occupancy > 0.55, 'silence recycled, occupancy ' + s.occupancy);
});

test('circuits are never double-booked and clips only count while unmapped', () => {
  const sim = new T.TasiSim({ conversations: 72, circuits: 10, activity: 0.55, tasi: true, seed: 99 });
  for (let t = 0; t < 200; t += 0.05) {
    sim.step(50);
    const owners = sim.snapshot().circuits.filter((o) => o >= 0);
    assert.equal(new Set(owners).size, owners.length);
    for (const c of sim.conversations) {
      if (c.circuit >= 0) assert.equal(sim.circuits[c.circuit], sim.conversations.indexOf(c));
    }
  }
});

test('simulation is deterministic for the video renderer', () => {
  const a = new T.TasiSim({ conversations: 20, circuits: 12, tasi: true, seed: 5 });
  const b = new T.TasiSim({ conversations: 20, circuits: 12, tasi: true, seed: 5 });
  for (let t = 0; t < 100; t += 0.05) { a.step(50); b.step(50); }
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.deepEqual(a.stats(), b.stats());
});

test('echo gate: the suppressor blocks the reply only while speech is inbound', () => {
  const p = new T.Pulses({ suppressor: true });
  assert.equal(p.canLaunch(-1), true);
  p.shout(1); // New York shouts east
  assert.equal(p.canLaunch(-1), false, 'westbound is gated while eastbound runs');
  for (let i = 0; i < 40; i++) p.step(500, 9000); // crossing takes 9 s
  assert.equal(p.items.length, 0, 'suppressor on: no echo detaches at Oban');
  assert.equal(p.canLaunch(-1), true, 'gate opens once the line falls quiet');

  const open = new T.Pulses({ suppressor: false });
  open.shout(1);
  for (let i = 0; i < 24; i++) open.step(500, 9000); // 12 s: shout landed, echo 3 s into its return
  const echo = open.items.filter((x) => x.kind === 'echo');
  assert.equal(echo.length, 1, 'echo starts back from Scotland');
  assert.equal(echo[0].dir, -1);
  assert.ok(echo[0].pos > 0.5 && echo[0].pos < 1, 'still mid-ocean, got ' + echo[0].pos);
});
