// test_engine.js — assertions for the waggle-room engine.
// Run with:  node test_engine.js
//
// Each test prints a one-line PASS / FAIL. Exit code 1 on any failure.

'use strict';

const E = require('./engine.js');

let npass = 0, nfail = 0;
function ok(name, cond, extra) {
  if (cond) { npass++; console.log('  PASS  ' + name); }
  else { nfail++; console.log('  FAIL  ' + name + (extra ? '   ' + extra : '')); }
}
function near(name, a, b, tol, extra) {
  const d = Math.abs(a - b);
  ok(name + `  (${a.toFixed(4)} vs ${b.toFixed(4)}, Δ=${d.toExponential(2)})`,
     d <= tol, extra);
}
function between(name, v, lo, hi) {
  ok(name + `  (${v.toFixed(4)} ∈ [${lo}, ${hi}])`, v >= lo && v <= hi);
}

// The reference day: 2026-08-15 = day-of-year 227 at 48.2° N (Vienna,
// von Frisch country).  All sun tests use these unless stated.
const LAT = 48.2;
const DOY = 227;
const DECL = E.declination(DOY);

// ── angle wrapping ──────────────────────────────────────────────────────────

ok('wrap360(370) → 10', E.wrap360(370) === 10);
ok('wrap360(-20) → 340', E.wrap360(-20) === 340);
near('wrap360(0..360) identity', E.wrap360(123.4), 123.4, 1e-12);
ok('wrap180(190) → -170', E.wrap180(190) === -170);
ok('wrap180(-190) → 170', E.wrap180(-190) === 170);
ok('wrap180(20) → 20', E.wrap180(20) === 20);
ok('wrap180 lands in (−180,180]', E.wrap180(180) === 180 && E.wrap180(-180) === 180);

// ── solar declination ───────────────────────────────────────────────────────

near('declination at Jun solstice ≈ +23.4°', E.declination(172), 23.4, 0.5);
near('declination at Dec solstice ≈ −23.4°', E.declination(355), -23.4, 0.6);
near('declination at Mar equinox ≈ 0°', Math.abs(E.declination(80)), 0, 3.0);
near('declination on Aug 15 ≈ +13.8°', DECL, 13.8, 0.6);

// ── solar azimuth / altitude ────────────────────────────────────────────────

const noon = E.solarAzimuth(12, LAT, DECL);
near('solar noon azimuth = due south (180°)', noon.azimuth, 180, 0.01);
near('solar noon altitude = 90 − φ + δ', noon.altitude, 90 - LAT + DECL, 0.3);
ok('noon altitude ≈ 55.6° on Aug 15 in Vienna', noon.altitude > 55 && noon.altitude < 56.2);

// monotone sweep across the day: the sun moves clockwise all day
{
  let prev = -1, monotone = true;
  for (let h = 5.5; h <= 18.75; h += 0.25) {
    const az = E.solarAzimuth(h, LAT, DECL).azimuth;
    if (az <= prev) monotone = false;
    prev = az;
  }
  ok('azimuth increases monotonically 05:15→18:45', monotone);
}

// sunrise: where alt = 0; summer sun rises north of east (az < 90)
{
  const len = E.dayLengthHours(LAT, DECL);
  const half = len / 2;                 // hours from noon to sunset
  near('day length ≈ 14.1 h (Vienna, Aug 15)', len, 14.11, 0.05);
  const sunriseH = 12 - half;
  const sunrise = E.solarAzimuth(sunriseH + 0.001, LAT, DECL);
  const sunset = E.solarAzimuth(12 + half - 0.001, LAT, DECL);
  ok('sunrise altitude ≈ 0°', Math.abs(sunrise.altitude) < 0.15);
  ok('sunset altitude ≈ 0°', Math.abs(sunset.altitude) < 0.15);
  ok('summer sunrise north of east (az < 90°)', sunrise.azimuth < 90 && sunrise.azimuth > 45);
  ok('summer sunset north of west (az > 270°)', sunset.azimuth > 270 && sunset.azimuth < 315);
  between('06:00 sun in the east', E.solarAzimuth(6, LAT, DECL).azimuth, 55, 105);
  near('15:00 sun WSW (242.8°, cross-checked via cos A)',
       E.solarAzimuth(15, LAT, DECL).azimuth, 242.78, 0.2);
}
ok('midnight hour angle wraps to −180..180', Math.abs(E.solarAzimuth(0, LAT, DECL).hourAngle - 180) < 1e-9 || E.solarAzimuth(0, LAT, DECL).hourAngle === -180);

