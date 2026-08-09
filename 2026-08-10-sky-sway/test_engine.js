// test_engine.js — run with:  node test_engine.js
// Asserts the tuned-mass-damper engine against Den Hartog's closed forms and
// the equal-peaks invariant, the no-damper limit, and the ODE integrator's
// energy behavior. Pure logic — no DOM.

const e = require("./engine.js");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log("  ✗ " + name + (extra ? "  → " + extra : "")); }
}
function near(name, got, want, tol) {
  tol = tol == null ? 1e-9 : tol;
  ok(name, Math.abs(got - want) <= tol, `got ${got} want ${want} (±${tol})`);
}

// --- 1. Building period & frequency ----------------------------------------
// 0.1 s/floor rule.
near("period: 10 floors → 1.0 s", e.buildingPeriod(10), 1.0);
near("period: 100 floors → 10 s", e.buildingPeriod(100), 10.0);
near("period: 1 floor → 0.1 s", e.buildingPeriod(1), 0.1);
ok("period: invalid → NaN", Number.isNaN(e.buildingPeriod(0)));

// ω = 2π / T.
near("omega from T=1s → 2π", e.omegaFromPeriod(1.0), 2 * Math.PI);
near("omega from T=2π → 1 rad/s", e.omegaFromPeriod(2 * Math.PI), 1.0, 1e-12);

// K = M ω².  For M = 1e7 kg, ω = 1 → K = 1e7.
near("stiffness M·ω²", e.stiffness(1e7, 1.0), 1e7);
near("stiffness M·ω² squared", e.stiffness(2.0, 3.0), 18.0);

// C = 2 ξ M ω.
near("damping C = 2 ξ M ω", e.dampingCoeff(1.0, 1.0, 0.05), 0.1);

// --- 2. Den Hartog optimal tuning ------------------------------------------
// f_opt = 1 / (1 + μ).
near("f_opt μ=0.01 → ~0.9901", e.optimalFreqRatio(0.01), 1 / 1.01, 1e-12);
near("f_opt μ=0.05 → ~0.952", e.optimalFreqRatio(0.05), 1 / 1.05, 1e-12);
near("f_opt μ=0.1 → 0.909…", e.optimalFreqRatio(0.1), 1 / 1.1, 1e-12);

// ξ_opt = sqrt(3μ / [8(1+μ)³]).
function xiOptRef(mu) { return Math.sqrt((3 * mu) / (8 * Math.pow(1 + mu, 3))); }
near("ξ_opt μ=0.01", e.optimalDampingRatio(0.01), xiOptRef(0.01), 1e-12);
near("ξ_opt μ=0.05", e.optimalDampingRatio(0.05), xiOptRef(0.05), 1e-12);
near("ξ_opt μ=0.1", e.optimalDampingRatio(0.1), xiOptRef(0.1), 1e-12);
// Sanity: ξ_opt grows with μ but stays < ~0.17 for sensible μ.
ok("ξ_opt μ=0.1 < 0.2", e.optimalDampingRatio(0.1) < 0.2);
ok("ξ_opt μ=0.01 > 0.05", e.optimalDampingRatio(0.01) > 0.05);

// denHartog bundles both.
const dh = e.denHartog(0.05);
near("denHartog bundle f", dh.freqRatio, 1 / 1.05, 1e-12);
near("denHartog bundle ξ", dh.dampingRatio, xiOptRef(0.05), 1e-12);

// --- 3. No-damper SDOF transfer function ------------------------------------
// H0(g) = 1 / sqrt((1−g²)² + (2 ξ g)²). Classic checks:
//   g = 0   → H0 = 1 (static).
//   g → ∞   → H0 → 0.
//   g = 1, ξ → 0 → ∞ (resonance).
near("H0 g=0 → 1", e.noDamperResponse(0.0, 0.05), 1.0, 1e-12);
near("H0 g=1, ξ=0.05", e.noDamperResponse(1.0, 0.05), 1 / (2 * 0.05), 1e-9);
ok("H0 g=2 small", e.noDamperResponse(2.0, 0.05) < 0.4);
near("H0 g=1, ξ→0 diverges", e.noDamperResponse(1.0, 1e-9), 1 / (2e-9), 1e-3);

