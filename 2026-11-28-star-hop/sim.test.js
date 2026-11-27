// Run with: node sim.test.js
const assert = require('node:assert');
const P = require('./sim.js');

// Canopus sits about 101° from the Sun in late November 1964 and is the brightest object in the sensor's ring.
assert.ok(Math.abs(P.CONE - 101.1) < 0.3, P.CONE);
const brightest = [...P.RING].sort((a, b) => b.bright - a.bright)[0];
assert.strictEqual(brightest.name, 'Canopus');
assert.ok(P.RING.length >= 8, P.RING.length);
assert.ok(!P.RING.some((s) => s.name === 'Sirius'), 'Sirius is too close to the Sun line for this cone');

// The gate: normal accepts Canopus but not Achernar (0.33×); wide accepts both.
const achernar = P.RING.find((s) => s.name === 'Achernar');
assert.ok(P.accepts(1, 2.5) && !P.accepts(achernar.bright, 2.5));
assert.ok(P.accepts(achernar.bright, 8));
assert.ok(P.accepts(0.07, null) && !P.accepts(0.05, null));

function fly(script, seed) {
  const m = P.createMission({ seed });
  for (const [day, type, value] of script) { P.step(m, day - m.day); P.command(m, type, value); }
  P.step(m, 12);
  return m;
}

// Hands-off with the normal gate: Earth-shine first, then Canopus, then dust keeps breaking the lock.
const handsOff = fly([]);
assert.match(handsOff.log[1].text, /Lock: Earth-shine/);
assert.ok(handsOff.log.some((e) => /Lock: Canopus/.test(e.text)));
assert.ok(handsOff.losses >= 5, handsOff.losses);
assert.strictEqual(handsOff.outcome.ok, false);

// The historical fix: find Canopus with the gate on, then switch the gate off. The burn fires on 4 Dec.
const fixed = fly([[1.5, 'gate', 'off']]);
assert.strictEqual(fixed.outcome.ok, true);
assert.strictEqual(fixed.outcome.slips, 0);
assert.match(P.utc(fixed.outcome.day), /^4 Dec/);

// Gate off from the start: the sensor stays on Earth-shine for days, then settles on a dim star.
const offEarly = fly([[0.01, 'gate', 'off']]);
assert.ok(offEarly.log.some((e) => /Lock lost on Earth-shine/.test(e.text) && e.day > 2.5));
assert.strictEqual(offEarly.outcome.ok, false);

// A wide gate stops on the wrong star after Earth-shine fades.
const wide = fly([[0.01, 'gate', 'wide']]);
assert.ok(wide.log.some((e) => /Lock: (Deneb|Achernar)/.test(e.text)));

// Roll overrides walk round the ring; enough of them reach Canopus even with the gate off.
const m = P.createMission();
P.command(m, 'gate', 'off');
P.step(m, 0.4);
let hops = 0;
while (m.locked !== 'Canopus' && hops < 20) { P.command(m, 'hop'); P.step(m, 0.05); hops++; }
assert.strictEqual(m.locked, 'Canopus');
assert.ok(hops > 3, hops);

// Commands take the uplink delay to land.
const u = P.createMission();
P.command(u, 'gate', 'wide');
P.step(u, P.UPLINK * 0.5);
assert.strictEqual(u.gate, 'normal');
P.step(u, P.UPLINK);
assert.strictEqual(u.gate, 'wide');

// Deterministic: same seed, same mission.
assert.deepStrictEqual(fly([]).log, handsOff.log);
console.log('ok — all star-hop checks passed');
