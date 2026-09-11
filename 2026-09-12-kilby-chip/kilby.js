/* ==========================================================================
   kilby.js — closed-form physics for the 12 September 1958 first IC studio.
   Pure module: no DOM. Imported by app.js (browser) and test_kilby.mjs (Node).
   ========================================================================== */

// ---------------------------------------------------------------------------
// Complex arithmetic (re/im pairs)
// ---------------------------------------------------------------------------
export const C = (re, im = 0) => ({ re, im });
export const cAdd = (a, b) => C(a.re + b.re, a.im + b.im);
export const cSub = (a, b) => C(a.re - b.re, a.im - b.im);
export const cMul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const cDiv = (a, b) => {
  const d = b.re * b.re + b.im * b.im;
  return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};
export const cAbs = (a) => Math.hypot(a.re, a.im);
export const cArg = (a) => Math.atan2(a.im, a.re);

// ---------------------------------------------------------------------------
// The 3-section RC phase-shift feedback network (series C, shunt R).
// Nodal analysis of the unbuffered cascade gives, with x = sRC:
//     beta(x) = V3/Vo = x^3 / (x^3 + 6x^2 + 5x + 1)
// ---------------------------------------------------------------------------
export function feedbackBeta(x) {
  const num = cMul(cMul(x, x), x);
  const den = cAdd(cAdd(cAdd(num, cMul(cMul(x, x), C(6))), cMul(x, C(5))), C(1));
  return cDiv(num, den);
}

// Barkhausen: beta is real and negative exactly when the denominator is pure
// imaginary, i.e. 1 - 6y^2 = 0 with x = jy  =>  y = 1/sqrt(6).
// There beta = -1/29, so the inverting amplifier needs |A| >= 29.
export const BETA_Y = 1 / Math.sqrt(6);      // omega0 * R * C
export const CRITICAL_GAIN = 29;            // Routh-Hurwitz boundary
export const SQRT6 = Math.sqrt(6);

// Oscillation frequency of the classic 3-section phase-shift oscillator.
export function oscFrequency(R, Cfarad) {
  return 1 / (2 * Math.PI * R * Cfarad * SQRT6);
}

// ---------------------------------------------------------------------------
// Closed-loop characteristic polynomial. With loop gain -K the ideal
// amplifier closes the loop into  (1+K) x^3 + 6 x^2 + 5 x + 1 = 0,  x = sRC.
// Routh-Hurwitz for a cubic a3 s^3 + a2 s^2 + a1 s + a0 places a root pair on
// the imaginary axis when a2*a1 = a3*a0:
//     6 * 5 = (1+K) * 1   =>   K = 29,  omega = sqrt(a0/a2) = 1/sqrt(6).
// ---------------------------------------------------------------------------
export function charCoeffs(K) {
  return { a3: 1 + K, a2: 6, a1: 5, a0: 1 };
}

// Durand-Kerner root finder for a cubic with real coefficients.
export function cubicRoots(a3, a2, a1, a0) {
  const b = a2 / a3, c = a1 / a3, d = a0 / a3;
  let r = [C(1, 0.4), C(-0.7, 0.9), C(-0.3, -1.1)];
  for (let iter = 0; iter < 200; iter++) {
    let move = 0;
    for (let i = 0; i < 3; i++) {
      let denom = C(1);
      for (let j = 0; j < 3; j++) if (j !== i) denom = cMul(denom, cSub(r[i], r[j]));
      const num = cAdd(cAdd(cMul(cMul(r[i], r[i]), r[i]), cMul(cMul(r[i], r[i]), C(b))), cAdd(cMul(r[i], C(c)), C(d)));
      const step = cDiv(num, denom);
      r[i] = cSub(r[i], step);
      move = Math.max(move, cAbs(step));
    }
    if (move < 1e-14) break;
  }
  return r.sort((p, q) => q.re - p.re);
}

// Dominant (rightmost) root of the closed-loop cubic, in x = sRC units.
export function dominantRoot(K) {
  const { a3, a2, a1, a0 } = charCoeffs(K);
  const roots = cubicRoots(a3, a2, a1, a0);
  let best = roots[0];
  for (const root of roots) if (root.re > best.re) best = root;
  return best;
}

// Growth rate sigma (1/s) and oscillation frequency (Hz) of the linear loop.
export function linearLoopDynamics(R, Cfarad, K) {
  const root = dominantRoot(K);
  const s = { re: root.re / (R * Cfarad), im: root.im / (R * Cfarad) };
  return { sigma: s.re, omega: s.im, frequency: s.im / (2 * Math.PI), xRoot: root };
}

