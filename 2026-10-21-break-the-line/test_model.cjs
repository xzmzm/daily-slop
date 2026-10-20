const assert = require('node:assert/strict');
const M = require('./model.js');

// square-rigger polar: fastest on a broad reach, never faster than the wind
assert(M.polar(120) > M.polar(90) && M.polar(120) > M.polar(180));
assert(M.britishSpeed(90, 3) < 3 * M.KNOT);
assert(M.hitFraction(100) > M.hitFraction(600));

// same settings, same battle
const nelson = M.simulate(M.PRESETS.nelson);
assert.deepEqual(M.simulate(M.PRESETS.nelson).summary, nelson.summary);
assert.equal(nelson.frames.length, M.C.minutes * 60 / M.C.dt / M.C.frameEvery + 1);

// Nelson: the lead ship pays for the approach, then the line is destroyed in place
const n = nelson.summary;
assert(n.leadSilent >= 15, n.leadSilent);
assert(n.firstReply > 20, n.firstReply);
assert(n.taken >= 10, n.taken);
assert(n.escaped <= 1, n.escaped);
assert.equal(n.britishLost, 0);
assert(n.leadHull < M.C.leadHull / 2, n.leadHull);
assert(n.rakeShare > 0.15, n.rakeShare);

// line of battle: no silent approach, and the damaged run downwind
const line = M.simulate(M.PRESETS.line).summary;
assert(line.leadSilent < 1, line.leadSilent);
assert(line.escaped >= 8, line.escaped);
assert(line.taken <= 2, line.taken);

// the doctrine, not the angle, decides who escapes
const cutShallow = M.simulate({ angle: 20, doctrine: 'cut' }).summary;
const haulSteep = M.simulate({ angle: 90, doctrine: 'haul' }).summary;
assert(cutShallow.escaped < haulSteep.escaped);
assert(cutShallow.taken > haulSteep.taken);

// more wind, a shorter walk into their guns
const breezy = M.simulate(Object.assign({}, M.PRESETS.nelson, { wind: 6 })).summary;
assert(breezy.leadSilent < n.leadSilent * 0.6, breezy.leadSilent);

// struck ships stay struck; escaped ships never come back
const status = nelson.frames.map(f => f.ships.map(s => s.status));
for (let i = 1; i < status.length; i++) status[i].forEach((s, k) => {
  if (status[i - 1][k] === 'struck') assert.equal(s, 'struck');
});
const lineFrames = M.simulate(M.PRESETS.line).frames;
for (let i = 1; i < lineFrames.length; i++) lineFrames[i].ships.forEach((s, k) => {
  if (lineFrames[i - 1].ships[k].status === 'escaped') assert.equal(s.status, 'escaped');
});

// fleet strength never grows
for (let i = 1; i < nelson.frames.length; i++) {
  assert(nelson.frames[i].strength.B <= nelson.frames[i - 1].strength.B + 1e-9);
  assert(nelson.frames[i].strength.E <= nelson.frames[i - 1].strength.E + 1e-9);
}
console.log('model ok', JSON.stringify({ nelson: n, line }, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
