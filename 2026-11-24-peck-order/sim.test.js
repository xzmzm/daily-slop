// Run with: node sim.test.js
const assert = require('node:assert');
const sim = require('./sim.js');

function run(seed, barkTone, hunter, generations) {
  const rng = sim.makeRng(seed);
  let tones = sim.founders(rng);
  for (let i = 0; i < generations; i += 1) tones = sim.generation(tones, barkTone, hunter, rng);
  return sim.mean(tones);
}

const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
const average = (fn) => sim.mean(seeds.map(fn));

const lichen = average((s) => Math.abs(run(s, sim.BARK.lichen, 'sharp', 12) - sim.BARK.lichen));
const soot = average((s) => Math.abs(run(s, sim.BARK.soot, 'sharp', 12) - sim.BARK.soot));
const blind = average((s) => Math.abs(run(s, sim.BARK.lichen, 'blind', 12) - sim.BARK.lichen));

assert(lichen < 0.08, `sharp bird should match lichen, gap ${lichen}`);
assert(soot < 0.08, `sharp bird should match soot, gap ${soot}`);
assert(blind > 0.2, `blind bird should not track bark, gap ${blind}`);

// A flock adapted to lichen must keep enough variation to follow the bark to soot.
const recovered = average((s) => {
  const r = sim.makeRng(s);
  let flock = sim.founders(r);
  for (let i = 0; i < 11; i += 1) flock = sim.generation(flock, sim.BARK.lichen, 'sharp', r);
  for (let i = 0; i < 20; i += 1) flock = sim.generation(flock, sim.BARK.soot, 'sharp', r);
  return Math.abs(sim.mean(flock) - sim.BARK.soot);
});
assert(recovered < 0.08, `flock should recover after the bark flips, gap ${recovered}`);

const rng = sim.makeRng(7);
const tones = sim.founders(rng);
assert.strictEqual(tones.length, sim.FLOCK);
const next = sim.generation(tones, sim.BARK.soot, 'sharp', rng);
assert.strictEqual(next.length, sim.FLOCK);
assert(next.every((tone) => tone >= 0 && tone <= 1));
assert.deepStrictEqual(sim.founders(sim.makeRng(3)), sim.founders(sim.makeRng(3)));

console.log(`ok: mean gap after 12 generations: lichen ${lichen.toFixed(3)}, soot ${soot.toFixed(3)}, blind ${blind.toFixed(3)}; after bark flip +20: ${recovered.toFixed(3)}`);