// ---------------------------------------------------------------------------
// Time-domain simulation of the actual circuit. The three RC sections are
// integrated in true state space over the series-capacitor voltages, closed
// through an instantaneous inverting amplifier vo = -K * clip(v3) with a
// monotonic hard clip at +/-Vlim. In the linear regime the loop reproduces
// the closed-loop cubic (1+K)x^3 + 6x^2 + 5x + 1 = 0 exactly (x = sRC).
// ---------------------------------------------------------------------------
// Describing function of the hard clip: for a sinusoid of amplitude U the
// fundamental gain is the classic textbook form
//     N = 1                                     U <= Vlim
//     N = (2/pi) (asin v + v sqrt(1 - v^2)),    v = Vlim/U < 1
// and the amplitude settles where K * N = 29.
export function clipDescribingFunction(v) {
  if (v >= 1) return 1;
  return (2 / Math.PI) * (Math.asin(v) + v * Math.sqrt(1 - v * v));
}

export function steadyAmplitude(K, Vlim) {
  if (K <= CRITICAL_GAIN) return Infinity;
  // N rises monotonically with v = Vlim/U; bisect K*N(v) = 29 on (0, 1]
  let lo = 0, hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    if (K * clipDescribingFunction(mid) > CRITICAL_GAIN) hi = mid; else lo = mid;
  }
  return Vlim / (0.5 * (lo + hi));
}

export function simulateOscillator({ R, Cfarad, K, Vlim, dt, steps, u0 = 1e-3 }) {
  const RC = R * Cfarad;

  // Algebraic loop, solved exactly: P = -(v3 + K*clip(v3)) is monotonic in
  // v3, so each drive value P has exactly one solution. Linear branch
  // v3 = -P/(1+K) while inside the clip; saturated branches outside.
  const solveV3 = (P) => {
    const linear = -P / (1 + K);
    if (Math.abs(linear) <= Vlim) return linear;
    const satHi = -P - K * Vlim;   // v3 > +Vlim requires drive P < -(1+K)Vlim
    const satLo = -P + K * Vlim;   // v3 < -Vlim requires P > +(1+K)Vlim
    if (satHi > Vlim) return satHi;
    if (satLo < -Vlim) return satLo;
    return Math.sign(linear) * Vlim;
  };

  const deriv = (p1, p2, p3) => {
    const P = p1 + p2 + p3;
    const v3 = solveV3(P);
    const vo = v3 + P;
    const r1 = (vo - p1) / RC, r2 = p2 / RC, r3 = p3 / RC;
    return [3 * r1 - 2 * r2 - r3, 2 * r1 - 2 * r2 - r3, r1 - r2 - r3, v3, vo];
  };

  let p1 = 0, p2 = 0, p3 = u0;
  let v3 = -u0 / (1 + K), vo = v3;
  const out3 = new Float64Array(steps);
  const outO = new Float64Array(steps);
  for (let i = 0; i < steps; i++) {
    out3[i] = v3;
    outO[i] = vo;
    const k1 = deriv(p1, p2, p3);
    const a = [p1 + 0.5 * dt * k1[0], p2 + 0.5 * dt * k1[1], p3 + 0.5 * dt * k1[2]];
    const k2 = deriv(a[0], a[1], a[2]);
    const b = [p1 + 0.5 * dt * k2[0], p2 + 0.5 * dt * k2[1], p3 + 0.5 * dt * k2[2]];
    const k3 = deriv(b[0], b[1], b[2]);
    const c = [p1 + dt * k3[0], p2 + dt * k3[1], p3 + dt * k3[2]];
    const k4 = deriv(c[0], c[1], c[2]);
    p1 += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    p2 += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    p3 += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    v3 = solveV3(p1 + p2 + p3);
    vo = v3 + (p1 + p2 + p3);
  }
  return { v3: out3, vo: outO };
}

// Fundamental amplitude of a quasi-sinusoid: least-squares sine fit over an
// integer number of periods (orthogonality makes the fit exact for periodic
// signals, and robust against the clip's higher harmonics).
export function fundamentalAmplitude(samples, dt, f) {
  const period = Math.round(1 / (f * dt));
  const cycles = Math.max(1, Math.floor(samples.length / period) - 1);
  const n = cycles * period;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    sa += samples[i] * Math.sin(2 * Math.PI * f * t);
    sb += samples[i] * Math.cos(2 * Math.PI * f * t);
  }
  return Math.hypot(2 * sa / n, 2 * sb / n);
}

// Frequency of a quasi-sinusoid from interpolated upward zero crossings.
export function measureFrequency(samples, dt) {
  const crossings = [];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i - 1] <= 0 && samples[i] > 0) {
      const frac = -samples[i - 1] / (samples[i] - samples[i - 1]);
      crossings.push((i - 1 + frac) * dt);
    }
  }
  if (crossings.length < 3) return NaN;
  let sum = 0;
  for (let i = 1; i < crossings.length; i++) sum += crossings[i] - crossings[i - 1];
  const avgPeriod = sum / (crossings.length - 1);
  return 1 / avgPeriod;
}