// polar guards
ok('polar summer day = 24 h', E.dayLengthHours(80, 20) === 24);
ok('polar winter night = 0 h', E.dayLengthHours(80, -20) === 0);

// ── the encoding rule: θ = az(flower) − az(sun) ─────────────────────────────

near('flower 90° clockwise of sun → +90', E.danceAngleFromVertical(262, 172), 90, 1e-9);
near('flower left of sun → negative angle', E.danceAngleFromVertical(150, 172), -22, 1e-9);
near('across the wrap: sun 350, flower 10 → +20', E.danceAngleFromVertical(10, 350), 20, 1e-9);
near('across the wrap: sun 10, flower 350 → −20', E.danceAngleFromVertical(350, 10), -20, 1e-9);
near('flower at the sun → straight up', E.danceAngleFromVertical(172, 172), 0, 1e-9);
near('antipodal flower → ±180', Math.abs(E.danceAngleFromVertical(352, 172)), 180, 1e-9);
near('flat floor ignores the sun: θ = az(flower)', E.danceAngleFromVertical(317, 172, true), -43, 1e-9);

// the invariance the app is about: fixed flowers, moving sun ⇒ rotating dance
{
  const flowerAz = 240;
  let prev = E.danceAngleFromVertical(flowerAz, E.solarAzimuth(9, LAT, DECL).azimuth);
  let rotated = 0;
  for (let h = 9.25; h <= 17; h += 0.25) {
    const θ = E.danceAngleFromVertical(flowerAz, E.solarAzimuth(h, LAT, DECL).azimuth);
    rotated += θ - prev;              // accumulate signed change (wrap-aware)
    prev = θ;
  }
  // time-compensation invariant: the dance of fixed flowers rotates by
  // exactly −Δaz(sun).  (At 48° N in August the afternoon azimuth sweeps
  // faster than the mean 15°/h — 151° over these 8 h, not 120°.)
  const dSun = E.solarAzimuth(17, LAT, DECL).azimuth - E.solarAzimuth(9, LAT, DECL).azimuth;
  near('8 h of sun motion rotate the dance by −Δaz(sun) = −151°', rotated, -dSun, 1.0);
}

// ── duration ↔ distance (the dialect calibrations) ──────────────────────────

for (const key of Object.keys(E.DIALECTS)) {
  const d = E.DIALECTS[key];
  const t = E.waggleDuration(1500, key);
  near(`${key}: t(1500 m) = a + b·1.5 = ${(d.intercept + d.slope * 1.5).toFixed(2)} s`,
       t, d.intercept + d.slope * 1.5, 1e-12);
  near(`${key}: round-trip 1500 m`, E.distanceFromDuration(t, key), 1500, 1e-9);
  near(`${key}: d(0 m) → intercept`, E.waggleDuration(0, key), d.intercept, 1e-12);
  near(`${key}: d(t = a) → 0 m`, E.distanceFromDuration(d.intercept, key), 0, 1e-12);
  ok(`${key}: threshold ${d.roundThreshold} m round, ${d.roundThreshold + 1} m waggle`,
     E.isRoundDance(d.roundThreshold - 0.5, key) === true &&
     E.isRoundDance(d.roundThreshold + 1, key) === false);
  near(`${key}: waggle count = round(hz·t)`,
       E.waggleCount(t, key), Math.round(d.waggleHz * t), 1e-12);
}
ok('dialects really differ (slopes strictly ordered)',
   E.DIALECTS.carnica.slope < E.DIALECTS.ligustica.slope &&
   E.DIALECTS.ligustica.slope < E.DIALECTS.scutellata.slope);
