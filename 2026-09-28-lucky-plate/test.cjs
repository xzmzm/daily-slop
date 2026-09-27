// Node tests for the lucky-plate simulation. Run: node test.cjs
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, 'core.js'), 'utf8');
const sandbox = { module: { exports: {} } };
vm.runInNewContext(src, sandbox, { filename: 'core.js' });
const core = sandbox.module.exports;

let failures = 0;
function ok(cond, label) {
  if (cond) console.log('  ok  ' + label);
  else { failures++; console.log('  FAIL ' + label); }
}

// --- temperature curves -----------------------------------------------------
const cross = core.crossoverTemp();
ok(cross > 24.5 && cross < 27.5, `crossover temp ≈ ${cross.toFixed(1)} °C lies between 24.5 and 27.5`);
ok(core.staphRate(35) > core.staphRate(20) * 5, 'staph prefers 35 °C to 20 °C by >5×');
ok(core.moldRate(18) > core.moldRate(33) * 4, 'mold prefers 18 °C to 33 °C by >4×');
ok(core.penicillinRate(20) > core.penicillinRate(32) * 6, 'penicillin secretion peaks cool, not warm');

// --- the accident replays to a visible halo ---------------------------------
function runReplay(tempOverride) {
  const sim = core.createSim({ seed: 11, script: core.SCRIPT_1928, mutations: false });
  if (tempOverride !== undefined) {
    sim.script = null;
    sim.temp = tempOverride;
  }
  // the spore that drifted in from the stairwell, off-centre like the real one
  sim.dropSpore(core.GRID * 0.40, core.GRID * 0.58, core.SCRIPT_1928.sporeDay);
  sim.step(2); // let inoculation settle
  sim.step(core.SCRIPT_1928.observeDay - 2);
  return sim.stats();
}

const acc = runReplay();
console.log('  accident:', JSON.stringify({
  day: acc.day, moldMm: +acc.moldMm.toFixed(1), zoneMm: +acc.zoneMm.toFixed(1),
  haloMm: +acc.haloMm.toFixed(1), coverage: +acc.coverage.toFixed(2),
}));
ok(acc.moldMm > 14 && acc.moldMm < 40, `mold colony ${acc.moldMm.toFixed(1)} mm across is plate-scale`);
ok(acc.haloMm > 3.5, `a clear halo ${acc.haloMm.toFixed(1)} mm wide rings the mold`);
ok(acc.zoneMm < 60, `zone (${acc.zoneMm.toFixed(1)} mm) does not swallow the whole dish`);

// --- the same plate in a 35 °C incubator never shows a halo ------------------
const warm = runReplay(35);
console.log('  incubator:', JSON.stringify({
  moldMm: +warm.moldMm.toFixed(1), zoneMm: +warm.zoneMm.toFixed(1), coverage: +warm.coverage.toFixed(2),
}));
ok(warm.coverage > 0.85, 'at 35 °C the lawn swallows the plate');
ok(warm.moldMm < 4, 'at 35 °C the mold barely germinates');
ok(warm.haloMm < 4, 'no meaningful halo at 35 °C — the luck never arrives');

// --- drug kills only past tolerance -----------------------------------------
{
  const sim = core.createSim({ seed: 3, temp: 35, mutations: false });
  const { b, p } = sim.fields;
  sim.step(0.25);
  const N = core.GRID, C = N / 2;
  const over = C * N + (C - 12), under = C * N + (C + 12);
  for (let j = C - 4; j <= C + 4; j++) {
    for (let i = C - 16; i <= C - 8; i++) { b[j * N + i] = 0.9; p[j * N + i] = 6.0; } // dosed patch
    for (let i = C + 8; i <= C + 16; i++) b[j * N + i] = 0.9;                         // control patch
  }
  p[under] = 0.4; // well below tolerance everywhere in the control patch
  sim.step(0.5);
  ok(b[over] < 0.4, `bacteria under a 6-unit dose collapse (b=${b[over].toFixed(2)})`);
  ok(b[under] > 0.85, `bacteria below tolerance keep growing (b=${b[under].toFixed(2)})`);
}

// --- diffusion conserves drug mass ------------------------------------------
{
  const sim = core.createSim({ seed: 5, temp: 30, decay: 0, mutations: false });
  const { p } = sim.fields;
  const mid = 96 * core.GRID + 96;
  for (let j = 90; j < 102; j++) for (let i = 90; i < 102; i++) p[j * core.GRID + i] = 1;
  let sum = 0; for (const v of p) sum += v;
  sim.step(6);
  let sum2 = 0; for (const v of p) sum2 += v;
  ok(Math.abs(sum2 - sum) / sum < 0.02, `no-flux diffusion conserves mass (${((sum2 / sum - 1) * 100).toFixed(2)}% drift)`);
}

// --- resistance emerges under stress ----------------------------------------
{
  // constant 2-unit drug pressure (decay disabled so the dose never fades)
  const sim = core.createSim({ seed: 9, temp: 26, decay: 0, mutations: true });
  const { b, p } = sim.fields;
  sim.step(0.25);
  const N = core.GRID;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    if (sim.inDish[k]) { b[k] = 0.9; p[k] = 2.0; } // everywhere just over wild-type tolerance
  }
  const before = sim.stats().meanTol;
  sim.step(25);
  const after = sim.stats();
  console.log('  stress:', JSON.stringify({ before: +before.toFixed(2), after: +after.meanTol.toFixed(2), resistant: after.resistantCells }));
  ok(after.meanTol > before * 1.1, 'mean tolerance rises under drug stress');
  ok(after.resistantCells > 0, 'resistant cells appear inside the stressed zone');
}

// --- dates -------------------------------------------------------------------
ok(core.dateForDay(0) === '8月1日' && core.dateForDay(27) === '8月28日' && core.dateForDay(58) === '9月28日',
  `day 0 → 8月1日, day 58 → 9月28日 (got ${core.dateForDay(0)}, ${core.dateForDay(58)})`);

console.log(failures ? `\n${failures} failure(s)` : '\nall tests passed');
process.exit(failures ? 1 : 0);
