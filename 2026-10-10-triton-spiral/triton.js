/* Triton Spiral — tidal-evolution physics.
 * Equilibrium-tide (constant-Q) model after Goldreich & Soter 1966:
 * tides raised on Neptune change the semi-major axis, tides raised inside
 * a synchronous Triton damp the eccentricity. All distances in km, time in
 * years. Usable from the browser (window.Triton) and from node (tests). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Triton = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var G = 6.674e-20;              // km^3 / (kg s^2)
  var M_NEPTUNE = 1.024e26;       // kg
  var R_NEPTUNE = 24622;          // km
  var SPIN_HOURS = 16.11;         // Neptune rotation period
  var M_TRITON = 2.139e22;        // kg
  var R_TRITON = 1353.4;          // km
  var RHO_TRITON = 2.061;         // g/cm^3
  var YEAR = 3.156e7;             // s

  var GM = G * M_NEPTUNE;                                   // km^3/s^2
  var OMEGA_N = 2 * Math.PI / (SPIN_HOURS * 3600);          // rad/s
  var A_SYNC = Math.cbrt(GM / (OMEGA_N * OMEGA_N));         // ~83,500 km
  var RHO_NEPTUNE = M_NEPTUNE * 1e3 /                       // kg -> g
    ((4 / 3) * Math.PI * Math.pow(R_NEPTUNE * 1e5, 3));     // g/cm^3 (~1.64)
  var A_ROCHE = 2.456 * R_NEPTUNE * Math.cbrt(RHO_NEPTUNE / RHO_TRITON);           // ~56,000 km
  var A_NOW = 354759;             // Triton's semi-major axis today
  var E_NOW = 0.000016;
  var SOLAR_AT_NEPTUNE = 1.51;    // W/m^2

  /* Neptune's effective k2/Q is the model's one dial. Published estimates of
   * the time left before Triton meets the Roche limit cluster around 1-4 Gyr
   * (Chyba et al. 1989 and successors); 2.17e-4 lands on 3.6 Gyr (k2 = 0.34,
   * Q ~ 1600). */
  var K2_Q_NEPTUNE = 2.17e-4;
  /* Young Triton with a global ocean is dissipative; 0.05 circularizes the
   * post-capture orbit in ~70 Myr and peaks at ~40x sunlight of tidal heat. */
  var K2_Q_TRITON_CAPTURE = 0.05;

  function meanMotion(a) { return Math.sqrt(GM / (a * a * a)); }
  function periodDays(a) { return (2 * Math.PI / meanMotion(a)) / 86400; }

  /* Tides raised on the planet: km/s. Prograde orbits beyond the synchronous
   * radius are pushed outward (like Earth's Moon); retrograde orbits always
   * decay, because the planet's prograde-spinning bulge pulls the moon
   * against its own motion whichever side it is on. */
  function dadtPlanet(a, e, retro, k2qPlanet) {
    var n = meanMotion(a);
    var dir = (!retro && a > A_SYNC) ? 1 : -1;
    var f = 1 + 3.75 * e * e;      // eccentricity enhancement (orbit-averaged)
    return dir * 1.5 * k2qPlanet * (M_TRITON / M_NEPTUNE) *
      Math.pow(R_NEPTUNE / a, 5) * n * a * f;
  }

  /* Tides raised inside a synchronous satellite damp the eccentricity at
   * de/dt = -D e, with D = (21/2)(k2/Q)(M/m)(R/a)^5 n (Goldreich & Soter).
   * Dissipation in a synchronous satellite carries almost no torque, so the
   * matching da/dt is the one that exactly conserves angular momentum,
   * L ~ sqrt(a(1-e^2)):  da/dt = 2ae/(1-e^2) * de/dt. The pair keeps
   * a(1-e^2) invariant while the orbit circularizes, which is why a capture
   * at (a0, e0) always settles at a0(1-e0^2). */
  function dedtSatellite(a, e, k2qTriton) {
    var n = meanMotion(a);
    return -10.5 * k2qTriton * (M_NEPTUNE / M_TRITON) *
      Math.pow(R_TRITON / a, 5) * n * e;
  }
  function dadtSatellite(a, e, k2qTriton) {
    if (e <= 0) return 0;
    return 2 * a * e / (1 - e * e) * dedtSatellite(a, e, k2qTriton);
  }

  /* Eccentricity enhancement of tidal dissipation, Hut (1981)-style. At low e
   * it is ~1; near e = 0.8 it approaches ~400, reflecting that pericenter
   * passes, not the orbit average, dominate the heating. */
  function eccentricityBoost(e) {
    var num = 1 + 3.75 * e * e + 1.875 * Math.pow(e, 4) + 0.703 * Math.pow(e, 6);
    return num / Math.pow(1 - e * e, 4.5);
  }

  /* Peak tidal dissipation inside Triton, in watts: the orbit-averaged
   * e-damping power scaled by the pericenter enhancement above. */
  function tidalHeatW(a, e, k2qTriton) {
    var G_SI = 6.674e-11;
    var n = meanMotion(a);
    var base = 10.5 * k2qTriton * G_SI * M_NEPTUNE * M_NEPTUNE *
      Math.pow(R_TRITON * 1000, 5) * n * e * e / Math.pow(a * 1000, 6);
    return base * eccentricityBoost(e);
  }
  /* Peak surface heat flux, as a multiple of sunlight at Neptune (30 AU). */
  function tidalFluxRatio(a, e, k2qTriton) {
    var flux = tidalHeatW(a, e, k2qTriton) /
      (4 * Math.PI * Math.pow(R_TRITON * 1000, 2));
    return flux / SOLAR_AT_NEPTUNE;
  }

  /* One adaptive RK2 step, in years. Returns [da, de]. */
  function slopes(a, e, retro, k2qTriton, k2qPlanet) {
    var da = (dadtPlanet(a, e, retro, k2qPlanet) + dadtSatellite(a, e, k2qTriton)) * YEAR;
    var de = dedtSatellite(a, e, k2qTriton) * YEAR;
    return [da, de];
  }
  function stepTimescale(a, e, retro, k2qTriton, k2qPlanet) {
    var s = slopes(a, e, retro, k2qTriton, k2qPlanet);
    var ta = Math.abs(s[0]) > 1e-14 ? Math.abs(a / s[0]) : Infinity;
    var te = (e > 1e-9 && Math.abs(s[1]) > 1e-16) ? Math.abs(e / s[1]) : Infinity;
    return Math.min(ta, te);
  }

  /* Advance (a, e) by dtYears; returns {a, e, shattered}. */
  function advance(a, e, dtYears, retro, k2qTriton, k2qPlanet) {
    e = Math.max(e, 0);
    var left = dtYears, guard = 0;
    while (left > 0 && guard++ < 400000) {
      var tau = Math.max(1, 0.02 * stepTimescale(a, e, retro, k2qTriton, k2qPlanet));
      var dt = Math.min(left, tau);
      var s1 = slopes(a, e, retro, k2qTriton, k2qPlanet);
      var midA = a + 0.5 * dt * s1[0];
      var midE = Math.max(0, e + 0.5 * dt * s1[1]);
      var s2 = slopes(midA, midE, retro, k2qTriton, k2qPlanet);
      a += dt * s2[0];
      e = Math.max(0, e + dt * s2[1]);
      left -= dt;
      if (a * (1 - e) <= A_ROCHE) return { a: Math.min(a, A_ROCHE), e: e, shattered: true };
    }
    return { a: a, e: e, shattered: a * (1 - e) <= A_ROCHE };
  }

  /* Integrate a whole timeline once and sample it for drawing / scrubbing.
   * Points get denser where the orbit changes faster (log-spaced in a and t),
   * so the array stays a few hundred entries even across 5 Gyr. */
  function computeTrack(opts) {
    var o = opts || {};
    var a = o.a0 != null ? o.a0 : A_NOW;
    var e = o.e0 != null ? o.e0 : E_NOW;
    var retro = o.retro !== false;
    var k2qTriton = o.k2qTriton != null ? o.k2qTriton : K2_Q_TRITON_CAPTURE;
    var tMax = o.tMaxYears != null ? o.tMaxYears : 5.2e9;
    var t = 0, shattered = false, guard = 0;
    var points = [{ t: 0, a: a, e: e }];
    var lastPush = { a: a, t: 0 };
    while (t < tMax && !shattered && guard++ < 400000) {
      var tau = Math.max(1, 0.02 * stepTimescale(a, e, retro, k2qTriton, K2_Q_NEPTUNE));
      var dt = Math.min(tau, tMax - t, Math.max(1e3, t * 0.02));
      var out = advance(a, e, dt, retro, k2qTriton, K2_Q_NEPTUNE);
      a = out.a; e = out.e; t += dt;
      if (out.shattered) { shattered = true; t = t; }
      if (shattered || a < lastPush.a * 0.985 || a > lastPush.a * 1.015 || t > lastPush.t * 1.06 + 1e4) {
        points.push({ t: t, a: a, e: e });
        lastPush = { a: a, t: t };
      }
    }
    if (points[points.length - 1].t < t) points.push({ t: t, a: a, e: e });
    return { points: points, doomYears: shattered ? t : null, retro: retro };
  }

  /* Interpolate a track at time t (years). */
  function sampleTrack(track, t) {
    var pts = track.points;
    if (t <= pts[0].t) return pts[0];
    var lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (pts[mid].t <= t) lo = mid; else hi = mid;
    }
    if (t >= pts[hi].t) return pts[hi];
    var span = pts[hi].t - pts[lo].t || 1;
    var u = (t - pts[lo].t) / span;
    return {
      t: t,
      a: pts[lo].a + (pts[hi].a - pts[lo].a) * u,
      e: pts[lo].e + (pts[hi].e - pts[lo].e) * u
    };
  }

  return {
    GM: GM, M_NEPTUNE: M_NEPTUNE, R_NEPTUNE: R_NEPTUNE, M_TRITON: M_TRITON,
    R_TRITON: R_TRITON, SPIN_HOURS: SPIN_HOURS, YEAR: YEAR,
    OMEGA_N: OMEGA_N, A_SYNC: A_SYNC, A_ROCHE: A_ROCHE, A_NOW: A_NOW,
    E_NOW: E_NOW, K2_Q_NEPTUNE: K2_Q_NEPTUNE, K2_Q_TRITON_CAPTURE: K2_Q_TRITON_CAPTURE,
    RHO_NEPTUNE: RHO_NEPTUNE, RHO_TRITON: RHO_TRITON,
    meanMotion: meanMotion, periodDays: periodDays,
    dadtPlanet: dadtPlanet, dadtSatellite: dadtSatellite, dedtSatellite: dedtSatellite,
    tidalHeatW: tidalHeatW, tidalFluxRatio: tidalFluxRatio,
    advance: advance, computeTrack: computeTrack, sampleTrack: sampleTrack
  };
});
