// physics.js — WEAF 660 studio, exact closed forms.
// 28 Aug 1922, 5:15 pm: AT&T's WEAF New York sold ten minutes of airtime to
// the Queensboro Corporation for $50 — Mr. Blackwell pitched Hawthorne Court
// apartments in Jackson Heights, and commercial broadcasting began. Everything
// here is a formula you can check by hand: the AM trigonometric identity and
// its power split, the square-law detector's built-in distortion, the
// envelope-follower's diagonal-clipping bound, the LC tank's resonance, the
// detuning of meddling neighbours, the day/night two-ray fade, and the ledger.

export const C_LIGHT = 299792458;          // m/s
export const WEAF_KHZ = 660;               // "the old 660 position" — WFAN today

// --- 1 · amplitude modulation -------------------------------------------
//
//   s(t) = A·(1 + m·cos ω_m t)·cos ω_c t
//        ≡ A·cos ω_c t + (A·m/2)·cos(ω_c−ω_m)t + (A·m/2)·cos(ω_c+ω_m)t
//
// The product form IS the three-cosine form — a trigonometric identity, so
// the spectrum is exactly three lines: one carrier that carries no
// information, and two sidebands at ±f_m that carry all of it.

export const TAU = Math.PI * 2;

export function amSignal(t, A, m, fm, fc) {
  return A * (1 + m * Math.cos(TAU * fm * t)) * Math.cos(TAU * fc * t);
}

export function amThreeCosines(t, A, m, fm, fc) {
  const sb = sidebandAmp(A, m);
  return (
    A * Math.cos(TAU * fc * t) +
    sb * Math.cos(TAU * (fc - fm) * t) +
    sb * Math.cos(TAU * (fc + fm) * t)
  );
}

export const sidebandAmp = (A, m) => (A * m) / 2;

// Powers go as amplitude squared (into 1 Ω): carrier A²/2, each sideband
// A²m²/8. The fraction of total power that carries information:
export const sidebandPowerFrac = (m) => (m * m) / (2 + m * m);
export const carrierPowerFrac = (m) => 2 / (2 + m * m);
export const totalPower = (A, m) => (A * A / 2) * (1 + (m * m) / 2);

export const envelope = (t, A, m, fm) => A * (1 + m * Math.cos(TAU * fm * t));

// Overmodulation: for m > 1 the envelope (1 + m·cos) crosses zero twice per
// audio cycle — the transmitted phase flips and the envelope detector steals
// distortion products from thin air. Broadcast practice keeps m ≤ 1.
export function envelopeZeroCrossings(m) {
  return m > 1 ? 2 : 0;
}

// --- 2 · the cat's-whisker detector (square law) -------------------------
//
// A crystal diode around zero bias is v_out ≈ a₁v + a₂v². Squaring the AM
// signal and keeping the audio band after the RC load:
//
//   ⟨v²⟩ = (A²/2)·(1 + 2m·cos ω_m t + (m²/2)·cos 2ω_m t)
//
// so the recovered fundamental is A²m and the second harmonic (pure
// distortion, not in the original program) is A²m²/4. Their ratio is exactly
// m/4: at full modulation a crystal set hands you 25% second-harmonic
// distortion and there is nothing you can do about it.

export const sqFundamentalAmp = (A, m) => A * A * m;
export const sqSecondHarmonicAmp = (A, m) => (A * A * m * m) / 4;
export const sqDistortion = (m) => m / 4;

// --- 3 · the envelope follower and diagonal clipping ---------------------
//
// Between carrier peaks the RC load can only decay exponentially, while the
// envelope falls as fast as −A·m·ω_m. The follower first fails where the
// logarithmic slope of the envelope, m·ω_m·|sin θ|/(1+m·cos θ), is worst —
// at cos θ = −m — giving the exact single-tone bound:
//
//   R·C ≤ √(1−m²) / (m·ω_m)
//
// Too small an RC and the carrier ripple rides through; too large and the
// output sawtooth-clips the downstrokes of speech.

export const maxLoadRC = (m, fm) =>
  m <= 1e-9 ? Infinity : Math.sqrt(Math.max(0, 1 - m * m)) / (m * TAU * fm);

// Fractional droop between adjacent carrier peaks of the loaded capacitor.
export const rippleDroop = (fc, RC) => 1 - Math.exp(-1 / (fc * RC));

// Textbook analysis model: the diode conducts only at carrier peaks (it
// charges to the instantaneous positive envelope), and the RC load decays
// exponentially between peaks. Sampling at perCycle points per carrier cycle
// makes both the carrier ripple and diagonal clipping visible and exact.
// clipped = fraction of samples where the output rides ABOVE the true
// envelope — the signature of an RC that is too big.
export function simulateDetector({ A, m, fm, fc, RC, periods = 4, perCycle = 8 }) {
  const cycles = Math.max(4, Math.round((periods * fc) / fm));
  const n = cycles * perCycle;
  const dt = periods / fm / n;
  const out = new Float64Array(n);
  const env = new Float64Array(n);
  const decay = Math.exp(-dt / RC);
  let v = A;
  let clippedCount = 0;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const e = envelope(t, A, m, fm);
    env[i] = e;
    v *= decay;
    if (i % perCycle === 0) v = Math.max(v, Math.max(0, e)); // carrier peak
    out[i] = v;
    if (v > e + A * 1e-9) clippedCount++;
  }
  return {
    out, env, dt, n, cycles,
    clippedFrac: clippedCount / n,
  };
}

