/* Independent spec checks. Run: node --test test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./core.js');

function wave(digits, {flipped = false, smudges = [], seed = 1, noise = 0.035} = {}) {
  const modules = C.encodeUpcA(digits);
  const rng = C.mulberry32(seed);
  const {samples, x0, dx} = C.sampleWave(modules, smudges, {
    x0: -1, x1: C.TOTAL + 1, flipped, noise: () => (rng() - 0.5) * 2 * noise
  });
  return {runs: C.waveToRuns(samples, dx), modules};
}

const VALID = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 5];      // the classic 0 12345 67890 5
const MARSH = [0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5, 2];      // the 1974 first-scan number

test('check digit: known labels and the weighting rule', () => {
  assert.equal(C.checkDigit(VALID.slice(0, 11)), 5);
  assert.equal(C.checkDigit(MARSH.slice(0, 11)), 2);
  // 3×odd + even, topped up to the next ten.
  let sum = 0;
  for (let i = 0; i < 11; i++) sum += (i % 2 === 0 ? 3 : 1) * VALID[i];
  assert.equal((10 - sum % 10) % 10, 5);
  for (let t = 0; t < 50; t++) {
    const d = Array.from({length: 11}, () => t * 7 + 1 & 10 ? t % 10 : (t * 3) % 10);
    let s = 0;
    for (let i = 0; i < 11; i++) s += (i % 2 === 0 ? 3 : 1) * d[i];
    assert.equal((s + C.checkDigit(d)) % 10, 0);
  }
});

test('encoder lays out 95 modules with the spec guards and patterns', () => {
  const m = C.encodeUpcA(VALID);
  assert.equal(m.length, 95);
  assert.deepEqual(m.slice(0, 3), [1, 0, 1]);
  assert.deepEqual(m.slice(45, 50), [0, 1, 0, 1, 0]);
  assert.deepEqual(m.slice(92), [1, 0, 1]);
  for (let k = 0; k < 6; k++) {
    assert.deepEqual(m.slice(3 + 7 * k, 10 + 7 * k), C.L_PATTERNS[VALID[k]], `left digit ${k}`);
    assert.deepEqual(m.slice(50 + 7 * k, 57 + 7 * k), C.R_PATTERNS[VALID[6 + k]], `right digit ${k}`);
  }
  // L patterns all start light and end dark; R is their exact complement.
  for (const p of C.L_PATTERNS) { assert.equal(p[0], 0); assert.equal(p[6], 1); }
  for (let d = 0; d < 10; d++) {
    assert.deepEqual(C.R_PATTERNS[d], C.L_PATTERNS[d].map(b => 1 - b));
  }
  assert.equal(C.encodeUpcA([1, 2]), null);
  assert.equal(C.encodeUpcA(Array(12).fill(9)).length, 95);
});

test('a clean pass round-trips through sampling noise, both label faces', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const fwd = C.decodeRuns(wave(VALID, {seed}).runs);
    assert.equal(fwd.ok, true, `seed ${seed}: ${fwd.reason}`);
    assert.deepEqual(fwd.digits, VALID);
    assert.equal(fwd.direction, 'FWD');
    const rev = C.decodeRuns(wave(VALID, {seed, flipped: true}).runs);
    assert.equal(rev.ok, true, `flipped seed ${seed}: ${rev.reason}`);
    assert.deepEqual(rev.digits, VALID);
    assert.equal(rev.direction, 'REV');
    const marsh = C.decodeRuns(wave(MARSH, {seed}).runs);
    assert.deepEqual(marsh.digits, MARSH);
  }
  // Heavier noise and coarser sampling still decode.
  const rough = C.decodeRuns(wave(VALID, {seed: 99, noise: 0.06}).runs);
  assert.equal(rough.ok, true);
});

test('damage: quiet zone, guard, digit and check-digit failures', () => {
  const quiet = C.decodeRuns(wave(VALID, {smudges: [{a: 5, b: 7}]}).runs);
  assert.equal(quiet.ok, false);
  assert.equal(quiet.reason, 'QUIET ZONE VIOLATION');
  const trailing = C.decodeRuns(wave(VALID, {smudges: [{a: 108, b: 110}]}).runs);
  assert.equal(trailing.reason, 'QUIET ZONE VIOLATION');
  // Ink over the start guard merges its bars: no 101 anywhere it must be.
  const guard = C.decodeRuns(wave(VALID, {smudges: [{a: 9.2, b: 10.8}]}).runs);
  assert.equal(guard.ok, false);
  assert.ok(['NO GUARD FOUND', 'UNREADABLE DIGIT'].includes(guard.reason), guard.reason);
  // A smudge across one digit block makes that pattern unreadable.
  const digit = C.decodeRuns(wave(VALID, {smudges: [{a: 24, b: 27}]}).runs);
  assert.equal(digit.ok, false);
  assert.equal(digit.reason, 'UNREADABLE DIGIT');
  // A faithfully printed but wrongly checksummed label parses, then fails the rule.
  const wrongCheck = C.decodeRuns(wave([...VALID.slice(0, 11), 3]).runs);
  assert.equal(wrongCheck.ok, false);
  assert.equal(wrongCheck.reason, 'CHECK DIGIT MISMATCH');
  assert.equal(wrongCheck.expected, 5);
  assert.equal(wrongCheck.read, 3);
  // An all-light pass is no signal at all.
  assert.equal(C.decodeRuns([{dark: false, n: 40}]).reason, 'NO SIGNAL');
});

test('mid-sweep decode grows digit by digit and never invents one', () => {
  const {runs} = wave(VALID, {seed: 4});
  // decodePartial drops the run still under the laser, so a digit resolves
  // only once the laser has crossed one run past its last module.
  let seen = 0, cut = [];
  for (const r of runs) {
    cut.push(r);
    seen += r.n;
    if (seen >= 10 + 3 + 14 + 2.5) break;   // pad 1 + quiet 9 + guard 3 + 2 digits + spillover
  }
  const part = C.decodePartial(cut);
  assert.equal(part.stage, 'left');
  assert.deepEqual(part.digits, [0, 1]);
  // Still inside the quiet zone: nothing decoded yet.
  const early = C.decodePartial([{dark: false, n: 6}]);
  assert.equal(early.stage, 'quiet');
  assert.deepEqual(early.digits, []);
  // Four digits resolved once the fifth block has begun.
  let seen2 = 0, cut2 = [];
  for (const r of runs) {
    cut2.push(r);
    seen2 += r.n;
    if (seen2 >= 13 + 28 + 3.5) break;
  }
  assert.deepEqual(C.decodePartial(cut2).digits, [0, 1, 2, 3]);
});

test('reversal is the only escape hatch: parse rejects mixed and mirrored junk', () => {
  const {runs} = wave(VALID, {seed: 7});
  const bits = C.runsToBits(runs);
  assert.equal(C.parseScan(bits, false).stage, 'ok');
  assert.equal(C.decodeRuns(C.reverseRuns(runs)).direction, 'REV');
  // Garbage between the guards is never rescued by reversal.
  const junk = [
    {dark: false, n: 9}, {dark: true, n: 1}, {dark: false, n: 1}, {dark: true, n: 1},
    ...Array.from({length: 6}, () => [{dark: false, n: 3}, {dark: true, n: 4}]).flat(),
    {dark: false, n: 1}, {dark: true, n: 1}, {dark: false, n: 1}, {dark: true, n: 1}, {dark: false, n: 1},
    ...Array.from({length: 6}, () => [{dark: false, n: 3}, {dark: true, n: 4}]).flat(),
    {dark: true, n: 1}, {dark: false, n: 1}, {dark: true, n: 1}, {dark: false, n: 9}
  ];
  assert.equal(C.decodeRuns(junk).ok, false);
});
