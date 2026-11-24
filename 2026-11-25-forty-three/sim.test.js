// Run with: node sim.test.js
const assert = require('node:assert');
const P = require('./sim.js');

// General relativity gives the textbook 42.98" per century.
assert.ok(Math.abs(P.grAdvance() - 42.98) < 0.02, P.grAdvance());

// The first-order secular formula lands within 8% of Clemence for the big three.
for (const [id, mass, dist] of [['venus', 2.4478e-6, 0.723332], ['jupiter', 9.5479e-4, 5.2026], ['earth', 3.0404e-6, 1.0]]) {
  const clemence = P.SOURCES.find((s) => s.id === id).value;
  const ours = P.secularAdvance(mass, dist);
  assert.ok(Math.abs(ours / clemence - 1) < 0.08, `${id}: ${ours} vs ${clemence}`);
}

// Newton alone leaves about 43"; GR closes it within the observational error; the 1913 theory doesn't.
const newton = P.budget({}, 0);
assert.ok(Math.abs(newton.gap - 42.57) < 0.01, newton.gap);
assert.ok(Math.abs(P.budget({}, P.grAdvance()).gap) <= P.OBSERVED_ERR);
assert.ok(P.budget({}, P.ENTWURF).gap > 20);

// A Vulcan can always be tuned to close the gap, and a closer one must be heavier.
const at02 = P.vulcanMassFor(newton.gap, 0.2);
assert.ok(Math.abs(P.vulcanAdvance(at02, 0.2) - newton.gap) < 1e-9);
assert.ok(P.vulcanMassFor(newton.gap, 0.1) > at02);

console.log('ok');
