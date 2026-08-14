/*
 * waggle-room — engine
 *
 * The pure mathematics of the honeybee waggle dance. No DOM, no canvas here
 * — so it can be unit-tested (test_engine.js) and reasoned about alone.
 *
 * The whole lesson in two lines
 * ----------------------------
 *   On the vertical comb, inside a dark hive, "up" means "toward the sun":
 *   the waggle run points θ = az(flower) − az(sun) clockwise from vertical.
 *   Its duration is the distance:  t ≈ a + b·d   (the hive's "dialect").
 *
 * Everything else in this file is the machinery around those two lines:
 * a small solar-azimuth model (so a time-of-day slider can move the sun and
 * the dance of a *fixed* flower patch visibly rotates — time-compensation),
 * per-subspecies calibrations (dance dialects), the round-dance threshold
 * for nearby food, deterministic per-run jitter (real runs scatter a few
 * degrees; followers average several runs), and scoring for the recruit
 * game, where you are the follower bee in the dark.
 *
 * Conventions
 * -----------
 *   • Azimuths: degrees clockwise from true north, 0 ≤ az < 360
 *     (the field map is drawn north-up).
 *   • Dance angle: degrees clockwise from straight-up on the vertical comb,
 *     wrapped to (−180, +180].  Positive = tilted right, seen from behind
 *     the comb — von Frisch's rule: right of the sun, right of vertical.
 *   • Distances: metres.  Durations: seconds.
 */

