/**
 * test_engine.js - Unit tests for Voyager 2 Grand Tour orbital mechanics engine
 */

const assert = require('assert');
const engine = require('./engine.js');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    throw err;
  }
}

console.log('=== Running Voyager 2 Grand Tour Engine Tests ===\n');

test('Physical constants and definitions', () => {
  assert(Math.abs(engine.AU_KM - 149597870.7) < 1.0, 'AU_KM is correct');
  assert(Math.abs(engine.SPEED_OF_LIGHT - 299792.458) < 0.1, 'SPEED_OF_LIGHT is correct');
  assert(engine.MU_SUN > 1.32e11 && engine.MU_SUN < 1.33e11, 'MU_SUN is within standard astronomical bounds');
  assert.strictEqual(engine.PLANETS.EARTH.name, 'Earth');
  assert.strictEqual(engine.PLANETS.JUPITER.name, 'Jupiter');
  assert.strictEqual(engine.PLANETS.SATURN.name, 'Saturn');
  assert.strictEqual(engine.PLANETS.URANUS.name, 'Uranus');
  assert.strictEqual(engine.PLANETS.NEPTUNE.name, 'Neptune');
});

test('Solar escape velocity curve vs distance', () => {
  // v_esc at 1 AU (Earth orbit) should be ~42.12 km/s
  const vEsc1AU = engine.solarEscapeVelocity(1.0 * engine.AU_KM);
  assert(Math.abs(vEsc1AU - 42.12) < 0.5, `v_esc at 1 AU is ~42.12 km/s (got ${vEsc1AU.toFixed(2)})`);

  // v_esc at 5.204 AU (Jupiter orbit) should be ~18.46 km/s
  const vEscJup = engine.solarEscapeVelocity(5.2044 * engine.AU_KM);
  assert(Math.abs(vEscJup - 18.46) < 0.5, `v_esc at Jupiter is ~18.46 km/s (got ${vEscJup.toFixed(2)})`);

  // v_esc at 30.05 AU (Neptune orbit) should be ~7.68 km/s
  const vEscNep = engine.solarEscapeVelocity(30.047 * engine.AU_KM);
  assert(Math.abs(vEscNep - 7.68) < 0.5, `v_esc at Neptune is ~7.68 km/s (got ${vEscNep.toFixed(2)})`);

  // v_esc should strictly decrease with distance
  assert(vEsc1AU > vEscJup && vEscJup > vEscNep, 'v_esc strictly decreases with distance');
});

test('Hyperbolic flyby turning angle & eccentricity', () => {
  const rp = 645000; // 9.2 R_j (Voyager 2 Jupiter closest approach)
  const vInf = 10.82; // km/s
  const muJup = engine.PLANETS.JUPITER.mu;

  const ecc = engine.hyperbolicEccentricity(rp, vInf, muJup);
  assert(ecc > 1.0, `Hyperbolic eccentricity must be > 1 (got ${ecc.toFixed(3)})`);
  assert(ecc > 1.5 && ecc < 1.7, `Jupiter flyby eccentricity should be ~1.59 (got ${ecc.toFixed(3)})`);

  const deltaRad = engine.hyperbolicTurnAngle(rp, vInf, muJup);
  const deltaDeg = (deltaRad * 180) / Math.PI;
  assert(deltaDeg > 70 && deltaDeg < 85, `Turn angle for Voyager 2 Jupiter encounter should be ~77° (got ${deltaDeg.toFixed(1)}°)`);

  // Edge cases
  assert.strictEqual(engine.hyperbolicTurnAngle(0, vInf, muJup), 0, 'Zero periapsis yields 0');
  assert.strictEqual(engine.hyperbolicTurnAngle(rp, 0, muJup), 0, 'Zero v_inf yields 0');
});

test('Gravity assist velocity vector addition and energy exchange', () => {
  const vScIn = { x: 5.0, y: 10.0 };
  const vPlanet = { x: 0.0, y: 13.07 };
  const rp = 645000;
  const muJup = engine.PLANETS.JUPITER.mu;

  // Trailing flyby (aimOffset = +1.0) -> Speeds up spacecraft
  const assistBoost = engine.computeGravityAssist(vScIn, vPlanet, rp, muJup, 1.0);
  assert(assistBoost.vScOut.speed > assistBoost.vScIn.speed, 'Trailing flyby must increase heliocentric speed');
  assert(assistBoost.deltaEnergyKm2S2 > 0, 'Trailing flyby transfers kinetic energy from planet to probe');
  assert(Math.abs(assistBoost.vInfMagKmS - Math.hypot(assistBoost.vInfOut.x, assistBoost.vInfOut.y)) < 1e-6, 
    'Asymptotic speed is conserved in planet-centric frame');

  // Leading flyby (aimOffset = -1.0) -> Slows down spacecraft (gravity brake)
  const assistBrake = engine.computeGravityAssist(vScIn, vPlanet, rp, muJup, -1.0);
  assert(assistBrake.vScOut.speed < assistBrake.vScIn.speed, 'Leading flyby must decrease heliocentric speed');
  assert(assistBrake.deltaEnergyKm2S2 < 0, 'Leading flyby robs kinetic energy from probe');
});

