/* Node checks for the orbital core. Run: node test.cjs */
const assert = require("assert");
const ff = require("./core.js");

function approx(actual, expected, eps, label) {
  assert.ok(Math.abs(actual - expected) <= eps, `${label}: ${actual} != ${expected} (±${eps})`);
}

// --- the two speeds that bracket everything, at the 500 km launch circle ---
approx(ff.circularSpeed(ff.R_EARTH + 500e3), 7616.6, 1.0, "circular speed at 500 km");
approx(ff.escapeSpeed(ff.R_EARTH + 500e3), 10771.4, 1.0, "escape speed at 500 km");

// --- Sputnik's near-circular stand-in: 215 x 939 km means 96 min laps ---
approx(ff.satRadius, 6371e3 + 577e3, 1, "mean orbital radius");
const el = ff.elements([ff.satRadius, 0], [0, ff.satSpeed]);
approx(el.period / 60, 96.05, 0.2, "period of the mean circle");
approx(el.e, 0, 1e-12, "circular model has no eccentricity");

// --- shots: monotone downrange, the 7.45-7.5 km/s cliff, then orbits ---
const slow = ff.simulateShot(1000, 500e3);
assert.strictEqual(slow.result, "impact", "1 km/s must fall back");
const mid = ff.simulateShot(6000, 500e3);
const fast = ff.simulateShot(7400, 500e3);
assert.ok(slow.downrangeKm < mid.downrangeKm && mid.downrangeKm < fast.downrangeKm,
  `downrange must grow with speed: ${slow.downrangeKm} < ${mid.downrangeKm} < ${fast.downrangeKm}`);

const cliff = ff.simulateShot(7450, 500e3);
assert.strictEqual(cliff.result, "impact", "7.45 km/s still hits");
approx(cliff.downrangeKm, 15300, 250, "near-threshold impact sweeps far around");

const lowOrbit = ff.simulateShot(7500, 500e3);
assert.strictEqual(lowOrbit.result, "orbit", "7.5 km/s stays up");
approx(lowOrbit.periodMin, 90.3, 0.5, "7.5 km/s period");
approx(lowOrbit.perigeeKm, 95, 6, "7.5 km/s perigee (launch point is apogee)");
approx(lowOrbit.apogeeKm, 500, 2, "launch altitude is the apogee below circular speed");

const circ = ff.simulateShot(7616.6, 500e3);
assert.strictEqual(circ.result, "orbit", "circular speed orbits");
approx(circ.perigeeKm, 500, 3, "circular shot keeps its perigee at launch");
approx(circ.periodMin, 94.4, 0.5, "circular period");

const gone = ff.simulateShot(11000, 500e3);
assert.strictEqual(gone.result, "escape", "11 km/s leaves Earth");
const bound = ff.simulateShot(10500, 500e3);
assert.strictEqual(bound.result, "orbit", "10.5 km/s is still bound");
assert.ok(bound.apogeeKm > 20000, "10.5 km/s should swing far out");

// --- passes: overhead geometry, Doppler swing, grazing behaviour ---
const overhead = ff.samplePass(90, 200);
const elevs = overhead.points.map((p) => p.elevRad * 180 / Math.PI);
approx(Math.max(...elevs), 90, 0.5, "overhead pass peaks at 90");
const dfs = overhead.points.map((p) => p.dopplerHz);
approx(Math.max(...dfs), 463, 12, "approaching Doppler for an overhead pass");
approx(Math.min(...dfs), -463, 12, "receding Doppler for an overhead pass");
assert.ok(overhead.points[0].dopplerHz > 400, "acquisition is strongly blueshifted");
const durMin = (overhead.tset - overhead.taq) / 60;
assert.ok(durMin > 11 && durMin < 14, `overhead pass should last ~12.5 min, got ${durMin}`);
const minRange = Math.min(...overhead.points.map((p) => p.rangeM)) / 1000;
approx(minRange, 577, 12, "closest range equals satellite altitude on an overhead pass");

const graze = ff.samplePass(20, 200);
approx(Math.max(...graze.points.map((p) => p.elevRad * 180 / Math.PI)), 20, 0.6, "grazing pass peak");
assert.ok(Math.max(...graze.points.map((p) => p.dopplerHz)) < Math.max(...dfs),
  "grazing passes swing less than overhead ones");
assert.ok(overhead.tset - overhead.taq > graze.tset - graze.taq,
  "grazing passes are shorter");

// --- the audio model: beat note sits at the IF, drift stays bounded ---
assert.strictEqual(ff.IF_HZ, 940);
for (let t = 0; t < 900; t += 37) {
  assert.ok(Math.abs(ff.driftHz(t)) <= 700, `drift must stay within ±0.7 kHz at t=${t}`);
}

console.log("all falling-forever checks pass");
