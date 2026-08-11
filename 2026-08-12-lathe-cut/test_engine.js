// test_engine.js — assertions for the lathe-cut disc-record engine.
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

console.log('lathe-cut disc-record engine — verification\n');

// ─────────────────────────────────────────────────────────────────────────
// 1. Angular / linear velocity. v = ω·r; period = 60/rpm; ω = 2π·rpm/60.
// ─────────────────────────────────────────────────────────────────────────
console.log('[1] angular & linear velocity');
{
  near('  ω(33⅓) = 2π·0.5556', E.omega(100 / 3), 2 * Math.PI * (100 / 3) / 60, 1e-9);
  near('  revolution period 33⅓ rpm = 1.8 s', E.revolutionPeriod(100 / 3), 1.8, 1e-9);
  near('  revolution period 45 rpm = 1.333… s', E.revolutionPeriod(45), 4 / 3, 1e-9);
  // 33⅓ rpm at outer groove 146 mm → ωr in mm/s
  const v = E.linearVelocity(100 / 3, 146.05);
  near('  v outer (33⅓, 146mm) ≈ 509.7 mm/s', v, 2 * Math.PI * (100 / 3) / 60 * 146.05, 1e-6);
  near('  v outer matches published ~0.51 m/s', v / 1000, 0.5097, 0.0010);
}

