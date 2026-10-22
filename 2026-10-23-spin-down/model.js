/* Playable seconds are the unit of storage. This is a teaching model, not firmware. */
(function (root) {
  'use strict';
  const READ_RATE = 40, SPIN_UP = 2, STEP = .05;
  const player = (capacity, continuous) => ({ capacity, continuous, reserve: capacity,
    phase: continuous ? 'read' : 'sleep', spinLeft: 0, diskSeconds: 0,
    silentSeconds: 0, playedSeconds: 0, stalled: false, starts: 0 });
  function create(capacity = 1200) {
    if (![120, 1200].includes(capacity)) throw new RangeError('Choose 120 or 1200 seconds');
    const state = { time: 0, playing: false, capacity, outageLeft: 0, track: 1,
      direct: player(2, true), cached: player(capacity, false), history: [], nextSample: 0 };
    sample(state);
    return state;
  }
  function sample(s) {
    s.history.push({ time: s.time, reserve: s.cached.reserve, blocked: s.outageLeft > 0,
      directOn: s.direct.phase !== 'sleep', cachedOn: s.cached.phase !== 'sleep',
      directStalled: s.direct.stalled, cachedStalled: s.cached.stalled });
    if (s.history.length > 2401) s.history.shift();
    s.nextSample = Math.floor(s.time + 1e-6) + 1;
  }
  function tick(p, dt, available) {
    const threshold = Math.min(30, p.capacity * .1);
    if (!p.continuous && p.phase === 'sleep' && p.reserve <= threshold) {
      p.phase = 'spin'; p.spinLeft = SPIN_UP; p.starts++;
    }
    if (p.phase !== 'sleep') p.diskSeconds += dt;
    let read = 0;
    if (p.phase === 'spin') {
      p.spinLeft = Math.max(0, p.spinLeft - dt);
      if (p.spinLeft < 1e-8) p.phase = 'read';
    } else if (p.phase === 'read' && available) read = READ_RATE * dt;
    // Consume and replenish within the same step, keeping exact playback conservation.
    const heard = Math.min(dt, p.reserve + read);
    p.reserve = Math.min(p.capacity, Math.max(0, p.reserve + read - heard));
    p.playedSeconds += heard;
    p.silentSeconds += dt - heard;
    p.stalled = heard < dt - 1e-8;
    if (!p.continuous && p.phase === 'read' && p.reserve >= p.capacity - 1e-8) p.phase = 'sleep';
  }
  function advance(s, seconds) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) throw new RangeError('Invalid elapsed time');
    if (!s.playing) return s;
    let left = seconds;
    while (left > 1e-8) {
      const dt = Math.min(STEP, left, s.outageLeft > 1e-8 ? s.outageLeft : STEP);
      const available = s.outageLeft <= 1e-8;
      tick(s.direct, dt, available); tick(s.cached, dt, available);
      s.time += dt; s.outageLeft = Math.max(0, s.outageLeft - dt); left -= dt;
      if (s.time >= s.nextSample - 1e-8) sample(s);
    }
    return s;
  }
  function block(s) { s.outageLeft = 300; }
  function skip(s) {
    s.track++;
    for (const p of [s.direct, s.cached]) {
      p.reserve = 0; p.phase = 'spin'; p.spinLeft = SPIN_UP; p.starts++; p.stalled = true;
    }
  }
  const api = { create, advance, block, skip, READ_RATE, SPIN_UP };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpinModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
