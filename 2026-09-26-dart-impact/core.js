/* DART impact physics — pure functions, no DOM. UMD: node tests + browser. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.dartCore = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  // --- Didymos–Dimorphos system (SI units) ---
  // μ is fixed by the published pre-impact orbit: a = 1.19 km, T = 11.92 h
  // (system mass ≈ 5.4e11 kg). Dimorphos mass assumes ρ ≈ 2400 kg/m³ over
  // D ≈ 160 m, the same density hypothesis used for the published β = 3.61.
  const A0 = 1189;         // m    pre-impact semi-major axis
  const T0 = 11.92 * 3600; // s    pre-impact period (11.92 h)
  const MU = 4 * Math.PI * Math.PI * A0 * A0 * A0 / (T0 * T0);  // ≈ 36.04 m³/s²
  const M_DIM = 4.5e9;     // kg   Dimorphos mass
  const M_DART = 570;      // kg   spacecraft mass at impact
  const V_DART = 6140;     // m/s  impact speed (6.14 km/s)
  const VCIRC = Math.sqrt(MU / A0);  // ≈ 0.174 m/s orbital speed
  const GOAL = 73;         // s    mission success threshold for ΔT
  const DIDYMOS_R = 390;   // m    Didymos mean radius (D ≈ 780 m)
  const DIMORPHOS_R = 80;  // m    Dimorphos mean radius (D ≈ 160 m)

  function impact(beta, thetaDeg) {
    // Total impulse = β × (spacecraft momentum), aimed against Dimorphos's
    // orbital motion. θ is the angle off a perfectly head-on retrograde hit;
    // the off-axis part goes radial and mostly raises e instead of shrinking a.
    const th = (thetaDeg * Math.PI) / 180;
    const J = beta * M_DART * V_DART;          // N·s delivered impulse
    const dvT = (J * Math.cos(th)) / M_DIM;    // retrograde Δv (slows the moonlet)
    const dvR = (J * Math.sin(th)) / M_DIM;    // radial Δv
    // State vectors at the impact point on the circular orbit:
    // r⃗ = (A0, 0), v⃗ = (dvR, VCIRC − dvT). Vis-viva gives the new orbit.
    const vx = dvR;
    const vy = VCIRC - dvT;
    const v2 = vx * vx + vy * vy;
    const a = -MU / (2 * (v2 / 2 - MU / A0));
    const T = 2 * Math.PI * Math.sqrt(a * a * a / MU);
    // Eccentricity vector: ((v²/μ − 1/r) r⃗ − (r⃗·v⃗/μ) v⃗).
    const c2 = (A0 * vx) / MU;
    const ex = (v2 / MU - 1 / A0) * A0 - c2 * vx;
    const ey = -c2 * vy;
    const e = Math.hypot(ex, ey);
    const argp = Math.atan2(ey, ex);           // periapsis direction, math CCW
    return {
      beta, thetaDeg,
      impulse: J,
      spacecraftMomentum: M_DART * V_DART,
      impulseRatio: J / (M_DART * V_DART),
      dvT, dvR, dv: Math.hypot(dvT, dvR),
      a, e, T, argp,
      dT: T - T0,
      rp: a * (1 - e),
      ra: a * (1 + e),
      goalRatio: Math.abs(T - T0) / GOAL,
      periapsisClearsDidymos: a * (1 - e) > DIDYMOS_R + DIMORPHOS_R,
    };
  }

  // Cumulative timing drift of mutual events (hours early) after `days`.
  function driftHours(days, T1) {
    const epochs = (days * 86400) / T1;
    return (epochs * (T0 - T1)) / 3600;
  }

  function solveKepler(M, e) {
    // M normalized to (−π, π]; e is small (<0.15) so Newton converges fast.
    M = Math.atan2(Math.sin(M), Math.cos(M));
    let E = M;
    for (let i = 0; i < 6; i++) {
      E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    }
    return E;
  }

  // Position on the new orbit, physics frame: impact sits at angle 0 with the
  // impact point at radius A0. Returns angle (rad, math CCW) and radius (m).
  function positionAt(result, secondsSinceImpact) {
    const n = (2 * Math.PI) / result.T;
    const f0 = -result.argp;                   // true anomaly at impact
    const E0 = 2 * Math.atan2(
      Math.sqrt(1 - result.e) * Math.sin(f0 / 2),
      Math.sqrt(1 + result.e) * Math.cos(f0 / 2));
    const M0 = E0 - result.e * Math.sin(E0);
    const E = solveKepler(M0 + n * secondsSinceImpact, result.e);
    const f = 2 * Math.atan2(
      Math.sqrt(1 + result.e) * Math.sin(E / 2),
      Math.sqrt(1 - result.e) * Math.cos(E / 2));
    const r = result.a * (1 - result.e * Math.cos(E));
    return { angle: result.argp + f, radius: r, f, f0 };
  }

  function seededRng(seed) {
    // mulberry32 — deterministic ejecta and starfields.
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fmtHours(sec) {  // 42912 s → "11 h 55.2 m"
    const m = sec / 60;
    return Math.floor(m / 60) + ' h ' + (m % 60).toFixed(1) + ' m';
  }

  function fmtClock(sec, plus) {  // 4321 s → "T+ 1:12:01"
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return (plus ? 'T+' : 'T−') + h + ':' + String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  return {
    A0, T0, MU, M_DIM, M_DART, V_DART, VCIRC, GOAL,
    DIDYMOS_R, DIMORPHOS_R,
    impact, driftHours, positionAt, solveKepler, seededRng,
    fmtHours, fmtClock,
  };
});
