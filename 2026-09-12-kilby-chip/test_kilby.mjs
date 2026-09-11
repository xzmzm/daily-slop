import assert from 'node:assert/strict';
import {
  fundamentalAmplitude,
  clipDescribingFunction,
  C, cAbs, cArg, feedbackBeta, BETA_Y, CRITICAL_GAIN, SQRT6, oscFrequency,
  charCoeffs, cubicRoots, dominantRoot, linearLoopDynamics,
  steadyAmplitude, simulateOscillator, measureFrequency, measureSigma,
  BAR_LENGTH_CM, BAR_WIDTH_CM, barResistance, depletionWidth, junctionCapacitance,
  EPS_GE, tyrannyStats, ENIAC_TUBES, ENIAC_MTBF_HOURS, eniacTubeLambda,
  MOORE_ANCHORS, transistorsPerChip, chipPlan, doublingTime, MILESTONES,
} from './kilby.js';

console.log('--- Running Kilby Germanium Bar Test Suite ---');

// 1. Routh-Hurwitz boundary: K = 29 exactly, from a2*a1 = a3*a0.
console.log('Testing Routh-Hurwitz critical gain...');
{
  const { a3, a2, a1, a0 } = charCoeffs(0);
  const Kcrit = (a2 * a1) / a0 - a3;  // solve 6*5 = (1+K)*1
  assert.equal(Kcrit, 29);
  assert.equal(CRITICAL_GAIN, 29);
}

// 2. beta(j/sqrt(6)) is real, negative, and exactly -1/29.
console.log('Testing feedback network beta at omega*RC = 1/sqrt(6)...');
{
  const b = feedbackBeta(C(0, BETA_Y));
  assert.ok(Math.abs(b.im) < 1e-12, 'beta is real');
  assert.ok(Math.abs(b.re + 1 / 29) < 1e-12, `beta = -1/29, got ${b.re}`);
  assert.ok(Math.abs(cArg(b) - Math.PI) < 1e-9, 'phase is exactly 180 degrees');
  assert.equal(BETA_Y, 1 / Math.sqrt(6));
}

// 3. beta phase passes through 180 degrees only at y = 1/sqrt(6).
console.log('Testing beta phase crossing uniqueness...');
{
  for (const y of [0.05, 0.15, 0.30, 0.55, 0.9, 2.0]) {
    const phase = cArg(feedbackBeta(C(0, y)));
    assert.ok(Math.abs(phase - Math.PI) > 1e-3, `phase != 180 at y=${y}`);
  }
}

// 4. Closed-loop cubic at K = 29 factors as (x^2 + 1/6)(30x + 6).
console.log('Testing cubic roots at K = 29: pair lands on the imaginary axis...');
{
  const roots = cubicRoots(30, 6, 5, 1);
  const pair = roots.filter(r => Math.abs(r.im) > 1e-6);
  assert.equal(pair.length, 2);
  for (const r of pair) {
    assert.ok(Math.abs(r.re) < 1e-9, `real part ~ 0, got ${r.re}`);
    assert.ok(Math.abs(r.im - BETA_Y) < 1e-9 || Math.abs(r.im + BETA_Y) < 1e-9, 'imag = 1/sqrt(6)');
  }
  const real = roots.find(r => Math.abs(r.im) <= 1e-6);
  assert.ok(Math.abs(real.re + 0.2) < 1e-9, `decaying root = -1/5, got ${real.re}`);
}

// 5. Below 29 the loop decays; above 29 it grows; frequency stays near 1/(2pi RC sqrt6).
console.log('Testing growth sign and frequency around the boundary...');
{
  assert.ok(dominantRoot(25).re < 0, 'K=25 decays');
  assert.ok(dominantRoot(28.999).re < 0, 'K=28.999 decays');
  assert.ok(dominantRoot(29.001).re > 0, 'K=29.001 grows');
  assert.ok(dominantRoot(35).re > 0, 'K=35 grows');
  const dyn = linearLoopDynamics(4700, 220e-9, 35);
  const theory = oscFrequency(4700, 220e-9);
  // the growing linear mode is pulled a few percent below the boundary
  // frequency; the steady limit cycle itself sits exactly on the closed form
  assert.ok(Math.abs(Math.abs(dyn.frequency) - theory) / theory < 0.08, 'linear mode within 8% of 1/(2pi RC sqrt6)');
  assert.ok(dyn.sigma > 0, 'sigma positive for K=35');
}