// Exponential envelope growth rate from successive peak amplitudes.
// Fits ln(amplitude) over the growth band (2%..50% of the largest peak) so a
// run that saturates is fitted on its exponential rise, not its flat top.
export function measureSigma(samples, dt) {
  const peaks = [];
  for (let i = 1; i < samples.length - 1; i++) {
    if (samples[i] > samples[i - 1] && samples[i] >= samples[i + 1] && samples[i] > 0) {
      peaks.push({ t: i * dt, a: samples[i] });
    }
  }
  if (peaks.length < 3) return NaN;
  const maxA = peaks.reduce((m, p) => Math.max(m, p.a), 0);
  const band = peaks.filter(p => p.a > maxA * 0.02 && p.a < maxA * 0.5);
  if (band.length < 3) return NaN;
  let st = 0, sy = 0, stt = 0, sty = 0;
  for (const p of band) { const y = Math.log(p.a); st += p.t; sy += y; stt += p.t * p.t; sty += p.t * y; }
  const n = band.length;
  return (n * sty - st * sy) / (n * stt - st * st);
}

// ---------------------------------------------------------------------------
// The germanium bar: bulk resistors and junction capacitors, 1958 style.
// ---------------------------------------------------------------------------
// Kilby's slab measured 7/16 x 1/16 inches.
export const BAR_LENGTH_IN = 7 / 16;
export const BAR_WIDTH_IN = 1 / 16;
export const IN_TO_CM = 2.54;
export const BAR_LENGTH_CM = BAR_LENGTH_IN * IN_TO_CM;  // 1.11125 cm
export const BAR_WIDTH_CM = BAR_WIDTH_IN * IN_TO_CM;    // 0.15875 cm

export function barResistance(rho, Lcm, wcm, tcm) {
  return rho * Lcm / (wcm * tcm);
}

export const EPS0_F_CM = 8.8541878128e-14;   // F/cm
export const Q_COULOMB = 1.602176634e-19;    // C
export const EPS_R_GE = 16;                  // relative permittivity of germanium
export const EPS_GE = EPS_R_GE * EPS0_F_CM;

// Abrupt one-sided junction depletion width (cm) under bias.
export function depletionWidth(Vbi, VR, Nd) {
  return Math.sqrt(2 * EPS_GE * (Vbi + Math.max(VR, 0)) / (Q_COULOMB * Nd));
}

// Junction capacitance of an area A (cm^2): C = eps * A / W.
export function junctionCapacitance(Acm2, Vbi, VR, Nd) {
  return EPS_GE * Acm2 / depletionWidth(Vbi, VR, Nd);
}

// ---------------------------------------------------------------------------
// The tyranny of numbers: discrete 1958 assembly accounting.
// One logic gate (RTL-style NOR) built discretely: 3 transistors, 4 resistors,
// 1 capacitor = 8 parts; every part has 2 soldered leads; every part also
// needs roughly one hookup wire.
// ---------------------------------------------------------------------------
export const DISCRETE_PER_GATE = { transistors: 3, resistors: 4, capacitors: 1 };
export const LAMBDA_TRANSISTOR = 1.0e-6;   // 1/hour, 1958 germanium
export const LAMBDA_PASSIVE = 2.0e-7;      // 1/hour
export const LAMBDA_JOINT = 5.0e-8;        // 1/hour per solder joint
export const SECONDS_PER_JOINT = 30;       // hand solder + route + inspect

export function tyrannyStats(gates) {
  const g = Math.max(1, Math.round(gates));
  const transistors = DISCRETE_PER_GATE.transistors * g;
  const resistors = DISCRETE_PER_GATE.resistors * g;
  const capacitors = DISCRETE_PER_GATE.capacitors * g;
  const parts = transistors + resistors + capacitors;
  const joints = 2 * parts;
  const wires = parts;
  const lambda = transistors * LAMBDA_TRANSISTOR + (resistors + capacitors) * LAMBDA_PASSIVE + joints * LAMBDA_JOINT;
  const mtbfHours = 1 / lambda;
  const assemblySeconds = joints * SECONDS_PER_JOINT;
  return {
    gates: g, transistors, resistors, capacitors, parts, joints, wires,
    lambda, mtbfHours, mtbfDays: mtbfHours / 24,
    assemblySeconds, assemblyPersonDays: assemblySeconds / (8 * 3600),
    boardAreaIn2: parts * 0.15,
  };
}

// ENIAC reality check: 17,468 tubes, roughly one tube failure every two days.
export const ENIAC_TUBES = 17468;
export const ENIAC_MTBF_HOURS = 48;
export function eniacTubeLambda() {
  return 1 / (ENIAC_MTBF_HOURS * ENIAC_TUBES); // ~1.19e-6 /hour per tube
}

