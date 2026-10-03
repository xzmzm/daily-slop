/* Pure orbital mechanics for Newton's cannonball and Sputnik 1's pass.
   No DOM access here: the app and the node tests both import this file.

   Everything follows from one law: a = -mu * r_vec / |r|^3.  The cannon
   bench integrates it directly; the pass bench uses closed-form geometry
   of a circular orbit over a surface observer. */

(function (global) {
  "use strict";

  const MU = 3.986004418e14;        // GM Earth, m^3/s^2
  const R_EARTH = 6371000;          // mean radius, m
  const LIGHT = 2.99792458e8;       // m/s

  // Newton never said how tall his mountain was; 500 km makes the bench
  // readable (curvature visible, circular speed a round 7.61 km/s).
  const MOUNTAIN_H = 500e3;

  // Sputnik 1, 4 October 1957: 215 x 939 km, period 96.2 min.
  const SPUTNIK = {
    perigeeH: 215e3,
    apogeeH: 939e3,
    f0: 20.005e6,                   // the famous carrier, Hz
    transmitterW: 1,                // one watt
    beepSec: 0.3,                   // ~0.3 s beep; the pause grew with temperature
    silentDays: 22,                 // transmitters fell silent 26 October 1957
  };

  const circularSpeed = (r) => Math.sqrt(MU / r);
  const escapeSpeed = (r) => Math.sqrt((2 * MU) / r);

  // Keplerian elements from a state vector (2D arrays [x, y]).
  function elements(pos, vel) {
    const r = Math.hypot(pos[0], pos[1]);
    const v2 = vel[0] * vel[0] + vel[1] * vel[1];
    const energy = v2 / 2 - MU / r;             // specific orbital energy
    const a = -MU / (2 * energy);               // < 0 for a bound orbit
    const h = pos[0] * vel[1] - pos[1] * vel[0]; // specific angular momentum
    const e = Math.sqrt(Math.max(0, 1 - (h * h) / (MU * a)));
    const period = energy < 0 ? 2 * Math.PI * Math.sqrt((a * a * a) / MU) : Infinity;
    return { a, e, energy, period,
             perigeeR: a * (1 - e), apogeeR: a * (1 + e) };
  }

  /* Fire a shot horizontally from the mountain top.
     Velocity-Verlet with a step tied to the local curvature time r/v:
     energy drift stays invisible at canvas scale for every slider value.
     The trajectory is drawn until impact, one full revolution, or leaving
     the canvas (14 Earth radii); the verdict always comes from the exact
     Kepler elements, not from where the integrator happened to stop. */
  function simulateShot(v0, h0, opts) {
    const maxSeconds = (opts && opts.maxSeconds) || 12 * 3600;
    let x = 0, y = R_EARTH + h0, vx = v0, vy = 0;
    let r = y;
    const points = [[x, y]];
    let theta = 0;                  // swept polar angle, rad
    let t = 0, steps = 0;
    const dtOf = () => Math.min(20, Math.max(0.25, (0.0016 * r) / Math.hypot(vx, vy)));
    let dt = dtOf();
    let ax = 0, ay = -MU / (r * r);
    const classify = () => {
      const el = elements([0, R_EARTH + h0], [v0, 0]);   // exact launch state
      if (el.energy >= 0) return { result: "escape", v0, flightSec: t, points };
      return { result: "orbit", v0, flightSec: t,
               periodMin: el.period / 60,
               perigeeKm: (el.perigeeR - R_EARTH) / 1000,
               apogeeKm: (el.apogeeR - R_EARTH) / 1000, points };
    };
    while (t < maxSeconds) {
      x += vx * dt + 0.5 * ax * dt * dt;
      y += vy * dt + 0.5 * ay * dt * dt;
      const rNew = Math.hypot(x, y);
      const k = -MU / (rNew * rNew * rNew);
      const axNew = k * x, ayNew = k * y;
      vx += 0.5 * (ax + axNew) * dt;
      vy += 0.5 * (ay + ayNew) * dt;
      ax = axNew; ay = ayNew;
      theta += ((x * vy - y * vx) / (rNew * rNew)) * dt;   // angular rate of r-vector
      r = rNew;
      t += dt; steps++;
      if (steps % 4 === 0) points.push([x, y]);
      if (r <= R_EARTH) {
        points.push([(x * R_EARTH) / r, (y * R_EARTH) / r]);  // pin to the ground
        return { result: "impact", v0, flightSec: t,
                 downrangeKm: (Math.abs(theta) * R_EARTH) / 1000, points };
      }
      if (Math.abs(theta) >= 2 * Math.PI) return classify();
      if (r > 14 * R_EARTH) return classify();
      dt = dtOf();
    }
    return classify();
  }

  /* --- The beep bench: the pass plane in 3D-lite. ---
     Satellite on a circular orbit at its mean radius (Sputnik's e = 0.052
     is a near-circle at this scale) in the xy-plane, crossing theta = 0 at
     t = 0.  The observer sits on the sphere at out-of-plane angle psi:
     psi = 0 puts them on the ground track (a zenith pass), larger psi
     grazes the horizon.  Everything — elevation, azimuth, range, Doppler —
     falls out of the vectors. */

  const satRadius = R_EARTH + (SPUTNIK.perigeeH + SPUTNIK.apogeeH) / 2;
  const satSpeed = circularSpeed(satRadius);
  const satOmega = satSpeed / satRadius;

  function geometry(psi, theta) {
    const s = [satRadius * Math.cos(theta), satRadius * Math.sin(theta), 0];
    const o = [R_EARTH * Math.cos(psi), 0, R_EARTH * Math.sin(psi)];
    const dx = s[0] - o[0], dy = s[1] - o[1], dz = s[2] - o[2];
    const rho = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const cosPsi = Math.cos(psi), sinPsi = Math.sin(psi);
    const sinEl = (dx * cosPsi + dz * sinPsi) / rho;        // (s - o) . up / rho
    const elevRad = Math.asin(Math.max(-1, Math.min(1, sinEl)));
    // drho/dt = (s - o) . sdot / rho, analytic
    const vr = (dx * -satRadius * satOmega * Math.sin(theta) +
                dy * satRadius * satOmega * Math.cos(theta)) / rho;
    // local compass: east = +y, north lies in the xz-plane away from the pole
    const azRad = Math.atan2(dy, -dx * sinPsi + dz * cosPsi);
    return { satX: s[0], satY: s[1], satZ: s[2], rangeM: rho, elevRad, azRad, vr };
  }

  function maxElevationOf(psi) {
    let best = -1;
    for (let k = -90; k <= 90; k++) {                    // +-1.5 rad of flight
      const el = geometry(psi, k * (1 / 60)).elevRad;
      if (el > best) best = el;
    }
    return best;
  }

  // Out-of-plane offset for a wanted peak elevation (monotone down from
  // 90 degrees at psi = 0).
  function offsetForMaxElevation(maxElevDeg) {
    const want = (maxElevDeg * Math.PI) / 180;
    let lo = 0, hi = 1.2;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (maxElevationOf(mid) > want) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  // The full pass: find where the orbit enters and leaves the observer's
  // horizon cap, then sample elevation, range, radial velocity, Doppler.
  function samplePass(maxElevDeg, samples) {
    const psi = offsetForMaxElevation(maxElevDeg);
    let taq = -1.4 / satOmega, tset = 1.4 / satOmega;
    const fine = 1600;
    for (let i = 0; i <= fine; i++) {                    // last rise above 0..
      const th = -1.4 + (2.8 * i) / fine;
      if (geometry(psi, th).elevRad > 0) { taq = th / satOmega; break; }
    }
    for (let i = fine; i >= 0; i--) {                    // ..first set after
      const th = -1.4 + (2.8 * i) / fine;
      if (geometry(psi, th).elevRad > 0) { tset = th / satOmega; break; }
    }
    const points = [];
    for (let i = 0; i <= samples; i++) {
      const t = taq + ((tset - taq) * i) / samples;
      const g = geometry(psi, satOmega * t);
      points.push({ t, theta: satOmega * t, ...g,
                    dopplerHz: (-SPUTNIK.f0 * g.vr) / LIGHT });
    }
    return { psi, taq, tset, halfSec: (tset - taq) / 2, points };
  }

  // The audio beat note: mixing the 20.005 MHz carrier against a local
  // oscillator preserves the Doppler shift in absolute Hz, so the glide you
  // hear around this IF is exactly the shift the radio waves carried.
  const IF_HZ = 940;

  // Sputnik's transmitter wandered with internal temperature by ~ +-0.7 kHz
  // over a pass (bigger than the Doppler itself); slow sines approximate it.
  const driftHz = (tSec) =>
    420 * Math.sin((2 * Math.PI * tSec) / 210 + 1.1) +
    260 * Math.sin((2 * Math.PI * tSec) / 57 + 4.0);

  const api = {
    MU, R_EARTH, LIGHT, MOUNTAIN_H, SPUTNIK,
    circularSpeed, escapeSpeed, elements, simulateShot,
    satRadius, satSpeed, satOmega, offsetForMaxElevation, geometry,
    samplePass, IF_HZ, driftHz,
  };

  global.fallingForever = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