// 6. Time-domain simulation: measured frequency matches the closed form.
console.log('Testing simulated oscillation frequency vs closed form...');
{
  const R = 4700, Cf = 220e-9, K = 32, Vlim = 5; // mild clipping: U ~ 1.24 Vlim
  const theory = oscFrequency(R, Cf);
  const dt = (1 / theory) / 48;
  const { vo } = simulateOscillator({ R, Cfarad: Cf, K, Vlim, dt, steps: 60000, u0: 1e-3 });
  const measured = measureFrequency(vo.subarray(10000), dt);
  // the memoryless clip keeps the loop phase real, so the limit cycle sits on
  // the closed form up to harmonic-distortion frequency pull (~1% here)
  assert.ok(Math.abs(measured - theory) / theory < 0.015, `measured ${measured} Hz vs theory ${theory} Hz`);
}

// 7. Simulated growth rate matches the linear dominant root.
console.log('Testing simulated envelope growth rate vs dominant root...');
{
  const R = 4700, Cf = 220e-9, K = 34, Vlim = 5;
  const { sigma } = linearLoopDynamics(R, Cf, K);
  const f0 = oscFrequency(R, Cf);
  const dt = (1 / f0) / 48;
  const { v3 } = simulateOscillator({ R, Cfarad: Cf, K, Vlim, dt, steps: 20000, u0: 1e-3 });
  const sigmaSim = measureSigma(v3, dt);
  assert.ok(Math.abs(sigmaSim - sigma) / sigma < 0.15, `sigma sim ${sigmaSim} vs root ${sigma}`);
}

// 8. Steady amplitude lands where the describing function crosses 29.
console.log('Testing steady-state amplitude vs describing-function prediction...');
{
  assert.ok(Math.abs(clipDescribingFunction(1) - 1) < 1e-12, 'N(v>=1) = 1 (no clipping)');
  assert.ok(Math.abs(clipDescribingFunction(0.5) - (2 / Math.PI) * (Math.asin(0.5) + 0.5 * Math.sqrt(0.75))) < 1e-12, 'hard-clip DF closed form');
  const A = steadyAmplitude(45, 5);
  assert.ok(A > 5, 'settled fundamental exceeds the clip level');
  const v = 5 / A;
  assert.ok(Math.abs(45 * clipDescribingFunction(v) - 29) < 1e-9, 'bisection solves K*N = 29');
  assert.ok(steadyAmplitude(29, 5) === Infinity, 'at K=29 amplitude never settles');

  const R = 4700, Cf = 220e-9, K = 33, Vlim = 5;
  const f0 = oscFrequency(R, Cf);
  const dt = (1 / f0) / 48;
  const { v3 } = simulateOscillator({ R, Cfarad: Cf, K, Vlim, dt, steps: 40000, u0: 1e-3 });
  const tail = v3.subarray(32000);
  const amp = fundamentalAmplitude(tail, dt, measureFrequency(tail, dt));
  const A33 = steadyAmplitude(K, Vlim);
  // describing functions carry their classic ~10-20% error because the ladder
  // passes some 3rd harmonic; the exact identities are the gain/frequency laws
  assert.ok(Math.abs(amp - A33) / A33 < 0.2, `fundamental ${amp} vs DF prediction ${A33}`);
}

// 9. The germanium bar: R = rho * L / A in plain arithmetic.
console.log('Testing germanium bar geometry and resistance...');
{
  assert.ok(Math.abs(BAR_LENGTH_CM - 1.11125) < 1e-9, 'bar is 7/16 in = 1.11125 cm');
  assert.ok(Math.abs(BAR_WIDTH_CM - 0.15875) < 1e-9, 'bar is 1/16 in = 0.15875 cm');
  assert.equal(barResistance(20, 0.5, 0.1, 0.01), 10000, '20 Ohm-cm neck gives 10 kOhm');
  // half the length, half the resistance
  assert.ok(Math.abs(barResistance(20, 0.25, 0.1, 0.01) - 5000) < 1e-9);
}