(function (global) {
  "use strict";

  const DEG = 180 / Math.PI;
  const RAD = Math.PI / 180;

  function wrap360(x) {
    return ((x % 360) + 360) % 360;
  }

  function wrap180(x) {
    let w = wrap360(x);
    if (w > 180) w -= 360;
    return w; // (−180, +180]
  }

  // ── deterministic PRNG (mulberry32) — reproducible jitter & game rounds ───

  function makeRNG(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // approximately normal (sum of uniforms), scaled — plenty for ±few° scatter
  function gaussian(rng) {
    return (rng() + rng() + rng() - 1.5) * 1.1547; // mean 0, var ≈ 1
  }

  // ── the sun ───────────────────────────────────────────────────────────────
  //
  // A compact standard model (the same formulas shade-seeker used): declination
  // from day-of-year (Cooper's approximation), then the hour-angle conversion.
  // "Solar time" is used throughout: 12:00 = the moment the sun crosses the
  // meridian (due south for the northern hemisphere mid-August).

  const DEG_PER_HOUR = 15; // the mean solar clock: 360° / 24 h

  function declination(dayOfYear) {
    // Cooper's approximation: 23.44°·sin(360°/365 · (284 + n))
    return 23.44 * Math.sin((360 / 365) * (284 + dayOfYear) * RAD);
  }

  function solarAzimuth(solarHour, latDeg, declDeg) {
    // hour angle: −180° (midnight, ante-meridian) … +180°
    const Hdeg = wrap180(solarHour - 12) * DEG_PER_HOUR;
    const H = Hdeg * RAD;
    const φ = latDeg * RAD;
    const δ = declDeg * RAD;
    // azimuth measured clockwise from north:
    //   az = 180° + atan2(sin H, cos H·sin φ − tan δ·cos φ)
    const y = Math.sin(H);
    const x = Math.cos(H) * Math.sin(φ) - Math.tan(δ) * Math.cos(φ);
    const az = wrap360(180 + Math.atan2(y, x) * DEG);
    const sinAlt =
      Math.sin(φ) * Math.sin(δ) + Math.cos(φ) * Math.cos(δ) * Math.cos(H);
    return { azimuth: az, altitude: Math.asin(sinAlt) * DEG, hourAngle: Hdeg };
  }

  function dayLengthHours(latDeg, declDeg) {
    // length of daylight: 2·H0 / 15° per hour, with the polar guard
    const cosH0 =
      -Math.tan(latDeg * RAD) * Math.tan(declDeg * RAD);
    if (cosH0 <= -1) return 24;
    if (cosH0 >= 1) return 0;
    const H0 = Math.acos(cosH0) * DEG; // sunrise hour angle, degrees
    return (2 * H0) / DEG_PER_HOUR;
  }

  // ── the dance dialects ────────────────────────────────────────────────────
  //
  // t_waggle ≈ intercept + slope · d(km).  Schematic-but-faithful: subspecies
  // really do differ, colonies of the same subspecies drift hive-to-hive, and
  // the calibration is inherited, not learned (see NOTES.md).  Below the
  // round-threshold there is no waggle run at all: the round dance says only
  // "close by, good stuff" — distance yes, direction no.

  const DIALECTS = {
    carnica: {
      key: "carnica",
      label: "Carniolan · A. m. carnica",
      place: "von Frisch's Austria",
      slope: 0.85,        // s per km
      intercept: 0.25,    // s
      roundThreshold: 55, // m — closer than this: round dance
      waggleHz: 13.5,     // lateral waggles per second
    },
    ligustica: {
      key: "ligustica",
      label: "Italian · A. m. ligustica",
      place: "the classic commercial bee",
      slope: 1.15,
      intercept: 0.30,
      roundThreshold: 80,
      waggleHz: 12.0,
    },
    scutellata: {
      key: "scutellata",
      label: "African · A. m. scutellata",
      place: "dances long and hard per km",
      slope: 1.55,
      intercept: 0.35,
      roundThreshold: 100,
      waggleHz: 14.5,
    },
  };

  function dialect(key) {
    return DIALECTS[key] || DIALECTS.carnica;
  }

  // ── encoding: field → dance ───────────────────────────────────────────────

  function danceAngleFromVertical(flowerAzimuth, sunAzimuth, flatFloor) {
    // flatFloor: a horizontal comb under open sky — the bee simply points the
    // true map direction (up = north), no gravity-for-sun transposition.
    return wrap180(flatFloor ? flowerAzimuth : flowerAzimuth - sunAzimuth);
  }

  function waggleDuration(distanceM, dialectKey) {
    const d = dialect(dialectKey);
    return d.intercept + d.slope * (distanceM / 1000);
  }

  function isRoundDance(distanceM, dialectKey) {
    return distanceM < dialect(dialectKey).roundThreshold;
  }

  function waggleCount(durationS, dialectKey) {
    // followers literally count waggles behind the dancer instead of timing her
    return Math.max(1, Math.round(dialect(dialectKey).waggleHz * durationS));
  }

  // ── decoding: dance → field (what a follower bee works out) ───────────────

  function distanceFromDuration(durationS, dialectKey) {
    const d = dialect(dialectKey);
    return Math.max(0, (1000 * (durationS - d.intercept)) / d.slope);
  }

  function decodeDance(angleFromVertical, durationS, sunAzimuth, dialectKey, flatFloor) {
    return {
      azimuth: wrap360(flatFloor ? angleFromVertical : sunAzimuth + angleFromVertical),
      distanceM: distanceFromDuration(durationS, dialectKey),
    };
  }

  // ── per-run jitter: real dancers scatter, followers average ───────────────

  const ANGLE_SIGMA = 4;     // degrees — von Frisch: runs deviate a few degrees
  const DURATION_JITTER = 0.04; // ±4% multiplicative

  function jitteredRun(rng, trueAngle, trueDuration) {
    return {
      angle: wrap180(trueAngle + gaussian(rng) * ANGLE_SIGMA),
      duration: trueDuration * (1 + (rng() * 2 - 1) * DURATION_JITTER),
    };
  }

  function averageRuns(runs) {
    if (!runs.length) return { angle: 0, duration: 0 };
    let sx = 0, sy = 0, t = 0;
    for (const r of runs) {
      sx += Math.sin(r.angle * RAD);
      sy += Math.cos(r.angle * RAD);
      t += r.duration;
    }
    return { angle: wrap180(Math.atan2(sx / runs.length, sy / runs.length) * DEG),
             duration: t / runs.length };
  }

  // ── the recruit game ──────────────────────────────────────────────────────
  //
  // The field is covered (you are inside the dark hive); the comb dances a
  // secret target; you click where you think the flowers are; we score you
  // the way a recruit is measured — angular error, distance error, and
  // whether a real follower bee would have found the patch.

  function wrapError(a, b) {
    return Math.abs(wrap180(a - b));
  }

  function scoreGuess(target, guess) {
    const angleErr = wrapError(guess.azimuth, target.azimuth);
    const distErr = Math.abs(guess.distanceM - target.distanceM);
    const distPct = target.distanceM > 0 ? distErr / target.distanceM : 0;
    // typical recruit performance: within ~15° and ~25% of range (NOTES.md)
    const recruitWouldFind = angleErr <= 15 && distPct <= 0.25;
    let grade;
    if (angleErr <= 10 && distPct <= 0.15) grade = "A";
    else if (angleErr <= 25 && distPct <= 0.35) grade = "B";
    else if (angleErr <= 60 && distPct <= 0.8) grade = "C";
    else grade = "D";
    const verdict = {
      A: "a recruit would find it — and so did you",
      B: "the right meadow, the wrong corner",
      C: "you'd land in the next field over",
      D: "you flew to another village entirely",
    }[grade];
    return { angleErr, distErr, distPct, grade, verdict, recruitWouldFind };
  }

  function newGameRound(rng, opts) {
    const o = Object.assign(
      { minM: 140, maxM: 2300, sunAzimuth: 180, dialectKey: "carnica" },
      opts || {}
    );
    const distanceM = o.minM + rng() * (o.maxM - o.minM);
    const azimuth = rng() * 360;
    const trueAngle = danceAngleFromVertical(azimuth, o.sunAzimuth, false);
    const trueDuration = waggleDuration(distanceM, o.dialectKey);
    return {
      target: { azimuth, distanceM },
      trueAngle,
      trueDuration,
      dialectKey: o.dialectKey,
      sunAzimuth: o.sunAzimuth,
    };
  }

  // ── field-map geometry (canvas pixels ↔ metres, north-up) ─────────────────

  function azFromPx(dx, dy) {
    // dx east, dy south (canvas y grows downward) → clockwise from north
    return wrap360(Math.atan2(dx, -dy) * DEG);
  }

  function unitVector(az) {
    return { x: Math.sin(az * RAD), y: -Math.cos(az * RAD) };
  }

  function pxFromAz(centerX, centerY, az, radius) {
    const u = unitVector(az);
    return { x: centerX + u.x * radius, y: centerY + u.y * radius };
  }

  const API = {
    DEG_PER_HOUR,
    wrap360,
    wrap180,
    makeRNG,
    gaussian,
    declination,
    solarAzimuth,
    dayLengthHours,
    DIALECTS,
    dialect,
    danceAngleFromVertical,
    waggleDuration,
    isRoundDance,
    waggleCount,
    distanceFromDuration,
    decodeDance,
    ANGLE_SIGMA,
    DURATION_JITTER,
    jitteredRun,
    averageRuns,
    wrapError,
    scoreGuess,
    newGameRound,
    azFromPx,
    unitVector,
    pxFromAz,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = API;
  } else {
    global.WaggleEngine = API;
  }
})(typeof window !== "undefined" ? window : globalThis);