// --- 4 · the tank circuit: one knob, one station -------------------------
//
//   f₀ = 1/(2π·√(L·C)),   Q = ω₀L/R,   BW = f₀/Q
//
// The historical calibration: a 250 µH spiderweb coil plus the standard
// 15–365 pF variable capacitor tunes 660 kHz at 232.6 pF — dead centre of
// the dial. Off-resonance, a single tuned circuit obeys
//
//   |H(Δf)| = 1/√(1 + (2QΔf/f₀)²)
//
// which is −3 dB at exactly Δf = BW/2 and disappointingly gentle to
// neighbours: 20 kHz away it is only −16 dB. Two ganged circuits square it.

export const resFreq = (L, C) => 1 / (TAU * Math.sqrt(L * C));
export const capFor = (f, L) => 1 / ((TAU * f) * (TAU * f) * L);
export const qSeries = (f, L, R) => (TAU * f * L) / R;
export const bandwidth = (f, Q) => f / Q;

export function detuneResponse(df, f0, Q) {
  const x = (2 * Q * df) / f0;
  return 1 / Math.sqrt(1 + x * x);
}

export const stagesResponse = (df, f0, Q, stages = 1) =>
  Math.pow(detuneResponse(df, f0, Q), stages);

export const toDb = (x) => 20 * Math.log10(Math.max(x, 1e-12));

// The 1922 receiver defaults.
export const RX_DEFAULTS = {
  LuH: 250,      // spiderweb coil
  capPf: 232.6,  // → 660 kHz exactly
  coilR: 10,     // Ω, wire + losses
  loadRCuS: 60,  // headphone load
  stages: 1,
};

// Neighbouring stations for the selectivity demo (the 20 kHz spacing is
// period-honest; the programmes are stand-ins, clearly labelled fictional).
export const STATIONS = [
  { id: "east", khz: 640, name: "640 · 东区舞曲电台（虚构邻频）", short: "640 舞曲", color: "#7fa8c9", prog: "music" },
  { id: "weaf", khz: 660, name: "WEAF 660 · 昆斯伯罗的十分钟", short: "WEAF 广告", color: "#d4a437", prog: "speech" },
  { id: "west", khz: 680, name: "680 · 西区新闻电码（虚构邻频）", short: "680 电码", color: "#e8813a", prog: "morse" },
];

// --- 5 · day and night: ground wave, skywave, the fade -------------------
//
// Daytime: the D layer soaks up the skywave; only the ground wave survives
// and spreads over an expanding cylinder, E ∝ 1/d. The Hawthorne Court spot
// aired at 5:15 pm — broad daylight, one clean path.
//
// Night: the D layer vanishes, the E layer at ~100 km reflects the wave back.
// Two phasors arrive: |E_g + E_s·e^{iφ}| = √(E_g² + E_s² + 2E_gE_s·cos φ),
// and the phase is set by the path difference, φ = 2π·ΔL/λ. Equal
// amplitudes, opposite phase → a perfect null. Half a wavelength of path
// difference is one full swing from crest to cancellation.

export const wavelength = (f) => C_LIGHT / f;
export const quarterWave = (f) => wavelength(f) / 4;

export const groundWaveE = (E0, d0, d) => (E0 * d0) / d;

// Skywave over flat earth: one hop at the mid-point of height h.
export const skywavePath = (d, h) => 2 * Math.sqrt((d / 2) * (d / 2) + h * h);
export const pathDiff = (d, h) => skywavePath(d, h) - d;
export const phaseFromPath = (dPath, f) => (TAU * dPath) / wavelength(f);

export const twoRay = (Eg, Es, phi) =>
  Math.sqrt(Eg * Eg + Es * Es + 2 * Eg * Es * Math.cos(phi));

// The receiving car sits x km from the Walker Street antenna.
export const PROP_DEFAULTS = {
  night: false,
  skyAmp: 0.9,   // ρ = E_s/E_g at the receiver
  hEkM: 100,     // virtual E-layer reflection height
  distKm: 40,
};

// --- 6 · the ledger ------------------------------------------------------
//
// $50 bought 10 minutes on 28 Aug 1922; by October WEAF's toll-broadcasting
// book stood at $550 — eleven Hawthorne-sized spots.

export const SPOT_DOLLARS = 50;
export const SPOT_MINUTES = 10;
export const DOLLARS_PER_MIN = SPOT_DOLLARS / SPOT_MINUTES;
export const DOLLARS_PER_SEC = SPOT_DOLLARS / (SPOT_MINUTES * 60);
export const OCTOBER_SALES = 550;
export const OCTOBER_SPOTS = OCTOBER_SALES / SPOT_DOLLARS; // exactly 11

// --- presets -------------------------------------------------------------

export const TX_DEFAULTS = { A: 1, m: 0.85, fm: 800, fcKhz: WEAF_KHZ };

export const PRESETS = {
  air: {
    id: "air",
    label: "一九二二 · 广告现场",
    tx: { ...TX_DEFAULTS },
    rx: { ...RX_DEFAULTS },
    prop: { ...PROP_DEFAULTS, night: false },
  },
  splatter: {
    id: "splatter",
    label: "越调制事故 · m > 1",
    tx: { ...TX_DEFAULTS, m: 1.35 },
    rx: { ...RX_DEFAULTS },
    prop: { ...PROP_DEFAULTS },
  },
  midnight: {
    id: "midnight",
    label: "深夜 · 天波衰落",
    tx: { ...TX_DEFAULTS, fm: 620 },
    rx: { ...RX_DEFAULTS },
    prop: { ...PROP_DEFAULTS, night: true, skyAmp: 0.95 },
  },
  crosstalk: {
    id: "crosstalk",
    label: "串台困境 · 调在两台之间",
    tx: { ...TX_DEFAULTS },
    rx: { ...RX_DEFAULTS, capPf: 225.5 }, // ≈ 670 kHz, between WEAF and 680
    prop: { ...PROP_DEFAULTS },
  },
};