// --- 4. 2-DOF structure response: no-damper limit ---------------------------
// With μ → 0 (no damper mass), the 2-DOF response must collapse to the SDOF
// H0. We use a tiny μ and assert closeness across a frequency sweep.
{
  const mu = 1e-7, f = 1.0, xi1 = 0.05, xi2 = 0.05;
  let maxRelErr = 0;
  for (let i = 0; i < 50; i++) {
    const g = 0.3 + 1.4 * (i / 49);
    const h2 = e.structureResponse(g, mu, f, xi1, xi2);
    const h0 = e.noDamperResponse(g, xi1);
    const rel = Math.abs(h2 - h0) / Math.max(h0, 1e-9);
    if (rel > maxRelErr) maxRelErr = rel;
  }
  ok("μ→0 collapses to SDOF H0", maxRelErr < 1e-3, `maxRelErr=${maxRelErr.toExponential(2)}`);
}

// Far off-resonance, with-damper ≈ without-damper (TMD only matters near ω1).
// Note: finite μ does perturb the off-resonance response slightly, so we only
// require closeness, not equality.
{
  const mu = 0.05, dh2 = e.denHartog(0.05);
  const farOff = e.structureResponse(0.1, mu, dh2.freqRatio, 0.05, dh2.dampingRatio);
  const farOff0 = e.noDamperResponse(0.1, 0.05);
  near("off-resonance H ≈ H0", farOff, farOff0, 5e-2);
}

// --- 5. The equal-peaks invariant (the heart of Den Hartog tuning) ----------
// At optimal tuning with an UNDAMPED primary (ξ1 = 0), the structure's |H(g)|
// has TWO peaks of exactly equal height. The textbook value of that minimized
// peak is sqrt(1 + 2/μ). (Finite ξ1 breaks the equality slightly, so we test
// the theorem at its stated condition: ξ1 → 0.)
{
  for (const mu of [0.02, 0.05, 0.1]) {
    const dh2 = e.denHartog(mu);
    const peaks = e.findPeaks(mu, dh2.freqRatio, 1e-6, dh2.dampingRatio);
    ok(`μ=${mu}: has ≥2 peaks`, peaks.length >= 2, `got ${peaks.length}`);
    if (peaks.length >= 2) {
      const ratio = Math.min(peaks[0].h, peaks[1].h) / Math.max(peaks[0].h, peaks[1].h);
      ok(`μ=${mu}: equal-peaks (ratio > 0.98)`, ratio > 0.98,
         `peaks ${peaks[0].h.toFixed(3)}, ${peaks[1].h.toFixed(3)} ratio=${ratio.toFixed(3)}`);
      const predicted = e.optimalPeakHeight(mu);
      const meanH = 0.5 * (peaks[0].h + peaks[1].h);
      ok(`μ=${mu}: peak height ≈ sqrt(1+2/μ)`,
         Math.abs(meanH - predicted) / predicted < 0.03,
         `mean=${meanH.toFixed(3)} predicted=${predicted.toFixed(3)}`);
      ok(`μ=${mu}: peaks straddle g=1`,
         Math.min(peaks[0].g, peaks[1].g) < 1.0 && Math.max(peaks[0].g, peaks[1].g) > 1.0);
    }
  }
}

// --- 6. De-tuning breaks the equal-peaks property ---------------------------
// If we deliberately mis-tune (f far from f_opt), the peaks become unequal.
{
  const mu = 0.05;
  const dh2 = e.denHartog(mu);
  const well = e.findPeaks(mu, dh2.freqRatio, 0.02, dh2.dampingRatio);
  const poorly = e.findPeaks(mu, dh2.freqRatio * 0.7, 0.02, dh2.dampingRatio);
  if (well.length >= 2 && poorly.length >= 2) {
    const wellRatio = Math.min(well[0].h, well[1].h) / Math.max(well[0].h, well[1].h);
    const poorRatio = Math.min(poorly[0].h, poorly[1].h) / Math.max(poorly[0].h, poorly[1].h);
    ok("mis-tuning makes peaks less equal", poorRatio < wellRatio,
       `poor=${poorRatio.toFixed(3)} well=${wellRatio.toFixed(3)}`);
  }
}

