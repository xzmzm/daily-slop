/* Positive angles are clockwise, as seen looking down at the floor. */
(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.PendulumPhysics = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SIDEREAL_HOURS = 86164.0905 / 3600;
  const RAD = Math.PI / 180;
  function rate(latitude) {
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) throw new RangeError('Latitude must be between -90 and 90 degrees.');
    return 360 / SIDEREAL_HOURS * Math.sin(latitude * RAD);
  }
  function at(latitude, hours) {
    if (!Number.isFinite(hours) || hours < 0) throw new RangeError('Elapsed hours must be finite and nonnegative.');
    const speed = rate(latitude);
    return { rate: speed, angle: speed * hours, period: speed === 0 ? Infinity : 360 / Math.abs(speed), direction: speed === 0 ? 'none' : speed > 0 ? 'clockwise' : 'counterclockwise' };
  }
  function hourMarks(latitude, hours) {
    at(latitude, hours);
    return Array.from({length: Math.min(48, Math.floor(hours)) + 1}, (_, hour) => ({hour, angle: rate(latitude) * hour}));
  }
  return Object.freeze({ SIDEREAL_HOURS, rate, at, hourMarks });
});
