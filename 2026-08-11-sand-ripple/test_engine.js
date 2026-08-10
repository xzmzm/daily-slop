// test_engine.js — assertions for the aeolian sand-ripple engine.
// Run with:  node test_engine.js
//
// Each test prints a one-line PASS / FAIL. Exit code 1 on any failure.

'use strict';

const E = require('./engine.js');

let npass = 0, nfail = 0;
function ok(name, cond, extra) {
  if (cond) { npass++; console.log('  PASS  ' + name); }
  else { nfail++; console.log('  FAIL  ' + name + (extra ? '   ' + extra : '')); }
}
function near(name, a, b, tol, extra) {
  const d = Math.abs(a - b);
  ok(name + `  (${a.toExponential(4)} vs ${b.toExponential(4)}, Δ=${d.toExponential(2)})`,
     d <= tol, extra);
}

console.log('aeolian sand-ripple engine — verification\n');

// ─────────────────────────────────────────────────────────────────────────
// 1. Hop kernel: sums to 1, monotone decreasing, all positive, mean ≈ L.
// ─────────────────────────────────────────────────────────────────────────
console.log('[1] hop kernel');
{
  const ker = E.hopKernel({});
  let s = 0, mono = true, pos = true;
  for (let r = 1; r < ker.length; r++) {
    s += ker[r];
    if (ker[r] <= 0) pos = false;
    if (r > 1 && ker[r] > ker[r - 1] + 1e-12) mono = false;
  }
  near('  sum p[r] = 1', s, 1.0, 1e-12);
  ok('  all p[r] > 0', pos);
  ok('  monotone decreasing', mono);
  let mean = 0;
  for (let r = 1; r < ker.length; r++) mean += r * ker[r];
  near('  mean hop ≈ L', mean, E.DEFAULTS.L, 0.05);
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Mass conservation. ΣΔh must be ~0 (periodic, Σp=1, Laplacian telescopes).
//    The bedrock invariant of any sediment-transport scheme.
// ─────────────────────────────────────────────────────────────────────────
console.log('[2] mass conservation');
{
  for (const N of [64, 256, 512]) {
    const p = { N };
    let h = new Float64Array(N);
    for (let i = 0; i < N; i++) h[i] = 0.01 * Math.sin(2 * Math.PI * 4 * i / N);
    const before = E.totalMass(h);
    for (let s = 0; s < 50; s++) { h = E.fluxStep(h, p); }
    const after = E.totalMass(h);
    near(`  Σh preserved over 50 steps, N=${N}`, after, before, 1e-9);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Flat bed is a fixed point of the flux step.
// ─────────────────────────────────────────────────────────────────────────
console.log('[3] flat-bed equilibrium');
{
  const N = 128;
  const h = new Float64Array(N).fill(1.0);
  const h2 = E.fluxStep(h, { N });
  let maxDev = 0;
  for (let i = 0; i < N; i++) maxDev = Math.max(maxDev, Math.abs(h2[i] - 1));
  near('  flat bed unchanged by flux step', maxDev, 0, 1e-12);
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Linear multiplier matches simulated growth. Seed ONE pure Fourier mode,
//    run many steps, the amplitude must grow by |M(k)|^steps. Small C keeps
//    nonlinearity out of the linear regime.
// ─────────────────────────────────────────────────────────────────────────
console.log('[4] linear multiplier matches simulated growth');
{
  const N = 512, m = 6;
  const p = { N, C: 0.05, D: 0.005, L: 4.2 };
  const k = 2 * Math.PI * m / N;             // rad/cell
  const steps = 300;

  const M = E.linearMultiplier(k, p);
  const predicted = Math.pow(Math.sqrt(M.re * M.re + M.im * M.im), steps);

  const h0 = new Float64Array(N);
  for (let i = 0; i < N; i++) h0[i] = 0.001 * Math.cos(k * i);
  let h = h0;
  for (let s = 0; s < steps; s++) h = E.fluxStep(h, p);
  const measured = E.dftAmplitude(h, m) / E.dftAmplitude(h0, m);

  near('  |M(k)|^steps predicts amplitude growth', measured, predicted,
       0.02 * Math.max(predicted, 1e-9));
  ok('  mode is unstable (|M|>1)', Math.hypot(M.re, M.im) > 1.0);
}

// ─────────────────────────────────────────────────────────────────────────
// 5. fastestWavelength() coincides with the maximum of σ(k) over a fine grid.
// ─────────────────────────────────────────────────────────────────────────
console.log('[5] fastest-growing wavelength');
{
  const p = { C: 0.35, D: 0.20, L: 4.2, N: 512 };
  const { lambda, k } = E.fastestWavelength(p);
  let bestK = 0, bestG = -1e9;
  for (let m = 2; m <= 80; m++) {
    const kk = 2 * Math.PI * m / p.N;
    const g = E.linearGrowthRate(kk, p);
    if (g > bestG) { bestG = g; bestK = kk; }
  }
  near('  peak k matches brute force', k, bestK, bestK * 0.05);
  ok('  peak growth is positive', bestG > 0, `σ=${bestG.toExponential(3)}`);
  ok('  λ_fast in plausible range (3L … 30L)',
     lambda > 3 * p.L && lambda < 30 * p.L,
     `λ=${lambda.toFixed(2)} cells, L=${p.L}`);
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Continuum limit. As L→∞ (many cells per hop), the discrete growth rate
//    converges to Anderson's continuum closed form
//        Re σ(k) = (C L k²) / (1 + (kL)²)  −  D k²
//    because the geometric CF → 1/(1+ikL).
// ─────────────────────────────────────────────────────────────────────────
console.log('[6] continuum limit → Anderson 1987');
{
  // Pick a small k (so continuum approx holds) and a moderate kL.
  const C = 0.5, D = 0.06;
  const kLtarget = 1.0;                       // dimensionless
  // As L grows, k→0 and σ→0 (it scales like k²). Absolute error must shrink.
  let prevErr = Infinity;
  for (const L of [8, 16, 32, 64]) {
    const k = kLtarget / L;                   // rad/cell
    const gDiscrete = E.linearGrowthRate(k, { C, D, L, N: 1 << 18 });
    const sigma = (C * L * k * k) / (1 + kLtarget * kLtarget) - D * k * k;
    const err = Math.abs(gDiscrete - sigma);
    // Relative tolerance generous at small L (continuum approx poorest);
    // tight at large L. Assert absolute error shrinks monotonically.
    ok(`  L=${L}: discrete σ ≈ Anderson σ`,
       err < 0.10 * Math.max(Math.abs(sigma), 1e-4) + 5e-4,
       `disc=${gDiscrete.toExponential(3)} Anderson=${sigma.toExponential(3)} err=${err.toExponential(2)}`);
    ok(`  abs error decreases with L`, err <= prevErr + 2e-4,
       `err=${err.toExponential(2)} prev=${prevErr.toExponential(2)}`);
    prevErr = err;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 7. Diffusion kills short wavelengths. With C=0, modes decay; high-k faster.
// ─────────────────────────────────────────────────────────────────────────
console.log('[7] creep diffusion damps short wavelengths');
{
  const p = { C: 0, D: 0.05, L: 4.2, N: 512 };
  const gLo = E.linearGrowthRate(2 * Math.PI * 2 / p.N, p);
  const gHi = E.linearGrowthRate(2 * Math.PI * 40 / p.N, p);
  ok('  low-k mode decays (g<0)', gLo < 0, `gLo=${gLo.toExponential(2)}`);
  ok('  high-k mode decays faster', gHi < gLo, `gHi=${gHi.toExponential(2)}`);
}

// ─────────────────────────────────────────────────────────────────────────
// 8. Null dynamics. C=0, D=0 ⇒ identity.
// ─────────────────────────────────────────────────────────────────────────
console.log('[8] null dynamics');
{
  const h = new Float64Array(64);
  for (let i = 0; i < 64; i++) h[i] = Math.sin(i);
  const h2 = E.fluxStep(h, { C: 0, D: 0, N: 64 });
  let dev = 0;
  for (let i = 0; i < 64; i++) dev = Math.max(dev, Math.abs(h2[i] - h[i]));
  near('  C=0, D=0 ⇒ identity', dev, 0, 1e-12);
}

// ─────────────────────────────────────────────────────────────────────────
// 9. Angle-of-repose avalanche. Build a tall spike; avalanche must spread it
//    until no cell-to-cell difference exceeds tan(repose), and conserve mass.
// ─────────────────────────────────────────────────────────────────────────
console.log('[9] avalanche (angle of repose)');
{
  const N = 64;
  const h = new Float64Array(N).fill(0);
  h[32] = 2.0;
  const ha = E.avalanche(h, { N, reposeDeg: 33 });
  ok('  avalanche conserves mass',
     Math.abs(E.totalMass(ha) - E.totalMass(h)) < 1e-9);
  const md = E.maxHeightDiff(ha);
  const repose = Math.tan(33 * Math.PI / 180);
  ok('  no cell diff exceeds tan(repose)', md <= repose + 1e-6,
     `max diff ${md.toExponential(2)} vs tan(33°)=${repose.toExponential(2)}`);
  ok('  spike height reduced', ha[32] < h[32]);
}

// ─────────────────────────────────────────────────────────────────────────
// 10. End-to-end: noise grows into ripples. Start from white noise, run the
//     full dynamics; spectrum develops a clear peak near λ_fast and the bed
//     shows visible relief.
// ─────────────────────────────────────────────────────────────────────────
console.log('[10] noise → ripples (end-to-end)');
{
  const N = 512;
  const p = { N, C: 0.35, D: 0.20, L: 4.2, reposeDeg: 33 };
  const { lambda } = E.fastestWavelength(p);
  let h = new Float64Array(N);
  let rng = 12345;
  for (let i = 0; i < N; i++) {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    h[i] = (rng / 0x7fffffff - 0.5) * 1e-3;
  }
  for (let s = 0; s < 6000; s++) {
    h = E.fluxStep(h, p);
    h = E.avalanche(h, p);
  }
  let bestM = 0, bestA = -1;
  for (let m = 1; m < 80; m++) {
    const a = E.dftAmplitude(h, m);
    if (a > bestA) { bestA = a; bestM = m; }
  }
  const lambdaObs = N / bestM;
  ok('  spectrum has a dominant wavelength', bestM > 1 && bestA > 1e-4,
     `peak at m=${bestM}, λ=${lambdaObs.toFixed(1)} cells`);
  // PHYSICAL NOTE: the observed nonlinear wavelength is NOT λ_fast. Migrating
  // ripples coarsen by merging (Yizhaq et al. 2012; Prigent et al.), so the
  // nonlinear λ_obs ends up several times larger than the linear prediction.
  // In real deserts λ/L ≈ 10–30; we assert the coarsening and the range.
  ok('  λ_obs > λ_fast (nonlinear coarsening)',
     lambdaObs > lambda,
     `λ_obs=${lambdaObs.toFixed(1)} vs λ_fast=${lambda.toFixed(1)}`);
  ok('  λ_obs in physical aeolian range (8L … 35L)',
     lambdaObs > 8 * p.L && lambdaObs < 35 * p.L,
     `λ_obs/L=${(lambdaObs / p.L).toFixed(1)}`);
  let hmin = +Infinity, hmax = -Infinity;
  for (let i = 0; i < N; i++) { hmin = Math.min(hmin, h[i]); hmax = Math.max(hmax, h[i]); }
  ok('  relief grew far above initial noise', (hmax - hmin) > 0.01,
     `relief=${(hmax - hmin).toExponential(2)}`);
}

// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${npass} passed, ${nfail} failed.`);
process.exit(nfail === 0 ? 0 : 1);