// --- 7. The TMD reduces the peak vs no-damper resonance ---------------------
// With an undamped primary (ξ1 → 0), the bare building's resonance is
// unbounded; the optimally tuned damper caps it at sqrt(1 + 2/μ). With small
// finite ξ1 the bare peak is 1/(2 ξ1), and the TMD must cut that substantially.
{
  const xi1 = 0.01;             // a very lightly damped steel tower
  const mu = 0.05;
  const dh2 = e.denHartog(mu);
  // damped peak (use ξ1 → 0 to match the theorem's predicted height)
  const peaks0 = e.findPeaks(mu, dh2.freqRatio, 1e-6, dh2.dampingRatio);
  const dampedPeakOpt = peaks0.length ? peaks0[0].h : Infinity;
  ok("TMD peak matches sqrt(1+2/μ) at ξ1→0",
     Math.abs(dampedPeakOpt - e.optimalPeakHeight(mu)) / e.optimalPeakHeight(mu) < 0.03,
     `damped=${dampedPeakOpt.toFixed(3)} opt=${e.optimalPeakHeight(mu).toFixed(3)}`);
  // With small finite ξ1, the bare resonance is 1/(2 ξ1); TMD must cut it.
  const peaks = e.findPeaks(mu, dh2.freqRatio, xi1, dh2.dampingRatio);
  const dampedPeak = peaks.length ? peaks[0].h : Infinity;
  const barePeak = 1 / (2 * xi1); // = 50
  ok("TMD cuts peak < bare resonance", dampedPeak < barePeak * 0.7,
     `damped=${dampedPeak.toFixed(2)} bare=${barePeak.toFixed(2)}`);
}

// --- 8. ODE integrator: free decay with no damper conserves the envelope ----
// Start the bare SDOF (μ = 0) at x1 = 1, v1 = 0, no forcing. With ξ1 = 0 it
// must oscillate at ω1 = 1 with constant amplitude (energy conserved). With
// ξ1 > 0 the amplitude must decay.
{
  // undamped free vibration, ω1 = 1 (m1=1, k1=1, c1=0), no forcing.
  let s = [1, 0, 0, 0];
  const p = { m1: 1, m2: 0, k1: 1, k2: 0, c1: 0, c2: 0, F0: 0, omegaF: 0, t: 0 };
  const dt = 0.01;
  let maxAmp = 0, minAmp = Infinity;
  for (let i = 0; i < 6283; i++) {   // ~10 periods
    s = e.rk4Step(s, p, dt);
    p.t += dt;
    const amp = Math.sqrt(s[0] * s[0]);
    if (i > 100) {                   // skip startup transient
      if (amp > maxAmp) maxAmp = amp;
      if (amp < minAmp) minAmp = amp;
    }
  }
  near("undamped SDOF: amplitude conserved", maxAmp, 1.0, 1e-3);
  near("undamped SDOF: min amplitude ≈ 0", minAmp, 0.0, 1e-2);
}
{
  // damped free vibration, ξ1 = 0.05. Envelope must decay like e^{−ξ ω t}.
  let s = [1, 0, 0, 0];
  const p = { m1: 1, m2: 0, k1: 1, k2: 0, c1: 2 * 0.05 * 1 * 1, c2: 0, F0: 0, omegaF: 0, t: 0 };
  const dt = 0.005;
  const startAmp = 1.0;
  // Track the PEAK amplitude over a window late in the simulation (t ≈ 18–20 s)
  // so we measure the envelope, not the instantaneous (phase-dependent) value.
  let lateMax = 0;
  for (let i = 0; i < 4000; i++) {   // 20 s
    s = e.rk4Step(s, p, dt);
    p.t += dt;
    if (p.t > 18.0) {
      const a = Math.abs(s[0]);
      if (a > lateMax) lateMax = a;
    }
  }
  // predicted envelope at t ≈ 19 s: exp(−0.05·1·19) ≈ 0.3867
  const predicted = startAmp * Math.exp(-0.05 * 1 * 19);
  ok("damped SDOF: decays at e^{−ξωt}",
     lateMax > predicted * 0.85 && lateMax < predicted * 1.15,
     `envelopePeak=${lateMax.toFixed(3)} predicted~${predicted.toFixed(3)}`);
}