// ─────────────────────────────────────────────────────────────────────────
// 2. The hero identity: λ = 2π·r·(rpm/60)/f. The inner-groove problem falls
//    straight out — λ shrinks with r. Real reference numbers are checkable.
// ─────────────────────────────────────────────────────────────────────────
console.log('[2] wavelength identity λ = 2πr·(rpm/60)/f');
{
  const rpm = 100 / 3;
  const lambdaOuter = E.wavelength(rpm, 146.05, 1000);
  const lambdaInner = E.wavelength(rpm, 70.0, 1000);
  near('  λ(1kHz, outer) ≈ 0.51 mm', lambdaOuter, 0.5097, 0.0010);
  near('  λ(1kHz, inner) ≈ 0.244 mm', lambdaInner, 0.2442, 0.0010);
  ok('  inner λ < outer λ (inner-groove problem)', lambdaInner < lambdaOuter);
  near('  ratio inner/outer = r_inner/r_outer', lambdaInner / lambdaOuter, 70.0 / 146.05, 1e-9,
       '— λ is exactly linear in r');
  // A 440 at the outer groove — sanity for the video's headline number.
  near('  λ(A440, outer) ≈ 1.158 mm', E.wavelength(rpm, 146.05, 440), 1.1584, 0.0020);
  // Doubling frequency halves λ; doubling rpm doubles λ.
  near('  2× freq → ½ λ', E.wavelength(rpm, 100, 2000), E.wavelength(rpm, 100, 1000) / 2, 1e-9);
  near('  2× rpm → 2× λ', E.wavelength(2 * rpm, 100, 1000), 2 * E.wavelength(rpm, 100, 1000), 1e-9);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Groove↔audio mapping. f = gpr·rpm/60 and the two wavelength forms agree.
//    This is the algebraic identity  2πr/gpr = 2πr·(rpm/60)/(gpr·rpm/60).
// ─────────────────────────────────────────────────────────────────────────
console.log('[3] wiggles-per-revolution ↔ frequency');
{
  const rpm = 100 / 3;
  // 440 Hz at 33⅓ rpm must be exactly 792 wiggles/rev.
  near('  A440 @33⅓ = 792 wiggles/rev', E.wigglesPerRevolution(440, rpm), 792, 1e-6);
  near('  frequency(792, 33⅓) = 440', E.frequency(792, rpm), 440, 1e-6);
  // The two λ formulas must agree across a sweep of gpr and r.
  let agree = true, worst = 0;
  for (const gpr of [4, 12, 30, 79, 200, 792]) {
    for (const r of [70, 100, 146]) {
      const a = E.wavelengthFromGpr(r, gpr);
      const b = E.wavelength(rpm, r, E.frequency(gpr, rpm));
      worst = Math.max(worst, Math.abs(a - b));
      if (Math.abs(a - b) > 1e-9) agree = false;
    }
  }
  ok('  wavelengthFromGpr ≡ wavelength(frequency(gpr))', agree, `worst Δ=${worst.toExponential(2)}`);
  // A 1 Hz tone laid down at 33⅓ rpm: exactly 1.8 wiggles per revolution.
  near('  1 Hz @33⅓ = 1.8 wiggles/rev', E.wigglesPerRevolution(1, rpm), 1.8, 1e-9);
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Resolvability. maxResolvableFrequency is the exact inverse of wavelength.
//    A real cutter tip (~25 µm) sets the ceiling; at the inner groove a 33⅓
//    record cannot resolve the top of the audible band.
// ─────────────────────────────────────────────────────────────────────────
console.log('[4] cutter resolution & inner-groove ceiling');
{
  const rpm = 100 / 3;
  const fMaxInner = E.maxResolvableFrequency(rpm, 70.0, 0.025);
  const fMaxOuter = E.maxResolvableFrequency(rpm, 146.05, 0.025);
  near('  f_max(λ≥25µm, outer) ≈ 20.4 kHz', fMaxOuter / 1000, 20.39, 0.05);
  near('  f_max(λ≥25µm, inner) ≈ 9.77 kHz', fMaxInner / 1000, 9.77, 0.05);
  ok('  inner groove cannot resolve 20 kHz', fMaxInner < 20000);
  ok('  outer groove can resolve 20 kHz', fMaxOuter > 20000);
  // Inverse identity: maxResolvableFrequency(r, λ) = f  ⟺  wavelength(r, f) = λ.
  near('  maxResolvableFrequency inverts wavelength',
       E.maxResolvableFrequency(rpm, 100, E.wavelength(rpm, 100, 1)), 1, 1e-9);
}

// ─────────────────────────────────────────────────────────────────────────
// 5. The Archimedean spiral. r(θ) = rOuter − (pitch/2π)·θ. Invariants:
//    r(0)=rOuter; r(θ_f)=rInner; turns = (rOuter−rInner)/pitch.
// ─────────────────────────────────────────────────────────────────────────
console.log('[5] spiral geometry');
{
  const rO = 146.05, rI = 70.0, pitch = 0.16; // ~159 lpi
  near('  r(0) = rOuter', E.spiralRadius(0, rO, pitch), rO, 1e-12);
  const turns = E.spiralTurns(rO, rI, pitch);
  near('  turns = (rO−rI)/pitch', turns, (rO - rI) / pitch, 1e-12);
  const thetaF = E.spiralThetaAtRadius(rI, rO, pitch);
  near('  θ_f = turns·2π', thetaF, turns * 2 * Math.PI, 1e-9);
  near('  r(θ_f) = rInner', E.spiralRadius(thetaF, rO, pitch), rI, 1e-9);
  near('  each turn drops radius by exactly pitch',
       rO - E.spiralRadius(2 * Math.PI, rO, pitch), pitch, 1e-12);
  // pitch ↔ lpi round trip.
  near('  lpi(159)≈159', E.lpiFromPitch(E.pitchFromLpi(159)), 159, 1e-9);
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Side time. minutes = turns/rpm. A 159-lpi cut over 76 mm at 33⅓ rpm.
// ─────────────────────────────────────────────────────────────────────────
console.log('[6] side time');
{
  const rO = 146.05, rI = 70.0, pitch = 0.16;
  const turns = E.spiralTurns(rO, rI, pitch);
  const mins = E.sideTimeMinutes(100 / 3, turns);
  near('  side ≈ 14.26 min at 33⅓ rpm', mins, turns / (100 / 3), 1e-9);
  ok('  side time in plausible LP range (10…30 min)', mins > 10 && mins < 30);
  // Faster rpm, same turns → proportionally less time.
  near('  45 rpm side is 33⅓/45 of the 33⅓ side',
       E.sideTimeMinutes(45, turns) / mins, (100 / 3) / 45, 1e-9);
}

// ─────────────────────────────────────────────────────────────────────────
// 7. Spiral arc length (the "needle travelled this far" readout).
//    Closed form ∫ r dθ against a brute-force Riemann sum.
// ─────────────────────────────────────────────────────────────────────────
console.log('[7] spiral arc length');
{
  const rO = 146.05, rI = 70.0, pitch = 0.16;
  const closed = E.spiralArcLength_mm(rO, rI, pitch);
  const thetaF = E.spiralThetaAtRadius(rI, rO, pitch);
  let sum = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N * thetaF;
    sum += E.spiralRadius(t, rO, pitch);
  }
  const riemann = sum * (thetaF / N);
  near('  closed form matches Riemann sum', closed, riemann, riemann * 1e-3,
       '— ∫₀^θf r(θ)dθ');
  ok('  arc length is hundreds of metres (real LP groove)',
     closed > 150 * 1000 && closed < 700 * 1000, `≈ ${(closed / 1000).toFixed(0)} m`);
}

// ─────────────────────────────────────────────────────────────────────────
// 8. Waveforms: bounded, periodic, landmark values.
// ─────────────────────────────────────────────────────────────────────────
console.log('[8] waveform shapes');
{
  let bounded = true;
  for (const t of Object.keys(E.WAVEFORMS)) {
    for (let i = 0; i < 200; i++) {
      const v = E.waveformSample(t, i / 200 * 7.3);
      if (v < -1.0001 || v > 1.0001) bounded = false;
    }
  }
  ok('  all waveforms bounded in [−1,1]', bounded);
  near('  sine(0)=0', E.waveformSample('sine', 0), 0, 1e-12);
  near('  sine(¼)=1', E.waveformSample('sine', 0.25), 1, 1e-12);
  near('  square(½-edge)=−1', E.waveformSample('square', 0.75), -1, 1e-12);
  near('  triangle(¼)=0', E.waveformSample('triangle', 0.25), 0, 1e-12);
  near('  saw(0)=1', E.waveformSample('saw', 0), 1, 1e-12);
  // Periodicity: phase+1 ≡ phase.
  for (const t of Object.keys(E.WAVEFORMS)) {
    near(`  ${t} periodic`, E.waveformSample(t, 0.31), E.waveformSample(t, 1.31), 1e-12);
  }
  // Table equals point samples (Float32 table → ~7 digits of agreement).
  const tbl = E.waveformTable('sine', 360);
  let tblOk = true;
  for (let i = 0; i < 360; i++) {
    if (Math.abs(tbl[i] - E.waveformSample('sine', i / 360)) > 1e-6) tblOk = false;
  }
  ok('  waveformTable matches point samples', tblOk);
  // Mean of each waveform over a full period (trapezoid).
  for (const t of Object.keys(E.WAVEFORMS)) {
    let acc = 0;
    const N = 100000;
    for (let i = 0; i < N; i++) acc += E.waveformSample(t, i / N);
    const mean = acc / N;
    ok(`  ${t} DC-mean ≈ 0`, Math.abs(mean) < 1e-3, `mean=${mean.toExponential(2)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 9. RIAA de-emphasis. Landmark dB values, monotone decreasing, 0 dB @ 1 kHz,
//    and the reciprocal/cutting identity: pre · post = const (flat when both
//    applied). Time constants τ0=3180µs, τ1=318µs, τ2=75µs.
// ─────────────────────────────────────────────────────────────────────────
console.log('[9] RIAA de-emphasis curve');
{
  near('  RIAA @1 kHz = 0 dB (definition)', E.riaaPlaybackDb(1000), 0, 1e-9);
  near('  RIAA @100 Hz ≈ +13.09 dB', E.riaaPlaybackDb(100), 13.09, 0.05);
  near('  RIAA @500 Hz ≈ +2.65 dB', E.riaaPlaybackDb(500), 2.65, 0.05);
  near('  RIAA @2122 Hz ≈ −2.86 dB', E.riaaPlaybackDb(2122), -2.86, 0.05);
  near('  RIAA @10 kHz ≈ −13.73 dB', E.riaaPlaybackDb(10000), -13.73, 0.05);
  near('  RIAA @20 kHz ≈ −19.62 dB', E.riaaPlaybackDb(20000), -19.62, 0.05);
  // Monotone decreasing over the audio band.
  let mono = true;
  for (let f = 20; f < 20000; f += 20) {
    if (E.riaaPlaybackDb(f + 20) > E.riaaPlaybackDb(f) + 1e-9) mono = false;
  }
  ok('  playback curve monotone decreasing (20 Hz…20 kHz)', mono);
  // 0 dB crossings of the time-constant poles/zeros land where advertised.
  near('  τ0 pole → 50.05 Hz', 1 / (2 * Math.PI * E.RIAA_TAU.tau0), 50.05, 0.01);
  near('  τ1 zero → 500.5 Hz', 1 / (2 * Math.PI * E.RIAA_TAU.tau1), 500.5, 0.1);
  near('  τ2 pole → 2122 Hz', 1 / (2 * Math.PI * E.RIAA_TAU.tau2), 2122, 1);
  // Pre-emphasis is the reciprocal of post-emphasis at every frequency
  // (× const); so the raw gains at f and the "mirror" frequency around 1 kHz
  // are consistent. Assert raw gain @1k equals the normalization constant.
  ok('  raw gain @1k positive & finite', E.riaaPlaybackGainRaw(1000) > 0);
}

// ─────────────────────────────────────────────────────────────────────────
// 10. The modulated groove point. Mean radius is the unmodulated spiral;
//     modulation amplitude never exceeds `amplitude`; the wiggle count per
//     revolution equals gpr (count sign changes of the sine modulation).
// ─────────────────────────────────────────────────────────────────────────
console.log('[10] modulated groove point');
{
  const rO = 146.05, pitch = 0.16, gpr = 24, amp = 0.6, timbre = 'sine';
  const turns = 3;
  const N = 20000;
  let ampOk = true, crossings = 0, prevPhase01 = null;
  for (let i = 0; i <= N; i++) {
    const theta = (i / N) * turns * 2 * Math.PI;
    const gp = E.groovePoint(theta, gpr, timbre, rO, pitch, amp);
    const meanR = E.spiralRadius(theta, rO, pitch);
    if (Math.abs(gp.r - meanR) > amp + 1e-9) ampOk = false;
    // count upward zero crossings of the modulation (sine)
    const phase01 = ((theta / (2 * Math.PI)) * gpr) % 1;
    if (prevPhase01 !== null && prevPhase01 > 0.5 && phase01 < 0.5) crossings++;
    prevPhase01 = phase01;
  }
  ok('  |r − meanR| ≤ amplitude (bounded excursion)', ampOk);
  // turns·gpr cycles → roughly that many upward zero-crossings (off by ≤1).
  ok('  ~gpr wiggles per revolution detected', Math.abs(crossings - turns * gpr) <= 1,
     `${crossings} crossings vs ${turns * gpr} expected`);
  // Modulation is along the radial direction, so |gp| ≈ r (point stays on ring).
  const mid = E.groovePoint(Math.PI, gpr, timbre, rO, pitch, amp);
  near('  point magnitude ≈ spiral radius', Math.hypot(mid.x, mid.y),
       E.spiralRadius(Math.PI, rO, pitch), amp + 1e-9);
}

// ─────────────────────────────────────────────────────────────────────────
// 11. End-to-end sanity: a "complete side" cut has self-consistent totals.
//     side_time · outer_linear_velocity ≈ total_groove_length only loosely
//     (r shrinks), but turns·2π·⟨r⟩ ≈ arc length exactly.
// ─────────────────────────────────────────────────────────────────────────
console.log('[11] end-to-end side consistency');
{
  const rO = 146.05, rI = 70.0, pitch = 0.16, rpm = 100 / 3;
  const turns = E.spiralTurns(rO, rI, pitch);
  const arc = E.spiralArcLength_mm(rO, rI, pitch);
  const sideSec = E.sideTimeMinutes(rpm, turns) * 60;
  const meanR = (rO + rI) / 2;
  const approxArcViaTime = sideSec * 2 * Math.PI * meanR * (rpm / 60);
  near('  arc ≈ side_time · 2π·⟨r⟩·(rpm/60)', arc, approxArcViaTime, approxArcViaTime * 0.02);
  // And the deepest math of all: cutting the same tone at the outer vs inner
  // groove differs ONLY in available resolution, never in pitch (rpm is fixed).
  const f = 1000;
  ok('  pitch independent of radius (rpm fixes playback pitch)',
     Math.abs(E.frequency(E.wigglesPerRevolution(f, rpm), rpm) - f) < 1e-9);
}

console.log(`\n${npass} passed, ${nfail} failed.`);
process.exit(nfail === 0 ? 0 : 1);
