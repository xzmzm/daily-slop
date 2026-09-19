/* Rear-axle kinematics. SI units internally; no tire-force or torque model. */
(function (root) {
  'use strict';
  const TAU = 2 * Math.PI;
  const DEFAULTS = Object.freeze({radius:8, track:1.6, speed:18, turn:1, locked:false});
  const WHEEL_RADIUS = .32, WHEELBASE = 2.3, TIME_SCALE = .25;
  function solve(options = {}) {
    const s = {...DEFAULTS, ...options};
    for (const key of ['radius','track','speed','turn']) {
      if (!Number.isFinite(s[key])) throw new RangeError(`${key} must be finite`);
    }
    if (s.track <= 0 || s.radius <= s.track/2 || s.speed < 0 || ![-1,0,1].includes(s.turn)) throw new RangeError('Invalid vehicle geometry or speed');
    const v = s.speed/3.6, k = s.turn/s.radius, yaw = v*k;
    const ground = [v*(1-k*s.track/2), v*(1+k*s.track/2)];
    const roadRPM = ground.map(x=>x/WHEEL_RADIUS*60/TAU);
    const carrier = v/WHEEL_RADIUS*60/TAU;
    const rpm = s.locked ? [carrier,carrier] : roadRPM.slice();
    const slip = rpm.map((n,i)=>n*TAU/60*WHEEL_RADIUS-ground[i]);
    const angles = [Math.atan2(WHEELBASE*k,1-k*s.track/2),Math.atan2(WHEELBASE*k,1+k*s.track/2)];
    const lap = s.turn === 0 ? null : [TAU*(s.radius-s.turn*s.track/2), TAU*(s.radius+s.turn*s.track/2)];
    return {v,k,yaw,ground,roadRPM,carrier,rpm,slip,angles,lap,
      gap:lap ? Math.abs(lap[1]-lap[0]) : null,
      split:carrier ? (Math.max(...rpm)-Math.min(...rpm))/carrier*100 : 0,
      mismatch:Math.max(...slip.map(Math.abs)),
      lapTime:s.turn && v ? TAU*s.radius/v : null};
  }
  function advance(motion, solution, dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be finite and nonnegative');
    return {time:motion.time+dt,angle:motion.angle+solution.yaw*dt,distance:motion.distance+solution.v*dt,
      phase:motion.phase.map((p,i)=>p+solution.rpm[i]*TAU/60*dt)};
  }
  const api = {TAU, DEFAULTS, WHEEL_RADIUS, WHEELBASE, TIME_SCALE, solve, advance};
  root.SplitDriveCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