test('RTG radioactive decay and thermocouple degradation', () => {
  // Day 0: 470 W
  const p0 = engine.rtgPowerWatts(0);
  assert.strictEqual(p0, 470.0, 'Day 0 RTG power is 470 W');

  // Day 688 (Jupiter flyby, 1.88 yrs): ~455-465 W
  const pJup = engine.rtgPowerWatts(688);
  assert(pJup > 450 && pJup < 468, `Jupiter flyby RTG power is ~458 W (got ${pJup} W)`);

  // Day 4388 (Neptune flyby, 12 yrs): ~385-405 W
  const pNep = engine.rtgPowerWatts(4388);
  assert(pNep > 385 && pNep < 405, `Neptune flyby RTG power is ~397 W (got ${pNep} W)`);

  // Day 17897 (2026-08-20, 49 yrs): ~220-235 W
  const p2026 = engine.rtgPowerWatts(17897);
  assert(p2026 > 215 && p2026 < 240, `2026 RTG power is ~228 W (got ${p2026} W)`);

  // Monotonic power decrease
  assert(p0 > pJup && pJup > pNep && pNep > p2026, 'RTG power is strictly monotonically decreasing');
});

test('Speed of light travel time', () => {
  // 1 AU distance: ~499 seconds (8.32 minutes)
  const lt1AU = engine.lightTimeInfo(engine.AU_KM);
  assert(Math.abs(lt1AU.oneWaySec - 499.0) < 1.0, `1 AU light time is ~499s (got ${lt1AU.oneWaySec.toFixed(1)}s)`);
  assert(Math.abs(lt1AU.roundTripSec - 998.0) < 2.0, `1 AU round-trip is ~998s`);

  // 138.5 AU distance (August 2026): ~19.2 hours one-way
  const lt2026 = engine.lightTimeInfo(138.5 * engine.AU_KM);
  assert(Math.abs(lt2026.oneWayHours - 19.2) < 0.5, `2026 light time is ~19.2 hours (got ${lt2026.oneWayHours.toFixed(2)}h)`);
  assert(lt2026.oneWayStr.includes('19h'), 'Formatted string includes 19h');
});

test('Trajectory state at key Grand Tour milestones', () => {
  // 1. Launch (Day 0)
  const stLaunch = engine.trajectoryAtDay(0);
  assert.strictEqual(stLaunch.day, 0);
  assert.strictEqual(stLaunch.dateStr, '1977-08-20');
  assert(Math.abs(stLaunch.rAU - 1.0) < 0.05, 'Launch distance is 1.0 AU');
  assert(stLaunch.speedKmS > 35.0, 'Launch injection speed is ~36.4 km/s');

  // 2. Jupiter Flyby (Day 688 closest approach)
  const stJupPre = engine.trajectoryAtDay(680);
  const stJupPost = engine.trajectoryAtDay(700);
  assert(Math.abs(stJupPre.rAU - 5.2) < 0.3, 'Approaching Jupiter at ~5.2 AU');
  assert(stJupPre.speedKmS < stJupPre.vEscKmS, 'Pre-slingshot speed is elliptical (< v_esc)');
  assert(stJupPost.speedKmS > stJupPost.vEscKmS, 'Post-slingshot speed exceeds Solar escape velocity (> v_esc)');
  assert.strictEqual(engine.trajectoryAtDay(688).closePlanet, 'JUPITER');

  // 3. Saturn Flyby (Day 1466)
  const stSatPost = engine.trajectoryAtDay(1480);
  assert(Math.abs(stSatPost.rAU - 9.58) < 0.4, 'Saturn distance is ~9.58 AU');
  assert(stSatPost.speedKmS > stSatPost.vEscKmS, 'Saturn slingshot preserves solar escape capability');
  assert.strictEqual(engine.trajectoryAtDay(1466).closePlanet, 'SATURN');

  // 4. Uranus Closest Approach (Day 3079)
  const stUra = engine.trajectoryAtDay(3079);
  assert(Math.abs(stUra.rAU - 19.2) < 0.3, 'Uranus distance is ~19.2 AU');
  assert.strictEqual(stUra.closePlanet, 'URANUS');

  // 5. Neptune Closest Approach (Day 4388)
  const stNep = engine.trajectoryAtDay(4388);
  assert(Math.abs(stNep.rAU - 30.05) < 0.3, 'Neptune distance is ~30.05 AU');
  assert.strictEqual(stNep.closePlanet, 'NEPTUNE');

  // 6. Heliopause Crossing (Day 15052)
  const stHelio = engine.trajectoryAtDay(15052);
  assert(Math.abs(stHelio.rAU - 119.7) < 3.0, `Heliopause crossing is at ~119.7 AU (got ${stHelio.rAU.toFixed(1)} AU)`);
  assert(stHelio.phaseZh.includes('星际空间'), 'Phase is Interstellar Medium');

  // 7. Today (Day 17897, August 20, 2026)
  const stToday = engine.trajectoryAtDay(17897);
  assert(stToday.rAU > 135.0 && stToday.rAU < 145.0, `Today distance is ~138.5 AU (got ${stToday.rAU.toFixed(1)} AU)`);
  assert(stToday.isEscaping, 'Voyager 2 is escaping the solar system');
  assert(stToday.zAU < -60.0, 'Voyager 2 is travelling south of the ecliptic plane');
});