// ---------------------------------------------------------------------------
// Moore scaling anchors: transistors per chip at landmark moments.
// Piecewise log-linear interpolation between anchors.
// ---------------------------------------------------------------------------
export const MOORE_ANCHORS = [
  { year: 1958, count: 1, label: 'Kilby phase-shift oscillator (germanium bar)' },
  { year: 1960, count: 4, label: 'Fairchild "Micrologic" planar family' },
  { year: 1965, count: 64, label: "Moore's Electronics article data point" },
  { year: 1971, count: 2300, label: 'Intel 4004, first microprocessor' },
  { year: 1978, count: 29000, label: 'Intel 8086' },
  { year: 1989, count: 1180000, label: 'Intel 80486' },
  { year: 1993, count: 3100000, label: 'Pentium (P5)' },
  { year: 2000, count: 42000000, label: 'Pentium 4 (Willamette)' },
  { year: 2010, count: 2300000000, label: 'Xeon Nehalem-EX, 8 cores' },
  { year: 2020, count: 16000000000, label: 'Apple M1, system on a chip' },
  { year: 2023, count: 92000000000, label: 'Apple M3 Max' },
  { year: 2026, count: 4000000000000, label: 'Cerebras WSE-class wafer engine' },
];

export function transistorsPerChip(year) {
  if (year <= MOORE_ANCHORS[0].year) return MOORE_ANCHORS[0].count;
  const last = MOORE_ANCHORS[MOORE_ANCHORS.length - 1];
  if (year >= last.year) return last.count;
  for (let i = 1; i < MOORE_ANCHORS.length; i++) {
    const a = MOORE_ANCHORS[i - 1], b = MOORE_ANCHORS[i];
    if (year === a.year) return a.count;
    if (year < b.year) {
      const t = (year - a.year) / (b.year - a.year);
      return Math.exp(Math.log(a.count) + t * (Math.log(b.count) - Math.log(a.count)));
    }
  }
  return last.count;
}

// How many chips are needed to realise N transistors in a given year,
// plus the discrete-1958 equivalent the tyranny panel charges for.
export function chipPlan(transistorCount, year) {
  const perChip = transistorsPerChip(year);
  const chips = Math.max(1, Math.ceil(transistorCount / perChip));
  const discreteGates = Math.ceil(transistorCount / 4); // ~4 transistors per gate
  const discrete = tyrannyStats(discreteGates);
  const joints = chips * 14;                    // 14-pin packs, one joint per pin
  const lambdaIC = 2.0e-7;                      // 1/hour per packaged 1960s IC
  const mtbfHours = 1 / (chips * lambdaIC + joints * LAMBDA_JOINT);
  return { year, perChip, chips, joints, mtbfHours, discrete };
}

// Doubling time implied by two (year, count) landmarks.
export function doublingTime(n1, y1, n2, y2) {
  const ratio = n2 / n1;
  return (y2 - y1) / Math.log2(ratio);
}

// ---------------------------------------------------------------------------
// Milestone cards for the timeline strip.
// ---------------------------------------------------------------------------
export const MILESTONES = [
  { year: '1958-07-24', title: 'The empty lab', text: 'TI shuts down for mass vacation. New hire Jack Kilby has no accrued leave and stays behind, alone with the miniaturization problem.' },
  { year: '1958-09-12', title: 'The sine wave', text: 'Kilby presses the switch on a phase-shift oscillator built on one 7/16 × 1/16 in germanium bar. The scope shows a continuous sine wave; Mark Shepherd and Willis Adcock look on.' },
  { year: '1959-02-06', title: 'Kilby files', text: 'US patent 3,138,743 "Miniaturized electronic circuits" — every component integrated in one slab of semiconductor.' },
  { year: '1959-05-01', title: 'Hoerni goes planar', text: 'Jean Hoerni files the planar process patent: junctions sealed under silicon dioxide instead of left exposed.' },
  { year: '1961-04-25', title: 'Noyce files on', text: "Robert Noyce's Fairchild patent issues: aluminium traces running over Hoerni's oxide layer connect the parts — no flying wires, mass production possible." },
  { year: '1965-04-19', title: "Moore's observation", text: 'Gordon Moore plots chip complexity and sees a doubling every year through the 1960s; revised to every two years in 1975.' },
  { year: '1971-11-15', title: 'A CPU on a chip', text: 'The Intel 4004 puts 2,300 transistors on one die — Moore extrapolation made product.' },
  { year: '2000-12-10', title: 'Nobel Prize', text: 'Kilby receives half of the Nobel Prize in Physics "for his part in the invention of the integrated circuit." He credited Noyce: had he lived, they would have shared it.' },
  { year: '2026-09-12', title: '68 years on', text: 'Every wafer-scale engine and phone SoC descends from that afternoon in Dallas: same idea, a few more zeros.' },
];