near('carnica: the classic ≈1 s ≈ 1 km', E.waggleDuration(1000, 'carnica'), 1.10, 0.01);
ok('unknown dialect falls back to carnica', E.dialect('nope').key === 'carnica');

// ── decoding (the follower's job) ───────────────────────────────────────────

{
  const dec = E.decodeDance(63, 1.30, 172, 'carnica');
  near('decode: az = sun + θ', dec.azimuth, 235, 1e-9);
  near('decode: d = 1000·(t − a)/b', dec.distanceM, 1000 * (1.30 - 0.25) / 0.85, 1e-9);
  // full encode→decode round trip across sampled azimuths
  let worst = 0;
  for (let i = 0; i < 24; i++) {
    const az = i * 15 + 7;
    const t = E.waggleDuration(820, 'ligustica');
    const θ = E.danceAngleFromVertical(az, 172);
    const back = E.decodeDance(θ, t, 172, 'ligustica');
    worst = Math.max(worst, E.wrapError(back.azimuth, az));
    if (back.distanceM !== 820) worst = 999;
  }
  ok('encode→decode round trip exact for 24 azimuths', worst < 1e-6, `worst=${worst}`);
  // flat-floor round trip
  const flat = E.decodeDance(E.danceAngleFromVertical(300, 172, true), 1.0, 172, 'carnica', true);
  near('flat floor round trip azimuth', flat.azimuth, 300, 1e-9);
}

// ── jitter & averaging ──────────────────────────────────────────────────────

{
  const rngA = E.makeRNG(20260815);
  const rngB = E.makeRNG(20260815);
  ok('mulberry32 deterministic for same seed', rngA() === rngB() && rngA() === rngB());

  const rng = E.makeRNG(7);
  const runs = [];
  for (let i = 0; i < 200; i++) runs.push(E.jitteredRun(rng, 40, 1.2));
  const maxDev = Math.max(...runs.map(r => Math.abs(E.wrap180(r.angle - 40))));
  ok(`angle jitter stays inside ±3σ (${maxDev.toFixed(1)}° ≤ ${3 * E.ANGLE_SIGMA}°)`,
     maxDev <= 3 * E.ANGLE_SIGMA);
  const meanAngle = E.averageRuns(runs).angle;
  ok(`mean of 200 jittered runs ≈ truth (${meanAngle.toFixed(2)}°)`,
     Math.abs(meanAngle - 40) < 1.5);
  const meanDur = E.averageRuns(runs).duration;
  ok(`mean duration within 5% of truth (${meanDur.toFixed(3)} s)`,
     Math.abs(meanDur - 1.2) / 1.2 < 0.05);

  // averaging beats any single run, on average: variance of the mean shrinks
  const rng2 = E.makeRNG(99);
  let singleErr = 0, avgErr = 0;
  for (let trial = 0; trial < 40; trial++) {
    const batch = [];
    for (let i = 0; i < 8; i++) batch.push(E.jitteredRun(rng2, 0, 1.0));
    singleErr += Math.abs(E.wrap180(batch[0].angle - 0));
    avgErr += Math.abs(E.wrap180(E.averageRuns(batch).angle - 0));
  }
  ok('averaging 8 runs beats a single run (40 trials)',
     avgErr < singleErr, `avg8=${avgErr.toFixed(1)}° vs single=${singleErr.toFixed(1)}°`);

  // circular-mean handles the ±180 seam
  const seam = E.averageRuns([{ angle: 179 }, { angle: -179 }]);
  near('circular mean across the ±180 seam', seam.angle, 180, 0.01);
}

// ── scoring ─────────────────────────────────────────────────────────────────