test('Interactive sandbox simulator outcomes', () => {
  // Low injection delta-v (5.0 km/s) -> Fails to reach Jupiter (needs ~8.8 km/s)
  const resLow = engine.simulateCustomLaunch(5.0, 1.0);
  assert.strictEqual(resLow.success, false);
  assert.strictEqual(resLow.outcome, 'APOAPSIS_SHORT_OF_JUPITER');

  // Optimal injection (9.5 km/s) & trailing flyby -> Grand Tour corridor / Solar escape
  const resOpt = engine.simulateCustomLaunch(9.5, 1.0);
  assert.strictEqual(resOpt.success, true);
  assert(resOpt.outcome === 'GRAND_TOUR_CORRIDOR' || resOpt.outcome === 'SOLAR_SYSTEM_ESCAPE');
  assert(resOpt.vPostJupiterKmS > resOpt.vEscAtJupKmS, 'Post-Jupiter speed exceeds local solar escape velocity');

  // Leading flyby (aimOffset = -1.0) -> Gravity brake
  const resBrake = engine.simulateCustomLaunch(9.5, -1.0);
  assert.strictEqual(resBrake.success, true);
  assert.strictEqual(resBrake.outcome, 'GRAVITY_BRAKE_INNER_SOLAR');
});

test('Trajectory polyline generation', () => {
  const polyline = engine.generateTrajectoryPolyline(300);
  assert.strictEqual(polyline.length, 301);
  assert(polyline[0].rAU <= 1.05, 'First point is at Earth');
  assert(polyline[polyline.length - 1].rAU > 135.0, 'Last point is in deep interstellar space');
  
  // Verify strictly non-decreasing radius over time
  for (let i = 1; i < polyline.length; i++) {
    assert(polyline[i].rAU >= polyline[i - 1].rAU, `Radius must not decrease at index ${i}`);
  }
});

test('Planetary ephemerides and orbital angles', () => {
  // Check Earth at launch
  const earth0 = engine.planetPosition('EARTH', 0);
  assert(Math.abs(earth0.rAU - 1.0) < 1e-4, 'Earth distance is 1.0 AU');
  assert(Math.abs(earth0.speedKmS - 29.78) < 1e-2, 'Earth orbital speed is 29.78 km/s');

  // Check Jupiter at encounter day 688
  const jup688 = engine.planetPosition('JUPITER', 688);
  assert(Math.abs(jup688.rAU - 5.2044) < 1e-4, 'Jupiter orbital radius is 5.2044 AU');
  assert(Math.abs(jup688.speedKmS - 13.07) < 1e-2, 'Jupiter orbital speed is 13.07 km/s');

  // Check Saturn, Uranus, Neptune period formulas
  const saturn = engine.PLANETS.SATURN;
  const uranus = engine.PLANETS.URANUS;
  const neptune = engine.PLANETS.NEPTUNE;
  assert(saturn.periodDays > 10000 && saturn.periodDays < 11000, 'Saturn period is ~29.5 years');
  assert(uranus.periodDays > 30000 && uranus.periodDays < 31000, 'Uranus period is ~84 years');
  assert(neptune.periodDays > 60000 && neptune.periodDays < 61000, 'Neptune period is ~165 years');
});

test('Conservation of asymptotic speed in planet frame', () => {
  const planets = ['JUPITER', 'SATURN', 'URANUS', 'NEPTUNE'];
  for (const pKey of planets) {
    const p = engine.PLANETS[pKey];
    const vScIn = { x: 12.0, y: 18.0 };
    const vP = { x: 0.0, y: p.orbSpeedKmS };
    const assist = engine.computeGravityAssist(vScIn, vP, p.flybyRpKm, p.mu, 1.0);
    
    // Check speed conservation in planet frame |v_inf_out| == |v_inf_in|
    const vInfInNorm = Math.hypot(assist.vInfIn.x, assist.vInfIn.y);
    const vInfOutNorm = Math.hypot(assist.vInfOut.x, assist.vInfOut.y);
    assert(Math.abs(vInfInNorm - vInfOutNorm) < 1e-7, `${p.name} flyby conserves |v_inf|`);
    assert(assist.turnAngleDeg > 0 && assist.turnAngleDeg < 180, `${p.name} turn angle is between 0° and 180°`);
  }
});

console.log(`\n🎉 All ${passedTests}/${totalTests} tests passed successfully!`);
