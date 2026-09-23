/* Headway core: wind triangles in a flat local frame.
   Units are kilometres, hours and km/h. x points east, y points north.
   Bearings are compass degrees: 0 = north, 90 = east, clockwise. */
(function (root) {
  const RAD = Math.PI / 180;
  const FULL_POWER_HP = 3;
  const FULL_POWER_KMH = 9;

  // Étoile hippodrome at the origin; Élancourt from WGS84 at 48.784 N, 1.957 E.
  const PLACES = {
    etoile: { name: 'Hippodrome, Étoile', x: 0, y: 0 },
    elancourt: { name: 'Élancourt', x: -24.8, y: -10.0 },
    versailles: { name: 'Versailles', x: -12.8, y: -7.7 },
  };

  const norm360 = (deg) => ((deg % 360) + 360) % 360;
  const signedAngle = (deg) => { const d = norm360(deg); return d > 180 ? d - 360 : d; };
  const vec = (bearing, speed) => [speed * Math.sin(bearing * RAD), speed * Math.cos(bearing * RAD)];
  const len = (v) => Math.hypot(v[0], v[1]);
  const bearingOf = (v) => norm360(Math.atan2(v[0], v[1]) / RAD);

  // Meteorological convention: a wind "from 60°" blows toward 240°.
  const windVector = (fromBearing, speed) => vec(fromBearing + 180, speed);

  // Propeller drag grows with the cube of speed, so airspeed goes as power^(1/3).
  function airspeedFromPower(hp) {
    const p = Math.max(0, Math.min(FULL_POWER_HP, hp));
    return FULL_POWER_KMH * Math.cbrt(p / FULL_POWER_HP);
  }

  function groundVelocity(heading, airspeed, wind) {
    const air = vec(heading, airspeed);
    return [air[0] + wind[0], air[1] + wind[1]];
  }

  /* Heading that makes the ground track follow `course`.
     Split the wind into along-track and cross-track parts. The air vector must
     cancel the cross-track part exactly; whatever airspeed is left pushes along. */
  function solveHeading(course, airspeed, wind) {
    const u = vec(course, 1);
    const n = [u[1], -u[0]]; // 90° to the left of the course
    const wAlong = wind[0] * u[0] + wind[1] * u[1];
    const wCross = wind[0] * n[0] + wind[1] * n[1];
    if (Math.abs(wCross) > airspeed + 1e-9) return null;
    const aAlong = Math.sqrt(Math.max(0, airspeed * airspeed - wCross * wCross));
    const groundSpeed = aAlong + wAlong;
    if (groundSpeed <= 1e-6) return null;
    const air = [u[0] * aAlong - n[0] * wCross, u[1] * aAlong - n[1] * wCross];
    const heading = bearingOf(air);
    return { heading, groundSpeed, crab: signedAngle(heading - course) };
  }

  /* Ground velocities form a circle of radius Va around the wind vector.
     If the wind is faster, that circle misses the origin and only a cone of
     directions, centred downwind with half-angle asin(Va/W), can be flown. */
  function reachableCone(airspeed, wind) {
    const w = len(wind);
    if (w <= airspeed) return { all: true, center: bearingOf(wind), halfAngle: 180 };
    return { all: false, center: bearingOf(wind), halfAngle: Math.asin(airspeed / w) / RAD };
  }

  function canFly(course, airspeed, wind) {
    return solveHeading(course, airspeed, wind) !== null;
  }

  // One integration step. Auto steering crabs along the direct line when it can,
  // otherwise noses straight at the target, which maximises the closing speed.
  function step(ship, dt, opts) {
    const { airspeed, wind, target, auto, manualHeading } = opts;
    const toTarget = [target.x - ship.x, target.y - ship.y];
    const course = bearingOf(toTarget);
    let heading = manualHeading;
    if (auto) {
      const solved = solveHeading(course, airspeed, wind);
      heading = solved ? solved.heading : course;
    }
    const g = groundVelocity(heading, airspeed, wind);
    return {
      x: ship.x + g[0] * dt,
      y: ship.y + g[1] * dt,
      heading,
      track: len(g) > 1e-9 ? bearingOf(g) : heading,
      groundSpeed: len(g),
      t: ship.t + dt,
    };
  }

  // Whole flight at fixed dt until arrival, a time limit, or the edge of the map.
  function flyTo(start, target, opts, limitHours = 8, dt = 1 / 120) {
    let ship = { x: start.x, y: start.y, heading: 0, t: 0 };
    let closest = Infinity;
    while (ship.t < limitHours) {
      const d = Math.hypot(target.x - ship.x, target.y - ship.y);
      closest = Math.min(closest, d);
      if (d < 0.25) return { arrived: true, hours: ship.t, closest: d, ship };
      ship = step(ship, dt, { ...opts, target });
    }
    return { arrived: false, hours: ship.t, closest, ship };
  }

  function formatHours(hours) {
    const total = Math.round(hours * 60);
    return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')} m`;
  }

  const api = {
    PLACES, FULL_POWER_HP, FULL_POWER_KMH,
    norm360, signedAngle, vec, len, bearingOf, windVector, airspeedFromPower,
    groundVelocity, solveHeading, reachableCone, canFly, step, flyTo, formatHours,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HeadwayCore = api;
})(typeof self !== 'undefined' ? self : this);
