const assert = require('assert');
const model = require('./model.js');

console.log('Testing Sound Ranging model...');

// Test 1: Sound speed formula
{
  const c0 = model.soundSpeed(0);
  assert(Math.abs(c0 - 331.3) < 0.1, `Speed at 0C should be ~331.3, got ${c0}`);
  const c15 = model.soundSpeed(15);
  assert(Math.abs(c15 - 340.3) < 0.5, `Speed at 15C should be ~340.3, got ${c15}`);
  const cMinus10 = model.soundSpeed(-10);
  assert(cMinus10 < c0, 'Speed at -10C should be lower than 0C');
  console.log('  ✓ Sound speed tests passed');
}

// Test 2: Ray travel time with and without wind
{
  const src = { x: 0, y: 1000 };
  const mic = { x: 0, y: 0 };
  const tStill = model.rayTravelTime(src, mic, 0, 0, 0);
  assert(Math.abs(tStill - 1000 / 331.3) < 1e-4, 'Travel time in still air should match d / c');

  // Wind blowing towards mic (tail wind for sound ray)
  // Distance is 1000m along -y direction (src.y = 1000, mic.y = 0)
  // Wind with wy = -20 (blowing from src to mic)
  const tTail = model.rayTravelTime(src, mic, 0, 0, -20);
  assert(tTail < tStill, `Tailwind travel time ${tTail} should be less than still air ${tStill}`);

  // Headwind
  const tHead = model.rayTravelTime(src, mic, 0, 0, 20);
  assert(tHead > tStill, `Headwind travel time ${tHead} should be greater than still air ${tStill}`);
  console.log('  ✓ Ray travel time with wind vector passed');
}

// Test 3: Arrival times and Hyperbolas
{
  const p = model.PRESETS.standard;
  const times = model.computeArrivalTimes(p.battery, p.mics, p.tempC, p.windSpeed, p.windDirDeg);
  assert.strictEqual(times.length, p.mics.length);
  for (let i = 0; i < times.length - 1; i++) {
    const deltaT = times[i + 1] - times[i];
    const hyp = model.sampleHyperbola(p.mics[i], p.mics[i + 1], deltaT, model.soundSpeed(p.tempC));
    assert(hyp !== null, `Hyperbola between M${i+1} and M${i+2} should exist`);
    assert(hyp.points.length > 50, 'Hyperbola should contain sampled points');
    // All sampled y points should advance forward
    assert(hyp.points[hyp.points.length - 1].y > 2000, 'Hyperbola should extend forward');
  }
  console.log('  ✓ Hyperbola sampling passed');
}

// Test 4: TDOA solver convergence with and without correction
{
  const p = model.PRESETS.standard;
  const rad = (p.windDirDeg * Math.PI) / 180;
  const wx = p.windSpeed * Math.cos(rad);
  const wy = p.windSpeed * Math.sin(rad);
  const cTrue = model.soundSpeed(p.tempC);
  const times = model.computeArrivalTimes(p.battery, p.mics, p.tempC, p.windSpeed, p.windDirDeg);

  // Solved with atmospheric correction
  const resCorr = model.solveTDOA(p.mics, times, cTrue, wx, wy);
  assert(resCorr.success, 'Corrected solver should succeed');
  const errorCorr = Math.hypot(resCorr.x - p.battery.x, resCorr.y - p.battery.y);
  assert(errorCorr < 0.1, `Corrected solver error should be < 0.1m, got ${errorCorr}`);

  // Solved without atmospheric correction (assuming 0°C still air)
  const resUncorr = model.solveTDOA(p.mics, times, 331.3, 0, 0);
  assert(resUncorr.success, 'Uncorrected solver should succeed');
  const errorUncorr = Math.hypot(resUncorr.x - p.battery.x, resUncorr.y - p.battery.y);
  assert(errorUncorr > 5.0, `Uncorrected solver should have noticeable error (>5m), got ${errorUncorr}`);
  console.log(`  ✓ Solver accuracy: corrected error = ${errorCorr.toFixed(3)}m, uncorrected error = ${errorUncorr.toFixed(1)}m`);
}

// Test 5: Arras crosswind preset error magnitude
{
  const p = model.PRESETS.crosswind;
  const rad = (p.windDirDeg * Math.PI) / 180;
  const wx = p.windSpeed * Math.cos(rad);
  const wy = p.windSpeed * Math.sin(rad);
  const cTrue = model.soundSpeed(p.tempC);
  const times = model.computeArrivalTimes(p.battery, p.mics, p.tempC, p.windSpeed, p.windDirDeg);

  // Uncorrected has huge drift due to 14 m/s gale
  const uncorr = model.solveTDOA(p.mics, times, 337.0, 0, 0);
  const corr = model.solveTDOA(p.mics, times, cTrue, wx, wy);
  const uncorrErr = Math.hypot(uncorr.x - p.battery.x, uncorr.y - p.battery.y);
  const corrErr = Math.hypot(corr.x - p.battery.x, corr.y - p.battery.y);

  assert(uncorrErr > 100, `Crosswind uncorrected drift should be > 100m, got ${uncorrErr}`);
  assert(corrErr < 0.2, `Crosswind corrected drift should be < 0.2m, got ${corrErr}`);
  console.log(`  ✓ Crosswind drift verification: uncorrected = ${uncorrErr.toFixed(1)}m, corrected = ${corrErr.toFixed(2)}m`);
}

console.log('All model tests passed successfully!');