{
  const target = { azimuth: 235, distanceM: 1000 };
  const perfect = E.scoreGuess(target, { azimuth: 235, distanceM: 1000 });
  ok('perfect guess: grade A, zero error', perfect.grade === 'A' && perfect.angleErr === 0 && perfect.distErr === 0);
  ok('perfect guess: a recruit would find it', perfect.recruitWouldFind);

  const good = E.scoreGuess(target, { azimuth: 245, distanceM: 1150 });
  ok('±10°/+15% → grade A', good.grade === 'A' && good.recruitWouldFind);

  const wrap = E.scoreGuess(target, { azimuth: 233, distanceM: 1050 });
  ok('angular error is wrap-aware (2°)', wrap.angleErr === 2);

  const seamScore = E.scoreGuess({ azimuth: 359, distanceM: 900 }, { azimuth: 1, distanceM: 900 });
  ok('scoring across the 0°/360° seam (2°)', seamScore.angleErr === 2 && seamScore.grade === 'A');

  const off = E.scoreGuess(target, { azimuth: 335, distanceM: 2600 });
  ok('100° off & 2.6× far → grade D', off.grade === 'D' && !off.recruitWouldFind);
  const nextField = E.scoreGuess(target, { azimuth: 250, distanceM: 1700 });
  ok('right direction, 70% too far → grade C', nextField.grade === 'C');
}

// ── game rounds ─────────────────────────────────────────────────────────────

{
  const rng = E.makeRNG(20260815);
  const r1 = E.newGameRound(rng, { sunAzimuth: 172, dialectKey: 'carnica' });
  between('round 1 distance in range', r1.target.distanceM, 140, 2300);
  between('round 1 azimuth in range', r1.target.azimuth, 0, 360);
  near('round 1 dance angle = az − sun', r1.trueAngle,
       E.wrap180(r1.target.azimuth - 172), 1e-12);
  near('round 1 duration from dialect', r1.trueDuration,
       E.waggleDuration(r1.target.distanceM, 'carnica'), 1e-12);

  // determinism: same seed ⇒ same round
  const rng2 = E.makeRNG(20260815);
  const r2 = E.newGameRound(rng2, { sunAzimuth: 172, dialectKey: 'carnica' });
  ok('same seed ⇒ same target', r1.target.azimuth === r2.target.azimuth &&
     r1.target.distanceM === r2.target.distanceM);

  // different seeds ⇒ (almost surely) different targets
  const r3 = E.newGameRound(E.makeRNG(8), { sunAzimuth: 172, dialectKey: 'carnica' });
  ok('different seed ⇒ different target',
     r3.target.azimuth !== r1.target.azimuth || r3.target.distanceM !== r1.target.distanceM);

  // a player who decodes perfectly scores A on any seeded round
  const r4 = E.newGameRound(E.makeRNG(1234), { sunAzimuth: 172, dialectKey: 'ligustica' });
  const guess = E.decodeDance(r4.trueAngle, r4.trueDuration, 172, 'ligustica');
  const s4 = E.scoreGuess(r4.target, guess);
  ok('perfect decode scores grade A on a random round', s4.grade === 'A');
}

// ── canvas geometry ─────────────────────────────────────────────────────────

{
  ok('azFromPx: straight up (dy<0) is north', E.azFromPx(0, -100) === 0);
  ok('azFromPx: +dx is east (90°)', E.azFromPx(100, 0) === 90);
  ok('azFromPx: down is south (180°)', E.azFromPx(0, 100) === 180);
  ok('azFromPx: −dx is west (270°)', E.azFromPx(-100, 0) === 270);
  const p = E.pxFromAz(200, 200, 135, 50);
  near('pxFromAz: SE puts x>cx, y>cy', Math.hypot(p.x - 200, p.y - 200), 50, 1e-9);
  ok('pxFromAz round trip = original azimuth',
     E.azFromPx(p.x - 200, p.y - 200) === 135);
  const u = E.unitVector(90);
  near('unit vector of east', u.x, 1, 1e-12);
  near('unit vector of east, y', u.y, 0, 1e-12);
}

console.log('');
console.log(`${npass} passed, ${nfail} failed`);
process.exit(nfail ? 1 : 0);