// --- 9. ODE: a tuned damper reduces the steady-state sway -------------------
// Drive the bare building at resonance and at the same drive with an optimally
// tuned TMD; the TMD case must have lower steady-state |x1|.
function steadyStateAmp(p, x0, steps, dt) {
  let s = [x0, 0, 0, 0];
  p.t = 0;
  let maxAmp = 0;
  for (let i = 0; i < steps; i++) {
    s = e.rk4Step(s, p, dt);
    p.t += dt;
    if (i > steps * 0.7) {          // measure only the settled tail
      const amp = Math.abs(s[0]);
      if (amp > maxAmp) maxAmp = amp;
    }
  }
  return maxAmp;
}
{
  const omega1 = 1.0;
  const m1 = 1.0;
  const mu = 0.05;
  const m2 = mu * m1;
  const dh2 = e.denHartog(mu);
  const omega2 = dh2.freqRatio * omega1;
  const xi1 = 0.01, xi2 = dh2.dampingRatio;
  const k1 = m1 * omega1 * omega1;
  const k2 = m2 * omega2 * omega2;
  const c1 = 2 * xi1 * m1 * omega1;
  const c2 = 2 * xi2 * omega2 * m2;       // note: ξ2·ω2·m2 form
  const F0 = 1.0;
  const dt = 0.01;
  const steps = 60000;

  // Bare building at resonance (g = 1).
  const bare = steadyStateAmp(
    { m1, m2: 0, k1, k2: 0, c1, c2: 0, F0, omegaF: omega1, t: 0 }, 0, steps, dt);
  // With TMD at the SAME forcing frequency (still ω1).
  const tmd = steadyStateAmp(
    { m1, m2, k1, k2, c1, c2, F0, omegaF: omega1, t: 0 }, 0, steps, dt);

  ok("TMD lowers resonant sway in time domain", tmd < bare * 0.5,
     `bare=${bare.toFixed(2)} tmd=${tmd.toFixed(2)}`);
  // The damper mass itself must be moving MORE than the structure at steady
  // state (it's doing the absorbing).
  {
    let s = [0, 0, 0, 0];
    const p = { m1, m2, k1, k2, c1, c2, F0, omegaF: omega1, t: 0 };
    let maxX1 = 0, maxX2 = 0;
    for (let i = 0; i < steps; i++) {
      s = e.rk4Step(s, p, dt);
      p.t += dt;
      if (i > steps * 0.7) {
        if (Math.abs(s[0]) > maxX1) maxX1 = Math.abs(s[0]);
        if (Math.abs(s[2]) > maxX2) maxX2 = Math.abs(s[2]);
      }
    }
    ok("damper mass swings more than the structure", maxX2 > maxX1,
       `m1=${maxX1.toFixed(2)} m2=${maxX2.toFixed(2)}`);
  }
}

// --- 10. Reference buildings sanity -----------------------------------------
ok("references include Taipei 101", e.REFERENCE_BUILDINGS.some(b => b.id === "taipei101"));
ok("Taipei 101 damper ≈ 728 t",
   Math.abs(e.REFERENCE_BUILDINGS.find(b => b.id === "taipei101").damperMass - 728000) === 0);

// --- summary ---------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) {
  console.log("FAILURES PRESENT.");
  process.exit(1);
} else {
  console.log("ALL OK.");
}