// 10. Junction physics: C*W = eps*A exactly; W scales as sqrt(V).
console.log('Testing junction depletion width and capacitance...');
{
  const A = 0.004, Vbi = 0.3, VR = 2.0, Nd = 1e15;
  const W = depletionWidth(Vbi, VR, Nd);
  const Cj = junctionCapacitance(A, Vbi, VR, Nd);
  assert.ok(Math.abs(Cj * W - EPS_GE * A) / (EPS_GE * A) < 1e-12, 'C = eps*A/W exactly');
  // doubling the total bias multiplies W by sqrt(2) for Vbi = 0
  const w1 = depletionWidth(0, 1, 1e15), w2 = depletionWidth(0, 4, 1e15);
  assert.ok(Math.abs(w2 / w1 - 2) < 1e-9, 'W ~ sqrt(V)');
  // heavier doping, thinner depletion, more capacitance
  assert.ok(depletionWidth(0.3, 2, 1e16) < W);
  assert.ok(junctionCapacitance(A, 0.3, 2, 1e16) > Cj);
}

// 11. Tyranny accounting: 8 parts per gate, 2 joints per part, 1 wire per part.
console.log('Testing tyranny-of-numbers bookkeeping...');
{
  const t = tyrannyStats(1);
  assert.equal(t.parts, 8);
  assert.equal(t.joints, 16);
  assert.equal(t.wires, 8);
  assert.ok(Math.abs(t.mtbfHours - 1 / (3 * 1e-6 + 5 * 2e-7 + 16 * 5e-8)) < 1e-9);
  const apollo = tyrannyStats(5600); // AGC Block II: ~2,800 dual-NOR chips
  assert.equal(apollo.parts, 8 * 5600);
  assert.equal(apollo.joints, 2 * 8 * 5600);
  assert.ok(apollo.assemblyPersonDays > 50, 'a discrete AGC would take months of soldering');
}

// 12. ENIAC reality check: 17,468 tubes, one failure every ~2 days.
console.log('Testing ENIAC failure-rate anchor...');
{
  const lambda = eniacTubeLambda();
  const mtbf = 1 / (ENIAC_TUBES * lambda);
  assert.ok(Math.abs(mtbf - ENIAC_MTBF_HOURS) < 1e-6, 'system MTBF = 48 h');
  assert.ok(lambda > 5e-7 && lambda < 5e-6, 'per-tube lambda is period-plausible');
}

// 13. Moore interpolation is monotone and hits anchors exactly.
console.log('Testing Moore curve interpolation...');
{
  for (const a of MOORE_ANCHORS) assert.equal(transistorsPerChip(a.year), a.count);
  let prev = 0;
  for (let y = 1959; y <= 2026; y++) {
    const v = transistorsPerChip(y);
    assert.ok(v >= prev, 'monotone in year');
    prev = v;
  }
  assert.ok(transistorsPerChip(1958) === 1 && transistorsPerChip(1950) === 1);
}

// 14. Chip plan: monolithic needs far fewer joints than discrete.
console.log('Testing chip plan vs discrete plan...');
{
  const plan = chipPlan(22400, 1966); // ~AGC-scale logic in transistors
  assert.ok(plan.chips >= 1);
  assert.ok(plan.joints < plan.discrete.joints / 25, 'monolithic removes >25x the hand-soldered joints');
  assert.ok(plan.mtbfHours > plan.discrete.mtbfHours, 'monolithic also wins MTBF');
}

// 15. Doubling times implied by the landmarks.
console.log('Testing Moore doubling-time arithmetic...');
{
  const early = doublingTime(64, 1965, 2300, 1971);
  assert.ok(early > 0.9 && early < 1.4, `1965-1971 doubling ~ 1 yr, got ${early.toFixed(2)}`);
  const late = doublingTime(2300, 1971, 92e9, 2023);
  assert.ok(late > 1.8 && late < 2.4, `1971-2023 doubling ~ 2 yr, got ${late.toFixed(2)}`);
  assert.ok(doublingTime(1000, 1990, 4000, 1990 + 6) > 2.9 && doublingTime(1000, 1990, 4000, 1990 + 6) < 3.1);
}

// 16. Milestone data sanity.
console.log('Testing milestone data...');
{
  assert.ok(MILESTONES.length >= 8);
  const dates = MILESTONES.map(m => m.year).slice().sort();
  assert.deepEqual(MILESTONES.map(m => m.year), dates, 'milestones are chronological');
  assert.ok(MILESTONES.some(m => m.year === '1958-09-12'));
  assert.ok(MILESTONES.some(m => m.year === '2000-12-10'));
}

console.log('All Kilby germanium-bar tests passed.');
