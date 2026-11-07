const assert = require('node:assert/strict');
const m = require('./model.js');
const near = (a, b, t = 1e-9) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);

// --- atmosphere and geometry ---
near(m.airDensity(0), 1.225);
near(m.airDensity(7200), 1.225 / Math.E, 1e-12);
for (let h = 0; h < 150000; h += 5000) assert.ok(m.airDensity(h + 5000) < m.airDensity(h));
// A/m: a 1 kg stone has radius 4.17 cm and area 54.6 cm^2 per kg.
near(m.radius(1, 3300), 0.04172, 1e-4);
near(m.strengthAt(1, 'stony'), 1.5e7 * (1 / m.radius(1, 3300)) ** 0.25, 1);
assert.ok(m.strengthAt(1.3e7, 'stony') < m.strengthAt(1, 'stony') / 3, '20 m bodies must be far weaker than 1 m bodies (Weibull)');
near(m.dynamicPressure(1.225, 1000), 1.225e6);
// Magnitude 0 for the zero-magnitude irradiance seen from 100 km.
const zeroStarW = 2.54e-8 * 4 * Math.PI * 1e5 ** 2;
near(m.magnitude(zeroStarW), 0, 1e-9);
assert.equal(m.magnitude(0), 12);
assert.equal(m.magnitude(-5), 12);
near(m.tntKt(4.184e12), 1);
near(m.tntKt(4.184e15), 1000);
assert.equal(m.formatTnt(4.184e15), '1000 kt');
assert.equal(m.formatTnt(4.184e12), '1 kt');
assert.equal(m.formatTnt(1.05e11), '25 t');
assert.equal(m.formatMass(504.4), '504 kg');
assert.equal(m.formatMass(1.3e7), '13 kt');
assert.equal(m.formatMass(0.5), '500 g');

// --- the four presets must tell the right story ---
const taurid = m.simulate({material: 'dust', massKg: 100, speedKms: 29, angleDeg: 30});
assert.equal(taurid.outcome, 'shattered');
assert.ok(taurid.burst.h > 70e3 && taurid.burst.h < 85e3, `taurid burst ${taurid.burst.h}`);
assert.ok(taurid.peakMagnitude < -5 && taurid.peakMagnitude > -12);
assert.ok(taurid.burst.energyJ > 2e10 && taurid.burst.energyJ < 8e10);

const ensisheim = m.simulate({material: 'stony', massKg: 600, speedKms: 14, angleDeg: 62});
assert.equal(ensisheim.outcome, 'landed');
assert.ok(ensisheim.impact.m > 300 && ensisheim.impact.m < 600, `landed mass ${ensisheim.impact.m}`);
assert.ok(ensisheim.impact.v < 250, 'a survivor lands near terminal velocity');
assert.ok(ensisheim.impact.x > 30e3 &&ensisheim.impact.x < 80e3);
assert.ok(ensisheim.peakPressure > 5e6 && ensisheim.peakPressure < 15e6, 'rides several MPa without breaking');
assert.ok(ensisheim.peakMagnitude < -5);

const chelyabinsk = m.simulate({material: 'stony', massKg: 1.3e7, speedKms: 19, angleDeg: 18});
assert.equal(chelyabinsk.outcome, 'shattered');
assert.ok(chelyabinsk.burst.h > 22e3 && chelyabinsk.burst.h < 36e3, `chelyabinsk burst ${chelyabinsk.burst.h}`);
const kt = m.tntKt(chelyabinsk.burst.energyJ);
assert.ok(kt > 350 && kt < 800, `chelyabinsk energy ${kt} kt`);
assert.ok(chelyabinsk.peakMagnitude < -14);

const iron = m.simulate({material: 'iron', massKg: 500, speedKms: 20, angleDeg: 35});
assert.equal(iron.outcome, 'landed');
assert.ok(iron.impact.m > 200, 'iron mostly survives ablation');
assert.ok(iron.impact.v < 400, 'iron lands near terminal velocity');
assert.ok(iron.peakPressure > 1e7, 'iron rides pressures that would shatter stone');

// --- physical invariants across a sweep of entries ---
for (const material of ['dust', 'stony', 'iron']) {
  for (const speedKms of [11.5, 25, 60]) {
    for (const angleDeg of [8, 30, 70]) {
      for (const massKg of [1, 500, 5e5, 5e7]) {
        const r = m.simulate({material, massKg, speedKms, angleDeg});
        assert.ok(['landed', 'shattered', 'burned'].includes(r.outcome), r.outcome);
        let previousT = -1, previousH = Infinity, previousX = -1, previousV = Infinity;
        for (const s of r.samples) {
          assert.ok(s.t >= previousT, 'time must move forward');
          assert.ok(s.h <= previousH + 1e-6 && s.h >= 0, 'altitude falls monotonically');
          assert.ok(s.x >= previousX - 1e-6, 'downrange grows');
          assert.ok(s.v <= previousV + 1e-6 && s.v >= 0, 'speed never rises');
          assert.ok(s.mag >= -30 && s.mag <= 12);
          previousT = s.t; previousH = s.h; previousX = s.x; previousV = s.v;
        }
        const last = r.samples[r.samples.length - 1];
        if (r.outcome === 'landed') {
          assert.ok(r.impact && last.h === 0, 'a landing must reach the ground in the samples');
          assert.ok(r.impact.m > 0 && r.impact.x > 0);
        }
        if (r.outcome === 'shattered') {
          assert.ok(r.burst && r.burst.energyJ > 0 && r.burst.q > 0);
          const flare = r.samples.slice(r.samples.indexOf(r.samples.find(s => s.t >= r.burst.t)) + 1);
          assert.ok(flare.some(s => s.L > r.samples.find(s2 => s2.t >= r.burst.t).L), 'the burst must flare brighter');
        }
        // Determinism: identical inputs give byte-identical trajectories.
        const again = m.simulate({material, massKg, speedKms, angleDeg});
        assert.deepEqual(again.samples, r.samples);
      }
    }
  }
}

// --- shallow, fast dust grazes: burns rather than bursts high is fine, but must end ---
const graze = m.simulate({material: 'dust', massKg: 2, speedKms: 64, angleDeg: 7});
assert.ok(['shattered', 'burned'].includes(graze.outcome));
assert.ok(graze.samples.every(s => s.h > 0), 'a grazing dust grain never reaches the ground');

// --- invalid inputs ---
for (const bad of [
  {material: 'wood', massKg: 1, speedKms: 20, angleDeg: 45},
  {material: 'stony', massKg: 0, speedKms: 20, angleDeg: 45},
  {material: 'stony', massKg: NaN, speedKms: 20, angleDeg: 45},
  {material: 'stony', massKg: 1e15, speedKms: 20, angleDeg: 45},
  {material: 'stony', massKg: 100, speedKms: 0.5, angleDeg: 45},
  {material: 'stony', massKg: 100, speedKms: 20, angleDeg: 0},
  {material: 'stony', massKg: 100, speedKms: 20, angleDeg: 91},
  {material: 'stony', massKg: 100, speedKms: Infinity, angleDeg: 45},
  null,
]) assert.throws(() => m.simulate(bad), RangeError);
assert.equal(m.magnitude(Infinity), 12); // non-finite luminosity clamps to invisible
assert.equal(m.magnitude(NaN), 12);
console.log('PASS: atmosphere, radii, Weibull strength scaling, magnitude scale, TNT formatting, four preset stories, monotone trajectories, determinism across 36 entries, invalid inputs.');
